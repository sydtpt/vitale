# Data Model: FC ao longo do dia — `health_series`

> Tabela nova. `health_daily` **não** é alterado: a linha `metric='fc'` continua calculada das
> amostras cruas, com os mesmos valores. Segue o padrão de RLS / `touch_updated_at` / RPC de
> upsert de [health_daily](../../../supabase/migrations/20260523120000_health_daily.sql) e
> [sleep_periods](../../../supabase/migrations/20260904120000_sleep_periods.sql).
> Decisão e alternativas: [ADR 0033](../../decisions/0033-serie-intradiaria-em-arrays-por-dia.md).

## 1. Tabela

Arquivo [`20260905120000_health_series.sql`](../../../supabase/migrations/20260905120000_health_series.sql).

```sql
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
  constraint health_series_parallel   check (cardinality(minutes) = cardinality(readings)),
  constraint health_series_nonempty   check (cardinality(minutes) > 0),
  constraint health_series_minute_rng check (0 <= all(minutes) and 1439 >= all(minutes)),
  constraint health_series_tz_range   check (tz_offset between -840 and 840)
);
create index if not exists health_series_user_metric_day_idx
  on public.health_series (user_id, metric, day desc);
```

| Coluna | Tipo | Uso |
|---|---|---|
| `day` | `date` | **Metade da chave.** Dia LOCAL, o mesmo de `health_daily.day` — é a junção com a linha diária e com `daily_ratings` |
| `metric` | `text` | Id do catálogo (`fc` hoje). Long-format para stress/body battery entrarem sem migration |
| `tz_offset` | `int` | Deslocamento à **meia-noite local** do dia, fixo por dia. Recupera o UTC de cada minuto (§3) |
| `minutes` | `smallint[]` | Minuto local do dia, crescente, sem repetição. Minuto sem amostra não aparece — a ausência é o dado |
| `readings` | `real[]` | Leitura média do minuto, paralela a `minutes`. `real` para uma métrica futura com decimais; a FC é inteira |

Constraints: os dois arrays têm o mesmo tamanho (`parallel`), a linha nunca é vazia
(`nonempty`) e todo minuto está em 0–1439 (`minute_rng`). Ordem crescente e ausência de
repetição são garantidas pelo núcleo (`bucketSeriesByMinute`), cobradas por teste — não há
como expressá-las numa `CHECK` sem função.

## 2. Identidade e upsert

PK `(user_id, day, metric)`. O upsert é `on conflict do update` sem condição, como em
`health_daily`: reenviar o dia **substitui os dois arrays inteiros**. Não há merge, porque a
série do dia é sempre a releitura completa do HealthKit — o mesmo motivo pelo qual "hoje ainda
mudando" já funciona na diária.

```sql
create or replace function public.sync_upsert_health_series(rows jsonb)
returns void language sql security invoker as $$
  insert into public.health_series (user_id, day, metric, tz_offset, minutes, readings)
  select
    (r->>'user_id')::uuid, (r->>'day')::date, r->>'metric', (r->>'tz_offset')::int,
    (select array_agg(m.x::smallint order by m.ord)
       from jsonb_array_elements_text(r->'minutes') with ordinality as m(x, ord)),
    (select array_agg(v.x::real order by v.ord)
       from jsonb_array_elements_text(r->'readings') with ordinality as v(x, ord))
  from jsonb_array_elements(rows) as r
  on conflict (user_id, day, metric) do update set
    tz_offset = excluded.tz_offset, minutes = excluded.minutes, readings = excluded.readings;
$$;
```

`with ordinality` + `order by` porque `array_agg` sem ordem explícita não promete preservar a
ordem do JSON. `security invoker`: roda sob a RLS do chamador.

## 3. Do minuto ao instante

`atMs = Date.UTC(ano, mês, dia) − tz_offset · 60 000 + minuto · 60 000`

Implementado em `expandSeriesDay` (`packages/shared/src/health/series.ts`). O `tz_offset` é o
da meia-noite local — por isso, no dia em que o relógio volta uma hora, a metade do dia depois
da virada reexpande uma hora deslocada, e a hora repetida cai nos mesmos baldes (média). Duas
datas por ano; aceito.

## 4. Tamanho

| Cenário | Por dia | Por ano |
|---|---|---|
| Garmin Connect (2 min, ≤ 720 pontos) | ~4 kB | ~1,5 MB |
| Apple Watch (1 por minuto após o balde, ≤ 1.440) | ~9 kB | ~3 MB |

Referência: `activity_routes` tem 55 MB em 275 rotas (média 168 kB). Um ano de FC é o peso de
cinco pedais longos.

## 5. Leitura

`fetchHealthSeries(db, userId, metric, from, to)` em `packages/shared/src/data/health-series.ts`:
colunas explícitas (`day,metric,tz_offset,minutes,readings`), paginado por `fetchAllPages`,
ordenado por `day`. Os arrays nativos chegam como arrays JSON pelo PostgREST; `toHealthSeriesDay`
converte para `HealthSeriesDay` (`models/index.ts`).

## 6. Fluxo de escrita (mobile)

```
HealthKit (fc, cru, blocos de 30 dias)
   └─ samples ──► toHealthDailyRows ──► health_daily.fc (média/mín/máx/count)   ← inalterado
              └─► bucketSeriesByMinute ──► toHealthSeriesRows ──► health_series  ← novo
```

Mesmas amostras, mesmo ciclo, cursor único. Falha de qualquer das três escritas (diária, sono,
série) segura o cursor e enfileira o que faltou.
