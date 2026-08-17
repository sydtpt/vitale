<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra a711c41. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## @vitale/shared

Modelos de domínio e design tokens consumidos por web e mobile.
Regras gerais do repositório: `../../AGENTS.md`.

## Running and verifying

- Valide com `npm run lint -w @vitale/shared` (é `tsc --noEmit`).
- Não há teste próprio (`npm test` é um `echo`) — teste esta lógica pelo jest do mobile.

## Conventions that differ from defaults

- `src/models/` carrega só tipo e forma de dado, sem lógica de negócio (0 funções hoje).
  Derivação vai em módulo próprio ao lado: `fitness/`, `health/`, `geo/`, `goals/`,
  `period/`, `week/`.
- Reexporte todo símbolo novo em `src/index.ts` — é barrel; sem isso não chega aos apps.

<!-- /bmad:context -->
