# Revisão de acessibilidade — A revista da Retrospectiva

## Veredito geral

O piso declarado em `EXPERIENCE.md` acerta os princípios e erra na entrega: ele diz "a faixa é
cabeçalho de seção para o leitor de tela" e "tipo dinâmico honrado" sem dizer nada que um
implementador possa executar, e a única coisa realmente medida — `onAccent` nas 36 combinações —
é justamente a que já estava segura (nome de caderno em 22 px bold precisa de 3,0, não de 4,5).
Enquanto isso, três coisas quebram de verdade: a navegação por âncora do sumário não move nada
para quem usa VoiceOver, o tipo dinâmico corta o veredito da lua e a linha que a ADR 0045 obriga
a carregá-lo, e a camada inteira de rótulos em `ink3` a 10–11 px — assinatura, ficha da lua,
período de cada capa, legenda do número — roda a **2,87:1**, abaixo do mínimo de texto normal,
com a barreira do próprio repositório (`theme.test.ts:105`) admitindo esse token até 3,0 porque
ele foi classificado como *texto grande e objeto gráfico*. Nada disso é caro de consertar; tudo
isso está fora das espinhas hoje.

## Achados

- **[crítico]** Tocar a linha do sumário rola a página mas **não move o foco do VoiceOver**; o
  usuário cego ouve silêncio e continua no sumário (`EXPERIENCE.md` — Component Patterns, "rola
  com âncora até a faixa daquele caderno"; Interaction Primitives, "Âncora"). *Por que importa:*
  o sumário é a única navegação da revista, e para leitor de tela ele fica inerte — o próximo
  swipe vai para a segunda linha do sumário, não para o caderno que ele acabou de escolher.
  *Conserto:* declarar que a ação faz `AccessibilityInfo.setAccessibilityFocus(ref da faixa)`
  depois do `scrollTo`, com `accessibilityHint` na linha ("rola até o caderno, na mesma página")
  e a mesma restauração de foco na volta da página da lua para a linha de entrada. Hoje
  `setAccessibilityFocus` e `announceForAccessibility` **não aparecem uma única vez** em
  `mobile/src/` — sem a espinha dizer, ninguém vai escrever.

- **[crítico]** No tipo dinâmico grande, o bloco do veredito da lua e a linha de entrada
  **cortam o texto** (`DESIGN.md` — `lua-moldura.invariante: 'mesma altura e mesmo corpo nos
  três vereditos'`; `mockups/key-lua.html`: `.device{grid-template-rows:40px 52px 72px 176px
  188px 200px 1fr}`, `.v-text{height:46px;overflow:hidden}`, `.entry-text{height:69px;
  overflow:hidden}`). *Por que importa:* quem lê em AX3+ é exatamente quem tem baixa visão, e é
  ele que perde "faltam cerca de 106 noites" — a frase que a ADR 0045 põe na linha de entrada
  justamente para quem nunca toca; uma configuração de acessibilidade derrota em silêncio um
  invariante editorial. *Conserto:* reescrever o invariante como **relativo**: "os três vereditos
  medem a mesma altura *no mesmo corpo de letra*, e essa altura cresce com o tipo" — altura por
  `minHeight` + medição do mais longo dos três em runtime, nunca `height` fixa, nunca
  `numberOfLines`. E declarar explicitamente que nem a linha de entrada nem o veredito truncam.

- **[crítico]** `ink3` a 10–11 px carrega informação obrigatória em **2,87:1** sobre `bg` e
  **3,05:1** sobre `surface` — abaixo dos 4,5 de texto normal (assinatura `gemini-3.6-flash · 07
  set 2026`, os cinco rótulos da ficha da lua em `.f-lab` 10,5 px, `.f-sub`, `.v-cap` "faltam
  para 80% de poder", `.sum-rotulo` com o nome do caderno, `.period` "AGO 2026" de cada capa da
  parede, os doze meses da tira em 9 px). *Por que importa:* a barreira do repo
  (`packages/shared/src/theme/theme.test.ts:105`) admite `ink3` até 3,0 com o comentário "3,0 =
  texto grande e objeto gráfico" — o token está sancionado como decorativo, e a revista o promove
  a portador de fato sem remedir; a assinatura é declarada obrigatória "porque o leitor tem
  direito de saber", a 2,87:1. *Conserto:* tudo que a espinha declara obrigatório de ler vai para
  `ink2` (**7,09:1** sobre `bg`, medido no mesmo recorte); `ink3` fica só onde a informação é
  redundante. E acrescentar à seção *Contraste medido* a lista do que foi medido e o corpo de
  letra de cada uso — hoje ela mede um token e generaliza a promessa.

- **[crítico]** O véu da capa **não tem piso**: o gradiente vai a alpha 0 no topo dos 230 px, e o
  bloco de texto começa a ~135 px do rodapé, onde o véu mede ≈0,30 (`DESIGN.md` — `capa.overlay:
  'véu em gradiente, só sob o texto'`; `key-edicao.html` `.capa-veu-baixo` + `.capa-texto`). Sobre
  céu branco de foto real, `#FFF7EE` a 0,30 de véu mede **≈1,8:1** — e o primeiro a cair é o
  `capa-periodo` ("AGOSTO DE 2026", 11 px, ainda por cima a 82% de opacidade). *Por que importa:*
  é o único ponto da revista onde o contraste depende de uma imagem que o app não controla, as
  fotos vêm da biblioteca do iPhone, e uma pedalada belga com céu encoberto é o caso comum, não a
  borda. *Conserto:* piso medido em vez de "obrigatório": alpha mínimo do véu **sob todo o bloco
  de texto** (não um gradiente que se apaga onde está o texto menor), fixado pelo pior caso
  (fundo branco puro) para dar ≥4,5:1 no menor corpo — o gradiente continua existindo acima do
  bloco, para não chapar a foto. `textShadow` não conta como mecanismo de contraste. Mesmo
  problema, segunda instância: o botão voltar é um glifo claro sobre `rgba(24,18,13,.34)` sobre
  foto desconhecida.

- **[alto]** A faixa nunca é nomeada como `accessibilityRole="header"`, e o ícone nunca é marcado
  como não-acessível em termos que virem código (`EXPERIENCE.md` — "A faixa é cabeçalho de seção
  para o leitor de tela — o nome do caderno é o rótulo, e o ícone é decorativo"). *Por que
  importa:* `accessibilityRole="header"` **não existe em nenhum lugar de `mobile/src/`** hoje (47
  `"button"`, 2 `"switch"`, 2 `"image"`, 0 `"header"`); sem a espinha nomear o papel, a faixa sai
  como uma `View` com um `Svg` e um `Text`, o rotor de Cabeçalhos fica vazio numa página de seis
  telas de rolagem, e o SVG pode virar uma parada de foco sem nome. *Conserto:* escrever a
  espinha em três linhas executáveis — a faixa é um elemento único (`accessible`), papel `header`,
  rótulo = o nome do caderno e nada mais; o ícone leva `accessibilityElementsHidden` /
  `importantForAccessibility="no-hide-descendants"`. iOS não tem nível de cabeçalho, então "o
  nível" se resolve por hierarquia visual, não por API — vale dizer isso, para ninguém procurar.
  Decidir também o que é o cabeçalho da página da lua, que a espinha diz **não** ser faixa e o
  mockup desenha como faixa com o botão voltar dentro (`key-lua.html` `.cadband`).

- **[alto]** Na maior configuração de tipo do iOS, o nome do caderno **não cabe** e a identidade
  colapsa em cor pura (`DESIGN.md` — `faixa-altura: 56px`, `caderno-nome: 22px/700`;
  `EXPERIENCE.md` — "A faixa cresce com o nome; ela tem altura mínima, não altura fixa"). *Por que
  importa:* em AX5 o multiplicador do iOS chega a ~3,1× e nada no app o limita
  (`maxFontSizeMultiplier`/`allowFontScaling` **não aparecem em `mobile/src/`**); "Movimento" a
  ~68 px bold pede ~370 px numa faixa que tem ~320 px úteis depois do padding e do ícone. Se
  truncar, sobra "Movim…" e a identidade cai sobre a cor — que a própria medição deste documento
  reprova (ΔE 4,1 a 9,9 entre Movimento e Coração em cinco das seis paletas). *Conserto:* "altura
  mínima" não basta; decidir por escrito (a) o nome **quebra em duas linhas, nunca trunca**, (b)
  o ícone escala junto com o corpo (senão vira um ponto ao lado de um título gigante) ou tem
  tamanho fixo declarado, (c) a partir de qual passo o ícone sai da linha para o nome ganhar a
  largura. Nota lateral: os três mockups desenham esse nome em 19 px sans, 17 px sans e 31 px
  serif — a espinha diz 22 px sans/700 e nenhum mockup a obedece, então o número que sustenta os
  56 px nunca foi verificado em pixel.

- **[alto]** As quatro tiras do anuário são **a capa do ano** e são completamente silenciosas
  (`DESIGN.md` — `anuario-tira`, "O anuário não tem capa. As quatro tiras são a capa do ano";
  `key-formas.html`, quatro `<svg aria-hidden="true">`). *Por que importa:* a legenda do próprio
  mockup diz o que elas comunicam — "dá para ver Movimento cair no fim do ano enquanto Sono se
  mantém" — e é exatamente essa leitura que um usuário de leitor de tela nunca recebe; ele abre o
  anuário e cai direto no primeiro caderno, sem saber que existiu uma abertura. *Conserto:* cada
  tira vira um elemento único com rótulo textual do formato, sem inventar valor e sem
  aconselhar — o anuário já calcula os extremos datados ("mês mais baixo, ago 2026, 435 km"), e é
  disso que o rótulo se faz. A regra "não é gráfico interativo" continua valendo: rótulo não é
  toque.

- **[alto]** Alvos de toque: os três declarados estão certos, mas **o cromo ficou de fora** e o
  único desenhado mede 34 px (`EXPERIENCE.md` — "Três alvos na edição: linha de sumário, entrada
  da lua, capa da parede"; `key-edicao.html` `.voltar{width:34px;height:34px}`). *Por que
  importa:* voltar é a saída da edição inteira, fica sobre a foto (fundo imprevisível) e é o
  controle mais usado da tela; junto dele ficaram sem tamanho e sem nome o chevron de voltar da
  página da lua (`.cadband .back`, glifo de 24 px sem área declarada), o do postal (`.nav svg`,
  22 px), o **botão de imprimir** (declarado em State Patterns) e o **olho de esconder** do painel
  Diagramação. *Conserto:* 44 px em todos, `accessibilityLabel` em cada um, e o olho declarado
  como `accessibilityRole="switch"` com `accessibilityState.checked` — hoje ele é um ícone sem
  nome cujo estado só existe na aparência.

- **[alto]** A parede de capas fica sem estrutura e com imagens ou mudas ou duplicadas
  (`DESIGN.md` — `parede-capa`; `EXPERIENCE.md` — "A imagem da capa tem descrição textual: a
  legenda de três campos já é a descrição"; `key-arquivo.html`). *Por que importa:* três das
  quatro capas de 2026 no mockup **não têm legenda nenhuma** (o próprio HTML registra a lacuna),
  então pela regra da espinha elas ficam sem descrição; onde a legenda existe, ela já é texto
  visível e seria lida duas vezes; e a régua de ano ("2026", "2025") é um `<b>` com um filete, sem
  papel de cabeçalho — num arquivo que, por decisão de projeto, **não tem seletor de data**, o
  usuário de leitor de tela perde o único acesso aleatório que restava e passa a varrer dezenas
  de capas numa lista plana. *Conserto:* cada azulejo é **um** elemento, papel `button`, rótulo =
  período + manchete curta, imagem decorativa; a régua de ano ganha `accessibilityRole="header"`,
  o que devolve ao rotor a função que o seletor de data perdeu.

- **[alto]** Os estados **escrevendo** e **reprovada na conferência** mudam a tela sem ação do
  usuário e sem anúncio (`EXPERIENCE.md` — State Patterns: "a edição chega em quatro peças, e cada
  uma aparece quando fica pronta"). *Por que importa:* é o único momento em que a página se
  reescreve sozinha; o conteúdo entra abaixo (ou acima) do foco, o layout se move sob o dedo e
  quem não vê não sabe que o caderno de Sono chegou — nem que o de Rotina foi descartado, que é a
  informação mais importante da jornada 2. *Conserto:* `announceForAccessibility` por peça pronta
  ("caderno de Sono impresso") e para a reprovação, com a mensagem de reprovação como primeiro
  elemento focável do caderno afetado.

- **[médio]** Opacidade aplicada por cima de token medido anula a medição, em três lugares
  (`key-lua.html` `.cadband .sub{font-size:11px;opacity:.72}` → **3,43:1**; `key-edicao.html`
  `.capa-periodo` a .82 e `.capa-legenda` a .80 sobre o véu). *Por que importa:* `DESIGN.md`
  promete "contraste medido, não conferido" e o `onAccent` mínimo de 4,25 — e então multiplica
  esse valor por 0,72 num texto de 11 px, o que não aparece em medição nenhuma. *Conserto:*
  proibir opacidade sobre `onAccent` e sobre texto na capa; hierarquia por corpo de letra e peso,
  que é o que a própria folha usa em todo o resto.

- **[médio]** A gramática do "·" e dos símbolos não tem forma falada declarada (`Ittre · km 31,1
  · 12:38`, `gemini-3.6-flash · 07 set 2026`, `~49 dentro · ~241 fora`, `fase −5 a −1`, `VO₂max`,
  `SpO₂`, `17/08/2026`). *Por que importa:* o VoiceOver ou come o separador — e a legenda vira
  "Ittre km trinta e um vírgula um doze e trinta e oito", uma frase só — ou o soletra; o `−` de
  `fase −5 a −1` é U+2212 e pode simplesmente não ser dito, invertendo o sentido da janela; o
  subscrito `₂` de `VO₂max` e `SpO₂` cai no meio da lápide, que é a frase que existe para dizer
  que a métrica morreu. *Conserto:* `accessibilityLabel` próprio para toda linha com "·" e para
  toda métrica com símbolo, escrito por extenso ("Ittre, quilômetro 31,1, às 12h38"; "VO2 máx");
  e regra de autoria: versalete se faz com `textTransform: 'uppercase'` sobre string em caixa
  normal, **nunca** com a string já em maiúsculas (o iOS soletra maiúsculas curtas: "SONO" vira
  "S-O-N-O") e nunca com espaços inseridos à mão.

- **[médio]** O disco lunar **inverte de sentido** no esquema escuro (`key-lua.html`: parte não
  iluminada `fill="var(--ink)"`, parte iluminada `fill="var(--bg)"`). *Por que importa:* `ink` e
  `bg` trocam de papel entre claro e escuro, então no escuro a lua desenha a sombra clara e a luz
  escura — um desenho declarado "dado, não símbolo" passa a mentir para quem usa o modo escuro,
  que é uma preferência de conforto visual e de fotossensibilidade, não uma decoração. *Conserto:*
  o disco lê `graphic`/`wash` do papel `blue`, não `ink`/`bg`, e o esquema deixa de trocar o
  sentido. No mesmo passo: o `aria-label` existente descreve a figura ("disco lunar com a região
  das cinco noites testadas destacada") mas não o valor — ele precisa dizer a fase e a fração
  iluminada, e no RN vira `accessible` + `accessibilityRole="image"` + rótulo, que o `<svg>` com
  `aria-label` e sem `role="img"` não garante nem no HTML.

- **[médio]** A manchete da capa e a primeira linha do sumário são a mesma frase, a menos de uma
  tela de distância — aceito como forma (`DESIGN.md` — "A primeira linha repete a manchete da
  capa, e isso é forma, não defeito"). *Por que importa:* a repetição impressa é *saltada* pelo
  olho e **lida inteira** pelo leitor de tela: duas passagens por uma frase longa em dois swipes,
  sem nenhuma pista de que é a mesma. O argumento tipográfico é bom e não vale para leitura
  linear. *Conserto:* a decisão editorial fica; a manchete sobre a foto vira
  `accessibilityElementsHidden` quando a linha 1 do sumário carrega a mesma string — o texto
  continua na tela para quem vê, e some da fila para quem ouve.

- **[médio]** Nada nas espinhas considera **Reduzir Movimento** nem **Reduzir Transparência**.
  *Por que importa:* a rolagem ancorada é a única animação da revista e o véu da capa é
  transparência sobre imagem — as duas coisas que esses dois ajustes existem para atenuar; o app
  já sabe fazer isso em um lugar só (`mobile/src/components/charts/StackedBarChart.tsx:150`).
  *Conserto:* com Reduzir Movimento, o `scrollTo` é instantâneo (`animated: false`); com Reduzir
  Transparência, o véu vira chapado no lugar de gradiente — o que também resolve o piso do achado
  crítico do véu para quem ligou o ajuste.

- **[médio]** "Período em curso mostra **nada**" é, sem visão, indistinguível de uma tela que não
  carregou (`EXPERIENCE.md` — State Patterns). *Por que importa:* o argumento editorial ("um
  jornal não anuncia a edição que ainda não fechou") descreve o que se vê; quem ouve recebe
  silêncio e não tem como separar "ainda não fechou" de "falhou". *Conserto:* a ausência visual
  fica; a camada de acessibilidade ganha um rótulo de fato, não de conselho — "Setembro de 2026,
  período em curso" —, que não viola a voz porque não recomenda nada. Vale a mesma pergunta para a
  **marca de errata**, cuja forma `EXPERIENCE.md` deixa indefinida: se ela for só um sinal
  gráfico, é significado sem texto.

- **[baixo]** Contraste **não-textual** nunca foi medido, só o textual (traçado da capa do
  arquivo: `stroke="#F25C2B"` sobre `--surface` = ~3,3:1 no único recorte, e nada nas outras 35
  combinações; barra da tira contra a trilha `soft`; a régua da lápide, que o mockup desenha em
  `--line` sobre `--bg` = **1,06:1**, enquanto `DESIGN.md` manda usar o accent do caderno).
  *Por que importa:* o traçado é o conteúdo inteiro da capa de 2023–2025 e a régua é o único
  marcador visual da lápide no pé; a 1,06:1 ela simplesmente não existe para ninguém. *Conserto:*
  estender a barreira de `theme.test.ts` a esses três pares com piso de 3,0, e corrigir a
  divergência mockup × espinha na cor da régua. Atenuante honesto: o texto da lápide se explica
  sozinho ("VO₂max. Última medida em 14/07/2026."), então o custo real é de leitura visual, não
  de compreensão.

- **[baixo]** Quatro ícones a 20–23 px com traço de 1,6 px: as **silhuetas** se distinguem bem
  (bicicleta larga de duas rodas, crescente, lóbulo, círculo com tique), mas o traço fino é o elo
  fraco sob baixa visão, e nada declara se ele engrossa ou escala junto do tipo. *Por que importa:*
  o ícone é o segundo portador da identidade nas cinco paletas que não separam laranja de
  vermelho; se ele encolher relativamente ao texto em AX5, a carga volta para a cor. *Conserto:*
  traço proporcional ao corpo (≥2 px no tamanho base), e registrar que o **nome** é o terceiro
  portador e o mais forte — o que já é verdade e a espinha só menciona de passagem.

## O que já está bem resolvido

- **Nenhum gesto horizontal, em lugar nenhum** (`EXPERIENCE.md` — Interaction Primitives). É a
  melhor decisão de acessibilidade do documento e não foi tomada por acessibilidade: a borda
  esquerda continua sendo do voltar do sistema, o swipe de navegação do VoiceOver não disputa com
  carrossel nenhum, e o precedente doloroso do projeto (`swipe-back × PanResponder`) não se repete
  aqui.
- **A lápide se explica em texto puro** — nome, última data, ponto. Não depende de cor, de ícone
  nem de posição para significar; muda de posição e de corpo por razão editorial, e o sentido
  sobrevive inteiro a uma leitura linear.
- **A linha de entrada da lua carregar o veredito por extenso** é a decisão certa também para
  leitor de tela: ela põe o resultado no caminho de leitura em vez de atrás de um destino — desde
  que o achado crítico do tipo dinâmico seja consertado, senão é justamente essa linha que corta.
- **O postal declara em texto o que a picotagem diz em forma** ("nota não arquivada · recalculada
  a cada leitura"): dois portadores para o mesmo fato, sem ninguém ter pedido.
