-- Vitale — Tempo em movimento das atividades
-- Spec: .claude/specs/sync-atividades/
-- Persiste o "tempo em movimento" (tempo total menos as pausas), derivado dos
-- workoutEvents do HealthKit no mobile. O `duration_s` continua sendo o tempo total.

-- ─────────────────────────────────────────────────────────────
-- Coluna de tempo em movimento (segundos). Null em linhas antigas — a UI cai
-- para `duration_s` quando ausente; re-sincronizar o tipo preenche o valor.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists moving_time_s int;

comment on column public.activities.moving_time_s is
  'Tempo em movimento (s): tempo total (duration_s) menos as pausas (workoutEvents). Base do pace/velocidade.';

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para incluir moving_time_s.
-- Mantém a regra: NÃO sobrescreve linhas editadas na web (locally_edited).
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata'
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
    metadata      = excluded.metadata
  where not activities.locally_edited;   -- não toca linhas editadas na web
$$;
