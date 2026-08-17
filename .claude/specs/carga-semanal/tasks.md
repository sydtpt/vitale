# Tasks: Carga Semanal

- [x] **T1 — Derivação pura** `web/.../workout-history/data/weekly-load.ts`
  - `buildWeeklyLoad(activities, weeks=8, now=new Date()): WeeklyLoad`
  - helpers: `mondayOf(date)`, soma por zona, polarização, alerta de carga.
- [x] **T2 — Testes** `weekly-load.spec.ts` (Jasmine)
  - 8 buckets na ordem certa; semana sem FC vira barra vazia; treino sem `hrZones` não soma.
  - polarização (easyPct, divisão por zero); alerta liga >1,5× baseline e fica off com <2 semanas.
- [x] **T3 — Card** `components/weekly-load-card.component.{ts,html,scss}`
  - reusa `StackedBarChartComponent` (`metric="duration"`); legenda das zonas; faixa de polarização; aviso de carga (US3).
  - estado vazio quando nenhuma semana tem dado de FC.
- [x] **T4 — Wiring** `workout-history-page` importa e renderiza o card abaixo da Visão Geral.
- [x] **T5 — Validação** `ng build` ✅ (AOT compila limpo). Os `.spec.ts` do web rodam desde 2026-08-17 com `cd web && npx ng test --watch=false` (Vitest) ✅.
