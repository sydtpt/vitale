---
title: 'Story 2.7 — O detector de métrica morta'
type: 'feature'
created: '2026-09-23'
status: 'done'
baseline_commit: '99665ca'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
  - '{project-root}/docs/decisions/0054-ausencia-tem-dois-criterios-ato-e-medicao.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O núcleo sabe receber, conferir, narrar, ranquear e desenhar a lápide desde as stories 1.7 e 1.12 — e **ninguém a produz**. `entrada.lapides` chega vazia da tela e da impressão, então a lápide é invisível no aparelho, a edição impressa sai sem ela, e as quatro mortes de 2026 (respiração 10/07, vo2max 14/07, spo2 16/07, anéis 17/08) seguem narradas como calmaria. A 2.6 ensinou a ausência de registro a não virar zero; falta a outra face: o que **parou** de chegar.

**Approach:** Uma função no banco devolve **fatos, não juízo** — por métrica: primeira e última medida, quantas medidas, e os silêncios com o sinal "outra métrica chegou neste intervalo". O núcleo aplica as quatro regras do dono e produz `FatoLapide[]`. `entradaDaRetrospectiva` passa a devolver `{ resumo, agora, lapides }`, e com isso o script não muda uma linha; o celular repete no hook. Daí para a frente tudo já existe.

## Boundaries & Constraints

**Always:** a regra mora no núcleo, pura e testável — o banco não decide quem morreu; o piso de dias vai como **parâmetro** da função, nunca embutido nela; a leitura mora em `data/` (barreira do `.from()`); **nenhum veredito é persistido** — o backfill reescreve até 500 dias e `updated_at` é reescrito a cada sync, então tudo se recalcula a cada leitura; a lápide é do período da **última medida**; a regra olha a **métrica**, nunca a fonte (a VFC parou no relógio e voltou pelo intervals.icu — não morreu); a função é **aditiva** e o app que ainda não a conhece não quebra: falha de leitura vira lápide nenhuma, como hoje.

**As quatro decisões do dono (23/09), medidas sobre o acervo dele:** (1) morre quando o silêncio passa do **maior silêncio próprio de que ela voltou**, com piso de **30 dias**, **e** alguma outra métrica chegou naquele intervalo — o piso subiu de 14 para 30 em 23/09, depois de a medição contra produção mostrar que sono, VFC, SpO2 e respiração têm recorde de 15 a 17 dias e virariam lápide numa pausa de vinte; a testemunha protege o blecaute total (nada chega), não a família de sensores que para; (2) a lápide é do período da última medida; (3) a morte antiga é repassada por **doze meses** ou até a métrica voltar; (4) métrica com **menos de dez medidas** na vida nunca ganha lápide.

**Ask First:** mudar o prompt, `PROMPT_VERSAO`, a conferência ou o ranqueamento; qualquer migração além da função desta story; mudar qualquer uma das quatro decisões.

**Never:** a impressão em massa (2.3), a parede (2.4), silenciar caderno (2.5); persistir veredito; carimbar o veredito **visual** da lápide — esse é do dono, no iPhone, e a 1.12 o deixou pendente.

## I/O & Edge-Case Matrix

| Cenário | Entrada / Estado | Esperado | Erro |
|---|---|---|---|
| Morte | silêncio acima do recorde próprio, com outra métrica chegando | lápide com a data da última medida, no caderno do catálogo | — |
| Buraco de sincronização | todas as métricas em silêncio no mesmo intervalo (10/07/2025) | **nenhuma** lápide | — |
| Ritmo próprio | silêncio menor que o recorde da métrica | nenhuma | — |
| Piso | silêncio acima do recorde, mas menor que 30 dias | nenhuma — é a pausa curta, não a morte | — |
| Nunca foi série | métrica com menos de dez medidas (o peso, com uma) | nunca ganha lápide | — |
| Morte antiga | última medida há mais de doze meses | some da edição | — |
| Voltou | a métrica volta, por qualquer fonte | nenhuma lápide, e a antiga desaparece | — |
| Período anterior à morte | edição de 2023 | a lápide não entra — o pacote já corta a morte posterior ao fim | — |
| Sem a função | banco antigo, ou leitura falhou | edição e tela saem sem lápide, exatamente como hoje | log, nunca exceção que suba |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/pacote.ts` -- `FatoLapide` :234-238 (só `metrica` + `ultimaMedidaISO`); `EntradaPacote.lapides` :868, opcional; `lapidesPorCaderno` :1103-1118 **recusa** métrica fora do catálogo, data inválida e repetida, e **corta** a morte posterior ao fim :1110; `validarLapides` :1147-1163; `lapideDoPeriodo` :1176-1181; `temLapideDoPeriodo` :1190-1194; `semDado` :1083 e `cadernoVazio` :1219-1225 já contam a lápide do período.
- `packages/shared/src/period/cadernos.ts` -- `LAPIDES` :301-307 (as quatro métricas, com caderno, nome em prosa e verbo), `METRICAS_COM_LAPIDE` :309, `isMetricaComLapide` :312. O nome não tem dígito de propósito.
- `packages/shared/src/ia/imprimir.ts` -- `lapidesDosCadernos` :220-232 e `LapideNaEdicao` :190-193: o contrato com a tela, com `doPeriodo` decidindo topo × pé.
- `packages/shared/src/ia/prompt.ts` -- a seção :266-268 e `linhaDeLapide` :259-263; com lista vazia o prompt **não muda um byte**. Não se toca.
- `packages/shared/src/ia/ranqueamento.ts` -- passo 5 :214-217, hoje ramo morto: a lápide do período força o caderno à frente.
- `packages/shared/src/period/retro-dados.ts` -- `entradaDaRetrospectiva` :343-349 é **a linha** que passa a levar as lápides; `DadosDaRetro` :126; `recortarNaJanela` :189 — o campo novo passa **sem corte**, como `habits` e `templates`. O molde do campo opcional é `RetroMarcos` da 2.6 (`period/retro.ts` :407-425, :929-937).
- `packages/shared/src/data/retro-dados.ts` -- as nove leituras em `Promise.all` :30-44; a décima entra aqui.
- `packages/shared/src/data/health-daily.ts` -- dona da tabela; `fetchAllPages` :57, `PAGE` :48; as duas leituras exigem `since` (:81, :101) — nenhuma serve. A RPC nova mora aqui.
- `supabase/migrations/20260907120000_activity_media_counts.sql` :19-44 -- **o molde literal** da função: `language sql`, `stable`, `security invoker`, `set search_path = public`, `where user_id = auth.uid()` redundante com a RLS de propósito, `comment on function`, `grant execute to authenticated`. O envelope do cliente é `data/activity-photos.ts` :161-171.
- `supabase/migrations/20260523120000_health_daily.sql` :21-25 -- a PK e o índice `(user_id, metric, day desc)`, que já serve ao `group by metric` ordenado. **Nenhum índice novo.**
- `mobile/src/hooks/useEntradaDaEdicao.ts` :82 -- o `useMemo` da entrada; `mobile/src/store/retro.store.ts` :50 já guarda `dados`.
- `scripts/revista/imprimir.ts` :536 -- chama `entradaDaRetrospectiva`; **não muda** se a produção morar lá dentro.
- `mobile/src/lib/edicao-ia.ts` :802-834 -- `fraseDaLapide` e `lapidesDaEntrada`; a rota desenha em `mobile/src/app/revista/[tipo]/[inicio].tsx` :527-545, :575-576, :605, :652.
- `packages/shared/src/period/__tests__/contrato-da-edicao.ts` -- `GABARITO` :628-658 fixa `hashes`, `textos` e `carga`; uma lápide na fixture muda os três (e a `p_ordem`, se for do período). O ritual de refixar está em :597-626.
- `packages/shared/src/architecture.test.ts` -- `PORTA_DE_IA` :3705 (a tela não importa peça de `ia/`; um detector dentro de `ia/` nasceria barrado — por isso ele mora em `period/`); `.from()` fora do núcleo :169-183.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/<timestamp>_metricas_silencio.sql` -- função nova, molde de `activity_media_counts` linha a linha: recebe o piso de dias como parâmetro e devolve, por métrica, primeira e última medida, a contagem de medidas e os silêncios acima do piso com `de`, `ate`, `dias` e o sinal **`outra_chegou`** (houve linha de qualquer outra métrica dentro do intervalo). Fatos, nunca juízo.
- [x] `packages/shared/src/data/health-daily.ts` -- a leitura da função, no envelope do precedente (`rpc`, `if (error) throw`, tipo próprio). Sem `.from()` novo.
- [x] `packages/shared/src/period/lapides.ts` -- novo, **puro**: aplica as quatro regras aos fatos e devolve `FatoLapide[]`. Sem SDK, sem rede, sem relógio implícito (o `agora` é parâmetro).
- [x] `packages/shared/src/data/retro-dados.ts` -- a décima leitura entra no `Promise.all`, e `DadosDaRetro` ganha o campo; ele **não** é cortado por `recortarNaJanela`. Falha dela não derruba as outras nove.
- [x] `packages/shared/src/period/retro-dados.ts` -- `entradaDaRetrospectiva` devolve `{ resumo, agora, lapides }`.
- [x] `mobile/src/hooks/useEntradaDaEdicao.ts` e `mobile/src/store/retro.store.ts` -- a entrada do celular leva as mesmas lápides, pela mesma conta.
- [x] `packages/shared/src/period/lapides.test.ts` -- a matriz inteira sobre as datas reais: as quatro mortes de 2026, o buraco de 10/07/2025 que não é morte, a VFC que voltou, e o peso com uma medida.
- [x] `packages/shared/src/data/health-daily.test.ts` -- o envelope da RPC com banco falso, inclusive a falha que vira lápide nenhuma.
- [x] `packages/shared/src/period/__tests__/contrato-da-edicao.ts` -- a fixture ganha **uma** lápide, para o contrato provar a via ponta a ponta; refixar `hashes`, `textos` e, se ela for do período, a `p_ordem`, com o motivo escrito no cabeçalho.
- [x] `docs/decisions/0055-*.md` -- ADR das quatro decisões, com a medição que as sustenta e as alternativas rejeitadas (limiar fixo, sem a segunda condição).
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- `resolucao:` nas três entradas que esta story fecha (o limiar, a latência e o prazo da morte antiga).

**Acceptance Criteria:**
- Given o acervo real, when o detector roda, then declara mortas exatamente respiração, spo2, vo2max e anéis — e nenhuma outra.
- Given o intervalo de 10/07/2025, when o detector o avalia, then não declara morte nenhuma, porque nenhuma outra métrica chegou nele.
- Given a migração ainda não aplicada, when a tela e a impressão rodam, then funcionam como hoje, sem lápide e sem erro na cara do dono.
- Given a mudança, when as barreiras e as suítes dos quatro workspaces rodam, then passam, com o `GABARITO` refixado no mesmo commit.

## Design Notes

**Por que a função, e não o acervo no cliente.** Medido: ler o acervo inteiro custa cinco idas à rede e ~200 KB **hoje**, em toda abertura da Retrospectiva e em toda impressão, e cresce uma ida a cada 43 dias. A função devolve ~22 linhas e ~2 KB, constantes. E como nada pode ser persistido — o backfill reescreve até 500 dias —, esse custo é pago a cada leitura, não uma vez.

**A fronteira entre fato e juízo.** A função responde "quando foi a última linha, quantas houve, quais foram os silêncios e se o aparelho estava vivo em cada um". Quem decide o que é morte é o núcleo, onde a regra tem teste barato e onde mudá-la não pede migração.

**A migração é do dono.** Ela é aditiva (`stable`, sem mudança de schema), então nenhum app instalado quebra e não há janela acoplada a build — o custo da seção 6 do roteiro da 1.9 era do aparelho, não do banco. Ele a aplica pela Management API e registra a versão à mão.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- verde, barreiras incluídas
- `pnpm --filter @vitale/scripts lint && pnpm --filter @vitale/scripts test` -- verde
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- verde
- `pnpm --filter @vitale/web build` -- verde

**Manual checks (do dono):**
- Aplicar a migração e rodar `revista:imprimir --tipo mes --inicio 2026-08-01 --sem-gravar`: os anéis, que pararam em 17/08, aparecem como lápide de agosto.
- O veredito **visual** da lápide, que a 1.12 deixou pendente: build próprio no iPhone, com a edição de agosto aberta.

## Suggested Review Order

**A regra — o juízo, que é do núcleo**

- Ponto de entrada: as quatro regras do dono, aplicadas aos fatos do banco.
  [`lapides.ts:230`](../../packages/shared/src/period/lapides.ts#L230)

- O piso de 30 dias, e por que ele subiu de 14: a pausa curta das métricas de recorde baixo.
  [`lapides.ts:147`](../../packages/shared/src/period/lapides.ts#L147)

- O silêncio corrente contra o recorde próprio — a metade que faz o trabalho.
  [`lapides.ts:188`](../../packages/shared/src/period/lapides.ts#L188)

- A janela de doze meses, com a borda de calendário consertada.
  [`lapides.ts:169`](../../packages/shared/src/period/lapides.ts#L169)

**O banco — os fatos, nunca o juízo**

- A testemunha: houve linha de qualquer outra métrica dentro do silêncio.
  [`20260923120000_metricas_silencio.sql:79`](../../supabase/migrations/20260923120000_metricas_silencio.sql#L79)

- A permissão que de fato restringe: o revoke antes do grant.
  [`20260923120000_metricas_silencio.sql:148`](../../supabase/migrations/20260923120000_metricas_silencio.sql#L148)

- A leitura, com a tradução que descarta fato podre em vez de o crer.
  [`health-daily.ts:178`](../../packages/shared/src/data/health-daily.ts#L178)

**A ligação — uma conta, dois hospedeiros**

- A entrada da edição passa a levar as lápides; o script não mudou uma linha.
  [`retro-dados.ts:380`](../../packages/shared/src/period/retro-dados.ts#L380)

- A décima leitura, cuja falha é lápide nenhuma e nunca derruba as outras nove.
  [`retro-dados.ts:27`](../../packages/shared/src/data/retro-dados.ts#L27)

- O celular chama a mesma função do núcleo — e é isso que um teste agora prende.
  [`useEntradaDaEdicao.ts:3`](../../mobile/src/hooks/useEntradaDaEdicao.ts#L3)

**As provas**

- O gabarito do caminho SEM lápide: o texto é byte a byte o de antes da 2.7.
  [`contrato-da-edicao.ts:747`](../../packages/shared/src/period/__tests__/contrato-da-edicao.ts#L747)

- A matriz do detector, sobre as datas reais do acervo.
  [`lapides.test.ts:34`](../../packages/shared/src/period/lapides.test.ts#L34)

- A decisão, com a medição que corrigiu o raciocínio no meio do caminho.
  [`0055`](../../docs/decisions/0055-a-morte-de-uma-metrica-e-medida-contra-o-ritmo-dela.md)
