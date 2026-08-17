<!-- bmad:context -->
<!-- Verificado em 2026-08-17 contra a711c41. Mantido por bmad-project-context;
     edições dentro deste bloco são substituídas no refresh. -->

## web (@vitale/web)

Dashboard analítico Angular, componentes standalone, rotas lazy em `src/main.ts`.
Regras gerais do repositório: `../AGENTS.md`.

## Running and verifying

- Valide com `cd web && npx ng build` — compila templates e TS.
- `ng test` não roda: falta `karma-jasmine`. Os 11 `*.spec.ts` do diretório não executam
  hoje; consertar o runner é tarefa aberta.
- `ng lint` não existe — `angular.json` tem só os targets `build`, `serve` e `test`.

## Conventions that differ from defaults

- Declare `changeDetection: ChangeDetectionStrategy.OnPush` em todo componente (76 de 76).
- Injete por `inject()`, nunca por parâmetro de construtor (0 usos de `constructor(private`).
- Estado em `signal()`/`computed()` — não há RxJS store nem NgRx (0 `BehaviorSubject`).
- Em SCSS use os tokens do `@vitale/shared` via variáveis CSS; sem cor ou espaçamento literal.

<!-- /bmad:context -->
