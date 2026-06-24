# Retrospectiva — resumo agregado por período (semana · mês · ano)

> Status: **implementado (v1)** · web + mobile + shared

## Objetivo

Mostrar, de forma agregada e com insights cruzados, **o que foi feito num período**,
dividido por seções (Tarefas feitas, Treinos/atividade, Compras & gastos, Saúde &
bem-estar, Hábitos & registros). Três modos de visão, todos navegáveis para o passado:

- **Semanal** — semana Seg–Dom. A semana corrente só "fecha" no **domingo ≥ 20h**;
  antes disso o período disponível é a anterior.
- **Mensal** — só disponível a partir do **dia 01 do mês seguinte** → padrão = último mês fechado.
- **Ano** — ano corrente **ao vivo** (offset 0) + anos passados; inclui breakdown por mês.

Cada número vem com comparação vs período anterior (`delta`/`deltaPct`) e tom good/bad/neutral.

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
