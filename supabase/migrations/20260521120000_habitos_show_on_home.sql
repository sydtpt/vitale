-- Vitale — Habitos: flag "mostrar na home"
-- Spec: .claude/specs/habitos/
-- Acrescenta `show_on_home` em habits. true (default): o hábito aparece na home
-- (tela "Hoje"); false: fica restrito à tela de gestão de hábitos.

alter table public.habits
  add column if not exists show_on_home boolean not null default true;
