-- Vitale — Tempo em zonas de FC por atividade
-- Spec: .claude/specs/sync-atividades/
-- Persiste o tempo (segundos) que cada treino passou em cada zona de frequência
-- cardíaca, derivado das amostras de FC no mobile (Karvonen — reserva de FC):
--   %FCR = (FC − FCrep) / (FCmáx − FCrep)
-- mapeado às 5 zonas padrão (z1…z5). Vale para qualquer tipo de atividade.

-- ─────────────────────────────────────────────────────────────
-- Coluna de zonas de FC (jsonb). Mapa zona→segundos, ex.:
--   { "z1": 120, "z2": 900, "z3": 600, "z4": 180 }
-- Null em treinos sem amostras de FC e em linhas antigas — re-sincronizar o tipo
-- (backfill) preenche o valor.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists hr_zones jsonb;

comment on column public.activities.hr_zones is
  'Tempo em zonas de FC: mapa zona→segundos (z1…z5, reserva de FC/Karvonen). Derivado das amostras de FC no mobile.';

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para incluir hr_zones (junto de best_efforts).
-- Mantém a regra: NÃO sobrescreve linhas editadas na web (locally_edited).
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts, hr_zones
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts', r->'hr_zones'
  from jsonb_array_elements(rows) as r
  on conflict (id) do update set
    activity_id   = excluded.activity_id,
    activity_name = excluded.activity_name,
    calories      = excluded.calories,
    start_at      = excluded.start_at,
    end_at        = excluded.end_at,
    duration_s    = excluded.duration_s,
    moving_time_s = excluded.moving_time_s,
    distance_m    = excluded.distance_m,
    source_name   = excluded.source_name,
    source_id     = excluded.source_id,
    device        = excluded.device,
    tracked       = excluded.tracked,
    has_route     = excluded.has_route,
    metadata      = excluded.metadata,
    best_efforts  = excluded.best_efforts,
    hr_zones      = excluded.hr_zones
  where not activities.locally_edited;   -- não toca linhas editadas na web
$$;
