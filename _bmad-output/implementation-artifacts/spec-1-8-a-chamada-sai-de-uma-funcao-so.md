---
title: 'Story 1.8 — A chamada sai de uma função só'
type: 'feature'
created: '2026-09-16'
status: 'in-progress'
review_loop_iteration: 1
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
- [ ] `packages/shared/src/format/frase.ts` — criar `terminaFrase(texto, i): boolean` com a regra de
  `corta`, **idêntica**. Sem imports. Doc de dono único.
- [ ] `packages/shared/src/ia/verificar.ts` — `limitesDaFrase` passa a chamar `terminaFrase`. Nada
  mais muda no arquivo, e ele não reexporta a função.
- [ ] `packages/shared/src/revista/chamada.ts` — criar `chamadaDoTexto(texto: string | null |
  undefined): string | null` pela matriz, sobre `terminaFrase`, com a lista fechada de abreviações,
  a regra do fragmento sem letra e os fechamentos colados (as três nas Design Notes).
- [ ] `packages/shared/src/index.ts` — reexportar `chamadaDoTexto`, e só ela.
- [ ] `packages/shared/src/format/frase.test.ts` — a regra, e **a concordância com a conferência
  pelo comportamento**, não pelo texto do arquivo: rodar `verificarTexto` (fixture no molde de
  `pacoteDeBase`) com a base nomeada na frase seguinte depois de `!`, de `?` e de `\n` → zero
  problemas de `base`; a mesma frase sem terminador → um problema. Cada caso vira vermelho se
  `limitesDaFrase` deixar de cortar naquele terminador.
- [ ] `packages/shared/src/revista/chamada.test.ts` — a matriz inteira; as bordas das Design Notes;
  a propriedade **nos dois sentidos** sobre uma bateria sintética — a chamada nunca corta antes de
  `terminaFrase`, **e** todo corte de `terminaFrase` que ela pula é ponto de abreviação da lista;
  o teste de barril (`chamadaDoTexto` sai, `terminaFrase` não); e nenhum arquivo de `ia/`,
  **varrido recursivamente**, reexporta a chamada ou a regra, em qualquer forma de `export`.
- [ ] `packages/shared/src/architecture.test.ts` — **barreira**: nenhum arquivo, fora de teste, corta
  frase à mão. **Alvos:** `mobile/src`, `web/src` **incluindo os templates `.html`** (pelo
  `walkExt` que as barreiras irmãs já usam, e com asserção de que ao menos um `.html` entrou) e
  `scripts/` (a regra da linha 69: hospedeiro novo entra nas barreiras no mesmo commit). **Formas:**
  `indexOf('.')`, `split('.')`, `split` com regex que tenha ponto como separador (`/\./`, `/[.]/`,
  `/[.!?]/` em qualquer ordem), `search`/`match` com ponto numa classe de caracteres, e
  `Intl.Segmenter` com `granularity: 'sentence'`. O que a barreira não vê fica **escrito no docblock**.
  A lista de exceção é **por ocorrência** (arquivo + forma), não por arquivo, e nasce com as
  ocorrências legítimas de hoje, cada uma com o motivo — **não estreite a barreira para não pegá-las**.
  A não-vacuidade prova o casador **e a leitura da lista de exceção** pelo caminho real da barreira.

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

## Design Notes

**Por que a regra sai de `verificar.ts`.** A conferência usa os limites da frase para decidir qual
base está "colada" a um número (regra 1.4). Se a chamada cortasse num ponto onde a conferência não
corta, um número poderia chegar à capa separado da base que a conferência achou **na mesma frase**.
Com uma regra só, a chamada corta onde a conferência corta — e só pula os pontos de abreviação, o
que a deixa mais longa, nunca mais curta.

**As abreviações: lista fechada, pelo critério de preceder.** Só entra abreviação que **nunca
termina frase, porque o complemento vem sempre depois dela**: `aprox.`, `p.ex.`, `p. ex.`, `vs.`,
`i.e.` e `cf.`. O teste do critério é tentar pôr a abreviação no fim de uma frase — se couber, ela
fica de fora. Por isso **não entram** `Sr.`, `Sra.`, `Dr.` e `Dra.` ("consulta com a Dra." termina
frase), `etc.` ("corrida, natação etc."), `máx.`, `mín.` ("chegou ao máx.") e `p.p.` ("subiu 3
p.p."). A revista não nomeia pessoas, então tratamento não compraria nada e custaria a chance de
colar duas frases. `vs.`, `i.e.` e `cf.` entram porque são vocabulário de comparação, que é a prosa
da revista — e, sem elas, `"7,2 h vs. 6,8 h em agosto."` vira `"7,2 h vs."` na capa, com o número
cortado antes da base contra a qual compara. A casa da letra não decide; a palavra começa em
fronteira (letra, dígito ou marca combinante antes dela não vale), e o espaço dentro de `p. ex.` é
qualquer espaço, inclusive o não separável. As abreviações ficam **só na chamada** — pô-las na regra
compartilhada mudaria o que a conferência reprova.

**Fragmento sem letra não é frase.** Um trecho até o corte que não tem nenhuma letra é pulado, e a
busca continua depois dele: `"1. O sono caiu."` devolve `"O sono caiu."`, e não `"1."` — que é
exatamente a falha que esta story existe para impedir, entrando por um marcador de lista em vez de
um milhar. `"... e o sono caiu 40 min."` devolve `"e o sono caiu 40 min."`. Só é `null` o texto que
não tem letra **nenhuma**: caderno impresso sempre tem chamada, e `null` quer dizer só "não há
caderno". Pular um fragmento sem letra não fere o invariante — todo ponto em que a chamada corta
continua sendo corte da conferência; o que muda é onde ela **começa**. Espaço de largura zero à
frente sai junto com o espaço comum.

**Terminadores e fechamentos colados entram inteiros.** A chamada inclui a sequência de terminadores
colados (`...`, `?!`) e os fechamentos que vêm logo depois (aspas, parêntese, colchete), para não
devolver `"Dormiu pouco."` de `"Dormiu pouco..."` nem `'Ele disse "caiu.'` com a aspa aberta. A
posição do corte é a mesma da conferência; só entra o que está colado a ela.

**Limitação conhecida, fora do alcance desta story.** A conferência aceita um número de comparação na
primeira frase cuja base só é nomeada na segunda, porque o segundo passe da regra da base deixa o
parágrafo absolver (`verificar.ts`, no bloco "2º: nada colado. Aí sim o parágrafo pode absolver").
A chamada, que é essa primeira frase lida **sozinha**,
levaria o número sem a base para a capa. O conserto é uma regra nova na conferência — reprovar mais —,
o que esta story não pode fazer. Vai para o trabalho adiado.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` — exit 0.
- `pnpm --filter @vitale/shared test` — exit 0, incluindo a barreira nova e a guarda (7) em teto 1.
- `git diff 6bcb3fc -- packages/shared/src/ia/verificar.test.ts` — **vazio**.
- `git diff --stat 6bcb3fc -- mobile web supabase scripts packages/shared/src/ia/imprimir.ts packages/shared/src/ia/pacote.ts packages/shared/src/ia/prompt.ts` — **vazio**.
- `pnpm --filter @vitale/web build` e `cd mobile && pnpm exec tsc --noEmit` — exit 0: os apps
  compilam o núcleo como fonte, e o barril mudou.
