---
runScope: 'epic-level'
runKey: 'epic-1'
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  - 'step-01-detect-mode'
  - 'step-02-load-context'
  - 'step-03-risk-and-testability'
  - 'step-04-coverage-plan'
  - 'step-05-generate-output'
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-09-08'
outputFile: 'skills/test-artifacts/test-design-epic-1.md'
inputDocuments:
  - docs/specs/revista-retrospectiva/spec.md
  - docs/specs/revista-retrospectiva/cadernos.md
  - docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - docs/specs/revista-retrospectiva/mudancas-mecanicas.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/architecture/architecture-Orbe-revista-2026-09-08/ARCHITECTURE-SPINE.md
  - _bmad/tea/config.yaml
  - .github/workflows/ci.yml
  - packages/shared/package.json
  - packages/shared/src/architecture.test.ts
  - packages/shared/src/theme/theme.test.ts
  - packages/shared/src/data/edicoes-ia.ts
  - packages/shared/src/data/paginate.ts
  - packages/shared/src/data/health-daily.ts
  - packages/shared/src/ia/verificar.ts
  - mobile/src/services/health-sync.ts
  - supabase/migrations/20260906150000_edicoes_ia.sql
---

# Progresso — test design epic-1

## Step 1 — modo

**Epic-Level.** Existem épicos e stories com critério de aceite em Given/When/Then
(`_bmad-output/planning-artifacts/epics.md`), sem PRD. `epic_num = 1`, `run_key = epic-1`.

**Escopo de pontuação estendido à frente inteira (27 stories, 4 épicos)** por instrução
explícita do usuário: os riscos que ele deu como entrada nomeiam as stories 1.1, 1.9, 2.3,
1.15 e 3.3. Pontuar só o Épico 1 deixaria de fora riscos que ele nomeou. O Épico 1 recebe
o plano de cobertura completo; os Épicos 2–4 recebem pontuação e exigência de evidência.

Nenhum checkpoint anterior neste path — execução nova.

## Step 2 — contexto carregado

**Stack detectada:** `mobile` (Expo 57 / RN 0.86 + `app.json` + `ios/`), com backend
(Supabase/Postgres) presente. **Web é não-objetivo declarado do spec** — nenhuma
exploração de browser, nenhum Playwright, nenhum Pact (não há microserviço nem consumidor
de contrato HTTP versionado).

**Níveis de teste realmente disponíveis, conferidos no repo em 08/09/2026:**

| Nível | Ferramenta | Estado |
|---|---|---|
| Núcleo puro | `npx tsx` sobre `*.test.ts` | **55 arquivos**. Maduro. É o nível forte |
| Barreiras | `architecture.test.ts` (676 l) · `theme.test.ts` (663 l) | Offline, mecânicas, rodam no CI |
| Mobile lógica | Jest (`mobile/src/lib/__tests__`) | ~30 arquivos, **só lógica** |
| Web | Vitest (11 `.spec.ts`) | Irrelevante à frente; o CI o valida mesmo assim |
| **Render / componente** | — | **NÃO EXISTE.** Zero `.test.tsx`, sem testing-library, sem react-test-renderer |
| **E2E / device** | — | **NÃO EXISTE.** Sem Maestro, Detox ou Appium |
| **Banco / migration** | — | **NÃO EXISTE.** 55 migrations, nenhuma testada |

Config TEA: `tea_browser_automation: auto` → **pulado** (sem superfície de browser).
`tea_use_pactjs_utils: true` → **não relevante** (o mandato do fragmento diz que a flag
nunca significa "acrescente contract testing"; não há artefato Pact, nem broker, nem
provider). `tea_use_playwright_utils: true` → **não relevante** pela mesma razão.

Fragmentos de conhecimento carregados: `risk-governance`, `probability-impact`,
`test-levels-framework`, `test-priorities-matrix`, `mobile-test-strategy`, `nfr-criteria`.

## Step 3 — riscos e testabilidade

42 riscos, 19 altos (≥6). Quatro achados de testabilidade estruturais e quatro riscos
novos (não estavam na lista de entrada do usuário), todos confirmados contra o código.
Detalhe completo no documento final.

## Step 4 — plano de cobertura

Prioridades P0–P3 mapeadas por risco, com nível escolhido entre os que **existem**.
Estimativas em intervalos. Portões de qualidade definidos, incluindo os dois portões
humanos que nenhum agente fecha.
