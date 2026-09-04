---
review-of: ../ARCHITECTURE-SPINE.md
reviewer: rubric-walker (Reviewer Gate)
date: '2026-09-02'
verdict: revisar-antes-de-aprovar
---

# Review — Architecture Spine «Migração Angular 22»

**Veredito:** spine bem ancorado no brownfield nos pontos centrais e com as divergências
clássicas de migração fechadas — mas **não aprovável como está**: dois findings high
(docs autoritativos do repo ficam contradizendo o spine sem passo de refresh; AD-8
manda API experimental para produção contra o critério do próprio spine) e três
dimensões silenciosas de altitude de epic.

## Como esta revisão foi feita

Conferido contra o código real em `main`/branch atual:

- `/Users/sydtpt/Projects/life-organizer/web/AGENTS.md`, `AGENTS.md` (raiz), `CLAUDE.md`
- `/Users/sydtpt/Projects/life-organizer/web/angular.json`, `web/package.json`, `web/src/main.ts`, `web/tsconfig.json`
- `/Users/sydtpt/Projects/life-organizer/.github/workflows/ci.yml`
- greps quantitativos em `web/src` (control flow, ngModel, serviços, componentes, zone, animations, fakeAsync)
- As duas fontes citadas no frontmatter foram buscadas e **existem**: o release
  `v22.0.0` no GitHub e o post da Ninja Squad (03/06/2026). As alegações do spine
  foram cruzadas com ambas.

## Checklist do bom spine — item a item

### 1. Fixa os pontos reais de divergência (sem deixar nenhum de fora) — PARCIAL

Os eixos clássicos de uma migração Angular estão cobertos e bem escolhidos:
versão/schematics (AD-2), zoneless (AD-3), estratégia de CD (AD-4), dialeto de
formulário (AD-5), dialeto de template (AD-6), default novo do router (AD-7),
decorator de serviço (AD-8), runner de teste (AD-9), convenção de nome de arquivo
(AD-10). O AD-7 merece elogio: a Ninja Squad confirma que **não há migração
automática** para o novo default de `paramsInheritanceStrategy` — é exatamente o
tipo de mudança silenciosa que um spine existe para fixar.

**Dois pontos reais ficaram de fora** (ver F1 e F5): a atualização dos docs
autoritativos (`web/AGENTS.md` manda declarar OnPush em todo componente — o oposto
do AD-4) e o destino de `@angular/animations`/`provideAnimationsAsync` (pacote
deprecado desde a v20.2, presente no bootstrap, com **zero** uso de `trigger()` no
app — sem AD, uma story nova pode introduzir animations do Angular enquanto outra
usa CSS).

### 2. Rules aplicáveis/verificáveis — SIM, com uma ressalva

Quase todas as Rules são verificáveis por grep/diff e previnem a divergência
declarada:

- AD-3: `grep zone.js` em `package.json`/`angular.json` — verificável. Confirmado
  que hoje `zone.js ~0.15.0` está nas deps e `"polyfills": ["zone.js"]` no
  `angular.json`; não há `NgZone`/`ChangeDetectorRef`/`markForCheck` em `web/src`
  (0 ocorrências), então o custo do zoneless é de fato baixo — o spine acerta.
- AD-4: a expectativa de que a migração automática `Eager` seja no-op é verificável
  e **correta**: os 87 componentes declaram OnPush (87 de 87), e a migração só toca
  componente com `changeDetection` indefinido.
- AD-5: "100% ngModel por editor, sem híbrido" é checável por arquivo. `FormGroup`/
  `FormBuilder`: 0 usos hoje — a proibição não briga com nada existente.
- AD-6: lista de 4 arquivos **bate exatamente** com o grep (habit-editor,
  habit-list, registro-editor, planned-workout-editor).
- AD-9: verificável; nenhum spec usa `fakeAsync`/`waitForAsync` hoje (0 em 11
  specs), então a proibição do patch de zone não quebra nada.

Ressalva: AD-9 diz o que é **proibido** mas não o padrão positivo para
assincronia em teste zoneless (`await fixture.whenStable()` etc.) — ver F9.

### 3. Deferred não pode deixar duas unidades divergirem — QUASE

Os itens Deferred estão bem recortados (SSR, `resource()`, `@angular/aria`,
big-bang de Signal Forms, remoção em massa de OnPush) — nenhum deles abre
divergência entre stories porque AD-5/AD-4 fixam a regra do "enquanto isso".
**Exceção:** o item "Mobile / shared" tem a justificativa factualmente invertida
(F3) — não abre divergência imediata, mas orienta errado quem tocar no eixo TS.

### 4. Tecnologia atual e verificada — SIM, com um alerta

Cruzado com o release oficial e a Ninja Squad:

| Alegação do spine | Fonte confirma? |
| --- | --- |
| Angular 22 exige TS 6.x (veta 5.9) | Sim (ambas) |
| Node: derruba v20 (mínimo 22) | Sim |
| OnPush vira default; existe `ChangeDetectionStrategy.Eager` + migração | Sim (ambas) |
| Signal Forms estável | Sim (ambas) |
| `paramsInheritanceStrategy` default `'always'`, sem migração automática | Sim |
| Migrações automáticas: safe-navigation, canMatch, Eager | Sim |
| `@angular/aria` GA | Sim (Ninja Squad; ausente do changelog) |
| `@Service` | **Divergência: o changelog oficial o marca como experimental** — ver F2 |

`*ngIf`/`*ngFor` deprecados desde a v20: correto. Vitest ^4, RxJS ~7.8,
supabase-js ^2, pnpm via `packageManager`: batem com o `package.json` real.

### 5. Ratifica o brownfield — PARCIAL

Acertos: rotas em `main.ts` sem `app.routes.ts` (confirmado — rotas são planas em
config, então AD-7 é seguro), builder `@angular/build:unit-test` + Vitest
(confirmado no `angular.json`), prefixo `rt`, teto de 1000 linhas do PostgREST,
supabase-js sem HttpClient (0 usos de `HttpClient`), 10 arquivos com `ngModel`
(exato), 17 serviços `providedIn: 'root'` (exato).

Erros de ratificação: números de componentes e de `@if` desatualizados (F6), o
eixo TypeScript do monorepo descrito ao contrário (F3), e o portão de validação
declarado menor do que o brownfield exige para mudança de dependência (F4a).
E a contradição não resolvida com `web/AGENTS.md` (F1) é a mais séria, porque o
próprio CLAUDE.md declara: "em caso de divergência, o AGENTS.md vale".

### 6. Toda dimensão da altitude decidida/deferida/aberta — NÃO

Dimensões silenciosas encontradas:

- **Docs/portais de convenção** (F1) — nem decidido nem deferido.
- **Deploy/hosting do web e baseline de browsers** (F4b) — um major de Angular
  sobe o baseline de browsers suportados; o repo não versiona deploy do web
  (CLAUDE.md admite isso para EAS/edge functions, e para o web não há nada).
  Nem uma linha de Deferred/questão aberta.
- **`@angular/animations`** (F5) — nem decidido nem deferido.
- Positivo: o CI **já** roda Node 22 (`NODE_VERSION: '22'` no `ci.yml`), então
  AD-2 não quebra o pipeline — mas o spine não registra essa conferência, e
  não diz onde mora o "Node mínimo 22" (o `engines` da raiz hoje é `>=20.0.0`).

### 7. Sem contradição interna — UMA

AD-8 manda `@Service` em serviço novo; o Deferred justifica excluir o WebMCP com
"nada em produção sobre API experimental". Se `@Service` é experimental na v22
(como diz o changelog oficial), o spine aplica dois pesos ao mesmo critério (F2).
Fora isso, os ADs são coerentes entre si — em particular AD-3/AD-4/AD-9 formam um
conjunto consistente (zoneless → OnPush default → sem patch de zone em teste).

## Findings

### F1 — HIGH — Docs autoritativos ficam contradizendo o spine; nenhum passo os atualiza

`web/AGENTS.md` (linha 20): "Declare `changeDetection: ChangeDetectionStrategy.OnPush`
em todo componente (76 de 76)" — o **oposto** do AD-4. `AGENTS.md` raiz (linha 74):
"5.9 no web (teto do Angular 21, que veta TS ≥ 6)" — falso após AD-2. `CLAUDE.md`:
"Angular 21 dashboard analítico". Como o CLAUDE.md declara que **o AGENTS.md vale**
em divergência, um agente executando story vai declarar OnPush e manter TS 5.9 por
obediência ao doc — exatamente a divergência que AD-4 diz prevenir. O spine precisa
de um passo no Structural Seed (ou AD): refresh de `web/AGENTS.md`, `AGENTS.md`
raiz e `CLAUDE.md` via `bmad-project-context` ao fim do epic.

### F2 — HIGH — AD-8 empurra API experimental (`@Service`) contra o critério do próprio spine

O changelog oficial do v22.0.0 apresenta `@Service` como **experimental**; a Ninja
Squad o descreve sem qualificar. O spine já marca AD-8 como `[ASSUMPTION]`, mas a
Rule como escrita ("serviço root novo usa `@Service`") coloca API experimental em
produção — o mesmo motivo pelo qual o WebMCP foi (corretamente) deferido. Conserto:
confirmar o status na docs oficial (angular.dev); se experimental, inverter a
regra — "`@Injectable({ providedIn: 'root' })` continua o padrão; `@Service` só
quando estabilizar" — e mover a adoção para Deferred.

### F3 — MEDIUM — Deferred "Mobile / shared" ratifica o brownfield ao contrário e ignora o AD-15 do repo

O texto diz que o TS do shared "segue o range que o mobile suporta até o epic
próprio conferir compatibilidade com TS 6" — mas o **mobile já pina TS `~6.0.3`**
(`mobile/package.json`); quem vetava TS 6 era o web/Angular 21 (AGENTS.md raiz).
O shared está em `~5.8.0` pela regra AD-15 do repo ("menor entre os consumidores",
citada no `ci.yml` e no AGENTS.md). Após esta migração o menor consumidor passa a
ser 6.0 — a decisão sobre o shared deveria citar o AD-15 e decidir (ou deferir
nomeando-o): sobe o shared para ~6.0 junto, ou fica em 5.8 como guarda conservadora.
Como está, orienta errado quem tocar no eixo TS.

### F4 — MEDIUM — Envelope operacional com três buracos

(a) A linha de Validação diz "`pnpm --filter @vitale/web build` + `test` são o
portão — o CI roda exatamente isso", mas o `ci.yml` roda **os três workspaces**, e
o AGENTS.md raiz manda: "Mexeu em dependência? Valide os TRÊS" — o próprio
comentário do CI relata o caso em que o TS 6 do SDK 57 derrubou o build do web com
a suíte do mobile verde. Uma migração é a mudança de dependência por excelência
(lockfile compartilhado): o portão declarado no spine deve ser os três workspaces.
(b) Deploy/hosting do web e baseline de browsers do Angular 22: dimensão ausente —
nem Deferred, nem questão aberta. (c) "engine Node mínima 22" não diz onde mora: o
`engines` da raiz é `>=20.0.0` e cobre o monorepo inteiro (mexer nele toca
mobile/shared, que o spine diz não tocar); registrar que o CI já está em 22.

### F5 — MEDIUM — `@angular/animations` é dimensão silenciosa

`provideAnimationsAsync()` é 1 dos 2 providers do bootstrap (`main.ts:160`), o
pacote está nas deps (`^21.0.0`), está deprecado desde a v20.2 — e **nenhum**
componente usa `trigger()`/animations. A migração deveria decidir: remover provider
+ dependência (barato, alinhado ao espírito do epic), ou manter e proibir
animations do Angular em código novo (CSS é o caminho). Sem AD, duas stories podem
divergir no dialeto de animação.

### F6 — LOW — Números desatualizados no texto dos ADs

AD-4 fala em "~140 componentes"; o real é **87** (87 de 87 com OnPush). AD-6 fala
em "79 arquivos em `@if`"; o real é **69**. Os demais números batem (10 `ngModel`,
17 serviços, 4 arquivos de control flow com lista exata). Não muda decisão alguma,
mas um spine que erra contagem verificável perde autoridade diante das stories.

### F7 — LOW — Colisão de namespace `AD-n` com os ADs vigentes do repo

O repo já usa `AD-14`, `AD-15`, `AD-17`, `AD-18` (CLAUDE.md, `ci.yml`), e o
`architecture.test.ts` do shared cobre "AD-1, AD-3, AD-4" **do conjunto do repo** —
homônimos dos ADs deste spine com significado totalmente diferente. Story que cite
"AD-4" é ambígua. Prefixar (ex.: `MIG-4`) ou qualificar sempre.

### F8 — LOW — AD-2 não garante que o `ng update` roda sob pnpm

Não há `cli.packageManager` no `angular.json`. Se o CLI resolver para npm ao
instalar, recria a árvore plana — o pitfall número um do AGENTS.md raiz. A Rule do
AD-2 deveria fixar `"cli": { "packageManager": "pnpm" }` (ou equivalente) antes do
update.

### F9 — LOW — AD-9 proíbe sem prescrever

Proibir o patch de zone está certo; falta o padrão positivo para assincronia em
teste zoneless (`await fixture.whenStable()`, `vi.useFakeTimers`, autoDetect).
Hoje 0 specs usam `fakeAsync`, então o risco é só prospectivo — uma frase resolve.

## Pontos fortes (para preservar na revisão)

- AD-7 fixa uma mudança de default **sem migração automática** — o achado mais
  valioso do spine, confirmado na fonte.
- AD-1 e AD-10 ancoram o anti-escopo com precisão (sem `app.routes.ts`, sem style
  guide sem sufixo) — ratificam o `main.ts` e as 17 features reais.
- AD-4 com a expectativa de no-op da migração `Eager` transforma um schematic em
  teste de conformidade — elegante e verificável (e correto: 87/87 OnPush).
- A ordem do Structural Seed (verde a cada passo, zoneless separado do bump) é a
  sequência certa para bisect barato.
- Deferred de SSR/`resource()`/aria com justificativa correta para este app
  (SPA client-side, dados via supabase-js sem HttpClient — confirmado: 0 usos).

## Recomendação

Revisar antes de aprovar: resolver F1 e F2 (bloqueiam), incorporar F3–F5 como
correções de texto/AD novo, e varrer F6–F9 numa passada. Nenhum finding invalida a
espinha do desenho — o paradigma, a ordem e os anti-escopos estão certos.
