-- Vitale — Tarefas: "A partir de" (start_date)
-- Spec: .claude/specs/tarefas/
--
-- Campo opcional 'YYYY-MM-DD' (local) na série: antes desse dia a tarefa fica
-- oculta em todas as listas (atrasada/hoje/em breve) e a primeira ocorrência de
-- calendário é ancorada nessa data (não retroage). null/ausente = vale desde já
-- ("Agora"). A validação/efeito ficam no cliente (lógica pura compartilhada).
alter table public.todo_templates
  add column if not exists start_date date;
