-- Vitale — Habitos (contadores diários)
-- Spec: .claude/specs/habitos/
-- Só contadores; direção at_least/at_most; reset diário por data local. RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- habits — definição do hábito contador
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habits (
  id         uuid         primary key default gen_random_uuid(),
  user_id    uuid         not null references auth.users(id) on delete cascade,
  name       text         not null,
  icon       text,                                    -- nome do ícone (IconComponent web / MCIcons mobile)
  color      text,                                    -- token do design system (MOD/accents)
  unit       text         not null,                   -- 'L', 'ml', 'un', 'cig'...
  step       numeric(8,3) not null check (step > 0),  -- incremento por toque, na unidade
  target     numeric(8,3) check (target is null or target >= 0), -- meta/teto (null = sem meta)
  direction  text         not null default 'at_least'
               check (direction in ('at_least','at_most')),
  active     boolean      not null default true,
  sort       int          not null default 0,
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now()
);

create index if not exists habits_user_active_idx on public.habits (user_id, active, sort);

-- ─────────────────────────────────────────────────────────────
-- habit_logs — valor acumulado por hábito por dia
-- 1 linha por (habit_id, log_date); ausência de linha ⇒ valor 0 (reset diário)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.habit_logs (
  id         uuid          primary key default gen_random_uuid(),
  habit_id   uuid          not null references public.habits(id) on delete cascade,
  user_id    uuid          not null references auth.users(id) on delete cascade,
  log_date   date          not null,                  -- data LOCAL do dispositivo
  value      numeric(10,3) not null default 0 check (value >= 0),
  created_at timestamptz   not null default now(),
  updated_at timestamptz   not null default now(),
  unique (habit_id, log_date)                         -- idempotência do reset/incremento
);

create index if not exists habit_logs_user_date_idx  on public.habit_logs (user_id, log_date desc);
create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date desc);

-- touch updated_at (a função já é criada pela migration de activities; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists habits_touch on public.habits;
create trigger habits_touch before update on public.habits
  for each row execute function public.touch_updated_at();

drop trigger if exists habit_logs_touch on public.habit_logs;
create trigger habit_logs_touch before update on public.habit_logs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- habit_log_add — soma atômica do delta no valor do dia, com piso 0.
-- p_delta = +step (＋) ou -step (−). Devolve o novo valor.
-- security invoker mantém o RLS do chamador.
-- ─────────────────────────────────────────────────────────────
create or replace function public.habit_log_add(p_habit uuid, p_date date, p_delta numeric)
returns numeric language sql security invoker as $$
  insert into public.habit_logs (habit_id, user_id, log_date, value)
  select p_habit, h.user_id, p_date, greatest(0, p_delta)
    from public.habits h where h.id = p_habit
  on conflict (habit_id, log_date) do update
    set value = greatest(0, public.habit_logs.value + p_delta)
  returning value;
$$;

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

create policy "own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own habit_logs" on public.habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
