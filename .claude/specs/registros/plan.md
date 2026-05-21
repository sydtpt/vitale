# Plano: Registros

> Espelha a arquitetura de Habitos: shared (tipos) → Supabase (tabelas+RLS) →
> store por plataforma → UI. Marca **binária** por dia (≠ contador) e `module` (como Tarefas).

## Camadas

### Shared (`packages/shared`)
- `models/index.ts`: tipos `Registro` e `RegistroLog` (reusa `TodoModule`). Sem lógica.
- Ícones: reusa `HABIT_ICONS` (set canônico cross-platform). Sem constante nova.

### Supabase (`supabase/migrations/20260521130000_registros.sql`)
- Tabelas `registros` + `registro_logs`, índices, trigger `touch_updated_at` em `registros`,
  RLS por usuário. Ver [data-model](./data-model.md).

### Web (`web/src/app/features/registros/`)
- `data/registro-logic.ts`: puros — `localDateStr`, `lastNDates`, `daysBetween`, heatmap cells.
- `data/registros.store.ts`: signals — `load` (registros + logs da janela), `markToday`,
  `unmarkToday`, `createRegistro`, `updateRegistro`, `archiveRegistro`. Derivações por `computed`.
- `pages/registros-page.component.{ts,html,scss}`: header (toggle Lista/Gráficos + Novo),
  lista com botão marcar/desmarcar hoje, grid de cards de análise, estado vazio.
- `components/registro-editor.component.ts`: modal (nome, módulo, ícone, cor).
- `components/registro-analytics-card.component.{ts,html,scss}`: contagem, "última vez",
  heatmap (reusa `HabitHeatmapComponent`).
- Rota em `web/src/main.ts` (`/registros`, `profileGuard`) + item na `sidebar.component.ts`.

### Mobile (`mobile/src/app/registros/`)
- `store/registros.store.ts` (Zustand): `load`, `loadAll`, `markToday`, `unmarkToday` (toggle
  otimista + supabase), `createRegistro`, `updateRegistro`, `archiveRegistro`.
- `index.tsx`: tela principal — lista (ativos/arquivados) com botão marcar hoje + editar/arquivar.
- `editor.tsx`: criar/editar (nome, módulo, ícone, cor).
- Link em `mobile/src/app/(tabs)/mais.tsx` → `/registros`.

## Estratégia de marcação
- Toggle otimista no store; `insert ... on conflict do nothing` (marcar) / `delete` por
  `(registro_id, log_date=hoje)` (desmarcar). Em erro: reverte o estado local.
- Sem fila offline dedicada no v1 (operação idempotente; benigna em re-load). Backlog se preciso.

## Ordem de execução
1. Specs ✅ → 2. Shared → 3. Migration → 4. Web (logic/store/UI/rota) → 5. Mobile (store/UI/nav)
→ 6. typecheck/lint.
