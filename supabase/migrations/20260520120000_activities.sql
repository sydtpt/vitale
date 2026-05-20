-- Vitale — Sincronização de Atividades (HealthKit → Supabase)
-- Spec: .claude/specs/sync-atividades/
-- Modelo push-only, opt-in por tipo. RLS por usuário.

-- ─────────────────────────────────────────────────────────────
-- activities
-- PK = ID do treino no HealthKit (UUID em texto) ou chave derivada.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.activities (
  id            text        primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  activity_id   int         not null,                 -- código HK (37=corrida, 50=musculação...)
  activity_name text,                                 -- nome cru do HealthKit
  calories      int         not null default 0,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  duration_s    int         not null default 0,       -- segundos
  distance_m    numeric,                              -- metros (null = indoor/sem distância)
  source_name   text,
  source_id     text,
  device        text,
  tracked       boolean,
  has_route     boolean     not null default false,
  metadata      jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists activities_user_start_idx on public.activities (user_id, start_at desc);
create index if not exists activities_user_type_idx  on public.activities (user_id, activity_id);

-- touch updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists activities_touch on public.activities;
create trigger activities_touch
  before update on public.activities
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- activity_routes — pontos GPS (1:1 com activities, opcional)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.activity_routes (
  activity_id text        primary key references public.activities(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  points      jsonb       not null,                   -- [{ lat, lng, alt? }, ...]
  point_count int         not null default 0,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- synced_activity_types — tipos de treino que o usuário optou por sincronizar
-- type_key = label de getActivityMeta (ex.: "Corrida")
-- ─────────────────────────────────────────────────────────────
create table if not exists public.synced_activity_types (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  type_key   text        not null,
  created_at timestamptz not null default now(),
  primary key (user_id, type_key)
);

-- ─────────────────────────────────────────────────────────────
-- sync_state — âncora incremental por dispositivo
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sync_state (
  user_id        uuid        not null references auth.users(id) on delete cascade,
  device_id      text        not null,
  last_synced_at timestamptz,
  anchor         text,
  primary key (user_id, device_id)
);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.activities            enable row level security;
alter table public.activity_routes       enable row level security;
alter table public.synced_activity_types enable row level security;
alter table public.sync_state            enable row level security;

create policy "own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own routes" on public.activity_routes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own synced types" on public.synced_activity_types
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sync_state" on public.sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
