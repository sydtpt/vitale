# Inventário de duplicação

Medido no repositório em 2026-08-17. Números conferidos contra o código, não estimados.

## Lógica pura duplicada — os cinco pares medidos (CAP-5)

| Módulo | web | mobile | linhas divergentes | o que de fato difere |
| --- | ---: | ---: | ---: | --- |
| `todo-logic` | 272 | 274 | 6 | nada estrutural — cópia derivando |
| `habit-logic` | 121 | 136 | 29 | não classificado |
| `planned-match` | 77 | 110 | 43 | mobile adiciona `buildWeek` + rótulos SEG–DOM (apresentação) |
| `weekly-volume` | 89 | 86 | 57 | não classificado |
| `moving-time` | 54 | 80 | 60 | mobile adiciona adaptador do track HealthKit e extraiu `movingTimeFromSamples(Sample[])` |

Caminhos: web em `web/src/app/features/<área>/data/`, mobile em `mobile/src/lib/`.

`moving-time` é o modelo do movimento: o núcleo de cálculo é idêntico nos dois, e o mobile **já havia separado** a forma normalizada dos adaptadores. Promover reconhece o que estava certo em vez de reescrever.

`mobile/src/lib/planned-match.ts` abre com um comentário pedindo sincronia manual com a versão do web. Esse aviso só sai quando a cópia sair — enquanto existir, ele é verdadeiro.

### Evidência de co-change

11 de 13 commits que tocaram esses módulos alteraram web **e** mobile no mesmo commit — 85%.

## Basenames duplicados não medidos

Existem nos dois apps, sem análise de divergência: `chart-palettes`, `goal-format`, `health-format`, `mock-data`, `running-highlights`, `todo-format`. Classificar ao chegar na CAP-5 — podem ser lógica pura, apresentação, ou legítima divergência de plataforma.

## Os 10 stores — allowlist da guarda (CAP-7)

`activities`, `connections`, `daily-ratings`, `goals`, `habits`, `health`, `planned-workouts`, `registros`, `retro`, `todos` (todos com sufixo `.store.ts`).

Duplicam por razão legítima: signals no web, Zustand no mobile. Continuam duplicados após a consolidação — mas perdem as queries para a CAP-6. A guarda os isenta da checagem de basename e **não** os isenta da checagem de `.from(`.

## Vocabulário fragmentado (CAP-4)

| Constante | Onde está hoje | Destino |
| --- | --- | --- |
| `GPS_ACTIVITY_IDS` = `[13,24,37,52]` | `web/src/app/core/models/activity-types.ts:20` e `mobile/src/lib/workout-types.ts:120` | `packages/shared/src/fitness/activity-types.ts` |
| `STRENGTH_IDS` = `[11,20,35,50,59]` | inline nos dois `planned-match.ts` | idem |
| `EASY_IDS` = `[57,66]` | inline nos dois `planned-match.ts` | idem |

O módulo de destino já existe e já é dono dos rótulos (`ACTIVITY_TYPE_LABELS`, `activityTypeLabel`). O vocabulário está partido entre três arquivos, um deles com metade da resposta.

## Superfície de dados (CAP-6)

139 chamadas `.from()` — 54 no web, 85 no mobile — sobre 19 tabelas.

**Tocadas pelos dois apps (14):** `activities`, `activity_routes`, `daily_ratings`, `goals`, `habit_logs`, `habits`, `health_daily`, `linked_accounts`, `planned_workouts`, `registro_logs`, `registros`, `todo_occurrences`, `todo_templates`, `user_preferences`.

**Só no web (1):** `profiles` — **não existe em nenhuma migration.** Ver Open Questions no SPEC.

**Só no mobile (4):** `meals`, `synced_activity_types`, `transactions`, `user_profiles`.

Divergência já materializada: em `todo_templates`, o web lê `select('*')` sem filtro e o mobile lê `select('*').eq('active', true)`.

## Verificação (CAP-1)

`packages/shared` tem três arquivos de teste — `src/goals/evaluate.test.ts`, `src/chart/axis.test.ts`, `src/chart/smooth-path.test.ts` — e nenhum runner: as devDependencies têm apenas TypeScript, e o script `test` é `echo 'No tests yet'`. Nunca executaram; o resultado é desconhecido.
