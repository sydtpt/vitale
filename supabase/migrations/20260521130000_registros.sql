-- Vitale — Registros (marcação diária de atividades avulsas)
-- Spec: .claude/specs/registros/
-- Sem recorrência nem meta: o usuário marca "feito hoje" (1x/dia), para análise.
-- Marca binária por dia (registro_logs); reset diário por data local. RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- registros — definição do item avulso (ex.: Pizza, Dentista)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.registros (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null,
  icon       text,                                   -- nome do ícone (HABIT_ICONS): rt-icon (web) / Ionicons (mobile)
  color      text,                                   -- token do design system (MOD)
  module     text        not null default 'geral'
               check (module in ('financas','compras','casa','saude','geral')),
  active     boolean     not null default true,
  sort       int         not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registros_user_active_idx on public.registros (user_id, active, sort);

-- ─────────────────────────────────────────────────────────────
-- registro_logs — marca binária por dia
-- 1 linha por (registro_id, log_date); ausência de linha ⇒ não feito naquele dia
-- ─────────────────────────────────────────────────────────────
create table if not exists public.registro_logs (
  id          uuid        primary key default gen_random_uuid(),
  registro_id uuid        not null references public.registros(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  log_date    date        not null,                  -- data LOCAL do dispositivo
  created_at  timestamptz not null default now(),
  unique (registro_id, log_date)                     -- idempotência: marcar 1x/dia
);

create index if not exists registro_logs_user_date_idx     on public.registro_logs (user_id, log_date desc);
create index if not exists registro_logs_registro_date_idx on public.registro_logs (registro_id, log_date desc);

-- touch updated_at (função já criada por migrations anteriores; recriar é idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists registros_touch on public.registros;
create trigger registros_touch before update on public.registros
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.registros     enable row level security;
alter table public.registro_logs enable row level security;

create policy "own registros" on public.registros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own registro_logs" on public.registro_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
