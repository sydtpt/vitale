-- Vitale — Elevação: valor reportado vence o calculado; janela de suavização em tempo
--
-- Dois defeitos, uma migration (ADR 0019):
--
-- 1) A janela da média móvel era contada em AMOSTRAS (15). Os tracks vão de
--    1 Hz (Apple Watch) a 1 ponto/5 s (ponte Strava→HealthKit) e a 1 ponto/25 s
--    em rotas antigas — as mesmas "15 amostras" suavizavam 15 s num caso e 375 s
--    no outro, e o track esparso perdia todo o relevo. Agora a janela é de 15 s
--    de tempo real, com fallback para 15 amostras em rota sem `t` (≈15 s a 1 Hz,
--    o que preserva o valor das rotas antigas do Apple Watch).
--
-- 2) `sync_upsert_activities` sobrescrevia `elevation_m` a cada sync do mobile,
--    inclusive em linhas cujo valor veio medido pelo altímetro da fonte
--    (`total_elevation_gain` de strava/intervals). O cálculo sobre o track é
--    ESTIMATIVA de fallback: sobre altitude de GNSS ele fica ~40% abaixo do
--    barômetro. Agora o valor reportado é preservado.
--
-- Espelha `elevationGainFromPoints` (shared) e `elevationGain` (mobile) —
-- mantenha os três em sincronia (ELEVATION_SMOOTH_SECONDS /
-- ELEVATION_SMOOTH_WINDOW / ELEVATION_GAIN_THRESHOLD_M).

-- O UPDATE percorre ~170 rotas (algumas com 26 mil pontos) e passa dos 8 s do
-- role `authenticated` — ADR 0006.
set local statement_timeout = '10min';

-- ─────────────────────────────────────────────────────────────
-- Função temporária replicando o algoritmo novo (create → backfill → drop).
-- Retorna NULL quando nenhum ponto tem altitude (distingue "plano 0" de
-- "desconhecido").
-- ─────────────────────────────────────────────────────────────
create or replace function public._elevation_gain(
  points jsonb,
  threshold numeric default 3,
  smooth_seconds numeric default 15,
  win int default 15
) returns numeric language plpgsql immutable as $$
declare
  alts numeric[];
  ts bigint[];
  prefix numeric[];
  n int;
  use_time boolean := true;
  half_ms numeric := smooth_seconds * 1000 / 2;
  half int := floor(win / 2.0)::int;
  a int;
  b int;
  sm numeric;
  gain numeric := 0;
  ref numeric := null;
begin
  select array_agg(alt order by ord), array_agg(t order by ord)
    into alts, ts
  from (
    select nullif(p->>'alt', '')::numeric as alt,
           nullif(p->>'t', '')::bigint as t,
           ordinality as ord
    from jsonb_array_elements(points) with ordinality as e(p, ordinality)
    where nullif(p->>'alt', '') is not null
  ) s;
  if alts is null then return null; end if;
  n := array_length(alts, 1);

  -- Janela de tempo só com `t` em TODOS os pontos e sem clock skew; um track
  -- meio-a-meio daria janelas incoerentes entre os trechos.
  for i in 1..n loop
    if ts[i] is null or (i > 1 and ts[i] < ts[i - 1]) then
      use_time := false;
      exit;
    end if;
  end loop;

  prefix := array_fill(0::numeric, array[n + 1]);
  for i in 1..n loop
    prefix[i + 1] := prefix[i] + alts[i];
  end loop;

  a := 1;
  b := 1;
  for i in 1..n loop
    if use_time then
      -- Dois ponteiros monotônicos: ts[] é não-decrescente. Índice fora do
      -- array devolve NULL em Postgres, o que encerra o while sozinho.
      while ts[a] < ts[i] - half_ms loop a := a + 1; end loop;
      if b < i then b := i; end if;
      while ts[b + 1] <= ts[i] + half_ms loop b := b + 1; end loop;
    else
      a := greatest(1, i - half);
      b := least(n, i + half);
    end if;
    sm := (prefix[b + 1] - prefix[a]) / (b - a + 1);
    if ref is null then
      ref := sm;
    elsif sm - ref > threshold then
      gain := gain + (sm - ref);
      ref := sm;
    elsif ref - sm > threshold then
      ref := sm;
    end if;
  end loop;
  return gain;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Backfill. Só as linhas que o app calcula: as que têm provider em
-- `external_ids` carregam o ganho medido pelo altímetro (Garmin via
-- strava/intervals) e não devem ser recalculadas.
-- ─────────────────────────────────────────────────────────────
update public.activities a
set elevation_m = g.gain
from public.activity_routes r
cross join lateral (select public._elevation_gain(r.points) as gain) g
where r.activity_id = a.id
  and not coalesce(a.external_ids ?| array['strava', 'intervals'], false)
  and g.gain is not null
  and g.gain is distinct from a.elevation_m;

drop function public._elevation_gain(jsonb, numeric, numeric, int);

comment on column public.activities.elevation_m is
  'Ganho de elevação acumulado (m). Preferencialmente o valor reportado pela fonte (altímetro); sem ele, calculado do track GPS: altitude suavizada (média móvel centrada de 15 s) + histerese de 3 m. Null sem rota/altitude.';

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada para preservar a elevação reportada.
-- Base: a definição vigente (20260730120000_activities_estimated_metrics.sql).
-- Única diferença: o CASE em elevation_m.
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
    -- Elevação medida pelo altímetro da fonte vence a estimativa do track
    -- (ADR 0019). Sem valor guardado, o cálculo do mobile entra normalmente.
    elevation_m   = case
                      when coalesce(activities.external_ids ?| array['strava', 'intervals'], false)
                       and activities.elevation_m is not null
                      then activities.elevation_m
                      else excluded.elevation_m
                    end;
  -- Sem WHERE: linhas editadas são atualizadas, exceto seus campos preservados.
  -- provider/external_id/external_ids ficam como estão (merge é do ingest).
$$;
