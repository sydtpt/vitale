# 0033 — Série intradiária de saúde em arrays por dia, não em linha por amostra

**Status:** aceita
**Data:** 2026-09-05

## Contexto

`health_daily` guarda quatro números por (dia, métrica) — média, mínima, máxima e contagem —
e descarta as amostras. Para a frequência cardíaca isso joga fora a forma do dia. Medido na
produção em 05/09/2026:

| Fato | Medida |
|---|---|
| Amostras de FC por dia na era Garmin (ago–set/2026) | 660 na média, teto de **720** — uma a cada 2 min, a cadência com que o Garmin Connect escreve no Apple Health |
| Na era Apple Watch (mai–jul/2026) | 780 a 1.300 na média, pico de **5.700** num dia de treino |
| O que sobrevive no Supabase | 4 números por dia |
| Tamanho do banco | 79 MB, dos quais 55 MB são `activity_routes` (275 rotas, média 168 kB, maior 935 kB) |
| `health_daily` inteira | 1,4 MB em 4.400 linhas |

O usuário pediu a série no Supabase (05/09/2026), depois de perguntar se 3 minutos "seria
muito dado". Não é: a pergunta de verdade era a **forma** de guardar, porque o PostgREST corta
em 1.000 linhas sem erro ([memória do projeto](../../_bmad-output/implementation-artifacts/deferred-work.md)),
e uma linha por amostra estoura isso a cada dois dias lidos.

A série de FC de cada treino continua **não** persistida: o mobile e a edge function a leem,
calculam `hr_zones` e a descartam; o detalhe de treino vive nos streams do intervals.icu. Esta
decisão é sobre o **dia**, não sobre o intervalo.

## Decisão

**1. Uma tabela nova, `health_series`, uma linha por (usuário, dia local, métrica)**, com dois
arrays nativos paralelos: `minutes smallint[]` (minuto local do dia, 0–1439, crescente) e
`readings real[]` (leitura média daquele minuto). `tz_offset` é o deslocamento à meia-noite
local do dia e recupera o instante UTC de cada minuto.

**2. Resolução de um minuto.** Amostras no mesmo minuto viram média. É de sobra para o Garmin
(2 min) e achata de propósito o Watch em treino, cujo detalhe já vive nos streams da atividade.

**3. A linha diária de `health_daily.fc` continua calculada das amostras cruas**, não da
série — mesmo valor de antes, por construção. As duas formas saem das **mesmas amostras no
mesmo ciclo** do sync (`health-sync.ts`), o padrão "uma fonte, duas formas" do sono (ADR do
`sleep_periods`). Nunca uma segunda leitura do HealthKit.

**4. Só a FC hoje** (`SERIES_METRICS` em `packages/shared/src/health/series.ts`). A tabela é
long-format por `metric` para que stress e body battery — que só chegariam por um app Connect
IQ no Venu 4 — entrem sem migration.

**5. O núcleo é puro e mora no shared** (`bucketSeriesByMinute`, `expandSeriesDay`), testado
em `series.test.ts`; o mobile só veste a linha (`health-series-rows.ts`) e a RPC
`sync_upsert_health_series` converte os arrays JSON em arrays nativos preservando a ordem.

**6. O backfill das pesadas sobe de 60 para 200 dias**, fatiado em janelas de 30, porque a
ponte nativa devolve a janela inteira num array só. Cobre a era Garmin inteira (desde
18/07/2026) e um trecho do Watch. `AGG_VERSION` = 9.

## Alternativas rejeitadas

**Uma linha por amostra** (`user_id, at timestamptz, bpm smallint`). ~100 bytes por linha
indexada, 17 MB por ano — ainda pequeno, mas cada leitura de mais de dois dias pagina no
teto do PostgREST, e a "unidade que o sync reescreve" deixaria de ser o dia.

**Uma coluna `series jsonb` em `health_daily`.** Zero tabela nova, mas a linha de `fc` ficaria
com ~12 kB e **toda** leitura de `health_daily` — Retrospectiva, Semana, prontidão — passaria a
arrastar a série de cada dia, ou a lembrar de listar colunas. O mesmo veneno do `select('*')`
em `activity_routes` (AGENTS.md, "Known pitfalls"). Payload grande mora em tabela própria.

**Array de pares `[[minuto, bpm], …]` em jsonb.** ~30 bytes por par contra 6 nos arrays
nativos, e sem tipo: `smallint[]` recusa um minuto 1500 na constraint, jsonb aceita qualquer coisa.

**Derivar a linha diária da série** (como o sono deriva do período). Mudaria `value`, `min` e
`max` de `fc` no histórico inteiro — média de médias-por-minuto não é média de amostras, e o
mínimo do dia sobe quando o balde suaviza. A paridade com o que já está gravado valeu mais.

**Guardar a cadência de 3 minutos**, como o usuário perguntou. A fonte entrega 2; afinar
custaria uma reamostragem para economizar 1,5 MB por ano.

## Consequências

- Custo: ~4 kB por dia, ~1,5 MB por ano na cadência do Garmin; ~5 MB por ano se o Watch voltar
  ao pulso, por causa dos treinos. Um ano de FC cabe em cinco pedais longos.
- Duas datas por ano ficam imprecisas ao reexpandir: na noite em que o relógio volta uma
  hora, a hora repetida cai nos mesmos baldes e vira média, e a metade do dia depois da
  virada reexpande uma hora deslocada. Documentado na migration; nenhuma tela mostra isso hoje.
- A migration precisa ser aplicada em produção **antes** do build novo do iPhone, senão a RPC
  falha e a série fica na fila offline até o próximo ciclo.
- O bump para v9 dispara o backfill de 500 dias de **todas** as métricas, como todo bump — e as
  pesadas em 200. É o custo conhecido do mecanismo; o build antigo que lia a VFC em segundos
  já foi substituído (memória `vfc-intervals`), então o backfill não reescreve nada errado.
- Nenhuma tela lê a tabela ainda. O que a web e o mobile mostrariam com a série passa por
  proposta com mockups antes de código, como toda mudança visual.
- Reverter custa apagar uma tabela e uma constante: nada em `health_daily` mudou de forma.
