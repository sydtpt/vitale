-- Vitale — Tarefas: janela de horário (hora inicial / hora final)
-- Spec: .claude/specs/tarefas/
--
-- Campos opcionais 'HH:MM' (local) para séries com data (monthly/weekly/yearly/
-- after_completion):
--   start_time → a ocorrência do dia só aparece a partir desse horário;
--   end_time   → após esse horário no dia a ocorrência é cancelada automaticamente.
-- Texto livre 'HH:MM'; a validação fica no cliente (lógica pura compartilhada).
alter table public.todo_templates
  add column if not exists start_time text,
  add column if not exists end_time text;
