# Tasks: Histórico de Treinos (web)

> Derivado de [plan.md](./plan.md). Fases entregáveis e verificáveis isoladas. F0–F4 são só web; **F5** é cross-feature com [sync-atividades](../sync-atividades/spec.md).

> **Auditoria 2026-08-26 — implementação completa, validação de campo pendente.**
> Este checklist tinha 31 itens abertos enquanto a feature já estava em produção.
> Duas divergências que confundem quem procura o código:
>
> 1. A feature nasceu como **`workout-history`**, não `historico-treinos` — pasta,
>    rota e componentes seguem esse nome. Os caminhos das tarefas abaixo estão
>    corrigidos para o real.
> 2. A migration é `20260520130000_activities_locally_edited.sql` (a tarefa previa
>    um timestamp posterior).
>
> Todo item marcado `[x]` foi conferido contra o arquivo. Os que continuam `[ ]`
> exigem browser aberto com dados reais ou consulta SQL numa conta de teste —
> nenhum deles foi feito. `[~]` = coberto por teste unitário, falta o olho humano.
>
> **Escopo extra entregue e não previsto aqui:** mapa por país
> (`activity-country-page`, `country-*`), carga semanal (`weekly-load-card`),
> página de detalhe com mapa de rota e destaques de corrida.

## F0 — Schema + metadados de tipo

- [x] **T001** Migration [`20260520130000_activities_locally_edited.sql`](../../../supabase/migrations/20260520130000_activities_locally_edited.sql): colunas `locally_edited`, `edited_at`, `hidden` + índices `activities_user_edited_idx` e `activities_user_visible_idx` ([data-model §1](./data-model.md)).
- [x] **T002** Função `sync_upsert_activities(rows jsonb)` na mesma migration, com a guarda `where not activities.locally_edited` ([data-model §2](./data-model.md)).
- [x] **T003** [`web/src/app/core/models/activity-types.ts`](../../../web/src/app/core/models/activity-types.ts) espelhando `getActivityMeta`/`GPS_ACTIVITY_IDS` com `slug`, ícone web e cor de token ([plan §4.2](./plan.md)).
- [x] **T004** (opcional) `locallyEdited?`/`editedAt?`/`hidden?` na interface `Activity` — [models/index.ts:353-356](../../../packages/shared/src/models/index.ts#L353-L356).

## F1 — Leitura + estado vazio (US1)

- [x] **T010** [`features/workout-history/data/activities.store.ts`](../../../web/src/app/features/workout-history/data/activities.store.ts): leitura via `fetchActivities` do shared, `isEmpty` computed ([:79](../../../web/src/app/features/workout-history/data/activities.store.ts#L79)) e derivações excluindo `hidden` ([:67](../../../web/src/app/features/workout-history/data/activities.store.ts#L67)).
- [x] **T011** `WorkoutHistoryPageComponent` (standalone, OnPush) com branch empty-state vs dashboard.
- [x] **T012** Estado vazio orientando importar pelo mobile — [workout-history-page.component.html:6-12](../../../web/src/app/features/workout-history/pages/workout-history-page.component.html#L6-L12).
- [x] **T013** Rota `/workout-history` (lazy `loadComponent`) — [main.ts:45](../../../web/src/main.ts#L45).
- [x] **T014** Item "Histórico de treinos" — [sidebar.component.ts:23](../../../web/src/app/shared/layouts/sidebar.component.ts#L23).
- [ ] **T015** Verificar SC-001: sem dados → só empty-state; com dados → dashboard. *Exige conta sem atividades.*

## F2 — Visão geral por período (US2)

- [x] **T020** `period-selector.component` com `signal` de período.
- [x] **T021** Funções puras de bucketing/agregação em [`data/overview.ts`](../../../web/src/app/features/workout-history/data/overview.ts) ([plan §4.3](./plan.md)).
- [x] **T022** `stacked-bar-chart.component` (SVG): buckets/segmentos + cores por tipo, eixo, grid, legenda.
- [x] **T023** `overview-card.component`: stat tiles + chart + toggle de métrica ([:44](../../../web/src/app/features/workout-history/components/overview-card.component.ts#L44)).
- [x] **T024** Testes unitários de bucketing/agregação — `overview.spec.ts`, `type-summary.spec.ts`, `weekly-load.spec.ts`.
- [~] **T025** Verificar SC-002 e SC-004. *Coberto por `overview.spec.ts` no nível de função; falta conferir no browser que a UI de fato recalcula.*

## F3 — Cards por tipo (US3)

- [x] **T030** `buildTypeSummaries` em [`data/type-summary.ts`](../../../web/src/app/features/workout-history/data/type-summary.ts), consumido pelo store ([data-model §5](./data-model.md)).
- [x] **T031** `activity-type-card.component`: ícone/cor do tipo, totais, clicável → `/workout-history/:slug`.
- [x] **T032** Grid de cards na page principal (só tipos presentes nos dados).
- [ ] **T033** Verificar SC-003 (somas conferem contra SQL). *Exige consulta numa conta com dados reais.*

## F4 — Página completa de um tipo (US4)

- [x] **T040** Rota `/workout-history/:slug` + `ActivityTypePageComponent` — [main.ts:51](../../../web/src/main.ts#L51).
- [x] **T041** `listByType` com filtros, ordenação e paginação em memória — [`data/activity-list.ts`](../../../web/src/app/features/workout-history/data/activity-list.ts) ([plan §5.1](./plan.md)).
- [x] **T042** Alternância lista/cards — [activity-type-page.component.ts:45](../../../web/src/app/features/workout-history/pages/activity-type-page.component.ts#L45).
- [x] **T043** `activity-filters.component`: intervalo de datas, faixa de distância/duração, fonte, com/sem rota.
- [x] **T044** Controles de paginação — [activity-type-page.component.html:113-117](../../../web/src/app/features/workout-history/pages/activity-type-page.component.html#L113-L117).
- [~] **T045** Verificar SC-006 (subconjuntos corretos e estáveis). *Coberto por `activity-list.spec.ts`; falta o browser.*

## F5 — Edição + travar do sync (US5, cross-feature)

> ✅ Campos editáveis definidos: **nome** (todas) e **tempo** só em atividades **sem GPS** (sem rota e sem distância).

- [x] **T050** Rota `/workout-history/:slug/:id` + `ActivityDetailPageComponent` (form: nome sempre; tempo só sem GPS) — [main.ts:65](../../../web/src/main.ts#L65).
- [x] **T051** `updateActivity(id, patch)` no store: marca `locally_edited`/`edited_at` e atualiza o signal local — [activities.store.ts:111](../../../web/src/app/features/workout-history/data/activities.store.ts#L111).
- [x] **T052** Indicador "editado manualmente" na lista/cards/detalhe (FR-012) — [activity-item.component.html:9](../../../web/src/app/features/workout-history/components/activity-item.component.html#L9).
- [x] **T053** **Sync mobile:** `pushActivities` usa `rpc('sync_upsert_activities')` em [activity-sync.ts](../../../mobile/src/services/activity-sync.ts) — não sobrescreve linhas `locally_edited` ([plan §4.4](./plan.md)).
- [ ] **T054** ⛔ **Bloqueado** **Sync mobile:** marcar `hidden=true` na deleção de uma linha `locally_edited` (FR-013). O sync ainda **não propaga deleções** (limitação do react-native-health no fluxo anchored — ver topo de `activity-sync.ts`). Quando a propagação de deleções for implementada, a remoção de uma linha `locally_edited` DEVE marcar `hidden=true` em vez de apagar.

  > **Auditoria 2026-08-26 — o bloqueio é mais largo do que esta linha sugere.** O
  > `deleted` de `SyncResult` é zero literal ([activity-sync.ts:394](../../../mobile/src/services/activity-sync.ts#L394),
  > [:479](../../../mobile/src/services/activity-sync.ts#L479)): **nenhuma** deleção
  > propaga, não só as de linhas editadas — treino apagado no Apple Health fica
  > para sempre no Supabase inflando totais, distância, calorias e esforço, sem
  > erro nem contador.
  >
  > A infraestrutura do `hidden` já está pronta e ociosa: coluna, índice parcial
  > `activities_user_visible_idx`, filtro `!hidden` em toda leitura (web e mobile) e
  > o switch manual "Incluir nas métricas" no detalhe da atividade. Falta só o
  > produtor automático.
  >
  > **`hidden` é seguro contra o sync** — o `on conflict do update set` de
  > `sync_upsert_activities` não lista `hidden`, `locally_edited` nem `edited_at`,
  > então re-sincronizar o tipo preserva os três. É por isso que as limpezas
  > manuais de duplicatas usam flip de `hidden` e não `delete`.
  >
  > Três armadilhas para quem for implementar:
  > (a) reconciliar por diferença sem filtrar por fonte apagaria dados de Strava e
  > intervals.icu; (b) a guarda `locally_edited` vive só no caminho de UPDATE do
  > RPC — um DELETE passa por fora dela; (c) [`syncType`](../../../mobile/src/services/activity-sync.ts#L363)
  > refaz o backfill inteiro do tipo com upsert por id determinístico, então uma
  > linha de fato **apagada** do Supabase ressuscita no próximo sync daquele tipo.
  > Some as três e a conclusão é a mesma: a saída é marcar `hidden`, nunca deletar.
- [ ] **T055** Verificar SC-005: editar na web → rodar sync do tipo → valor editado permanece; e SC FR-013: linha editada apagada no HealthKit some das métricas mas continua no banco. *A segunda metade depende do T054.*

## Validação final

- [x] **T060** lint e testes. *Rodado em 2026-08-26: `@vitale/shared` tsc + 17 testes, `@vitale/web build`, `@vitale/web test` (140 testes / 11 arquivos), mobile `tsc --noEmit` + jest (480 testes / 42 suítes) — todos exit 0.*
- [ ] **T061** `pnpm web:dev` — validar no browser: empty-state, período/métrica, cards por tipo, página de tipo (lista/cards, filtros, paginação), edição + indicador.
- [ ] **T062** Conferir totais da web × `count`/`sum` em SQL para uma conta de teste.
