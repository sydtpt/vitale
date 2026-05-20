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

## Pendente / próximos 🔧

- [ ] Aplicar a migration no Supabase (local `supabase db push` ou cloud)
- [ ] Backend de Compras/Finanças → ponte real `stock`→Compras, `amount`→Transação
- [ ] Antecedência/janela de prazo
- [ ] Encadeamento (concluir uma gera outra) e "X vezes por período"
- [ ] Heatmap/analytics de adesão na web (opcional)
- [ ] Notificações push para tarefas do dia/atrasadas
