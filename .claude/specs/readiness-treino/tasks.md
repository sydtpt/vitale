# Tasks: Readiness → Treino

- [x] **T1 — Derivação pura** `web/.../semana/data/readiness-advice.ts`
  - `classifyWorkout(treino)` → força/endurance/leve/descanso/nenhum.
  - `readinessAdvice(total, hasData, kind, label)` → `{ tone, title, text }`.
- [x] **T2 — Testes** `readiness-advice.spec.ts` (Jasmine) — classificação + matriz score×intensidade + estado sem dados.
- [x] **T3 — UI** banner no `day-score-card` (`advice()` computed; cor por `data-tone`).
- [x] **T4 — Spec** `.claude/specs/readiness-treino/`.
- [x] **T5 — Validação** `ng build` limpo; `tsc` sem erros de tipo reais.

## Portado para shared + mobile (2026-06-07)
- [x] **T6 — Mover lógica para o shared** `packages/shared/src/health/readiness-advice.ts` (fonte única; exportado no index). Web e mobile importam de `@vitale/shared`.
- [x] **T7 — Web usa shared** `day-score-card` importa do shared; arquivo local removido; spec aponta para o shared.
- [x] **T8 — Mobile** banner de recomendação no [`ReadinessCard`](../../../mobile/src/components/cards/ReadinessCard.tsx) (tab Hoje), com cor por tom. Treino do dia via `mobile/src/services/mock-data` (mesmo mock da web).

## Pendências / follow-up
- Trocar `TREINOS_SEMANA[TODAY_IDX]` (mock) por treino planejado real quando o módulo Treinos sair do mock — agora em **dois** lugares (web `@core/models/mock-data`, mobile `services/mock-data`).
- Possível fusão "carga × prontidão" com [carga-semanal](../carga-semanal/spec.md).
