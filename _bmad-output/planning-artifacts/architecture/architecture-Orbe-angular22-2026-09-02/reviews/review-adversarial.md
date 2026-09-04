---
review-of: ../ARCHITECTURE-SPINE.md
lens: adversarial
method: >
  Construir pares de unidades um nível abaixo do spine (duas stories/PRs da
  migração, ou dois devs em features paralelas durante o epic) que obedeçam
  cada AD ao pé da letra e ainda assim construam incompatível. Cada par que
  fecha é um buraco a tratar com AD novo ou apertado.
date: '2026-09-02'
verdict: needs-changes
evidence-base: >
  Lidos contra o repo real: web/src/main.ts, web/angular.json, web/package.json,
  web/tsconfig*.json, packages/shared/package.json + tsconfig.json,
  mobile/tsconfig.json + package.json, .github/workflows/ci.yml, AGENTS.md
  (AD-15/AD-17 do projeto), e greps de ngModel / *ngIf / fakeAsync / eventos de
  mapa / componentes OnPush.
---

# Revisão Adversarial — Spine da Migração Angular 22

**Veredito:** o spine acerta o recorte (paradigma intacto, zoneless no mesmo
epic, oportunismo em forms/`@Service`) e a Structural Seed dá uma ordem sã —
mas ele deixa **quatro pares adversariais fecharem**: dois ADs disputando os
mesmos três arquivos, um Deferred que contradiz o AD-15 do projeto (e erra um
fato sobre o mobile), um passo zero ausente que pode detonar o ADR 0016, e a
ausência de portão para branches em voo quando o zoneless mergear. Nenhum é
fatal; todos são fecháveis com um AD novo ou uma frase a mais.

---

## F1 — AD-5 × AD-6 disputam os mesmos três arquivos; "tocado" é indefinido

**Severidade: high**

Os quatro arquivos do AD-6 (confirmados por grep — são exatamente estes):

```
registro-editor.component.ts    ← também tem ngModel (AD-5)
habit-editor.component.ts       ← também tem ngModel (AD-5)
planned-workout-editor.component.ts ← também tem ngModel (AD-5)
habit-list.component.ts         ← só control flow
```

Três dos quatro são simultaneamente alvo obrigatório do AD-6 (*"o legado sai
neste epic"*) e editores `ngModel` regidos pelo AD-5 (*"migram **quando
tocados**"*). O spine não define "tocado".

**O par que fecha:**

- **Dev A** (story do AD-6) roda `ng generate @angular/core:control-flow` no
  `registro-editor` — reescrita mecânica do template, PR aberto. Obedece o
  AD-6 à risca.
- **Dev B** (feature paralela em registros) lê o AD-5 ao pé da letra: o
  editor foi *tocado* pelo PR do Dev A (ou pelo seu próprio ajuste de um
  campo), logo *deve* migrar para Signal Forms. Converte o mesmo template e o
  TS inteiro. Obedece o AD-5 à risca.

Resultado: duas reescritas do mesmo template em paralelo. No merge, conflito
total; resolvido sob pressão, o provável é um formulário **híbrido**
(ngModel + Signal Forms no mesmo editor) — exatamente o que o AD-5 proíbe.
E há a leitura inversa igualmente conforme: se o schematic do AD-6 "toca" o
editor, então o AD-6 — vendido como passo mecânico de 4 arquivos — arrasta
**três migrações de Signal Forms para dentro do epic**, contradizendo o
próprio Deferred (*"migração em massa dos 10 editores fica oportunista"*).

**Fechar com:** AD novo (ou parágrafo no AD-5) com duas regras:

1. **"Tocado" = mudança funcional no formulário** (campo novo, validação,
   fluxo de submit). Reescrita mecânica — schematic de control flow, rename,
   format — explicitamente **não** conta.
2. **Exclusividade de migração:** um editor só migra para Signal Forms num PR
   que declare essa migração como escopo; dois PRs abertos sobre o mesmo
   editor exigem que o de forms rebaseie sobre o de control flow, nunca o
   contrário (o do AD-6 é mecânico e mergeia primeiro).

---

## F2 — Deferred "não toca o shared" × AD-15 do projeto — e o fato citado sobre o mobile está errado

**Severidade: high**

O Deferred do spine diz:

> "o TS do shared segue o range que o mobile suporta **até o epic próprio
> conferir compatibilidade com TS 6**"

Isso pinta o mobile como retardatário. O repo diz o contrário:
`mobile/package.json` já pina `typescript: ~6.0.3`, e o
`mobile/tsconfig.json` mapeia `@vitale/shared → ../packages/shared/src/index.ts`
— ou seja, **o mobile já compila o fonte do shared com TS 6 hoje**, e até
tem comentário no tsconfig explicando um ajuste exigido pelo TS 6. O
retardatário é o **web** (5.9, teto do Angular 21 — é o que o pitfall do
AGENTS.md registra). O shared pina `~5.8.0` no próprio devDependencies.

**O triângulo pós-migração:** com o AD-2 aplicado, os dois consumidores ficam
em TS 6.x. O AD-15 do projeto (AGENTS.md: o núcleo compila com *"o menor
TypeScript entre os consumidores"*) passa a mandar o shared para ~6.0 — e o
Deferred do spine proíbe tocá-lo. Dois ADs vigentes em contradição direta.

**O par que fecha:**

- **Dev A** (PR da migração) obedece o Deferred: web sobe para TS 6, shared
  fica intacto em 5.8.
- **Dev B** (feature de mobile na mesma janela) obedece o AD-15 como escrito:
  o menor consumidor agora é 6.0, então adiciona um modelo no shared usando
  recurso só-TS6 — o `tsc` do mobile passa verde na máquina dele (compila o
  shared com 6.0.3). O job `shared` do CI (tsc 5.8) fica vermelho num PR que
  "não mexeu na config de ninguém". Ou pior: Dev B sobe o `typescript` do
  shared para ~6.0 "porque o AD-15 manda", por baixo do PR da migração.

Além do conflito, dois comentários canônicos ficam **falsos** no dia do merge:
o pitfall do AGENTS.md ("5.9 no web… TS ≥ 6 vetado") e o comentário do job
`web` do CI ("o build é o que reprova um recurso só-TS6 que entre no núcleo")
— pós-migração o build do web **aceita** TS6, e o guard efetivo passa a ser
só o lint 5.8 do shared, que ninguém decidiu manter.

**Fechar com:** AD novo, com duas cláusulas:

1. **Durante o epic**, o `typescript` do shared fica congelado onde está —
   recurso só-TS6 no núcleo continua proibido até o fim do epic (o lint 5.8
   é o portão; nomeá-lo como tal).
2. **Passo final do epic** (novo nó na Structural Seed): shared sobe para
   `~6.0`, e o mesmo PR atualiza o pitfall do AGENTS.md e o comentário do job
   `web` no ci.yml — senão a documentação viva do AD-15 e do AD-17 fica
   mentindo. (Se a decisão for *não* subir, o AD precisa dizer isso e o
   porquê, revogando a leitura literal do AD-15.)

---

## F3 — AD-2 manda `ng update` num workspace onde o Angular CLI pode escolher o npm

**Severidade: high**

O AD-2 exige `pnpm exec ng update @angular/core@22 @angular/cli@22` *dentro de
`web/`*. Mas `ng update` **instala dependências por conta própria**, e escolhe
o gerenciador assim: campo `cli.packageManager` do angular.json → senão,
detecção por lockfile na raiz do workspace Angular. Verificado no repo:

- `web/angular.json` **não tem** bloco `cli` (logo, sem `packageManager`);
- `web/` **não tem lockfile** — o `pnpm-lock.yaml` mora na raiz do monorepo,
  invisível para a detecção do CLI.

O caminho provável do `ng update` sem passo prévio é **cair no npm**: nasce um
`web/package-lock.json` e uma árvore plana dentro de `web/node_modules` — a
catástrofe literal contra a qual o CLAUDE.md e o ADR 0016 avisam ("não misture
npm install aqui: ele recria uma árvore plana e traz de volta as colisões").
O `--frozen-lockfile` do CI pegaria o estrago *depois*, com um diff sujo e um
dev confuso.

**O par que fecha:** nem precisa de dois devs — um único dev obedecendo o
AD-2 ao pé da letra já produz o desastre. Mas o par existe: **Dev A** roda o
`ng update` (npm silencioso, lockfile npm commitado junto do diff gigante da
migração, ninguém nota no review); **Dev B** roda `pnpm install` na sequência
e o estado dos dois node_modules diverge do que qualquer um testou.

**Fechar com:** apertar o AD-2 com um **passo zero explícito**, antes de
qualquer `ng update`:

```
ng config cli.packageManager pnpm     # grava "cli": {"packageManager": "pnpm"} no angular.json
```

e uma cláusula de verificação: *o diff do update não pode conter
`package-lock.json` nem `node_modules`; se contiver, o update rodou com o
gerenciador errado — descartar e refazer, nunca "consertar por cima".*

---

## F4 — AD-3 não tem portão para branches em voo; AD-9 proíbe o patch mas não as APIs que o exigem

**Severidade: high**

O AD-3 declara: *"código que dependa de zone para atualizar a tela é defeito,
não estilo"* — declaração correta, **sem mecanismo**. O ponto cego é temporal:

**O par que fecha:**

- **Dev A** mergeia o passo 3 (zoneless): provider trocado, polyfill fora,
  `zone.js` removido do package.json. Build verde, testes verdes.
- **Dev B** tem uma branch de feature **cortada antes do passo 3** (a própria
  `feat/registros-detalhe` está nessa posição hoje). Todo o código dele foi
  escrito e validado sob zone. Um callback de terceiro que mutasse campo
  simples — `map.on('moveend', () => this.center = …)` num componente de
  mapa, um `setTimeout` num store — renderizava porque a zone disparava CD.
  Depois do rebase: **build verde, testes (jsdom, sem mapa real) verdes,
  tela congelada em runtime**. Nenhum portão do spine ou do CI acusa.

Constatação a favor do spine: os dois componentes de mapa atuais
(`activity-map`, `country-map`) já escrevem em `signal()` dentro do
`map.on(...)` — o código *existente* está pronto. O risco é inteiramente nas
branches paralelas e no código novo, que é exatamente o que um spine de epic
deve reger.

**Sub-buraco no AD-9:** ele proíbe o *patch* de zone no Vitest, mas não
proíbe `fakeAsync`/`waitForAsync` — APIs que **exigem** zone-testing. Hoje há
zero usos (verificado por grep), mas nada impede o Dev B de escrever um
`fakeAsync` perfeitamente idiomático numa branch paralela pré-passo-3; no
merge, o teste quebra com erro de zone-testing ausente, e o conserto
"óbvio" é reintroduzir o patch que o AD-9 proíbe — pressão direta contra o
próprio AD.

**Fechar com:** duas adições:

1. **AD-9 apertado:** `fakeAsync` e `waitForAsync` proibidos **desde o passo
   1** (não só o patch); assíncrono em teste é `vi.useFakeTimers()` + `await
   fixture.whenStable()`.
2. **AD-3 ganha cláusula de transição:** toda branch aberta antes do merge do
   passo 3 rebaseia sobre ele **antes** de mergear e re-smoka no navegador as
   telas com callbacks de terceiro (mapas Leaflet/maplibre, animações,
   timers). Opcional e barato: ligar
   `provideCheckNoChangesConfig({ exhaustive: true })` no modo dev durante o
   epic, para que dependência de zone grite em desenvolvimento em vez de
   congelar silenciosa.

---

## F5 — AD-4 × Structural Seed: entre o passo 1 e o passo 5, o schematic sanciona o que o AD proíbe

**Severidade: medium**

O AD-4 (binds: **all**) diz que *"componente novo não declara estratégia"*.
Mas a edição do schematic (`"changeDetection": "OnPush"` fora do
angular.json) só acontece no **passo 5** da seed. Entre o passo 1 e o passo 5:

- **Dev B** gera um componente com o gerador sancionado (`ng generate
  component`) — sai com `changeDetection: OnPush`, porque o angular.json
  ainda o injeta. Ele obedeceu a convenção codificada do repo.
- **Dev A** (ou o reviewer) aplica o AD-4 ao pé da letra e reprova o PR.

Ambos conformes, veredito oposto. A janela é real: o epic prevê trabalho de
feature paralelo (AD-5/AD-8 "quando tocados" pressupõem isso).

**Fechar com:** mover a edição do schematic para o **PR do passo 1** (é uma
linha de angular.json, risco zero, e o passo 2 já valida que a migração
"Eager" é no-op) — ou datar a vigência: *"o AD-4 vale a partir do merge do
passo 5; antes disso, componente gerado com OnPush é conforme"*. A primeira
opção é melhor: elimina a janela em vez de documentá-la.

---

## F6 — "Engine Node mínima 22" sem dizer em qual package.json

**Severidade: medium**

O AD-2 sobe a engine para Node ≥ 22, mas o repo tem `engines.node: ">=20.0.0"`
**na raiz** e nenhum campo `engines` em `web/`. O par: **Dev A** interpreta
"engine" como o package.json do web e edita só lá (ou esquece — o `ng update`
não edita engines); **Dev B**, em Node 20 local (conforme com a raiz, que é o
que o corepack e o `pnpm install` leem), roda `pnpm web:dev` pós-merge e
recebe o erro opaco do CLI do Angular 22 sobre versão de Node — ou, pior,
um build local sutilmente diferente do CI (que já roda 22). Subir a raiz para
`>=22` vincula o mobile também — o job mobile do CI já roda em Node 22, então
é seguro, mas é uma decisão de monorepo que o spine tomou sem dizer que tomou.

**Fechar com:** uma frase no AD-2: *"`engines.node: ">=22"` sobe **na raiz**
do monorepo, no mesmo PR do passo 1; vale para os três workspaces (o CI já
roda os três em Node 22)."*

---

## F7 — Números do spine não batem com o repo

**Severidade: low**

Auditoria dos binds e contagens (greps de 2026-09-02):

| Afirmação do spine | Repo real | Veredito |
| --- | --- | --- |
| "~140 componentes existentes" (AD-4) | **87** `*.component.ts`, 87 com OnPush | **errado (~60% a mais)** |
| "79 arquivos em `@if`" (AD-6) | **69** | errado (pequeno) |
| "4 arquivos em `*ngIf`" + lista nominal (AD-6) | exatamente os 4 listados | ✔ |
| "10 arquivos com `ngModel`" (AD-5) | exatamente 10 | ✔ |
| "17 serviços" (AD-8) | 17 `providedIn: 'root'` | ✔ |
| "zero `FormGroup`/`FormBuilder`" (implícito no AD-5) | zero | ✔ |

Não é buraco de compatibilidade — mas um spine cujo AD-4 dimensiona o "diff
em massa evitado" em 140 arquivos quando são 87 convida o leitor a duvidar
dos binds que **estão** certos. Corrigir os dois números.

---

## F8 — Sobras de dependência que o `ng update` pode ou não resolver — e dois PRs podem resolver diferente

**Severidade: low**

`web/package.json` carrega `@angular/platform-browser-dynamic` (nenhum import
no código — `main.ts` usa `bootstrapApplication` de `platform-browser`) e o
`angular.json` mistura builders: `build`/`test` em `@angular/build`, mas o
**serve** em `@angular-devkit/build-angular:dev-server`, com o pacote devkit
inteiro em devDependencies. O par: **PR-1** (migração) deixa como está — o
`ng update` atualiza ambos e nada quebra; **PR-2** (limpeza bem-intencionada
"dentro do espírito do AD-2") remove o devkit ou o platform-browser-dynamic —
e o `ng serve` do PR-1, que ninguém testa no CI (o portão é `build`+`test`,
nunca `serve`), quebra só na máquina do próximo dev.

**Fechar com:** uma linha no passo 1 da seed: no mesmo PR do update,
consolidar o serve em `@angular/build:dev-server`, remover
`@angular/platform-browser-dynamic` e `@angular-devkit/build-angular` — ou
declarar explicitamente que sobras ficam para depois do epic (proibindo a
limpeza paralela).

---

## Ataques tentados que NÃO furaram (registro de cobertura)

- **AD-7 (paramsInheritanceStrategy):** as rotas de `main.ts` são todas
  irmãs de topo — `workout-history/:slug/:id` e `registros/:id` são paths
  planos com dois params, não `children`. O novo default de herança não muda
  comportamento algum hoje. O AD está certo e bem calibrado para o futuro.
- **AD-10 (sufixos):** consistente com os 87 componentes e com o gerador;
  nenhum par adversarial possível enquanto o schematic mantiver os sufixos
  (o passo 5 mexe no schematic — quem editar o angular.json deve **não**
  ligar o style guide sem sufixo junto; vale um alerta de uma linha no AD-4).
- **Zoneless × código existente:** os handlers de Leaflet atuais já escrevem
  em signals; `fakeAsync` tem zero usos; o risco do AD-3 é todo prospectivo
  (F4), não retroativo.
- **AD-17/CI:** a convenção de validação do spine ("build + test são o
  portão") bate com o ci.yml real — que ainda soma o lint 5.8 do shared, o
  terceiro compilador escondido do epic (absorvido no F2).
- **Pin `^22.0.0` entre PRs:** o lockfile único na raiz + `--frozen-lockfile`
  no CI fazem dois PRs convergirem na mesma resolução; drift dentro do range
  não fecha um par adversarial real aqui.

---

## Resumo das correções pedidas

| # | Sev | Buraco | Fecho |
| --- | --- | --- | --- |
| F1 | high | AD-5×AD-6 disputam registro/habit/planned-workout-editor; "tocado" indefinido | AD: "tocado" = mudança funcional (schematic não conta) + exclusividade de migração por editor |
| F2 | high | Deferred contradiz AD-15; mobile já compila shared com TS 6 (fato errado no spine) | AD: shared congelado durante o epic + passo final sobe shared p/ ~6.0 e corrige AGENTS.md/ci.yml |
| F3 | high | `ng update` sem `cli.packageManager` num web/ sem lockfile → npm/árvore plana (ADR 0016) | Passo zero no AD-2: `ng config cli.packageManager pnpm` + veto a package-lock no diff |
| F4 | high | Sem portão p/ branches pré-zoneless; AD-9 não proíbe fakeAsync | Cláusula de transição no AD-3 (rebase+smoke) + AD-9 proíbe fakeAsync/waitForAsync desde o passo 1 |
| F5 | medium | Schematic sanciona OnPush até o passo 5 enquanto AD-4 o proíbe | Mover edição do schematic para o PR do passo 1 |
| F6 | medium | "Node ≥ 22" sem dizer que é na raiz (hoje >=20) | Frase no AD-2: engines da raiz, mesmo PR do passo 1 |
| F7 | low | ~140 componentes (são 87) e 79 `@if` (são 69) | Corrigir números |
| F8 | low | platform-browser-dynamic + builder devkit do serve: limpeza paralela quebra `ng serve` | Consolidar no passo 1 ou proibir limpeza paralela |
