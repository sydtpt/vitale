# Data Model: Sono — período como evento, não como grandeza diária

> Esquema novo. `health_daily` **não** é alterado: ele continua com a linha
> `metric='sono'`, que passa a ser **derivada** dos períodos. Segue o padrão de
> RLS/`touch_updated_at`/RPC de upsert de
> [health_daily](../../../supabase/migrations/20260523120000_health_daily.sql).

## 1. Por que uma tabela nova

`health_daily` tem chave primária `(user_id, day, metric)`. Isso é uma **afirmação sobre o
mundo**: a grandeza pertence a um dia.

Um período de sono contradiz a afirmação de duas formas:

1. **Ele tem duas datas.** Apaga às 23h40 de terça, acorda às 07h10 de quarta. Hoje o código
   resolve com `localDayKey(iv.end)` — o dia em que acordou. É razoável para "horas
   dormidas" e inutilizável para regularidade, porque o SRI compara o estado em *t* contra
   *t+24h*: ele não conhece "dia", conhece instante.
2. **Pode haver mais de um por dia.** Raro no histórico real (12 de 308 dias, 3,9%), mas
   esses 12 são justamente as **piores noites** — fragmentos somando 0h a 2h20 — e um esquema
   de uma-linha-por-dia os colapsa em silêncio.

> **Alternativa rejeitada: guardar os instantes no `extra` jsonb de `health_daily`.** Custaria
> zero migration e o Postgres consulta `extra->>'onset_at'` sem drama. Cai no item 1 acima,
> que sozinho já basta — e o item 2 exigiria um array dentro de uma célula, que é criar uma
> tabela dentro de um campo para não criar uma tabela.

## 2. Tabela (migration nova)

Arquivo `supabase/migrations/2026MMDDHHMMSS_sleep_periods.sql`:

```sql
-- sleep_periods — um período de sono é um EVENTO com instantes, não uma grandeza diária.
-- Ver docs/specs/sono/spec.md §6 e data-model.md §1.
create table if not exists public.sleep_periods (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  onset_at    timestamptz not null,               -- primeiro instante DORMINDO
  wake_at     timestamptz not null,               -- último instante dormindo
  in_bed_at   timestamptz,                        -- início da janela INBED; NULL quando a fonte não mede
  in_bed_end  timestamptz,                        -- fim da janela INBED
  tz_offset   int         not null,               -- minutos vs UTC no onset (viagem)
  wake_day    date        not null,               -- dia LOCAL de acordar; ponte com health_daily
  asleep_h    numeric     not null,               -- horas líquidas dormindo (já descontado awake)
  awakenings  jsonb,                              -- [{from,to}] individuais; NULL quando a fonte não reporta
  stages      jsonb,                              -- {deep,rem,core,unspecified,awake} em horas
  source      text,                               -- HKSource, para diagnóstico de cobertura
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, onset_at)
);

create index if not exists sleep_periods_user_wakeday_idx
  on public.sleep_periods (user_id, wake_day desc);

drop trigger if exists sleep_periods_touch on public.sleep_periods;
create trigger sleep_periods_touch
  before update on public.sleep_periods
  for each row execute function public.touch_updated_at();

alter table public.sleep_periods enable row level security;

create policy "own sleep_periods" on public.sleep_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

| Coluna | Tipo | Uso |
|---|---|---|
| `onset_at` | `timestamptz` | **Metade da chave.** O instante que `health-buckets.ts:356` calcula e descarta hoje |
| `wake_at` | `timestamptz` | O instante que hoje é gravado duas vezes, em `start` e `end` |
| `in_bed_at` | `timestamptz` **nullable** | "Que horas eu deitei". `NULL` na era Garmin — ver §4 |
| `in_bed_end` | `timestamptz` nullable | Fecha a janela; a diferença dá o `inbed` que hoje mora no `extra` |
| `tz_offset` | `int` | Minutos vs UTC. **Sem ele, jetlag social lê uma viagem como irregularidade grave** e o usuário nunca sabe que foi o avião |
| `wake_day` | `date` | Ponte com `health_daily.day` e `daily_ratings.day` — é a chave de junção com a nota subjetiva |
| `asleep_h` | `numeric` | Líquido, já descontado o `awake`. É o que soma para `health_daily.sono` |
| `awakenings` | `jsonb` | Os intervalos **individuais**, não a soma — a soma perde quantos e quão longos. `NULL` ≠ `[]`: `NULL` é "a fonte não reporta", `[]` é "não houve" |
| `stages` | `jsonb` | Mesmo formato do `extra` de hoje, para o backfill ser uma cópia |
| `source` | `text` | Permite responder "desde quando esta fonte parou de dar X" sem uma segunda consulta |

### Identidade que sobrevive ao re-sync

A PK é `(user_id, onset_at)`. O `onset_at` é derivado das amostras do HealthKit e **é
estável entre execuções** para a mesma noite, contanto que as amostras não mudem — que é a
mesma garantia da qual `health_daily` já depende hoje.

O upsert é `on conflict (user_id, onset_at) do update`, sem condição — igual a
`sync_upsert_health_daily`. Sono não tem `locally_edited` porque não há edição manual
(spec §4).

> **Risco conhecido:** se uma re-leitura do HealthKit mover o `onset` em alguns segundos, a
> linha antiga não é sobrescrita — vira duplicata. Mitigação: **truncar `onset_at` ao minuto**
> antes de gravar. O minuto é resolução mais que suficiente para tudo que a tela mostra.

## 3. `health_daily.sono` continua — derivada

**Não é fonte paralela.** Uma grandeza em dois lugares é o padrão de reclamação nº 5 da
pesquisa ("métricas do mesmo app se contradizem"), e seria autoinfligido.

- **Onde deriva:** `packages/shared`, função pura, testada. **Não** trigger no banco — o
  precedente de trigger ([ADR 0005](../../decisions/0005-metricas-estimadas-vem-do-banco.md))
  é difícil de depurar quando erra.
- **Como:** por `wake_day`, `value = Σ asleep_h`, `count = nº de períodos`,
  `extra = Σ stages` (formato idêntico ao de hoje, para não quebrar a prontidão nem a retro).
- **Quando:** as duas escritas saem do mesmo ciclo de sync, na mesma transação lógica.

Consumidores que **não podem quebrar**: `health-readiness.ts` (`seriesFor('sono')`),
`period/retro.ts`, `week/highlights.ts`, `notifications.ts`.

## 4. Cobertura por fonte — o que o esquema não conserta

Medido em produção, 04/09/2026:

| Campo | Era Apple Watch (270 noites) | Era Garmin (42 noites) |
|---|---|---|
| `in_bed_at` **útil** | 219/270 (81%) | **1/42** |
| `stages` | 241/270 (89%) | 42/42 |
| `awakenings` **na fonte** | 233/270 (86%) | **38 de 38 medidas** |
| `awakenings` **que chegam ao banco** | 233/270 | **2 de 38** — ver §4.2 |

O Garmin escreve `INBED`, mas abrindo a janela no instante em que o sono começa: em 37 de 38
noites a latência fica abaixo de `MIN_ONSET_MS = 60_000`. A folga entre cama e sono é de
**9,5 min mediana contra 100 min** na era Apple, e cai quase toda *depois* de acordar.

**Consequência para o esquema:** `in_bed_at`/`in_bed_end` guardam a janela `INBED` **crua**
da fonte, e são `NULL` só quando não há amostra `INBED` nenhuma. A duração da janela é
grandeza real (o `extra.inbed` de hoje, 42/42 na era Garmin) e apagá-la mudaria o formato
que os consumidores leem. O que muda é a **leitura**: a tela só escreve "Deitou 22h28" quando
`bedtimeMeasured()` (`sleep/timing.ts`) diz que a latência passa de 60 s; abaixo disso,
"Deitou --:--". O instante degenerado fica no banco como janela, nunca como hora de deitar.

> *Correção:* uma versão anterior mandava gravar `NULL` no caso degenerado. Isso teria
> apagado o `inbed` de 42 noites que hoje existem, para resolver um problema que é de
> exibição — e a regra de exibição já mora no núcleo.

## 4.2 O `AWAKE` descartado — pré-requisito de CAP-5

Medido no aparelho em 04/09/2026, últimos 60 dias: **38 noites têm amostra `AWAKE` no
HealthKit e 36 delas são creditadas como zero.**

`aggregateSleepNights` só conta vigília que se **sobrepõe** a um intervalo dormindo:

```ts
const awakeMs = overlapMs(iv, awake);   // iv ∈ asleep
...
if (awakeMs > 0) cur.stages.awake = ...
```

Isso é correto para fonte que escreve **camadas que se cobrem** — o Apple Watch escreve um
envelope junto dos estágios, e o `AWAKE` cai dentro dele. É uma armadilha para fonte que
escreve **segmentos encostados**, `CORE·AWAKE·CORE`: o `AWAKE` preenche o vão *entre* os
intervalos de sono em vez de cair *dentro* deles, a sobreposição dá zero, e a vigília some
enquanto a noite passa como registrada com sucesso.

**A correção é aditiva e não mexe no `value`.** Cada intervalo dormindo já é sono puro, então
`net` por intervalo continua certo — o que falta é creditar, uma vez por noite, o `AWAKE`
que cai no vão de `[onset, wake]`. Para a era Apple o resultado é idêntico ao de hoje (o
`AWAKE` sobreposto também está dentro do vão); para a era Garmin, a vigília deixa de sumir.

Prova aritmética independente, sem depender do aparelho: no Garmin a janela `INBED` começa
junto com o sono, então `inbed − dormido` **é** a vigília. Cinco noites conferidas ao minuto
contra o HealthKit (04/09: 23 · 03/09: 27 · 02/09: 1 · 01/09: 33 · 31/08: 12). Na era Apple
os dois **não** batem — diferença média de 67 min —, porque lá o `INBED` começa antes do sono
e a folga inclui a latência.

O que o backfill recupera na era Garmin: 42 noites, vigília mediana **12 min**, média 16,1,
máximo **1h43**, 9 noites acima de meia hora. Quatro noites têm folga **negativa** — anomalia
a investigar quando o agregador for tocado.

**Consequência para CAP-2 e CAP-5:** com a correção, os buracos das barras e o relógio de
vigília nascem vivos no dado atual. Sem ela, o gráfico continua correto — barra contínua é a
verdade disponível — mas a feature só brilharia no histórico Apple.

## 4.1 `awakenings` — o formato, e por que não são linhas

```jsonc
// Uma noite com dois despertares dentro de um único período de sono.
"awakenings": [
  { "from": "2026-07-02T01:12:00Z", "to": "2026-07-02T01:41:00Z" },
  { "from": "2026-07-02T04:03:00Z", "to": "2026-07-02T04:09:00Z" }
]
```

**Três estados, e eles são distintos:**

| Valor | Significa |
|---|---|
| `null` | A fonte **não reporta** vigília. É o caso do Garmin — 0 de 42 noites |
| `[]` | A fonte reporta e **não houve** despertar |
| `[…]` | Os intervalos, individualmente |

Confundir `null` com `[]` faria a tela afirmar "você dormiu direto" quando a verdade é "não
sei". A distinção é carregada até a UI: `null` some com a leitura, `[]` a mostra vazia.

**Por que dentro da linha e não em `sleep_periods` separadas.** Medido: 258 de 270 noites da
era Apple são **um único período**, e ainda assim 43% delas têm mais de uma hora acordado. A
vigília é buraco **dentro** de um período, não quebra em vários. Modelar como linhas
separadas duplicaria estágios e cama por fragmento e destruiria a noção de "a noite".

**Nunca somar e guardar.** O `extra.awake` de hoje é a soma em horas, e a soma perde
**quantos** e **quão longos** — que é a informação inteira de CAP-5. A soma continua sendo
derivada para `health_daily`, mas nunca substitui os intervalos.

### Derivações de vigília (núcleo puro, não persistidas)

| Leitura | Cálculo | Nota |
|---|---|---|
| Buracos na barra (CAP-2, CAP-4) | posição relativa de cada intervalo dentro de `onset_at → wake_at` | direto |
| Relógio de vigília (CAP-5.2) | histograma de densidade dos intervalos projetados num eixo de 24 h, sobre a janela | bin de 15 min |
| Acordado por noite (CAP-5.3) | `Σ (to − from)` por período | é o `extra.awake` de hoje |
| WASO clínico | idem, excluindo vigília antes do primeiro sono | **não usar** sem revisar a definição contra a literatura |

**Proibido derivar:** índice de fragmentação, score, penalidade, ou qualquer composto. O
dado do usuário mostra a relação vigília × nota subjetiva correndo **ao contrário** do que
qualquer score assumiria (spec §6) — pontuar isso seria construir, com lastro medido, o
defeito nº 1 da categoria.

## 5. Backfill

`BACKFILL_DAYS = 500` + bump de `AGG_VERSION` (5 → 6) em
`mobile/src/services/health-sync.ts`. O backfill relê o HealthKit e reescreve **as duas**
tabelas, então `sleep_periods` nasce com ~500 noites e o gráfico de CAP-2 abre cheio no
primeiro run — não com uma barra.

O caminho já foi provado duas vezes neste aparelho: `AGG_VERSION` 3 recuperou os estágios do
histórico e o 4 recuperou cama e latência.

> Migration aplicada em produção precisa ser registrada em
> `supabase_migrations.schema_migrations` ([ADR 0011](../../decisions/0011-schema-mora-em-migrations.md)),
> senão um `db push` futuro a re-executa. Confirmar com `supabase/scripts/check-schema-drift.sh`.

## 6. Derivações do núcleo (sem tabela)

Calculadas sob demanda no `packages/shared`, nunca persistidas:

| Métrica | Definição | Exige |
|---|---|---|
| Midpoint | ponto médio entre `onset_at` e `wake_at` | período |
| SRI | % de probabilidade de estar no mesmo estado (dormindo/acordado) em *t* e *t+24h*, promediada; escala −100 a +100 | série por época, montada dos períodos |
| Jetlag social | `MSF` = midpoint em dias livres; `MSFsc = MSF − (SD_livre − SD_semana)/2`; `SJL = |MSF − MSW|` | período + `tz_offset` |
| Eficiência | `asleep_h ÷ (in_bed_end − in_bed_at)` | `in_bed_at` não nulo |
| Latência | `onset_at − in_bed_at` | idem — **gravada, nunca exibida como número** (spec §5) |

> **Ressalva herdada da pesquisa:** a definição operacional do SRI vem de Phillips et al.
> 2017, que **não foi lido** (paywall). A fonte secundária confirma a escala mas não
> reproduz a fórmula. **Conferir no original antes de o SRI virar número exibido** — o que,
> pelo princípio da spec (§2), não está previsto para o V1.
