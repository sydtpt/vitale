-- Vitale — Ganho de elevação: suavização + limiar 3 m
--
-- A histerese de 1 m sobre o dado bruto (migration 20260715120000) corrigiu a
-- subestimativa do algoritmo antigo, mas superestima em ~2× com altímetro a
-- 1 Hz: o jitter de ±1–2 m por segundo passa do limiar e acumula como subida
-- (ex.: pedalada de 124 km em Bruxelas gravada com 1.840 m quando o terreno
-- real, validado contra o EU-DEM 25 m, tem ~800 m).
--
-- Correção: média móvel centrada de 15 amostras (≈15 s a 1 Hz) sobre a
-- altitude ANTES da histerese, e limiar de 3 m. Espelha
-- `elevationGainFromPoints` (shared) e `elevationGain` (mobile) — mantenha os
-- três em sincronia (ELEVATION_SMOOTH_WINDOW / ELEVATION_GAIN_THRESHOLD_M).

-- ─────────────────────────────────────────────────────────────
-- Função temporária replicando o algoritmo novo.
-- Retorna NULL quando nenhum ponto tem altitude (distingue "plano 0"
-- de "desconhecido").
-- ─────────────────────────────────────────────────────────────
create or replace function public._elevation_gain(
  points jsonb,
  threshold numeric default 3,
  win int default 15
) returns numeric language plpgsql immutable as $$
declare
  alts numeric[];
  prefix numeric[];
  n int;
  half int := floor(win / 2.0)::int;
  a int;
  b int;
  sm numeric;
  gain numeric := 0;
  ref numeric := null;
begin
  select array_agg(alt order by ord) into alts
  from (
    select nullif(p->>'alt', '')::numeric as alt, ordinality as ord
    from jsonb_array_elements(points) with ordinality as t(p, ordinality)
    where nullif(p->>'alt', '') is not null
  ) s;
  if alts is null then return null; end if;

  n := array_length(alts, 1);
  prefix := array_fill(0::numeric, array[n + 1]);
  for i in 1..n loop
    prefix[i + 1] := prefix[i] + alts[i];
  end loop;

  for i in 1..n loop
    -- Média móvel centrada, janela encolhe nas bordas.
    if win <= 1 then
      sm := alts[i];
    else
      a := greatest(1, i - half);
      b := least(n, i + half);
      sm := (prefix[b + 1] - prefix[a]) / (b - a + 1);
    end if;
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

-- Recalcula as linhas do HealthKit com rota com altitude. Não toca:
--  · linhas sem rota/altitude (elevation herdada de merge — g.gain null);
--  · linhas de providers (strava/intervals reportam total_elevation_gain
--    próprio, que o ingest prefere ao cálculo do track).
update public.activities a
set elevation_m = g.gain
from public.activity_routes r
cross join lateral (select public._elevation_gain(r.points) as gain) g
where r.activity_id = a.id
  and a.provider = 'healthkit'
  and g.gain is not null;

drop function public._elevation_gain(jsonb, numeric, int);

comment on column public.activities.elevation_m is
  'Ganho de elevação acumulado (m) do track GPS: altitude suavizada (média móvel centrada de 15 amostras) + histerese de 3 m. Null sem rota/altitude.';
