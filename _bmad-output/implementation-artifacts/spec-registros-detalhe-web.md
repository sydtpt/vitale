---
title: 'Registros: detalhe web com métricas por período e heatmap clicável'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6a3a1c0eb227e8aeca5b50dcc66d7a70db127f18'
context:
  - '{project-root}/docs/specs/registros/spec.md'
  - '{project-root}/docs/specs/registros/metricas-do-detalhe.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A metade web do SPEC-registros (CAP-5/6/7) ficou deferida no build mobile: em `/registros` os cards de análise são fixos (janela de 84 dias) e clicar num registro não abre nada por item.

**Approach:** Rota `/registros/:id` com as mesmas métricas do detalhe mobile, lidas do núcleo já entregue (`buildRegistroDetail`/`yearHeatmap`), e o pedaço do CAP-7 que só existe na web: **clique na célula do heatmap anual alterna a marca daquele dia** (precisão de mouse).

## Boundaries & Constraints

**Always:**
- Derivações só do núcleo — a página nunca refaz conta; histórico completo via `fetchRegistroLogDates` (paginado), escrita via `setRegistroMark`. Nenhum fetch novo no Supabase.
- Angular da casa: standalone + OnPush + `inject()` + signals; SCSS com variáveis CSS/tokens — nunca hex.
- Reusar `PeriodSelectorComponent` do histórico (labels web: "12 meses"); default `meses12`; escolha persistida em `localStorage` com try/catch (padrão do `overview-card`).
- Delta sempre contagem absoluta; sazonalidade não renderiza no período `ano` (duplicaria as barras); métricas em cards, não tabela.
- Heatmap clicável só em dias ≤ hoje, otimista com revert em erro; dias futuros inertes; arquivados abrem o detalhe.
- Rota atrás de `profileGuard`; lista/cards continuam — o clique soma navegação, os botões Editar/Arquivar ficam.

**Ask First:**
- Qualquer mudança de schema/migration (não deve haver).
- Tocar em `ConsistencyCard.tsx` / `consistency.ts` (WIP de outra sessão na árvore).

**Never:**
- Reimplementar derivações no web ou mudar o núcleo (`packages/shared/src/registros/` é read-only).
- Redesenhar a página lista v1 além dos pontos de clique.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Feliz | clique num registro, período 12m | 12 barras por mês, total + delta absoluto, todas as métricas | N/A |
| Toggle no heatmap | clique num dia passado | marca/desmarca otimista, persiste, métricas e barras refletem na hora | revert visual + estado em erro de rede |
| Dia futuro | clique numa célula > hoje | inerte, sem request | N/A |
| Deep link | URL `/registros/:id` aberta direto | página carrega o store e renderiza; id inexistente → redirect a `/registros` | N/A |
| Janela vazia / <2 marcas | período sem marcas | barras zeradas, total 0; intervalos "—", layout estável | N/A |
| Sem período anterior | `sempre`, ou 1º ano | delta `null` → sem comparação renderizada | N/A |
| Arquivado | registro `active=false` | detalhe abre com todo o histórico + badge Arquivado | N/A |
| Fetch do histórico falha | erro de rede | estado de erro com "tentar de novo"; se já há dados na tela, falha silenciosa | catch, sem crash |
| Ano navegado | ◀/▶ | barras (período Ano) e heatmap seguem o ano; ▶ desabilitado no corrente | N/A |
| Período persistido | fechar e voltar ao detalhe | reabre no último período escolhido (default `meses12`) | localStorage indisponível → só memória |

</frozen-after-approval>

## Code Map

- `packages/shared/src/registros/detail.ts` — `buildRegistroDetail(dates, period, {now, yearOffset})` e `yearHeatmap(dates, year)`; o contrato inteiro das métricas. Read-only.
- `packages/shared/src/data/registros.ts:152-201` — `fetchRegistroLogDates` (histórico completo paginado) e `setRegistroMark` (upsert/delete por dia). Read-only.
- `web/src/main.ts:94-99` — rota `registros`; somar `registros/:id` (profileGuard, lazy) logo após.
- `web/src/app/features/registros/data/registros.store.ts` — fonte única (janela de 84d p/ lista); somar: fetch do histórico completo de um registro e `toggleDay(id, date)` que escreve via `setRegistroMark` e mantém `_logs` da janela coerente quando o dia cai nela.
- `web/src/app/features/registros/pages/registros-page.component.html:40-100` — linha da lista e `rt-registro-analytics-card`: ganham navegação para `/registros/:id` (botões Editar/Arquivar intactos).
- `web/src/app/features/registros/components/registro-editor.component.ts` — modal de edição existente; o detalhe o abre pelo botão Editar.
- `web/src/app/features/workout-history/components/period-selector.component.ts` — seletor pronto (`Period` re-exportado do núcleo); importar cross-feature.
- `web/src/app/features/workout-history/components/overview-card.component.ts:26-34,120-124` — padrão localStorage try/catch e o visual de delta a seguir.
- `web/src/app/features/habits/components/habit-heatmap.component.ts` — referência de grid semanas×7; o anual clicável é componente novo.
- `web/src/app/features/registros/data/registro-logic.ts` — derivações da janela v1; permanecem para os cards da lista.

## Tasks & Acceptance

**Execution:**
- [x] `web/src/app/features/registros/data/registros.store.ts` — somar `fetchAllDatesFor(id): Promise<string[]>` (via `fetchRegistroLogDates`) e `toggleDay(id, date, marked)` (via `setRegistroMark`, atualizando `_logs` quando `date` ≥ janela) — a página de detalhe não fala com o Supabase diretamente.
- [x] `web/src/app/features/registros/components/registro-year-heatmap.component.ts` — novo: grid de `yearHeatmap()` (semanas×7, célula marcada = accent do módulo, vazia = `var(--line)`, fora do ano transparente), célula ≤ hoje é botão acessível que emite `(toggle)`; futuro inerte.
- [x] `web/src/app/features/registros/pages/registro-detail-page.component.{ts,html,scss}` — nova página: header (voltar, ícone+nome+badge, Editar → modal existente), `rt-period-selector`, barras SVG inline (eixo inteiro, cor do módulo), tiles (total+delta, última vez, frequência), cards Ritmo / Dia da semana / Sazonalidade (mini-barras), heatmap anual clicável com ◀ ano ▶; período default/persistido; deep link carrega o store e redireciona se o id não existir.
- [x] `web/src/main.ts` — rota `registros/:id` com `profileGuard`.
- [x] `web/src/app/features/registros/pages/registros-page.component.html` — linha e card navegam para o detalhe.

**Acceptance Criteria:**
- Given a página `/registros`, when clico numa linha ou num card de análise (ativo ou arquivado), then abro `/registros/:id` com as métricas; Editar/Arquivar continuam funcionando na lista.
- Given o detalhe aberto, when alterno os 5 períodos, then gráfico e métricas re-derivam sem novo fetch.
- Given o heatmap anual, when clico num dia passado, then a marca alterna, persiste e todas as métricas refletem imediatamente; um clique num dia futuro não faz nada.
- Given a URL `/registros/:id` aberta num navegador novo, then a página carrega sozinha (store hidrata) e um id inexistente me devolve a `/registros`.
- Given que volto ao detalhe depois, then o período aberto é o último que escolhi.

## Spec Change Log

## Design Notes

- Labels do seletor seguem o histórico **web** ("12 meses", não "12m" — aqui há espaço).
- Delta com o mesmo tratamento visual do `overview-card` (três estados; `null` não renderiza).
- Sem gráfico de terceiros: barras em SVG inline no componente, como os gráficos da casa.
- O heatmap clicável usa `<button>` por célula (a11y) com `aria-label` "dia YYYY-MM-DD, marcado/não".
- `registro-logic.ts` NÃO cresce: derivação nova é sempre do núcleo.

## Verification

**Commands:**
- `pnpm --filter @vitale/web build` — expected: templates e TS compilam.
- `pnpm --filter @vitale/web test` — expected: Vitest verde.
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` — expected: núcleo intocado segue verde.

**Manual checks (if no CLI):**
- No navegador: toggle otimista no heatmap (marcar/desmarcar dia passado), deep link, período persistido, arquivado, e o modo escuro da web na página nova.
- Linhas da matriz sem teste automatizável (web não tem infra de teste de componente de página; auditoria de 2026-09-02): **Dia futuro** (clique inerte, sem request), **Ano navegado** (▶ desabilitado no corrente), **Fetch falha** (rede off → retry só sem dados na tela) — verificar no navegador. As linhas de derivação (janela vazia, <2 marcas, delta null, feliz) são cobertas pelos testes do núcleo em `packages/shared/src/registros/detail.test.ts`.

## Suggested Review Order

**A escrita retroativa (CAP-7 web) — o coração da mudança**

- Transições puras novas no núcleo: toggle otimista/revert e coerência da janela em cache
  [`toggle.ts:19`](../../packages/shared/src/registros/toggle.ts#L19)

- O store consome `applyMarkToWindow` — a lista continua correta ao voltar do detalhe
  [`registros.store.ts:152`](../../web/src/app/features/registros/data/registros.store.ts#L152)

- Otimista com revert por dia, guarda de corrida por id, erro visível
  [`registro-detail-page.component.ts:280`](../../web/src/app/features/registros/pages/registro-detail-page.component.ts#L280)

- Célula ≤ hoje é `<button>` acessível; futuro é span inerte
  [`registro-year-heatmap.component.ts:63`](../../web/src/app/features/registros/components/registro-year-heatmap.component.ts#L63)

**A página de detalhe (CAP-5/6)**

- Tudo deriva do núcleo num computed — trocar período nunca refaz fetch
  [`registro-detail-page.component.ts:132`](../../web/src/app/features/registros/pages/registro-detail-page.component.ts#L132)

- Reuso por navegação de parâmetro: reset de estado + relógio por rota
  [`registro-detail-page.component.ts:205`](../../web/src/app/features/registros/pages/registro-detail-page.component.ts#L205)

- Período default `meses12`, persistido com o padrão localStorage da casa
  [`registro-detail-page.component.ts:45`](../../web/src/app/features/registros/pages/registro-detail-page.component.ts#L45)

**Navegação e a11y**

- O link real é o nome (`<a routerLink>`, focus-visible, nova aba); clique na linha é enhancement
  [`registros-page.component.html:51`](../../web/src/app/features/registros/pages/registros-page.component.html#L51)

- Rota nova atrás do profileGuard
  [`main.ts:101`](../../web/src/main.ts#L101)

**Periféricos**

- Janela `since` única e DST-safe
  [`registros.store.ts:27`](../../web/src/app/features/registros/data/registros.store.ts#L27)

- 13 testes das transições (janela, dedupe, revert, imutabilidade)
  [`toggle.test.ts:1`](../../packages/shared/src/registros/toggle.test.ts#L1)
