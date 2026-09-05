# FC ao longo do dia — a série intradiária no Supabase

> **Status:** núcleo e sync construídos (05/09/2026); migration gerada e **não aplicada**;
> nenhuma tela lê a série ainda. Decisão: [ADR 0033](../../decisions/0033-serie-intradiaria-em-arrays-por-dia.md).
> Data-model: [data-model.md](data-model.md). Tarefas: [tasks](../../../_bmad-output/implementation-artifacts/fc-serie/tasks.md).

## 1. Problema

O usuário perguntou (05/09/2026): *"eu não tenho o batimento cardíaco por tempo, várias vezes
por dia?"* Não tinha. O HealthKit do iPhone recebe a FC do Garmin Connect a cada 2 minutos —
até 720 leituras por dia — e o sync do mobile as resume em média, mínima, máxima e contagem
antes de subir. No Supabase, e portanto na web e em qualquer análise fora do aparelho, o dia
inteiro são quatro números.

| Onde | O que tem hoje |
|---|---|
| HealthKit (iPhone) | a série de 2 em 2 min desde que o Venu 4 entrou (18/07/2026); antes, o Watch a cada poucos segundos |
| `health_daily.fc` | média/mín/máx/count por dia, desde 26/02/2026 (o teto de 60 dias do backfill nunca alcançou antes) |
| Aba Saúde do mobile | desenha a curva do dia lendo o HealthKit direto — só no iPhone |
| Web | um ponto por dia |

## 2. O que esta rodada entrega — e o que não

**Entrega:** a série de cada dia gravada no Supabase, na cadência da fonte, com histórico
retroativo de 200 dias; um núcleo puro para produzi-la e reexpandi-la; a leitura pronta para
web e mobile.

**Não entrega, de propósito:** tela. O que a web (detalhe de FC na Saúde) e o mobile (aba Saúde
lendo o Supabase em vez do HealthKit) mostrariam com a série é mudança visual e passa por
proposta com mockups e dados reais antes de código — regra do projeto desde 04/09/2026.

Também **não** persiste a FC segundo a segundo dos treinos: isso é o intervalo, não o dia, e
continua vivendo nos streams do intervals.icu.

## 3. Comportamento do sync

O ciclo de `syncHealth` (mobile, `services/health-sync.ts`) continua um só. Para as métricas
pesadas (`fc`):

1. A janela é fatiada em blocos de 30 dias e as amostras cruas são lidas do HealthKit bloco a
   bloco (`fetchInChunks`) — a ponte nativa devolve cada janela num array só.
2. As **mesmas** amostras produzem a linha diária (`toHealthDailyRows`, inalterada) **e** a
   série (`bucketSeriesByMinute` → `toHealthSeriesRows`). Uma fonte, duas formas, um ciclo.
3. A série sobe pela RPC `sync_upsert_health_series`, em lotes de 50 linhas; falha vai para a
   fila offline com a chave `(usuário, dia, métrica)`, então reenviar o dia substitui, não acumula.
4. O cursor só avança quando diária, sono e série subiram inteiros.

**Janelas.** Incremental: 14 dias, como tudo. Backfill (primeiro sync ou bump de versão): 200
dias para as pesadas, 500 para o resto. `AGG_VERSION` sobe para 9 — o bump dispara o backfill
em todo aparelho, sem intervenção.

**Resolução.** Um minuto local. Amostras no mesmo minuto viram média inteira. Minuto sem
amostra não aparece nos arrays: a ausência é o dado (o Garmin deixa minutos alternados vazios).

## 4. Retroativo

Sim. O HealthKit não apaga histórico: as amostras de FC estão no iPhone desde antes do Watch
ser trocado, e a linha `fcRepouso` diária existe desde março de 2025. O backfill desta rodada
pega **200 dias** — a era Garmin inteira e um trecho da era Watch — porque a leitura crua de um
ano (~1.300 amostras/dia no Watch) é cara demais para um ciclo de sync em background.

Para ir mais fundo: subir `HEAVY_MAX_DAYS` num build futuro, ou chamar `syncHealth(dias)` à mão
a partir de Configurações → Dados. Mesma chave, mesmas linhas — só acrescenta dias.

## 5. Leitura

- `fetchHealthSeries(db, userId, metric, from, to)` em `packages/shared/src/data/health-series.ts`
  — colunas explícitas, paginado, ordenado por dia.
- `expandSeriesDay(day)` devolve `{ atMs, value }[]` no UTC de cada minuto, pela regra
  `Date.UTC(dia) − tz_offset·60 s + minuto·60 s`. É o que um gráfico consome.
- Quem só quer "que horas" lê `minutes` direto: 0–1439, local.

## 6. Depois desta rodada

1. **Aplicar a migration** em produção (manual, com confirmação — política do AGENTS.md) e
   rebuildar o iPhone. A ordem importa: a RPC precisa existir antes do build.
2. Conferir no banco: ~50 linhas de `fc` na era Garmin com 300–720 minutos cada; `count` de
   `health_daily.fc` inalterado nos dias já gravados.
3. **Proposta visual** — web e mobile — com os dados reais da tabela, seletor de temas, e as
   decisões para vetar. Só então código de tela.
4. Candidatas a entrar na mesma tabela sem migration: stress e body battery intradiários, que
   só chegariam por um app Connect IQ no Venu 4 (avaliado em 05/09/2026).

## 7. Riscos e limites conhecidos

- **Horário de verão:** na noite em que o relógio volta uma hora, a hora repetida cai nos mesmos
  baldes; a metade do dia depois da virada reexpande uma hora deslocada. Duas datas por ano,
  sem tela que mostre hoje.
- **Build antigo com migration nova:** inofensivo — o build antigo não chama a RPC.
  **Build novo sem migration:** a série fica na fila offline até a RPC existir; o cursor não
  avança e o ciclo repete o backfill a cada execução até subir. Por isso a ordem do §6.
- **Ponte nativa:** 200 dias da era Watch são ~260 mil amostras em 7 idas; não foi medido no
  aparelho. Se o ciclo em background estourar tempo, o fatiamento em 30 dias é o botão a apertar.
