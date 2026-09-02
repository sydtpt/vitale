---
title: 'Registros: detalhe mobile com métricas por período'
type: 'feature'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ce050a287367648c1feb28e0befe4d7072c9cf51'
context:
  - '{project-root}/docs/specs/registros/spec.md'
  - '{project-root}/docs/specs/registros/metricas-do-detalhe.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tocar num registro abre o editor; o histórico acumulado (Pizza, Dentista…) não tem leitura por item no app — o dado é write-only no celular.

**Approach:** Derivações puras novas no shared + tela de detalhe no mobile com seletor de 5 períodos (7d/4s/12m/Ano/Sempre), no molde do histórico de treinos. Edição migra para lápis no header do detalhe; correção retroativa delega ao calendário `/registros/marcar` existente.

## Boundaries & Constraints

**Always:**
- Derivações em `packages/shared` com testes; a tela só renderiza.
- Reusar o tipo `Period` do núcleo e labels `7d/4s/12m/Ano/Sempre`; reusar `fetchRegistroLogDates`/`setRegistroMark` — nenhum fetch novo.
- Período default `meses12`; última escolha persistida por aparelho (`getJSON`/`setJSON` de `lib/local-store`).
- Delta sempre contagem absoluta (+1/−2); valores inteiros; métricas em cards/linhas, nunca tabela.
- Cores via `moduleColors()`/tokens do tema — nunca hex na tela; animação só com `Animated` (ADR 0010).

**Ask First:**
- Qualquer mudança de schema/migration (não deve haver).
- Tocar em `ConsistencyCard.tsx` / `consistency.ts` (WIP de outra sessão na árvore).

**Never:**
- Detalhe web (deferido em `deferred-work.md`).
- Nova superfície de edição retroativa — o heatmap do detalhe é só-leitura e leva ao `marcar`.
- Importar Reanimated.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Feliz | histórico plurianual, período 12m | 12 barras por mês, total + delta absoluto, todas as métricas | N/A |
| Janela vazia | 0 marcas no período | barras zeradas + total 0; delta vs anterior ainda calcula | N/A |
| Histórico curto | <2 marcas na janela | intervalo médio e maior jejum mostram "—", layout estável | N/A |
| Sazonalidade | período 7d ou 4s | seção de sazonalidade ausente (só 12m/Ano/Sempre) | N/A |
| Sem período anterior | período Sempre, ou 1º ano | delta `null` → não renderiza comparação | N/A |
| Arquivado | registro `active=false` | detalhe abre normal com todo o histórico | N/A |
| Id inválido | param `id` não existe no store | volta (`router.back()`) silencioso | N/A |
| Fetch falha | erro de rede em `fetchRegistroLogs` | mensagem "não deu para carregar" + botão tentar de novo | catch, sem crash |
| Volta do marcar | dias editados no calendário | refetch on focus; métricas e heatmap refletem | N/A |
| Ano navegado | período Ano, chevron ◀ | barras e heatmap do ano anterior; ▶ desabilita no corrente | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/fitness/overview.ts:30` — tipo `Period` (`'semana'|'mes'|'meses12'|'ano'|'sempre'`) a reusar. Read-only.
- `packages/shared/src/data/registros.ts:152-168` — `fetchRegistroLogDates(db,userId,registroId)` já pagina o histórico completo. Read-only.
- `packages/shared/src/date/local.ts` — `localDateStr`. Read-only.
- `packages/shared/src/registros/` — **novo módulo** de derivações (padrão dos irmãos `fitness/`, `habits/`).
- `packages/shared/src/index.ts:25-28` — bloco de exports por domínio; somar o novo módulo.
- `mobile/src/store/registros.store.ts:131-150` — `fetchRegistroLogs(id)` e `setRegistroMark` prontos. Read-only.
- `mobile/src/app/registros/index.tsx:46` — tap da linha empurra `/registros/editor`; passa a `/registros/detalhe`.
- `mobile/src/app/registros/marcar.tsx` — calendário mensal por registro (`params: {id}`), destino do "editar dias". Read-only.
- `mobile/src/components/ui/Segmented.tsx` — seletor segmentado genérico (variant `neutral`).
- `mobile/src/components/charts/BarChart.tsx` — barras SVG; consome `Bucket {label,date,value,count,empty}` de `lib/health-buckets.ts:28`.
- `mobile/src/lib/local-store.ts` — `getJSON`/`setJSON` p/ persistir o período escolhido.
- `mobile/src/app/(tabs)/historico.tsx:31-55` — referência de PERIODS/labels e navegação de ano.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/registros/detail.ts` — novo: `buildRegistroDetail(dates: string[], period: Period, opts: {now?: Date; yearOffset?: number})` → `{buckets, total, delta, lastDate, daysSinceLast, freq, avgGapDays, maxGapDays, weekdayCounts, monthCounts, firstDate, allTimeTotal, canPrevYear, canNextYear}`; e `yearHeatmap(dates, year)` → semanas×7 células `{date, marked, inYear}` — puro, molde do catálogo em `metricas-do-detalhe.md`.
- [x] `packages/shared/src/registros/detail.test.ts` — cobrir cada linha da matriz de edge cases + caso plurianual conferido à mão (estilo `tsx` + assert dos irmãos).
- [x] `packages/shared/src/index.ts` — exportar `./registros/detail`.
- [x] `mobile/src/app/registros/detalhe.tsx` — nova tela: header (voltar, ícone+nome, lápis→`/registros/editor?id=`), `Segmented` de períodos, `BarChart`, cards de métricas, heatmap anual só-leitura (tap → `/registros/marcar?id=`), chevrons de ano, refetch via `useFocusEffect`, período default/persistido. (+ `Stack.Screen registros/detalhe` no `_layout.tsx`, pela animação das rotas irmãs.)
- [x] `mobile/src/app/registros/index.tsx` — tap da linha → `/registros/detalhe?id=`; botões marcar/arquivar intactos; arquivados também navegam.

**Acceptance Criteria:**
- Given a lista de registros, when toco numa linha (ativa ou arquivada), then abre o detalhe — e o editor só pelo lápis do header.
- Given o detalhe aberto, when alterno os 5 períodos, then gráfico e métricas re-derivam sem novo fetch (histórico completo já em memória).
- Given que editei dias no `marcar` e voltei, then o detalhe refaz o fetch e reflete as mudanças.
- Given que fecho e reabro o detalhe, then o período aberto é o último escolhido (default `meses12` na primeira vez).

## Spec Change Log

## Design Notes

- Dia da semana **segunda-first** (convenção do retro/HeatmapGrid), não a domingo-first do `marcar`.
- Heatmap binário: célula marcada = `mod.accent`, vazia = `colors.line`; **não** reusar a escala divergente de `HeatmapGrid`.
- `freq` = total ÷ semanas da janela (7d/4s) ou ÷ meses (12m/Ano/Sempre), rótulo "×/sem" ou "×/mês" com 1 decimal; barras e totais sempre inteiros.
- `delta: number | null` — `null` = sem período anterior comparável (não renderizar).

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` — expected: tsc limpo.
- `pnpm --filter @vitale/shared test` — expected: testes novos passam + barreiras de arquitetura verdes.
- `cd mobile && pnpm exec tsc --noEmit` — expected: sem erros.
- `cd mobile && pnpm exec jest` — expected: suíte existente verde.

**Manual checks (if no CLI):**
- Conferência visual em escala real + build Release no iPhone antes do merge (constraint de done do SPEC-registros).
- Linhas da matriz sem teste automatizável (mobile não tem infra de teste de componente; auditoria de 2026-09-02): **Arquivado** (tap num arquivado abre o detalhe), **Id inválido** (deep link com id inexistente volta em silêncio), **Fetch falha** (modo avião → mensagem + tentar de novo), **Volta do marcar** (editar dias e voltar reflete nas métricas), **▶ do ano** desabilitado no corrente — verificar no aparelho.

## Suggested Review Order

**Núcleo — derivações puras (o contrato de CAP-6)**

- Ponto de entrada: orquestra janela, delta, gaps e distribuições sobre a lista de datas
  [`detail.ts:266`](../../packages/shared/src/registros/detail.ts#L266)

- Um plano por período: buckets + chaves da janela anterior (a fonte do delta absoluto)
  [`detail.ts:121`](../../packages/shared/src/registros/detail.ts#L121)

- Frequência com denominador decorrido — semana/mês parciais não subestimam mais
  [`detail.ts:213`](../../packages/shared/src/registros/detail.ts#L213)

- Doc da assimetria deliberada do delta no Ano (YTD vs ano cheio, herdada do molde)
  [`detail.ts:80`](../../packages/shared/src/registros/detail.ts#L80)

- Grade anual segunda-first, 53–54 colunas, pontas fora do ano
  [`detail.ts:363`](../../packages/shared/src/registros/detail.ts#L363)

**Tela — leitura vira o gesto principal (CAP-5/7)**

- A mudança de comportamento: tap da linha abre o detalhe, não mais o editor
  [`index.tsx:49`](../../mobile/src/app/registros/index.tsx#L49)

- Os 5 períodos com default `meses12` e escolha persistida por aparelho
  [`detalhe.tsx:41`](../../mobile/src/app/registros/detalhe.tsx#L41)

- Focus refaz fetch e reancora `now` — volta do marcar e virada de dia cobertas
  [`detalhe.tsx:244`](../../mobile/src/app/registros/detalhe.tsx#L244)

- Heatmap só-leitura: qualquer toque delega ao calendário `marcar` existente
  [`detalhe.tsx:134`](../../mobile/src/app/registros/detalhe.tsx#L134)

- Erro de refetch só apaga a tela quando não há dado nenhum em memória
  [`detalhe.tsx:308`](../../mobile/src/app/registros/detalhe.tsx#L308)

**Periféricos**

- Registro da rota nova com a animação das irmãs
  [`_layout.tsx:199`](../../mobile/src/app/_layout.tsx#L199)

- Fixture "Pizza" plurianual conferida à mão — o portão de CAP-6
  [`detail.test.ts:33`](../../packages/shared/src/registros/detail.test.ts#L33)

- Caso de 54 colunas (bissexto abrindo em domingo)
  [`detail.test.ts:254`](../../packages/shared/src/registros/detail.test.ts#L254)
