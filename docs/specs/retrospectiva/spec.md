# Retrospectiva — resumo agregado por período (semana · mês · estação · ano · total)

> Status: **implementado (v1)** · web + mobile + shared
> Próxima etapa: [**v2 — o jornal**](v2-jornal.md) (Camada 0 + heatmap + séries + manchete).

## Princípio

A Retrospectiva é **um jornal**: ela informa o que aconteceu, não aconselha o que fazer.
Decidido pelo usuário em 2026-08-25. Consequências que valem como regra de desempate:

- Há **uma manchete por edição** (o destaque principal) — não uma lista plana de números
  com o mesmo peso.
- A **diagramação é estável**: mesmas seções, mesma ordem, toda edição.
- **Gráfico é apoio, nunca a matéria.**
- Erro e incerteza aparecem — amostra (`n`), "não medido" — como a caixa de correções
  de um jornal.
- Conselho e sugestão de ação **não entram aqui**. Vivem numa seção futura e separada,
  registrada em `_bmad-output/planning-artifacts/backlog-de-features.md` (F3).

## Objetivo

Mostrar, de forma agregada e com insights cruzados, **o que foi feito num período**,
dividido por seções (Tarefas feitas, Treinos/atividade, Compras & gastos, Saúde &
bem-estar, Hábitos & registros). **Cinco** modos de visão, todos navegáveis para o
passado — a fonte de verdade das regras é o cabeçalho de `period/bounds.ts`:

- **Semana** (`week`) — Seg–Dom. A semana corrente só "fecha" no **domingo ≥ 20h**;
  antes disso o período disponível é a anterior.
- **Mês** (`month`) — só disponível a partir do **dia 01 do mês seguinte** → padrão =
  último mês fechado.
- **Estação** (`season`) — trimestre civil (Q1 Jan–Mar … Q4 Out–Dez), disponível **ao vivo**.
- **Ano** (`year`) — ano corrente **ao vivo** (offset 0) + anos passados; inclui breakdown
  por mês.
- **Total** (`all`) — período único cobrindo tudo (offset ignorado), ao vivo. Não tem
  período anterior: `buildRetroHighlights` degenera o `prev`, então os textos saem **sem
  delta e com tom neutro**.

Cada número vem com comparação vs período anterior (`delta`/`deltaPct`) e tom good/bad/neutral
— exceto em `all`, pelo motivo acima.

## Arquitetura

Toda a agregação é **pura, no `@vitale/shared`**, compartilhada por web e mobile.
As plataformas só fazem fetch por intervalo + renderização.

### Shared (`packages/shared/src/`)
- `period/bounds.ts` — `PeriodKind`, `periodBounds(now, kind, offset)`,
  `latestAvailableOffset(now, kind)` (regras de disponibilidade), `periodLabel`.
- `week/recap.ts` — generalizado: primitivas range-based exportadas
  (`recapValue`, `totalsInRange`, `metricAvgInRange`, `metricRecapRange`, `countInRange`).
  `weekBounds`/`activityRecap`/`countRecap` viraram casos particulares (sem quebra de API).
- `period/retro.ts` — agregador central:
  - `buildRetrospective(input): RetroSummary` — seções tipadas com recaps vs período anterior.
  - `buildRetroHighlights(summary, input): WeekHighlight[]` — destaques em PT-BR + insight
    cruzado gatilho×saúde (`triggerImpact`).
  - `buildYearByMonth(input): MonthBucket[]` — 12 baldes para o modo anual.

### Web (`web/src/app/features/retrospectiva/`)
- `data/retro.store.ts` — `RetroStore` (`@Injectable root`); `ensure(since)` busca por
  intervalo; reusa `ActivitiesStore` (histórico completo). `summary/highlights/yearByMonth`.
- `pages/retrospectiva-page.component.ts/html/scss` — toggle Semana/Mês/Ano + navegação ‹ ›
  (trava em `latestAvailableOffset`), KPIs, destaques e seções; barras SVG/CSS no ano.
- Rota `/retrospectiva` em `web/src/main.ts`; item na `shared/layouts/sidebar.component.ts`.

### Mobile (`mobile/src/`)
- `store/retro.store.ts` — `useRetroStore` (Zustand) com `ensure/summary/highlights/yearByMonth`
  + helper `retroSince`. Reusa `useActivitiesStore`.
- `app/retrospectiva/index.tsx` — tela (fora das tabs), mesmas seções; barras por mês no ano.
  Registrada em `app/_layout.tsx`; link em `app/(tabs)/mais.tsx`.

## Fontes de dados (Supabase, por intervalo)
`activities` (histórico completo), `health_daily` (sono/vfc/fcRepouso), `daily_ratings`,
`habits`+`habit_logs`, `registros`+`registro_logs`, `todo_templates`+`todo_occurrences`
(status `done`, `done_at` no range; módulo via template; **compras** lê `meta.price/cat`).

## Métricas somadas
- **Andares subidos** (`health_daily.metric = 'andares'`) → total por período em
  `fitness.floors` (soma, não média) + por mês no breakdown anual (`MonthBucket.floors`).
  Passado via `RetroInput.floorsByDay`; renderizado no card "Treinos & atividade".
- **kcal gastas** (`fitness.calories`, soma de `activities.calories` no período) — no
  mesmo card. Atividade sem caloria vinda da fonte é estimada por trigger no banco
  (ADR 0005), então o total não tem buracos silenciosos.
- **kcal estimadas de hábito de consumo** — `habits/calories.ts` (`habitCalories`)
  converte o total do período em calorias aproximadas quando o nome do hábito tem
  densidade conhecida (hoje só **cerveja**). Aparece na linha de apoio do hábito como
  `≈N kcal`, em web e mobile. Ordem de grandeza, não nutrição.
  - Catálogo `BEERS` (Bélgica): Stella Artois 5,2% = 450 kcal/L · Jupiler 5,2% = 430 ·
    BBP IPA 6,5% = 600. `mlPerUnit` = copo padrão (25 cl pintje, 33 cl IPA).
  - `habit_logs` guarda **só litros** — não há tipo por log. `DEFAULT_BEER_MIX`
    (40/40/20) dá a densidade usada: **472 kcal/L**. `habitCaloriesRange` devolve o
    piso/teto (430…600 kcal/L) para quem quiser exibir a incerteza.
  - Outro item consumível = mais uma entrada em `KCAL_BY_HABIT`.

## Insights cruzados
- Treino × carga (Z4+Z5 via `dailyHardLoad`).
- Gatilho (registro / hábito ruim) × saúde via `triggerImpact` (ex.: "nos dias com X, VFC −8%").
- Tendência de métricas no período via `detectTrend`.

## Limitação conhecida
**Finanças** não tem tabela real (`web/.../core/models/mock-data.ts` é mock). A seção
"Compras & gastos" usa **gasto estimado** = `Σ meta.price` das compras concluídas no período.
Fast-follow (fora do escopo v1): migration `transactions` + store próprio para finanças reais.

## Testes
`mobile/src/lib/__tests__/retro.test.ts` — `periodBounds`, `latestAvailableOffset`
(domingo 19h vs 21h; mês = −1; ano = 0; virada de mês/ano), `buildRetrospective`
(tarefas/treinos/gasto/hábitos) e `buildYearByMonth`.
`packages/shared/src/habits/calories.test.ts` — `habitCalories` (L/ml/un, nome com acento
ou complemento, total zero, hábito sem densidade conhecida).
