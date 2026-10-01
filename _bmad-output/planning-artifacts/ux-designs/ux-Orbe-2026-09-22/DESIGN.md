---
name: Motores — o modelo como objeto
description: A identidade visual da tela de Motores redesenhada — a lista de modelos no aparelho com estado e custo, a folha de escolha por leitura, a tela de compilação, a página de um modelo e a comparação. Herda o sistema de eixos do Orbe; nenhuma cor é autorada aqui.
status: draft
updated: 2026-09-23
sources:
  - .memlog.md
  - review-edge-case.md (lente de caso de borda, 22/09 — os achados de forma aplicados nesta versão)
  - https://claude.ai/artifact/YFsPB8F89eH74GWDr8m1b7 (mockups aprovados 22/09, relidos na versão 10 — Main · Escolher · Compilar · Modelo · Comparar · Instalar)
  - ../../../../mobile/src/theme/tokens.ts (mediaVeil — o véu do app, isento da barreira de hex)
  - ../../../../mobile/src/lib/veu.ts (corComAlfa — a profundidade do véu)
  - ~/Orbe-dados/progresso-da-compilacao-2026-09-22.md (a compilação não emite fração — medido em 22/09)
  - ../../../../docs/specs/temas/spec.md
  - ../../../../docs/decisions/0018-cor-de-modulo-deriva-de-papel-cromatico.md
  - ../../../../docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md
  - ../../../../docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md
  - ../../../../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md
  - ../../../../mobile/src/app/configuracoes/motores/index.tsx
  - ../../../../mobile/src/app/configuracoes/motores/bancada.tsx
  - ../../../../mobile/src/lib/motores/catalogo.ts
  - ../../../../packages/shared/src/theme/derive.ts
  - ../../../../packages/shared/src/theme/palettes.ts
  - ../../../../packages/shared/src/theme/brands.ts
  - ../../../../mobile/src/theme/tokens.ts
inherits:
  system: Orbe — quatro eixos (esquema · tema · paleta · marca)
  resolver: packages/shared/src/theme · resolveTokens() · moduleOf() · roleColors()
  consumo-no-mobile: useThemedStyles(createStyles) · themed() · colors (Proxy) · mobile/src/theme
colors:
  bg: '#FFF7EE'
  surface: '#FFFFFF'
  surface-mute: '#F6ECDC'
  ink: '#1F1B16'
  ink2: '#5C534A'
  ink3: '#9C928A'
  ink4: '#C6BCAE'
  line: '#EFE6D8'
  line-deep: '#E3D7C2'
  primary: '#F25C2B'
  on-primary: '#FFFFFF'
  feito-accent: '#6FA86A'
  feito-graphic: '#6AA265'
  feito-soft: '#E2EFD9'
  feito-text: '#4C8348'
  feito-strong: '#356F31'
  andando-accent: '#F5B946'
  andando-graphic: '#C28B00'
  andando-text: '#9C6E00'
  recusa-accent: '#E05C5C'
  recusa-graphic: '#E05C5C'
  recusa-soft: '#FDDEDE'
  recusa-text: '#CC4A4C'
  recusa-strong: '#A81B29'
  veu: '#18120D'
typography:
  titulo-pagina:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 30px
    lineHeight: 35px
  titulo-folha:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 26px
    lineHeight: 30px
  subtitulo:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 12px
    lineHeight: 17px
    color: '{colors.ink2}'
  secao:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    letterSpacing: 0.8px
    textTransform: uppercase
    color: '{colors.ink2}'
  grupo:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    letterSpacing: 0.8px
    textTransform: uppercase
    color: '{colors.ink3}'
  nome:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 600
    color: '{colors.ink}'
  estado:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 11.5px
    lineHeight: 16px
  corpo:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 13px
    lineHeight: 19px
    color: '{colors.ink2}'
  frase:
    fontFamily: "'Instrument Serif', Georgia, serif"
    fontSize: 15px
    lineHeight: 21px
    color: '{colors.ink}'
  cru:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 12px
    lineHeight: 17px
    color: '{colors.ink2}'
  relogio:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 32px
    fontWeight: 500
    letterSpacing: -0.5px
    color: '{colors.ink}'
  valor:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 14px
    fontWeight: 500
    color: '{colors.ink}'
  medida:
    fontFamily: "'Geist Mono', ui-monospace, monospace"
    fontSize: 11px
    color: '{colors.ink3}'
  botao-forte:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 700
  botao:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 14px
    fontWeight: 600
  chip:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 12.5px
    fontWeight: 600
  selo:
    fontFamily: "'Manrope', system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 600
rounded:
  sm: 8px
  md: 12px
  lg: 16px
  xl: 18px
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
  goteira: 20px
  cartao: 14px
  alvo: 44px
  alvo-compacto: 36px
components:
  cabecalho-de-pilha:
    voltar: 'chevron-back 22px em {colors.ink}, caixa de {spacing.alvo}, hitSlop 12'
    contexto: '{typography.subtitulo} — o nome da tela ANTERIOR, nunca o da atual'
    invariante: 'o título da página não mora no cromo; mora no conteúdo'
  titulo-de-pagina:
    font: '{typography.titulo-pagina}'
    color: '{colors.ink}'
    alinhamento: 'à esquerda, na goteira'
    subtitulo: '{typography.subtitulo}'
  cartao:
    background: '{colors.surface}'
    border: '1px {colors.line}'
    radius: '{rounded.lg}'
    padding: '{spacing.cartao}'
    elevacao: 'shadows.card — some sozinha nos temas clean'
  lista-de-modelos:
    tipo: 'cartão único com linhas separadas por régua'
    separador: '1px {colors.line}, recuado {spacing.cartao} à esquerda'
    contagem: '{typography.medida} no alto, à direita do {typography.secao}'
    total-parcial: '"3 neste build · 2,4 GB (1 sem medida)" — a soma cobre só o que foi medido, e declara o resto'
  linha-de-modelo:
    nome: '{typography.nome}'
    estado: '{typography.estado}'
    alvo: 'a linha inteira, mínimo {spacing.alvo}'
    chevron: '7×12 traço 1.6 em {colors.ink3} — só quando a linha abre algo'
    uso: '{typography.estado} em {colors.ink3}, à direita — qual leitura ele escreve hoje'
    altura: 'UMA, sempre — a variante de duas alturas morreu com a faixa embutida'
    invariante: 'a linha nunca diz "compilando"; esse estado é da tela compilar/[id]'
  selo-de-estado:
    forma: 'glifo + palavra, SEM preenchimento'
    compilado: 'tique 11×8 traço 2.4 + texto em {colors.feito-text}'
    compilando: 'texto em {colors.andando-text} — SÓ dentro de compilar/[id]'
    nao-compilado: 'anel vazado 9px borda 1.6 em {colors.ink4} + texto em {colors.ink3}'
    interrompida: 'a forma de nao-compilado + "· a última compilação foi interrompida" em {colors.ink2}'
    sem-medida: 'a forma do estado + "· tamanho não medido" em {colors.ink3}'
    invariante: 'a palavra carrega o estado; a cor só reforça'
  selo-de-identidade:
    uso: 'só na página do modelo, para identidade (compilado, peso aberto, nada sai daqui)'
    background: 'transparente'
    border: '1px {colors.line-deep} — ou {colors.feito-graphic} quando o selo é o estado'
    color: '{colors.ink2} — ou {colors.feito-text} quando o selo é o estado'
    radius: '{rounded.pill}'
    font: '{typography.selo}'
    padding: '4px 9px'
  faixa-de-compilacao:
    forma: 'listras a 115°, 10px claras e 10px escuras, animadas em translação'
    listras: '{colors.line} e {colors.surface-mute}'
    altura: 6px
    radius: 'metade da altura'
    onde: 'SÓ em compilar/[id], fase correndo — não há mais versão embutida na lista'
    invariante: 'não há fração — a faixa diz "está correndo", nunca "quanto falta"'
    reducao-de-movimento: 'as listras param; a faixa continua sendo a faixa'
  etapa-da-compilacao:
    corrente: 'anel 15px aberto à direita em {colors.andando-graphic} + a palavra "compilando" em {typography.corpo}, peso 600, {colors.ink}'
    contexto-acima: 'tique 15×11 traço 2.2 em {colors.feito-strong} + "instalado no aparelho · N GB" em {typography.corpo} — é fato, não etapa'
    invariante: 'UMA etapa. Três anéis que não andam são uma fração desenhada em forma'
  botao-pilula:
    background: '{colors.ink}'
    color: '{colors.bg}'
    radius: '{rounded.pill}'
    font: '{typography.chip}'
    altura: 'mínimo {spacing.alvo-compacto} — cresce com o texto'
    minWidth: 76px
    inerte: 'opacidade 0.45, sem toque, com a causa ao lado em {typography.estado} e {colors.ink2}'
  botao-forte:
    background: '{colors.primary}'
    color: '{colors.on-primary}'
    radius: '{rounded.lg}'
    font: '{typography.botao-forte}'
    altura: 48px
    piso: 'ver Accessibility no EXPERIENCE — 3,31 medido, abaixo de 4,5'
  botao-suave:
    background: 'transparente'
    border: '1px {colors.line-deep}'
    color: '{colors.ink2}'
    radius: '{rounded.lg}'
    font: '{typography.botao}'
    altura: 46px
  acao-destrutiva:
    background: 'transparente'
    border: '1px {colors.recusa-soft}'
    color: '{colors.recusa-text}'
    radius: '{rounded.lg}'
    font: '{typography.botao}'
    altura: 46px
    nota: '{typography.estado} em {colors.ink3}, logo abaixo, dizendo o preço'
  folha-de-escolha:
    fundo-atras: '{colors.veu} a 60% sobre a tela que continua visível — NÃO {colors.ink}, que clareia no escuro'
    superficie: '{colors.bg}'
    radius: '{rounded.3xl} só no topo'
    alca: '38×4 em {colors.line-deep}, {rounded.pill}, centrada'
    titulo: '{typography.titulo-folha}'
    subtitulo: '{typography.subtitulo}'
    grupo: '{typography.grupo}'
  opcao-da-folha:
    base: '{components.cartao}'
    selecionada: 'borda 2px {colors.primary} + tique 16×12 em {colors.primary}'
    bloqueada: 'fundo {colors.surface-mute}, nome em {colors.ink2}, motivo em {typography.estado}'
    ocupada: 'a forma livre, sem toque, anunciada busy — "consultando" não é "indisponível", e também não é tocável'
    lapide: 'no grupo Sem modelo das leituras sem template: o detalhe é o que o semModelo devolve, não a frase neutra'
    alvo: 'mínimo {spacing.alvo}'
  chip-da-corrida:
    altura: 'mínimo {spacing.alvo-compacto} — NUNCA fixa; o chip cresce e quebra em duas linhas'
    padding: '0 12px'
    radius: '{rounded.pill}'
    dentro: 'fundo {colors.ink}, texto {colors.bg}'
    fora: 'fundo {colors.surface}, borda 1px {colors.line}, texto {colors.ink2}'
    indisponivel: 'a forma de fora, opacidade 0.45, sem toque, com o motivo DENTRO do rótulo'
    ausente: 'o motor que passa do regimeMaximo do recurso não tem chip — nem desligado'
    font: '{typography.chip}'
  chip-regua:
    background: '{colors.surface-mute}'
    border: '1px dashed {colors.line}'
    color: '{colors.ink3}'
    existe: 'só na leitura que tem template — hoje, só a Saúde do sono'
    invariante: 'nunca desligável — o tracejado é o que diz isso sem palavra'
  cartao-de-motor:
    base: '{components.cartao}'
    nome: '{typography.chip} em peso 700 e {colors.ink}'
    tempo: '{typography.medida}'
    frase: '{typography.frase}'
    cru: '{typography.cru}'
  selo-de-desfecho:
    passou: 'contorno 1px {colors.feito-graphic}, texto {colors.feito-text}, {typography.selo}, {rounded.pill}'
    recusada: 'contorno 1px {colors.recusa-graphic}, texto {colors.recusa-text}, {typography.selo}, {rounded.pill}'
    problema: '{typography.estado} em {colors.recusa-text}, linha própria abaixo da frase'
    invariante: 'o selo não preenche — contorno é objeto gráfico (piso 3,0) e a palavra é texto (piso 4,5)'
  cartao-regua:
    background: '{colors.surface-mute}'
    border: '1px dashed {colors.line-deep}'
    radius: '{rounded.lg}'
    rotulo: '{typography.grupo}'
    texto: '{typography.corpo}'
  cartao-de-custo:
    base: '{components.cartao}'
    padding: '18px {spacing.lg}'
    relogio: '{typography.relogio}, e ao lado a palavra "correndo" em {typography.corpo}'
    memoria: '{typography.corpo} — "da última vez, neste iPhone, levou N minutos", com o N em {typography.valor}'
    faixa: '{components.faixa-de-compilacao}'
    etapa: '{components.etapa-da-compilacao}'
    fase-correndo: 'relógio andando + faixa + etapa + memória'
    fase-terminou: 'o relógio congela no total, a faixa some, o tique do {components.selo-de-estado} entra e o CTA vira o caminho de volta'
    fase-parada: 'o relógio congela em M:SS, a faixa some, o texto diz "o modelo continua instalado" e o CTA vira Compilar de novo'
    fase-falhou: 'sem relógio; o motivo em {typography.corpo} e {colors.recusa-text}; o CTA vira Tentar de novo'
    fase-interrompida: 'SEM relógio e SEM carimbo — só a frase e o CTA de Compilar de novo'
    invariante: 'o relógio é a maior coisa da tela depois do título — e é o único número medido nela'
    invariante-carimbo: 'só a fase terminou carimba data e duração'
  cartao-de-aviso:
    background: '{colors.surface-mute}'
    border: '1px {colors.line}'
    radius: '{rounded.lg}'
    titulo: '{typography.estado} peso 700 em {colors.ink}'
    texto: '{typography.corpo}'
    invariante: 'declara a consequência ("Sair desta tela interrompe a compilação"), não pede um favor'
  faixa-de-tela-parada:
    background: '{colors.surface-mute}'
    border: '1px {colors.line-deep}'
    radius: '{rounded.md}'
    titulo: '{typography.estado} peso 700 em {colors.ink2}'
    texto: '{typography.estado} em {colors.ink3}'
    invariante: 'existe só no canvas; nenhuma rota do app a alcança'
---

> **Espinha visual.** Este documento e o [`EXPERIENCE.md`](EXPERIENCE.md) são pares e
> vencem qualquer mockup em caso de conflito — e há conflitos, listados em
> *Do's and Don'ts* e em *Perguntas em aberto*. O que ele **não** faz é redecidir o
> contrato dos motores: as ADRs 0047, 0048, 0049 e 0050 continuam sendo a lei do que se
> constrói.

## Brand & Style — marca e postura

Motores é **a tela de ficha técnica do app**. Nada aqui é conteúdo do usuário: são
capacidades da máquina, custos em gigabytes e minutos, e uma escolha por leitura. A
postura correta é a de um painel de instrumentos honesto, não a de uma loja de modelos.

Três consequências, e elas governam tudo abaixo.

**Primeira: Motores não é módulo.** Os dez módulos do app têm cor porque são territórios
de conteúdo que o dono reconhece pela cara ([ADR 0018](../../../../docs/decisions/0018-cor-de-modulo-deriva-de-papel-cromatico.md)).
Motores é configuração — mora dentro de `/configuracoes`, não na barra. Dar-lhe cor
própria inventaria um décimo-primeiro módulo para hospedar uma preferência. O precedente
é o da ADR 0031, em que sono é categoria de Saúde e não módulo, e o da presença, em que
lugar é dimensão. **A tela é neutra**: tinta, linha, superfície — e cor só onde ela
significa um *estado*.

**Segunda: o custo é informação de primeira classe, não letra miúda.** Um modelo aberto
custa mais de um gigabyte e de onze a quinze minutos de silêncio antes da primeira frase.
Uma tela que esconde isso até o dono tocar produz exatamente o que a decisão de 22/09 quis
evitar: a espera como surpresa no meio de uma leitura. Por isso o tamanho aparece na mesma
linha do nome, o total aparece no cabeçalho da seção, e a compilação tem tela própria com
relógio. **A prosa da tela cita números medidos**, e onde não há medida não há número.

E a regra se vira contra a própria tela. A investigação de 22/09 provou que a compilação
**não emite fração alguma** — nem etapa, nem evento, nem rampa em disco. Logo o relógio
conta o que já passou, a estimativa só existe quando *este* iPhone já compilou *aquele*
modelo, e não há porcentagem em lugar nenhum desta família. A honestidade não é um tom
aqui; é uma restrição de desenho.

**Terceira: mono é o que a máquina mediu; sans é o que o app diz; serifada é o que o
motor escreveu.** A fronteira é epistemológica, herdada da revista. `2,6 GB`, `15 min`,
`7,1 s`, `4.096 tokens` são todos mono porque são medidas. Nomes, estados e explicações
são sans porque são o app falando. E a frase que um motor produziu é serifada, porque na
Comparação ela é o objeto em julgamento — a mesma serifada em que ela vai aparecer na
Saúde do sono quando for escolhida.

## Colors — cor

**Nenhuma cor é autorada neste documento.** Ela nasce em
`packages/shared/src/theme` e chega à tela por `resolveTokens()` e `roleColors()`. Os
hexes do frontmatter são o **recorte medido** de uma das 144 combinações do sistema —
tema `orbe` · paleta `orbe` · esquema `light` · marca `laranja` —, presentes só porque
HTML de mockup não roda o resolvedor. Nenhuma tela escreve hex, e a catraca
`hex fora do sistema de temas não cresce` do `architecture.test.ts` reprova quem tentar.

### Os três estados, e de onde cada cor vem

O sistema do Orbe **não tem** papéis semânticos. Não existe `success`, não existe
`warning`, não existe `danger`, não existe `disabled` — conferido em
`packages/shared/src/theme/` e em `mobile/src/theme/`: zero ocorrências. O que existe são
onze papéis cromáticos (`orange, blue, green, yellow, rose, brown, deep, ink, teal,
purple, red`), dez dos quais um módulo reivindica por `MODULE_ROLE`.

Esta espinha **declara um empréstimo, não um token novo**:

| Estado na tela | Papel emprestado | Tokens desta espinha | Colisão latente |
|---|---|---|---|
| compilado · passou | `green` | `{colors.feito-accent}` `{colors.feito-soft}` `{colors.feito-text}` `{colors.feito-strong}` | o módulo `habito` |
| compilando | `yellow` | `{colors.andando-accent}` `{colors.andando-graphic}` `{colors.andando-text}` | o módulo `food` |
| recusada · remover | `red` | `{colors.recusa-accent}` `{colors.recusa-soft}` `{colors.recusa-text}` `{colors.recusa-strong}` | o módulo `saude` |

A colisão é **latente e não viva**: nenhuma tela desta família mostra um hábito, uma
refeição ou uma métrica de saúde. Verde aqui nunca aparece ao lado de verde-de-hábito, e
o dono não tem como confundir os dois. Emprestar o papel custa zero token novo e
sobrevive às seis paletas de graça — na paleta `acessivel`, os três já saem separados por
medição, o que um trio autorado à mão não garantiria.

**O que não se empresta**: `{colors.primary}`. A marca é cromo — é a voz do app, não um
dado e não um estado ([memória "Marca ≠ cor de dado"](../../../../CLAUDE.md), e os 106
usos de `colors.primary` no mobile são todos cromo). Nesta família o laranja aparece em
exatamente dois lugares: a **opção selecionada** na folha de escolha, e o botão
**Medir**. Um é "o que você escolheu", o outro é "o que você vai apertar". Nada mais.

### Âmbar é um problema honesto

`{colors.andando-accent}` (`#F5B946`, o `accent` do papel `yellow`) mede **1,76 contra o
branco** e é explicitamente proibido como texto no sistema. Por isso o par do frontmatter
está separado por piso: o anel da etapa em curso, que é traço, usa
`{colors.andando-graphic}` (`#C28B00`, ≥3,0); a palavra "compilando" usa
`{colors.andando-text}` (`#9C6E00`, o `text` do papel, garantido ≥4,5 contra a superfície).
O `accent` fica declarado como identidade do papel e **sem consumidor nesta família** —
ver a seção seguinte, em que a última superfície âmbar desapareceu.

Os mockups cravaram `#B47A1E` para essa palavra. Nenhum token produz esse valor — a
distância medida até o mais próximo é de 5 pontos em OKLab, e a tentativa de reproduzi-lo
exigiria um hex autorado. **A espinha corrige o mockup**: a palavra é
`{colors.andando-text}`.

### A compilação não tem barra, porque não tem fração

A disputa anterior — mini-barra âmbar na lista contra barra laranja na tela — **morreu com
a medição**. A API de especialização do iOS 27 cabe em três funções e nenhuma delas aceita
progresso; 1.816 linhas de `.swiftinterface` das cinco subframeworks não citam `Progress`,
`callback` nem `AsyncStream`; e o cache não cresce em disco enquanto compila (amostragem de
1 s: zero byte em 200 s). A própria Apple manda mostrar **mensagem indeterminada**.
Qualquer porcentagem seria invenção nossa.

Então não há preenchimento proporcional. O que existe é a `{components.faixa-de-compilacao}`:
listras animadas entre `{colors.line}` e `{colors.surface-mute}`, sem valor.

**E ela aparece num lugar só.** A versão anterior desta espinha a punha em dois — 4 pt
embutida na linha da lista, 6 pt dedicada na tela de compilação. A decisão do dono de 23/09
(sair da tela interrompe a compilação) apagou o primeiro: se não há compilação correndo
enquanto o dono olha a lista, não há o que a faixa da lista diga. Sobram 6 pt, dentro de
`compilar/[id]`, na fase *correndo*. A linha de modelo volta a ter **uma altura só**, e o
âmbar sai da lista junto com ela.

**A trisecção das etapas caiu pela mesma régua da barra.** Três anéis — *instalado*,
*compilando*, *primeira frase de teste* — desenham um terço e dois terços, que é uma fração
em forma no lugar exato onde a espinha proíbe a fração em número. E nada avança do segundo
para o terceiro: não há evento, e a primeira frase de teste **é** a compilação. Fica uma
etapa, `{components.etapa-da-compilacao}`, com o anel que gira e a palavra ao lado. O que
era o primeiro anel vira linha de contexto acima dela — um fato, com tique, já verdadeiro
antes de a tela abrir.

Com o fim da barra, **o âmbar perdeu o único lugar em que preenchia**. Sobram dois usos, e
os dois são medidos: o anel da etapa em curso é objeto gráfico e usa `{colors.andando-graphic}`
(≥3,0 contra a superfície); a palavra "compilando" é texto e usa `{colors.andando-text}`
(≥4,5). `{colors.andando-accent}` não escreve **e não traça** — 1,76 não sustenta nem uma
letra nem um anel de 2 pt. E `{colors.primary}` continua fora: se a única coisa laranja da
tela de compilação fosse algo que o dono **não pode apertar**, a cor estaria mentindo sobre
o que é ação.

### Onde a informação é obrigatória, a tinta é neutra

O motivo pelo qual um motor não pode ser escolhido — `este recurso não guarda o que a
nuvem escreve`, `o peso aberto é uma prova de caminho` — é **texto neutro, não vermelho**.
Vermelho é o desfecho de uma medição e é a ação de apagar. Um motor bloqueado não é um erro
do dono; é uma propriedade do recurso, e pintá-la de vermelho o faria sentir que quebrou
algo ao abrir uma folha.

Neutro, aqui, quer dizer `{colors.ink2}` — **não** `{colors.ink3}`. O token mede **3,05**
contra a superfície; a versão 10 dos mockups o escureceu à mão para `#8C837A`, que ainda é
**3,72**, e nenhum dos dois alcança 4,5. A régua é a mesma que o resto desta espinha usa:
**informação obrigatória é texto e cobra 4,5**. Por isso o motivo de bloqueio, o rótulo de
uma opção e qualquer frase que mude a decisão do dono vão em `{colors.ink2}` (7,5), e
`{colors.ink3}` fica para o que é dispensável — o "uso" encostado na direita e as medidas
de apoio, que são justamente as primeiras coisas a sair em corpo grande.

### O véu não é tinta

A versão anterior desta espinha escrevia o véu da folha como **`{colors.ink}` a 60%**, e
ela estava errada no escuro. `ink` é a cor do **texto**: no esquema escuro ela é clara, por
definição, e um véu de tinta clara a 60% sobre a tela escura de trás **clareia** justamente
o que ele existe para escurecer. A folha perderia a profundidade exatamente no esquema em
que ela é mais necessária.

A resposta já existe no app e não custa uma cor nova. `mediaVeil` (`#18120D`) é declarado
uma vez em `mobile/src/theme/tokens.ts` como *"a tinta mais escura do app, usada só com
alfa"*, e é **isento** da barreira de hex literais do `architecture.test.ts` — pelo mesmo
motivo pelo qual ele serve aqui: *"um véu que respondesse ao esquema clarearia justamente
onde ele precisa escurecer"*. A frase foi escrita para o véu sobre foto e descreve este
caso palavra por palavra. A profundidade sai de `corComAlfa` (`mobile/src/lib/veu.ts`), que
é o caminho que o app já usa para isso.

O que muda, então: `mediaVeil` deixa de ser "o véu de mídia" e passa a ser **o véu**, com
dois consumidores — a foto e esta folha. É o único ponto desta família em que uma cor não
responde ao esquema, e é de propósito: um véu que respondesse ao esquema não seria um véu.

## Typography — tipografia

**O sistema não tem escala tipográfica viva.** `fontSizes` existe em
`packages/shared/src/constants/tokens.ts` e tem exatamente **zero consumidores** no
repositório inteiro; todas as telas escrevem números crus. O bloco `typography` do
frontmatter é, portanto, uma escala **autorada aqui para esta família**, e ela foi
calibrada contra o que a tela de Motores de hoje já usa, não contra o mockup em abstrato.

As famílias são tokens de verdade e vêm de `mobile/src/theme/tokens.ts`: `fonts.sans`,
`fonts.sansMedium`, `fonts.sansSemiBold`, `fonts.sansBold`, `fonts.mono`,
`fonts.monoSemiBold`, `fonts.serif`. **Nunca combinar com `fontWeight`** — no React
Native com `expo-font` cada peso é um arquivo registrado, e o peso se escolhe pela chave.
Os `fontWeight` do frontmatter são a notação do mockup; na implementação viram a família
correspondente.

### A rampa

| Token | Família | Tamanho | Onde |
|---|---|---|---|
| `{typography.titulo-pagina}` | serif | 30 | Motores · Compilando · o nome do modelo |
| `{typography.titulo-folha}` | serif | 26 | a folha de escolha · Comparar |
| `{typography.nome}` | sansSemiBold | 15 | o nome de um modelo ou de uma leitura, em lista |
| `{typography.frase}` | serif | 15/21 | o que um motor escreveu |
| `{typography.botao-forte}` | sansBold | 15 | Medir |
| `{typography.botao}` | sansSemiBold | 14 | Parar · Remover |
| `{typography.corpo}` | sans | 13/19 | explicação de parágrafo |
| `{typography.chip}` | sansSemiBold | 12.5 | chips da corrida · botão-pílula |
| `{typography.cru}` | mono | 12/17 | o texto cru do fornecedor |
| `{typography.estado}` | sans | 11.5/16 | a linha de estado sob um nome · motivos · avisos |
| `{typography.secao}` / `{typography.grupo}` | sansBold | 11 versalete | cabeçalhos |
| `{typography.medida}` | mono | 11 | tempos, contagens, totais em linha |
| `{typography.relogio}` | monoMedium | 32 | o decorrido da compilação |
| `{typography.valor}` | monoMedium | 14 | valores na ficha do modelo |

**A espinha sobe o 11 px dos mockups para 11,5.** Os mockups usam 11 px para prosa
minúscula em quatro telas. O app já tem um piso de fato — 11,5 px para prosa e 10,5 px só
para versalete — e a
[memória "Tamanho visual: calibrar no aparelho"](../../../../CLAUDE.md) existe
justamente porque o que fecha no monitor sai pequeno demais no telefone. Meio pixel é
barato; reler a mesma linha duas vezes, não.

### `{typography.secao}` e `{typography.grupo}` são o mesmo desenho em duas vozes

Versalete em `{colors.ink2}` quando o cabeçalho **nomeia uma seção da página** ("Modelos
no aparelho", "Quem escreve o quê"); em `{colors.ink3}` quando ele apenas **agrupa
opções dentro de uma folha** ("Sem modelo", "No aparelho", "Fora do aparelho"). O
primeiro é estrutura que o dono navega; o segundo é taxonomia que ele lê de passagem e
não toca.

### Números dentro da prosa continuam em mono

`compilado · 2,6 GB`, `há 5 min`, `1 de 3 leituras`, *levou **11 minutos***: a medida é
mono mesmo quando está no meio de uma linha sans. É o mesmo contrato da revista, e é o que
permite ao dono varrer a coluna de tamanhos sem ler as palavras. O corolário vale aqui mais
do que em qualquer outra tela: **o que não foi medido não ganha mono** — e, nesta família,
não ganha número nenhum.

## Layout & Spacing — grade e respiro

**Formato:** iPhone, retrato, 390 pt de largura de referência. Coluna única em todas as
seis telas.

**A goteira é 20 pt** (`{spacing.goteira}`, o `spacing.xl` do sistema), contra os 16 que a
tela de Motores usa hoje. Os mockups aprovados usam 20, e com uma lista de modelos que
carrega nome + estado + tamanho + uso na mesma linha, os 4 pt extras são o que impede a
linha de encostar na borda. A consequência é que Motores passa a respirar diferente das
telas vizinhas de `/configuracoes` — ver *Perguntas em aberto*.

**O cartão tem 14 pt de padding** (`{spacing.cartao}`). Não é token do sistema — o sistema
salta de 12 para 16 —, e é o valor que a tela de hoje já escreve cru. A espinha o promove
a constante local em vez de fingir que 12 ou 16 estavam lá.

**Rítmo vertical:** 13 pt entre seções, 6 pt entre um cabeçalho de seção e o que ele
encabeça, 8 pt entre cartões irmãos. A folha de escolha usa 7 pt entre opções e 8 pt
extras antes de um novo grupo — o dobro do respiro é o que faz o agrupamento ser visto
sem uma régua.

**Alvos:** `{spacing.alvo}` (44) para qualquer linha que abre algo ou grava algo;
`{spacing.alvo-compacto}` (36) só para chips e botões-pílula que vivem em linha com
outros. O sistema **não tem token de alvo nem de `hitSlop`** — cada tela escreve o número.
Esta espinha os nomeia para que a família inteira use o mesmo.

**E os dois são pisos, não medidas.** `minHeight`, nunca `height`. Em Texto grande a linha
e o chip crescem; travar a caixa corta o conteúdo, e o conteúdo cortado é sempre o mesmo —
o estado numa linha, o motivo dentro de um chip. São as duas coisas que esta família não
pode perder.

**Ordem na linha de modelo**, da esquerda para a direita: nome → estado → uso → chevron.
O olho varre a primeira coluna procurando um nome; o estado é a segunda pergunta; "o que
ele escreve hoje" é a terceira, e por isso fica encostada na direita, em `{colors.ink3}`.

## Elevation & Depth — profundidade

O app tem `shadows.sm`, `shadows.md` e `shadows.card` no mobile, e eles são
**sensíveis ao tema**: nos temas `clean` e `cleanElev` a sombra colapsa e vira uma
hairline. Esta família usa **só `shadows.card`, e só no cartão** — nada aqui flutua.

A única profundidade real é a **folha de escolha**, e ela é profundidade de verdade: a
tela de Motores continua visível atrás, escurecida, porque a escolha é sobre um item
daquela lista e sair dela é voltar ao mesmo lugar. O mockup pinta o fundo em `#2A241E`
chapado; a espinha o reescreve como **`{colors.veu}` a 60%** — o `mediaVeil` que o app já
declara —, uma cor autorada a menos e um véu que continua sendo véu quando o esquema vira
escuro. (A versão anterior dizia `{colors.ink}` a 60%, e essa **clareava** no escuro; ver
*O véu não é tinta*.)

Nada mais tem elevação. Sem cartão flutuante, sem sombra sob a faixa de compilação, sem
gradiente. A informação aqui é plana porque é factual.

## Shapes — forma

| Forma | Raio | Onde |
|---|---|---|
| cartão, botão retangular, cartão de motor | `{rounded.lg}` (16) | tudo que é caixa |
| faixa de tela parada | `{rounded.md}` (12) | o aviso do canvas |
| topo da folha | `{rounded.3xl}` (24) | só as duas quinas de cima |
| chip, botão-pílula, alça, selo | `{rounded.pill}` | tudo que é comprimido |
| faixa de compilação | metade da altura | 3 pt — um lugar só, a tela de compilação |

Os mockups desenham 14 pt no cartão e 22 pt na folha. **Ambos são arredondados para o
token vizinho** — 16 e 24 —, porque raio autorado é a forma mais silenciosa de um sistema
de forma morrer, e 24 é o que o `QuickAddSheet` já usa.

O **anel** é a única iconografia com carga semântica da família, e ele tem **duas** formas,
não três: tique fechado (feito) e anel aberto à direita (em curso, e gira). São dois
estados de uma mesma forma, não dois ícones.

A terceira forma — anel fechado e apagado, "ainda não" — **saiu**. Ela só fazia sentido
numa sequência de três etapas, e a sequência caiu: o que a tela de compilação tem é um
fato com tique acima e um anel girando, e nada que esteja esperando a vez. Um anel apagado
sobrevivente ali voltaria a prometer um passo que nenhum evento vai acender.

## Components — componentes

### Linha de modelo

A unidade de repetição da tela principal, e a que precisa sobreviver a N modelos.
Estrutura fixa: **nome** em `{typography.nome}`; **estado** em `{typography.estado}` com
o glifo do `{components.selo-de-estado}` à esquerda; **uso** em `{colors.ink3}` à direita;
**chevron** quando a linha abre a página do modelo.

O estado e o tamanho compartilham uma linha, separados por `·`: `compilado · 2,6 GB`,
`instalado, não compilado · 1,1 GB`. **Todas as linhas têm uma altura só.**

**A espinha corrige o mockup aqui, e agora por inteiro.** A versão 10 ainda escreve
`compilando · 5 de ~11 min` e desenha a mini-barra em 43%. Não existe o 43%, e o `de ~11
min` transforma uma lembrança (quanto levou da última vez) em promessa (quanto falta). Mas
a correção maior é outra: **a linha inteira não existe**. Sob a decisão do dono de 23/09,
sair da tela de compilação interrompe a compilação, logo não há nada compilando enquanto o
dono está olhando para esta lista. O terceiro estado sai, a faixa embutida sai, e a segunda
altura sai com ela.

O que fica no lugar é um rastro, e ele é texto: `instalado, não compilado · a última
compilação foi interrompida`, em `{colors.ink2}` — informação que muda a decisão, portanto
texto de 4,5 — até a próxima tentativa.

**E o tamanho pode faltar.** Os números de hoje foram medidos à mão e vivem ao lado do
modelo; um modelo novo entra sem eles. A linha então escreve `instalado, não compilado ·
tamanho não medido`, na `{colors.ink3}` das medidas de apoio, e o total do cabeçalho
declara quantos ficaram de fora da soma: `3 neste build · 2,4 GB (1 sem medida)`. É a regra
da voz aplicada ao número mais visível da tela — onde não houve medição, não há número.

Um modelo instalado e não compilado troca o chevron por um `{components.botao-pilula}`
escrito **Compilar**. É a única ação que um item de lista carrega, e ela existe aí porque
é a ação que o dono quer tomar exatamente quando está olhando para aquele estado. **Uma
linha em `compilado` não o carrega** — não há o que compilar, e oferecer o botão ali seria
vender quinze minutos por um toque que não muda nada. E ele fica **inerte**, em opacidade
0,45 e com a causa ao lado (*um modelo de cada vez*), enquanto outra compilação corre.

### Selo de estado — por que não é uma pílula colorida

Um selo preenchido com texto de 11 px é uma armadilha de contraste: o token `on` de um
papel garante ≥3,0 contra o `soft` dele, e 3,0 é o piso de **texto grande**, que 11 px não
é. O sistema **não tem token que garanta 4,5 contra um preenchimento `soft`**.

A solução é não ter o problema: **o selo de estado não preenche**. Glifo + palavra em
`{colors.feito-text}` / `{colors.andando-text}` / `{colors.ink3}`, sobre
`{colors.surface}` — e esses três tokens *são* garantidos ≥4,5 contra a superfície.

**E nenhuma pílula desta família preenche mais.** A versão 10 dos mockups tirou o
preenchimento dos dois últimos lugares em que ele resistia — o selo de identidade na página
do modelo e o selo de desfecho na Comparação —, e a espinha adota a mudança: ela é uma das
três correções de contraste que o dono mandou entrar em 22/09, e ela dissolve a dívida de
medir `ramp.strong` sobre `soft` nas seis paletas, porque o par deixou de existir.

O contorno, porém, é **objeto gráfico**, e objeto gráfico cobra 3,0. Os hexes que o mockup
escreveu não pagam: `#8FB088` mede **2,40** e `#D9A3A3` mede **2,16** contra a superfície.
A espinha os troca pelo token que o sistema garante — `{colors.feito-graphic}` e
`{colors.recusa-graphic}`, que saem de `ensureContrast(accent, surface, 3.0)` e são
reprovados pelo `theme.test.ts` se caírem abaixo disso em qualquer combinação. A palavra
dentro do selo continua em `*-text`, que é o `accent` empurrado até 4,5.

### Folha de escolha

Três grupos, sempre nesta ordem: **Sem modelo** · **No aparelho** · **Fora do aparelho**.
A ordem é por exposição crescente — o que nunca sai do telefone primeiro, o que sai por
último —, e é a mesma ordem em que `resolverCadeia` resolve o recuo. Com N modelos só o
grupo do meio cresce, e é por isso que a folha escala onde a tela de hoje não escala.

A opção selecionada é **borda de 2 pt em `{colors.primary}` + tique**. Não é fundo
preenchido: a folha pode ter oito opções e um bloco laranja no meio de uma pilha branca
grita mais alto que a pergunta.

A opção bloqueada é `{colors.surface-mute}` com o **motivo escrito** em
`{typography.estado}`. Nunca escondida. O idioma do motivo é o do
`motivoDeBloqueio` que já existe no catálogo, e ele é sempre uma frase com dono: *este
recurso não guarda o que a nuvem escreve*, não *indisponível*.

A opção **ocupada** — o motor cujo diagnóstico ainda está a caminho — tem a **forma livre**
e não responde ao toque. Ela não é apagada, porque não se sabe ainda se ela está
indisponível; e não é tocável, porque a resposta pode vir dizendo que está. É o único caso
desta família em que a forma de um controle disponível não corresponde a um toque, e é por
isso que ele é `busy` no leitor de tela: a informação que falta é temporal, não estrutural.

**No grupo `Sem modelo`, o detalhe muda com a leitura.** Só a Saúde do sono tem template:
ali a linha de baixo é a neutra (*instantâneo · sempre igual · nada sai daqui*). Na
Retrospectiva e no nome de rota, o `semModelo` devolve uma lápide, e é ela que a opção
escreve — *a revista não imprime sem modelo*. Mesma forma, mesma posição, outro texto: a
diferença entre um caminho e uma ausência é o que está escrito, não como está desenhado.

### Chip da corrida

Ligado é **preenchido em `{colors.ink}` com texto em `{colors.bg}`** — e o texto é
`{colors.bg}`, não `{colors.on-primary}`, porque `onPrimary` é a cor de cima da *marca*:
no escuro a tinta clareia, o fundo escurece, e o par continua legível, enquanto
`onPrimary` viraria laranja sobre tinta. (Esse raciocínio já está escrito no código de
hoje e a espinha o confirma em vez de reinventá-lo.)

Desligado é contorno. Indisponível é a forma de desligado em opacidade 0,45, sem toque, e
com o motivo **no rótulo do próprio chip** (`Qwen3 0.6B · não compilado`) — porque um chip
não tem linha de baixo onde pôr uma explicação.

**E é por isso que 36 pt é mínimo, nunca altura fixa.** O motivo mora dentro do rótulo, e
uma caixa de altura travada corta primeiro exatamente ele, em **Texto grande** — deixando
na tela um controle apagado sem explicação nenhuma, que é o defeito que esta família
inteira existe para não ter. O chip cresce, quebra em duas linhas quando precisa, e a
fileira quebra com ele. Vale igual para o `{components.botao-pilula}`.

**Um motor pode não ter chip nenhum.** Quando a exposição dele passa do `regimeMaximo` do
recurso, ele não entra na fileira — nem desligado, nem apagado: **ausente**. Um chip
desligado convidaria a ligar o que a regra proíbe; um apagado prometeria um motivo que o
recurso nunca vai deixar de ter. Hoje os três recursos admitem nuvem e o caso não ocorre.

O **chip-régua** é a exceção estrutural: `{colors.surface-mute}` com borda tracejada, sem
estado ligado/desligado, sem toque. O tracejado é como a forma diz "isto não é um
controle" sem gastar uma palavra. **E ele só existe onde há régua** — hoje, só na Saúde do
sono. Nas outras duas leituras o `semModelo` devolve uma lápide, e um chip escrito
*Template · régua* ali prometeria uma coluna que a própria tela explica, trinta pixels
acima, que não vai existir.

### Cartão de motor (o resultado de uma medição)

Cabeçalho em uma linha: **nome** (peso 700) · **tempo** em `{typography.medida}` ·
**desfecho** em `{components.selo-de-desfecho}`. Abaixo, a **frase** em
`{typography.frase}` — serifada, porque é prosa e é o objeto em julgamento. Quando houve
problema de conferência, uma linha extra em `{colors.recusa-text}` nomeando-o
(`marcador fora do lugar`).

O **cartão-régua** vem antes de todos e é visualmente diferente: superfície apagada e
borda tracejada, o mesmo vocabulário do chip-régua. A régua não compete; ela é o chão.

### Cartão de custo

Na tela de compilação, o bloco branco que empilha relógio + faixa + a etapa única. A
hierarquia é deliberada: o **relógio é a maior coisa da tela depois do título**, em
`{typography.relogio}`, porque a pergunta que o dono tem nessa tela é uma só e é "quanto
falta" — e o relógio é a única resposta honesta que existe para ela.

`5:12` em mono medium 32 pt, e a palavra **correndo** ao lado em `{typography.corpo}`. Não
há `de ~11 min`: a frase que o dono precisa é outra, é inteira, e vem abaixo da faixa —
*Da última vez, neste iPhone, levou **11 minutos**. O sistema não diz quanto falta — só
avisa quando termina.* O número dentro dela é `{typography.valor}` porque é medida; o resto
é sans porque é o app falando.

Quando **não há última vez** — um modelo que este aparelho nunca compilou —, a frase encolhe
para *O sistema não diz quanto falta, e este iPhone ainda não compilou este modelo: leva
minutos.* Nenhum número aparece, porque nenhum foi medido. É a mesma regra que rege a ficha
do modelo, escrita aqui no lugar mais caro de desobedecê-la.

### O cartão de custo tem cinco caras, e quatro delas estão paradas

O desenho acima é a fase **correndo**. As outras quatro são o mesmo cartão com o movimento
desligado, e a diferença entre elas está no que sobra:

| Fase | O relógio | A faixa | O pé |
|---|---|---|---|
| **correndo** | anda | listras animadas | **Parar a compilação**, `{components.botao-suave}` |
| **terminou** | congela no total, com o tique do `{components.selo-de-estado}` ao lado | some | **Voltar para Motores** |
| **parada** | congela em `M:SS` | some | **Compilar de novo** |
| **falhou** | **não aparece** | some | **Tentar de novo** |
| **interrompida** | **não aparece** | some | **Compilar de novo** |

Duas regras de forma sustentam a tabela.

**O relógio some onde ele mentiria.** Em *falhou* e em *interrompida* não há duração que
signifique alguma coisa — o processo morreu no meio, e o número no mostrador seria só o
tempo em que a tela esteve aberta. `{typography.relogio}` é a maior coisa da tela depois do
título; deixá-lo ali marcando um total que não é total seria dar o maior corpo da família
ao único número sem referente.

**Só *terminou* carimba.** A data e a duração que alimentam a frase *da última vez levou N
minutos* saem daquela fase e de mais nenhuma. Uma parada aos três minutos que carimbasse
transformaria a lembrança em promessa falsa, no lugar exato em que o dono a usa para decidir
se cabe no intervalo antes de sair de casa.

O motivo de *falhou* vem em `{typography.corpo}` e `{colors.recusa-text}` — é a única
vermelhidão da tela, e ela é legítima: ali houve mesmo um desfecho ruim, e não uma
propriedade do recurso.

## Do's and Don'ts — o que fazer e o que não

**Faça**

- Trate cada modelo como **objeto com nome próprio**: `Qwen3 1.7B`, não
  `Peso aberto (Qwen3 1.7B)`. O prefixo era necessário quando não havia página; com a
  página, ele vira ruído repetido em cada linha. "Peso aberto" passa a ser um
  `{components.selo-de-identidade}` na ficha do modelo.
- Escreva o custo **na mesma linha do nome**. Tamanho e estado não são detalhe de
  segundo nível.
- Deixe o motivo à vista. Motor bloqueado aparece bloqueado, com a frase; nunca sumido.
- Use mono para tudo que foi medido e sans para tudo que o app afirma.
- Deixe a `{components.faixa-de-compilacao}` **indeterminada**, e o relógio no lugar da
  fração.
- Use `{colors.ink2}` para o que muda a decisão do dono, e `{colors.ink3}` só para o que
  pode sumir em corpo grande.
- **Trate 36 e 44 pt como mínimos.** Chip, botão-pílula e linha crescem com o texto e
  quebram em duas linhas; nada nesta família tem altura travada.
- **Desenhe as cinco fases da tela de compilação**, não só a que corre. *Terminou*,
  *parada*, *falhou* e *interrompida* são telas, e sem elas a única tela cara da família
  não tem fim.
- **Deixe o véu escurecer nos dois esquemas.** `{colors.veu}` é a única cor desta família
  que não responde ao tema, e é de propósito.

**Não faça**

- **Não desenhe porcentagem, fração nem tempo restante.** Nenhuma camada do iOS 27 emite
  isso — está medido. Uma barra em 43% seria um número inventado no lugar mais visível da
  família.
- **Não pinte "compilando" de laranja.** `{colors.primary}` é o que se aperta.
- **Não invente um papel de status.** Verde/âmbar/vermelho aqui são `green`/`yellow`/`red`
  emprestados, declarados nesta tabela. Um hex novo reprova na catraca.
- **Não preencha um selo de 11 px com cor de papel.** O sistema não garante 4,5 contra um
  `soft`, e desde a versão 10 dos mockups nenhum selo desta família preenche.
- **Não desenhe contorno com o hex do mockup.** `#8FB088` mede 2,40 e `#D9A3A3` mede 2,16;
  contorno é objeto gráfico e cobra 3,0. Use `{colors.feito-graphic}` /
  `{colors.recusa-graphic}`.
- **Não use `{colors.andando-accent}` como texto nem como traço.** Ele mede 1,76 contra o
  branco, e desde que a barra virou faixa listrada ele não tem mais o que preencher.
- **Não desenhe "compilando" fora de `compilar/[id]`.** Nem na lista, nem na folha, nem num
  chip. Sair da tela interrompe a compilação (decisão do dono, 23/09), então um estado de
  trabalho em curso desenhado em qualquer outro lugar promete o que ninguém garante.
- **Não desenhe três anéis de etapa.** Nada avança do segundo para o terceiro, e três anéis
  parados são uma fração desenhada em forma — a mesma mentira da barra em 43%, só que sem
  número.
- **Não faça o véu de `{colors.ink}`.** No escuro a tinta é clara, e um véu claro a 60%
  clareia a tela de trás. Use `{colors.veu}`.
- **Não trave a altura de um chip.** O motivo de um chip indisponível mora dentro do
  rótulo, e é a primeira coisa que uma altura fixa corta em Texto grande.
- **Não desenhe o chip `Template · régua` na Retrospectiva nem no nome de rota.** Ali não
  há template, e a própria tela diz isso num cartão logo abaixo.
- **Não some tamanhos que ninguém mediu.** O total do cabeçalho cobre o que tem medida e
  declara o resto entre parênteses.
- **Não escreva "Apple"** como nome do motor do sistema. A versão 10 consertou dois dos
  três escorregões e deixou **um** — a frase da ficha do modelo; o nome no catálogo é
  **Modelo do aparelho**, e "Apple" é uma marca que a
  tela só cita como procedência, nunca como nome.
- **Não leia tema num `StyleSheet.create` de escopo de módulo.** O `colors` é um `Proxy`
  que resolve na leitura; uma folha de escopo de módulo congela no import e fica clara
  para sempre. Use `useThemedStyles(createStyles)` — é o que a tela de hoje já faz — ou
  `themed(() => …)` com um `useTheme()` no componente.
- **Não ofereça instalar.** Ver o EXPERIENCE: é ordem do dono, e vale até segunda ordem.

## Perguntas em aberto

1. **A goteira de 20 pt versus as telas vizinhas de `/configuracoes`.** Motores passa a
   respirar diferente de `/configuracoes` e das suas outras subtelas, que usam 16. Ou
   Configurações inteira se move para 20, ou Motores fica sendo a exceção declarada. **A
   decisão é do dono** e não trava a construção.
2. **`{colors.on-primary}` mede 3,31 contra `{colors.primary}`** na marca `laranja` —
   declarado à mão em `brands.ts`, e suficiente para objeto gráfico (piso 3,0), **não**
   para texto de 15 px (piso 4,5). O botão **Medir** herda esse defeito do app inteiro, e
   ele já existe hoje na Bancada. Três saídas: subir o texto para ≥18,66 px em peso 700
   (vira "texto grande", piso 3,0); usar `{colors.ink}` como preenchimento, o que o resto
   da família já faz; ou aceitar e registrar. **Não é uma regressão desta tela** — é uma
   dívida que esta tela torna visível.
3. **`{typography.relogio}` em 32 pt não foi visto no aparelho.** É a maior coisa da
   família depois dos títulos e o mockup nunca rodou num iPhone — a versão 10 já o subiu
   para 34 no HTML. Conferir em escala real antes de gastar build, junto com a
   `{components.faixa-de-compilacao}`: listra animada é a coisa mais fácil de sair
   vibrando no telefone e a mais fácil de sumir sob **Reduzir movimento** sem ninguém
   notar.

**Fechadas nesta revisão**, e registradas onde vivem: o par preenchido do
`{components.selo-de-desfecho}` (a versão 10 tirou o preenchimento, e a dívida de medir
`ramp.strong` sobre `soft` morreu com ele — ver *Selo de estado*) e a disputa da barra de
compilação (não há fração a pintar — ver *Colors*).

**Fechadas em 23/09, quando os achados de borda entraram** — cinco de forma, e as cinco
estavam a um passo de virar defeito no aparelho:

- **O véu da folha no escuro.** `{colors.ink}` a 60% clareia; passa a ser `{colors.veu}`.
  Ver *O véu não é tinta*.
- **A altura fixa do chip.** 36 pt vira mínimo; o motivo dentro do rótulo deixa de ser
  cortado em Texto grande. Ver *Chip da corrida*.
- **As três etapas e a faixa embutida.** Uma etapa, uma faixa, um lugar. Ver *A compilação
  não tem barra* e *Shapes*.
- **O chip `Template · régua` onde não há régua.** Some. Ver *Chip da corrida*.
- **O total do cabeçalho somando o que não foi medido.** A soma passa a ser declaradamente
  parcial. Ver *Linha de modelo*.

O `{colors.andando-accent}` continua declarado e **sem consumidor** — com a faixa embutida
fora da lista, o âmbar desta família vive inteiramente dentro de `compilar/[id]`.
