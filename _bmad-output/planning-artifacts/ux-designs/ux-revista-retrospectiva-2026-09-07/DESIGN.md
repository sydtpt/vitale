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
  - ../../../../docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md
  - ../../../../docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md
  - ../../../../docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md
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
  lua-placar:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 24px
    lineHeight: 29px
  lua-fase-nomeada:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 17px
    lineHeight: 24px
  lua-entrada-placar:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 19px
    lineHeight: 25px
  lua-entrada-fase:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 15px
    lineHeight: 22px
  lua-veredito:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 21px
    lineHeight: 26px
  lua-valor:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 21px
    lineHeight: 26px
    letterSpacing: -0.3px
  lua-familia:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 14px
    lineHeight: 19px
    fontWeight: 700
  lua-fase-nome:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 15px
    lineHeight: 20px
    fontWeight: 600
  lua-alfa:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 12px
    lineHeight: 17px
  lua-apoio:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 12.5px
    lineHeight: 18px
  lua-legenda:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 10.5px
    lineHeight: 14px
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
  subpagina-altura: 52px
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
    tipo: 'SVG inline, terminador real, um disco por noite do ciclo'
    destaque: 'as QUATRO janelas de cinco noites, destacadas IGUALMENTE'
    instante: 'traço acima da grade, fora da janela — a exposição é antes da fase'
    estado: 'nenhum — não muda com a rolagem e não destaca uma fase por vez'
    cor: '{colors.sono-accent}'
    medida: 'legenda em mono DEPOIS da frase coletiva, não sob a figura — trinta noites desenhadas para um ciclo de 29,5; vinte delas dentro de uma janela, 68% do ciclo'
    entrega: 'a GEOMETRIA — quatro janelas, 68% do ciclo, o que sobra fora. Não os α, não a contaminação, não o poder'
    alt: 'obrigatório — as quatro janelas, as cinco noites de cada uma e o instante fora delas'
  lapide-pe:
    font: '{typography.lapide}'
    color: '{colors.ink2}'
    marca: 'régua de 2px no accent do caderno, à esquerda'
  lapide-do-mes:
    font: '{typography.lapide-do-mes}'
    color: '{colors.ink}'
    posicao: 'topo do caderno, logo abaixo da faixa'
  lua-cabecalho:
    height: '{spacing.subpagina-altura}'
    bleed: full
    background: '{colors.sono-accent}'
    foreground: '{colors.on-accent}'
    nome: 'o caderno de origem — Sono, 17px peso 700'
    periodo: '{typography.numero}'
    icone: 'nenhum — o ícone é portador de identidade de CADERNO (CAP-7), e esta é sub-página'
  lua-entrada:
    color: '{colors.ink}'
    familia: '{typography.lua-familia}'
    placar: '{typography.lua-entrada-placar}'
    fase-nomeada: '{typography.lua-entrada-fase}'
    separador: '{colors.line}'
    invariante: 'carrega a frase coletiva — DUAS linhas de família, dois compartimentos cada, a mesma tipografia e a mesma extensão de campos em qualquer tupla que o protocolo produza'
  lua-coletiva:
    familia: '{typography.lua-familia}'
    placar: '{typography.lua-placar}'
    fase-nomeada: '{typography.lua-fase-nomeada}'
    regra: 'filete de 2px em {colors.ink} acima; separador de 1px em {colors.line} entre os dois compartimentos de cada linha, e entre as duas linhas'
    invariante: 'duas linhas de família, dois compartimentos cada, e nenhum deles some em tupla nenhuma; as duas linhas nunca se somam num número'
  lua-moldura:
    rotulo: '{typography.eyebrow}'
    rotulo-color: '{colors.ink2}'
    rotulo-coluna: 'dimensionada por conteúdo — largura fixa é PROIBIDA'
    valor: '{typography.numero}'
    valor-apoio: '{typography.lua-legenda}'
    invariante: 'cinco campos e a mesma rampa tipográfica em todos os estados; a altura cresce com o texto e cresce igual em todos'
  lua-grupo:
    familia: '{typography.lua-familia}'
    alfa: '{typography.lua-alfa}'
    razao: '{typography.lua-apoio}'
    razao-color: '{colors.ink2}'
    regra: 'filete de 2px em {colors.ink} acima do nome da família'
    invariante: 'o α aparece uma vez por família, nunca por fase'
  lua-bloco:
    nome: '{typography.lua-fase-nome}'
    veredito: '{typography.lua-veredito}'
    valor: '{typography.lua-valor}'
    legenda: '{typography.lua-legenda}'
    apoio: '{typography.lua-apoio}'
    apoio-color: '{colors.ink2}'
    regra: 'filete de 1px em {colors.line} acima — não é caixa nem cartão'
    altura: 'livre; dimensão fixa é PROIBIDA'
    sem-leitura: 'ocupa a vaga da palavra de veredito, em {typography.lua-veredito} e {colors.ink} — nunca em corpo menor nem em ink2'
    invariante: 'um bloco por fase, sempre os quatro, mesmos campos nas quatro — sem cinza, sem itálico, sem corpo menor, sem ícone'
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
| `chamada` | 16 / 22 | serif | a linha do sumário |
| `edicao` | 15 / 23 | serif | o texto de cada caderno |
| `lapide` | 12,5 / 18 | sans | a lápide, no pé, nos outros meses |
| `eyebrow` | 11, versalete, `letter-spacing 1,1` | sans | rótulo de seção e de campo |
| `assinatura` | 11 | mono | modelo e data, sob cada caderno |

**A assinatura é obrigatória e visível**, sob o texto de cada caderno, no formato
`gemini-3.6-flash · 07 set 2026`. Jornal assina coluna, e o leitor tem direito de saber
que aquilo foi escrito por máquina e por qual.

**Um degrau, uma vez.** `lapide-do-mes` existe só para o período em que a métrica morreu;
nos meses seguintes a mesma frase volta a `lapide`. Não há terceiro tamanho.

### A rampa da página da lua

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html).

A sub-página tem rampa própria porque tem trabalho próprio: ela não narra, **mede**. São
quatro fases em duas famílias, e cada degrau existe para marcar uma fronteira do protocolo.

| Papel | Corpo | Família | Onde |
|---|---|---|---|
| `lua-placar` | 24 / 29 | serif | *"A cheia decidiu."* · *"Nenhuma das três decidiu."* — o primeiro compartimento de cada linha de família, na página |
| `lua-veredito` | 21 / 26 | serif | a palavra de veredito, no bloco de cada fase — e *"sem leitura"*, que ocupa a mesma vaga |
| `lua-valor` | 21 / 26, `letter-spacing −0,3` | mono | o número do bloco, **no mesmo degrau do veredito** |
| `lua-fase-nomeada` | 17 / 24 | serif | o segundo compartimento — as fases nomeadas, ou o motivo |
| `lua-entrada-placar` | 19 / 25 | serif | o mesmo placar de família, **na linha de entrada** no pé do caderno Sono |
| `lua-entrada-fase` | 15 / 22 | serif | o segundo compartimento, na linha de entrada |
| `lua-fase-nome` | 15 / 20, peso 600 | sans | *Lua cheia*, *Quarto crescente* — o rótulo do bloco |
| `lua-familia` | 14 / 19, peso 700 | sans | *A cheia, sozinha* — o nome do grupo, **e o rótulo de família dentro da frase coletiva** |
| `lua-apoio` | 12,5 / 18 | sans | a razão da separação, e as linhas de apoio do bloco |
| `lua-alfa` | 12 / 17 | mono | o α, uma vez por família |
| `lua-legenda` | 10,5 / 14 | mono | a legenda do número, e o sub-valor de cada campo da moldura |

Quatro regras que essa rampa carrega e que não são estéticas:

- **O veredito e o número ocupam o mesmo degrau.** *"inconclusivo"* e *"106 noites
  coletáveis"* saem em 21 px lado a lado, um em serifada e outro em mono. É a ADR 0045 em
  tipografia: o que falta se lê com o mesmo peso de um achado.
- **O quarto estado usa o degrau e a tinta dos outros três.** *"sem leitura"* é palavra de
  veredito, então sai em `lua-veredito` (21 / 26, serifada, `ink`) — **nunca** em `lua-apoio`
  (12,5 / 18, sans, `ink2`), que é −40,5% de corpo mais a tinta de apoio: **corpo menor e cinza**,
  duas das três atenuações que a ADR 0045 §3 proíbe por nome, no estado em que a página vive hoje.
  A frase que explica desce para a linha de apoio, que é onde `lua-apoio` pertence.
- **O α sai em mono porque é medida, não prosa.** Pela fronteira da seção abaixo, ele está
  numa ficha, não numa frase.
- **Nada da página desce para `ink3`.** Os rótulos de 07/09 estavam ali e subiram para `ink2`
  no mesmo corpo — ver §Colors.

### Números dentro da prosa continuam serifados

A regra *número em mono* vale para **número exposto como dado**: ficha técnica, legenda de
parada, assinatura, valores da moldura da lua. **Não** vale para número dentro de frase —
*"435 km, metade de julho"* é prosa, e trocar a família no meio dela quebraria a linha
para provar uma regra que existe para outra coisa. A fronteira é a pergunta
*este número está numa tabela ou numa frase?* — não *isto é um algarismo?*

## Layout & Spacing — grade e respiro

A escala é a do app (`spacing` do shared, 4 → 48). Três valores novos, todos derivados de
decisão e não de gosto:

- **`capa-altura: 45vh`** — a capa ocupa quase metade da primeira tela. A consequência é
  aceita por escrito: o sumário cai abaixo da dobra, e entrar na revista custa uma
  rolagem curta.
- **`faixa-altura: 56px`** — alto o bastante para o nome em 22 px respirar com o ícone,
  baixo o bastante para quatro faixas empilhadas não virarem quatro banners.
- **`subpagina-altura: 52px`** — o cabeçalho da página da lua. **Não é a faixa de caderno**,
  e o degrau de 4 px é a única coisa que diz isso sem palavras: sem ícone, com o botão de
  voltar e o período dentro dele, e um pouco mais baixo porque não precisa acomodar 22 px.

**Sangria.** Capa, faixa de caderno e cabeçalho de sub-página **sangram de borda a borda**;
todo o resto respeita a margem de `{spacing.lg}`. A sangria é o que separa estrutura de
conteúdo: o que sangra é a arquitetura da revista, o que recua é o que ela tem a dizer.

**Uma página, uma rolagem.** A edição de mês é **um documento contínuo** — capa, sumário
e os quatro cadernos. Não há paginação, não há abas, e o gesto de voltar sai da edição
inteira. A única tela filha da revista é a página da lua.

**A dobra da página da lua, aceita por escrito.** Medida nos quatro quadros da prancha **com as
fontes reais do app**, a dobra dos 844 px cai **dentro da moldura, 28 px depois do começo de
*Próxima leitura*** — *Noites e ciclos* fica inteira acima, e **nenhum bloco de fase cabe na
primeira tela**. A primeira tela entrega a figura, a frase coletiva inteira e a maior parte da
moldura. O que paga essa conta é a frase coletiva estar **acima** da dobra: o veredito não está
fora da primeira tela, só o detalhe dele está. Recusadas as duas alternativas — mover a moldura
para depois dos blocos, e encolher a figura.

> **O número, corrigido em 30/09/2026.** Este documento dizia *"na linha Noites e ciclos"*. A
> prancha não embarca `@font-face`, então medida sozinha ela cai no fallback do sistema e fica
> ~45 px mais baixa — e aí a dobra cai, sim, em *Noites e ciclos*. Com Manrope, Geist Mono e
> Instrument Serif cabe mais coisa acima. Quem remedir **diz com que fontes mediu**.

**E a ordem muda por causa do tipo dinâmico grande.** A **legenda da figura e a medida dos 68%
descem para depois da frase coletiva**. Medido: a frase coletiva cabe na primeira tela até XXXL
(1,353), quebra em 1,6–1,7, e no **AX1** sobram 11 px do compartimento que carrega o resultado; no
**AX3** a primeira tela não tem nenhuma palavra do veredito. O que engorda com o corpo é o **texto
ao redor da figura** — legenda e medida somam 80 px no padrão, 257 px no AX1 e 551 px no AX3 —,
não a figura, que é SVG e não escala. Descendo as duas, a figura continua abrindo a página e a
frase coletiva continua sendo o primeiro texto: desce a **explicação** da figura, não a figura.
Nenhuma decisão do dono é revista — as duas alternativas que ele recusou foram recusadas contra a
medida do corpo padrão, e esta não estava na mesa. **A medir de novo:** as medidas são de uma
frase coletiva de **uma** linha, e agora ela tem duas.

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

Raios do app, sem invenção. Três regras:

- **Faixa, capa e cabeçalho de sub-página não têm raio.** Sangram; um canto arredondado
  sangrando é contradição.
- **A moldura da lua tem contorno, não sombra.** Ela é uma ficha técnica, e ficha técnica
  tem borda. `{rounded.md}` e uma linha de 1 px em `{colors.line}`.
- **Grupo e bloco de fase se separam por filete, não por caixa.** Filete de 2 px em
  `{colors.ink}` abre cada família, 1 px em `{colors.line}` abre cada bloco. Quatro blocos
  encaixotados na mesma tela leriam como quatro cartões concorrentes, e a página é uma ficha
  contínua — a mesma razão pela qual a revista é plana.

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

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — a entrada nos quatro quadros, na seção 1 da folha.

Uma entrada no pé do caderno Sono que **carrega a frase coletiva inteira** e abre a página da lua.
São **duas linhas, uma por família**, as duas sempre presentes: rótulo de família em `lua-familia`,
**placar** em `lua-entrada-placar` (19 / 25) e **fase nomeada ou motivo** em `lua-entrada-fase`
(15 / 22), separados por um filete de 1 px em `{colors.line}`. É ela que impede a página atrás de
um toque de virar gaveta.

**As duas linhas nunca se somam num número** — nem aqui, nem na página. Um placar sobre quatro é
o que o §2 do pré-registro de 28/09 proíbe por escrito.

**Ela é menor que a abertura da página, e isso é deliberado.** A página imprime 24 / 17; a
linha imprime 19 / 15, porque vive dentro do texto de um caderno e não pode competir com ele.
O que a ADR 0045 cobra é **paridade entre os estados**, não paridade entre superfícies: o que
tem de ser idêntico é a linha de agosto contra a linha de setembro, não a linha contra a página.
A proporção entre os dois compartimentos é a mesma nos dois lugares.

**A invariância é de forma, não de texto.** As duas linhas, os dois compartimentos de cada uma, a
mesma tipografia e a mesma extensão de campos — **em qualquer tupla que o protocolo produza**, e
no estado pré-execução. A redação anterior — *"idêntica em tipografia e em extensão nos três
vereditos"* — foi escrita quando havia uma fase; ela quebrou em 30/09/2026, quando as fases
viraram quatro e os vereditos passaram a poder ser diferentes entre si. **O texto de cada tupla
sai da regra**, não de uma lista de casos: `EXPERIENCE.md` §A regra de composição.

### Cabeçalho de sub-página da lua

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — o topo dos quatro quadros.

`{spacing.subpagina-altura}`, **sangrado de borda a borda**, fundo no `accent` do Sono,
conteúdo em `onAccent`: botão de voltar, nome do caderno de origem, período à direita em mono.

**Tem cabeçalho sangrado; não tem ícone.** O ícone é o portador de identidade de **caderno**
(CAP-7), e esta é sub-página — a página abre pela figura, que é dado, e não por um símbolo de
lua.

> **Emendado em 30/09/2026.** Este documento dizia *"não tem faixa e não tem ícone"*. A prancha
> aprovada desenha o topo sangrando na cor do Sono, e a aprovação do dono foi sobre o
> **renderizado** — então o desenho vence e o texto se corrige. O que a página não tem é o
> **ícone**. Sem esta nota, alguém lendo a espinha velha "corrige" a prancha de volta.

**A ordem da página**, que as quatro sub-seções abaixo detalham na mesma sequência:

```
cabeçalho de sub-página (sangrado, cor do Sono)
título da sub-página
a figura: as quatro janelas destacadas igualmente   (sem legenda)
a frase coletiva: linha da cheia · linha das três   (placar + o quê/por quê em cada)
a legenda da figura + a medida dos 68%
a moldura: cinco campos
grupo · bloco  ×2 famílias
rodapé do método · procedência
```

**A página abre pela figura, e o primeiro texto é a frase coletiva.** A legenda e a medida vêm
**depois** da frase coletiva desde 30/09/2026 — é o que devolve a primeira tela no tipo dinâmico
grande sem mexer na ordem que o dono aprovou para a figura. Ver §Layout & Spacing.

### A figura das quatro janelas

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — a figura é idêntica nos quatro quadros.

SVG inline, **um disco por noite do ciclo sinódico**, cada disco com o **terminador real** —
`rx = r · |1 − 2·iluminação|`, espelhado na minguante. As **quatro janelas de cinco noites**
vêm destacadas em `{colors.sono-soft}`, **igualmente**, com uma régua em `{colors.sono-accent}`
sob a grade; o **instante de cada fase** é um traço que cai **fora** da janela, porque a
exposição é *antes* da fase.

**O desenho tem trinta células e o ciclo tem 29,5 — e o texto diz as duas coisas.** A figura
arredonda para desenhar noites inteiras; quem contar discos obtém 20/30 = 67%, e a medida diz 68%
(20 / 29,53 = 67,7%). A legenda reconcilia em uma oração: *"trinta noites desenhadas para um ciclo
de 29,5; vinte delas caem dentro de uma janela — 68% do ciclo"*. Sem essa oração o leitor não pode
derivar 29,5 do que vê, e a casa persegue exatamente esse tipo de defeito.

**A legenda e a medida vêm depois da frase coletiva**, não sob a figura — ver §Layout & Spacing.

Não tem ícone de lua e **não tem estado**: nenhum destaque acompanha a rolagem, nenhuma fase é
destacada por vez. Ela abre a página porque **é dado, não símbolo** — e o `alt` é obrigatório
porque ela é dado. Os **68% viajam em prosa**, na medida e de novo no rodapé do método; quem usa
leitor de tela os recebe daí, e ninguém deve "consertar" enfiando o número no `alt` e apagando o
parágrafo.

**O que a figura entrega é a geometria**, não a inferência: quatro janelas, 68% do ciclo, e o que
sobra fora delas. Os α, a contaminação das colunas e o poder baixo não são deriváveis de um
desenho — são texto, e estão no rodapé do método.

### A frase coletiva

**Duas linhas, uma por família, e nenhuma delas some.** Cada linha tem rótulo de família em
`lua-familia`, placar em `lua-placar` (24 / 29) e fases nomeadas ou motivo em `lua-fase-nomeada`
(17 / 24); filete de 2 px em `{colors.ink}` abre o conjunto, separador de 1 px em `{colors.line}`
divide os dois compartimentos de cada linha e as duas linhas entre si. É o **primeiro texto** da
página, e é o texto que a entrada no pé do caderno Sono carrega — os dois dizem a mesma coisa,
palavra por palavra.

O degrau entre 24 e 17 é o que faz os dois compartimentos lerem como **um par**, e não como
manchete e legenda: o segundo é o que carrega o resultado, e encolhê-lo mais o atenuaria.

**São duas porque são dois testes.** A cheia é um teste a 5% unilateral; as três são outro, a
1,67% bilateral cada. Uma linha só, com um denominador de quatro, é o que o §2 do pré-registro de
28/09 chama de errado com essas palavras: *"qualquer página, qualquer frase da revista (…) que
junte os quatro num só resultado está errado"*. Os denominadores são **um** e **três**, e três é o
divisor do α das três. **As duas linhas nunca viram um número só.**

> **Corrigido em 30/09/2026.** A redação escolhida mais cedo no mesmo dia abria com *"Das quatro
> fases, …"*. A **forma** decidida pelo dono é preservada inteira — compartimentos que nunca
> desaparecem, sem variante curta, a entrada carregando o mesmo texto; o que muda é o
> **denominador**, que passa a ser de família.

O texto de cada linha, em qualquer tupla, sai de `EXPERIENCE.md` §A regra de composição —
inclusive a concordância do numeral (*uma decidiu* · *duas decidiram*) e o compartimento que tem
de **caber mais de um nome de fase**.

### Moldura da lua

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — os quatro quadros com a moldura idêntica e os quatro blocos mudando. O [`mockups/key-lua.html`](mockups/key-lua.html) de 07/09 continua ilustrando o que não mudou: os cinco campos, a ordem deles e o rodapé do método.

Ficha técnica com contorno. **A moldura é invariável em campos, não em pixels:** cinco
campos sempre presentes, sempre na mesma ordem —
**janela testada · desfecho · noites e ciclos · próxima leitura · contador de
execuções** —, rótulo em `eyebrow`, valor em mono e sub-valor em `lua-legenda`.

**Os cinco campos valem para as quatro fases**, porque nenhum deles muda de fase para fase.
Por isso a moldura é **uma só**, acima dos blocos, e não se repete quatro vezes. No quarto
estado *Próxima leitura* vira *Primeira leitura* e imprime **uma frase, não uma data** — e a
frase é a **condição**, *"quando a primeira execução autorizada rodar — as quatro juntas"*.
**Número de story não entra aqui:** *"a primeira execução da 4.2"* é vocabulário de
desenvolvimento, e num campo de leitor faz o estado ler como *esperando o build* em vez de
*esperando dado*.

**A coluna do rótulo dimensiona por conteúdo, e largura fixa é proibida.** Ela estava congelada
em 104 px, e medido com as fontes reais: *"Próxima leitura"* já quebra em duas linhas no corpo
padrão, no AX1 *"Execuções"* pede 121 px e no AX3 pede **174 px numa coluna de 104**, sem
oportunidade de quebra porque são palavras únicas. São os cinco rótulos que esta espinha promoveu
para `ink2` **por serem informação obrigatória** — subir a tinta e congelar a caixa cancela metade
do trabalho. A coluna tem a largura da maior etiqueta, ou o rótulo empilha **acima** do valor a
partir de AX1.

**A paridade é de tratamento, não de caixa.** Os quatro estados têm os mesmos campos e a
mesma rampa tipográfica; cada bloco **cresce com o texto, e cresce igual nos quatro**. Congelar
a altura em pixels parece mais rigoroso e é o contrário: no tipo dinâmico grande a caixa
fixa **corta** o veredito, e quem lê em AX3 é exatamente quem tem baixa visão — uma
configuração de acessibilidade anularia em silêncio a garantia da ADR 0045. **Dimensão** fixa
está proibida aqui — altura **e** largura —, e agora em quatro lugares. A regra foi escrita como
*"altura fixa"* e por isso não pegou a coluna de rótulos, congelada um eixo ao lado.

**A página da lua não é caderno**, e disso saem duas consequências mais:

- **Não leva assinatura de modelo.** Os cadernos assinam porque são texto narrado; a lua
  imprime **veredito calculado sob protocolo**. A procedência dela é outra e já está no
  contrato: a **cadeia de pré-registros** — os dois documentos e as duas correções, com o hash
  de cada um —, mais **régua**, **aritmética** e o contador de execuções. O rótulo era
  `motor v1`, e foi renomeado para `aritmética v1` em 30/09/2026: neste app *motor* é a palavra
  de **motor de IA** (`/configuracoes/motores`, ADRs 0047–0049), e `motor v1` num rodapé de
  procedência lê como assinatura de modelo — a única coisa que esta página declara não fazer.
- **A covariável fica no rodapé do método.** As horas de luz do dia (~50,8° N) são
  pré-requisito do teste, mas os campos da moldura estão enumerados no contrato e um sexto
  seria redecidir. Ela **sobe quando o portão da luz é o que reprovou** — para o bloco de cada
  fase **e para as duas linhas da frase coletiva**, porque **esse portão é global às quatro**
  (`sleep/lua-protocolo.ts`: *"Portão 1 — a luz. Global às quatro"*). Este documento dizia
  *"sobe para o bloco, nunca para a frase coletiva"*: a proibição foi derivada de uma premissa
  falsa e cai com ela. Nesse caso **nenhum poder foi calculado**, então escrever *"faltou poder"*
  seria falso — e mandaria esperar cem noites quando o que falta é consertar dado.

### Os grupos e os blocos de fase

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — os dois grupos nos quatro quadros, e as quatro unidades do que falta na seção 3 da folha.

**Dois grupos, quatro blocos.** A cheia sozinha primeiro; depois nova, crescente e minguante,
ordenadas pelo ciclo.

O **cabeçalho do grupo** tem três linhas, e cada uma existe por um motivo:

| Linha | Papel | Por quê |
|---|---|---|
| nome da família | `lua-familia` | *A cheia, sozinha* · *Nova, crescente e minguante* |
| o α | `lua-alfa`, mono | **uma vez por família**, nunca por fase. Mono porque é medida |
| a razão da separação | `lua-apoio`, `{colors.ink2}` | para que a posição da cheia não seja lida como **hierarquia**: a precedência dela é de **procedência** |

**A razão diz o fato datado e não compara.** *"Pré-registrada sozinha em 07/09, **antes das outras
três**"* é comparativo, e instala no menor corpo da página a hierarquia que a frase existe para
negar — contra cinco sinais que já favorecem a cheia (α mais folgado, poder maior, lateralidade que
gasta menos, primeira posição, respaldo de literatura). Sai o comparativo, fica o fato:
*"Pré-registrada em 07 set 2026, com a direção tirada da literatura."* E no grupo vizinho a
ausência de literatura é **razão de desenho**, não carência: é ela que faz as três serem
bilaterais (§5 de 28/09 — *"a ausência dela é justamente o argumento"*).

O **bloco de cada fase** imprime sempre os mesmos campos: **nome · palavra de veredito · o
número com a unidade dele · a legenda do número · as linhas de apoio**. Veredito e número saem
no **mesmo degrau** (21 / 26), um serifado e outro em mono.

Três proibições visuais, todas da ADR 0045 §3:

- **Sem cinza, sem itálico apologético, sem corpo menor** no bloco que não achou nada. A
  explicação do efeito na direção que o pré-registro não cobre sai **no mesmo corpo dos outros
  rótulos**, e sem ícone.
- **Sem travessão** onde vai a palavra de veredito. No quarto estado o bloco diz *"sem
  leitura"*: travessão leria como nulo **medido**. E *"sem leitura"* é **palavra de veredito**,
  então sai em `lua-veredito` e `{colors.ink}`, na vaga do veredito — nunca em `lua-apoio` e
  `{colors.ink2}`, que seria corpo menor mais cinza no estado em que a página vive hoje.
- **Sem caixa.** Filete acima, e nada mais — ver §Shapes.

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
- Sangre capa, faixa e cabeçalho de sub-página; recue todo o resto.
- Dê ao ícone o mesmo peso de identidade que a cor tem.
- Imprima o α **uma vez por família**, com a razão da separação ao lado dele.
- Imprima o que falta **com a unidade do motivo**, dentro do bloco da fase.
- Imprima **um placar por família** — denominador **1** e **3** —, as duas linhas sempre
  presentes.
- Componha a abertura da página da lua pela **regra**, não por caso: `EXPERIENCE.md` §A regra de
  composição. São 81 tuplas, e o verbo concorda com o numeral.
- Diga **o motivo real** quando nenhuma decidiu, e diga a **partição** quando os motivos são
  mistos.

**Não faça**

- **Não escreva hex numa tela.** Os hexes deste documento são recorte medido de uma
  combinação; o app tem 36.
- **Não use `soft` como fundo de faixa.** Medido: as quatro ficam indistinguíveis nas 36.
- **Não use `on` sobre `accent`.** Mede 1,00 a 1,28 — invisível. É `onAccent`.
- **Não dê à lápide um terceiro tamanho**, nem a deixe subir duas vezes.
- **Não reserve espaço para caderno vazio.** Caderno sem o que dizer **some** — sem
  espaço, sem "nenhuma atividade registrada".
- **Não encurte a página da lua quando não deu nada.** A moldura é invariável em campos,
  não em pixels; só os quatro blocos mudam.
- **Não some nenhuma das duas linhas da frase coletiva, nem nenhum dos dois compartimentos de
  cada uma**, nem quando nenhuma fase decidiu. Aí o segundo compartimento diz o motivo.
- **Não junte as quatro fases num só resultado nem num só denominador.** *"Das quatro fases, …"*
  é a forma-sentença de *"eu testei as quatro fases"*, e o §2 do pré-registro de 28/09 é o
  parágrafo que autoriza chamá-la de errada. E não some as duas linhas: 1 + 3 não é um placar.
- **Não escreva "não houve poder" quando o portão da luz reprovou.** O portão é global às quatro e
  retorna **antes** do cálculo: nenhum poder existe para faltar, a unidade é `noites-sem-luz`, e
  essas noites não se coletam — conserta-se o dado.
- **Não afirme o motivo majoritário como se fosse de todas.** Com motivos mistos a frase diz a
  partição e manda ao bloco.
- **Não atenue o quarto estado.** *"sem leitura"* em corpo menor e em `ink2` são duas das três
  atenuações que a ADR 0045 §3 proíbe por nome — e é o estado em que a página vive hoje.
- **Não imprima os quatro resultados com a mesma tipografia sem dizer os dois α.** O §11 do
  pré-registro de 28/09: isso *"desfaz no leitor a distinção que a §3 pagou para manter"*.
- **Não repita o α por fase.** Ele é propriedade de família, e quatro repetições intercaladas
  apagam a fronteira que o agrupamento existe para desenhar.
- **Não some números de unidades diferentes.** `noites-sem-luz`, `noites-de-coluna`, `ciclos` e
  `noites-coletaveis` não se contam na mesma moeda, e **nenhum número** sobe para a frase
  coletiva. O **motivo** sobe quando é o da luz, que é global; o número dele fica no bloco.
- **Não dê estado à figura das quatro janelas.** Ela não destaca uma fase por vez e não
  acompanha a rolagem — uma figura com estado vira a coisa que se olha em vez de ler.
- **Não ponha ícone no cabeçalho da sub-página da lua.** O ícone é identidade de caderno.
- **Não ponha botão de compartilhar** em lugar nenhum da revista.
- **Não use exclamação, emoji, elogio ou conselho.** É um jornal.
- **Não deixe a faixa flutuar como cartão.** A revista é plana; sombra só na parede de
  capas.
- **Não congele dimensão onde há texto na página da lua** — nem altura no bloco do veredito, nem
  **largura** na coluna de rótulos da moldura. Caixa fixa corta o texto no tipo dinâmico grande, e
  aí a garantia da ADR 0045 morre calada. A regra dizia *"altura"* e por isso deixou passar a
  coluna de 104 px, que no AX3 recebe um rótulo de 174.
- **Não chame de "motor" a versão da conta.** `motor` é a palavra de motor de IA neste app;
  a versão carimbada da aritmética se chama `aritmética`.
- **Não ponha texto sobre foto sem medir o véu.** As fotos vêm da biblioteca do iPhone; o
  app não escolhe o céu.
