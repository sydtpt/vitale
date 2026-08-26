-- Vitale — Limiar de elevação por tipo de sinal; o cálculo passa a ser canônico
--
-- O ADR 0019 adotou o `total_elevation_gain` de strava/intervals partindo de que
-- ele era o ganho do altímetro. É falso para o intervals.icu: ele RECALCULA, e
-- infla corrida. Contra o Garmin Connect (e a Strava, que concorda com ele):
--
--   corrida 26/08 11 km    Garmin  58 m   intervals  85,5 m   (+47%)
--   corrida 21/08 21,5 km  Garmin 103 m   intervals 189   m   (+83%)
--
-- Em ciclismo o intervals acerta. A hipótese para o padrão é a oscilação
-- vertical da passada, que o barômetro no pulso capta e o Garmin filtra.
--
-- O nosso cálculo, com o limiar certo, reproduz o Garmin nas duas classes — mas
-- o limiar depende do SINAL, não do tipo de atividade:
--
--   altitude de FIT     limiar 0,7 m  → 59 vs 58 e 104 vs 103 (erro 1%);
--                                       erro mediano 5% em 11 pedaladas
--   altitude de GNSS    limiar 3,0 m  → 860 vs os 894 m que a Strava mostra
--     (CLLocation)                      no pedal de 124 km de 05/07 (erro 4%)
--
-- O discriminador é auto-descritivo: o formato FIT guarda altitude em unidades
-- de 1/5 m, então TODO valor é múltiplo de 0,2 — o que a altitude de
-- `CLLocation` (float arbitrário) nunca é. Série de amplitude ~0 fica de fora do
-- teste: fonte que grava 0 em vez de omitir passaria trivialmente.
--
-- Ver ADR 0021 (supersede a precedência do 0019). Espelha
-- `elevationGainFromPoints` (shared) e `elevationGain` (mobile) — os três andam
-- juntos (ELEVATION_GAIN_THRESHOLD_BARO_M / _GNSS_M).

set local statement_timeout = '10min';

-- ─────────────────────────────────────────────────────────────
-- Função temporária (create → backfill → drop, ADR 0006).
-- `thr_baro`/`thr_gnss` em vez de um limiar só: a escolha é por série.
--
-- Tudo em `double precision`, não `numeric`: o TypeScript é IEEE754 e o limiar
-- de 0,7 m gera centenas de eventos de histerese, então a menor diferença de
-- arredondamento numa fronteira muda a âncora e propaga. Com `numeric` esta
-- rota rendia 379,912 contra os 384,912 do TS — mesma aritmética, mesmo número.
-- ─────────────────────────────────────────────────────────────
create or replace function public._elevation_gain(
  points jsonb,
  thr_baro double precision default 0.7,
  thr_gnss double precision default 3,
  smooth_seconds double precision default 15,
  win int default 15
) returns double precision language plpgsql immutable as $$
declare
  alts double precision[];
  ts bigint[];
  prefix double precision[];
  n int;
  use_time boolean := true;
  baro boolean := true;
  lo double precision;
  hi double precision;
  threshold double precision;
  half_ms double precision := smooth_seconds * 1000 / 2;
  half int := floor(win / 2.0)::int;
  a int;
  b int;
  sm double precision;
  gain double precision := 0;
  ref double precision := null;
begin
  select array_agg(alt order by ord), array_agg(t order by ord)
    into alts, ts
  from (
    select nullif(p->>'alt', '')::double precision as alt,
           nullif(p->>'t', '')::bigint as t,
           ordinality as ord
    from jsonb_array_elements(points) with ordinality as e(p, ordinality)
    where nullif(p->>'alt', '') is not null
  ) s;
  if alts is null then return null; end if;
  n := array_length(alts, 1);

  -- Janela de tempo só com `t` em TODOS os pontos e sem clock skew.
  for i in 1..n loop
    if ts[i] is null or (i > 1 and ts[i] < ts[i - 1]) then
      use_time := false;
      exit;
    end if;
  end loop;

  -- Tipo de sinal: todo valor múltiplo de 0,2 (FIT) e série com amplitude.
  select min(x), max(x) into lo, hi from unnest(alts) as x;
  if hi - lo <= 1 then
    baro := false;
  else
    for i in 1..n loop
      if abs(alts[i] * 5 - round(alts[i] * 5)) > 1e-6 then
        baro := false;
        exit;
      end if;
    end loop;
  end if;
  threshold := case when baro then thr_baro else thr_gnss end;

  prefix := array_fill(0::double precision, array[n + 1]);
  for i in 1..n loop
    prefix[i + 1] := prefix[i] + alts[i];
  end loop;

  a := 1;
  b := 1;
  for i in 1..n loop
    if use_time then
      -- Índice fora do array devolve NULL em Postgres, o que encerra o while.
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
-- Backfill de TODAS as linhas com rota — inclusive as de provider, que o
-- backfill anterior (20260826140000) preservava por acreditar que o número
-- delas vinha do altímetro. Vinha do recálculo do intervals.
-- ─────────────────────────────────────────────────────────────
update public.activities a
set elevation_m = g.gain
from public.activity_routes r
cross join lateral (select public._elevation_gain(r.points) as gain) g
where r.activity_id = a.id
  and g.gain is not null
  and g.gain is distinct from a.elevation_m;

drop function public._elevation_gain(jsonb, double precision, double precision, double precision, int);

comment on column public.activities.elevation_m is
  'Ganho de elevação acumulado (m), calculado do track: altitude suavizada (média móvel centrada de 15 s) + histerese de 0,7 m em série de FIT ou 3 m em série de GNSS (ADR 0021). Cai no valor reportado pela fonte só quando o track não tem altitude. Null quando nem isso.';
