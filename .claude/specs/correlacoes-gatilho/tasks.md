# Tasks: Correlações de Gatilho

- [x] **T1 — Derivação pura** `web/.../saude/data/trigger-impact.ts`
  - `triggerImpact(metric, eventDays, valuesByDay, sinceDate?)` → médias com/sem, delta, deltaPct, nWith/nWithout, `enough`. Reusa `mean` do shared.
- [x] **T2 — Testes** `trigger-impact.spec.ts` (Jasmine) — diferença de médias, amostra insuficiente, `sinceDate`, deltaPct null com base 0.
- [x] **T3 — Card** `components/trigger-impact-card.component.{ts,html,scss}`
  - injeta Health/Habits/Registros; chips de gatilhos; linhas por métrica com tom good/bad/neutral; estados insuficiente/vazio; rodapé de "associação".
- [x] **T4 — Wiring** `saude-page` importa e renderiza o card após Correlações.
- [x] **T5 — Spec** `.claude/specs/correlacoes-gatilho/`.
- [x] **T6 — Validação** `ng build` ✅ (AOT compila limpo). `tsc` puro só acusa globais do Jasmine nos `.spec.ts` — tooling de teste não roda no ambiente (ver memória do projeto).

## Follow-up
- Significância (teste t / p-valor) e lag de 1 dia.
- Cruzar com readiness diário composto.
