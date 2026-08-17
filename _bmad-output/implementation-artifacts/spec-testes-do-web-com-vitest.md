---
title: 'Rodar os testes unitários do web com Vitest'
type: 'chore'
created: '2026-08-17'
status: 'done'
baseline_commit: '41ee63eb1127003626b9d144d85991ae8537e6f4'
review_loop_iteration: 1
context: ['{project-root}/web/AGENTS.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O workspace `web/` tem 11 arquivos `*.spec.ts` que nunca foram executados — `npx ng test` morre em `Cannot find module 'karma-jasmine'`, e o `tsconfig.spec.json` que o target `test` referencia sequer existe. São testes de lógica de negócio real (recap semanal, prontidão, carga de treino, explorador de países) hoje sem nenhuma cobertura efetiva.

**Approach:** Adotar o builder `@angular/build:unit-test` do Angular 21 com runner Vitest em Node/jsdom — sem browser — em vez de ressuscitar o Karma, descontinuado pelos próprios mantenedores. Criar o `tsconfig.spec.json` ausente e converter os 8 matchers exclusivos do Jasmine.

## Boundaries & Constraints

**Always:** Preservar o comportamento testado por cada um dos 11 specs — a única alteração permitida neles é a sintaxe do matcher. Reaproveitar o `paths` do `web/tsconfig.json` que já resolve `@vitale/shared`. Validar também com `npx ng build`, conforme `web/AGENTS.md`.

**Ask First:** Se algum spec falhar por divergência real entre o teste e o código de produção (teste escrito contra uma versão anterior), HALT e perguntar — não ajustar a expectativa nem o código de produção por conta própria.

**Never:** Não instalar Karma, Jasmine ou browser launcher. Não tocar em `packages/shared/`. Não reescrever a lógica sob teste além da decisão registrada abaixo.

## Decisão do humano (renegociada em 2026-08-17, após o HALT do "Ask First")

O único teste que falhou foi `planned-match.spec.ts` → `kindForActivity(52)`, que esperava `'easy'` enquanto o código devolve `'endurance'`. Caminhada (52) está em `GPS_ACTIVITY_IDS` **e** em `EASY_IDS`, e a checagem de GPS vem primeiro. Histórico: 52 entrou no GPS em `d00fbf7` (20/05) e o spec foi escrito depois, em `03225b8` (07/06) — nasceu errado e nunca rodou.

**Decidido:** caminhada é **`endurance`** — o código de produção está correto. Corrigir o teste e remover o `52` de `EASY_IDS`, que é código inalcançável.

**Escopo ampliado:** `mobile/src/lib/planned-match.ts` tem a mesma função duplicada, com os mesmos conjuntos e sem teste. A mesma remoção do `52` deve ser aplicada lá, para web e mobile não divergirem. Apenas essa alteração é permitida no `mobile/`.

</frozen-after-approval>

## Code Map

- `web/angular.json` — projeto `vitale-web`; target `test` usa hoje `@angular-devkit/build-angular:karma` com `tsConfig: tsconfig.spec.json` (inexistente) e opções de Karma (`polyfills`, `styles`, `assets`, `scripts`). Target `build` = `@angular-devkit/build-angular:application`, e é o que o `buildTarget` deve apontar.
- `web/tsconfig.json` — base a estender: `strict`, `moduleResolution: bundler`, `types: ["node"]`, e `paths["@vitale/shared"] → ../packages/shared/src/index.ts`.
- `web/tsconfig.app.json` — referência de formato do arquivo irmão (`include: ["src/**/*.d.ts"]`).
- `web/package.json` — devDeps sem runner algum. `@angular/build` declara peer `vitest ^4.0.8`.
- `web/src/app/features/recuperacao/data/aggregate.spec.ts:64,99` — `toBeTrue()`.
- `web/src/app/features/treinos/data/planned-match.spec.ts:58,67,79,87,95,103` — `toBeTrue()` e `toBeFalse()`.
- Os outros 9 specs — só matchers comuns aos dois frameworks (`toBe` 189×, `toEqual` 21×, `toBeCloseTo` 23×, `toContain` 10×). Nenhum spec usa `TestBed`, `spyOn`, `beforeEach`, `fakeAsync` ou DOM; todos importam só `@vitale/shared` e o módulo irmão sob teste.
- Read-only, evidência da escolha: `web/node_modules/@angular/build/src/builders/unit-test/schema.json` — `runner` tem default `"vitest"` e enum `["karma","vitest"]`; sem a opção `browsers`, roda em Node com jsdom.

## Tasks & Acceptance

**Execution:**
- [x] `web/package.json` — adicionar a devDependencies: `vitest` (peer do builder), `jsdom` (exigido em execução sem browser) e `@angular/build`, que fornece o builder e hoje só resolve transitivamente via `@angular-devkit/build-angular`.
- [x] `web/package.json` — o script `test` precisa ser não-interativo (`ng test --watch=false`): o builder resolve `watch = options.watch ?? isTTY()`, então `npm run test` num terminal entra em watch, nunca dá veredito e impede o `npm run test` da raiz de chegar no workspace `mobile`.
- [x] `web/tsconfig.spec.json` — criar estendendo `./tsconfig.json`, incluindo os `*.spec.ts` e os tipos do runner — o target já aponta para este caminho e ele não existe.
- [x] `web/angular.json` — trocar o builder do target `test` para `@angular/build:unit-test` com `tsConfig: "tsconfig.spec.json"` e `runner: "vitest"` (caminhos em `angular.json` são relativos a `web/`); descartar as opções herdadas do Karma. O `buildTarget` deve fixar a configuração de desenvolvimento, não herdar a `defaultConfiguration: production` do projeto.
- [x] `web/angular.json` — target `build`: trocar `@angular-devkit/build-angular:application` por `@angular/build:application`, para o qual ele já é um alias direto. Sem isso, todo `ng test` imprime que o pareamento de builders não é suportado.
- [x] `web/src/app/features/recuperacao/data/aggregate.spec.ts` + `web/src/app/features/treinos/data/planned-match.spec.ts` — converter as 8 ocorrências: `toBeTrue()` → `toBe(true)`, `toBeFalse()` → `toBe(false)`.
- [x] `web/src/app/features/treinos/data/planned-match.ts` — remover `52` de `EASY_IDS` (inalcançável: a checagem de `GPS_ACTIVITY_IDS` vem antes) e corrigir o comentário do conjunto, que hoje diz "mobilidade, yoga" quando os ids restantes são **57 = Yoga** e **66 = Pilates**.
- [x] `mobile/src/lib/planned-match.ts` — espelhar exatamente a mesma remoção e a mesma correção de comentário, para as duas plataformas classificarem igual.
- [x] `web/src/app/features/treinos/data/planned-match.spec.ts` — corrigir a asserção obsoleta de `kindForActivity(52)` para `'endurance'` e **separar em dois `it` independentes** (yoga → `easy`; caminhada → `endurance`), para uma falha dizer qual regra quebrou. Não há contagem de testes a respeitar.
- [x] `web/AGENTS.md` — substituir a linha "`ng test` não roda: falta `karma-jasmine`" pelo comando que passou a funcionar, sem fixar quantidade de arquivos (o número envelhece a cada spec novo).
- [x] `AGENTS.md` (raiz) e `CLAUDE.md` — ambos afirmam que `npm run lint` **e** `npm run test` da raiz falham por causa do workspace `web`. Após esta mudança só o `lint` falha; separar as duas afirmações para não deixar instrução viva contradizendo o estado real.
- [x] `.gitignore` — ignorar `out-tsc/`, o `outDir` do novo tsconfig de testes (a raiz cobre `dist/`, `build/` e `out/`, mas não este).

**Acceptance Criteria:**
- Dado o repositório após a mudança, quando eu rodo `cd web && npx ng test --watch=false`, então todos os arquivos `*.spec.ts` do web são executados, todos passam e o comando sai com código 0.
- Dado um terminal interativo, quando eu rodo `npm run test` na raiz, então ele termina sozinho com código 0 e roda também o workspace `mobile` — sem entrar em modo watch.
- Dado o espelhamento no mobile, quando eu rodo `cd mobile && npx tsc --noEmit && npx jest`, então continua saindo com código 0.
- Dado o mesmo estado, quando eu rodo `cd web && npx ng build`, então continua saindo com código 0 e sem o aviso de pareamento de builders não suportado.
- Dado um spec que falhe por divergência real entre teste e código de produção, quando isso ocorrer, então o agente para e pergunta em vez de ajustar a expectativa.

## Spec Change Log

### Iteração 2 — 2026-08-17 (revisão do passo 4 sobre o código re-derivado)

Sem `intent_gap` nem `bad_spec` — nenhum loopback novo. As três camadas rodaram e confirmaram, cada uma por conta própria, que todos os critérios de aceite passam.

**Triagem:** 3 achados `patch` (linha do lint na `AGENTS.md` da raiz culpando só o `web` quando `mobile` também falha; `watch: false` ausente nas opções do target, deixando o `npx ng test` cru entrar em watch; 4 `tasks.md` em `.claude/specs/` ainda afirmando que o runner não roda) — aplicados. 4 achados `defer` novos, somados ao `deferred-work.md`, entre eles a descoberta de que `STRENGTH_IDS` contém `35` (**Remo**) sob o comentário "musculação/força", exatamente a mesma classe do bug do `52`, na linha adjacente.

**1 achado rejeitado:** a alegação de que o Vitest carregaria o `jsdom@20.0.3` hoisted em vez do `30.0.1` declarado. Verificado por resolução real a partir de `web/`: retorna **30.0.1**.

**Fora do repositório:** a memória de projeto `lint-build-commands.md` ainda instruía "não criar `*.spec.ts` no web esperando rodá-los" — a contradição de maior consequência, porque afastaria trabalho futuro da capacidade recém-criada. Corrigida.

### Iteração 1 — 2026-08-17 (loopback bad_spec, disparado pela revisão do passo 4)

**Achado que disparou:** o teste corrigido de `kindForActivity` ficou agrupando duas asserções não relacionadas (`yoga → easy` e `caminhada → endurance`) num único `it`, de modo que uma falha não diz qual regra quebrou. Causa raiz: o critério de aceite exigia **"os 122 testes passam"** — uma contagem fixa. O implementador relatou explicitamente ter dividido a asserção em dois `it` (o que daria 123) e **desfeito a divisão** para bater o número. A spec induziu a versão pior.

**O que foi corrigido:** os critérios de aceite não fixam mais contagem de testes — passam a exigir "todos os testes passam", e uma tarefa explícita manda dividir a asserção em dois `it`. Somados os 7 achados `patch` da mesma revisão, agora como tarefas.

**Estado ruim evitado:** um artefato de teste que falha sem informar qual das duas regras de classificação quebrou — e um critério de aceite que penaliza quem adiciona cobertura.

**KEEP — o que funcionou e precisa sobreviver à re-derivação:**
- Builder `@angular/build:unit-test` com `buildTarget`, `tsConfig` e `runner: "vitest"`, descartando todas as opções do Karma (`polyfills`, `styles`, `assets`, `scripts`, `inlineStyleLanguage`).
- `web/tsconfig.spec.json` estendendo `./tsconfig.json` com `types: ["node", "vitest/globals"]` — `vitest/globals` é necessário porque o builder liga `globals: true` e os specs usam `describe`/`it`/`expect` sem importar.
- `vitest ^4.1.10` (satisfaz o peer `^4.0.8`) e `jsdom ^30.0.1` — o `dependency-checker` do builder exige jsdom ou happy-dom em execução sem browser.
- As 8 conversões de matcher: `toBeTrue()` → `toBe(true)`, `toBeFalse()` → `toBe(false)`. Nenhuma outra alteração nos specs.
- A remoção do `52` de `EASY_IDS` em web e mobile é comprovadamente preservadora de comportamento: `GPS_ACTIVITY_IDS` é `{13,24,37,52}` idêntico nos dois lados, a checagem de GPS precede a de `EASY_IDS`, e `EASY_IDS` é const privada do módulo sem nenhuma outra referência no repositório.

## Design Notes

Por que Vitest e não Karma: o Karma foi descontinuado pelos mantenedores, e o `@angular/build:unit-test` do Angular 21 — já instalado aqui — traz `vitest` como padrão. Os 11 specs favorecem a troca porque não dependem do framework: nenhum importa `jasmine` (usam apenas os globais `describe`/`it`/`expect`), nenhum usa `TestBed`, DOM ou assincronia. São funções puras sobre arrays de `Activity`. O único atrito são os 8 matchers `toBeTrue`/`toBeFalse`, que não existem no Vitest.

## Verification

**Commands:**
- `cd web && npx ng test --watch=false` — esperado: 11 arquivos executados, exit 0.
- `cd web && npx ng build` — esperado: exit 0, nada quebrou no app.
- `npm run test` na raiz, em terminal interativo — esperado: exit 0, alcançando o workspace `mobile`.
- `cd mobile && npx tsc --noEmit && npx jest` — esperado: exit 0 nos dois.
- `npm run lint -w @vitale/shared` — esperado: exit 0, o path mapping para o shared continua resolvendo.

## Suggested Review Order

**A troca de runner**

- Entrada: o target que deixou de ser Karma e passou a ser Vitest em Node/jsdom.
  [`angular.json:65`](../../web/angular.json#L65)

- `watch: false` aqui — não no script — protege todo chamador: CLI, IDE e CI futuro.
  [`angular.json:65`](../../web/angular.json#L65)

- Alias direto do builder legado; sem isso todo run avisa que o pareamento não é suportado.
  [`angular.json:20`](../../web/angular.json#L20)

- O arquivo que o target referenciava e não existia — a segunda causa da quebra.
  [`tsconfig.spec.json`](../../web/tsconfig.spec.json)

**A decisão de produto que o teste revelou**

- Caminhada tem GPS, logo é endurance; o `52` aqui era inalcançável há meses.
  [`planned-match.ts:39`](../../web/src/app/features/treinos/data/planned-match.ts#L39)

- A ordem das checagens é o que torna o `52` inalcançável — leia antes de julgar a remoção.
  [`planned-match.ts:45`](../../web/src/app/features/treinos/data/planned-match.ts#L45)

- Espelho do mobile: mesma remoção, para as plataformas não divergirem. Sem teste próprio.
  [`planned-match.ts:41`](../../../mobile/src/lib/planned-match.ts#L41)

- O `it` que fixa a decisão, isolado para uma falha dizer qual regra quebrou.
  [`planned-match.spec.ts:44`](../../web/src/app/features/treinos/data/planned-match.spec.ts#L44)

**Periféricos**

- Runner declarado como dependência direta, não herdado transitivamente.
  [`package.json:40`](../../web/package.json#L40)

- Script não-interativo, para o `npm run test` da raiz alcançar o mobile.
  [`package.json:10`](../../web/package.json#L10)

- Instrução de agente atualizada: o comando que funciona, sem fixar contagem de arquivos.
  [`web/AGENTS.md:13`](../../web/AGENTS.md#L13)

- Correção fina: o lint da raiz quebra em dois workspaces, e não para no primeiro.
  [`AGENTS.md:36`](../../AGENTS.md#L36)
