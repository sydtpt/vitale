-- Vitale — Conexões / contas vinculadas (Strava, intervals.icu) + dedupe cross-source
--
-- 1. `linked_accounts`: estado da conexão por provedor (legível pelo client).
-- 2. `linked_account_secrets`: tokens/API keys — SÓ service role (edge functions).
-- 3. `activities`: colunas de identidade por fonte (provider, external_id,
--    external_ids) + índices para o dedupe do ingest server-side.
-- 4. `sync_upsert_activities` recriada para propagar provider/external_id.
--
-- Ingestão: edge functions `intervals-link`, `connections-ingest`, `strava-oauth`
-- (supabase/functions/). Agendamento: supabase/scripts/schedule_connections_ingest.sql.
--
-- Deploy manual (como as demais migrations):
--   1. Aplicar este arquivo no SQL editor.
--   2. `supabase functions deploy intervals-link connections-ingest strava-oauth`
--   3. `supabase secrets set CRON_SECRET=... STRAVA_CLIENT_ID=... STRAVA_CLIENT_SECRET=...
--       OAUTH_STATE_SECRET=... WEB_APP_URL=...`
--   4. Rodar supabase/scripts/schedule_connections_ingest.sql (cron a cada 15 min).

-- ─────────────────────────────────────────────────────────────
-- linked_accounts — uma linha por (usuário, provedor)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.linked_accounts (
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('strava', 'intervals')),
  status        text not null default 'pending'
                  check (status in ('pending', 'connected', 'error', 'revoked')),
  athlete_id    text,
  athlete_name  text,
  -- Metadados capturados no vínculo (ex.: {"max_hr": 187}) usados pelo ingest.
  athlete_meta  jsonb,
  -- Cursor de ingestão: start_at do último treino ingerido (backfill ascendente).
  cursor        timestamptz,
  backfill_done boolean not null default false,
  last_sync_at  timestamptz,
  last_error    text,
  connected_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, provider)
);

drop trigger if exists linked_accounts_touch on public.linked_accounts;
create trigger linked_accounts_touch
  before update on public.linked_accounts
  for each row execute function public.touch_updated_at();

alter table public.linked_accounts enable row level security;

-- Client lê o status e pode desvincular; INSERT/UPDATE só via edge functions
-- (service role ignora RLS) — tokens e cursor nunca são escritos pelo app.
create policy "own linked accounts read" on public.linked_accounts
  for select using (auth.uid() = user_id);
create policy "own linked accounts delete" on public.linked_accounts
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- linked_account_secrets — credenciais, invisíveis ao client
-- RLS ligada SEM policies + revoke: anon/authenticated não leem nada;
-- as edge functions usam service role (bypass de RLS).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.linked_account_secrets (
  user_id       uuid not null,
  provider      text not null,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  -- intervals.icu autentica por API key (Basic API_KEY:<key>).
  api_key       text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, provider),
  foreign key (user_id, provider)
    references public.linked_accounts (user_id, provider) on delete cascade
);

alter table public.linked_account_secrets enable row level security;
revoke all on public.linked_account_secrets from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- activities — identidade por fonte
--   provider     'healthkit' | 'strava' | 'intervals' (origem da linha)
--   external_id  id na fonte (UUID do HK / id numérico Strava / id intervals)
--   external_ids todas as fontes já mescladas nesta linha: {"strava":"123",...}
-- Linhas novas de provedor externo usam id = '{provider}:{external_id}';
-- linhas do HealthKit mantêm o UUID como hoje.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists provider     text,
  add column if not exists external_id  text,
  add column if not exists external_ids jsonb;

comment on column public.activities.provider is
  'Fonte que criou a linha: healthkit | strava | intervals.';
comment on column public.activities.external_ids is
  'Fontes mescladas nesta linha canônica (provider → id externo). Base da idempotência do dedupe.';

update public.activities
set provider = 'healthkit', external_id = id
where provider is null;

-- Idempotência por fonte: o mesmo treino da mesma fonte nunca duplica.
create unique index if not exists activities_provider_ext_uidx
  on public.activities (user_id, provider, external_id)
  where provider is not null and external_id is not null;

-- Busca por fonte já mesclada (passo 0 do dedupe).
create index if not exists activities_external_ids_gin
  on public.activities using gin (external_ids);

-- Janela de candidatos do dedupe (user + start_at range, incluindo ocultas).
create index if not exists activities_user_window_idx
  on public.activities (user_id, start_at);

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para propagar provider/external_id.
-- Base: 20260708120000_activities_elevation.sql. Diferenças: provider e
-- external_id no insert (com defaults compatíveis com o app mobile atual,
-- que não envia esses campos); o UPDATE não toca provider/external_id/
-- external_ids — o merge cross-source é responsabilidade do ingest.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts, hr_zones,
    elevation_m, provider, external_id, external_ids
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts', r->'hr_zones',
    nullif(r->>'elevation_m', '')::numeric,
    coalesce(r->>'provider', 'healthkit'),
    coalesce(r->>'external_id', r->>'id'),
    jsonb_build_object(coalesce(r->>'provider', 'healthkit'), coalesce(r->>'external_id', r->>'id'))
  from jsonb_array_elements(rows) as r
  on conflict (id) do update set
    activity_id   = excluded.activity_id,
    -- Campos editáveis: preserva o valor manual quando o campo foi editado.
    activity_name = case when activities.name_edited then activities.activity_name else excluded.activity_name end,
    duration_s    = case when activities.duration_edited then activities.duration_s else excluded.duration_s end,
    calories      = excluded.calories,
    start_at      = excluded.start_at,
    end_at        = excluded.end_at,
    moving_time_s = excluded.moving_time_s,
    distance_m    = excluded.distance_m,
    source_name   = excluded.source_name,
    source_id     = excluded.source_id,
    device        = excluded.device,
    tracked       = excluded.tracked,
    has_route     = excluded.has_route,
    metadata      = excluded.metadata,
    best_efforts  = excluded.best_efforts,
    hr_zones      = excluded.hr_zones,
    elevation_m   = excluded.elevation_m;
  -- Sem WHERE: linhas editadas são atualizadas, exceto seus campos preservados.
  -- provider/external_id/external_ids ficam como estão (merge é do ingest).
$$;
