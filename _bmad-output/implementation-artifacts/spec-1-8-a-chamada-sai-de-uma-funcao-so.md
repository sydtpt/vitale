---
title: 'Story 1.8 — A chamada sai de uma função só'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 2
baseline_commit: '6bcb3fc738d63d4fa5ff8348cdb0f910d8e8e271'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A capa, o sumário e a parede da revista vão mostrar a **chamada** de cada caderno — a
primeira frase do texto que ele já escreveu —, e nenhuma função a extrai. Sem dono único, cada tela
escreveria o próprio corte, e o jeito óbvio (`indexOf('.')`) quebra na primeira frase com milhar em
pt-BR: "1.210 fotos em 2026." viraria "1.". A 1.11, a primeira story com tela, já a consome.

**Approach:** Uma função pura no núcleo, `chamadaDoTexto`, que devolve a primeira frase ou **nada**.
A regra de "o que termina uma frase" sai de dentro da conferência (`verificar.ts`) para um dono único
em `format/`, e a conferência e a chamada passam a usar a mesma — assim as duas nunca discordam sobre
onde uma frase acaba.

## Boundaries & Constraints

**Always:**
- **Ausência não é string vazia.** O retorno é `string | null`, e nunca `''`.
- **Caderno sendo escrito, reprovado ou não impresso não tem chamada.** Os três chegam à função do
  mesmo jeito — sem linha no banco, logo sem texto —, e a resposta é `null`.
- **A chamada nunca corta antes da conferência.** Todo ponto em que a chamada corta é um ponto em que
  a conferência também considera fim de frase. A chamada pode ser mais longa, nunca mais curta.
- **A conferência não muda de comportamento.** Extrair a regra de `verificar.ts` é refatoração pura:
  `ia/verificar.test.ts` **não é editado** e continua verde.
- A função mora **fora de `ia/`**, e nenhum arquivo de `ia/` a reexporta.
- Só `chamadaDoTexto` sai pelo barril; a regra de fim de frase fica interna ao núcleo.

**Ask First:**
- Subir qualquer teto de `architecture.test.ts`.
- Mudar o que a conferência reprova, por qualquer motivo — inclusive para "consertar" algo achado aqui.
- Pôr na lista de abreviações uma que possa terminar frase.

**Never:**
- Tela, banco, migração. Tocar `mobile/`, `web/`, `supabase/`, `scripts/`.
- Tocar `ia/imprimir.ts`, `ia/pacote.ts` ou `ia/prompt.ts` — a 1.10 corre em paralelo.
- Dado de saúde real em fixture.

## I/O & Edge-Case Matrix

| Cenário | Entrada | Saída |
|---|---|---|
| Frase simples | `"O sono caiu. Depois subiu."` | `"O sono caiu."` |
| Milhar com ponto | `"1.210 fotos em 2026. Mais …"` | `"1.210 fotos em 2026."` |
| Decimal com vírgula | `"Dormiu 7,2 h em média. …"` | `"Dormiu 7,2 h em média."` |
| Abreviação que precede | `"Foram aprox. 40 min a menos. …"` | `"Foram aprox. 40 min a menos."` |
| Abreviação com ponto interno | `"Houve p.ex. 3 noites curtas. …"` | `"Houve p.ex. 3 noites curtas."` |
| Reticências | `"Dormiu pouco... e acordou."` | `"Dormiu pouco..."` |
| Interrogação ou exclamação | `"Foi a menor? Sim."` | `"Foi a menor?"` |
| Sem terminador | `"O sono foi estável"` | `"O sono foi estável"` |
| Quebra de parágrafo antes do ponto | `"Sono estável\nDepois …"` | `"Sono estável"` |
| Espaço à frente | `"  \n O sono caiu. …"` | `"O sono caiu."` |
| Texto vazio ou só espaço | `""`, `"   "` | `null` |
| Sem caderno | `null`, `undefined` | `null` |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/verificar.ts:678-697` — `limitesDaFrase(texto, pos)`, com a regra inline
  `corta`: termina frase em `\n`, `!`, `?` e em `.` **exceto** entre dois dígitos ("16.315"). Não
  trata abreviação. É a regra que sai para `format/`. Usada em `:894` pela regra da base (1.4).
- `packages/shared/src/ia/verificar.ts:919-934` — o **segundo passe** da regra da base: sem base
  colada ao número, **o parágrafo absolve**. É a limitação registrada nas Design Notes.
- `packages/shared/src/format/numero.ts` — `format/` já é alcançado por `ia/`
  (`ia/interpolar.ts:48`, `ia/prompt.ts:32`), então `ia/verificar.ts` importar de `format/` segue
  precedente. **A armadilha, em `:18-23`:** `formatarNumero` conta como peça de IA na guarda (7)
  porque `ia/prompt.ts` a reexporta.
- `packages/shared/src/architecture.test.ts:1769-1793` — guarda (7): `PORTA_DE_IA`,
  `TETO_PECAS_DE_IA = 1`, com **um** ofensor (`mobile/src/lib/edicao-ia.ts` → `periodoFechado`). Toda
  peça em `ia/` fora da porta conta — daí a chamada morar fora. `:212` — barreira dos módulos lidos
  pelo Deno: `verificar.ts` **não** está entre eles (só `fitness/dedupe`, `fitness/streams`,
  `health/wellness`, `cultura/tipos`), então ganhar import não a quebra.
- `packages/shared/src/architecture.test.ts:281-324` — molde de dono único (`AGG_VERSION`).
  `:1623-1656` — molde de barreira com lista de exceção nomeada (`'STOP'`).
- `packages/shared/src/index.ts:27-43` — como o barril reexporta; `format/numero` é o precedente de
  módulo fora de `ia/` que sai por lá.
- `packages/shared/src/ia/ranqueamento.test.ts:901-914` — o teste de **ausência** no barril
  (`nome in barril`). A chamada segue a regra **oposta**: tem de estar lá.
- `packages/shared/src/data/edicoes-ia.ts:86-118` — `CadernoImpresso.texto: string` (não nulo) e
  `Edicao = readonly CadernoImpresso[]`, vazia = "ainda não impressa". **Não há campo de estado**:
  sendo escrito, reprovado e não impresso colapsam na ausência da linha.
- `packages/shared/src/ia/prompt.ts:459-460` — o que o modelo ouve: "A PRIMEIRA FRASE é a manchete
  […] lida sozinha e fora de contexto. Escreva-a curta, inteira em si mesma, e termine-a com ponto."
- `docs/specs/revista-retrospectiva/cadernos.md:119-123` — a decisão de 08/09: extração mecânica,
  sem campo novo e sem valor novo a verificar.
- `packages/shared/package.json:8-11` — cada `*.test.ts` roda sozinho por `tsx`;
  `packages/shared/src/ia/sha256.test.ts:1-2` — o idioma: `node:test` + `node:assert/strict`.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/format/frase.ts` — criar `terminaFrase(texto, i): boolean` com a regra de
  `corta`, **idêntica**. Sem imports. Doc de dono único.
- [x] `packages/shared/src/ia/verificar.ts` — `limitesDaFrase` passa a chamar `terminaFrase`. Nada
  mais muda no arquivo, e ele não reexporta a função.
- [x] `packages/shared/src/revista/chamada.ts` — criar `chamadaDoTexto(texto: string | null |
  undefined): string | null` pela matriz, sobre `terminaFrase`, com a lista fechada de abreviações,
  a regra do fragmento sem letra e os fechamentos colados (as três nas Design Notes).
- [x] `packages/shared/src/index.ts` — reexportar `chamadaDoTexto`, e só ela.
- [x] `packages/shared/src/format/frase.test.ts` — a regra, e **a concordância com a conferência
  pelo comportamento**, não pelo texto do arquivo: rodar `verificarTexto` com a base nomeada na frase
  seguinte **e na anterior** depois de `!`, de `?`, de `\n` e de `.` → zero problemas de `base`; a
  mesma frase sem terminador → um problema. Cada caso vira vermelho se `limitesDaFrase` deixar de
  cortar naquele terminador, **em cada um dos dois laços**. **O pacote do fixture é sintético e
  mínimo, montado aqui** — não copie o `pacoteDeBase` de `verificar.test.ts`, que carrega números
  reais das edições do dono (`435`, `380`, `16.315`). Índices do helper que lista cortes são de
  UTF-16 (`Array.from({ length: texto.length }, …)`), nunca de `[...texto]`.
- [x] `packages/shared/src/revista/chamada.test.ts` — a matriz inteira; cada borda das Design Notes,
  inclusive cada fechamento da lista e cada forma de marcador de lista; a propriedade **nos dois
  sentidos** sobre uma bateria sintética semeada — a chamada nunca corta antes de `terminaFrase`, **e**
  todo corte de `terminaFrase` que ela pula é ponto de abreviação da lista **ou** ponto colado a
  letra; e o teste de barril (`chamadaDoTexto` sai, `terminaFrase` não). Valores numéricos
  sintéticos, exceto os da matriz congelada.
- [x] `packages/shared/src/architecture.test.ts` — **barreira**: nenhum arquivo, fora de teste, corta
  frase à mão.
  - **Alvos:** `mobile/src`; `web/src` com os templates `.html` **e os `template:` em linha** dos
    componentes Angular (47; o texto do literal passa pelo mesmo leitor do `.html`); `scripts/`
    (a regra da linha 69); e **`packages/shared`**, fora os dois donos (`revista/chamada.ts`,
    `format/frase.ts`) — a próxima chamada escrita à mão tem mais chance de nascer num view-model
    do núcleo do que numa tela. Asserção de que ao menos um `.html` e um `template:` em linha
    entraram.
  - **Formas:** `indexOf('.')`; `split` com string (`'.'`, `'?'`, `'!'`, `'...'`) ou com regex que
    tenha ponto como separador (`/\./`, `/[.]/`, `/[.!?]/` em qualquer ordem); `search`, `match`,
    `matchAll` e `replace` com ponto em classe de caracteres **ou ponto escapado seguido de espaço ou
    fim** (`/\.\s/`, `/\.$/`), por regex ou por string; e `Intl.Segmenter` com `granularity:
    'sentence'`. Import profundo de `format/frase` fora de `packages/shared` também é ofensa: a regra
    fica interna ao núcleo por barreira, não só pelo barril.
  - **O que não vê** fica escrito no docblock, nominalmente (ponto por escape `\x2E`,
    `String.prototype.split.call`, `Intl['Segmenter']`, laço com `slice`).
  - **Exceção por ocorrência** (arquivo + forma + trecho), nascendo com as legítimas de hoje e o
    motivo de cada uma. São **16**, e nenhuma é corte de frase: o primeiro nome de um nome de exibição
    (`index.tsx`), as partes de um `toFixed` (`numero.ts`), o escape de metacaractere de regex (duas em
    `verificar.ts`), uma classe negada (`QuickAddSheet.tsx`), o carimbo de hora num nome de arquivo
    (`bancada.ts`), os pontos de abreviação numa data (`index.tsx`), o ponto decimal no arredondamento
    de hábito (sete arquivos, mobile e web) e no eixo de gráfico (`axis.ts`), e o ponto de milhar em
    `paraNumero` (`verificar.ts`). **Não estreite a barreira para não pegá-las.** Entrada que para de
    casar falha.
  - **A autoprova** passa exemplos gravados num diretório temporário pela mesma função da barreira,
    inclusive um `template:` em linha e a leitura da lista de exceção; o caminho relativo é calculado
    certo mesmo se o diretório temporário estiver dentro do repositório. `ehTeste` reconhece também
    `.js`, `.mjs`, `.cjs` e `.jsx`.
  - **A reexportação por `ia/`** (antes num teste da chamada) mora aqui, junto das irmãs, e **reusa o
    `desembrulhar` que o arquivo já tem** em vez de trazer outro: nenhum arquivo de `ia/`, varrido
    recursivamente, reexporta a chamada ou a regra — por caminho relativo, por `@vitale/shared` ou
    por `export *`. Export dentro de objeto literal fica no "não vê".

**Acceptance Criteria:**
- Given a matriz de I/O, when os testes rodam, then cada linha tem um teste que rodou e passou.
- Given a regra saiu de `verificar.ts`, when a suíte do núcleo roda, then `ia/verificar.test.ts`
  passa **sem ter sido editado**.
- Given as três telas futuras vão importar a chamada, when a guarda (7) roda, then o teto continua
  em 1 e o ofensor continua sendo só `edicao-ia.ts`.
- Given a chamada é pedida de dentro do barril, when `import('../index')` roda, then
  `chamadaDoTexto` existe nele e `terminaFrase` não.

## Spec Change Log

### Iteração 1 — 16/09/2026: a lista de abreviações violava o critério congelado, e a spec não definia fragmento sem letra

**O que disparou (três revisores, `bad_spec`).**
- A lista das Design Notes incluía `Sr.`, `Sra.`, `Dr.` e `Dra.` sob a afirmação de que "sempre
  precedem o complemento". É falso — `"Consulta com a Dra. Depois o sono caiu."` fundia as duas
  frases. A própria spec punha isso no Ask First ("pôr na lista uma que possa terminar frase").
- Faltavam `vs.`, `i.e.` e `cf.`: `"7,2 h vs. 6,8 h em agosto. Depois."` devolvia `"7,2 h vs."`, o
  número na capa cortado antes da base — a falha que as Design Notes diziam prevenir.
- A spec não dizia o que fazer com fragmento sem letra, e o implementador escolheu `null` para
  "nenhuma letra **ou dígito** antes do corte". Resultado: `"1. O sono caiu."` devolvia `"1."` — o
  bug da manchete da story, por outra porta — e `"... e o sono caiu 40 min."` devolvia `null`,
  fazendo caderno impresso parecer não impresso, contra o Always congelado.

**O que mudou.** Design Notes: a lista (entram `vs.`, `i.e.`, `cf.`; saem os quatro tratamentos; o
teste do critério ficou escrito), a regra do fragmento sem letra, e os fechamentos colados (aspas,
parêntese, colchete). Tasks: a concordância com a conferência passa a ser provada **pelo
comportamento** de `verificarTexto`, não pelo texto de `verificar.ts`; a propriedade vale nos dois
sentidos; a barreira ganha templates `.html`, `scripts/`, as formas equivalentes (`split(/[.]/)`,
`search`/`match` com ponto em classe, `Intl.Segmenter`) e exceção por ocorrência; a verificação de
reexportação por `ia/` fica recursiva. O bloco congelado não mudou.

**Estado ruim evitado.** Uma capa com `"7,2 h vs."`; uma capa com `"1."`; um caderno impresso que o
sumário mostra como não escrito; duas frases fundidas numa manchete; e — o mais grave — uma
conferência que pode parar de cortar num terminador sem teste nenhum ficar vermelho. Um revisor
provou isso: com `limitesDaFrase` mudado para não cortar em `\n`, ou em `!` e `?`, os 172 testes da
conferência, os 18 da regra e os 23 da chamada **continuaram verdes**, porque a concordância só era
checada pelo texto do arquivo e a propriedade comparava a chamada com `terminaFrase`, nunca com a
conferência. A entrada adiada desta mesma story manda a 1.10 mexer justamente ali.

**KEEP — o que a primeira implementação fez certo e tem de sobreviver.**
- **A extração de `verificar.ts` estava exata:** `terminaFrase` é cópia literal de `corta`, sem
  imports, e o diff em `verificar.ts` foi só o import, um comentário de três linhas apontando o dono,
  e a troca `corta(i)` → `terminaFrase(texto, i)` nos dois laços. `verificar.test.ts` não foi tocado.
  Refaça igual.
- **O barril pelo nome:** `export { chamadaDoTexto } from './revista/chamada';`, com um comentário
  dizendo que `format/frase` fica interno. Nunca `export *`.
- **A bateria sintética semeada** (5.555 textos) para a propriedade, **com asserções de que ela
  passa por cada caminho** — sem isso a propriedade pode ficar verde sem exercitar nada.
- **Mutação antes de relatar:** quebrar a função de propósito (ponto sempre corta, vírgula corta,
  abreviação que termina frase na lista) e confirmar que os testes ficam vermelhos. Faça também
  com `limitesDaFrase`, que é o que faltou.
- **A autoprova da barreira** grava arquivos de exemplo num diretório temporário e os passa pela
  **mesma função** que a barreira usa; e a entrada de exceção que para de casar tem de ser apagada.
- **A borda do Windows:** `\r\n` corta no `\n` e o `\r` não entra.
- **Abreviação no fim do texto** não engole nada: a chamada é o texto.
- O idioma dos testes: `node:test` (`describe`/`it`) + `node:assert/strict`.

**Um fato para a barreira.** `mobile/src/app/(tabs)/index.tsx:55` faz
`String(raw).trim().split(/[\s.]+/)[0]` — tira o primeiro nome de um nome de exibição, não corta
frase. A primeira implementação o usou como exemplo de "não deve casar", estreitando as formas.
Com as formas desta iteração ele **casa**, e é a ocorrência legítima que entra na lista de exceção,
com esse motivo.

### Iteração 2 — 16/09/2026: o bug da manchete entrava por uma terceira porta, e a spec mandou copiar dado real

**O que disparou (`bad_spec`, conferido rodando).**
- `"a. O sono caiu."` devolvia `"a."` e `"II. O sono caiu."` devolvia `"II."`. A regra do fragmento
  sem letra da iteração 1 pegava `"1."`, mas uma letra sozinha **é** letra. É a falha da manchete da
  story, pela terceira porta: milhar, depois número de lista, agora letra de lista.
- `"A nota subiu 3 p.p. em relação a julho."` devolvia `"A nota subiu 3 p."`, cortando **dentro** da
  abreviação — e o teste consagrava essa saída como a esperada. `"Dados do intervals.icu mostram
  queda."` devolvia `"Dados do intervals."`. A spec não dizia nada sobre ponto colado a letra.
- O critério das abreviações, "nunca termina frase", não tinha saída: `aprox.`, que está na matriz
  congelada, termina frase (`"Foram 40 min a menos, aprox."`), e o próprio teste a usava assim.
- A task mandava montar o fixture "no molde de `pacoteDeBase`", e ele carrega números reais das
  edições do dono (`435` aparece 102 vezes em `verificar.test.ts`, `380` 48 vezes). O Never congelado
  proíbe dado real em fixture, e foi a spec que mandou copiar.
- A barreira não varria `packages/shared`, onde uma segunda chamada à mão tem mais chance de nascer.

**Decisão do dono (16/09), pelo Ask First congelado:** `p.p.` entra na lista. Fora dela, a chamada
leva o número à capa sem "em relação a julho"; dentro, uma frase terminada em `p.p.` junta a seguinte —
a direção segura.

**O que mudou.** Design Notes: a direção segura escrita como princípio; o critério das abreviações
("em regra precede", com as três que às vezes terminam frase nomeadas); `p.p.`; abreviação de vários
pontos casada inteira; o espaço de `p. ex.` perguntado a `terminaFrase`; ponto colado a letra;
marcador de lista (dígitos, letra, romano, `)`, `-`, `•`, `–`, `—`); os oito fechamentos com teste
cada; caractere invisível como escape. Tasks: fixture sintético montado no teste; o helper de cortes
em índice UTF-16; a concordância nos dois laços; a propriedade inclui ponto colado a letra; a
barreira ganha `packages/shared`, `template:` em linha, `replace`/`matchAll`, ponto escapado com
espaço ou fim, string em `split`, import profundo de `format/frase` e `ehTeste` para `.js`; a
reexportação por `ia/` muda para `architecture.test.ts` reusando o `desembrulhar` que já existe.
Verification: os comandos inteiros do CI. O bloco congelado não mudou.

**Estado ruim evitado.** `"a."`, `"II."` e `"3 p."` na capa; `"intervals."` numa manchete de Coração;
um teste que consagra uma saída errada e impede o conserto; o número real da distância de agosto
copiado para mais um arquivo de teste; e uma chamada escrita à mão num view-model do núcleo, onde a
barreira não olhava.

**KEEP — tudo o KEEP da iteração 1 continua valendo, mais:**
- **A concordância com a conferência pelo comportamento funciona**: duas mutações em `limitesDaFrase`
  (sem cortar em `\n` para a frente, sem cortar em `!`/`?` para trás) ficaram vermelhas — conferido
  pelo orquestrador, e um revisor rodou dez e todas foram pegas, contra duas que `verificar.test.ts`
  sozinho pegava. **Os casos espelhados** (base na frase anterior) foram o que fechou o laço de trás;
  refaça-os.
- **A barreira lida pela árvore sintática do TypeScript** nos `.ts`/`.tsx`, e por regex só nos
  templates, com comentário HTML tirado. Ela não usa `semComentario`, e por isso não herda o defeito
  dele — mantenha assim.
- **Exceção casada por arquivo, forma e trecho**, e a entrada que para de casar falha.
- **Autoprova com arquivos num diretório temporário**, passando pela mesma função da barreira.
- **Sem lookbehind em regex do código de produção**: `chamada.ts` roda no aparelho, e o Hermes não
  tem precedente de lookbehind no boot (ver a 5.3).
- **As 27 mutações antes de relatar**, e a lista dos mutantes que não morrem, com o motivo — o único
  foi `p. ex.` engolindo quebra de linha, que não muda saída porque o `\n` logo depois corta.

### Rodada 3 — 16/09/2026: consertos direto no código, sem voltar à spec (decisão do dono)

**O que a revisão achou, conferido rodando.** `"1. a. O sono caiu."` devolvia `"a."` (o marcador saía
uma vez só) e `"a) "` devolvia `"a)"`, com um teste consagrando essa saída — o bug da manchete de novo.
`"Subiu 3 p. p. em relação a julho."` devolvia `"Subiu 3 p."`, com o número cortado antes da base.
`"Vi. Depois caiu."` perdia a palavra "Vi", lida como o romano VI, e `"É."` perdia o "É". `"a) 40"`
devolvia `"40"`, mas `"40"` devolvia `null`. Faltavam testes de romano com V, do par substituto antes
da abreviação e da lista de abreviações item a item, e os testes de concordância dependiam, sem dizer,
do segundo passe da regra da base. A barreira não via `search(/\./)` nem `match(/^(.+?)\.(?!\d)/)`.

**Por que não voltou à spec.** Pelo workflow era `bad_spec` — a regra do marcador escrita na spec
estava incompleta — e a terceira volta reverteria e reescreveria cerca de 2 mil linhas. O dono decidiu
consertar direto: com texto realista a chamada já estava certa e provada (128 mutações, e dez
independentes na conferência, todas pegas), os achados eram bordas raras, e cada rodada ia achar mais
uma borda numa função que lê português. O implementador foi retomado com o contexto intacto e recebeu
os consertos por escrito. As Design Notes e as tasks acima foram atualizadas **depois**, para bater com
o código.

**O que mudou.** Marcadores tirados em sequência; romano maiúsculo com `.` ou `)`, minúsculo só com
`)`; letra de lista só ASCII; letra dentro de marcador não conta como conteúdo, e a chamada aplicada à
própria saída é estável; espaço entre as partes de toda abreviação de vários pontos; o par substituto
antes da abreviação, no código e no oráculo; `ABREVIACOES_DA_CHAMADA` comparada item a item; os testes
de concordância afirmam só sobre a regra `base` e declaram a dependência; o teste de "sendo escrito,
reprovado e não impresso" sobre uma `Edicao` de verdade; ponto escapado em regex como forma de corte,
com as duas formas na autoprova; e o barril conferido por identidade.

**O que ficou adiado, por decisão do dono.** O resto da barreira: formas raras, falsos positivos de
classe, alvos não varridos, importadores de `format/frase` dentro do núcleo, reexportação por alias e
template guardado em constante — tudo no `deferred-work.md` e nomeado no "não vê" do docblock.

**Uma consequência que o dono deve saber.** A regra do ponto escapado, pedida para pegar as duas formas
naturais, também pega o ponto decimal de arredondamento (`toFixed(2).replace(/\.?0+$/, '')`), e levou a
lista de exceção de seis para **dezesseis** entradas — nenhuma é corte de frase. Toda formatação de
número nova com ponto escapado vai precisar de entrada. Estreitar a regra (ponto colado a dígito é
número) está no trabalho adiado da barreira.

**Mutação.** 152 mutantes. Um buraco real (ponto escapado dentro de classe) foi fechado; os seis que
sobreviveram são equivalentes, cada um com o motivo no relato do implementador.

## Design Notes

**Por que a regra sai de `verificar.ts`.** A conferência usa os limites da frase para decidir qual
base está "colada" a um número (regra 1.4). Se a chamada cortasse num ponto onde a conferência não
corta, um número poderia chegar à capa separado da base que a conferência achou **na mesma frase**.
Com uma regra só, a chamada corta onde a conferência corta — e só pula os pontos de abreviação, o
que a deixa mais longa, nunca mais curta.

**A direção segura: na dúvida, mais longa.** O invariante congelado permite à chamada ser mais longa
que a frase da conferência e proíbe ser mais curta. Toda regra abaixo que **pula** um corte de
`terminaFrase` segue essa direção: quando ela erra, a chamada junta duas frases; ela nunca corta um
número longe da base. A que erra para o outro lado — cortar onde a conferência não corta — é proibida.

**As abreviações: lista fechada, pelo critério de preceder o complemento.** Entram `aprox.`, `p.ex.`,
`p. ex.`, `vs.`, `i.e.`, `cf.` e `p.p.`. O critério **não** é "nunca termina frase" — em português
quase toda abreviação termina frase em alguma construção, e esse critério não tem saída —, e sim
"**em regra precede o complemento**". Três delas às vezes terminam frase, e aí a chamada junta a
frase seguinte, que é a direção segura: `aprox.` e `p.ex.` estão na matriz que o dono aprovou, e
`p.p.` entrou por decisão dele em 16/09, porque fora da lista `"A nota subiu 3 p.p. em relação a
julho."` vira `"A nota subiu 3 p.p."` — o número na capa sem a base. **Não entram** `Sr.`, `Sra.`,
`Dr.`, `Dra.` (a revista não nomeia pessoas, então não comprariam nada), `etc.`, `máx.` e `mín.`,
que terminam frase **mais do que precedem**. Uma abreviação de vários pontos é casada inteira: nenhum
ponto de dentro dela corta, e **entre as partes cabe espaço** — `p. p.`, `i. e.` e `p. ex.` são as
mesmas abreviações que `p.p.`, `i.e.` e `p.ex.`. O espaço de dentro é qualquer espaço da mesma classe
da borda (inclusive o de largura zero) **que não seja corte de `terminaFrase`** — pergunte à regra,
não fixe `\n` no código, senão o dia em que ela aprender outro separador de linha a chamada passa a
pular um corte da conferência. A casa da letra não decide, e a palavra começa em fronteira (letra,
dígito ou marca combinante antes dela não vale, contando um caractere fora do plano básico como um
só). A lista sai do módulo como `ABREVIACOES_DA_CHAMADA` — **não pelo barril** — para o teste
compará-la item a item: acrescentar uma abreviação sem mudar o teste fica vermelho, e é esse o gatilho
mecânico do Ask First. As abreviações
ficam **só na chamada**: pô-las na regra compartilhada mudaria o que a conferência reprova.

**Ponto colado a letra não termina frase.** Um ponto seguido **imediatamente** de letra, sem espaço,
não é fim de frase em prosa: `"Dados do intervals.icu mostram queda."` é uma frase só (e o
intervals.icu é integração real do app), `"Foi o 1.º lugar do ano."` também. Regra só da chamada,
na direção segura.

**Marcador de lista e fragmento sem letra não são frase.** No começo do texto, os marcadores de lista
saem **um depois do outro**, antes do corte: um a três dígitos com `.` ou `)`; **uma letra ASCII** com
`.` ou `)`; numeral romano **maiúsculo** com `.` ou `)`, ou **minúsculo só com `)`**; e `-`, `•`, `–` e
`—` — todos seguidos de espaço. `"1. O sono caiu."`, `"a. O sono caiu."`, `"II. O sono caiu."`,
`"XVI. O sono caiu."`, `"viii) O sono caiu."`, `"2) O sono caiu."`, `"- O sono caiu."` e `"1. a. O
sono caiu."` devolvem todos `"O sono caiu."`. As restrições existem para não engolir palavra de
verdade: `"Vi."` é palavra, não o romano VI, e `"É."` não é letra de lista — os dois ficam. O espaço
obrigatório é o que protege o milhar: `"1.210 fotos"` não tem espaço depois do ponto e não é marcador.
Depois disso, um trecho até o corte que não tem nenhuma letra é pulado, e a busca continua: `"... e o
sono caiu 40 min."` devolve `"e o sono caiu 40 min."`. **Letra dentro de um marcador não conta como
conteúdo**: se, tirados os marcadores e pulados os trechos sem letra, não sobra nenhum trecho com letra,
a chamada é `null` — `"a) 40"`, `"a) "` e `"a. 2. 3."` são `null`, como `"40"`. A chamada aplicada à
própria saída devolve a mesma coisa, e isso é propriedade testada.
Pular o que vem antes não fere o invariante: todo ponto em que a chamada corta continua sendo corte
da conferência; o que muda é onde ela **começa**. Espaço de largura zero à frente sai junto com o
espaço comum.

**Terminadores e fechamentos colados entram inteiros.** A chamada inclui a sequência de terminadores
colados (`...`, `?!`) e os fechamentos logo depois dela: `"`, `'`, `”`, `’`, `»`, `›`, `)` e `]`
— **cada um com teste**, porque tirar um da lista sem nenhum teste ficar vermelho é o mesmo que ele
não estar lá. A posição do corte é a da conferência; só entra o que está colado a ela.

**No código, caractere invisível é escape.** Espaço de largura zero, BOM e separador de linha
Unicode aparecem como `\uXXXX`, nunca crus: editor e formatador os apagam sem nenhum teste notar, e o
revisor não os vê no diff.

**Limitação conhecida, fora do alcance desta story.** A conferência aceita um número de comparação na
primeira frase cuja base só é nomeada na segunda, porque o segundo passe da regra da base deixa o
parágrafo absolver (`verificar.ts`, no bloco "2º: nada colado. Aí sim o parágrafo pode absolver").
A chamada, que é essa primeira frase lida **sozinha**,
levaria o número sem a base para a capa. O conserto é uma regra nova na conferência — reprovar mais —,
o que esta story não pode fazer. Vai para o trabalho adiado.

## Verification

**Commands** — o que o CI roda, inteiro, porque o barril mudou e a barreira nova varre `scripts/`:
- `pnpm --filter @vitale/shared lint` e `pnpm --filter @vitale/shared test` — exit 0, incluindo a
  barreira nova e a guarda (7) em teto 1.
- `pnpm --filter @vitale/web build` e `pnpm --filter @vitale/web test` — exit 0.
- `pnpm --filter @vitale/scripts lint` e `pnpm --filter @vitale/scripts test` — exit 0.
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — exit 0.
- `git diff 6bcb3fc -- packages/shared/src/ia/verificar.test.ts` — **vazio**.
- `git diff --stat 6bcb3fc -- mobile web supabase scripts packages/shared/src/ia/imprimir.ts packages/shared/src/ia/pacote.ts packages/shared/src/ia/prompt.ts` — **vazio**.

**Mutação antes de relatar:** quebrar `limitesDaFrase` (cada terminador, em cada laço), `chamadaDoTexto`
(cada regra das Design Notes, cada item das listas) e a barreira (cada alvo, cada forma), um de cada
vez, e ver o teste certo ficar vermelho. Restaurar do backup, nunca por `git checkout`.

## Suggested Review Order

**A chamada**

- O ponto de partida: devolve a primeira frase ou nada, e nunca string vazia.
  [`chamada.ts:218`](../../packages/shared/src/revista/chamada.ts#L218)

- Sem letra fora dos marcadores não há chamada — é o que fecha o "1." pela terceira porta.
  [`chamada.ts:224`](../../packages/shared/src/revista/chamada.ts#L224)

- Marcadores em sequência, romano só maiúsculo com ponto, letra só ASCII: não engole "Vi." nem "É.".
  [`chamada.ts:98`](../../packages/shared/src/revista/chamada.ts#L98)

- A lista fechada, congelada e exportada fora do barril para o teste a comparar item a item.
  [`chamada.ts:75`](../../packages/shared/src/revista/chamada.ts#L75)

- A abreviação é casada inteira, com espaço entre as partes, em fronteira de palavra.
  [`chamada.ts:130`](../../packages/shared/src/revista/chamada.ts#L130)

**A regra que a conferência e a chamada dividem**

- O dono único de onde uma frase termina — cópia literal do corte que vivia dentro da conferência.
  [`frase.ts:32`](../../packages/shared/src/format/frase.ts#L32)

- A conferência troca a cópia inline pela regra; nada mais muda no arquivo.
  [`verificar.ts:685`](../../packages/shared/src/ia/verificar.ts#L685)

- Só a chamada sai pelo barril, pelo nome.
  [`index.ts:85`](../../packages/shared/src/index.ts#L85)

**As provas**

- A concordância pelo comportamento de `verificarTexto`, nos dois laços — o teste que faltou na rodada 1.
  [`frase.test.ts:151`](../../packages/shared/src/format/frase.test.ts#L151)

- A matriz congelada, como tabela: cada linha vira um teste.
  [`chamada.test.ts:28`](../../packages/shared/src/revista/chamada.test.ts#L28)

- O gatilho mecânico do Ask First: a lista do código igual à do teste, item a item.
  [`chamada.test.ts:86`](../../packages/shared/src/revista/chamada.test.ts#L86)

- A propriedade nos dois sentidos, e a chamada estável sobre a própria saída.
  [`chamada.test.ts:506`](../../packages/shared/src/revista/chamada.test.ts#L506)

**As barreiras**

- Ninguém corta frase à mão: apps, templates, `scripts/` e o núcleo.
  [`architecture.test.ts:2935`](../../packages/shared/src/architecture.test.ts#L2935)

- As dezesseis exceções, cada uma com o motivo — nenhuma é corte de frase.
  [`architecture.test.ts:2432`](../../packages/shared/src/architecture.test.ts#L2432)

- Nenhum arquivo de `ia/` reexporta a chamada ou a regra, o que manteria a guarda (7) no teto 1.
  [`architecture.test.ts:3099`](../../packages/shared/src/architecture.test.ts#L3099)
