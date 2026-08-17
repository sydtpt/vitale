Follow the review instructions below completely.

=== INSTRUÇÕES DE REVISÃO (edge-case-hunter) ===
# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.

**Inputs:**
- **content** — Content to review: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration — mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling — discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Load the content to review strictly from the parent message that launched you (not from this instruction file)
- If content is empty, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope — report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself — don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values — enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings — discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 — e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Add any newly found unhandled paths to findings; discard confirmed-handled ones

### Step 4: Deletion Check

If the diff removed or replaced meaningful code (ignore pure renames and whitespace): load `references/deletion-check.md` and follow it.

### Step 5: Present Findings

Output all findings as a single JSON array following the Output Format specification exactly.


## OUTPUT FORMAT

Return ONLY a valid JSON array of objects. Each edge-case finding contains exactly these four fields:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```

No extra text, no explanations, no markdown wrapping. An empty array `[]` is valid when nothing is found. Deletion findings from Step 4, if any, go in the same array with the extra fields defined in `references/deletion-check.md`.


## HALT CONDITIONS

- If content is empty or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>

## CONTENT SOURCE

Review the content supplied under "Review content:" in the message that launched you.

=== CONTEÚDO A REVISAR ===
### Diff rastreado desde 41ee63eb1127003626b9d144d85991ae8537e6f4 (package-lock.json resumido)
diff --git a/.gitignore b/.gitignore
index 6d84f23..1458273 100644
--- a/.gitignore
+++ b/.gitignore
@@ -9,6 +9,7 @@ build/
 .angular/
 .next/
 out/
+out-tsc/
 
 # Expo
 .expo/
diff --git a/AGENTS.md b/AGENTS.md
index 3dc2d00..1531935 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -33,8 +33,9 @@ do BMAD, em `_bmad-output/`.
 
 ## Running and verifying
 
-- `npm run lint` e `npm run test` na raiz falham (quebram no workspace `web`). Valide
-  workspace a workspace — cada `AGENTS.md` filho diz como.
+- `npm run lint` na raiz falha (quebra no workspace `web`, que não tem target `lint`).
+  Valide workspace a workspace — cada `AGENTS.md` filho diz como.
+- `npm run test` na raiz roda todos os workspaces (web em Vitest, mobile em Jest).
 - Não há CI nem git hooks: nada é verificado automaticamente no commit.
 
 ## Known pitfalls
diff --git a/CLAUDE.md b/CLAUDE.md
index 98f0ddd..8bdb8c2 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -29,8 +29,9 @@ npm run mobile:start       # QR code / Expo DevTools
 npm run mobile:ios         # Simulador iOS
 npm run mobile:android     # Emulador Android
 
-# Linting e testes — ver AGENTS.md: `npm run lint`/`npm run test` na raiz falham
+# Linting e testes — ver AGENTS.md: `npm run lint` na raiz falha; `npm run test` roda
 cd web && npx ng build                      # valida o web
+cd web && npx ng test --watch=false         # testes unitários do web (Vitest)
 cd mobile && npx tsc --noEmit && npx jest   # valida o mobile
 npm run lint -w @vitale/shared              # valida o shared
 ```
diff --git a/mobile/src/lib/planned-match.ts b/mobile/src/lib/planned-match.ts
index 6258152..dcf254e 100644
--- a/mobile/src/lib/planned-match.ts
+++ b/mobile/src/lib/planned-match.ts
@@ -37,8 +37,8 @@ export function weekDatesOf(d: Date = new Date()): string[] {
 
 /** Tipos HealthKit de musculação/força. */
 const STRENGTH_IDS = new Set<number>([11, 20, 35, 50, 59]);
-/** Tipos de baixa intensidade (mobilidade, yoga, caminhada). */
-const EASY_IDS = new Set<number>([52, 57, 66]);
+/** Tipos de baixa intensidade (yoga, pilates). */
+const EASY_IDS = new Set<number>([57, 66]);
 
 /**
  * Intensidade de uma atividade sincronizada, para casar com o `kind` planejado.
diff --git a/web/AGENTS.md b/web/AGENTS.md
index f996e5d..aeb00bc 100644
--- a/web/AGENTS.md
+++ b/web/AGENTS.md
@@ -10,8 +10,9 @@ Regras gerais do repositório: `../AGENTS.md`.
 ## Running and verifying
 
 - Valide com `cd web && npx ng build` — compila templates e TS.
-- `ng test` não roda: falta `karma-jasmine`. Os 11 `*.spec.ts` do diretório não executam
-  hoje; consertar o runner é tarefa aberta.
+- Testes unitários: `cd web && npx ng test --watch=false` — builder `@angular/build:unit-test`
+  com Vitest em Node/jsdom. Sem `--watch=false` um terminal interativo entra em watch e
+  nunca dá veredito. Use os matchers do Vitest (`toBe(true)`, não `toBeTrue()`).
 - `ng lint` não existe — `angular.json` tem só os targets `build`, `serve` e `test`.
 
 ## Conventions that differ from defaults
diff --git a/web/angular.json b/web/angular.json
index 9d1ff80..6282754 100644
--- a/web/angular.json
+++ b/web/angular.json
@@ -17,7 +17,7 @@
       "prefix": "rt",
       "architect": {
         "build": {
-          "builder": "@angular-devkit/build-angular:application",
+          "builder": "@angular/build:application",
           "options": {
             "outputPath": "dist/vitale-web",
             "index": "src/index.html",
@@ -62,16 +62,11 @@
           "defaultConfiguration": "development"
         },
         "test": {
-          "builder": "@angular-devkit/build-angular:karma",
+          "builder": "@angular/build:unit-test",
           "options": {
-            "polyfills": ["zone.js", "zone.js/testing"],
+            "buildTarget": "vitale-web:build:development",
             "tsConfig": "tsconfig.spec.json",
-            "inlineStyleLanguage": "scss",
-            "assets": [
-              { "glob": "**/*", "input": "public" }
-            ],
-            "styles": ["leaflet/dist/leaflet.css", "src/styles.scss"],
-            "scripts": []
+            "runner": "vitest"
           }
         }
       }
diff --git a/web/package.json b/web/package.json
index 0a49aa4..381c197 100644
--- a/web/package.json
+++ b/web/package.json
@@ -7,7 +7,7 @@
     "start": "ng serve",
     "build": "ng build",
     "watch": "ng build --watch --configuration development",
-    "test": "ng test",
+    "test": "ng test --watch=false",
     "lint": "ng lint"
   },
   "dependencies": {
@@ -30,10 +30,13 @@
   },
   "devDependencies": {
     "@angular-devkit/build-angular": "^21.0.0",
+    "@angular/build": "^21.0.0",
     "@angular/cli": "^21.0.0",
     "@angular/compiler-cli": "^21.0.0",
     "@types/leaflet": "^1.9.21",
     "@types/node": "^25.9.1",
-    "typescript": "~5.9.0"
+    "jsdom": "^30.0.1",
+    "typescript": "~5.9.0",
+    "vitest": "^4.0.8"
   }
 }
diff --git a/web/src/app/features/recuperacao/data/aggregate.spec.ts b/web/src/app/features/recuperacao/data/aggregate.spec.ts
index 92eb1b0..1b46153 100644
--- a/web/src/app/features/recuperacao/data/aggregate.spec.ts
+++ b/web/src/app/features/recuperacao/data/aggregate.spec.ts
@@ -61,7 +61,7 @@ describe('readinessSeries', () => {
     const today = series[series.length - 1];
     expect(today.date).toBe('2026-06-03');
     expect(today.score).not.toBeNull();
-    expect(today.hasActivity).toBeTrue();
+    expect(today.hasActivity).toBe(true);
   });
 });
 
@@ -96,7 +96,7 @@ describe('sportHealthCorrelations', () => {
   it('marca dados insuficientes com poucos dias', () => {
     const out = sportHealthCorrelations([], { vfc: new Map(), fcRepouso: new Map(), sono: new Map() }, NOW);
     expect(out.length).toBe(3);
-    expect(out.every((r) => !r.enough)).toBeTrue();
+    expect(out.every((r) => !r.enough)).toBe(true);
   });
 });
 
diff --git a/web/src/app/features/treinos/data/planned-match.spec.ts b/web/src/app/features/treinos/data/planned-match.spec.ts
index f7807ff..0c8b320 100644
--- a/web/src/app/features/treinos/data/planned-match.spec.ts
+++ b/web/src/app/features/treinos/data/planned-match.spec.ts
@@ -37,9 +37,12 @@ describe('kindForActivity', () => {
     expect(kindForActivity(50)).toBe('strength');
     expect(kindForActivity(20)).toBe('strength');
   });
-  it('classifica yoga/caminhada como easy', () => {
-    expect(kindForActivity(57)).toBe('easy');
-    expect(kindForActivity(52)).toBe('easy');
+  it('classifica yoga/pilates como easy', () => {
+    expect(kindForActivity(57)).toBe('easy'); // yoga
+    expect(kindForActivity(66)).toBe('easy'); // pilates
+  });
+  it('classifica caminhada como endurance (é atividade com GPS)', () => {
+    expect(kindForActivity(52)).toBe('endurance');
   });
 });
 
@@ -55,7 +58,7 @@ describe('autoMatch', () => {
       [plan({ date: '2026-06-03', kind: 'endurance' })],
       [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })],
     );
-    expect(out[0].done).toBeTrue();
+    expect(out[0].done).toBe(true);
     expect(out[0].doneActivityId).toBeDefined();
   });
 
@@ -64,7 +67,7 @@ describe('autoMatch', () => {
       [plan({ date: '2026-06-03', kind: 'strength' })],
       [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })], // corrida
     );
-    expect(out[0].done).toBeTrue();
+    expect(out[0].done).toBe(true);
   });
 
   it('prefere a atividade do kind compatível quando há várias', () => {
@@ -76,7 +79,7 @@ describe('autoMatch', () => {
 
   it('não marca done sem atividade no dia', () => {
     const out = autoMatch([plan({ date: '2026-06-03', kind: 'endurance' })], []);
-    expect(out[0].done).toBeFalse();
+    expect(out[0].done).toBe(false);
   });
 
   it('ignora atividades ocultas', () => {
@@ -84,7 +87,7 @@ describe('autoMatch', () => {
       [plan({ date: '2026-06-03', kind: 'endurance' })],
       [act({ startAt: '2026-06-03T07:00:00', hidden: true })],
     );
-    expect(out[0].done).toBeFalse();
+    expect(out[0].done).toBe(false);
   });
 
   it('rest nunca auto-completa', () => {
@@ -92,7 +95,7 @@ describe('autoMatch', () => {
       [plan({ date: '2026-06-03', kind: 'rest' })],
       [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })],
     );
-    expect(out[0].done).toBeFalse();
+    expect(out[0].done).toBe(false);
   });
 
   it('reverte done quando a atividade some', () => {
@@ -100,7 +103,7 @@ describe('autoMatch', () => {
       [plan({ date: '2026-06-03', kind: 'endurance', done: true, doneActivityId: 'x' })],
       [],
     );
-    expect(out[0].done).toBeFalse();
+    expect(out[0].done).toBe(false);
     expect(out[0].doneActivityId).toBeUndefined();
   });
 });
diff --git a/web/src/app/features/treinos/data/planned-match.ts b/web/src/app/features/treinos/data/planned-match.ts
index 5300ba5..8ef26eb 100644
--- a/web/src/app/features/treinos/data/planned-match.ts
+++ b/web/src/app/features/treinos/data/planned-match.ts
@@ -35,8 +35,8 @@ export function weekDatesOf(d: Date = new Date()): string[] {
 
 /** Tipos HealthKit de musculação/força. */
 const STRENGTH_IDS = new Set<number>([11, 20, 35, 50, 59]);
-/** Tipos de baixa intensidade (mobilidade, yoga, caminhada). */
-const EASY_IDS = new Set<number>([52, 57, 66]);
+/** Tipos de baixa intensidade (yoga, pilates). */
+const EASY_IDS = new Set<number>([57, 66]);
 
 /**
  * Intensidade de uma atividade sincronizada, para casar com o `kind` planejado.

### package-lock.json (só estatística)
 package-lock.json | 940 ++++++++++++++++++++++++++++++++++++++++++++++++++++--
 1 file changed, 916 insertions(+), 24 deletions(-)

### Arquivo novo, não rastreado: web/tsconfig.spec.json
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

### A spec que este diff deveria cumprir (iteração 2, após loopback bad_spec)
```markdown
---
title: 'Rodar os testes unitários do web com Vitest'
type: 'chore'
created: '2026-08-17'
status: 'in-progress'
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
- `npm run lint -w @vitale/shared` — esperado: exit 0, o path mapping para o shared continua resolvendo.
```
