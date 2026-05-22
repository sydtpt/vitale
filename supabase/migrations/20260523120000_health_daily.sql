-- Vitale — Saúde diária (Apple Health agregado → Supabase)
-- Spec/plano: bem-estar (HealthKit → Supabase → Web).
-- Long-format: 1 linha por (user_id, day, metric). Espelha habit_logs.
-- O mobile agrega as amostras do HealthKit em valores diários ANTES de enviar
-- (cumulativas = soma; discretas = média + min/max/count). Nunca sobem brutas.

-- ─────────────────────────────────────────────────────────────
-- health_daily
-- ─────────────────────────────────────────────────────────────
create table if not exists public.health_daily (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null,                 -- data LOCAL do dispositivo
  metric     text        not null,                 -- id de MetricDef ('passos','fc',...)
  value      numeric,                              -- agregado principal (soma p/ cumulative, média p/ discrete)
  min_value  numeric,                              -- só discretas
  max_value  numeric,                              -- só discretas
  count      int,                                  -- nº de amostras brutas agregadas (diagnóstico)
  extra      jsonb,                                -- casos especiais: pressão {sys,dia}, anéis, macros
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, metric)
);

create index if not exists health_daily_user_metric_day_idx
  on public.health_daily (user_id, metric, day desc);

-- touch updated_at (reusa a função criada em 20260520120000_activities.sql)
drop trigger if exists health_daily_touch on public.health_daily;
create trigger health_daily_touch
  before update on public.health_daily
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.health_daily enable row level security;

create policy "own health_daily" on public.health_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- RPC de upsert idempotente em lote (espelha sync_upsert_activities).
-- `security invoker` → roda sob a RLS do chamador.
-- on conflict do update → re-enviar o dia corrente sempre atualiza (resolve
-- "hoje ainda mudando"). Saúde não tem `locally_edited`, então sem condição.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_health_daily(rows jsonb)
returns void language sql security invoker as $$
  insert into public.health_daily (user_id, day, metric, value, min_value, max_value, count, extra)
  select
    (r->>'user_id')::uuid,
    (r->>'day')::date,
    r->>'metric',
    nullif(r->>'value', '')::numeric,
    nullif(r->>'min_value', '')::numeric,
    nullif(r->>'max_value', '')::numeric,
    nullif(r->>'count', '')::int,
    r->'extra'
  from jsonb_array_elements(rows) as r
  on conflict (user_id, day, metric) do update set
    value     = excluded.value,
    min_value = excluded.min_value,
    max_value = excluded.max_value,
    count     = excluded.count,
    extra     = excluded.extra;
$$;
