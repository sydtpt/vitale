# Revisão de acessibilidade — a página da lua com quatro fases (CAP-12)

- **Alvo:** atualização de 30/09/2026 da espinha CAP-12 (story 4.4) — `EXPERIENCE.md`
  §*Disciplina de pré-registro na tela* e §*Accessibility Floor*, `DESIGN.md`
  §*Typography* / §*Colors* / §*Components* / §*Do's and Don'ts*, e a prancha aprovada
  `mockups/key-lua-quatro-fases.html`.
- **Data:** 30/09/2026 · **remedido em 01/10/2026** (frase coletiva por família + conserto da ordem)
- **Recorte:** iPhone 390 × 844 · Orbe · paleta orbe · claro · sub-página do caderno Sono
  (papel `blue`, `accent #6E8CC9`, `soft #DDE4F2`, `onAccent #1F1B16`).
- **Achados:** **7 abertos** — **1 crítico** (C2), 3 altos (A2, A3, A4), 4 médios (M1–M4), 0 baixos.
  Mais **1 corrigido** entre as duas passadas (C1).
- **Precedente:** a rodada de 07/09 fechou 18 achados nesta espinha, 4 críticos. Esta não é
  revisão de território limpo, e dois dos achados eram **regressões da própria atualização**
  (C1 e A1 não existiam quando havia uma fase só).

> ## Remedição de 01/10/2026 — leia isto primeiro
>
> A prancha mudou duas vezes depois da primeira passada desta lente, e **todos os números do
> alvo 1 foram refeitos** contra `mockups/key-lua-quatro-fases.html` como ele está hoje. O
> `.working/` **não** foi medido: é o instantâneo do que o dono aprovou.
>
> O que mudou na prancha: (a) o placar passou a ser **por família** — duas linhas, denominadores
> 1 e 3, nunca 4 —, pelo §2 do pré-registro de 28/09, o que **dobra** a altura da frase
> coletiva; (b) a legenda da figura e a medida dos 68 % desceram para **depois** da frase
> coletiva, que era o conserto recomendado aqui; (c) a coluna de rótulos da moldura virou
> `max-content`.
>
> **O que a remedição mudou nesta revisão:**
>
> | achado | antes | agora |
> |---|---|---|
> | **C1** o quarto estado atenuado | crítico | **CORRIGIDO** — os quatro blocos do estado 4 têm `.b-word` com *"sem leitura"* em 21/26 serif `ink`, e a frase explicativa desceu para `.b-line`. Verificado: 4 blocos / 4 `b-word` nos quatro estados |
> | **C2** a dobra | crítico | **crítico, mantido** — números novos, veredito igual: cabe em todo corpo normal, quebra em todo corpo de acessibilidade |
> | **A1** coluna de rótulos | alto | **rebaixado a médio (M4)** — o corte dos rótulos acabou; sobrou transbordo horizontal da moldura |
> | **B1** fontes de fallback | baixo | **promovido a alto (A4)** — na geometria nova o fallback **muda o veredito de lado** no XXXL, que é o corpo que decide a emenda |
>
> **A2** (figura congelada, rótulos de 9 px), **A3** (o α sem região), **M1** (banda a 1,20) e
> **M2** (`opacity:.78` a 3,72) estão **inalterados**: `0 role`, `0 tabindex`, 4 `aria-label`
> todas no `<svg>`, 16 × `font-size="9"`, `opacity:.78` ainda no `.subhead .sub`.

## Como foi medido

Nada aqui é opinião sobre a prancha; é medida sobre a prancha.

1. **Geometria e tipo dinâmico.** A prancha foi renderizada em Chrome 154 headless a
   390 px de largura, com as **fontes reais do app** injetadas por `@font-face` a partir de
   `mobile/assets/fonts/` (`Manrope-*`, `GeistMono-*`, `InstrumentSerif-Regular`) — a prancha
   não embarca `@font-face` nenhuma, então sozinha ela cai no fallback do sistema — e na
   geometria nova isso **muda o veredito de lado** (ver **A4**), então a remedição mediu as
   duas.
   O tipo dinâmico foi simulado como o React Native o aplica: **`fontSize` e `lineHeight`
   multiplicados; `padding`, `margin`, `width` e o SVG intactos**, porque esses são dp e não
   escalam. Escalas usadas, que são as que `PixelRatio.getFontScale()` devolve no iOS:
   `1,000` (L, padrão) · `1,235` (XXL) · `1,353` (XXXL, **o maior corpo não-acessibilidade**) ·
   `1,786` (AX1) · `2,143` (AX2) · `2,643` (AX3), mais uma bisseção em
   `1,4 / 1,45 / 1,5 / 1,55 / 1,6 / 1,7` para achar o ponto exato de quebra. Para isolar o ganho
   do conserto da ordem, a mesma prancha foi medida com o `.phase-note` devolvido ao DOM **antes**
   da frase coletiva e todo o resto igual.
4. **Sanidade das fontes.** Confirmado que as sete faces carregam e que `.c-1` resolve para
   `Instrument Serif`: a 100 px, *"Das quatro fases"* mede **549 px** nela contra **736 px** no
   serif do sistema — 25 % mais estreita, que é a origem de **A4**.
2. **Cor.** Contraste WCAG 2.x por luminância relativa e **ΔE2000** em CIELAB, calculados dos
   hexes do `:root` da prancha. Daltonismo simulado pela transformação LMS de Viénot 1999
   (protanopia, deuteranopia, tritanopia) e acromatopsia por luminância.
3. **Semântica.** Auditoria do marcado da prancha: `aria-*`, `role`, `tabindex` — **4
   `aria-label`, todas no `<svg>`; zero `role`, zero `tabindex`**.

---

## Os dois alvos nomeados

### Alvo 1 — A dobra sob tipo dinâmico · **NÃO RESOLVIDO** (crítico, C2) · remedido em 01/10

Medido na prancha corrigida: frase coletiva de **duas** linhas (uma por família) e a legenda
da figura já **depois** dela. O que marca é o fim da **última** linha da frase — o `.c-2` da
segunda família — porque é a última palavra do resultado.

#### 1. Até que corpo as duas linhas cabem inteiras, no pior dos quatro estados

O pior é sempre o **estado 3** (*nenhum padrão nas quatro*), que tem os dois textos mais
longos.

| escala | quem é | pior estado (3) | estado 1 | estado 4 |
|---|---|---|---|---|
| **1,000** | L (padrão) | 615 · **folga 229** | 591 · folga 253 | 591 · folga 253 |
| 1,235 | XXL | 736 · folga 108 | 677 · folga 167 | 707 · folga 137 |
| **1,353** | **XXXL — o maior corpo não-acessibilidade** | **773 · folga 71** | 708 · folga 136 | 741 · folga 103 |
| 1,400 | — | 788 · folga 56 | 721 · folga 123 | 754 · folga 90 |
| **1,450** | — | **803 · folga 41 — o último que cabe** | 734 · folga 110 | 769 · folga 75 |
| **1,500** | — | **855 · falta 11 — o primeiro que quebra** | 747 · folga 97 | 783 · folga 61 |
| 1,550 | — | 872 · falta 28 | 760 · folga 84 | 797 · folga 47 |
| 1,600 | — | 958 · falta 114 | 842 · folga 2 | 834 · folga 10 |
| 1,700 | — | 1036 · falta 192 | 873 · falta 29 | 864 · falta 20 |
| **1,786** | **AX1 — o primeiro corpo de acessibilidade** | **1096 · falta 252** | 967 · falta 123 | 915 · falta 71 |
| 2,143 | AX2 | 1410 · falta 566 | 1204 · falta 360 | 1193 · falta 349 |
| **2,643** | **AX3** | **1863 · falta 1019** | 1546 · falta 702 | 1609 · falta 765 |

**Resposta: cabe até 1,45 · quebra a partir de 1,5.** O veredito nos termos que decidem é o
mesmo de antes — **seguro em todos os corpos não-acessibilidade, com 71 px de folga no XXXL;
quebrado em todos os corpos de acessibilidade.** A frase de duas linhas antecipou a quebra em
um degrau (era 1,6, virou 1,5) e o conserto da ordem pagou quase exatamente a diferença: o
último corpo seguro saiu de 1,5 para 1,45.

#### 2. Quanto o conserto da ordem devolveu de fato

Medido na **mesma** geometria de duas linhas, com e sem o conserto — a legenda devolvida para
antes da frase coletiva no DOM e tudo o mais igual. Fim da última linha, pior estado:

| escala | ordem antiga | ordem nova | **devolvido** |
|---|---|---|---|
| 1,000 | 733 | 615 | **118 px** |
| 1,235 | 896 | 736 | **160 px** |
| 1,353 (XXXL) | 969 | 773 | **196 px** |
| 1,500 | 1092 | 855 | **237 px** |
| **1,786 (AX1)** | 1403 | 1096 | **307 px** |
| **2,643 (AX3)** | 2556 | 1863 | **693 px** |

**Eu havia estimado 257 px no AX1 e 551 px no AX3. O real é 307 e 693 — subestimei em 50 e
142 px.** A estimativa contava só a altura dos dois textos; faltaram o `padding:16px` do
`.phase-note`, que é dp e entra uma vez, e o fato de a `.phase-measure` ter ficado **mais
longa** na correção (*"Trinta noites desenhadas para um ciclo de 29,5: vinte delas caem dentro
de uma janela — 68 % do ciclo."*), o que aumenta o bloco que desceu. **O conserto rendeu mais
do que eu prometi**, e é o que faz o XXXL caber com folga em vez de raspar.

E ele **não** resolve a quebra sozinho. No AX1 o que ainda está acima da frase mede 400 px:
cabeçalho de sub-página 52 (fixo) + título e versalete 127 + versalete da figura e o SVG 161,
dos quais **86 px são o SVG congelado**. Zerando todo o resto acima, ainda falta no AX3.

#### 3. Onde ainda quebra, e quanto falta

A partir de **1,5**, faltando **11 px** no pior estado. Nos corpos de acessibilidade:
**AX1 falta 252 px** (pior estado) / 123 px (estado 1) / 71 px (estado 4) · **AX2 falta
566 px** · **AX3 falta 1019 px**.

No AX3 a primeira tela entrega: cabeçalho de sub-página (52 px), título da página (**159 px**
de altura, porque escala e quebra em duas linhas), a figura (**86 px, congelada** — ver A2) e
a primeira família da frase coletiva, cortada no `.c-2`. A segunda família — *as três*, com o
α de 1,67 % — só começa em y = 1060, **216 px abaixo** da dobra: no AX3 a página **não mostra
que existem duas famílias** sem rolar, que é precisamente o efeito que o §11 do pré-registro
de 28/09 proíbe. O placar por família piorou este flanco: antes havia uma linha a perder,
agora há uma família inteira.

É a ADR 0045 §3 sendo violada por **corpo de letra**: a página já está *"atrás de um toque"* —
o que exige a emenda pendente — e no corpo grande o resultado também sai da primeira tela,
para quem o `DESIGN.md` nomeia na mesma frase em que proíbe congelar altura: *"quem lê em AX3
é exatamente quem tem baixa visão"*.

Não é o defeito que a prancha já resolveu. Altura **não** está congelada em lugar nenhum
(nenhum `height` em `.coletiva`, `.ficha`, `.grupo`, `.bloco`); os blocos crescem 183 → 216 →
268 → 397 → 661 px de 1,0 a 2,643. O texto não é cortado *dentro* da caixa; é empurrado para
fora da **primeira tela**, e é a primeira tela que a aceitação da dobra comprou.

#### 4. O que a emenda à ADR 0045 pode e não pode declarar

Com estes números, duas coisas separam o que é assinável do que não é:

- **A linha de entrada não tem dobra própria.** Ela vive no pé do caderno Sono, no meio de uma
  edição que já é uma rolagem longa — ninguém a lê sem rolar, em nenhum corpo. A garantia é
  sobre ela **existir íntegra**, e ela é: 141 px no padrão, 290 px no AX1, os dois
  compartimentos presentes nos quatro estados, mesma tipografia e mesma tinta.
- **O que quebra é a página**, e é ela que a espinha usa como prova de que o negativo não está
  atenuado. **A emenda pode ser assinada** se a garantia for declarada sobre a *linha de
  entrada*. Ela **não pode** afirmar que a página entrega o veredito na primeira tela: de
  **1,5** para cima não entrega, e a partir do **AX1** falta um quarto de tela.

> **Ressalva que vale para os dois números acima:** eles valem para as fontes reais do app. A
> prancha, medida como ela abre, dá outro veredito no XXXL — ver **A4**.

### Alvo 2 — A figura das quatro janelas · **RESOLVIDO em daltonismo, com duas ressalvas**

Primeiro, uma correção de premissa que muda a pergunta: **a figura não é um disco com quatro
fatias.** É uma **tira** de 30 discos (um por noite do ciclo sinódico, com o terminador real),
`342 × 86`, com quatro retângulos de realce de 5 noites cada. As quatro janelas têm **a mesma
cor** — todas `--soft`, todos os tiques `--accent`. **Não existe tarefa de discriminar quatro
cores entre si**, que era o problema de 07/09 (quatro *módulos* precisando diferir uns dos
outros, ΔE mín 0,8). A tarefa aqui é **binária**: dentro ou fora da janela. *Qual* janela é
qual sai de posição + rótulo + o traço do instante. O achado de 07/09 **não transfere.**

Segundo: **a figura não é a única portadora dos 68%.** O número está em texto de corpo duas
vezes — em `.phase-measure` logo abaixo da figura (na prancha de hoje: *"Trinta noites desenhadas
para um ciclo de 29,5: vinte delas caem dentro de uma janela — 68% do ciclo."*) e de novo no rodapé do método. Quem usa VoiceOver recebe os 68% em
prosa, não em `alt`.

**A discriminação binária é carregada por quatro canais, e medi todos:**

| canal | medida | veredito |
|---|---|---|
| banda `soft #DDE4F2` × fundo `bg #FFF7EE` | **contraste 1,20** · ΔE2000 **12,11** | **abaixo de 3:1** (M1). Passa a régua do próprio repo (ΔE > 10) por 2,11 |
| tique `accent #6E8CC9` × fundo `bg` | contraste **3,16** · ΔE 37,21 | passa 3:1 |
| tique `accent` × trilho `line #EFE6D8` | contraste 2,71 · ΔE 36,58 | abaixo de 3:1 — mas `line` × `bg` mede 1,17 / ΔE 4,20, isto é, o trilho é quase invisível, então o tique lê contra o fundo |
| contorno do disco: dentro `ink` 1,0 px × fora `ink2` 0,7 px | 16,13 × 7,09 sobre `bg` | degrau de luminância por construção |
| rótulo + posição | 9 px, sem token (A2) | ver A2 |

**Daltonismo — a figura funciona:**

| visão | banda × fundo | tique × trilho |
|---|---|---|
| normal | contraste 1,20 · ΔE 12,11 | 2,71 · ΔE 36,58 |
| protanopia | 1,19 · ΔE **13,27** | 2,59 · ΔE 38,37 |
| deuteranopia | 1,21 · ΔE **14,28** | 2,79 · ΔE 40,97 |
| tritanopia | 1,21 · ΔE **30,69** | 2,74 · ΔE 58,41 |
| acromatopsia | 1,20 · ΔE **4,22** | 2,72 · ΔE **24,41** |

O par sobrevive às três dicromacias — em tritanopia o ΔE **sobe** para 30,69, porque o par
`#DDE4F2 / #FFF7EE` fica em cima do eixo azul-amarelo e a simulação o separa em claridade. Sob
**acromatopsia a banda colapsa** (ΔE 4,22, `#E4E4E4` contra `#F8F8F8`), e é aí que a régua de
`accent` e o degrau de contorno pagam a conta: ΔE 24,41 em cinza. **Cor não é o único portador
— medido, não afirmado.**

As duas ressalvas viram achados: **M1** (a banda sozinha mede 1,20) e **A2** (a figura não
honra tipo dinâmico e os quatro rótulos saem a 9 px).

---

## Achados

### CRÍTICO

#### ~~C1 — O quarto estado imprime o veredito em corpo menor e em cinza~~ · **CORRIGIDO em 30/09–01/10**

**Era o achado crítico mais barato e foi fechado.** O defeito: nos estados 1–3 a palavra de
veredito saía em `.b-word` (21 / 26, serifada, `ink`, 16,13 sobre `bg`) e no estado 4 o
`.b-word` **não existia** — *"Sem leitura"* vinha em `.b-line` (12,5 / 18, sans, `ink2`,
7,09), **−40,5 % de corpo e a tinta de apoio**: duas das três atenuações que a ADR 0045 §3
proíbe por nome, no estado que a própria espinha chama de *"o estado em que a página passa a
maior parte do tempo"*.

**Verificado na prancha de hoje:** os quatro estados têm **4 blocos e 4 `.b-word`** cada. No
estado 4 o `.b-word` imprime *"sem leitura"*, e a frase explicativa desceu para `.b-line`
(*"A fase foi pré-registrada e a primeira execução autorizada ainda não rodou."*), que é onde
`lua-apoio` pertence. Nada mais a fazer.

#### C2 — De 1,5 para cima a frase coletiva sai da primeira tela, e a aceitação da dobra cai com ela

Os números completos estão no §*Alvo 1*, nas quatro sub-seções. O que decide:

- **cabe** em todo corpo não-acessibilidade — no **XXXL (1,353)**, o maior deles, com **71 px
  de folga** no pior estado;
- **o último corpo seguro é 1,45**; a quebra começa em **1,5**, faltando 11 px;
- **AX1 (1,786): falta 252 px.** AX2: 566 px. **AX3: 1019 px**, e a segunda família começa
  216 px abaixo da dobra — no AX3 a página não mostra sem rolar que existem **duas famílias**,
  que é o efeito que o §11 de 28/09 proíbe;
- o conserto da ordem já aplicado devolveu **307 px no AX1 e 693 px no AX3** (mais do que os
  257 / 551 que eu estimei), e mesmo assim não fecha a conta: restam **400 px** acima da frase
  no AX1, dos quais 86 são o SVG congelado.

**Por que segue crítico e não desce:** a dobra foi **aceita por escrito** sobre a premissa de
que a frase coletiva está acima dela, e é essa frase que a emenda pendente à ADR 0045 vai
declarar como mitigação da cláusula §3. A emenda **ainda não está escrita** — então é barato
acertar a redação agora e caro depois de assinada. Ver §*Alvo 1 · 4* para o que ela pode e não
pode afirmar.

**Três caminhos, e o custo de cada um:**

1. **Encolher o que sobrou acima da frase.** São 400 px no AX1: título + versalete (127 px) e
   versalete da figura + SVG (161 px). Baixar o degrau do `.pagetitle` (26 / 30) ou suprimir um
   dos dois versaletes devolve algo; **a figura não devolve nada, porque não escala.** Compra
   um ou dois degraus de corpo, não o AX3.
2. **Um piso de dobra por corpo de letra, declarado e cobrado.** Escrever no *Accessibility
   Floor* que a frase coletiva inteira cabe na primeira tela **até AX5**, e medir isso como a
   espinha já mede contraste. É a regra certa e **nenhum arranjo da ordem a cumpre** — ela
   obriga a figura a sair da primeira tela no corpo grande, ou a ganhar um modo compacto
   (ver A2).
3. **Reabrir a dobra com o dono.** As duas alternativas que ele recusou em 30/09 — mover a
   moldura para depois dos blocos, encolher o desenho — foram recusadas contra a medida do
   **corpo padrão**, e nenhuma delas tocava o problema do corpo grande. Hoje há um fato novo
   para levar: no AX3 a página esconde a existência das duas famílias.

### ALTO

#### A2 — A figura não honra tipo dinâmico em nada, e os únicos rótulos que nomeiam as quatro janelas saem a 9 px, fora da rampa

O SVG é `342 × 86` com `viewBox` fixo, discos de `r=4,6` (9,2 px de diâmetro) e os quatro
rótulos — *nova · crescente · cheia · minguante* — em `font-size="9"`. **Nada disso escala**:
`react-native-svg` não participa do escalonamento de fonte do RN, e a prancha congela a
altura do SVG.

- **9 px não tem token.** O degrau mais baixo da rampa da lua (`DESIGN.md` §*A rampa da página
  da lua*) é `lua-legenda`, **10,5 / 14**. Os 9 px da figura estão **abaixo do piso da rampa**
  que o documento enumera, e são o **único** lugar da tela que diz qual janela é qual.
- **No AX3 a proporção inverte.** O título da página mede 159 px de altura ao lado de um disco
  de 9,2 px e de um rótulo de 9 px. A figura que abre a página *"porque é dado, não símbolo"*
  vira a menor coisa da tela — e a legenda dela, que escala, vira a maior (392 px).
- **Não há caminho de aumento.** A largura útil é 342 px; quatro rótulos centrados nas janelas
  ficam a 84,2 px um do outro e o mais largo (*minguante*) já mede 49 px a 9 px de corpo.
  Escalar os rótulos sem redesenhar a tira os faz colidir a partir de ~1,6.

**Correção:** ou a tira ganha um modo de corpo grande (menos discos por linha, ou duas
linhas, com os rótulos em `lua-legenda`), ou o *Accessibility Floor* declara por escrito que a
figura é **decorativa-para-quem-não-vê-de-perto** e que tudo que ela carrega está em texto —
o que é quase verdade hoje (os 68 % estão em `.phase-measure`; os quatro nomes estão nos
quatro blocos) e vira verdade inteira se a legenda nomear as quatro janelas na ordem.

#### A3 — O α é declarado como "região rotulada" e não existe como região em nada do renderizado

O *Accessibility Floor* promete: *"cada grupo é uma região rotulada, e o leitor de tela que
entra num bloco de fase chega nele pelo cabeçalho que diz o α e a razão. Sem isso, a economia
de imprimir o α uma vez vira perda de informação para quem não vê a disposição."*

Toda a semântica de acessibilidade da prancha é **4 `aria-label`, todas no `<svg>`** — zero
`role`, zero `tabindex`, nada marcando `.grupo` como grupo nem `.g-name` como cabeçalho.

O que **funciona**: os quatro `.bloco` são filhos de DOM do `.grupo`, então a leitura linear
por *swipe* passa pelo cabeçalho antes dos blocos e a associação se mantém. A ordem de
leitura segue a ordem visual, como o *Floor* pede.

O que **não** funciona: quem pula por cabeçalho no rotor, ou quem volta a um bloco sozinho,
chega em *"Quarto minguante · inconclusivo · 382 noites coletáveis"* sem nenhum α por perto.
Com dois α e quatro blocos, errar o agrupamento é ler **1,67 % como 5 %** — que é
literalmente o efeito que o §11 do pré-registro de 28/09 proíbe (*"desfaz no leitor a
distinção que a §3 pagou para manter"*).

**Correção:** `accessibilityRole="header"` no nome da família, e o α no
`accessibilityLabel` de **cada bloco** — sem imprimi-lo na tela, porque os *Don'ts* proíbem
repetir o α por fase visualmente. A economia visual fica; a informação viaja.

#### A4 — A prancha ainda não embarca `@font-face`, e na geometria nova o fallback **muda o veredito de lado** no XXXL

Era **B1** (baixo) na primeira passada. **Promovido a alto** porque com a frase de duas linhas
a diferença entre as fontes deixou de ser cosmética e passou a cair exatamente no corpo que
decide a emenda.

Confirmado: **0 `@font-face` no CSS** da prancha (a única ocorrência da palavra no arquivo é
prosa, na nota de pé nº 7). Num Mac ela renderiza em Iowan Old Style / SF Mono / system-ui.
Medido a 100 px, *"Das quatro fases"* ocupa **549 px em Instrument Serif** e **736 px no serif
do sistema** — a fonte do app é **25 % mais estreita**, então a página real é mais curta.

Fim da última linha da frase coletiva, pior estado, nas duas medições:

| escala | fontes reais do app | fallback (como a prancha abre) |
|---|---|---|
| 1,000 | 615 · folga 229 | 663 · folga 181 |
| 1,235 (XXL) | 736 · folga 108 | 831 · folga 13 |
| **1,353 (XXXL)** | **773 · folga 71 — CABE** | **877 · falta 33 — NÃO CABE** |
| 1,450 | 803 · folga 41 | 915 · falta 71 |
| 1,500 | 855 · falta 11 | 971 · falta 127 |
| 1,786 (AX1) | 1096 · falta 252 | 1233 · falta 389 |

**Último corpo seguro: 1,45 com as fontes reais · 1,235 (XXL) com o fallback.** Quem reabrir a
prancha para conferir vai concluir que **o XXXL já quebra** — um corpo que se alcança pelo
controle normal de Tela e Brilho, sem tocar em Acessibilidade — e isso é **falso**, mas só
porque a folha mente sobre as próprias fontes. Numa decisão que vai virar cláusula de ADR, é a
diferença entre "a garantia vale para o corpo que o dono talvez use" e "não vale".

**E a linha em que a dobra cai mudou de novo, nos dois sentidos.** `EXPERIENCE.md` §*A dobra* e
o memlog 58 dizem *"na linha **Noites e ciclos**"*. Na prancha corrigida, com as fontes reais,
a dobra cai em **"Desfecho"** (833–889), a segunda linha da moldura; *Noites e ciclos* ficou
45 px **abaixo** dela. Com o fallback cai na **primeira** linha, *"Janela testada"*
(787–873). Nenhuma das duas é *Noites e ciclos*, e na primeira passada (antes do conserto da
ordem) eu havia medido *Próxima leitura* — **três medições, três linhas diferentes**, e é
exatamente por isso que o número não pode viver na prosa da espinha sem dizer contra que fontes
e contra que versão do layout foi tirado.

**Correção no documento:** `EXPERIENCE.md` §*A dobra* para de nomear a linha e passa a dizer
o que é estável — *a dobra cai dentro da moldura, e os quatro blocos de veredito ficam abaixo
dela* —, com o número exato ficando na prancha, que é onde ele pode ser remedido.

**Correção, quatro linhas:** declarar as `@font-face` na prancha apontando para
`mobile/assets/fonts/` (`Manrope-Regular/SemiBold/Bold`, `GeistMono-Regular/SemiBold`,
`InstrumentSerif-Regular`), ou escrever na legenda com que fontes cada px foi medido. Sem
isso, a próxima remedição chega a um terceiro número e ninguém sabe qual vale.

### MÉDIO

#### M1 — A banda da janela, sozinha, mede 1,20 de contraste — 2,5× abaixo do piso de 3:1 de objeto gráfico

`soft #DDE4F2` sobre `bg #FFF7EE`: **contraste 1,20**, ΔE2000 **12,11**. A banda é o realce
que carrega *"as quatro janelas ocupam 68 % do ciclo"*, o fato que a figura existe para
entregar antes de qualquer texto — logo é objeto gráfico necessário para entender o conteúdo,
e 1,20 está muito abaixo de 3:1.

Ela é **salva por redundância**, e a redundância é real e medida (tabela no §*Alvo 2*): o
tique em `accent` passa 3:1 contra o fundo (3,16) e sobrevive à acromatopsia (ΔE 24,41), e o
contorno do disco troca `ink2` 0,7 px por `ink` 1,0 px dentro da janela. A figura **não é
reprovada**. O que se registra é que o *tint* não sustenta nada sozinho, para que ninguém
mais tarde remova a régua ou o degrau de contorno acreditando que a cor da banda basta — o
mesmo erro que a medição da faixa de caderno já pagou em 07/09.

`DESIGN.md` §*Don'ts* diz *"Não use `soft` como fundo de faixa"* e a figura usa `soft` como
fundo de realce. **Não é a mesma proibição** — aquela é sobre distinguir quatro módulos entre
si, esta é uma decisão binária — mas a fronteira entre as duas não está escrita em lugar
nenhum, e a próxima pessoa que ler os *Don'ts* vai achar que a figura os contraria.
**Correção:** uma linha no §*A figura das quatro janelas* dizendo que o realce é binário, que
mede 1,20, e que são os outros três canais que o sustentam.

#### M2 — `.subhead .sub` usa `opacity:.78` sobre o `accent` e cai para 3,72

*"agosto 2026"* — o período da edição, no cabeçalho de sub-página — sai em 11 px mono, em
`onAccent` com `opacity:.78`. Composto: **`#30343D` sobre `#6E8CC9` = 3,72**, abaixo de 4,5
para texto normal.

`onAccent` em opacidade cheia mede **5,10** no par do Sono — número que a prancha de 07/09
registrava no rodapé e que a espinha nunca escreveu (é a lacuna do memlog 63; **confirmo 5,10**).
A opacidade é o que quebra, e ela quebra **também a barreira** que `DESIGN.md` §*`onAccent`*
promete instalar em `theme.test.ts`: um teste sobre o token não vê uma opacidade aplicada no
ponto de uso. É a única `opacity` da prancha.

**Correção:** tirar a `opacity` e deixar `onAccent` cheio, ou — se a hierarquia visual entre o
nome do caderno e o período importa — resolvê-la por peso e tamanho, que já estão ali (17 px
peso 700 contra 11 px mono), e não por transparência.

#### M3 — O botão de voltar não está entre os alvos de toque que a espinha enumera, e renderiza 15 × 24 px

`Interaction Primitives` diz *"Alvo mínimo de 44 px. **Três** alvos na edição: linha de
sumário, entrada da lua, capa da parede"*, e o *Floor* repete *"Alvo de toque ≥ 44 px em todos
os **três** alvos"*. O botão de voltar do cabeçalho de sub-página é um **quarto** alvo e não
aparece em nenhuma das duas listas. Medido na prancha: o glifo renderiza **15 × 24 px** com as
fontes reais e 10 × 24 px no fallback.

Atenuantes reais: a `.subhead` tem **52 px** de altura, então 44 px cabem na vertical sem
mexer no desenho — só a caixa de toque horizontal precisa ser declarada; e as primitivas
reservam a borda esquerda ao voltar do sistema (*"a borda esquerda pertence ao voltar do
sistema"*), então não é a única saída.

**Correção:** o botão entra na lista (passam a ser **quatro** alvos) com caixa de toque
declarada de 44 × 44, e `accessibilityLabel` dizendo para onde volta — *"voltar ao caderno
Sono"* —, porque o chevron sozinho não diz.

#### M4 — A coluna de rótulos deixou de cortar e passou a **transbordar**: `max-content` sem teto come a coluna do valor

Era **A1** (alto). **Rebaixado a médio**: o defeito que importava — rótulo obrigatório cortado
— acabou.

**O que foi resolvido.** A coluna saiu de `width:104px; flex:none` para um grid
`grid-template-columns: max-content 1fr`. Medido, os cinco rótulos agora saem em **1 linha em
todas as escalas de 1,0 a 2,643**, sem corte e sem quebra de palavra. Antes, *"Próxima
leitura"* já quebrava em duas linhas no corpo padrão, e no AX1 *"Desfecho"* (105 px) e
*"Execuções"* (121 px) transbordavam uma caixa de 104 px sem oportunidade de quebra. A coluna
acompanha: 133 px no padrão → 164 no XXXL → 203 no AX1 → 281 no AX3.

**O que sobrou.** `max-content` não tem teto, então a coluna do rótulo come a do valor e depois
a moldura inteira transborda os 340 px de largura útil:

| escala | coluna do valor | transbordo da moldura |
|---|---|---|
| 1,000 | 207 px | — |
| 1,353 (XXXL) | 176 px | — |
| 1,700 | — | **+1 px** (estado 4) |
| **1,786 (AX1)** | **137 px** | **+15 px** (estado 4) |
| 2,143 (AX2) | — | **+38 px** · **+75 px** (estado 4) |
| **2,643 (AX3)** | — | **+113 px** · **+158 px** (estado 4) |

O estado 4 é sempre o pior porque *"Primeira leitura"* é o rótulo mais largo. E antes de
transbordar, a moldura **estrangula o valor**: no AX1, com 137 px e mono a 22,3 px,
*"~49 dentro · 241 fora, por fase"* vai a **5 linhas**, e o sub-valor
*"17 ciclos sinódicos · 290 noites · 23 abr 2025 → 07 set 2026"* cabe no mesmo vão.
No iOS o transbordo não aparece como barra de rolagem: a `View` recorta na borda do cartão, e
o que se perde é o fim do **valor**, não o rótulo.

**Correção, e ela já estava na lista:** limitar a coluna (`minmax(max-content, 40%)` ou
equivalente) **ou** empilhar rótulo acima do valor a partir do AX1 — o empilhamento devolve
largura cheia ao valor, remove o transbordo e é a mesma mudança que o relatório anterior
recomendou. E a regra do *Accessibility Floor* passa a dizer **dimensão fixa**, não **altura
fixa**: `max-content` sem teto é a terceira forma do mesmo congelamento.

### BAIXO

_Nenhum._ O único achado baixo (B1, as fontes de fallback) foi **promovido a alto** na
remedição de 01/10 e vive como **A4**.

---

## O que está limpo, e por quê

Não são achados. Estão aqui porque foram **medidos** e o resultado passou — e porque a
espinha afirma alguns destes números e eles precisavam ser conferidos, não repetidos.

- **O pente de tinta está certo até a segunda decimal.** Recalculei os quatro tokens:
  `ink #1F1B16` **17,12 / 16,13** · `ink2 #5C534A` **7,52 / 7,09** · `ink3 #9C928A` **3,05 /
  2,87** · `ink4 #C6BCAE` **1,87 / 1,77** (sobre `surface` / sobre `bg`). Os quatro batem com
  `DESIGN.md` §*Colors*. E `ink3` **não é usado nenhuma vez** dentro do aparelho na prancha
  (0 ocorrências de `var(--ink3)` em qualquer `.device`): a promoção dos rótulos para `ink2`
  foi de fato executada, não só escrita.
- **`onAccent` do par Sono = 5,10.** A lacuna que o memlog 63 registra (*"a espinha declara
  `onAccent` ≥ 4,25 nas 36 combinações mas não o valor do par Sono"*) fecha com este número.
  Vale escrevê-lo no `DESIGN.md`.
- **Altura nunca é congelada.** Nenhum `height` em `.coletiva`, `.ficha`, `.f-row`, `.grupo`,
  `.bloco` nem em nenhum dos `.b-*` — só no cromo do aparelho (`.statusbar` 40 px, `.subhead`
  52 px, a bateria). Os blocos crescem **183 → 216 → 268 → 397 → 661 px** de 1,0 a 2,643, e
  a régua de 200 px de 07/09 não foi reproduzida, como o comentário do cabeçalho promete. O
  achado crítico de 07/09 está corrigido. **A moldura também deixou de congelar largura** — ver
  M4 para o que sobrou no lugar.
- **A frase coletiva nunca perde um compartimento, agora em duas famílias.** Recontado na
  prancha de hoje: **dois `.c-fam`** por estado, cada um com `.c-lab` + `.c-1` + `.c-2`, nos
  quatro estados — oito compartimentos, nenhum ausente. E os denominadores são **1 e 3**,
  nunca 4, como o §2 de 28/09 manda. `.entry-1` e `.entry-2` seguem presentes nas quatro linhas
  de entrada. O *Don't* *"Não some nenhum dos dois compartimentos"* está cumprido no
  renderizado.
- **A linha de entrada é alvo de sobra.** 141 px de altura no padrão (estados 1, 2 e 4) e
  163 px no estado 3 — 3,2× o piso de 44. Escala para 290 px no AX1 sem cortar nada.
- **A paridade entre estados da linha de entrada existe.** `.entry-1` 19/25 e `.entry-2`
  15/22 nos quatro estados, mesma família, mesma tinta (`ink` nos dois compartimentos). A
  diferença de altura entre os estados (141 contra 163) é comprimento de texto, não de
  tratamento — que é o que `DESIGN.md` quer dizer com *"a invariância é de forma, não de
  texto"*. A escolha de 19/15 contra os 24/17 da página é declarada como autorada (memlog
  62a) e a justificativa se sustenta: a ADR compara negativo com positivo, e aqui os dois
  saem em 19/15.
- **As quatro janelas não competem por cor.** Todos os quatro retângulos em `--soft`, todos
  os quatro tiques em `--accent`, os rótulos centrados nos centros das janelas (39,9 · 124,06
  · 208,22 · 292,38, que são exatamente `x + 28,5` de cada retângulo) e o traço do instante
  **fora** da janela, como a legenda diz. Confirmei também que os discos realçados são as
  cinco noites certas de cada fase (índices 1–5, 8–12, 16–20, 23–27 de 30 células), e que o
  contorno mais escuro e mais grosso acompanha exatamente esses índices.
- **A `aria-label` da figura cobre os três itens que o *Floor* pede** — as quatro janelas, as
  cinco noites de cada uma e o instante caindo fora delas. Não carrega os 68 %, e **não
  precisa**: `.phase-measure` os imprime em prosa logo abaixo e o rodapé do método os repete.
  Vale emendar a frase do *Floor* (*"sem a descrição, quem usa VoiceOver perde o 68 % do
  ciclo"*) para dizer que o portador é o parágrafo, senão alguém "conserta" enfiando o número
  no `alt` e apagando o parágrafo.
- **Sem `hover`, sem `transition`, sem compartilhar, sem gesto horizontal** na prancha — a
  única ocorrência de *"compartilhar"* no arquivo é um comentário citando a primitiva que o
  proíbe.
- **O versalete "Família" repetido nos dois grupos** não é defeito: o leitor de tela ouve
  *"Família · A cheia, sozinha"* e *"Família · Nova, crescente e minguante"*, que é a leitura
  correta.

---

## Para quem for aplicar

Ordem que eu seguiria depois da remedição, e por quê:

1. **A4 — embarcar as `@font-face` na prancha.** Quatro linhas, zero risco, e é **pré-requisito
   das outras decisões**: sem isso, a próxima pessoa que abrir a folha mede o XXXL quebrando por
   33 px e decide a emenda sobre um número errado.
2. **C2 — fechar a redação da emenda primeiro, o layout depois.** O que a emenda pode afirmar
   está no §*Alvo 1 · 4*: a garantia é sobre a **linha de entrada**, que é íntegra em todo corpo;
   ela **não** pode afirmar que a página entrega o veredito na primeira tela, porque de 1,5 para
   cima não entrega. Com a redação certa, a emenda sai agora e o caminho 2 (o piso de dobra por
   corpo de letra) entra como trabalho declarado em vez de bloqueio.
3. **M4 — tirar o teto de `max-content`**, empilhando rótulo acima do valor a partir do AX1. Isso
   remove o transbordo de +15/+113/+158 px e devolve largura cheia ao valor, que hoje cai a
   137 px no AX1. E a regra do *Floor* passa a dizer **dimensão fixa**, não **altura fixa**.
4. **A3 e M2** — uma linha de código cada, e fecham buracos que a própria espinha promete
   resolver (`accessibilityRole="header"` + o α no label de cada bloco; tirar a `opacity:.78`).
5. **A2, M1, M3** — podem virar emenda de documento antes de virar código. **A2 ficou mais
   pesado com a remedição**: no AX3 o SVG é 86 px congelados contra um título de 159 px, e é um
   dos 400 px que ainda estão acima da frase coletiva, então ele aparece agora nos dois lados —
   como barreira de legibilidade e como ocupante da primeira tela.

**C1 está fechado** e não precisa de ação.

Duas coisas que **não** são desta lente e ficam apontadas: a **emenda à ADR 0045** continua
não escrita e é pré-requisito de construção (questão aberta 3 da espinha), e a **questão 16**
— o grão do histórico com quatro fases por execução — não aparece em nenhum dos quatro
estados da prancha, então nenhum estado de histórico foi medido aqui.
