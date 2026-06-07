# Tasks: Recap Semanal

- [x] **T1 — Derivação pura** `web/.../semana/data/weekly-recap.ts`
  - `weekBounds`/`weekLabel`, `activityRecap`, `metricRecap`, `countRecap`. Variação atual vs anterior com delta/deltaPct.
- [x] **T2 — Testes** `weekly-recap.spec.ts` (Jasmine) — limites de semana, totais de atividade, média de saúde (com/sem dado), contagem de eventos.
- [x] **T3 — Card** `components/weekly-recap-card.component.{ts,html,scss}`
  - tiles de treino + médias de saúde (tom por polaridade) + gatilhos condicionais + estado vazio.
- [x] **T4 — Wiring** `semana-page` importa e renderiza o card no topo (antes das stats mock).
- [x] **T5 — Spec** `.claude/specs/recap-semanal/`.
- [x] **T6 — Validação** `ng build` ✅ (AOT compila limpo). `tsc` puro só acusa globais do Jasmine nos `.spec.ts` — tooling de teste não roda no ambiente (ver memória do projeto).

## Follow-up
- Trocar/limpar as big-stats hardcoded do topo da Semana quando o recap consolidar.
- Adicionar Finanças quando transações forem reais; PRs batidos na semana; recap mensal + push.
