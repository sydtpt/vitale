<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra b8de47e. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## @vitale/shared

Modelos de domínio e design tokens consumidos por web e mobile.
Regras gerais do repositório: `../../AGENTS.md`.

## Running and verifying

- Valide com `npm run lint -w @vitale/shared` (é `tsc --noEmit`) e
  `npm test -w @vitale/shared`.
- Teste aqui é script autoexecutável, sem framework: `src/**/*.test.ts` roda por `tsx`,
  usa `node:assert` e sai com código != 0 no primeiro assert que falhar. Não há `test()`
  nem `describe()` — arquivo escrito em bloco de framework não roda.

## Conventions that differ from defaults

- `src/models/` carrega só tipo e forma de dado, sem lógica de negócio (0 funções hoje).
  Derivação vai em módulo próprio ao lado: `fitness/`, `health/`, `geo/`, `goals/`,
  `period/`, `week/`.
- Reexporte todo símbolo novo em `src/index.ts` — é barrel; sem isso não chega aos apps.

<!-- /bmad:context -->
