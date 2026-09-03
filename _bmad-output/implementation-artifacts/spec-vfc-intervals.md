---
title: 'VFC de volta pelo bem-estar diário do intervals.icu'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'bc6d00a9ea7927c92c58b804dd8e27848ee49a5b'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A VFC parou de chegar em 17/07/2026: o Garmin não escreve HRV no Apple Health, e a prontidão roda desde então com 75% da informação. O Garmin manda a VFC noturna para o intervals.icu, e o conector do intervals.icu já roda a cada 15 minutos — só não pede esse dado.

**Approach:** O run do intervals.icu passa a buscar o registro diário de bem-estar e a gravar a VFC em `health_daily` nos dias em que o Apple Health não mediu. Sem integração nova, migration ou UI nova: quem lê `health_daily` passa a ver a VFC sozinho; o cartão de prontidão do mobile, que lê o HealthKit em memória, ganha um fallback para a tabela.

## Boundaries & Constraints

**Always:**
- Best-effort: o passo de bem-estar nunca derruba o run de atividades nem o cursor; erro vira campo no summary.
- Precedência do Apple Health: só grava `'vfc'` no dia sem linha ou cuja linha tem `extra.source === 'intervals'`. O RPC do mobile segue sobrescrevendo incondicionalmente.
- Mesma métrica `'vfc'`, com `extra: { source: 'intervals', kind: 'sdnn' | 'rmssd' }` e `count: 1`. `hrvSDNN` quando existir, senão `hrv` como `rmssd`.
- Janela: 14 dias por run; 120 dias na primeira vez do usuário (nenhuma linha `'vfc'` de `intervals`).
- Normalização e janela são puras em `packages/shared`, testadas lá; a function Deno só busca e grava. Datas locais sem fuso, como em `fetchIntervalsActivities`.
- Fallback do mobile só quando o HealthKit não tem `'vfc'` na janela; regra de último valor + baseline móvel de 7, a mesma de `latestAndBaseline`.
- O deploy da function é manual e fica fora deste fluxo; spec e resumo final dizem isso.

**Ask First:**
- Se a resposta real do `/wellness` não trouxer `hrv` nem `hrvSDNN` com esses nomes.
- Se parecer necessário mudar a fórmula em `readiness.ts` ou o RPC `sync_upsert_health_daily`.

**Never:**
- Trazer sono ou FC de repouso do intervals.icu: o Apple Watch cobre, e misturar fontes é o que o dedupe evita.
- Tocar no Strava, criar migration ou métrica nova, alterar os três endpoints já usados.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Registro Garmin | `{ id: '2026-09-03', hrv: 52 }` | `{ day, value: 52, kind: 'rmssd' }` | N/A |
| Com SDNN | `{ id, hrv: 52, hrvSDNN: 61 }` | `value: 61, kind: 'sdnn'` | N/A |
| Inválido | `hrv: null`, `hrv: 0`, `id: 'x'`, item não-objeto | descartado, sem lançar; dia repetido → o último vence, saída ordenada | N/A |
| Dia com linha Apple | linha `'vfc'` sem `extra.source` ou de outra fonte | não grava; `skipped++` | N/A |
| Dia com linha intervals | `extra.source === 'intervals'` | atualiza; `upserted++` | N/A |
| Janela | sem linha de `intervals` / com | 120 dias / 14 dias | N/A |
| API falha | 5xx, rede, JSON inválido | `summary.wellness.error`; atividades, cursor e status seguem normais | capturado no passo |
| Mobile sem VFC no HealthKit | summaries sem `'vfc'`; tabela com linhas | componente VFC presente; `coverage` sobe | N/A |
| Fallback do mobile | HealthKit com `'vfc'` / nada em lugar nenhum | HealthKit vence, fallback ignorado / componente ausente, como hoje | N/A |

</frozen-after-approval>

## Code Map

- `supabase/functions/_shared/providers/intervals.ts:1-29,78-97` — cabeçalho, `icuGet`, e o fetch a copiar (401/403 → `AuthError`, datas em `slice(0,19)`); `:11` importa de `packages/shared` por caminho relativo, precedente para a normalização.
- `supabase/functions/_shared/ingest.ts:61-69,646-785` — `IngestSummary` (ganha `wellness?`); `runIngest`: ramo intervals L689-701 (`secret.api_key`, `account.athlete_id`), passo novo entre L758 e o cursor L760, catch L772.
- `supabase/functions/_shared/admin.ts:9` — `Admin = SupabaseClient` service role; upsert com `onConflict: 'user_id,day,metric'`.
- `supabase/migrations/20260523120000_health_daily.sql:10-22` — colunas, PK, `extra jsonb`. **Somente leitura.**
- `packages/shared/src/models/index.ts:669-678` — `HealthDaily`; `health/metric-catalog.ts:52` — caption; `health/readiness.ts:16-17,40,98` — entradas `hrv`, comentário "VFC parou", `rollingBaseline`; `index.ts:70-90` — bloco `health/`.
- `mobile/src/lib/health-readiness.ts:23-46` — `latestAndBaseline`/`buildReadinessInput`, ponto do fallback; `components/cards/ReadinessCard.tsx:26-37` — lê `useHealthStore.summaries`.
- `mobile/src/store/health-daily.store.ts:59-81,86` — `load(force?)` com gate `loaded`; `seriesFor` em ordem cronológica; `app/(tabs)/semana.tsx:58-61` — padrão de carregar na tela.
- `mobile/src/lib/__tests__/readiness.test.ts`, `docs/decisions/0025-…`, `docs/specs/sync-atividades/data-model.md` — convenção de teste, formato de ADR, onde entra a seção.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/health/wellness.ts` + `wellness.test.ts` + `index.ts` -- `normalizeIntervalsWellness(raw: unknown)` e `wellnessWindow(hasIntervalsRows, now)` puros, cobrindo as 3 primeiras linhas da matriz e as janelas -- é o que dá para testar sem Deno
- [x] `supabase/functions/_shared/providers/intervals.ts` -- `fetchIntervalsWellness(apiKey, athleteId, oldestDay, newestDay)` em `/athlete/{id}/wellness?oldest&newest`, devolvendo a normalização; 4º endpoint no cabeçalho -- mesmo cliente, mesmo erro
- [x] `supabase/functions/_shared/ingest.ts` -- `ingestWellness`: lê as linhas `'vfc'` existentes, aplica a precedência, upsert, `summary.wellness`; chamada best-effort em `runIngest` -- quem já roda a cada 15 min preenche o buraco
- [x] `mobile/src/lib/health-readiness.ts` + `ReadinessCard.tsx` + `readiness.test.ts` -- `buildReadinessInput(summaries, fallback?)` com `latestAndBaselineFromRows`; o card carrega `useHealthDailyStore` e passa `seriesFor('vfc')` -- sem isso a Hoje continua a 75%
- [x] `docs/decisions/0026-vfc-do-intervals-na-mesma-metrica.md` -- mesma métrica, `extra.source`/`kind`, precedência do Apple, o degrau RMSSD × SDNN e a mitigação -- duas escalas numa coluna é o que ADR existe para registrar
- [x] `docs/specs/sync-atividades/data-model.md` + `metric-catalog.ts:52` + `readiness.ts:40` -- seção "Bem-estar (VFC)", caption com as duas fontes, comentário atualizado -- a documentação precisa parar de dizer que parou
- [x] `mobile/src/app/(tabs)/index.tsx` -- remontar o `ReadinessCard` abaixo do `FormCurveCard` (decisão do humano na implementação: o cartão estava desmontado desde 06/08 e o critério da Hoje era inobservável) -- sem isso o fallback não tem onde aparecer
- [x] `packages/shared/src/health/wellness.ts` + `wellness.test.ts` -- extrair a precedência (`planWellnessRows(hrv, sourceByDay)`) para função pura chamada pelo `ingestWellness` -- as linhas "dia com linha Apple/intervals" da matriz ganham teste sem Deno

**Acceptance Criteria:**
- Dado um vínculo intervals.icu conectado, quando o run termina, então `summary.wellness` reporta `upserted`/`skipped` e a tabela tem `'vfc'` nos dias em que só o Garmin mediu, com `extra.source = 'intervals'`.
- Dado um dia com VFC do Apple Health, quando o run grava, então essa linha permanece intacta.
- Dado o `/wellness` fora do ar, quando o run termina, então atividades e cursor avançam e `last_error` fica nulo.
- Dado o HealthKit sem VFC e a tabela com linhas, quando a Hoje abre, então o cartão mostra o componente VFC e `coverage` sobe.
- Dados os comandos de Verification, quando rodados, então passam; a function Deno fica sem typecheck local e o resumo diz isso.

## Spec Change Log

- **2026-09-04 · implementação (lacuna de fato no Code Map, sem loopback).** O `ReadinessCard` não está montado em tela nenhuma desde 06/08 (`1d15659`), então o critério "quando a Hoje abre, o cartão mostra o componente VFC" era inobservável. O humano decidiu **remontar** o cartão na Hoje, abaixo do `FormCurveCard`; a fronteira "nenhuma UI nova" cobre UI inventada, não a volta de um cartão existente. KEEP: fallback só quando o HealthKit não tem VFC na janela; digest de notificações também recebe o fallback.

## Design Notes

O Apple Health mede SDNN; o Garmin manda RMSSD. Ficam na mesma coluna porque todo consumidor e a baseline de 7 dias chaveiam em `'vfc'`, e a prontidão compara com a própria baseline. Se as fontes um dia alternarem, `extra.kind` permite separar.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint && pnpm --filter @vitale/shared test` -- expected: passa, incluindo `wellness.test.ts` e as barreiras
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` -- expected: passa, incluindo os casos novos de `readiness.test.ts`
- `git diff --stat supabase/migrations/` -- expected: vazio

**Manual checks (if no CLI):**
- `deno` não está no PATH: ler o diff de `intervals.ts` e `ingest.ts` contra o ramo de atividades. Deploy (`supabase functions deploy connections-ingest`) é do usuário.

## Suggested Review Order

**Ponto de entrada**

- A decisão inteira do que vai para o banco, num módulo puro porque a function não tem teste.
  [`wellness.ts:145`](../../packages/shared/src/health/wellness.ts#L145)

**Precedência e integridade do dado**

- Existência da linha, não o valor de `source`: a inversão que apagaria a medição do relógio.
  [`wellness.ts:145`](../../packages/shared/src/health/wellness.ts#L145)

- Data que casa com o formato mas não existe no calendário aborta o run inteiro no Postgres.
  [`wellness.ts:69`](../../packages/shared/src/health/wellness.ts#L69)

- Faixa plausível: um valor absurdo contamina a baseline de uma semana.
  [`wellness.ts:63`](../../packages/shared/src/health/wellness.ts#L63)

- A query mora no núcleo porque trocar as datas devolveria vazio sem erro.
  [`wellness.ts:209`](../../packages/shared/src/health/wellness.ts#L209)

**O passo no ingest**

- Bem-estar antes das atividades: best-effort tem de valer nos dois sentidos.
  [`ingest.ts:798`](../../supabase/functions/_shared/ingest.ts#L798)

- A function só busca, adapta e grava; a regra veio do núcleo.
  [`ingest.ts:695`](../../supabase/functions/_shared/ingest.ts#L695)

- `received` separa "campo mudou de nome" de "o atleta não tem VFC".
  [`ingest.ts:75`](../../supabase/functions/_shared/ingest.ts#L75)

- O log é a única superfície onde uma falha permanente aparece.
  [`ingest.ts:723`](../../supabase/functions/_shared/ingest.ts#L723)

- Recebe a janela inteira, não duas strings que dá para trocar.
  [`intervals.ts:118`](../../supabase/functions/_shared/providers/intervals.ts#L118)

**Prontidão no mobile**

- Baseline só do mesmo tipo de medida: SDNN contra RMSSD lê troca de escala como fisiologia.
  [`health-readiness.ts:77`](../../mobile/src/lib/health-readiness.ts#L77)

- Uma leitura só não vira baseline — sem isso o componente marca 50 com peso cheio.
  [`health-readiness.ts:69`](../../mobile/src/lib/health-readiness.ts#L69)

- Janela de 7 dias com teto em hoje: linha do futuro não vira a VFC de agora.
  [`health-readiness.ts:104`](../../mobile/src/lib/health-readiness.ts#L104)

- O cartão volta à Hoje, abaixo da curva de forma.
  [`index.tsx:223`](../../mobile/src/app/(tabs)/index.tsx#L223)

- Assina as linhas e deriva na memo: `rows` cobre um ano de todas as métricas.
  [`ReadinessCard.tsx:44`](../../mobile/src/components/cards/ReadinessCard.tsx#L44)

**Guarda de arquitetura**

- Todo módulo do núcleo que o Deno importa segue sem imports; a lista sai do próprio código das functions.
  [`architecture.test.ts:159`](../../packages/shared/src/architecture.test.ts#L159)

**Periféricos**

- Precedência coberta com as quatro formas de linha do Apple.
  [`wellness.test.ts:148`](../../packages/shared/src/health/wellness.test.ts#L148)

- A ordem da query, fixada por teste.
  [`wellness.test.ts:123`](../../packages/shared/src/health/wellness.test.ts#L123)

- A mistura de escalas na baseline, com o caso da virada.
  [`readiness.test.ts:119`](../../mobile/src/lib/__tests__/readiness.test.ts#L119)

- Por que a mesma métrica, e o que a revisão mudou na mitigação.
  [`0026-vfc-do-intervals-na-mesma-metrica.md:48`](../../docs/decisions/0026-vfc-do-intervals-na-mesma-metrica.md#L48)

- O contrato da tabela, os descartes e o resumo do run.
  [`data-model.md:195`](../../docs/specs/sync-atividades/data-model.md#L195)

- Oito diferidos, do degrau nos outros consumidores à falta de teste no Deno.
  [`deferred-work.md:115`](deferred-work.md#L115)
