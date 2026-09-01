# Tasks: Habitos — contadores diários

> Derivado de [plan.md](./plan.md). Fases entregáveis e verificáveis isoladas. F1 é o MVP de uso diário; F3/F4 são web.

> **Auditoria 2026-08-26.** Atenção ao procurar o código: no web a pasta é
> **`features/habits/`** (inglês), não `features/habitos/` como os links deste
> arquivo dizem — só no mobile o diretório é `habitos`. O T040 estava aberto com
> o componente já entregue. O que resta são verificações em device/dados reais,
> nenhuma delas feita.

## F0 — Schema + tipos ✅

- [x] **T001** Migration [`20260520140000_habitos.sql`](../../../supabase/migrations/20260520140000_habitos.sql): tabelas `habits` e `habit_logs` (unique `(habit_id, log_date)`) + índices ([data-model §1](./data-model.md)).
- [x] **T002** Triggers `touch_updated_at` em `habits`/`habit_logs`; `enable row level security` + policies `own habits` / `own habit_logs`.
- [x] **T003** Função `habit_log_add(p_habit, p_date, p_delta)` com piso 0 e `security invoker` ([data-model §2](./data-model.md)).
- [x] **T004** `CounterHabit`, `HabitLog`, `HabitDirection` em [`packages/shared`](../../../packages/shared/src/models/index.ts) (só campos, sem lógica).
- [x] **T005** Funções puras em [`mobile/src/lib/habit-logic.ts`](../../../mobile/src/lib/habit-logic.ts): `isMet`, `isOver`, `progress`, `streak`, `average`, `heatmap`, `localDateStr` + testes ([habit-logic.test.ts](../../../mobile/src/lib/__tests__/habit-logic.test.ts)). **Web deve espelhar na F3.**

## F1 — Captura mobile (US1, US3) 🎯 MVP ✅

- [x] **T010** [`mobile/src/store/habits.store.ts`](../../../mobile/src/store/habits.store.ts) (Zustand): `load()` (hábitos ativos + logs de hoje + drain da fila), `increment`/`decrement` (otimista + `rpc habit_log_add`), `resetToday`, CRUD.
- [x] **T011** Offline: fila dedicada [`habit-queue.ts`](../../../mobile/src/lib/habit-queue.ts) (deltas, dedup por `opId`); `load()` dá `drain` ao reconectar ([habit-queue.test.ts](../../../mobile/src/lib/__tests__/habit-queue.test.ts)). *Nota: fila separada da `sync-queue` (de atividades), mesmo padrão.*
- [x] **T012** Componente [`HabitStepper.tsx`](../../../mobile/src/components/cards/HabitStepper.tsx): `[−]` · valor + progresso · `[＋]`; estados batida/alerta; haptic; long-press no `−` → `resetToday`. *Animação via `Animated` nativo (Reanimated não está instalado no projeto).*
- [x] **T013** Steppers dos hábitos ativos na seção "Contadores" da Hoje ([(tabs)/index.tsx](../../../mobile/src/app/(tabs)/index.tsx)).
- [x] **T014** Água mock (`water: number`/copos) substituída por hábito contador "Água" semente (`seedDefaults` no store); score de nutrição agora deriva do progresso do hábito.
- [ ] **T015** Verificar em device/simulador: SC-001 (`value = N×step` persiste), SC-002 (vira o dia → 0; dia anterior preservado), SC-003 (batida/alerta), SC-006 (offline → reconecta). *Typecheck + unit tests OK; falta rodar `mobile:ios` com a migration aplicada.*

## F2 — CRUD mobile (US2, US5) ✅

- [x] **T020** Tela [`habitos/index.tsx`](../../../mobile/src/app/habitos/index.tsx): lista ativos/arquivados, arquivar/reativar, empty-state, `+` no header. *(reordenar `sort` ficou no backlog — sort é atribuído na criação.)*
- [x] **T021** Editor [`habitos/editor.tsx`](../../../mobile/src/app/habitos/editor.tsx) (criar/editar via param `id`): nome, direção (Atingir/Não passar), meta/limite, unidade (+chips), incremento, ícone, cor; valida nome/unidade/`step > 0`.
- [x] **T022** `createHabit`/`updateHabit`/`archiveHabit` + `loadAll` (todos os hábitos) no [store](../../../mobile/src/store/habits.store.ts); `target: null` limpa a meta.
- [x] **T023** Entrada "Hábitos" na aba [Mais](../../../mobile/src/app/(tabs)/mais.tsx) → `/habitos`; rotas registradas no [Stack raiz](../../../mobile/src/app/_layout.tsx).
- [ ] **T024** Verificar em device: criar hábito → aparece na Hoje; arquivar → some da Hoje, segue em "Arquivados" e na análise (SC-004). *Typecheck + tests OK.*

## F3 — Análise web (US4) ✅

- [x] **T030** [`habits.store.ts`](../../../web/src/app/features/habitos/data/habits.store.ts) (signals): `load()` (hábitos + logs da janela de 84 dias num só par de fetches), `logsFor(id)` via computed map, `isEmpty`/`error`/`loading`.
- [x] **T030b** Lógica espelhada em [`data/habit-logic.ts`](../../../web/src/app/features/habitos/data/habit-logic.ts) (cópia de `mobile/src/lib/habit-logic.ts` — coberta pelos testes do mobile; manter em sincronia).
- [x] **T031** [`HabitosPageComponent`](../../../web/src/app/features/habitos/pages/habitos-page.component.ts) (standalone, OnPush): estado de loading/erro/vazio vs grid de cards.
- [x] **T032** [`habit-analytics-card`](../../../web/src/app/features/habitos/components/habit-analytics-card.component.ts): ícone/cor, valor de hoje + barra de meta, streak, média 30d, subtítulo por direção; mapeia ícone Ionicons→`rt-icon`.
- [x] **T033** [`habit-heatmap`](../../../web/src/app/features/habitos/components/habit-heatmap.component.ts) (SVG, 84 dias em colunas de 7): intensidade por progresso; `at_most` acima do teto fica vermelho.
- [x] **T034** Rota `/habitos` (lazy) em [main.ts](../../../web/src/main.ts) + item "Hábitos" na [sidebar](../../../web/src/app/shared/layouts/sidebar.component.ts).
- [ ] **T035** Verificar SC-007 em dados reais (streak/heatmap × SQL). *`ng build` OK; falta conferir com conta de teste após a migration.*

## F4 — CRUD web (opcional)

- [x] **T040** `habit-editor` no web (criar/editar/arquivar) com `create/update/archive` no store; paridade com o mobile. — [habit-editor.component.ts](../../../web/src/app/features/habits/components/habit-editor.component.ts) + `createHabit`/`updateHabit`/`archiveHabit` em [habits.store.ts:142,174,202](../../../web/src/app/features/habits/data/habits.store.ts#L142). *Auditado em 2026-08-26: estava aberto com o código já entregue.*
- [ ] **T041** Verificar paridade: hábito criado no web aparece na captura mobile e vice-versa. *Exige os dois apps rodando na mesma conta.*

## Validação final

- [x] **T050** lint e testes. *Rodado em 2026-08-26: `@vitale/shared` tsc + 17 testes, `@vitale/web build`, `@vitale/web test` (140 testes / 11 arquivos), mobile `tsc --noEmit` + jest (480 testes / 42 suítes) — todos exit 0.*
- [ ] **T051** `npm run mobile:ios` — stepper (soma/subtrai/piso 0), batida/alerta, long-press zera, offline + reconectar, CRUD.
- [ ] **T052** `npm run web:dev` — empty-state, cards de analytics, heatmap.
- [ ] **T053** Teste de RLS com duas contas (SC-005); conferir totais/streak do web × SQL.
