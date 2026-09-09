---
title: 'Story 1.4 — O texto é obrigado a nomear a base'
type: 'feature'
created: '2026-09-09'
status: 'done'
review_loop_iteration: 0
baseline_commit: '71e9a0fb42481843d39ed981f684e66dbdf2dee4'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Story 1.3 deu ao pacote **três** bases por métrica. Sem uma regra que cobre o
nome, três bases são um alfabeto três vezes maior: o texto pode citar qualquer um dos três
valores e a conferência aprova, porque todos estão autorizados. Pior, ela aprova a **troca**
— *"435 km, contra 380 no ano passado"*, com 380 sendo o período anterior, passa limpo hoje.

**Approach:** A quinta regra de `verificar.ts`. Ela deixa de perguntar *"esse número existe?"*
e passa a perguntar *"esse número existe **como B2**, e a frase diz **B2**?"*. Três bases sem
nome são um alfabeto maior; três bases **com** nome são uma **gramática** — o número tem que
bater e a preposição junto.

## Boundaries & Constraints

**Always:**
- **Reprovação, não aviso** — igual às quatro que já existem. `ok: false` significa não gravar.
- A regra confere **o número e a nomeação juntos**. Uma que só cobre a ausência de nome não
  pega a inversão, que é o caso mais perigoso porque parece certo.
- **Só valores de base disparam a regra.** Um número que é `atual` não exige nomeação; um que
  empata entre duas bases aceita qualquer uma das duas.
- A regra é **pura** e roda offline, como as outras quatro.

**Ask First:**
- Qualquer aperto que faça alguma das **7 edições reais** de `primeiras-edicoes-prompt-v2.md`
  reprovar por nomeação. Elas foram escritas sob o prompt v2, sem a regra — e são a única
  amostra de texto verdadeiro que existe.
- Qualquer número novo no pacote.

**Always (acrescentado em 09/09, renegociado pelo dono):**
- O pacote carrega o **rótulo real do período anterior** (`"julho"`, não `"período anterior"`),
  como **campo de texto** — zero números novos, zero custo de alfabeto. A Story 1.3 o havia
  removido por não ter leitor; a quinta regra é o leitor.
- A regra aceita esse nome próprio como nomeação **válida de B1**, e reprova o nome próprio
  **errado** como inversão.

**Never:**
- **Não** mexer no prompt nem em `PROMPT_VERSAO` — é a Story 1.5, e o descasamento entre as
  duas é declarado. Ver Design Notes.
- Não relaxar as quatro regras existentes para acomodar a quinta.
- Não fazer a regra adivinhar: se a frase não dá para decidir mecanicamente, ela **não reprova**
  — falso positivo aqui custa uma edição inteira, e o portão humano da 1.15 é quem julga estilo.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Base nomeada certa | "435 km, contra 380 no período anterior" (380 = B1) | Aprova | N/A |
| **Nome próprio do período** | "21 atividades contra 17 **em julho**" (17 = B1, período anterior = julho) | **Aprova** — é a forma que a Story 1.5 é obrigada a ensinar | N/A |
| Nome próprio errado | "…contra 17 em junho", com o anterior sendo julho | **Reprova** — nome próprio errado é inversão | `regra: 'base'` |
| Base sem nome | "435 km, contra 380" (380 = B1) | **Reprova** por base citada sem nome | `regra: 'base'` |
| Inversão B1/B2 | "435 km, contra 380 no ano passado" (380 = **B1**) | **Reprova** — o número é B1 e a frase diz B2 | `regra: 'base'` |
| Só o atual | "435 km em agosto" | Aprova — `atual` não exige nomeação | N/A |
| Empate entre bases | O mesmo valor é B1 e B2 | Aprova nomeando qualquer uma das duas | N/A |
| Base que não existe | Rotina sem B2; o texto não cita valor de B2 | Aprova — não há o que nomear | N/A |
| Frase indecidível | Nomeação longe demais do número para decidir | **Não reprova** — a regra não adivinha | N/A |
| As 7 edições reais | Cada uma das edições do prompt v2 | Medido e publicado: quantas passariam | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/verificar.ts:21-24` -- `Problema.regra`: a união ganha `'base'`
- `packages/shared/src/ia/verificar.ts:48` -- `NUM`, o regex pt-BR (milhar com ponto, decimal
  com vírgula); a regra nova reusa, não reinventa
- `packages/shared/src/ia/verificar.ts:56-69` -- `ignoravel`: ano, hora de relógio e dia do
  mês já saem de cena; a regra nova herda essa limpeza
- `packages/shared/src/ia/verificar.ts:94-108` -- a regra 1, que já percorre os números do
  texto. A quinta **precisa saber de qual fato cada valor veio**, coisa que
  `valoresDoPacote` (um `Set<number>`) não diz — ver Design Notes
- `packages/shared/src/ia/verificar.ts:131-140` -- a regra 4, molde de regra que consulta o
  pacote em vez do texto puro
- `packages/shared/src/ia/pacote.ts:73-79` -- `BaseId` e **`BASE_ROTULO`**, que já nomeia as
  três em português; o vocabulário da regra parte dele
- `packages/shared/src/ia/pacote.ts:92-105` -- `Base`: `id`, `rotulo`, `existe`, `valor`,
  `deltaPct`. `existe: false` é fato declarado, não ausência
- `packages/shared/src/ia/pacote.ts:110-125` -- `FatoNumero.bases`, sempre as três em ordem
- `packages/shared/src/ia/prompt.ts:46-58` -- `linhaDeFato` hoje escreve `(anterior: 862 km,
  −49,5%)`: **já nomeia B1**, e é a única base que o modelo vê. Read-only nesta story
- `packages/shared/src/ia/verificar.test.ts:16-40` -- `fato()`, a fábrica de fixture; ela já
  monta `bases`
- `packages/shared/src/ia/verificar.test.ts:127-175` -- `describe('verificarTexto — números')`,
  onde a suíte da regra nova vai ao lado
- `docs/specs/revista-retrospectiva/primeiras-edicoes-prompt-v2.md` -- **as 7 edições reais**;
  a única amostra de texto verdadeiro para medir falso positivo

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/pacote.ts` -- expor o que a regra precisa: de qual fato e de
      qual base cada valor veio. Hoje `valoresDoPacote` devolve só um conjunto de números
      → `Procedencia` + `procedenciaDoPacote`, e `valoresDoPacote` passou a ser derivado dele
      (uma origem só; o 71/16 do alfabeto continua idêntico)
- [x] `packages/shared/src/ia/verificar.ts` -- `Problema.regra` ganha `'base'`
- [x] `packages/shared/src/ia/verificar.ts` -- a quinta regra: valor de base citado exige
      nomeação **correta** por perto; nomeação de outra base reprova
- [x] `packages/shared/src/ia/verificar.ts` -- o vocabulário por base, derivado de
      `BASE_ROTULO`, com as formas que o texto real usa
- [x] `packages/shared/src/period/bounds.ts` -- `previousPeriodLabel()` e `MONTHS_PT`
      exportado: o nome **real** do período anterior, pelo mesmo caminho que produz o do
      corrente, e o léxico de meses com dono único
- [x] `packages/shared/src/ia/pacote.ts` -- `periodo.rotuloAnterior`, campo de **texto**.
      Zero números novos: o alfabeto continua em 71/16 (e 73/18 com a cobertura de noites)
- [x] `packages/shared/src/ia/verificar.ts` -- o **nome próprio** nomeia B1; o nome próprio
      errado é inversão; o nome do período **corrente** é neutro
- [x] `packages/shared/src/ia/verificar.test.ts` -- os casos da matriz, com **a inversão** e
      **um caso que aprova** — a regra tem que provar que morde e que não morde demais
- [x] `packages/shared/src/ia/verificar.test.ts` -- **medir as 7 edições reais** e publicar
      quantas passariam na regra nova, como a medição do alfabeto faz
      → **6 de 7 passam**; a de 03–09/08 reprova por ausência de nome, nenhuma reprova por
      inversão nem por nome próprio errado. Ver "O que ficou aberto".

**Acceptance Criteria:**
- Given "435 km, contra 380 no ano passado" com 380 sendo B1, when o texto é conferido, then
  reprova com `regra: 'base'`.
- Given o mesmo texto com "no período anterior", when é conferido, then aprova.
- Given um valor de base citado sem nomeação nenhuma, when é conferido, then reprova.
- Given um texto que cita só valores `atual`, when é conferido, then a quinta regra não opina.
- Given as 7 edições reais, when a regra roda sobre elas, then o resultado fica **publicado na
  saída do teste**, e nenhuma reprova sem que isso tenha sido aprovado.

## Design Notes

**A regra precisa de procedência, e o alfabeto não tem.** `valoresDoPacote` devolve
`Set<number>` — ele responde *"esse número existe?"* e não consegue responder *"existe como
quê?"*. A quinta regra exige a segunda pergunta, então algo tem que carregar a origem de cada
valor. É a mudança estrutural desta story, e ela não acrescenta número nenhum ao alfabeto.

**Como decidir "a frase nomeia esta base".** Precisa ser mecânico e declarado, senão dois
implementadores fazem diferente: um vocabulário por `BaseId`, procurado numa **janela de texto
ao redor do número**. O tamanho da janela é decisão de implementação, mas tem que estar
escrito no código com a razão — janela grande demais aprova por acaso, pequena demais reprova
texto bom.

**O caso perigoso é a inversão, não a ausência.** Um número sem nome nenhum é fácil de pegar e
fácil de perceber lendo. A inversão *parece certa*: "contra 380 no ano passado" é uma frase
bem-formada, e sem a regra ela passa em tudo. É por isso que o teste da inversão é o que
prova que a story existe — um teste que só cubra a ausência deixaria a metade que importa.

**Falso positivo custa mais que falso negativo, aqui.** Uma reprovação injusta joga fora uma
edição inteira e uma chamada paga; um escape é corrigido pelo leitor. Por isso a regra **não
adivinha**: quando a frase não é decidível mecanicamente, ela cala. As 7 edições reais são o
teste dessa calibragem, e são a única amostra de texto verdadeiro que existe.

**A janela entre esta story e a 1.5 é declarada.** Depois desta regra e antes de o prompt
aprender a nomear (Story 1.5), um texto gerado tende a reprovar. Isso é seguro — reprovar
significa **não gravar** — mas torna a impressão inútil nesse intervalo. É a ordem que o épico
escolheu, e a Story 1.5 existe exatamente para fechar a janela; quem estiver depurando ali no
meio deve saber que o verificador está certo e o prompt é que ainda não foi ensinado.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` -- expected: 0 erros
- `pnpm --filter @vitale/shared test` -- expected: exit 0; **a medição das 7 edições aparece
  na saída**
- `cd mobile && pnpm exec tsc --noEmit` -- expected: 0 erros
- `cd mobile && pnpm exec jest` -- expected: sem regressão
- `pnpm --filter @vitale/web build && pnpm --filter @vitale/web test` -- expected: sem regressão

**Provas negativas (rodar e reverter):**
- Fazer a regra cobrar só a ausência de nome -- expected: o teste da **inversão** reprova.
- Fazer a regra aceitar qualquer vocabulário de base -- expected: a inversão reprova.
- Fazer a regra opinar sobre valores `atual` -- expected: o caso "só o atual" reprova.
  ⚠ **Aplicar esta mutação no sítio da regra não prova nada** — a guarda de ambiguidade
  ("cala 2") a absorve, porque um `atual` que também não é base já sai calado. Ela só
  falha quando aplicada na **origem**: etiquetar `f.atual` como base em
  `procedenciaDoPacote`. Registrado porque uma prova absorvida parece uma prova limpa.
- Tirar o nome próprio do reconhecimento de B1 -- expected: o parágrafo da §6 reprova.
- Fazer qualquer nome próprio servir -- expected: o caso "em junho" para de reprovar.
- Fazer o nome do período **corrente** contar como nome errado -- expected: o caso "em
  agosto, contra 380" troca a acusação de ausência por inversão.
- Trocar `previousPeriodLabel` pelo genérico `'período anterior'` -- expected: as cinco
  asserções de `periodo.rotuloAnterior` reprovam.
- Encolher a absolvição do **parágrafo** para a frase -- expected: o parágrafo da §6 reprova.
- Crescê-la para o texto inteiro -- expected: "nomeação em outro parágrafo" reprova, e a
  medição das 7 edições sai de 6 para 7 (a regra fica sem dentes).
- **Absolver antes de acusar** (o defeito da primeira rodada) -- expected: "a absolvição do
  parágrafo NÃO cobre um valor rotulado errado depois dela" reprova.
- Ligar o número a "qualquer nomeação certa da janela" em vez de à **mais próxima** --
  expected: o mesmo teste reprova.
- Deixar nome próprio errado calar a ausência no parágrafo -- expected: "mês solto LONGE do
  número" reprova.
- Mexer em `JANELA_DECISAO` para 40 ou 110 -- expected: o bracket reprova nos dois sentidos.
- Tirar a co-nomeação B1+B2 do período de ano -- expected: o teste do ano reprova.
- Tirar a fronteira de palavra de `ocorrencias` -- expected: os dois testes de "maior"
  reprovam.

**Manual checks:**
- Nenhum. Sem superfície; o texto que a regra confere é escrito pela 1.5 em diante.

## O que ficou aberto

**1. Uma das 7 edições reais reprova** ("Semana 03–09/08", 3 valores de base citados sem
nome). É o gatilho do *Ask First*, e é também o que `primeiras-edicoes-prompt-v2.md` já
declarava: *"nenhuma nomeia a base … é precisamente a lacuna que a quinta regra do
`verificar.ts` passa a reprovar"*. As outras seis passam: quatro não citam valor de base
nenhum, e duas **nomeiam a base sozinhas**, sem que o prompt v2 tivesse pedido. O número
6/7 está congelado em teste — se a calibragem andar, o teste diz para que lado. Reprovar
aqui não regrava nada: as edições vivem em git, não na tabela.

**2. O nome próprio nomeia a base** — resolvido em 09/09 pelo dono, a favor de abrir. As
três formas que a Story 1.5 prescreve passam: *"contra julho"* (B1, pelo nome próprio do
anterior), *"contra agosto do ano passado"* (B2, pelo marcador de ano — o nome nu seria o
período corrente) e *"contra o que você costuma fazer em agosto"* (B3, pela perífrase). O
parágrafo da §6 voltou a passar **nas cinco regras**.

## O que a implementação decidiu, e vale saber

**A ordem é a regra: acusar antes de absolver.** Primeiro se olha o que está **colado** no
número (janela dentro da frase); só se ali não houver nomeação nenhuma o **parágrafo** pode
absolver. A ordem inversa — que a primeira rodada tinha — fazia a primeira nomeação certa
do parágrafo cobrir todo valor seguinte, inclusive os rotulados errado. E é essa a forma
que a Story 1.5 vai ensinar (nomear uma vez, seguir implícito), então a inversão pararia de
existir exatamente na prosa para a qual o pipeline está sendo dirigido.

**Quem fala do número é a nomeação MAIS PRÓXIMA**, não "existe alguma certa por perto". Em
*"contra 17 em julho — e 435 km no lugar de 862 em junho"* os dois nomes cabem na janela do
862; vale o colado. Sem posição, a troca passaria; e no sentido inverso, um mês citado de
passagem reprovaria um número que a frase nomeia certo. Empate a favor de quem nomeia
certo, porque falso positivo custa mais.

**A absolvição é por parágrafo; a acusação, por frase e janela.** A prosa de jornal nomeia
a base uma vez e segue com ela implícita — a §6 nomeia "julho" uma vez e cobre quatro
valores. Absolver por frase reprovaria esse parágrafo; absolver pelo texto inteiro deixaria
a regra sem dentes (a medição das 7 sobe para 7/7). As duas pontas têm prova negativa.
Efeito colateral medido: a edição de 03–09/08 saiu de **6 para 3** reprovas — o veredito
dela não mudou, só a contagem interna.

**Nome próprio errado só conta perto do número.** Longe, ele não nomeia base nenhuma e por
isso não é indício de que este número tenha sido nomeado — não cala a reprovação por
ausência. Antes calava, e qualquer mês citado por motivo narrativo desligava a regra no
parágrafo inteiro. As duas direções estão pinadas.

**A janela é 64 e está bracketada** por um par de testes (vão de 46 dentro, de 56 fora),
que a prende em [60, 69]. Antes disso a suíte ficava verde de 25 a 126, e o veredito de
prosa plausível mudava dentro dessa faixa.

**A nomeação casa palavra, não pedaço.** Achado pela própria medição, não por inspeção: a
coluna "nomes próprios" acusou 1 na edição de julho, cuja prosa não cita mês nenhum —
*"concentrou a **maio**r parte do volume"*. `ocorrencias()` passou a exigir fronteira de
palavra, o que de quebra conserta `'a normal'` casando dentro de "um**a normal**idade".

**Nome próprio só existe onde a prosa tem um léxico fechado**: meses e anos de quatro
dígitos. Semana (`"27/07 – 02/08"`) e trimestre (`"Q1 2026"`) carregam o rótulo no pacote
e são aceitos literalmente, mas **não têm detecção de nome errado** — ninguém escreve
"contra Q1 2026", e enumerar formas de prosa que não existem seria fabricar o léxico que
se quer conferir. Sem `rotuloAnterior` não há acusação por nome próprio: sem âncora, errar
contra o quê?

**O ponto cego é a guarda de ambiguidade.** Um valor de base que empata com qualquer
`atual`, delta ou contagem de cobertura do pacote silencia a regra — 1 em 12 citações de
base nas edições reconstruídas. É deliberado (falso positivo custa uma edição inteira),
mas é por onde um escape entra.

## O que a medição NÃO cobre

Está publicado na saída do teste, não escondido atrás de asserção verde. **Só 3 das 7
edições citam valor de base**; as outras 4 escrevem apenas o atual (*"subiu para 7,1 h"*,
sem dizer de quanto), então a regra não tem sobre o que opinar nelas. Não é o fixture: a
prosa delas não contém uma única construção "de X para Y" ou "contra X" — conferido linha
a linha. Dar-lhes pares (atual, anterior) exigiria inventar valores anteriores, que é
fabricar aquilo que se quer medir.

Consequência: **as três edições com valor de base são todas de SEMANA**, e semana não lê
nome próprio. Então `previousPeriodLabel`, `MONTHS_PT`, `rotuloAnterior` e a inversão por
nome errado — a metade renegociada em 09/09 — estão medidos **só por teste sintético**. A
saída diz isso com todas as letras, e uma asserção prende a coluna em zero: se alguma
edição passar a escrever nome de mês ou de ano, o teste avisa em vez de continuar
silenciosamente vazio.

## Suggested Review Order

**A regra, e a ordem que ela quase errou**

- O ponto de entrada: a quinta regra, com acusação antes de absolvição.
  [`verificar.ts:506`](../../packages/shared/src/ia/verificar.ts#L506)

- A janela de decisão, bracketada em [60, 69] por um par de testes.
  [`verificar.ts:368`](../../packages/shared/src/ia/verificar.ts#L368)

- Nome próprio errado: o que acusa inversão, e só perto do número.
  [`verificar.ts:219`](../../packages/shared/src/ia/verificar.ts#L219)

- A fronteira de palavra — onde "maior" deixou de ser o mês de maio.
  [`verificar.ts:183`](../../packages/shared/src/ia/verificar.ts#L183)

**O rótulo que a 1.3 tinha removido**

- O nome real do anterior, pelo mesmo caminho que produz o do corrente.
  [`bounds.ts:138`](../../packages/shared/src/period/bounds.ts#L138)

- No pacote como TEXTO: o alfabeto não se mexeu.
  [`pacote.ts:635`](../../packages/shared/src/ia/pacote.ts#L635)
