---
title: 'Story 3.4 — A luz nunca aparece sozinha'
type: 'bugfix'
created: '2026-09-26'
status: 'done'
baseline_commit: '9bee76e4424aa7384b8240833adce895c468bdd1'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Em **9 das 160** linhas do acervo que têm luz, ela ocupa um **parágrafo inteiro só para si** — *"O mês teve dias longos."*, *"O período teve dias curtos."* — pendurada no vazio. A instrução da luz no prompt já proíbe quatro coisas (usá-la como explicação, compará-la, dizer que os dias crescem, escrevê-la em horas) e **não proíbe a única que aconteceu**: aparecer sozinha. Isso foi medido ao recusar a 3.3: o destaque visual não é necessário porque a luz já está em 160 de 160 linhas, e em 30 delas integrada ao fato — o defeito não é de tela, é de prompt.

**Approach:** Uma cláusula na instrução que já existe: a luz é **contexto de um fato, nunca um fato** — não abre parágrafo, não é frase sozinha. O prompt já fala esse idioma: três linhas abaixo, a lápide pede explicitamente *"cada linha vira um PARÁGRAFO PRÓPRIO"*. A luz precisa do inverso, dito com a mesma clareza.

## Boundaries & Constraints

**Always:**
- **A luz continua sendo texto sem número.** `PacoteDeFatos.periodo.luz` registra que **duas** tentativas de pôr as horas como número foram **revertidas** — horas de luz são redondas por natureza e a casa decimal não compensava o custo no alfabeto da verificação. Não é para reabrir pela terceira vez.
- Mudar o texto do prompt **sobe `PROMPT_VERSAO`** (hoje 6) e refaz os goldens do contrato. O roteiro da 2.8 é o molde.
- **`PACOTE_VERSAO` não muda**: é por ele que a 2.3 julga o que já foi renovado, e o pacote não mudou.
- A luz continua entrando **uma vez por prompt**, em `linhaDaLuz`, e ausente em `year`/`all`.

**Ask First:**
- Virar **regra de conferência** em `verificar.ts`. A tabela de leis diz que 3, 4 e 8 são prescrição na parte não coberta, *"e valem por isso: o leitor é uma pessoa só, e ela está disponível"* — e reprovar texto custa **uma chamada nova**. Uma frase a mais não é um número falso: o custo da severidade é maior que o do defeito. Se for virar regra, tem de ser frouxa, e o argumento vai escrito.
- Cobrar as outras **40** linhas que citam a luz sem número junto. Elas **não são defeito**: *"o acompanhamento transcorreu em um momento de dias curtos"* liga a luz a um sujeito. Só o parágrafo solto está no alvo.

**Never:** pôr número na luz; a 3.3 (recusada em 26/09); a web; escrever em produção; reimprimir (é do dono, e custa nove chamadas).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| A cláusula nova | qualquer prompt com luz | A instrução proíbe parágrafo próprio e frase solta, no idioma da lápide | N/A |
| Período sem luz | `year`, `all` (`luz: null`) | Nada muda: `linhaDaLuz` já devolve vazio, e a cláusula não fala do que não existe | N/A |
| A versão | o texto do prompt mudou | `PROMPT_VERSAO` 6 → 7, com a entrada no changelog; `PACOTE_VERSAO` **fica em 4** | N/A |
| Os goldens | `GABARITO` e os hashes | Refeitos no mesmo commit, com o motivo escrito | divergência ⇒ o teste reprova, e é isso que se quer |
| As quatro proibições velhas | explicação, comparação, crescimento, horas | **Continuam valendo, palavra por palavra** — a cláusula acrescenta, não substitui | N/A |
| O caderno mudo | caderno vazio, sem prompt | Nada muda | N/A |

</frozen-after-approval>

## Code Map

- `packages/shared/src/ia/prompt.ts:501-505` — **a instrução da luz**, o alvo. Hoje: *"A linha 'Luz do dia' é CONTEXTO DE ESTAÇÃO… serve só para situar o que aconteceu. Nunca a use como explicação, nunca a compare com outro período ou outro ano, nunca diga que os dias estão crescendo ou encurtando, e nunca a escreva em horas"*. Falta a quinta proibição.
- `packages/shared/src/ia/prompt.ts:506-512` — **o idioma a imitar**: a lápide pede *"cada linha vira um PARÁGRAFO PRÓPRIO"*. É a prova de que o prompt sabe falar de parágrafo quando quer; a luz precisa do inverso.
- `packages/shared/src/ia/prompt.ts:426-445` — o cabeçalho do sistema e a frase *"As oito regras abaixo falam do TEXTO QUE VOCÊ ESCREVE"*. Se a contagem de regras mudar, ela muda aqui também.
- `packages/shared/src/ia/prompt.ts:386-397` — a tabela de leis × o que `verificarTexto` cobra, e a declaração de que 3, 4 e 8 são prescrição na parte não coberta. É o argumento de que instrução sem conferência é padrão aceito aqui, não desleixo.
- `packages/shared/src/ia/prompt.ts` (`PROMPT_VERSAO`, hoje **6**) — o changelog tem uma entrada por mudança do que o modelo lê. A entrada 7 é esta.
- `packages/shared/src/ia/pacote.ts:353-371` — por que a luz é texto sem número, com as duas reversões registradas. **Leitura obrigatória antes de tocar na luz.**
- `packages/shared/src/ia/prompt.ts:555` — `linhaDaLuz`, que escreve `Luz do dia: X.` uma vez por prompt e nada para `null`.
- `packages/shared/src/period/__tests__/contrato-da-edicao.ts` — o `GABARITO` (hashes e textos) que a mudança de prompt refaz; a 2.8 é o molde de como fazer isso com o motivo escrito.
- `packages/shared/src/ia/verificar.ts` — as nove regras de hoje, **nenhuma sobre a luz**. Onde a décima entraria, se entrar.

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/ia/prompt.ts` — a cláusula nova na instrução da luz, no idioma da lápide; a entrada 7 no changelog e `PROMPT_VERSAO` a 7; conferir se a frase "as oito regras" precisa mudar. **Oito continua oito** — a cláusula é FORMA, não regra absoluta —, e um teste novo prende isso.
- [x] `packages/shared/src/period/__tests__/contrato-da-edicao.ts` — refazer os goldens, com o motivo no commit. Os **quatro** hashes mudaram (`Pedido.sistema` entra na serialização canônica **e** a versão do descritor subiu); `prompt_versao` das três linhas da carga foi a 7; `textos` e `textosSemLapide` **não mudaram**, porque são do `usuario`. No mesmo passo, o golden de `ia/recursos.test.ts` foi de `6004` para `7004`.
- [x] testes — a matriz de I/O: a cláusula presente, as quatro proibições velhas intactas (e as cinco na **mesma** instrução), `PACOTE_VERSAO` em 4, e `year`/`all` sem luz nos dois grãos.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — registrar a **consulta de medição** (o SQL que achou os nove parágrafos soltos), para remedir depois da reimpressão custar um comando e não uma investigação.

**Acceptance Criteria:**
- Given o prompt montado para um período com luz, when a instrução é lida, then ela proíbe parágrafo próprio e frase solta, e mantém as quatro proibições anteriores.
- Given `PROMPT_VERSAO`, when a story fecha, then ela é 7 e `PACOTE_VERSAO` continua 4.
- Given `year` ou `all`, when o prompt é montado, then não há linha de luz nem menção a ela.

## Spec Change Log

- **26/09/2026 — construída.** Nada do Intent mudou. Duas coisas que a Code Map não
  previa e que a execução descobriu, as duas registradas nos docblocks:
  1. **Mudar o `sistema` muda os quatro hashes do contrato**, e não só pela versão do
     descritor: `Pedido.sistema` entra em `serializarPedido` (`ia/motor.ts:304`), então a
     lei nova reescreve o hash de todo caderno — inclusive de um caderno cujo período não
     tem luz. O que **não** mudou é `GABARITO.textos`/`textosSemLapide`, que são do
     `usuario`: é a prova, no próprio portão, de que a story não tocou em nada do que o
     pacote escreve.
  2. **Um segundo golden cobrava a mesma mudança**: `ia/recursos.test.ts` prende o hash do
     pedido da retrospectiva por versão do descritor (`6004` → `7004`).

- **27/09/2026 — revisão, iteração 1.** Uma camada de três rodou (as outras duas caíram por
  `ENOTFOUND`), 19 achados, todos endereçados. Nada do Intent mudou; o que mudou foi o que
  está **escrito** e o que os testes **provam**. Os cinco de peso:

  1. **O bump arma a impressão em massa** (P1, medido no banco pelo revisor). O critério do
     `--massa --caderno` é `prompt_versao`, não `pacote_versao` — e há **149 linhas** abaixo
     de 7 (`movimento` 50, `rotina` 50, `coracao` 25, `sono` 24). O defeito são nove
     parágrafos: o conserto dirigido custa nove chamadas, a massa custa 50 por caderno. A
     conclusão de segurança que o comentário do teste tirava de `PACOTE_VERSAO` era sobre o
     leitor errado. Escrito no changelog de `PROMPT_VERSAO` e em duas entradas do
     `deferred-work`.
  2. **A remediação não é cosmética** (P2): com `--caderno` a função do banco **recalcula a
     ordem do conjunto**, então cada uma das nove chamadas pode mudar `posicao` e, com ela, a
     **manchete e o sumário** da edição. A entrada anterior vendia as nove como troca de uma
     frase.
  3. **A consulta de medição foi reescrita** (P3–P10, P18): o grão passou de parágrafo para
     **frase** (a cláusula proíbe duas coisas, e a query media uma), `~` virou `~*` (a luz
     abrindo a frase em maiúscula era invisível), o filtro `!~ '[0-9]'` — que descartava *"O
     mês teve dias longos, em 2026."*, o próprio defeito — deu lugar a contagem de palavras
     do que sobra quando a luz sai, entrou `group by tipo_periodo` (luz numa linha de `year`
     é contexto **inventado**, defeito pior, e o total o escondia), entrou a contagem de
     linhas ao lado da de frases, entrou o critério de sucesso (`prompt_versao = 7` sem
     linha), e os limites — a cópia sem barreira do vocabulário, o limiar como escolha, os
     nove confirmados por **leitura humana** — ficaram declarados.
  4. **Os testes deixaram de ser presos ao entrelinhamento** (P12–P13), o ajudante passou a
     **derivar** a luz de `textoDaLuz` em vez de fixar `luz: null` — sem isso o teste de
     `year`/`all` provava só que `linhaDaLuz` respeita `null` (P11) —, e a asserção de
     `PACOTE_VERSAO` voltou para onde o pacote vive (P14).
  5. **Duas afirmações não verificáveis ganharam prova ou saíram.** O `SISTEMA` passou a ter
     golden próprio (sha256), que é o par do `GABARITO.textos`: agora "o `usuario` não mudou"
     e "o `sistema` mudou" são falsificáveis uma a uma (P15). O docblock do `GABARITO` parou
     de afirmar o que uma fixture de **um mês** não pode provar, e aponta onde cada metade se
     prova (P16). E a decisão de **não** reprovar ganhou teste: o parágrafo ofensor isolado
     passa por `verificarTexto` e `problemas` tem de vir vazio (P17).

  **Três documentos estavam descrevendo o desenho revertido** (P19): CAP-6 do
  `docs/specs/revista-retrospectiva/spec.md` e o **FR6** de `epics.md` ainda pediam *"as horas
  de luz e o delta contra o mesmo período do ano anterior"*, e `cadernos.md` ainda prometia a
  *"camada de luz em destaque"* no trimestre, que é a 3.3 — recusada em 26/09 e até agora não
  registrada como recusada em `docs/`. Os três foram corrigidos, com a reversão dupla e a
  recusa nomeadas.

## Design Notes

**Por que instrução e não conferência.** Reprovar texto custa uma **chamada nova** — a conferência é o portão pago da revista. Uma frase a mais não é um número falso: o defeito é cosmético, e o custo de uma regra severa demais (reprovar prosa boa por causa de uma oração) é maior que o do defeito. A tabela de leis já declara que 3, 4 e 8 valem por prescrição, *"porque o leitor é uma pessoa só, e ela está disponível"* — é o mesmo caso.

**Por que só o parágrafo solto.** Das 40 linhas que citam a luz sem número junto, a maioria a liga a um sujeito (*"o acompanhamento transcorreu em um momento de dias curtos"*), que é exatamente o "situar o que aconteceu" que a instrução pede. Cobrar número junto empurraria o modelo a inventar relação onde não há — o oposto do que se quer.

**O acervo é do dono, e é barato.** As nove linhas se reimprimem com `--tipo <t> --inicio <d> --caderno <c>`, que a 2.8 construiu: **nove chamadas**. A story não reimprime nada, e a lista está no commit que recusou a 3.3.

## Verification

**Commands:**
- `pnpm --filter @vitale/shared lint` e `test` — 0 falhas
- `cd mobile && pnpm exec tsc --noEmit && pnpm exec jest` — 0 falhas
- `pnpm --filter @vitale/web build` — 0 erros
- `pnpm --filter @vitale/scripts lint` e `test` — 0 falhas

Os **quatro**, por **exit code**. O barril do shared **não pode mencionar** `imprimir-sequencia`, nem em comentário.

**Manual checks:**
- Nenhum: a story não tem tela. A prova real é a próxima impressão, e ela é do dono.

## Suggested Review Order

**A cláusula, e o que ela não é**

- A quinta proibição, dentro da instrução que já existia, no idioma da lápide.
  [`prompt.ts:505`](../../packages/shared/src/ia/prompt.ts#L505)

- O aviso que quem subir a versão vai ler antes de rodar o script.
  [`prompt.ts:556`](../../packages/shared/src/ia/prompt.ts#L556)

- A versão em 7 — e o pacote deliberadamente em 4.
  [`prompt.ts:575`](../../packages/shared/src/ia/prompt.ts#L575)

**A decisão de não reprovar, como teste**

- O parágrafo ofensor passa pela conferência sem problema: se isto reprovar, a política mudou.
  [`verificar.test.ts:2720`](../../packages/shared/src/ia/verificar.test.ts#L2720)

**A rede de medição, com os limites escritos**

- A consulta, o critério de sucesso, e as duas formas em que ela erra.
  [`deferred-work.md:667`](deferred-work.md#L667)

**Os documentos que descreviam o que foi revertido**

- A luz no spec da revista, e a 3.3 registrada como recusada.
  [`spec.md`](../../docs/specs/revista-retrospectiva/spec.md) · [`cadernos.md`](../../docs/specs/revista-retrospectiva/cadernos.md)
