-- Vitale — Tarefas: marca "só nasce por gatilho"
-- Spec: .claude/specs/tarefas/
--
-- `trigger_only = true` significa: a série NÃO cria ocorrência inicial nem
-- entra na reconciliação de calendário. Ocorrências só surgem por gatilho
-- (onComplete, on_workout/sync HealthKit, gatilhos manuais event/stock/usage).
alter table public.todo_templates
  add column if not exists trigger_only boolean not null default false;
