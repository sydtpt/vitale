# Tasks: Sincronização de Atividades

> Tarefas para [plan.md](./plan.md). `[P]` = paralelizável (sem dependência com tarefas da mesma fase). Ordem entre fases é sequencial. IDs estáveis para referência.
>
> Legenda: `[x]` feito · `[~]` parcial · `[ ]` pendente. Tarefas marcadas _(usuário, ao testar)_ exigem device/projeto Supabase e ficam para a validação final.
>
> **Status:** F0–F3 e F5 implementados (escrita por tipo + delta + fila offline + rotas). F4 só no JS — falta o passo nativo T053. Deleções (FR-008) pendentes por limitação da lib.

## Fase 0 — Pré-requisitos (resolver antes de codar)

- [~] **T000** `[NEEDS CLARIFICATION]` resolvidos com defaults aprovados (label como chave; desinscrever não-destrutivo; ID derivado determinístico). Retenção de rota/escopo web seguem em aberto.
- [x] **T001** Env vars padronizadas: `app.config.js` agora lê `EXPO_PUBLIC_SUPABASE_*` (igual a `lib/supabase.ts`).
- [~] **T002** Diretório `supabase/` criado com a migration. **Falta** (usuário): criar/linkar o projeto Supabase e aplicar a migration.

## Fase 1 — F0: Fundação (schema + tipos)

- [x] **T010** Migration `supabase/migrations/20260520120000_activities.sql` com `activities` + índices + trigger `updated_at`. `id` é `text` (acomoda chave derivada).
- [x] **T011** `activity_routes`, `synced_activity_types` e `sync_state` na mesma migration.
- [x] **T012** RLS + policies das 4 tabelas na migration.
- [ ] **T013** Aplicar migration no Supabase e validar isolamento por usuário (SC-007). _(usuário, ao testar)_
- [x] **T014 [P]** Interfaces `Activity`, `ActivityRoute`, `ActivityRoutePoint` em `packages/shared/src/models/index.ts`.

## Fase 2 — F1: Sync por tipo / backfill (US1 · MVP)

- [x] **T020 [P]** `lib/activity-map.ts`: `toActivityRow`/`toRouteRow`. ID instável resolvido na origem com `deriveWorkoutId` (`lib/workout-types.ts`). Helpers puros separados em `workout-types.ts`; I/O do HealthKit em `healthkit-workouts.ts`.
- [x] **T021 [P]** Teste unit de `activity-map` (6 casos, passando).
- [x] **T022 [P]** `lib/synced-types.ts`: `loadSyncedTypes`/`subscribeType`/`unsubscribeType` via `synced_activity_types`. (`isSubscribed` mora na store como `syncedTypes`.)
- [x] **T023** `services/activity-sync.ts`: `syncType(label)` — inscreve, varre HealthKit (`fetchAllWorkouts`), filtra por label, upsert em lote.
- [x] **T024** Botão por card ligado a `store.syncType(label)` em `fitness.tsx`.
- [x] **T025** Abrir a aba não dispara sync — `loadWorkouts` segue só para exibição.
- [ ] **T026** Verificar SC-001/002/003 em device. _(usuário, ao testar)_

## Fase 3 — F2: Offline + estado por tipo (US1, US4)

- [x] **T030** `lib/sync-queue.ts` (+ `lib/local-store.ts` sobre AsyncStorage): enfileirar/ler/drenar com dedup por (kind, id). _(Instalado `@react-native-async-storage/async-storage@2.2.0`.)_
- [x] **T031 [P]** Teste unit da fila (5 casos, passando) com `KVStore` em memória.
- [x] **T032** Fila integrada ao `activity-sync` (`syncType`/`syncDelta` enfileiram falhas; `syncDelta` drena no início).
- [x] **T033** `fitness.store.ts`: `syncedTypes`, `typeStatus`, `lastSyncedAt`, `syncError` + ações `syncType`/`unsubscribeType`/`runDelta`.
- [x] **T034 [P]** UI de status por card em `fitness.tsx` (não inscrito / sincronizando / sincronizado / pendente / erro).
- [ ] **T035** Verificar SC-005 (offline) em device. _(usuário, ao testar)_

## Fase 4 — F3: Delta incremental + foreground (US2)

- [x] **T040** Âncora persistida por usuário (`lib/sync-anchor.ts`); `syncDelta()` usa `fetchWorkoutsDelta(anchor)` e só avança a âncora se tudo subiu.
- [x] **T041** `syncDelta` filtra o delta por tipos inscritos antes do upsert. ⚠️ **Deleções não implementadas**: o `react-native-health` não expõe `deleted[]` no fluxo anchored (FR-008 fica pendente — ver limitação no plan.md).
- [x] **T042** Foreground via `AppState 'active'` em `services/healthkit-observer.ts` (throttle 1×/min), ligado no `_layout.tsx` com sessão. Abrir a lista não dispara.
- [ ] **T043** Verificar delta (inscrito sobe / não inscrito não) em device. _(usuário, ao testar)_

## Fase 5 — F4: Background delivery (US2)

- [x] **T050** `services/healthkit-observer.ts`: listener de `healthKit:Workout:new` (`NativeAppEventEmitter`) → `runDelta()`.
- [x] **T051** Dispatch com throttle + degradação segura (no-op fora do iOS).
- [ ] **T053 (nativo)** Habilitar os background observers no `AppDelegate.swift` para os eventos `healthKit:Workout:new` dispararem. O `app.plugin.js` da lib **não** faz isso; é preciso chamar `initializeBackgroundObservers(bridge)` (ObjC → exige bridging header no projeto Swift). Sem este passo, vale só o caminho de foreground (T042). _(nativo, untestável agora)_
- [ ] **T052** Verificar SC-004 (treino aparece ≤ 5 min sem foreground) em device. _(usuário, ao testar)_

## Fase 6 — F5: Rotas GPS (US3)

- [x] **T060** Rotas GPS enviadas em `syncType` e `syncDelta` via `pushRoutes` → upsert em `activity_routes`; `has_route` derivado em `toActivityRow`.
- [x] **T061** Rota não é buscada/enviada para treinos indoor; `point_count` preenchido.
- [ ] **T062** Verificar SC-006 (rota disponível para leitura) em device. _(usuário, ao testar)_

## Fase 7 — F6: Leitura web (derivado, fora do MVP de escrita)

- [ ] **T070** Cliente Supabase no web (Angular) — ver [auth.md](../auth.md).
- [ ] **T071** Página Treinos lê `activities`/`activity_routes` do Supabase em vez de mock.
- [ ] **T072** Render do mapa de percurso no web a partir de `activity_routes.points`.

## Dependências entre fases

```
F0(Pré) → F0(Fundação) → F1 → F2 → F3 → F4
                                  └──→ F5 (rotas, independe de F4)
F1..F5 (escrita) ──→ F6 (leitura web)
```
