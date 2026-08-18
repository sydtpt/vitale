# 0008 — Um seam único para conclusão de tarefa

**Status:** aceita
**Data:** 2026-05-27

## Contexto

Concluir uma tarefa dispara mais do que marcar um checkbox: resolve a ocorrência de forma idempotente, atualiza o meter de uso, gera a próxima ocorrência da série e dispara encadeamento para outras séries. Isso acontece a partir de vários pontos — toque no mobile, clique na web, e sincronização de treino, que conclui a tarefa correspondente.

Com cada caminho implementando o seu próprio fluxo, um deles esquece um passo.

## Decisão

Toda conclusão passa por **um** seam: `services/todo-resolve.ts#resolveAndAdvance`. A `todos.store` do mobile e a `TodosStore.resolve` da web chamam ele. O vínculo treino→tarefa (`services/activity-todo-link.ts`) também.

`todo_templates.linked_activity_id` é o marcador único de "satisfeita por atividade". Quantidade se modela como N ocorrências de um template, nunca N templates.

Encadeamento é campo `template.onComplete: TodoSpawnRule[]` no **pai**, não na filha: cada regra define qual série instanciar quando esta é concluída.

## Alternativas rejeitadas

**`recurrence.kind = 'on_task'` na filha.** Foi a primeira forma e foi removida. Declarar na filha quem a cria inverte a direção da informação — para saber o que uma conclusão dispara, era preciso varrer todas as outras séries.

**Cada store com seu fluxo.** Multiplicaria por dois o custo de toda regra nova de conclusão, com divergência garantida.

## Consequências

Challenges e qualquer mecânica futura de conclusão **devem** entrar por este seam. Um caminho novo que resolva ocorrência direto no store nasce quebrado.

Filhas de gatilho marcam `triggerOnly`, senão a ocorrência inicial aparece antes do gatilho — a tarefa de pós-corrida surgiria antes da corrida.

O vínculo treino→tarefa roda só em `syncDelta`, **nunca** no backfill `syncType`: reprocessar histórico não deve concluir tarefas retroativamente.
