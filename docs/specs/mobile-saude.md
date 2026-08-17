# Mobile: Saúde 🩺

> Tab de exploração dos dados do **Apple Health**. Espelha o padrão da tab Fitness, mas em vez de só treinos, expõe métricas de atividade, coração, corpo, sono e nutrição com gráficos.

## Objetivo

Dashboard com cards-resumo por categoria → tap abre o detalhe da métrica com gráfico, seletor de período (Dia / Semana / Mês), estatísticas (média / mín / máx / total) e lista de amostras.

## Plataforma

- **iOS apenas** — HealthKit não existe no Android (tela "indisponível", igual à Fitness).
- Permissões e usage description em `app.json` (`NSHealthShareUsageDescription` + entitlement `com.apple.developer.healthkit`).

## Arquivos

```
mobile/src/
├── lib/health-format.ts          # Period, Sample, bucketize, computeStats, formatters
├── config/health-metrics.ts      # registro de métricas + fetchers HealthKit + permissões + perfil
├── store/health.store.ts         # Zustand: permissão, período, summaries, detail, profile
├── app/(tabs)/saude.tsx          # dashboard por categoria
├── app/saude/[metric].tsx        # detalhe (gráfico + período + stats + amostras)
└── components/charts/
    ├── BarChart.tsx              # barras (métricas cumulativas)
    ├── LineChart.tsx             # linha + área (métricas pontuais)
    ├── Sparkline.tsx             # mini-gráfico dos cards
    ├── ActivityRings.tsx        # anéis concêntricos (Mover/Exercício/Em pé)
    └── MacroDonut.tsx           # donut de macronutrientes
```

Rota registrada em `app/_layout.tsx` (`saude/[metric]`, slide). Tab registrada em `app/(tabs)/_layout.tsx` (ícone `heart-outline`). A tab **Compras** foi removida do tab bar para abrir espaço.

## Registro de métricas (config-driven)

`config/health-metrics.ts` é a fonte da verdade. Cada `MetricDef` tem: `id`, `label`, `category`, `icon`, `unit`, `kind` (`cumulative` | `discrete`), `chart` (`bar` | `line` | `rings` | `donut`), `fetch(range, period)`, `format(value)`.

Adicionar uma métrica nova = adicionar um objeto ao array `METRICS` (e a permissão em `HEALTH_PERMISSIONS`). Dashboard e detalhe se geram sozinhos.

### Categorias e métricas (v1)

| Categoria  | Métricas |
|------------|----------|
| Atividade  | passos, distância, andares, energia ativa, min. de exercício, anéis de atividade |
| Coração    | FC, FC em repouso, VFC, VO₂ máx, SpO₂, freq. respiratória, pressão arterial |
| Corpo      | peso, IMC, % de gordura, massa magra, cintura (+ card de perfil: idade/sexo/sangue) |
| Sono       | horas dormidas por noite |
| Nutrição   | água, calorias, macronutrientes (donut), proteína |

## Agregação (`health-format.ts`)

- `periodRange(period)` → intervalo ISO (dia = hoje; semana = 7d; mês = 30d).
- `bucketize(samples, period, kind)` → buckets (dia = 24 horas; semana = 7 dias; mês = 30 dias). `cumulative` soma; `discrete` faz média.
- `computeStats` → `cumulative` usa buckets diários (média/dia); `discrete` usa amostras (média/mín/máx) + `latest`.
- Métricas cumulativas usam `period` do HealthKit (60min no Dia, 1440min nos demais) para agregar no intervalo certo.

## Store

- `requestPermission()` — `initHealthKit` com todas as permissões; chamado no mount do dashboard.
- `loadSummaries()` — busca 7 dias de todas as métricas (cards + sparklines).
- `setPeriod(p)` — troca período e limpa cache do detalhe (força refetch).
- `loadMetric(id)` — busca a métrica no período ativo (tela de detalhe).

## Casos especiais

- **Anéis** (`getActivitySummary`): 3 amostras (mover/exercício/em pé) com `value` + `extra` (meta) do dia mais recente; renderiza `ActivityRings`.
- **Pressão** (`getBloodPressureSamples`): sistólica em `value`, diastólica em `extra`; gráfico de linha pela sistólica, lista mostra "120/80".
- **Sono** (`getSleepSamples`): cada estágio vira horas dormidas (exclui INBED/AWAKE); soma por noite.
- **Macros** (`donut`): soma de proteína/carbo/gordura (g) no período.
- **Perfil estático** (sexo/tipo sanguíneo/idade): card na categoria Corpo.

## Limitações conhecidas / próximos passos

- Unidade de água depende do default do HealthKit (assumida em L).
- `% gordura` / SpO₂ tratam valor como fração se ≤ 1.
- Hipnograma detalhado do sono (fases por noite) e correlações entre métricas ficam para v2.
- Possível consolidar a tab Fitness dentro de Saúde no futuro (workouts são dados de saúde).
