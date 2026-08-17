<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra b8de47e. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## web (@vitale/web)

Dashboard analítico Angular, componentes standalone, rotas lazy em `src/main.ts`.
Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd web && npx ng build` — compila templates e TS.
- Testes unitários: `cd web && npx ng test --watch=false` — builder `@angular/build:unit-test`
  com Vitest em Node/jsdom. Sem `--watch=false` um terminal interativo entra em watch e
  nunca dá veredito. Use os matchers do Vitest (`toBe(true)`, não `toBeTrue()`).
- `ng lint` não existe — `angular.json` tem só os targets `build`, `serve` e `test`.

## Conventions that differ from defaults

- Declare `changeDetection: ChangeDetectionStrategy.OnPush` em todo componente (76 de 76).
- Injete por `inject()`, nunca por parâmetro de construtor (0 usos de `constructor(private`).
- Estado em `signal()`/`computed()` — não há RxJS store nem NgRx (0 `BehaviorSubject`).
- Em SCSS use os tokens do `@vitale/shared` via variáveis CSS; sem cor ou espaçamento literal.

<!-- /bmad:context -->
