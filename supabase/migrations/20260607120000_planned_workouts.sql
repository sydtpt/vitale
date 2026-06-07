-- Vitale — Planner de treinos (treinos planejados por dia)
-- Spec: .claude/specs/treinos / readiness-treino
-- A *intenção* do usuário para um dia (distinta de `activities`, que é o treino
-- real sincronizado do HealthKit). `kind` direciona o readiness; a conclusão é
-- por auto-match no cliente (uma `Activity` compatível no mesmo dia local).
-- RLS por usuário.

create table if not exists public.planned_workouts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  plan_date   date        not null,                  -- data LOCAL do dia agendado
  type        text        not null,                  -- ex.: "Pernas — Volume"
  kind        text        not null default 'easy'
                check (kind in ('strength','endurance','easy','rest')),
  dur_min     int         not null default 0,
  dist_km     numeric,                               -- só endurance
  sort        int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists planned_workouts_user_date_idx
  on public.planned_workouts (user_id, plan_date);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists planned_workouts_touch on public.planned_workouts;
create trigger planned_workouts_touch before update on public.planned_workouts
  for each row execute function public.touch_updated_at();

alter table public.planned_workouts enable row level security;

create policy "own planned_workouts" on public.planned_workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
