# Review — Lente: Verificação contra a web e a realidade

- **Artefato revisado:** `ARCHITECTURE-SPINE.md` (migração Angular 21 → 22 do `@vitale/web`)
- **Lente:** toda decisão comprometida foi pesquisada/checada contra a realidade, em vez de afirmada de memória de treino?
- **Data da revisão:** 2026-09-02
- **Revisor:** Reviewer Gate — lente de verificação web (BMad Architecture)

## Método

Cada afirmação factual do spine foi conferida contra fontes primárias na web
(angular.dev — referência de versões, guias e API; release notes no GitHub;
blog.ninja-squad.com sobre v21 e v22; anúncio oficial da v22) **e** contra o
repositório (`web/package.json`, `web/angular.json`, `web/src/main.ts`, greps
em `web/src`). Fontes consultadas:

- https://angular.dev/reference/versions (matriz Node/TS/RxJS por versão)
- https://github.com/angular/angular/releases (releases correntes)
- https://blog.ninja-squad.com/2026/06/03/what-is-new-angular-22.0 (v22)
- https://blog.ninja-squad.com/2025/11/20/what-is-new-angular-21.0 (v21 — zoneless)
- https://angular.dev/guide/zoneless · https://angular.dev/api/core/provideZonelessChangeDetection
- https://angular.dev/reference/migrations · https://angular.dev/reference/migrations/control-flow
- https://angular.dev/api/core/Service · https://angular.dev/api/common/NgIf
- Anúncio oficial v22 (Angular no X + cobertura InfoQ, jun/2026)

## Verificação item a item

### (a) Angular 22 exige TypeScript ≥ 6.0 e Node ≥ 22? — **CONFIRMADO, com imprecisão no Node**

A matriz oficial (angular.dev/reference/versions) para **Angular 22.0.x**:

> Node.js: `^22.22.3 || ^24.15.0 || ^26.0.0` · TypeScript: `>=6.0.0 <6.1.0` · RxJS: `^6.5.3 || ^7.4.0`

- O pin `typescript ~6.0` do spine é **exatamente** o range oficial (`>=6.0.0 <6.1.0`). ✅
- "Node ≥ 22" / "22 LTS" é **impreciso**: o piso real na linha 22 é **22.22.3**
  (um Node 22.12, que satisfaz a v21, **não** satisfaz a v22), a linha 24 pede
  ≥ 24.15.0, versões ímpares (23/25) não são suportadas, e a v26 entrou. Ver F-3.
- `rxjs ~7.8` do spine está dentro do range oficial. ✅

### (b) OnPush é o default de changeDetection na v22 + migração automática que adiciona Eager? — **CONFIRMADO**

Ninja Squad v22: *"Since Angular v22, the default strategy is now `OnPush`!"* e a
migração automática *"automatically add[s] `changeDetection: ChangeDetectionStrategy.Eager`
to all components that do not specify a strategy yet"* (e troca `Default` por `Eager`).
Anúncio oficial confirma OnPush default. As demais migrações automáticas citadas
no AD-2 e no Structural Seed também existem na v22: **safe-navigation** (embrulha
optional chaining para preservar o comportamento anterior) e **canMatch** (novo
terceiro parâmetro `currentSnapshot`, com migração automática). ✅

**Checado contra o repo:** os 87 componentes de `web/src` declaram
`ChangeDetectionStrategy.OnPush` explicitamente (87/87; zero `Default`), então a
previsão do AD-4 de que a migração Eager "deve ser no-op" **se sustenta**. ✅
(Mas o número "~140 componentes" está errado — ver F-2.)

### (c) Signal Forms, resource()/httpResource() e @angular/aria estáveis na v22? — **CONFIRMADO**

Ninja Squad v22: *"the signal forms APIs are no longer experimental! They graduated
to stable"*; *"`resource()`, `rxResource()`, and `httpResource()` are now stable and
ready to use in production"*; `@angular/aria` *"is no longer in developer preview and
is now generally available for production use"*. O anúncio oficial da v22 (03/06/2026)
repete os três. ✅ — sustenta o AD-5 e as entradas de Deferred.

### (d) O decorator @Service existe? — **CONFIRMADO**

Existe na v22 e está documentado em https://angular.dev/api/core/Service, sem aviso
de experimental/preview; Ninja Squad: equivale a `@Injectable({ providedIn: 'root' })`
em sintaxe curta. ✅ A contagem de "17 serviços `providedIn: 'root'`" do AD-8 **bate**
com o repo (17 arquivos). A tag `[ASSUMPTION]` do AD-8 pode ser parcialmente
resolvida: a *existência* está verificada; só a política "só em código novo" segue
sendo escolha do projeto.

### (e) paramsInheritanceStrategy default virou 'always'? — **CONFIRMADO**

Ninja Squad v22: *"the `paramsInheritanceStrategy` option is now set to `'always'`
by default"* — e **não há migração automática** para isso. ✅
**Checado contra o repo:** `web/src/main.ts` não fixa a opção e as rotas são todas
**irmãs planas** (nenhum `children`; `workout-history/:slug/:id` e `registros/:id`
são paths multi-segmento no mesmo nível, não aninhamento de config) — logo a
afirmação do AD-7 de que "nada muda" hoje está correta. ✅ (O "aninha" do
CLAUDE.md refere-se à URL, não à árvore de rotas — sem conflito real.)

### (f) `ng generate @angular/core:control-flow` ainda existe na v22? — **CONFIRMADO**

Documentado em https://angular.dev/reference/migrations/control-flow com esse
comando exato, sem aviso de remoção. ✅ E `NgIf` está *"deprecated since v20.0"*
(angular.dev/api/common/NgIf) — o "deprecados desde a v20" do AD-6 está certo. ✅
**Checado contra o repo:** os 4 arquivos com `*ngIf`/`*ngFor` são exatamente os 4
que o AD-6 nomeia (registro-editor, habit-editor, habit-list,
planned-workout-editor). ✅ Nota menor: a doc não descreve targeting por arquivo
individual — o schematic pergunta/aceita um *path*; rodá-lo "nos 4 arquivos" na
prática é rodar nos diretórios e conferir o diff.

### (g) `provideZonelessChangeDetection()` é o nome estável correto? — **CONFIRMADO, mas a receita do AD-3 está desatualizada**

O nome está certo e é **estável desde a v20.2** (angular.dev/api). ✅ Porém a doc
oficial diz mais: *"Zoneless is the default in Angular v21+ so you do not need to
do anything to enable it"* — e a nota da API manda apenas garantir que
`provideZoneChangeDetection` **não** esteja sobrescrevendo o default. Adicionar
`provideZonelessChangeDetection()` aos providers é a receita **da v20**; na v22 é
redundante. E há um fato do repo que o spine não registra: o `ng update` para a
v21 adiciona `provideZoneChangeDetection()` automaticamente "se necessário"
(Ninja Squad v21) — e o `main.ts` deste app **não o tem**, ou seja, o app em v21
**provavelmente já roda o scheduler zoneless hoje**, com zone.js carregado porém
inerte. Ver F-1.

### (h) Última versão do Angular 22 em set/2026 — **CONFIRMADO o contexto do pin**

GitHub releases (consultado em 02/09/2026): estável mais recente é **22.1.4**
(27/08/2026); **22.2.0-next.4** em pré-release; 21.x e 20.x seguem recebendo
patches. O pin `^22.0.0` do spine é válido e resolverá para 22.1.x — coerente
com `ng update @angular/core@22`. ✅ (Registrar 22.1.x como série corrente
evitaria surpresa — ver F-4.) A v22.0.0 saiu em 03/06/2026, batendo com a
fonte ninja-squad citada no frontmatter (URL válida, verificada).

## Baseline do repo vs. spine

| Afirmação do spine | Realidade no repo | Veredito |
| --- | --- | --- |
| Angular 21 hoje, `zone.js` em polyfills e deps | `^21.0.0`, `"polyfills": ["zone.js"]`, `zone.js ~0.15.0` | ✅ bate |
| Runner já é `@angular/build:unit-test` + Vitest | `angular.json` test: builder `@angular/build:unit-test`, `runner: "vitest"`; `vitest ^4.0.8` | ✅ bate (AD-9) |
| TypeScript atual | `~5.9.0` (compatível com a v21: `>=5.9 <6.0`) | ✅ bate |
| "~140 componentes existentes" declarando OnPush | **87 arquivos** com `@Component` (90 decorators), 87/87 com OnPush | ❌ número errado (F-2) |
| "79 arquivos em `@if`, 4 em `*ngIf`" | **69** arquivos com `@if`; 4 com `*ngIf` (mesmos 4 nomes) | ❌ 79→69 (F-2) |
| "10 arquivos com `ngModel`" | 10 | ✅ bate |
| "17 serviços `providedIn: 'root'`" | 17 | ✅ bate |
| "sem `FormGroup`/`FormBuilder`" (implícito no AD-5) | 0 ocorrências em `web/src` | ✅ bate |
| Rotas planas em `main.ts`, sem `paramsInheritanceStrategy` | confirmado (nenhum `children`) | ✅ bate (AD-7) |
| Bootstrap: `provideRouter` + `provideAnimationsAsync`, **sem** provider de zone | confirmado em `main.ts:157-162` | ⚠️ implica app já zoneless na v21 (F-1) |
| "engine Node mínima 22" | raiz `package.json` declara `"engines": { "node": ">=20.0.0" }` e o spine não aponta esse arquivo | ⚠️ (F-5) |

## Findings

### F-1 `[medium]` — AD-3 prescreve a receita zoneless da v20; desde a v21 zoneless é o default (e o app provavelmente já roda zoneless)

O AD-3 manda adicionar `provideZonelessChangeDetection()` aos providers. A doc
oficial é explícita: *"Zoneless is the default in Angular v21+ so you do not need
to do anything to enable it."* Como o `main.ts` deste app (já em v21) **não** tem
`provideZoneChangeDetection()`, o scheduler zoneless provavelmente já está ativo
hoje — zone.js está no bundle, mas inerte. Consequências: (1) a instrução do AD-3
é redundante (inofensiva, mas denuncia memória da v20 em vez de checagem do
default atual — exatamente o que esta lente caça); (2) o risco real do passo 3 do
Structural Seed é **menor** do que o spine assume: o trabalho é remover polyfill
+ dependência (os passos oficiais do guia zoneless: tirar `zone.js` do
`angular.json`, desinstalar o pacote), não "virar a chave" de CD. Sugestão:
reescrever o AD-3 como "garantir a ausência de `provideZoneChangeDetection` (o
default v21+ já é zoneless; provider explícito é opcional) + remover
polyfill/dep", e registrar como *verificação* do passo 3 confirmar no app em v21
que nada depende de zone antes do update.

### F-2 `[medium]` — Contagens do repo afirmadas sem conferência: "~140 componentes" (real: 87) e "79 arquivos em @if" (real: 69)

O AD-4 fala em "~140 componentes existentes" e o AD-6 em "79 arquivos em `@if`".
Grep no repo: **87** arquivos com `@Component` (90 decorators no total) e **69**
arquivos com `@if`. Os demais números (4 `*ngIf` — com os mesmos 4 nomes de
arquivo —, 10 `ngModel`, 17 serviços) batem exatamente, o que sugere que estas
duas contagens vieram de outra fonte/momento e não foram re-checadas. Nenhuma
regra muda por causa disso, mas números errados num spine minam a confiança de
que o resto foi verificado — corrigir para 87 e 69 (ou remover a precisão falsa
e dizer "todos os componentes"/"a grande maioria dos templates").

### F-3 `[low]` — "Node ≥ 22" é mais frouxo que o requisito real da v22

O requisito oficial é `^22.22.3 || ^24.15.0 || ^26.0.0`. Um Node 22.x antigo
(ex.: 22.12, válido na v21) **falha** na v22, e ímpares não servem. Registrar o
range exato no Stack e no AD-2 evita um `ng update` que quebra por engine no CI
ou na máquina local.

### F-4 `[low]` — Pin `^22.0.0` correto, mas a série corrente já é 22.1.x

Em 02/09/2026 a última estável é **22.1.4** (22.2.0 em next). `^22.0.0` e o
`ng update` resolverão para 22.1.x — comportamento desejado, só vale o registro
no spine para ninguém estranhar o lockfile em 22.1.

### F-5 `[low]` — "engine Node mínima 22" não aponta onde isso é fixado; a raiz do monorepo declara `>=20.0.0`

O AD-2 compromete "engine Node mínima 22", mas o único `engines` do repo é o da
raiz (`package.json`: `"node": ">=20.0.0"`), que o spine não lista entre os
arquivos tocados. Ou o AD-2 nomeia esse arquivo (com o range real da F-3), ou a
frase fica sem mecanismo de enforcement.

### F-6 `[low]` — AD-8 pode resolver metade da tag [ASSUMPTION]

A existência e a semântica do `@Service` estão confirmadas em fonte primária
(angular.dev/api/core/Service; equivalência com `@Injectable({ providedIn: 'root' })`).
O que resta de assunção é apenas a política "só em código novo". Atualizar a tag
evita que um leitor futuro re-questione um fato já verificado.

## O que foi verificado e está correto (sem finding)

- TS `~6.0` = range oficial exato da v22 (`>=6.0.0 <6.1.0`).
- OnPush default na v22 + migração automática Eager — e o no-op previsto pelo
  AD-4 confere no repo (87/87 componentes com OnPush explícito, zero `Default`).
- Migrações automáticas citadas (safe-navigation, canMatch, Eager) existem na v22.
- Signal Forms, `resource()`/`httpResource()`/`rxResource()` e `@angular/aria`
  estáveis na v22 (anúncio oficial + ninja-squad).
- `paramsInheritanceStrategy: 'always'` é o novo default, sem migração — e as
  rotas do app são planas (verificado em `main.ts`), então o AD-7 se sustenta.
- `ng generate @angular/core:control-flow` existe e está documentado na v22;
  `*ngIf`/`*ngFor` deprecados desde a v20 (confirmado na API reference).
- `provideZonelessChangeDetection` é o nome estável (desde v20.2) — apenas a
  *necessidade* dele mudou (F-1).
- AD-9: o repo já usa `@angular/build:unit-test` + Vitest 4; a v22 até ganhou
  suporte a `fakeAsync`/`flush` com zone em Vitest, o que torna a proibição do
  patch de zone do AD-9 uma escolha consciente (e correta para app zoneless),
  não uma limitação técnica.
- WebMCP é experimental na v22 (`declareExperimentalWebMcpTool()` etc.) —
  coerente com o Deferred.
- Fontes do frontmatter válidas: o tag v22.0.0 existe (03/06/2026) e a URL da
  ninja-squad resolve.

## Veredito

**Aprovado com correções pontuais.** O spine está — em quase tudo — alinhado com
as fontes primárias da v22: dos oito pontos comprometidos, sete conferem contra a
web e contra o repo. Os dois desvios reais são de *staleness*: o AD-3 repete a
receita zoneless da v20 (ignora que zoneless é default desde a v21 e que este app
provavelmente já roda assim), e duas contagens do repo (~140 componentes, 79
`@if`) estão erradas e visivelmente não conferidas. Nenhum finding bloqueia o
epic; F-1 e F-2 devem ser corrigidos antes de o spine sair de `draft`.
