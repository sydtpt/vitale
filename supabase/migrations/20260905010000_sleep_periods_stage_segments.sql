-- Orbe — Sono: os intervalos por estágio, na posição em que ocorreram.
-- Spec: docs/specs/sono/spec.md CAP-7 (Opção 2) · data-model §7
--
-- `stages` guarda HORAS por estágio; a posição foi descartada na agregação, e por
-- isso o detalhe da noite mostrava estágios em proporção. A Opção 2 desenha cada
-- estágio na hora em que ocorreu — precisa dos intervalos. O agregador já os
-- fatia (prioridade DEEP → REM → CORE, AWAKE subtraído); passa a emiti-los.
--
-- `stages` continua, derivado dos segmentos — uma fonte, duas formas, a mesma
-- regra de `health_daily.sono`. O AWAKE não entra aqui: mora em `awakenings`.
alter table public.sleep_periods
  add column if not exists stage_segments jsonb;   -- [{stage:'deep'|'rem'|'core'|'unspecified', from, to}]

-- Forma, como em `awakenings`: NULL (linha anterior à coluna) ou array. Objeto
-- ou escalar aqui seria bug do cliente, não dado.
alter table public.sleep_periods
  drop constraint if exists sleep_periods_stage_segments_shape;
alter table public.sleep_periods
  add constraint sleep_periods_stage_segments_shape check (
    stage_segments is null or jsonb_typeof(stage_segments) = 'array'
  );

-- A RPC ganha a coluna. Mesmo `nullif` do `awakenings`: JSON null vira
-- 'null'::jsonb, que não é SQL NULL nem array.
create or replace function public.sync_upsert_sleep_periods(rows jsonb)
returns void language sql security invoker as $$
  insert into public.sleep_periods
    (user_id, onset_at, wake_at, in_bed_at, in_bed_end, tz_offset, wake_day,
     asleep_h, awakenings, stages, stage_segments, source)
  select
    (r->>'user_id')::uuid,
    date_trunc('minute', (r->>'onset_at')::timestamptz),
    (r->>'wake_at')::timestamptz,
    nullif(r->>'in_bed_at', '')::timestamptz,
    nullif(r->>'in_bed_end', '')::timestamptz,
    (r->>'tz_offset')::int,
    (r->>'wake_day')::date,
    (r->>'asleep_h')::numeric,
    nullif(r->'awakenings', 'null'::jsonb),
    nullif(r->'stages', 'null'::jsonb),
    nullif(r->'stage_segments', 'null'::jsonb),
    nullif(r->>'source', '')
  from jsonb_array_elements(rows) as r
  on conflict (user_id, onset_at) do update set
    wake_at        = excluded.wake_at,
    in_bed_at      = excluded.in_bed_at,
    in_bed_end     = excluded.in_bed_end,
    tz_offset      = excluded.tz_offset,
    wake_day       = excluded.wake_day,
    asleep_h       = excluded.asleep_h,
    awakenings     = excluded.awakenings,
    stages         = excluded.stages,
    stage_segments = excluded.stage_segments,
    source         = excluded.source;
$$;
