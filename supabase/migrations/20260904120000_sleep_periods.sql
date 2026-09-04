-- Orbe — Sono: o período é um EVENTO com instantes, não uma grandeza diária.
-- Spec: docs/specs/sono/spec.md · data-model: docs/specs/sono/data-model.md
--
-- `health_daily` tem chave (user_id, day, metric) — uma afirmação de que a
-- grandeza pertence a um dia. Um período de sono tem DUAS datas (apaga terça,
-- acorda quarta), e sem hora do dia regularidade, jetlag social, midpoint e
-- cronotipo são incalculáveis. É exatamente a hora que o usuário pede ao acordar,
-- e que `aggregateSleepNights` calculava e descartava.
--
-- `health_daily.sono` NÃO morre: passa a ser DERIVADA destes períodos no cliente
-- (packages/shared/src/sleep/derive.ts), escrita no mesmo ciclo de sync. Uma
-- fonte, duas formas — prontidão, retrospectiva e destaques leem a linha diária e
-- não podem quebrar. A alternativa de guardar os instantes no `extra` jsonb foi
-- rejeitada: cai no problema das duas datas, e dois períodos no mesmo dia
-- exigiriam uma tabela dentro de uma célula.

-- ─────────────────────────────────────────────────────────────
-- sleep_periods
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sleep_periods (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  onset_at    timestamptz not null,               -- primeiro instante DORMINDO (truncado ao minuto — ver RPC)
  wake_at     timestamptz not null,               -- último instante dormindo
  in_bed_at   timestamptz,                        -- janela INBED crua da fonte; NULL = não há amostra INBED
  in_bed_end  timestamptz,
  tz_offset   int         not null,               -- minutos vs UTC no onset — sem isso viagem lê como irregularidade
  wake_day    date        not null,               -- dia LOCAL de acordar: ponte com health_daily e daily_ratings
  asleep_h    numeric     not null,               -- horas líquidas dormindo (vigília já descontada)
  awakenings  jsonb,                              -- [{from,to}] individuais; NULL = fonte não reporta, [] = não houve
  stages      jsonb,                              -- {deep,rem,core,unspecified,awake} em horas
  source      text,                               -- HKSource — diagnóstico de cobertura por fonte
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, onset_at),
  constraint sleep_periods_wake_after_onset check (wake_at > onset_at),
  constraint sleep_periods_asleep_nonneg    check (asleep_h >= 0),
  constraint sleep_periods_tz_range         check (tz_offset between -840 and 840),
  -- A janela na cama vem inteira ou não vem: meia janela não tem leitura.
  constraint sleep_periods_bed_window       check (
    (in_bed_at is null and in_bed_end is null)
    or (in_bed_at is not null and in_bed_end is not null and in_bed_end > in_bed_at)
  ),
  -- Os três estados de vigília dependem da FORMA: NULL ≠ [] ≠ [...]. Um objeto
  -- ou um escalar aqui seria bug do cliente, não dado.
  constraint sleep_periods_awakenings_shape check (
    awakenings is null or jsonb_typeof(awakenings) = 'array'
  ),
  constraint sleep_periods_stages_shape     check (
    stages is null or jsonb_typeof(stages) = 'object'
  )
);

-- A tela lê por dia de acordar (janela rolante), a nota subjetiva junta por
-- `wake_day`, e o backfill reescreve por intervalo de dias.
create index if not exists sleep_periods_user_wakeday_idx
  on public.sleep_periods (user_id, wake_day desc);

-- touch updated_at (função criada em migrations anteriores; idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists sleep_periods_touch on public.sleep_periods;
create trigger sleep_periods_touch
  before update on public.sleep_periods
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security: cada usuário só acessa as próprias linhas
-- ─────────────────────────────────────────────────────────────
alter table public.sleep_periods enable row level security;

drop policy if exists "own sleep_periods" on public.sleep_periods;
create policy "own sleep_periods" on public.sleep_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- RPC de upsert idempotente em lote (espelha sync_upsert_health_daily).
-- `security invoker` → roda sob a RLS do chamador.
--
-- Identidade que sobrevive ao re-sync: (user_id, onset_at) com `onset_at`
-- TRUNCADO AO MINUTO aqui, no servidor, e não no cliente — assim a garantia não
-- depende da versão do app. Uma releitura do HealthKit que mova o onset em
-- segundos cai na mesma linha; o minuto é resolução de sobra para tudo que a
-- tela mostra. Risco residual: um deslocamento que cruze a fronteira do minuto
-- ainda duplica — aceito, e o diagnóstico de sono o pegaria.
--
-- `r->'awakenings'` de um JSON null devolve 'null'::jsonb, que NÃO é SQL NULL
-- e não é array — quebraria os três estados. O `nullif` converte. Chave ausente
-- já vem como SQL NULL.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_sleep_periods(rows jsonb)
returns void language sql security invoker as $$
  insert into public.sleep_periods
    (user_id, onset_at, wake_at, in_bed_at, in_bed_end, tz_offset, wake_day,
     asleep_h, awakenings, stages, source)
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
    nullif(r->>'source', '')
  from jsonb_array_elements(rows) as r
  on conflict (user_id, onset_at) do update set
    wake_at    = excluded.wake_at,
    in_bed_at  = excluded.in_bed_at,
    in_bed_end = excluded.in_bed_end,
    tz_offset  = excluded.tz_offset,
    wake_day   = excluded.wake_day,
    asleep_h   = excluded.asleep_h,
    awakenings = excluded.awakenings,
    stages     = excluded.stages,
    source     = excluded.source;
$$;
