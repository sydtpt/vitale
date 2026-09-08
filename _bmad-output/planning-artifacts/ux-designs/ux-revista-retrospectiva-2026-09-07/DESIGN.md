---
name: A revista da Retrospectiva
description: A identidade visual da Retrospectiva como revista — capa, sumário de chamadas, quatro cadernos com faixa saturada, lápide e a página da lua. Herda o sistema de quatro eixos do Orbe; nenhuma cor é autorada aqui.
status: final
updated: 2026-09-08
sources:
  - ../../../../docs/specs/revista-retrospectiva/spec.md
  - ../../../../docs/specs/revista-retrospectiva/cadernos.md
  - ../../../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - ../../../../docs/specs/revista-retrospectiva/pre-registro-lua.md
  - ../../../../docs/specs/temas/spec.md
  - ../../../../docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md
inherits:
  system: Orbe — quatro eixos (esquema · tema · paleta · marca)
  resolver: packages/shared/src/theme · resolveTokens() · moduleOf()
colors:
  bg: '#FFF7EE'
  surface: '#FFFFFF'
  ink: '#1F1B16'
  ink2: '#5C534A'
  ink3: '#9C928A'
  line: '#EFE6D8'
  sono-accent: '#6E8CC9'
  sono-soft: '#DDE4F2'
  movimento-accent: '#F25C2B'
  movimento-soft: '#FFE3D2'
  coracao-accent: '#E05C5C'
  coracao-soft: '#FDDEDE'
  rotina-accent: '#6FA86A'
  rotina-soft: '#E2EFD9'
  on-accent: '#1F1B16'
  on-accent-dark: '#000000'
typography:
  edicao:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 15px
    lineHeight: 23px
  caderno-nome:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 22px
    fontWeight: 700
    letterSpacing: 0.2px
  chamada:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 16px
    lineHeight: 22px
  manchete-capa:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 28px
    lineHeight: 33px
  eyebrow:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    letterSpacing: 1.1px
  numero:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
  assinatura:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 11px
    color: '{colors.ink2}'
  lapide:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 12.5px
    lineHeight: 18px
  lapide-do-mes:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 17px
    lineHeight: 25px
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  '2xl': 20px
  '3xl': 24px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  '2xl': 24px
  '3xl': 32px
  '4xl': 48px
  capa-altura: 45vh
  faixa-altura: 56px
components:
  capa:
    height: '{spacing.capa-altura}'
    bleed: full
    overlay: 'véu em gradiente, só sob o texto, com piso de contraste medido'
    overlay-piso: '4.5 contra o pixel mais claro sob o texto'
    titulo: '{typography.manchete-capa}'
    legenda: '{typography.numero}'
  sumario-linha:
    rotulo: '{typography.eyebrow}'
    chamada: '{typography.chamada}'
    separador: '{colors.line}'
    alvo: 'a linha inteira, mínimo 44px'
  caderno-faixa:
    height: '{spacing.faixa-altura}'
    bleed: full
    background: '{colors.sono-accent} | {colors.movimento-accent} | {colors.coracao-accent} | {colors.rotina-accent}'
    foreground: '{colors.on-accent}'
    nome: '{typography.caderno-nome}'
    icone: 'SVG traço, 20px, mesma cor do nome'
  caderno-texto:
    font: '{typography.edicao}'
    color: '{colors.ink}'
    padding: '{spacing.lg}'
  assinatura:
    font: '{typography.assinatura}'
    color: '{colors.ink2}'
  errata:
    marca: 'faixa em {colors.line}, acima do texto, sem alterar o texto'
    font: '{typography.lapide}'
    color: '{colors.ink2}'
    invariante: 'declara, nunca reescreve'
  botao-imprimir:
    background: '{colors.line}'
    label: '{typography.eyebrow}'
    color: '{colors.ink}'
    largura: 'a coluna de texto, não a tela'
  fase-sinodica:
    tipo: 'SVG inline, terminador real'
    destaque: 'as cinco noites que antecedem a cheia'
    cor: '{colors.sono-accent}'
    alt: 'obrigatório — descrição textual da janela testada'
  lapide-pe:
    font: '{typography.lapide}'
    color: '{colors.ink2}'
    marca: 'régua de 2px no accent do caderno, à esquerda'
  lapide-do-mes:
    font: '{typography.lapide-do-mes}'
    color: '{colors.ink}'
    posicao: 'topo do caderno, logo abaixo da faixa'
  lua-entrada:
    font: '{typography.chamada}'
    color: '{colors.ink}'
    invariante: 'idêntica nos três vereditos'
  lua-moldura:
    rotulo: '{typography.eyebrow}'
    rotulo-color: '{colors.ink2}'
    valor: '{typography.numero}'
    veredito: '{typography.edicao}'
    invariante: 'mesmos campos e mesma rampa tipográfica nos três vereditos; a altura cresce com o texto e cresce igual nos três'
  anuario-tira:
    altura: 34px
    marcas: 12
    cor: 'accent do caderno'
  parede-capa:
    colunas: 2
    rotulo: 'abaixo da capa'
    rotulo-color: '{colors.ink2}'
    radius: '{rounded.md}'
---

> **Espinha visual.** Este documento e o [`EXPERIENCE.md`](EXPERIENCE.md) são pares e
> vencem qualquer mockup em caso de conflito. O que ele **não** faz é redecidir o
> contrato: [`spec.md`](../../../../docs/specs/revista-retrospectiva/spec.md) e seus
> quatro companions continuam sendo a lei do que construir.

## Brand & Style — marca e postura

A Retrospectiva é **um jornal impresso, não um painel**. Informa, não aconselha; não
recomenda, não motiva, não parabeniza. Escolher qual fato lidera é jornalismo — dizer o
que fazer com ele não é, e continua proibido.

Disso sai tudo o mais. Uma revista tem **capa**, tem **sumário**, tem **cadernos
assinados** e tem **arquivo**; não tem KPI, não tem medidor, não tem selo de conquista.
O leitor é uma pessoa só, relendo o próprio ano — e a promessa central é que o que ele
leu em agosto continua exatamente igual quando reabrir em outubro.

Duas texturas convivem de propósito. O **miolo é editorial**: serifada, entrelinha
larga, colunas de texto que se leem em silêncio. A **ficha técnica é instrumento**:
mono, versalete, valores alinhados em coluna. A fronteira entre as duas não é estética,
é epistemológica — serifada é o que a máquina escreveu e passou pela conferência; mono é
o que a máquina mediu. O leitor precisa saber qual é qual sem que ninguém explique.

E há uma terceira: **a faixa de caderno é sinalização**, saturada e sem sutileza, porque
a ordem dos cadernos muda a cada edição. Em revista de ordem fixa o leitor reconhece pela
posição; aqui, pela cara.

## Colors — cor

**Nenhuma cor é autorada neste documento.** Ela nasce em
`packages/shared/src/theme` e chega à tela por `resolveTokens()` e `moduleOf()`. Os
hexes do frontmatter são o **recorte medido** de uma das 36 combinações do sistema —
tema Orbe · paleta orbe · esquema claro —, presentes só porque HTML de mockup não roda o
resolvedor. Nenhuma tela escreve hex.

### Os quatro cadernos, e por que cada um tem a cor que tem

Cada caderno aponta para um módulo do app, e o módulo aponta para um papel cromático via
`MODULE_ROLE`. A ponte é essa, e nada mais:

| Caderno | Módulo | Papel | Por quê |
|---|---|---|---|
| **Sono** | `agua` | `blue` | Obediência, não escolha. A gramática de sono já existe e já é azul: [`sleep/colors.ts`](../../../../packages/shared/src/sleep/colors.ts) fixa `asleep`/`light`/`deep` na rampa azul em toda tela de sono. Um caderno de Sono vermelho contradiria as telas que ele resume. |
| **Movimento** | `treino` | `orange` | Direto. É o módulo do treino, e o laranja do Orbe é dele desde o começo. |
| **Coração** | `saude` | `red` | Direto. É o assunto que o painel da web já chama de Coração. |
| **Rotina** | `habito` | `green` | Rotina é o único caderno que fala do que o dono **decidiu**, não do que aconteceu com o corpo dele. Hábito é o módulo da decisão repetida. |

Sono e Coração quase colidiram: os dois são saúde, e existe um único papel `red` para
`saude`. Se ambos apontassem para lá, CAP-7 morreria na origem — dois cadernos com a
mesma cara. A gramática de sono resolveu sem inventar nada.

### A faixa é saturada porque o tint não separa

Medido nas 36 combinações (3 temas × 6 paletas × 2 esquemas, 216 pares):

| Fundo da faixa | ΔE mín entre as quatro | pares abaixo de 10 | contraste do nome |
|---|---|---|---|
| `soft` (tint pálido) | **0,8** | **216/216** | 3,00 |
| `accent` (saturado) | 4,1 | 30/216 | 4,25 |

Em tint, as quatro faixas são a **mesma água pálida** pela régua do próprio repositório.
A faixa anunciaria que *há* uma seção, nunca *qual* — que é exatamente o que a faixa existe
para dizer. **A faixa só cumpre CAP-7 se for saturada.**

### `onAccent` — o token que faltava

Não existia primeiro plano para fundo `accent` sólido por papel de paleta. Havia
`onPrimary`, mas só para a marca; e `on`, que é o primeiro plano do **tint** —
`contrast(on, accent)` mede 1,00 a 1,28 no Orbe, invisível.

`onAccent` deriva como o **melhor entre `ink` e `bgPure` por contraste medido**, no
mesmo molde do `onPrimary`. Resultado nas 36: mínimo **4,25**, nunca abaixo de 3,0. No
claro escolhe `ink` nos quatro cadernos (4,77 a 6,10); no escuro escolhe preto sobre o
acento clareado (6,34 a 9,12).

Isto é **mudança no sistema de tema, não numa tela** — entra em `derive.ts`, ganha
barreira em `theme.test.ts`, e passa a existir para todo papel, não só para os quatro
cadernos.

### Onde a informação é obrigatória, a tinta é `ink2`

Medido no recorte Orbe claro, contra `surface` e contra `bg`:

| token | hex | sobre `surface` | sobre `bg` |
|---|---|---|---|
| `ink2` | `#5C534A` | **7,52** | **7,09** |
| `ink3` | `#9C928A` | 3,05 | **2,87** |
| `ink4` | `#C6BCAE` | 1,87 | 1,77 |

`ink3` a 10–11 px não alcança 4,5 no esquema claro, e **sobre `bg` não alcança nem o piso
de 3,0 de objeto gráfico**. Aumentar o corpo não resolve: texto grande no WCAG começa em
24 px normal ou 18,66 px negrito, e nenhum desses tamanhos cabe numa assinatura.

Então **assinatura, os cinco rótulos da ficha da lua e o período de cada capa na parede
usam `ink2`, no mesmo corpo**. `ink3` continua sendo a linguagem do apoio — versalete
decorativo, texto que o leitor pode não ler sem perder nada.

No esquema escuro o problema não existe: `ink3` mede 4,47 / 4,86. É defeito do claro, e a
correção vale para os dois porque a regra é uma só.

### A colisão que sobra, e quem a resolve

**Movimento (laranja) × Coração (vermelho)** medem ΔE 4,1 a 9,9 em **cinco das seis
paletas**. A única que os separa é a **acessível** (11,1 a 18,7) — a paleta `cvdSafe`
fazendo exatamente o trabalho dela. A pior é `terra`: 4,1 nos três temas.

Por isso **a cor não é o único portador da identidade do caderno**: o ícone dentro da
faixa é o segundo. Resolve a colisão e resolve daltonismo no mesmo gesto, nas cinco
paletas estéticas que nunca prometeram separação.

### O que a cor de caderno não é

Não é cor de dado. A faixa é **identidade de seção**; gráfico, série e marca continuam
lendo `graphic`, `wash` e a rampa do papel. E não é a marca: `primary` é cromo — FAB,
CTA, estado ativo — e não entra em faixa nenhuma.

## Typography — tipografia

Três famílias, já embarcadas no binário pelo plugin `expo-font`, cada uma com um trabalho
que as outras não fazem:

- **Instrument Serif** — o que se lê. Texto de caderno, chamada do sumário, manchete de
  capa, veredito da lua. A regra vem pronta do [`EdicaoCard.tsx`](../../../../mobile/src/components/EdicaoCard.tsx),
  em produção: *serifada e com entrelinha larga, porque é texto para ler, não dado para
  conferir*.
- **Geist Mono** — o que se mede. Números, ficha técnica da lua, legenda de parada,
  assinatura. Tabular: alinha em coluna, e é isso que a torna instrumento.
- **Manrope** — o cromo. Nome de caderno, versalete, rótulo, lápide de pé.

### A rampa

| Papel | Corpo | Família | Onde |
|---|---|---|---|
| `manchete-capa` | 28 / 33 | serif | a manchete do caderno em `posicao = 1`, sobre a capa |
| `caderno-nome` | 22, peso 700 | sans | dentro da faixa |
| `lapide-do-mes` | 17 / 25 | serif | a lápide, **só** no mês da morte |
| `chamada` | 16 / 22 | serif | a linha do sumário, e a entrada da lua |
| `edicao` | 15 / 23 | serif | o texto de cada caderno |
| `lapide` | 12,5 / 18 | sans | a lápide, no pé, nos outros meses |
| `eyebrow` | 11, versalete, `letter-spacing 1,1` | sans | rótulo de seção e de campo |
| `assinatura` | 11 | mono | modelo e data, sob cada caderno |

**A assinatura é obrigatória e visível**, sob o texto de cada caderno, no formato
`gemini-3.6-flash · 07 set 2026`. Jornal assina coluna, e o leitor tem direito de saber
que aquilo foi escrito por máquina e por qual.

**Um degrau, uma vez.** `lapide-do-mes` existe só para o período em que a métrica morreu;
nos meses seguintes a mesma frase volta a `lapide`. Não há terceiro tamanho.

### Números dentro da prosa continuam serifados

A regra *número em mono* vale para **número exposto como dado**: ficha técnica, legenda de
parada, assinatura, valores da moldura da lua. **Não** vale para número dentro de frase —
*"435 km, metade de julho"* é prosa, e trocar a família no meio dela quebraria a linha
para provar uma regra que existe para outra coisa. A fronteira é a pergunta
*este número está numa tabela ou numa frase?* — não *isto é um algarismo?*

## Layout & Spacing — grade e respiro

A escala é a do app (`spacing` do shared, 4 → 48). Dois valores novos, ambos derivados de
decisão e não de gosto:

- **`capa-altura: 45vh`** — a capa ocupa quase metade da primeira tela. A consequência é
  aceita por escrito: o sumário cai abaixo da dobra, e entrar na revista custa uma
  rolagem curta.
- **`faixa-altura: 56px`** — alto o bastante para o nome em 22 px respirar com o ícone,
  baixo o bastante para quatro faixas empilhadas não virarem quatro banners.

**Sangria.** Capa e faixa de caderno **sangram de borda a borda**; todo o resto respeita
a margem de `{spacing.lg}`. A sangria é o que separa estrutura de conteúdo: o que sangra
é a arquitetura da revista, o que recua é o que ela tem a dizer.

**Uma página, uma rolagem.** A edição de mês é **um documento contínuo** — capa, sumário
e os quatro cadernos. Não há paginação, não há abas, e o gesto de voltar sai da edição
inteira. A única tela filha da revista é a página da lua.

## Elevation & Depth — profundidade

A revista é **plana**. Os cadernos não são cartões flutuantes: são seções de um mesmo
documento, separadas pela faixa e pelo respiro, não por sombra.

A sombra fica onde já estava — nos cartões que a Retrospectiva tinha antes — e a
**parede de capas** é a exceção deliberada: ali cada capa é um objeto, e a sombra suave
é o que faz a grade ler como pilha de revistas em vez de grade de miniaturas.

O véu sob o texto da capa é um **gradiente local**, nunca um filtro sobre a imagem
inteira. A foto informa: escurecê-la por inteiro para caber texto seria decorar em cima
de dado.

**E o véu tem piso, não intenção.** É o único lugar da revista onde o contraste depende de
uma imagem que o app não escolhe — as fotos vêm da biblioteca do iPhone, e um céu branco
sob texto claro mede ≈1,8. O véu se aprofunda até o texto alcançar **4,5 contra o pixel
mais claro sob ele**, medido, não estimado. Um véu que não alcança o piso não é véu: aí o
texto sai da imagem e vai para baixo dela.

## Shapes — forma

Raios do app, sem invenção. Duas regras:

- **Faixa e capa não têm raio.** Sangram; um canto arredondado sangrando é contradição.
- **A moldura da lua tem contorno, não sombra.** Ela é uma ficha técnica, e ficha técnica
  tem borda. `{rounded.md}` e uma linha de 1 px em `{colors.line}`.

## Components — componentes

### Capa

> Referência visual: [`mockups/key-edicao.html`](mockups/key-edicao.html) — a capa de agosto/2026 com foto, véu local e a legenda de três campos; e [`mockups/key-arquivo.html`](mockups/key-arquivo.html), onde a capa com traçado aparece ao lado da capa com foto.

Imagem sangrada a `{spacing.capa-altura}`, com **nome do período** e **manchete do
caderno em `posicao = 1`** sobrepostos, sobre véu em gradiente local.

Duas naturezas, e a diferença entre elas é conteúdo:

- **com foto** — `coverOf()`, com a legenda de **três campos**: `Ittre · km 31,1 ·
  12:38`. Parada, quilômetro e hora. Sem os três, seria decoração; com os três, é a única
  entrada da revista que diz **onde** o período aconteceu.
- **com traçado** — a rota do próprio período, em SVG sobre fundo liso, quando não há
  foto. **Não é remendo:** as fotos são só de 2026, e a textura das capas registra quando
  o dono passou a fotografar. 2023 tem que parecer 2023.

A capa **é carimbada na impressão** — a escolha da foto e a legenda já formatada, para
que não mudem depois que o período fechou. **Onde** o carimbo mora é decisão de
arquitetura, fora deste documento. A manchete continua **derivada** do caderno em
posição 1, e não congela junto: uma reimpressão parcial que troque o líder troca a
manchete sob a mesma imagem.

> Corrigido em 08/09/2026. Este parágrafo dizia *"a capa não ganha coluna no banco"* —
> a posição de 07/09, revogada no mesmo dia em que estas espinhas fecharam, porque
> `coverOf` lê `isCover` e `state === 'linked'`, os dois mutáveis depois da impressão.

### Linha de sumário

Rótulo (nome do caderno, `eyebrow`, subordinado) + **a chamada daquele caderno**, em
`chamada`. Não diz o que tem dentro; diz **por que entrar**. O texto é reaproveitado do
caderno — custo de superfície zero, e já passou pelas cinco regras de verificação.

**A primeira linha repete a manchete da capa, e isso é forma, não defeito.** A capa mostra
a manchete do caderno em `posicao = 1`; a primeira linha do sumário mostra a chamada do
mesmo caderno, que é a mesma frase — sempre dentro da primeira tela e meia. É o que
revista impressa faz: a capa anuncia a matéria principal e o sumário a lista de novo. As
duas servem trabalhos diferentes — a capa é identidade do período, a linha é o alvo de
toque que leva ao caderno.

### Faixa de caderno

> Referência visual: [`mockups/key-edicao.html`](mockups/key-edicao.html) — as quatro faixas na mesma página, com ícone.

`{spacing.faixa-altura}`, sangrada, fundo no `accent` do caderno, nome em `onAccent`,
ícone em traço na mesma cor.

| Caderno | Ícone | Origem |
|---|---|---|
| Sono | `moon-outline` | herdado do `ICON_MAP` (`sleep`) |
| Coração | `heart-outline` | herdado do `ICON_MAP` (`heart`) |
| Rotina | `checkmark-circle-outline` | herdado do `ICON_MAP` (`habit`) |
| Movimento | `bicycle-outline` | **novo** — não existe no `ICON_MAP` |

O mapa atual tem `barbell-outline` para treino e `walk-outline` para distância; nenhum é
bicicleta. `bicycle-outline` entra assumindo um viés declarado: a pedalada domina o acervo
(555 atividades, 138 rotas com piso, 1.210 fotos), e o ícone diz o que o caderno
majoritariamente é. Corrida e caminhada ficam sob ele.

### Lápide

> Referência visual: [`mockups/key-edicao.html`](mockups/key-edicao.html) — os dois estados no mesmo caderno: anéis no topo com o degrau, VO₂max no pé no corpo normal.

Nome da métrica, última data, ponto. `respiração — última medida em 10/07/2026.`

**Nada de "verifique suas conexões".** Isso é conselho, e conselho está proibido; o
alerta operacional sai da revista e vai para Conexões, com o tempo do agora. A edição
congela, e em 2030 a de agosto/2026 ainda dirá que os anéis pararam — o que como
história está certo e como alerta seria ruído de quatro anos atrás.

Dois estados visuais, nunca um terceiro:

| Quando | Posição | Tipografia |
|---|---|---|
| **no período em que a métrica morreu** | topo do caderno, sob a faixa | `lapide-do-mes` — serifada, 17/25 |
| **em qualquer outro período** | pé do caderno | `lapide` — sans, 12,5/18, com régua no accent |

### Entrada da lua

Uma linha no pé do caderno Sono que **carrega o veredito por extenso** e abre a página da
lua. **Idêntica em tipografia e em extensão nos três vereditos** — é ela que impede a
página atrás de um toque de virar gaveta.

### Moldura da lua

> Referência visual: [`mockups/key-lua.html`](mockups/key-lua.html) — os três vereditos lado a lado, com a moldura idêntica e só o veredito mudando.

Ficha técnica com contorno. **A moldura é invariável em campos, não em pixels:** cinco
campos sempre presentes, sempre na mesma ordem —
**janela testada · desfecho · noites e ciclos · próxima leitura · contador de
execuções** —, rótulo em `eyebrow` e valor em mono. Abre com **a fase sinódica
desenhada**: o disco com a fatia das cinco noites que antecedem a cheia destacada. É
dado, não símbolo; nenhum ícone de lua.

Abaixo dela, **o bloco do veredito** — o único que muda.

**A paridade é de tratamento, não de caixa.** Os três vereditos têm os mesmos campos e a
mesma rampa tipográfica; o bloco **cresce com o texto, e cresce igual nos três**. Congelar
a altura em pixels parece mais rigoroso e é o contrário: no tipo dinâmico grande a caixa
fixa **corta** o veredito, e quem lê em AX3 é exatamente quem tem baixa visão — uma
configuração de acessibilidade anularia em silêncio a garantia da ADR 0045. Altura fixa
está proibida aqui.

**A página da lua não é caderno**, e disso saem três consequências:

- **Não tem faixa e não tem ícone.** A faixa é regra de caderno; esta é sub-página. Ela
  herda a cor do Sono no cabeçalho, e abre pela fase desenhada.
- **Não leva assinatura de modelo.** Os cadernos assinam porque são texto narrado; a lua
  imprime **veredito calculado sob protocolo**. A procedência dela é outra e já está no
  contrato: **o hash do pré-registro** que autorizou a execução, mais o contador.
- **A covariável fica no rodapé do método.** As horas de luz do dia (~50,8° N) são
  pré-requisito do teste, mas os campos da moldura estão enumerados no contrato e um sexto
  seria redecidir. Ela **sobe para o bloco do veredito** num caso só: quando o portão da
  luz é justamente o que reprovou — porque aí ela é a razão do inconclusivo.

### Postal

> Referência visual: [`mockups/key-formas.html`](mockups/key-formas.html) — o postal acromático, uma tela sem rolagem.

**A única superfície acromática da revista.** Sem cadernos não há o que colorir, e a
ausência de cor de módulo é o que diz *isto é um postal, não uma edição* antes de o leitor
ler uma palavra. É consequência da regra, não padrão novo.

### Tira do anuário

> Referência visual: [`mockups/key-formas.html`](mockups/key-formas.html) — as quatro tiras empilhadas, meses rotulados uma vez só.

12 marcas, 34 px de altura, no `accent` do caderno. Quatro tiras empilhadas abrem o ano
**antes de qualquer texto**: o ano lido como quatro batimentos paralelos. Os meses são
rotulados uma vez só, sob a última tira.

**O anuário não tem capa.** As quatro tiras **são** a capa do ano — leitura fiel de *um
ano não tem uma manchete; tem doze formas*.

### Capa da parede

> Referência visual: [`mockups/key-arquivo.html`](mockups/key-arquivo.html) — a grade atravessando a fronteira foto → traçado.

Grade de **duas colunas**, rótulo (período + manchete curta) **abaixo** da capa,
`{rounded.md}`, sombra suave. Cerca de seis capas por tela.

O **volume anual** é representado pelas **quatro tiras em miniatura**, não por foto nem
traçado — e é isso que o distingue dos meses dentro da grade.

## Do's and Don'ts — o que fazer e o que não

**Faça**

- Resolva cor por `moduleOf()` e `resolveTokens()`, sempre, inclusive para a faixa.
- Deixe a assinatura visível sob o texto de cada caderno.
- Escreva **número exposto como dado** em mono — ficha, legenda, assinatura, valores da
  moldura. Número **dentro de frase** fica na serifada da frase.
- Use `ink2` onde a informação é obrigatória. `ink3` é para o que o leitor pode não ler
  sem perder nada.
- Sangre capa e faixa; recue todo o resto.
- Dê ao ícone o mesmo peso de identidade que a cor tem.

**Não faça**

- **Não escreva hex numa tela.** Os hexes deste documento são recorte medido de uma
  combinação; o app tem 36.
- **Não use `soft` como fundo de faixa.** Medido: as quatro ficam indistinguíveis nas 36.
- **Não use `on` sobre `accent`.** Mede 1,00 a 1,28 — invisível. É `onAccent`.
- **Não dê à lápide um terceiro tamanho**, nem a deixe subir duas vezes.
- **Não reserve espaço para caderno vazio.** Caderno sem o que dizer **some** — sem
  espaço, sem "nenhuma atividade registrada".
- **Não encurte a página da lua quando não deu nada.** A moldura é invariável em campos,
  não em pixels; só o veredito muda.
- **Não ponha botão de compartilhar** em lugar nenhum da revista.
- **Não use exclamação, emoji, elogio ou conselho.** É um jornal.
- **Não deixe a faixa flutuar como cartão.** A revista é plana; sombra só na parede de
  capas.
- **Não congele altura no bloco do veredito da lua.** Caixa fixa corta o texto no tipo
  dinâmico grande, e aí a garantia da ADR 0045 morre calada.
- **Não ponha texto sobre foto sem medir o véu.** As fotos vêm da biblioteca do iPhone; o
  app não escolhe o céu.
