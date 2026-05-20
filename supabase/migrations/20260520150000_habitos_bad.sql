-- Vitale — Habitos: flag de "hábito ruim" (a evitar)
-- Spec: .claude/specs/habitos/
-- Acrescenta `bad` em habits. Bom (false): sequência de dias cumprindo a meta.
-- Ruim (true): contagem de dias consecutivos SEM fazer (abstinência) — derivada no cliente.

alter table public.habits
  add column if not exists bad boolean not null default false;
