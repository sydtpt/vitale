# Tarefas — Tasks

## Feito ✅ (v1)

- [x] Tipos `Todo*` no shared (`packages/shared/src/models/index.ts`)
- [x] Migration `todo_templates` + `todo_occurrences` + RPC `todo_resolve` + RLS
- [x] Token `tarefa` no `MOD` (shared + tema mobile)
- [x] Lógica pura `todo-logic` (firstDueDate/nextDueDate/isOverdue/daysLate/dueUsage/reconcileTemplate)
- [x] Testes `todo-logic.test.ts` (23 casos)
- [x] Espelho `todo-logic` na web
- [x] Helpers de formato `todo-format` (mobile + web)
- [x] Fila offline `todo-queue.ts` (mobile)
- [x] Store mobile `todos.store.ts` (load/reconcile/CRUD/resolve/skip/cancel/updateMeter/trigger)
- [x] Card mobile `TodoItem.tsx`
- [x] Telas mobile `tarefas/index.tsx` (Atrasadas/A fazer/Em breve/Gatilhos) e `tarefas/editor.tsx`
- [x] Navegação: link na aba Mais; surfacing no Hoje
- [x] Store web `todos.store.ts` (signals)
- [x] Web `todo-card`, `todo-editor` (modal), `tarefas-page`
- [x] Rota `/tarefas` + entrada na sidebar
- [x] Gatilhos não-temporais (event/usage/stock) — stores + telas
- [x] Conclusão rica de Finanças (`meta.amount`) — mobile + web
- [x] Specs (spec/plan/data-model/tasks) + CLAUDE.md

## Feito ✅ (v1.1 — encadeamento)

- [x] Trocar `recurrence.kind=on_task` por `TodoSpawnRule[]` em `template.onComplete`
- [x] Migration `20260527130000_todo_on_complete.sql` (coluna + migração de dados)
- [x] Seam `fireOnComplete` no `todo-resolve` (mobile) e `todos.store` (web)
- [x] Editor mobile/web: seção "Ao concluir, criar" + "É criada por" (read-only)
- [x] Flag `triggerOnly` (migration `20260527140000_todo_trigger_only.sql`) +
      `createTemplate` pula ocorrência inicial + `reconcileTemplate` ignora
      calendário quando true + toggle no editor
- [x] Specs (spec/data-model/tasks)

## Pendente / próximos 🔧

- [ ] Aplicar as migrations no Supabase (`20260520160000_tarefas.sql`, `20260527130000_todo_on_complete.sql` e `20260527140000_todo_trigger_only.sql`)
- [ ] Backend de Compras/Finanças → ponte real `stock`→Compras, `amount`→Transação
- [ ] Antecedência/janela de prazo e "X vezes por período"
- [ ] Heatmap/analytics de adesão na web (opcional)
- [ ] Notificações push para tarefas do dia/atrasadas
