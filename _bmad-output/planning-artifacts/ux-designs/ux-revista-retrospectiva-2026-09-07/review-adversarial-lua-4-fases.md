---
topic: Review adversarial — a página da lua com quatro fases (CAP-12), atualização de 30/09/2026
lente: adversarial
alvo: a FRASE COLETIVA como mitigação da ADR 0045 §3
data: 2026-09-30
ataques: 17
quebram: 12
sobrevivem: 3
omissos: 2
veredito_do_alvo: não sustenta como está — a forma serve, a regra não existe
fontes:
  - EXPERIENCE.md §Disciplina de pré-registro na tela — CAP-12
  - DESIGN.md §A rampa da página da lua · §Entrada da lua · §A frase coletiva · §Os grupos e os blocos de fase
  - mockups/key-lua-quatro-fases.html
  - .memlog.md (entradas 46–63, de 30/09/2026)
  - docs/specs/revista-retrospectiva/pre-registro-lua.md
  - docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md
  - docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md
  - docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md
  - docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md
  - packages/shared/src/sleep/lua-protocolo.ts (o motor já mergeado)
  - packages/shared/src/ia/verificar.ts (VOCABULARIO_PROIBIDO)
---

# Review adversarial — a frase coletiva como mitigação da ADR 0045

## O que está sob ataque, em uma frase

A ADR 0045 §3 proíbe o resultado negativo *"atrás de um toque"*. A página da lua está atrás
de um toque. A mitigação que sustenta isso — e que uma emenda ainda não escrita à ADR tem de
declarar — é que *"a linha de entrada carrega o veredito por extenso, então quem nunca tocar
lê o resultado assim mesmo"*. Desde 30/09/2026 o que essa linha carrega é a **frase
coletiva**: um placar mais a fase nomeada.

**Se a frase coletiva não for verdadeira em algum caso que o protocolo permite, a emenda está
sendo escrita sobre um caso particular.** É isso que este documento testa.

Uma nota de método, porque ela muda o peso de seis achados: o motor do teste **já existe e já
está mergeado** (`packages/shared/src/sleep/lua-protocolo.ts`, stories 4.2a/4.2b). Ele não é
suposição minha — ele é a autoridade sobre o que o protocolo produz, e as espinhas de UX
obedecem a ele, não o contrário (é o mesmo precedente que o memlog 61 já registrou para os
quatro identificadores de unidade). Seis dos ataques abaixo são conferidos contra esse
arquivo, com linha.

---

## Parte 1 — O espaço de estados que o protocolo permite

### 1.1 A enumeração

O veredito é **por fase**, e as espinhas dizem isso:

> *"Os três valem **por fase**: uma execução pode terminar com vereditos diferentes nas
> quatro."* — `EXPERIENCE.md:321-322`

O código confirma e fecha o vocabulário:

```
VereditoLunar        = 'achado' | 'nenhum_padrao' | 'inconclusivo'          (lua-protocolo.ts:268)
MotivoDoInconclusivo = 'luz' | 'amostra' | 'ciclos' | 'poder'               (lua-protocolo.ts:271-274)
QuatroResultados     = [ResultadoDaFase ×4]                                 (lua-protocolo.ts:376)
```

Logo, o espaço de saídas de **uma** execução:

| grão | contagem |
|---|---|
| tuplas de veredito (3 rótulos × 4 fases) | **81** |
| mais o estado pré-execução (§9: as quatro rodam juntas, ou nenhuma roda) | **82 estados de página** |
| rótulos distinguíveis por bloco, abrindo `inconclusivo` nos quatro motivos | 6 |
| configurações de bloco distinguíveis (6⁴) | **1.296** |
| valores possíveis do placar | 6 — *nenhuma · uma · duas · três · as quatro · nenhuma foi lida* |

### 1.2 O que está autorado

A prancha rende **quatro quadros**. Traduzidos para tuplas:

| quadro | tupla | motivos |
|---|---|---|
| estado 1 | (inc, inc, inc, inc) | `poder` nas quatro |
| estado 2 | (achado, inc, inc, inc) | `poder` nas três |
| estado 3 | (np, np, np, np) | — |
| estado 4 | pré-execução | — |

**Três das 81 tuplas, com uma combinação de motivos cada.** E a redação da frase coletiva
existe, por extenso, só nesses quatro quadros — `EXPERIENCE.md:287-290` imprime o placar
apenas no valor *"uma"* e o segundo compartimento apenas em dois exemplos; `DESIGN.md:636-644`
descreve a forma e nenhuma redação.

### 1.3 A frase, testada caso a caso

| # | Caso que o protocolo permite | A frase coletiva sustenta? |
|---|---|---|
| C1 | (inc,inc,inc,inc), motivo `poder` | **sim** — autorado, estado 1 |
| C2 | (achado na cheia, inc ×3) | **sim em forma**, mas sem família nem α → ataque 3 |
| C3 | (np,np,np,np) | **sim em forma**, e o primeiro compartimento é idêntico ao de C1 → ataque 5 |
| C4 | pré-execução | autorado, com dois defeitos próprios → ataques 16 e 17 |
| C5 | **duas, três ou as quatro decidem** | **não** — o segundo compartimento é singular por construção → ataque 2 |
| C6 | **uma das três decide, e a cheia não** | **não** — funde as duas famílias → ataque 3 |
| C7 | **mistura de `np` e `inc` entre as famílias** (a linha SD 30 dos dois documentos) | **não** — as duas razões autoradas são falsas → ataque 7 |
| C8 | **`inconclusivo` por `luz`** | **não** — o portão é global, e a única razão escrita é falsa → ataque 6 |
| C9 | motivos mistos entre `amostra`, `ciclos` e `poder` | **não** — nenhuma razão coletiva escolhe entre quatro unidades → ataque 7 |

**Quatro das cinco desconfianças do pedido se confirmam.** A quinta — o adiantamento grande
com poder na cheia — está autorada (estado 3) e **mesmo assim** falha, por outro motivo:
ataque 8 desta lista não, ataque 5 sim, e o ataque que a nomeia é o **6** da Parte 2. Ver lá.

---

## Parte 2 — Os ataques ao alvo principal

### Ataque 1 — "os quatro estados" é uma contagem que não existe · **QUEBRA**

As duas espinhas tratam o espaço de saídas como tendo **quatro** elementos, e a invariância da
frase é declarada sobre esses quatro:

> *"Os dois compartimentos, a mesma tipografia e a mesma extensão de campos, **nos quatro
> estados**."* — `DESIGN.md:586-587`, repetido em `EXPERIENCE.md:307-308`

Mas a mesma espinha declara o veredito **por fase** (`EXPERIENCE.md:321-322`, citado acima). As
duas coisas não podem ser verdade: se o veredito é por fase, a página tem 81 estados
pós-execução, não três. "Os quatro estados" é a contagem dos **quadros da prancha**, e ela foi
promovida a contagem do espaço de estados sem que ninguém contasse.

Isso não é pedantismo de numeração: **é o que faz a invariância parecer verificada.** Uma
invariância sobre quatro casos enumerados é conferível olhando quatro quadros. Uma invariância
sobre 81 casos exige uma **regra** — uma função da tupla de vereditos para o texto dos dois
compartimentos —, e essa função não existe em nenhum dos dois documentos.

**Este é o ataque-raiz.** Os ataques 2, 6 e 7 são as três instâncias em que ela falha; quem
consertar a raiz conserta as três. Contá-los como quatro problemas independentes
superestimaria o trabalho.

**Consertável sem redecidir?** Não. Exige escrever a regra, o que é decisão nova.

---

### Ataque 2 — C5: duas ou mais decidindo, e o compartimento é singular · **QUEBRA**

O segundo compartimento é definido no singular, nas três fontes:

- *"**a fase nomeada**, ou a razão"* — `EXPERIENCE.md:288`
- `typography.lua-fase-nomeada` · *"o segundo compartimento — **a fase nomeada**, ou a razão"* —
  `DESIGN.md:405`
- memlog 50: *"PLACAR MAIS **A FASE NOMEADA**"*

E o placar só existe escrito em *"uma decidiu"* e *"nenhuma decidiu"*. Com duas decidindo, a
frase precisa de:

1. **concordância no placar** — *"duas decidiram"*, *"três decidiram"*, *"as quatro
   decidiram"*. Ninguém escreveu. Este repositório já se queimou exatamente aqui: a story 2.8
   mediu o texto recém-impresso e achou **68 defeitos** de número e unidade, e o caso que deu
   nome à memória foi *"1 dias"*. Esta frase é texto gerado por código com um numeral dentro,
   e o numeral tem cinco valores.
2. **dois nomes de fase com dois sinais**, possivelmente em direções opostas — a cheia só pode
   decidir no atraso, as três decidem nos dois sentidos. *"Nas noites que antecedem a cheia, a
   hora de apagar ficou mais tarde; nas que antecedem o minguante, mais cedo."* Com três ou
   quatro decidindo isso vira uma lista, em `lua-entrada-fase` (15 / 22), dentro do texto de um
   caderno, num alvo de toque de 44 px.

Agrava: **nada torna C5 improvável.** Os quatro testes correm sobre o mesmo acervo e a mesma
geometria (~49 × ~241); se houver sinal lunar na hora de apagar, as janelas vizinhas
compartilham noites e é esperado que mais de uma se mova. O §7 de 28/09 diz isso ao declarar o
viés: *"se uma fase tem efeito, ela eleva a coluna de controle das outras três"* — a
dependência entre as quatro está no contrato.

**A forma sobrevive** (dois compartimentos, nenhum some). **A redação não existe**, e é a
redação que a emenda promete que o leitor vai ler.

---

### Ataque 3 — C6/C2: a frase funde duas famílias, e o §2 de 28/09 autoriza chamar isso de errado · **QUEBRA**

O pré-registro de 28/09 escreveu o parágrafo que existe justamente para ser citado aqui:

> *"**O preço desta escolha, escrito em voz alta:** a partir daqui **não existe "eu testei as
> quatro fases"**. Existem dois testes de proveniência diferente (…). **Qualquer página,
> qualquer frase da revista** e qualquer relato posterior **que junte os quatro num só
> resultado está errado**, e este parágrafo é o que autoriza chamá-lo de errado."*
> — `pre-registro-lua-outras-fases.md:41-47` (§2)

*"Das quatro fases, uma decidiu"* é um resultado só sobre quatro. É a forma-sentença de "eu
testei as quatro fases": um denominador único, atravessando a fronteira que a §3 pagou poder
para manter.

E a espinha imprime as duas coisas a cinco linhas de distância, sem reconciliar:

- `EXPERIENCE.md:279-280` — *"Não existe 'eu testei as quatro fases': são dois testes de
  proveniência diferente."*
- `EXPERIENCE.md:287` — *"Das quatro fases, uma decidiu."*

Em C6 (decide uma das três) o dano fica visível: o leitor que nunca toca lê *"uma das quatro
decidiu, no minguante a hora de apagar ficou mais cedo"* — **sem α, sem família, sem
lateralidade, sem saber que essa fase nasceu em 28/09 sem direção na literatura, a 1,67%
bilateral.** Tudo isso está na página, em dois cabeçalhos de grupo, abaixo da dobra, nos dois
menores corpos da rampa (`lua-familia` 14/19 e `lua-alfa` 12/17 — `DESIGN.md:409,411`).

O §11 exige que **a página** nomeie as duas famílias e mostre os dois α, e a página faz isso.
Mas a mitigação da ADR 0045 é a afirmação de que **a linha substitui a página** para quem não
toca. As duas promessas não fecham: a linha não pode ser substituta da página e ao mesmo tempo
omitir o que o §11 obriga a página a imprimir.

**O contrato já escreveu a forma que conserta.** *"Existem dois testes"* → dois placares:
*"A cheia, sozinha: decidiu. Das outras três: nenhuma."* Custa uma linha e resolve, de uma vez,
este ataque, o 2 (nomear no plural dentro de cada família) e o 4. Não é decisão minha, mas é a
única variante que não contraria o §2.

---

### Ataque 4 — "quatro é o número que calibra a multiplicidade" é falso contra o §3 · **QUEBRA**

Uma das três razões escritas para o placar existir:

> *"**O denominador é impresso na primeira linha.** *Quatro* é o número que calibra a
> multiplicidade, e é por isso que os α são diferentes."* — `EXPERIENCE.md:296-297`

Repetido no memlog 50 e no pé da prancha (*"o DENOMINADOR ('quatro') é impresso na primeira
linha porque é o número que calibra a multiplicidade, que é a razão de os α serem diferentes"*).

**Quatro não calibra nada neste desenho.** O §3 de 28/09 é explícito: a cheia **não entra** na
correção, e o divisor das três é **três** — `α = 5% / 3 = 1,67%`
(`pre-registro-lua-outras-fases.md:50-53`). O código o congela em dois nomes:
`ALFA_DA_CHEIA = 0.05` e `ALFA_DAS_TRES = 0.05 / 3` (`lua-protocolo.ts:136,144`).

E os α **não** são diferentes por multiplicidade: são diferentes por **procedência** —
*"O argumento é de **procedência, não de conveniência**"* (`pre-registro-lua-outras-fases.md:55`).
A multiplicidade sobre quatro é precisamente a alternativa **recusada**:

> *"**Bonferroni nas quatro** (α 1,25% cada) | honesto e severo, mas rebaixa retroativamente um
> teste que foi pré-registrado sozinho e cumprido."* — `pre-registro-lua-outras-fases.md:69`

Ou seja: a justificativa impressa para o denominador é a aritmética do caminho que o dono
recusou. Se quatro calibrasse a multiplicidade, os dois α seriam 1,25%.

Isto importa porque a decisão de 30/09 foi tomada sobre **três** razões (memlog 50) e esta é
uma delas. Ela cai. As outras duas — a forma nunca muda, e quem não toca lê o resultado —
seguem de pé, e a segunda é o que os ataques 2, 6 e 7 atacam.

**Consertável sem redecidir?** Sim, e é só apagar: o denominador "quatro" pode continuar
impresso pela razão honesta (*são quatro exposições, e o leitor precisa do denominador para
saber que uma é uma de quatro*) sem a afirmação falsa sobre α.

---

### Ataque 5 — C3 contra C1: os dois estados imprimem o primeiro compartimento **idêntico** · **QUEBRA**

A lei mais antiga deste contrato:

> *"**"Nenhum padrão" e "inconclusivo" não são a mesma coisa**, e confundi-los é o erro mais
> fácil deste documento. Um teste com poder que não acha nada é informação. Um teste sem poder
> que não acha nada é silêncio — imprimi-lo como "nenhum padrão" seria **mentir com o mesmo tom
> de voz**."* — `pre-registro-lua.md:112-115` (§5), e a ADR 0045 decisão 2, linhas 58-60

Na prancha, o primeiro compartimento dos estados 1 e 3 é, palavra por palavra, o mesmo:

```
estado 1 (inc ×4)  →  "Das quatro fases, nenhuma decidiu."
estado 3 (np  ×4)  →  "Das quatro fases, nenhuma decidiu."
```

A distinção que o §5 chama de o erro mais fácil do documento vive **só** no segundo
compartimento — *"Nenhuma das quatro teve poder"* contra *"Com poder para decidir, nenhuma das
quatro mostrou…"*. E o segundo compartimento é o corpo **menor** dos dois: 17/24 na página,
15/22 na linha, contra 24/29 e 19/25 do placar (`DESIGN.md:402-407`).

Dito de outro modo: silêncio e informação são impressos com o **mesmo tom de voz** no elemento
mais alto da página, e desfeitos no elemento menor. É literalmente o modo de falha que o §5
nomeia, com a tipografia da casa aplicada ao contrário.

Agrava, e o verbo é o problema: em C3 as quatro fases **decidiram** — decidiram que não há
efeito detectável de 15 min ou mais, com poder para isso, e a ADR chama isso de informação. O
placar diz *"nenhuma decidiu"*, que é falso em C3 e verdadeiro em C1. Um verbo, dois
significados, e o significado errado é o que aparece maior. Pior ainda no **nulo prático**: o
motor devolve `nenhum_padrao` quando `poder >= 80%` e `abs(Δ) < 15 min` **mesmo com p
significante** (`lua-protocolo.ts`, tabela do docblock, linhas 103-105) — ali o teste achou um
efeito estatisticamente significante, e o placar imprime *"nenhuma decidiu"*.

**Consertável sem redecidir?** Sim, e é o conserto mais barato da lista: dois placares
distintos. *"Das quatro fases, nenhuma foi decidida por falta de poder"* / *"As quatro
decidiram: nenhuma mostra efeito de 15 min ou mais"*. A forma (dois compartimentos) fica
intacta; só o vocabulário do primeiro se reparte em três, como os vereditos já são três.

---

### Ataque 6 — C8: o portão da luz é **global**, a espinha diz que é por fase, e a razão escrita é falsa · **QUEBRA**

As duas espinhas afirmam que o portão é por fase, e apoiam uma regra de subida nisso:

> *"A covariável aparece no rodapé do método, e **sobe para o bloco da fase** quando o portão da
> luz do dia é o que reprovou **aquela fase**. (…) **O portão é por fase, então a subida é por
> bloco — não para a frase coletiva.**"* — `EXPERIENCE.md:332-336`
>
> *"Ela **sobe para o bloco da fase** num caso só: quando o portão da luz é justamente o que
> reprovou **aquela fase** (…). Sobe para o bloco, **nunca para a frase coletiva**."*
> — `DESIGN.md:674-676`

O motor já mergeado diz o contrário, em comentário próprio:

```
// Portão 1 — a luz. Global às quatro: é pré-requisito do §3, não ressalva, e
// vem antes da amostra para que um buraco de covariável nunca saia disfarçado
// de coluna curta.
if (noitesSemLuz > 0) return inconclusivo(linha, 'luz', contagem, noitesSemLuz);
```
— `lua-protocolo.ts:970-973`. E a mesma contagem é passada às quatro linhas:
`rodarLinha(linha, resolvidas, residuos, sdMarginal, semLuz.length)` (`lua-protocolo.ts:1120`).
O campo do acervo o declara: *"Noites sem luz do dia utilizável. **Acima de zero, as quatro
fases param**"* (`lua-protocolo.ts:409-410`).

E é estrutural, não implementação: cada fase é comparada *"contra todas as outras noites"*
(§4 de 28/09), então uma noite sem luz está em alguma coluna de **todas** as quatro. Não há
como o portão da luz ser por fase.

Três consequências, em ordem de gravidade:

1. **A única razão coletiva escrita é falsa neste caso.** A prancha, no estado 1, imprime
   *"Nenhuma das quatro teve poder para decidir entre as duas colunas."* No caso da luz
   **nenhum poder foi calculado** — o portão retorna antes, e o próprio bloco diz *"Efeito não
   medido: o portão reprovou antes, e zero seria mentira"*. O leitor que nunca toca lê, na
   linha que a ADR 0045 existe para garantir, uma razão que não aconteceu.
2. **Ela aponta para o conserto errado.** A unidade é `noites-sem-luz`, e a espinha já sabe o
   que isso quer dizer: *"**Não se coletam: conserta-se o dado**"* (`EXPERIENCE.md:358`). Uma
   frase que diz "faltou poder" manda o dono esperar mais cem noites quando o que falta é
   reparar três dias de covariável. É o inverso exato da utilidade da página.
3. **A regra de subida está escrita ao contrário.** Como o portão é global, a luz é a razão de
   **todas** as quatro, e o lugar certo dela é justamente o segundo compartimento da frase
   coletiva — que é o único lugar onde a espinha a **proíbe** de aparecer. A proibição foi
   derivada de uma premissa falsa.

Bônus, e o achado é da prancha: a seção 3 do mockup rende a fatia da luz num bloco só (*Lua
cheia*, sob o cabeçalho *α 5% · unilateral*) ao lado de três fatias com outros motivos. Como
configuração de uma execução, isso é **impossível**. A folha se defende chamando-as de *"quatro
fatias do bloco de uma fase"*, mas rotula cada fatia com fase e família diferentes, o que
convida à leitura errada.

---

### Ataque 7 — C7/C9: mistura entre famílias, e as duas razões autoradas são falsas · **QUEBRA**

Este é o caso que os próprios documentos tabelam, e que ninguém desenhou.

| SD da hora de apagar | poder da **cheia** p/ 15 min (5%, unilateral) | poder de **cada uma das três** (1,67%, bilateral) |
|---|---|---|
| 30 min | **94%** | **79%** |
| 45 min | 69% | 39% |

Fontes: `pre-registro-lua.md:121-127` (§5) e `pre-registro-lua-outras-fases.md:139-145` (§6).

**Na linha SD 30, a cheia passa o portão dos 80% e as três não.** Um ponto percentual abaixo.
Resultado: a cheia sai `achado` ou `nenhum_padrao`; as três saem `inconclusivo` por poder. Essa
é uma tupla mista, vinda da **primeira linha das duas tabelas pré-registradas** — não de um caso
inventado por mim. E o motor confirma que a fronteira é de família e não de acaso: o poder usa o
SD marginal bruto, **igual para as quatro**, e o que difere é o α e a lateralidade
(`lua-protocolo.ts:986-991`).

O placar diz *"Das quatro fases, nenhuma decidiu"* — falso, porque a cheia decidiu. Ou diz
*"uma decidiu"* — e então cai no ataque 3, porque a única que decidiu é a de outra família.
E o segundo compartimento tem de escolher entre as duas razões que existem escritas:

- *"Nenhuma das quatro teve poder para decidir"* — falso para a cheia (94%);
- *"Com poder para decidir, nenhuma das quatro mostrou deslocamento de 15 min ou mais"* — falso
  para as três (39–79%).

**As duas frases autoradas são falsas na tupla que a primeira linha das duas tabelas produz.**

C9 é a mesma falha com motivos: `amostra`, `ciclos` e `poder` podem reprovar fases diferentes na
mesma execução (os três portões são por linha — `lua-protocolo.ts:975-984`, e o `ciclos` conta
`instante.getTime()` **por janela daquela fase**), e as quatro unidades não se somam — o que a
espinha já sabe e declara (`EXPERIENCE.md:369-372`). O que ela não diz é **o que a razão
coletiva diz quando há quatro razões**. Não há fallback escrito, e o único texto disponível é o
do motivo majoritário, afirmado como se fosse universal. É a forma da story 2.8: um template,
muitos casos, e o template afirma o caso comum.

Note a assimetria perversa que isso cria: **quanto mais informativa a execução, menos a frase
consegue dizer.** Nas tuplas homogêneas (os três quadros autorados) a frase funciona; na tupla
mista — a que ensina mais — ela não tem redação verdadeira. A mitigação da ADR 0045 é mais fraca
exatamente onde o resultado é mais rico.

---

### Ataque 8 — o placar é um número que sobe, e o histórico o imprime em série · **QUEBRA**

Duas coisas se encontram aqui, e o encontro não está considerado em lugar nenhum.

**Primeira:** a palavra. `placar` é **vocabulário proibido** neste repositório, com barreira
viva:

```
/** A Saúde do sono é contagem, não placar (ADR 0036). */
placar: Object.freeze([ 'placar', 'score', 'pontuação', 'pontos', … ])
```
— `packages/shared/src/ia/verificar.ts:263-272`

A barreira não vai disparar, porque ela inspeciona texto de **modelo** e a lua *"não é narrada,
é calculada"* (`EXPERIENCE.md:475`). Mas a razão da proibição não é a palavra: é que um placar
convida a ler um número como nota. A ADR 0036 aprovou a **contagem** e recusou o **placar**, e a
decisão de 30/09 chamou a sua contagem de "placar" — nos textos (`EXPERIENCE.md:287`) e nos
nomes de token (`lua-placar`, `lua-entrada-placar`, `DESIGN.md:73,81`).

**Segunda, e é a séria:** `0 … 4` é um número que pode **subir**, e a espinha manda imprimir a
série dele:

> *"As execuções acumulam, então a página tem histórico. (…) A página imprime a mais recente em
> corpo cheio e as anteriores como lista de veredito + data abaixo dela."* — `EXPERIENCE.md:343-346`

E a questão 16 deixa aberta, como uma das três opções, exatamente a pior:

> *"uma linha por execução com quatro vereditos dentro, quatro linhas por execução, **ou só o
> placar coletivo por execução**?"* — `EXPERIENCE.md:348` e `mockups/…:Questões abertas`

Se esse grão for escolhido, a página imprime *"1ª: nenhuma · 2ª: nenhuma · 3ª: uma"*: um placar
literal, em série temporal, numa página cuja única função é resistir à pressão de ter o que
dizer. A ADR 0045 nomeia essa pressão como o **motor** da gaveta, e foi por causa dela que
recusou o caderno de lua:

> *"um caderno que aparece uma vez por ano e repete a mesma frase cria **pressão para ter o que
> dizer** — que é exatamente o mecanismo que produz o problema da gaveta."*
> — `0045…md:101-104`

A frase coletiva não cria essa pressão sozinha. Mas ela fabrica a **unidade de medida** com que
a pressão se mede, e a questão 16 ainda pode transformá-la numa série. Quem fechar a 16 tem de
fechá-la **contra** a opção "só o placar por execução", e a espinha precisa dizer isso — hoje
ela lista a opção sem alertar.

---

## Parte 3 — Os ataques secundários

### Ataque 9 — a ordem por família serve o §11 ou dilui? · **SOBREVIVE**

O §11 é uma **conjunção**, e é isso que salva a decisão:

> *"Uma página que imprima os quatro resultados **com a mesma tipografia**, **sem dizer** que um
> vale a 5% e três a 1,67%, desfaz no leitor a distinção que a §3 deste documento pagou para
> manter."* — `pre-registro-lua-outras-fases.md:243-246`

A página **imprime a mesma tipografia nos quatro blocos** (veredito e número no mesmo degrau
21/26 nas quatro — `DESIGN.md:693-695`), mas **diz** os dois α, uma vez por família, com a razão
ao lado. A segunda condição da conjunção não é satisfeita, então a proibição não morde. E o
argumento do agrupamento é correto: na ordem sinódica cada bloco carregaria o seu α e a página
imprimiria 1,67% três vezes e 5% uma, intercalados, obrigando o leitor a reagrupar de cabeça.

Registro a fragilidade sem contá-la como quebra: **toda a conformidade com o §11 repousa nos
dois menores corpos da rampa** — `lua-familia` 14/19 e `lua-alfa` 12/17 —, ambos abaixo da
dobra, ao lado de quatro vereditos em 21/26. A fronteira que a §3 pagou para manter é a coisa
mais discreta da página. Serve a letra; serve o espírito por pouco. E não serve nada para quem
nunca toca — mas isso é o ataque 3, não este.

---

### Ataque 10 — a paridade de espaço, na linha de entrada · **SOBREVIVE**

A ADR 0045 cobra *"o mesmo destaque tipográfico, a mesma posição e **o mesmo espaço**"*
(`0045…md:44-45`). Medindo os segundos compartimentos como a prancha os escreve:

| estado | caracteres |
|---|---|
| 1 · inconclusivo ×4 | 62 |
| 2 · **achado** na cheia | 67 |
| 3 · nenhum padrão ×4 | **119** |
| 4 · não rodou | 75 |

O estado 3 — um negativo — ocupa quase o dobro do estado 2, que é o positivo. **A assimetria
corre no sentido seguro**: a ADR proíbe atenuar o negativo, não proíbe dar-lhe mais espaço, e o
negativo com poder precisa de mais palavras porque tem mais a dizer. A invariância declarada é
de *forma* e não de comprimento (`DESIGN.md:586`), e isso é a leitura certa.

Também sobrevive a escolha de a linha ser menor que a página (19/15 contra 24/17): a ADR cobra
paridade **entre estados**, e a linha de agosto contra a de setembro é idêntica. O argumento de
`DESIGN.md:580-584` está correto, e a nota do memlog 62(a) de que a justificativa é autorada na
destilação é honesta.

---

### Ataque 11 — "pré-registrada sozinha em 07/09, antes das outras três" reforça a hierarquia que nega · **QUEBRA**

A espinha declara o objetivo:

> *"**A razão existe para que a posição da cheia não seja lida como hierarquia.** (…) Sem a
> frase, quem abrir a página em 2027 lê 'a cheia primeiro' como 'a cheia importa mais'."*
> — `EXPERIENCE.md:401-404`

O texto que a prancha rende, nos dois cabeçalhos:

> **A cheia, sozinha** — *"Pré-registrada sozinha em 07 set 2026, **antes das outras três**, com
> **a direção tirada da literatura**. A posição aqui é de procedência, não de importância."*
>
> **Nova, crescente e minguante** — *"Nasceram juntas em 28 set 2026, **nenhuma com precedência**
> sobre as outras e **nenhuma com direção na literatura**."*

Contra o objetivo, o texto instala a hierarquia três vezes e a nega uma:

1. *"antes das outras três"* é **comparativo**, e o fato não precisa ser: *"pré-registrada em 07
   set 2026, com a direção tirada da literatura"* diz a mesma coisa sem ordenar ninguém.
2. *"nenhuma com direção na literatura"*, no grupo vizinho, é o espelho negativo — lê como
   **deficiência das três**, não como propriedade do campo. O §5 de 28/09 diz o contrário: *"Não
   existe literatura que dê direção a essas três"*, e a ausência dela *"é justamente o
   argumento"* (`pre-registro-lua-outras-fases.md:101-106, 251-253`). A ausência é uma razão de
   desenho, e o cabeçalho a imprime como carência.
3. **Todos os outros eixos que a página imprime favorecem a cheia**: α mais folgado (5% × 1,67%),
   poder maior (69% × 39%), lateralidade que gasta menos, primeira posição, respaldo de
   literatura. Cinco sinais.

E a negação é o menor elemento do cabeçalho: `lua-apoio` 12,5/18 em `ink2` (`DESIGN.md:410,691`)
— o menor corpo sans da rampa. Uma negação explícita da forma *"X não é Y"* precisa nomear Y
para negá-lo; feita no menor corpo, contra cinco sinais no maior, ela não impede a leitura: ela
a instala e pede desconto.

**Quebra o objetivo declarado, não o contrato** — nenhum documento proíbe a leitura de
hierarquia. O conserto é barato e não é decisão de UX: tirar os dois comparativos e deixar os
dois fatos datados. *"Pré-registrada em 07 set 2026, com direção da literatura."* / *"Nascidas
em 28 set 2026, sem direção na literatura — por isso bilaterais."*

---

### Ataque 12 — a figura diz "68%" ou diz "quase tudo"? · **SOBREVIVE**

A leitura "quase tudo é testado" está disponível: 20 dos 30 discos vêm marcados, e os 10 de
fora aparecem como **quatro vãos pequenos** (2, 3, 2 e 3 discos, nas posições 6–7, 13–15, 21–22
e 28–30, pela própria nota de matemática da folha). Quatro vãos curtos leem como "cobertura com
buracos", não como "um terço está fora".

O que bloqueia a má leitura é o número em mono logo abaixo: *"Vinte das 29,5 noites do ciclo
caem dentro de uma janela — 68% dele"* (`DESIGN.md:629-630`). Ele nomeia o numerador, o
denominador e a fração. Quem lê a legenda não pode concluir "quase tudo"; quem só olha a figura
poderia, e a legenda é obrigatória (`alt` incluído, `DESIGN.md:633-634`).

**Sobrevive**, com um defeito menor da espécie que esta casa persegue: a figura desenha **30**
células e a legenda diz **29,5**. Quem contar discos obtém 20/30 = 67%, não 68%. A legenda está
aritmeticamente certa (20 / 29,53 = 67,7%) e o desenho arredonda; ainda assim o leitor não pode
derivar "29,5" do que vê. Uma palavra resolve: *"trinta noites desenhadas para um ciclo de
29,5"*.

---

### Ataque 13 — a espinha afirma que a figura entrega três inferências que ela não entrega · **QUEBRA**

> *"A figura entrega, antes de qualquer texto, o fato que mais calibra o veredito depois do α
> (…). **É ele que explica os α menores, a contaminação das colunas e o poder baixo.** Ela abre a
> página porque é dado, não símbolo."* — `EXPERIENCE.md:433-436`, e memlog 55 na mesma redação

Nenhuma das três é derivável da figura:

- **os α menores** dependem da escolha de procedência do §3 — um argumento sobre *quando cada
  documento foi escrito*, que nenhum desenho de discos pode conter;
- **a contaminação das colunas** depende de saber que cada fase é comparada contra *todas as
  outras noites*, o que está no §7 de 28/09 e, na página, no **rodapé do método** — depois dos
  quatro blocos;
- **o poder baixo** vem das tabelas de poder e da geometria 49 × 241, que a figura não desenha.

A figura entrega **um número**: 68%. Os três elos que transformam 68% em explicação são texto, e
o texto está a quatro telas de distância. A frase *"a figura o entrega de graça, antes de
qualquer texto"* (memlog 55) confunde entregar o dado com entregar a inferência.

Importa porque essa afirmação é o que justifica a figura **ocupar a abertura** e empurrar os
quatro vereditos abaixo da dobra (ataque à dobra aceito em `EXPERIENCE.md:445-452`). Se a figura
entrega um número e não uma explicação, o custo de dobra que ela cobra fica sem a contrapartida
declarada. **A figura pode continuar abrindo a página — ela é dado, e isso basta.** O que cai é
o argumento inflacionado; e cair importa porque foi ele que pagou a dobra.

---

### Ataque 14 — "motor v1" na procedência colide com "motor" de IA · **QUEBRA**

A página promete, em três lugares, **não assinar modelo**: `EXPERIENCE.md:475-478`,
`DESIGN.md:668-671`, memlog 36. E imprime, no rodapé da procedência: **`régua v1 · motor v1`**.

Neste app, "motor" é a palavra de **motor de IA**, instalada e visível ao usuário: a rota
`/configuracoes/motores`, o seletor de motor, a ADR 0047 (*"a porta do motor é uma só"*), a ADR
0048 (*"o motor é escolhido por aparelho"*), a ADR 0049 (*"o motor escreve palavras"*). Um leitor
deste app que veja `motor v1` num rodapé de procedência lê **assinatura de modelo** — que é
exatamente a coisa que a página declara não fazer, e a única coisa que a distingue dos quatro
cadernos.

O que "motor" quer dizer aqui é a **aritmética**: Hodges–Lehmann, Mann–Whitney e a conta de
poder, carimbadas porque trocá-las depois de ver o resultado não deixaria rastro
(`correcao-2-…md:115-119`). O conserto é o nome: `aritmética v1`, `cálculo v1`, `estimador v1`.
Zero custo, e remove uma leitura que contradiz a promessa central da página.

---

### Ataque 15 — "uma decidiu": quem é o sujeito? · **OMISSO**

A página promete *"Nenhuma causa é afirmada"* (`EXPERIENCE.md:473`) e imprime no rodapé *"Esta
página não afirma causa"*. Varri o texto rendido e a prosa se comporta: *"Associação medida, sem
mecanismo"*, *"contra todas as outras noites do acervo"*, *"a hora de apagar ficou mais tarde"*
— temporal, sem agente, sem verbo causal. Nada de conselho, exclamação ou emoji.

Sobra uma ambiguidade no elemento mais alto: em *"Das quatro fases, uma decidiu"*, o sujeito
gramatical de *decidir* é **a fase**. Duas leituras:

- *a fase decidiu* — a exposição como agente. Causal-adjacente, e é a leitura literal;
- *o teste naquela fase decidiu* — correto, e é o que a espinha quer dizer.

A espinha não decide qual. Não afirmo que quebra: nenhuma causa sobre a hora de apagar é
afirmada, e a §5 da própria ADR não fala de agência. Mas numa página cuja razão de existir é a
disciplina da linguagem, o verbo mais visível tem sujeito ambíguo, e a variante sem
ambiguidade é do mesmo comprimento: *"Das quatro fases, o teste decidiu numa."* / *"Em uma das
quatro, o teste decidiu."* **Omisso** — falta a decisão, não o conserto.

Nota correlata, sem peso: *"Nenhuma das quatro **teve poder**"* atribui o poder à fase. Poder é
propriedade do teste, e o motor o trata assim (`ParametrosDePoder` recebe dispersão e tamanhos
de coluna, nunca uma fase — `lua-protocolo.ts:707`).

---

### Ataque 16 — o estado 4 imprime um número de story, e isso lê como "esperando o build" · **QUEBRA**

O campo da moldura, no quarto estado:

```
Primeira leitura     a primeira execução da 4.2
                     as quatro rodam juntas, ou nenhuma roda
```

Ratificado pela espinha: *"No quarto estado o campo imprime uma frase, não uma data — **a
primeira execução da 4.2**"* (`EXPERIENCE.md:329-331`), e aceito como renderizado no memlog
60(c).

**"4.2" é vocabulário de processo de desenvolvimento num campo de leitor.** O raciocínio que
sustenta a página é que ela será aberta em 2027 (`EXPERIENCE.md:403`) — a espinha usa esse
leitor como argumento no cabeçalho de grupo e o esquece aqui. Um número de story não é data,
não é condição avaliável e não é fato do acervo: é o nome de uma tarefa de engenharia. O campo
que deveria responder *"quando isto vai rodar"* responde *"quando a tarefa rodar"*, e essa é a
diferença exata entre **"ainda não há dado"** e **"está esperando software"** — a pergunta deste
ataque.

A saída existe sem inventar data e sem quebrar a moldura: dizer a **condição**, que os
documentos fixam. *"Quando a primeira execução autorizada rodar — as quatro juntas."* Ou, se o
dono quiser o número que o leitor pode conferir: *"290 noites no acervo; 396 é o alvo da cheia,
672 o das três."* Nenhuma das duas fabrica compromisso, que era a preocupação certa.

A folha registra isso como questão aberta 3 e a espinha a marcou resolvida citando o contrato
(memlog 62(c)). O contrato resolve **que o campo aceita frase em vez de data**; ele não abençoa
*esta* frase.

---

### Ataque 17 — quatro frases idênticas em sequência leem como template que não preencheu · **OMISSO**

No estado 4 os quatro blocos imprimem, um sob o outro, a mesma sentença:

```
Lua cheia            Sem leitura: a fase foi pré-registrada e ainda não rodou.
Lua nova             Sem leitura: a fase foi pré-registrada e ainda não rodou.
Quarto crescente     Sem leitura: a fase foi pré-registrada e ainda não rodou.
Quarto minguante     Sem leitura: a fase foi pré-registrada e ainda não rodou.
```

Quatro repetições literais em coluna são a assinatura visual de um template que **não
preencheu**. Somadas a *"nenhuma execução"* no contador e ao número de story do ataque 16, o
estado em que a página *"passa a maior parte do tempo"* (`EXPERIENCE.md:341`) tem três marcas de
tela inacabada ao mesmo tempo.

As escolhas individuais estão certas e não as contesto: *"sem leitura"* em vez de travessão
(travessão leria como nulo medido — `EXPERIENCE.md:411-413`), e os quatro blocos presentes em
vez de ausentes. É a **acumulação** que ninguém olhou, e a espinha manda a repetição
explicitamente (*"Os quatro blocos aparecem igual, cada um com o nome da fase e 'sem
leitura'"* — `EXPERIENCE.md:339-340`), enquanto a folha admite que os blocos nesse estado são
*"leitura minha"* (questão aberta 4).

**Omisso**: ninguém decidiu se a repetição lê como forma constante ou como defeito, e não há
medição. Duas saídas que preservam a paridade da ADR — dizer a sentença **uma vez** acima dos
grupos e deixar cada bloco só com o rótulo *sem leitura*; ou variar nada e aceitar, por escrito,
que a página parece inacabada antes de rodar. A segunda é defensável. Nenhuma está escolhida.

---

## Parte 4 — Veredito sobre o alvo principal

**A frase coletiva não sustenta a emenda à ADR 0045 como está escrita.**

Ela sustenta em **três das 81 tuplas** que o protocolo permite, mais o estado pré-execução. Nas
outras, falha de quatro modos distintos, e os quatro são casos que o próprio contrato produz:

| onde falha | quão hipotético é |
|---|---|
| duas ou mais decidindo (ataque 2) | o §7 de 28/09 declara que as quatro fases são dependentes |
| uma das três decidindo (ataque 3) | 3 das 4 fases são "as três" |
| mistura entre famílias (ataque 7) | **a primeira linha das duas tabelas de poder pré-registradas** (SD 30: 94% × 79%) |
| `inconclusivo` por luz (ataque 6) | o motor tem campo, contagem e primeira-noite dedicados a isso |

E em dois dos casos **autorados** ela já falha: os estados 1 e 3 imprimem o primeiro
compartimento idêntico, o que é o erro que o §5 chama de mentir com o mesmo tom de voz (ataque
5); e a justificativa do denominador é a aritmética do caminho recusado (ataque 4).

**O que sobrevive, e é o mais importante:** a **forma** está certa e deve ser preservada. Dois
compartimentos que nunca desaparecem, sem variante curta, com o resultado no segundo — essa
decisão resolve o que a redação de *"idêntica nos três casos"* não conseguia resolver com quatro
fases, e resolve de graça o problema da dobra. Nada nesta revisão pede que ela seja desfeita.

**O que não existe é a regra.** A mitigação da ADR 0045 é uma afirmação universal — *"quem nunca
tocar lê o resultado"* — e hoje ela se apoia em quatro exemplos. Uma emenda escrita contra "a
frase coletiva" como objeto declararia satisfeita uma garantia demonstrada em 2 de 81 casos.

**A forma da emenda que sobreviveria a este ataque** é uma só, e é uma mudança de objeto:
a emenda não declara que *a frase coletiva* satisfaz o §3; ela declara que **a linha de entrada
carrega o veredito por extenso para toda tupla de vereditos que o protocolo possa produzir**, e
cita a função que faz isso — que tem de ser escrita antes, e que a UX tem de especificar: uma
tabela de redação por caso, com o placar por **família** (o §2 de 28/09 já escreveu que *"existem
dois testes"*, e dois testes pedem dois placares) e com a razão escolhida pelo motivo real,
incluindo o caso da luz, que é global e cujo conserto não é coletar noites.

Sem essa função, a emenda é escrita sobre areia — e a areia tem nome: a linha SD 30 das duas
tabelas que o dono já aprovou.

---

## Placar desta lente

| | |
|---|---|
| ataques | **17** |
| **quebram** | **12** — 1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 16 |
| **sobrevivem** | **3** — 9 (§11 pela conjunção), 10 (paridade de espaço, assimetria no sentido seguro), 12 (a figura diz 68%) |
| **omissos** | **2** — 15 (sujeito de *decidir*), 17 (quatro frases idênticas no estado 4) |

**Os quatro que carregam peso**, se o tempo for curto: **1** (a raiz — 81 estados, não quatro),
**6** (o portão da luz é global e o código o diz), **7** (a linha SD 30 produz a tupla mista) e
**3** (o denominador de quatro contraria o §2 de 28/09). Os ataques 2 e 7 caem junto com o 1;
os 4, 5, 11, 13, 14 e 16 são consertos de texto, todos baratos, nenhum exigindo redecidir forma.

**Um destes ataques não é meu — é do repositório:** o 6. O comentário
*"Portão 1 — a luz. Global às quatro"* está no motor mergeado desde a 4.2b, e as duas espinhas
foram escritas em 30/09 afirmando o contrário. A regra da casa de que a UX obedece ao código
(memlog 61) resolve a divergência sem precisar de decisão do dono.
