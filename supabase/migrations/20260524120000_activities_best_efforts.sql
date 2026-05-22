-- Vitale — Recordes (best efforts) de corrida
-- Spec: .claude/specs/sync-atividades/
-- Persiste os "best efforts" derivados do track GPS de cada corrida no mobile:
-- o menor tempo para cobrir cada distância padrão (1/5/10/20 km, meia, 30/40 km,
-- maratona), calculado por janela deslizante sobre distância×tempo dos pontos.

-- ─────────────────────────────────────────────────────────────
-- Coluna de recordes (jsonb). Mapa chave→segundos, ex.:
--   { "1000": 270, "5000": 1500, "half": 5400, "marathon": 12600 }
-- Null em corridas sem track GPS e em linhas antigas — re-sincronizar a
-- Corrida (backfill) preenche o valor. Só corridas (activity_id = 37) recebem.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists best_efforts jsonb;

comment on column public.activities.best_efforts is
  'Best efforts de corrida: mapa distância→segundos (1000/5000/10000/20000/half/30000/40000/marathon). Derivado do track GPS no mobile.';

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para incluir best_efforts.
-- Mantém a regra: NÃO sobrescreve linhas editadas na web (locally_edited).
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts'
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
    best_efforts  = excluded.best_efforts
  where not activities.locally_edited;   -- não toca linhas editadas na web
$$;
