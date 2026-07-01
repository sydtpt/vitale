-- Vitale — Metas anuais contabilizadas
-- Spec: .claude/specs/web-metas.md
-- Uma meta pertence a um ano e mede progresso por família (cadence|milestone|cumulative)
-- a partir de uma fonte (atividade|tarefa|hábito|manual). O progresso é DERIVADO no
-- cliente (evaluateGoal do shared) — a tabela guarda só a definição. RLS por usuário.

create table if not exists public.goals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  year             int         not null,
  title            text        not null,
  cat              text        not null default 'geral',   -- token de módulo (MOD) p/ cor/agrupamento
  family           text        not null
                     check (family in ('cadence','milestone','cumulative')),
  source           jsonb       not null,                   -- { kind, activityId?, activityMetric?, bestEffortKey?, templateId?, habitId? }
  period           text        check (period in ('week','month')),  -- só cadence
  per_period_target numeric(12,3),                         -- só cadence (default 1 no cliente)
  target           numeric(14,3) not null,                 -- interpretado pela família
  unit             text,                                   -- rótulo de exibição ('km','livros','R$'...)
  manual_current   numeric(14,3),                          -- só source.kind = 'manual'
  active           boolean     not null default true,
  sort             int         not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists goals_user_active_idx on public.goals (user_id, active, sort);
create index if not exists goals_user_year_idx    on public.goals (user_id, year);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists goals_touch on public.goals;
create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.goals enable row level security;

create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
