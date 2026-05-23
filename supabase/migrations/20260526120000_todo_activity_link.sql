-- Vitale — Vínculo Tarefa × Atividade (HealthKit)
-- Spec: .claude/specs/tarefas/ + .claude/specs/sync-atividades/
-- Marca uma série como "satisfeita ao fazer a atividade X" (activityId do HealthKit).
-- O sync de atividades (syncDelta) conclui/gera a ocorrência do dia para a série vinculada.
-- linked_activity_id é o marcador ÚNICO de "satisfeita por atividade", não importa quem criou
-- a série (editor manual, auto-create do sync, futuros encadeamento/challenge).

alter table public.todo_templates
  add column if not exists linked_activity_id int;   -- código HealthKit (37=corrida, 13=ciclismo, 57=yoga...)

create index if not exists todo_templates_linked_activity_idx
  on public.todo_templates (user_id, linked_activity_id)
  where linked_activity_id is not null;
