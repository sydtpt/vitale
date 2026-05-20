# Tasks: Histórico de Treinos (web)

> Derivado de [plan.md](./plan.md). Fases entregáveis e verificáveis isoladas. F0–F4 são só web; **F5** é cross-feature com [sync-atividades](../sync-atividades/spec.md).

## F0 — Schema + metadados de tipo

- [ ] **T001** Criar migration `supabase/migrations/<ts>_activities_locally_edited.sql`: colunas `locally_edited`, `edited_at`, `hidden` + índices `activities_user_edited_idx` e `activities_user_visible_idx` ([data-model §1](./data-model.md)).
- [ ] **T002** (se opção RPC) Adicionar função `sync_upsert_activities(rows jsonb)` na migration ([data-model §2](./data-model.md)).
- [ ] **T003** Criar `web/src/app/core/models/activity-types.ts` espelhando `getActivityMeta`/`GPS_ACTIVITY_IDS` com `slug`, ícone web e cor de token ([plan §4.2](./plan.md)).
- [ ] **T004** (opcional) Acrescentar `locallyEdited?`/`editedAt?` à interface `Activity` em `packages/shared` (só campos, sem lógica).

## F1 — Leitura + estado vazio (US1)

- [ ] **T010** Criar `features/historico-treinos/data/activities.store.ts`: `loadActivities()` (select leve por `user_id` incluindo `hidden`, `order start_at desc`), `signal<ActivityRow[]>`, `isEmpty` computed. Derivações analíticas excluem `hidden === true` ([plan §4.1](./plan.md)).
- [ ] **T011** Criar `HistoricoTreinosPageComponent` (standalone, OnPush) com branch empty-state vs dashboard.
- [ ] **T012** Componente de **estado vazio** orientando importar pelo mobile (tela limpa, tokens, sem outras seções).
- [ ] **T013** Registrar rota `/historico-treinos` (lazy `loadComponent`) em [main.ts](../../../web/src/main.ts).
- [ ] **T014** Adicionar item "Histórico" em [sidebar.component.ts](../../../web/src/app/shared/layouts/sidebar.component.ts).
- [ ] **T015** Verificar SC-001: sem dados → só empty-state; com dados → dashboard.

## F2 — Visão geral por período (US2)

- [ ] **T020** `period-selector` (Semana | Ano | Sempre) com `signal` de período.
- [ ] **T021** Funções puras de **bucketing** por período (dias/meses/anos) e **agregação** por `(bucket, tipo)` × métrica ([plan §4.3](./plan.md)).
- [ ] **T022** `stacked-bar-chart` (SVG, padrão `runs-chart`): recebe buckets/segmentos + cores por tipo; eixo, grid, legenda.
- [ ] **T023** `overview-card`: stat tiles do período (nº, distância, duração, calorias) + chart + **toggle de métrica**.
- [ ] **T024** Testes unitários das funções de bucketing/agregação.
- [ ] **T025** Verificar SC-002 e SC-004 (troca de período recalcula tudo; troca de métrica mantém composição por tipo).

## F3 — Cards por tipo (US3)

- [ ] **T030** Computed `typeSummaries` (agregados de **sempre** por tipo) no store ([data-model §5](./data-model.md)).
- [ ] **T031** `tipo-card`: ícone/cor do tipo, nº total, distância total; tipos sem distância exibem **tempo + calorias** (só quando houver). Clicável → `/historico-treinos/:slug`.
- [ ] **T032** Grid de cards na page principal (só tipos presentes nos dados).
- [ ] **T033** Verificar SC-003 (somas conferem contra SQL).

## F4 — Página completa de um tipo (US4)

- [ ] **T040** Rota `/historico-treinos/:slug` + `TipoAtividadePageComponent` (resolve label pelo slug; 404/redirect se inválido).
- [ ] **T041** `listByType(slug, filters, page)` computed: filtro por label + filtros, ordenação, **paginação em memória** ([plan §5.1](./plan.md)).
- [ ] **T042** Alternância **lista/cards** (`activity-row` / `activity-card`).
- [ ] **T043** `activity-filters`: intervalo de datas, faixa de distância/duração, fonte, com/sem rota.
- [ ] **T044** Controles de paginação.
- [ ] **T045** Verificar SC-006 (subconjuntos corretos e estáveis).

## F5 — Edição + travar do sync (US5, cross-feature)

> ✅ Campos editáveis definidos: **nome** (todas) e **tempo** só em atividades **sem GPS** (sem rota e sem distância).

- [x] **T050** Rota `/historico-treinos/:slug/:id` + `AtividadeDetalhePageComponent` (form: nome sempre; tempo só sem GPS).
- [x] **T051** `updateActivity(id, patch)` no store: `update ... set ..., locally_edited=true, edited_at=now()`; atualiza signal local.
- [x] **T052** Indicador "editado manualmente" na lista/cards/detalhe (FR-012).
- [x] **T053** **Sync mobile:** `pushActivities` agora usa `rpc('sync_upsert_activities')` em [activity-sync.ts](../../../mobile/src/services/activity-sync.ts) — não sobrescreve linhas `locally_edited` ([plan §4.4](./plan.md)).
- [ ] **T054** ⛔ **Bloqueado** **Sync mobile:** marcar `hidden=true` na deleção de uma linha `locally_edited` (FR-013). O sync ainda **não propaga deleções** (limitação do react-native-health no fluxo anchored — ver topo de `activity-sync.ts`). Quando a propagação de deleções for implementada, a remoção de uma linha `locally_edited` DEVE marcar `hidden=true` em vez de apagar.
- [ ] **T055** Verificar SC-005: editar na web → rodar sync do tipo → valor editado permanece; e SC FR-013: linha editada apagada no HealthKit some das métricas mas continua no banco.

## Validação final

- [ ] **T060** `npm run lint` e `npm run test`.
- [ ] **T061** `npm run web:dev` — validar no browser: empty-state, período/métrica, cards por tipo, página de tipo (lista/cards, filtros, paginação), edição + indicador.
- [ ] **T062** Conferir totais da web × `count`/`sum` em SQL para uma conta de teste.
