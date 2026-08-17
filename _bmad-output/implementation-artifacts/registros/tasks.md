# Tarefas: Registros

## Shared
- [ ] T1 — `Registro` e `RegistroLog` em `packages/shared/src/models/index.ts` (reusa `TodoModule`).

## Supabase
- [ ] T2 — Migration `20260521130000_registros.sql`: tabelas `registros` + `registro_logs`,
  índices, trigger `touch_updated_at`, RLS (`own registros` / `own registro_logs`).

## Web
- [ ] T3 — `features/registros/data/registro-logic.ts` (puros: data local, janela, daysBetween, heatmap).
- [ ] T4 — `features/registros/data/registros.store.ts` (signals: load/mark/unmark/CRUD/archive).
- [ ] T5 — `features/registros/components/registro-editor.component.ts` (modal: nome/módulo/ícone/cor).
- [ ] T6 — `features/registros/components/registro-analytics-card.component.{ts,html,scss}` (contagem/última vez/heatmap).
- [ ] T7 — `features/registros/pages/registros-page.component.{ts,html,scss}` (lista + marcar + grid análise + vazio).
- [ ] T8 — Rota `/registros` em `web/src/main.ts` + item na `sidebar.component.ts`.

## Mobile
- [ ] T9 — `mobile/src/store/registros.store.ts` (Zustand: load/loadAll/mark/unmark/CRUD/archive).
- [ ] T10 — `mobile/src/app/registros/index.tsx` (lista ativos/arquivados + marcar + editar/arquivar).
- [ ] T11 — `mobile/src/app/registros/editor.tsx` (criar/editar: nome/módulo/ícone/cor).
- [ ] T12 — Link em `mobile/src/app/(tabs)/mais.tsx` → `/registros`.

## Fechamento
- [ ] T13 — Link dos specs no `CLAUDE.md`.
- [ ] T14 — typecheck/lint (web + mobile + shared).
