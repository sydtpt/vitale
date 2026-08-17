# Tarefas — Plano de implementação

Reaproveita os **padrões** do módulo Habitos (store, fila offline, helpers de data,
tokens/`MOD`, componentes de card, migration + RLS + RPC) — **sem** reusar o modelo.

## Fases (todas concluídas no v1)

1. **Shared:** tipos `Todo*` em `packages/shared/src/models/index.ts`.
2. **Migration:** `supabase/migrations/20260520160000_tarefas.sql` (tabelas + RLS + `todo_resolve`).
3. **Lógica pura:** `mobile/src/lib/todo-logic.ts` + testes; espelho em `web/.../tarefas/data/todo-logic.ts`.
4. **Mobile dados:** `mobile/src/store/todos.store.ts` + fila offline `mobile/src/lib/todo-queue.ts`.
5. **Mobile UI:** `components/cards/TodoItem.tsx`, `app/tarefas/index.tsx`, `app/tarefas/editor.tsx`,
   link na aba Mais, surfacing no Hoje (`app/(tabs)/index.tsx`).
6. **Web:** `features/tarefas/` (store signals, page, `todo-card`, `todo-editor`), rota `/tarefas`, sidebar.
7. **Eixos avançados:** gatilhos `event`/`usage`/`stock` (stores + telas) e conclusão rica de `financas` (meta.amount).
8. **Tokens/docs:** token `tarefa` no `MOD`, specs, CLAUDE.md.

## Decisões

- **Reconciliação client-side** no `load` (como os habitos derivam estado), idempotente via
  índice único parcial. Sem job de servidor.
- **Geração da próxima** feita no cliente (a data depende da recorrência); o RPC só resolve status.
- **Offline (mobile):** fila de resoluções drenada via `todo_resolve`; criação de séries assume online
  (como o CRUD de habitos). Lacuna conhecida: próxima de `after_completion` criada offline é recriada
  apenas no próximo `load` online se a inserção falhar.
- **Integração:** sem backend de Compras/Finanças, a integração v1 é categorização + `meta` na conclusão.

## Verificação

- `npm run test` (todo-logic), `npm run lint`.
- Web: `ng build` (chunk `tarefas-page-component`).
- Mobile: `tsc --noEmit`.
- Manual: criar os 5 exemplos, concluir e ver a próxima ocorrência; testar carry/expire/auto.
