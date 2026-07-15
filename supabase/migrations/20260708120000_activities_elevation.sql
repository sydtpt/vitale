-- Vitale — Ganho de elevação por atividade
-- Spec: .claude/specs/retrospectiva/ (seção Esportes)
--
-- Persiste o ganho de elevação acumulado (m) de cada treino outdoor, derivado
-- do track GPS — espelha `elevationGain` de mobile/src/lib/workout-types.ts
-- (soma só as subidas > 1 m entre pontos consecutivos, filtrando ruído).
-- Novas linhas: calculado no sync (mobile). Linhas antigas: backfill abaixo
-- a partir de `activity_routes.points`.

-- ─────────────────────────────────────────────────────────────
-- Coluna
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists elevation_m numeric;

comment on column public.activities.elevation_m is
  'Ganho de elevação acumulado (m): soma das subidas > 1 m entre pontos consecutivos do track GPS. Null sem rota/altitude.';

-- ─────────────────────────────────────────────────────────────
-- Backfill das linhas existentes a partir das rotas persistidas.
-- Função temporária replicando elevationGain(points, threshold = 1):
--   - pontos sem `alt` são pulados (rotas antigas só têm lat/lng);
--   - `prev` atualiza a cada ponto com altitude;
--   - soma apenas deltas > threshold;
--   - retorna NULL quando nenhum ponto tem altitude (distingue "plano 0"
--     de "desconhecido").
-- ─────────────────────────────────────────────────────────────
create or replace function public._elevation_gain(points jsonb, threshold numeric default 1)
returns numeric language plpgsql immutable as $$
declare
  gain numeric := 0;
  prev numeric := null;
  alt numeric;
  has_alt boolean := false;
  p jsonb;
begin
  for p in select * from jsonb_array_elements(points) loop
    alt := nullif(p->>'alt', '')::numeric;
    if alt is null then continue; end if;
    has_alt := true;
    if prev is not null and alt - prev > threshold then
      gain := gain + (alt - prev);
    end if;
    prev := alt;
  end loop;
  return case when has_alt then gain else null end;
end $$;

update public.activities a
set elevation_m = public._elevation_gain(r.points)
from public.activity_routes r
where r.activity_id = a.id
  and a.elevation_m is null;

drop function public._elevation_gain(jsonb, numeric);

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para incluir elevation_m.
-- Base: 20260525120000_activities_field_level_edits.sql (preserva campos
-- editados via name_edited/duration_edited, sem WHERE). Únicas diferenças:
-- elevation_m no insert, no select e no update.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts, hr_zones,
    elevation_m
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts', r->'hr_zones',
    nullif(r->>'elevation_m', '')::numeric
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
$$;
