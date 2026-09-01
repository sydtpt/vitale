# Tarefas: Registros

> **Auditoria 2026-08-26 — módulo entregue.** Este checklist tinha 14/14 itens
> abertos enquanto o código já estava em produção desde `fec5862`; nunca foi
> marcado. Cada linha abaixo foi conferida contra o arquivo real antes do `[x]`.

## Shared
- [x] T1 — `Registro` e `RegistroLog` em `packages/shared/src/models/index.ts` (reusa `TodoModule`). — [models/index.ts:533,545](../../../packages/shared/src/models/index.ts#L533)

## Supabase
- [x] T2 — Migration `20260521130000_registros.sql`: tabelas `registros` + `registro_logs`,
  índices, trigger `touch_updated_at`, RLS (`own registros` / `own registro_logs`). — [migration](../../../supabase/migrations/20260521130000_registros.sql)

## Web
- [x] T3 — `features/registros/data/registro-logic.ts` (puros: data local, janela, daysBetween, heatmap).
- [x] T4 — `features/registros/data/registros.store.ts` (signals: load/mark/unmark/CRUD/archive).
- [x] T5 — `features/registros/components/registro-editor.component.ts` (modal: nome/módulo/ícone/cor).
- [x] T6 — `features/registros/components/registro-analytics-card.component.ts` (contagem/última vez/heatmap). *Entregue como componente único com template/estilo inline — o `.html`/`.scss` separados previstos na tarefa não existem.*
- [x] T7 — `features/registros/pages/registros-page.component.{ts,html,scss}` (lista + marcar + grid análise + vazio).
- [x] T8 — Rota `/registros` em `web/src/main.ts` + item na `sidebar.component.ts`. — [main.ts:95](../../../web/src/main.ts#L95) · [sidebar.component.ts:26](../../../web/src/app/shared/layouts/sidebar.component.ts#L26)

## Mobile
- [x] T9 — `mobile/src/store/registros.store.ts` (Zustand: load/loadAll/mark/unmark/CRUD/archive).
- [x] T10 — `mobile/src/app/registros/index.tsx` (lista ativos/arquivados + marcar + editar/arquivar).
- [x] T11 — `mobile/src/app/registros/editor.tsx` (criar/editar: nome/módulo/ícone/cor).
- [x] T12 — Link em `mobile/src/app/(tabs)/mais.tsx` → `/registros`. — [mais.tsx:23](../../../mobile/src/app/(tabs)/mais.tsx#L23)

> Fora do escopo original, também entregues: `mobile/src/app/registros/dia.tsx` e
> `marcar.tsx`.

## Fechamento
- [x] T13 — Link dos specs no `CLAUDE.md`.
- [x] T14 — typecheck/lint (web + mobile + shared). *Rodado em 2026-08-26: `@vitale/shared lint` (tsc) e `test` (17 testes) exit 0; `@vitale/web build` exit 0 (só o aviso pré-existente de budget do SCSS da retrospectiva); `@vitale/web test` 140 testes em 11 arquivos, exit 0; mobile `tsc --noEmit` limpo e `jest` 480 testes em 42 suítes, exit 0 (com o aviso pré-existente de worker que não encerra sozinho).*
