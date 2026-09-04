# Plano: Sono

> Espelha a arquitetura de Registros e Histórico de Treinos: shared (modelos + puros) →
> Supabase (tabela + RLS + RPC) → sync → store por plataforma → UI. **Mobile entrega
> primeiro**; a web segue no mesmo contrato de núcleo, numa segunda rodada.

## Ordem, e por que ela é essa

A migration vem **antes** da tela, não depois. As peças que o usuário pediu — os relógios e o
timing chart — dependem de instantes que o banco não tem, e entregar primeiro as peças que já
rodam (nota × medição, estágio) seria entregar a segunda melhor tela primeiro. Uma entrega só.

```
1. Núcleo (modelos + puros)     ── sem dependência
2. Migration + RPC              ── aplicar em prod com confirmação explícita
3. Sync (grava períodos)        ── bump AGG_VERSION → backfill de 500 dias
4. Núcleo (derivações)          ── já com dado real para testar
5. Tela mobile                  ── quatro peças + o relógio de vigília
6. Web                          ── segunda rodada, mesmo núcleo
```

## Camadas

### Shared (`packages/shared`)

**`models/index.ts`** — `SleepPeriod`, `Awakening`. Somente leitura, sem lógica
(convenção do workspace).

**`sleep/derive.ts`** — derivação de `health_daily.sono` a partir dos períodos. É a função
que garante que a linha diária e os períodos **nunca divergem**; roda no cliente, não em
trigger no banco ([ADR 0005](../../decisions/0005-metricas-estimadas-vem-do-banco.md) é o
precedente que se evita repetir).

**`sleep/timing.ts`** — puros de posicionamento: midpoint, projeção de um período no eixo de
hora do dia, buracos de vigília em coordenada relativa. É o que o timing chart e o card da
noite consomem, e é o que a web vai reusar sem reescrever.

**`sleep/awakenings.ts`** — o relógio de vigília: histograma de densidade em bins de 15 min
sobre a janela. Distingue `null` (fonte não reporta) de `[]` (não houve) até a saída — a UI
recebe o estado, não um zero ambíguo.

**`sleep/regularity.ts`** — SRI, jetlag social (MSF/MSFsc/SJL) com `tz_offset`. **Não é V1
de exibição** (spec §2: regularidade aparece como forma, não como índice), mas mora no núcleo
desde já porque é o que dá sentido ao `tz_offset` na migration.

> Antes de o SRI virar número exibido, conferir a fórmula em Phillips et al. 2017 — a
> definição operacional usada na pesquisa veio de fonte secundária que não a reproduz.

**`data/sleep.ts`** — fetch paginado (`range`+`order`), como `data/registros.ts`. O
PostgREST corta em 1000 linhas sem erro; 500 noites cabem, mas o padrão do repo é paginar.

### Supabase

`supabase/migrations/2026MMDDHHMMSS_sleep_periods.sql` — tabela, índice, trigger, RLS e
`sync_upsert_sleep_periods(rows jsonb)` espelhando `sync_upsert_health_daily`. Detalhes em
[data-model.md](./data-model.md).

Aplicação em produção exige confirmação explícita e registro em
`supabase_migrations.schema_migrations` ([ADR 0011](../../decisions/0011-schema-mora-em-migrations.md));
conferir depois com `supabase/scripts/check-schema-drift.sh`.

### Mobile — sync (`mobile/src/`)

**`lib/health-buckets.ts`** — `aggregateSleepNights` para de descartar. Hoje devolve
`start`/`end` ambos no instante de acordar (`:356-362`); passa a devolver o período completo:
`onset`, `wake`, `inBedStart`/`inBedEnd`, os intervalos de vigília individuais e o
`tz_offset`.

> **Regra de gravação de `in_bed_at`:** só preencher quando `onset − inBedStart ≥ 60 s`
> (`MIN_ONSET_MS`). Abaixo disso a janela é derivada do sono pela própria fonte — é o caso
> do Garmin em 41 de 42 noites — e gravar o valor degenerado faria a tela dizer "você deitou
> 00:08" quando ela quer dizer "não sei".

**`lib/health-aggregate.ts`** — `aggregateSleep` deixa de ser a fonte da linha diária e passa
a montar as linhas de período; a linha diária vem de `sleep/derive.ts` do shared, a partir
dos mesmos períodos.

**`services/health-sync.ts`** — `AGG_VERSION` 5 → 6. Isso aciona `BACKFILL_DAYS = 500` e
reescreve as duas tabelas: `sleep_periods` nasce com ~500 noites e o timing chart abre cheio.
As duas escritas saem do mesmo ciclo.

### Mobile — tela (`mobile/src/app/sono/`)

- `index.tsx` — a tela: os relógios, o timing chart, o relógio de vigília, o par nota ×
  medição, a lista de noites.
- `[day].tsx` — detalhe da noite: faixa de estágio cortada pelos despertares, com o rótulo
  de incerteza.
- `store/sono.store.ts` — Zustand, no padrão de `registros.store.ts`.
- **Componentes** em `components/charts/`: `SleepTimingChart` e `AwakeningsClock`. SVG com
  `react-native-svg` (já instalado), como o histórico de treinos. **Sem Reanimated**
  ([ADR 0010](../../decisions/0010-sem-reanimated-no-mobile.md)) — animação é `Animated`.
- **Entrada:** o cartão da categoria Sono na aba Saúde passa a navegar para `/sono`;
  `/saude/sono` sai. O id `'sono'` fica no `metric-catalog.ts` — prontidão e retro dependem
  dele.

### Web — segunda rodada

`web/src/app/features/sono/`, rota `/sono` atrás do `profileGuard`, item na sidebar.
**Consome o mesmo núcleo**: nenhum cálculo de sono nasce em `web/`. É a lição que a
retrospectiva já cobrou uma vez, quando a regra viveu duplicada nas duas plataformas.

## Riscos

| Risco | Mitigação |
|---|---|
| Re-leitura do HealthKit move o `onset` alguns segundos → linha duplicada | Truncar `onset_at` ao minuto antes de gravar (data-model §2) |
| `health_daily.sono` e `sleep_periods` divergirem | A linha diária é **derivada**, escrita no mesmo ciclo, nunca calculada em separado |
| Quebrar prontidão / retrospectiva | O `extra` da linha diária mantém formato idêntico; `seriesFor('sono')` não muda de contrato. Cobrir com teste antes do merge |
| CAP-5 nascer vazia e parecer bug | A tela distingue "não houve" de "a fonte não reporta" e diz qual é |
| Backfill de 500 dias pesar no aparelho | Já é o caminho provado de dois bumps anteriores (`AGG_VERSION` 3 e 4) |

## Done

Validação nos três workspaces (`shared lint`+`test`, `web build`+`test`, mobile
`tsc --noEmit`+`jest`, `expo-doctor` 21/21), **mais** conferência visual em escala real e
build Release no iPhone. Mergeado sem rodar no aparelho não conta como entregue.
