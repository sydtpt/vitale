-- Orbe — Saúde: a SÉRIE intradiária de uma métrica, um dia por linha.
-- Spec: docs/specs/fc-serie/spec.md · data-model: docs/specs/fc-serie/data-model.md
-- Decisão: docs/decisions/0033-serie-intradiaria-em-arrays-por-dia.md
--
-- `health_daily` guarda quatro números por dia (média, mín, máx, count) e descarta
-- as amostras. Para a frequência cardíaca isso joga fora ~720 leituras por dia —
-- uma a cada 2 min, a cadência com que o Garmin Connect escreve no Apple Health —
-- que o HealthKit do iPhone tem e o Supabase não. Esta tabela guarda a FORMA do
-- dia: uma linha por (usuário, dia, métrica) com dois arrays paralelos, o minuto
-- local do dia e a leitura média daquele minuto.
--
-- Por que arrays e não uma linha por amostra: 720 linhas/dia estourariam o teto
-- implícito de 1000 linhas do PostgREST a cada dois dias lidos, e custariam ~100
-- bytes por linha indexada; `smallint[]` + `real[]` custam 6 bytes por amostra
-- (~4 kB/dia, ~1,5 MB/ano). Uma linha por dia também é a unidade que o sync já
-- reescreve ("hoje ainda mudando") e que o upsert já sabe substituir inteira.
--
-- O dia é o LOCAL do aparelho, como `health_daily.day`. `tz_offset` é o
-- deslocamento à meia-noite local desse dia, e recupera o instante UTC de cada
-- minuto: `Date.UTC(dia) − tz_offset·60 s + minuto·60 s`. No dia em que o relógio
-- volta uma hora, a hora repetida cai nos mesmos baldes e vira média — aceito.

create table if not exists public.health_series (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null,                 -- data LOCAL do dispositivo
  metric     text        not null,                 -- id de HealthMetricMeta ('fc', ...)
  tz_offset  int         not null,                 -- minutos vs UTC à meia-noite local do dia
  minutes    smallint[]  not null,                 -- minuto local do dia (0–1439), crescente
  readings   real[]      not null,                 -- leitura média do minuto, paralela a `minutes`
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, metric),
  -- Os dois arrays são UMA série: tamanhos diferentes é bug do cliente, não dado.
  constraint health_series_parallel   check (cardinality(minutes) = cardinality(readings)),
  -- Dia sem amostra não tem linha; a ausência é o dado.
  constraint health_series_nonempty   check (cardinality(minutes) > 0),
  constraint health_series_minute_rng check (0 <= all(minutes) and 1439 >= all(minutes)),
  constraint health_series_tz_range   check (tz_offset between -840 and 840)
);

comment on table public.health_series is
  'Série intradiária por (dia local, métrica): arrays paralelos minuto→leitura. A linha diária continua em health_daily.';

-- A leitura é por métrica numa janela de dias (o gráfico de um período).
create index if not exists health_series_user_metric_day_idx
  on public.health_series (user_id, metric, day desc);

-- touch updated_at (função criada em migrations anteriores; idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists health_series_touch on public.health_series;
create trigger health_series_touch
  before update on public.health_series
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.health_series enable row level security;

drop policy if exists "own health_series" on public.health_series;
create policy "own health_series" on public.health_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- RPC de upsert idempotente em lote (espelha sync_upsert_health_daily).
-- `security invoker` → roda sob a RLS do chamador.
--
-- O cliente manda os arrays como JSON; aqui viram arrays nativos preservando a
-- ordem (`with ordinality`), porque `array_agg` sem ordem explícita não promete
-- nada. Re-enviar o dia substitui os dois arrays inteiros — não há merge: a
-- série do dia é sempre a releitura completa do HealthKit, como em health_daily.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_health_series(rows jsonb)
returns void language sql security invoker as $$
  insert into public.health_series (user_id, day, metric, tz_offset, minutes, readings)
  select
    (r->>'user_id')::uuid,
    (r->>'day')::date,
    r->>'metric',
    (r->>'tz_offset')::int,
    (select array_agg(m.x::smallint order by m.ord)
       from jsonb_array_elements_text(r->'minutes') with ordinality as m(x, ord)),
    (select array_agg(v.x::real order by v.ord)
       from jsonb_array_elements_text(r->'readings') with ordinality as v(x, ord))
  from jsonb_array_elements(rows) as r
  on conflict (user_id, day, metric) do update set
    tz_offset = excluded.tz_offset,
    minutes   = excluded.minutes,
    readings  = excluded.readings;
$$;
