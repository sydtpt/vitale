# Revisão da espinha — A revista da Retrospectiva

## Veredito geral

As duas espinhas respeitam a lei da casa com disciplina real: nenhum não-objetivo foi
desenhado, nenhuma restrição foi contrariada de frente, e as duas mais fáceis de trair —
*"a revista nunca gera sozinha"* e *"a ordem congela na impressão"* — são reafirmadas duas
vezes cada e testadas dentro de uma jornada. O que sai furado é a **cobertura**: três
elementos do contrato somem sem que ninguém diga que sumiram (a camada de luz do
trimestre, o `yearSeries` do anuário, a grade diária como terceira capa), uma cláusula da
ADR 0045 é reinterpretada em vez de emendada, e a regra tipográfica que o próprio
documento chama de epistemológica é a única linha normativa ambígua do par. Somado a isso,
componentes centrais existem só de um lado — o **botão de imprimir** não tem aparência, a
**fase sinódica** não tem especificação nenhuma — e superfícies inteiras (o arquivo, a lua
antes da primeira execução) não têm estado.

## Cobertura contra o contrato — adequada

### Restrições

As 17 restrições de `spec.md` (a sessão contou 16; ver Notas mecânicas), uma a uma:

| # | Restrição | Veredito |
|---|---|---|
| 1 | É um jornal: informa, não aconselha | **respeitada, com força.** Abre o DESIGN, tem tabela própria em EXPERIENCE §Voice, e a lápide recusa nominalmente *"verifique suas conexões"* |
| 2 | Estatística acha; o modelo prioriza e narra | **respeitada.** `ordenarCadernos` é função; nada na tela pede conta ao modelo |
| 3 | Todo número citado existe no pacote | **respeitada.** É o clímax da jornada 2 |
| 4 | Cobertura desigual obriga ressalva | **silenciosa na prática.** Citada uma vez, sem forma — ver achado C11 |
| 5 | Período fechado congela; `all` não tem edição | **respeitada** quanto ao congelamento; **silenciosa** quanto ao `all` — ver C12 |
| 6 | Provedor e modelo são configuração | **respeitada em espírito**, imprecisa na origem do valor — ver C14 |
| 7 | A camada narra, nunca decide | **respeitada.** A lápide não leva a Conexões; nada dispara ação |
| 8 | Mobile-first | **respeitada.** *"iPhone, retrato. Superfície única na v1"* |
| 9 | A revista nunca gera sozinha | **respeitada, com força.** Seção própria, botão só em fechado-e-não-escrito, postal efêmero |
| 10 | O sol é pré-requisito da lua | **respeitada** no teste lunar; **contrariada por omissão** nos cadernos — ver C1 |
| 11 | O pré-registro é imutável, hash na constante, contador visível | **respeitada, com força.** Hash como procedência, contador impresso, cadência na página |
| 12 | Sol e lua derivados na leitura, nunca gravados | **silenciosa** (mecânica, não UX). Coerente: *"a capa não ganha coluna no banco"* |
| 13 | `season` continua trimestre civil | **silenciosa.** A palavra `season` não aparece nas espinhas — ver C15 |
| 14 | A ordem é coluna, não array, e congela | **respeitada, com força.** Dita duas vezes e testada na jornada 1 |
| 15 | Mais números autorizados enfraquecem a verificação | **respeitada.** Nenhum número novo é autorizado na superfície; todos os que aparecem (legenda de três campos, noites e ciclos, extremos) já estavam no contrato |
| 16 | O backfill pagina | **silenciosa** (mecânica) |
| 17 | Verifica antes de gravar | **respeitada.** Primeira invariante de §Impressão e congelamento |

Nenhuma restrição é contrariada de frente. As duas fraquezas são por omissão (4 e 10).

### Não-objetivos

Os 11, um a um: **nenhum violado.** Não há superfície para captura nova, para as oito
métricas ausentes, para web/PDF/e-mail (nomeados como não-objetivo logo no Foundation),
para caderno de lua (chamada de sub-página em cinco lugares distintos), para caderno
"Onde" (dissolvido em capa + Movimento, exatamente como o contrato manda), para base anual
de Rotina, para backfill de semanas (o postal não grava), para secundários da lua como
manchete (proibição explícita), para reordenação manual (o painel Diagramação perde as
setas), para investigação das métricas mortas (*"diagnosticar a causa é trabalho
independente"*), nem para grounding.

O único ponto que merece registro: os mockups são HTML, mas são meio de prototipagem, não
superfície web desenhada. Não conta como violação do não-objetivo 3.

### Capacidades

**As seis a cargo da UX:**

- **CAP-7 — ordem ranqueada que congela.** *Atendida.* IA declara a ordem variável vinda
  do dado, o congelamento na impressão e a razão de a faixa ser saturada (reconhecimento
  pela cara, não pela posição). A jornada 1 é literalmente o critério de sucesso do spec.
- **CAP-8 — o sumário é a lista de chamadas.** *Atendida no comportamento, furada na
  origem.* A linha reaproveita a chamada, é alvo inteiro, rola com âncora. Mas nada diz de
  onde a chamada sai (C4). E o bloco de IA fixa *"4 chamadas"* enquanto a regra vizinha diz
  que caderno vazio some — o sumário tem 1 a 4 linhas.
- **CAP-9 — três formas.** *Parcialmente atendida.* Postal e anuário existem como objetos
  distintos, com decisões boas (acromático, sem capa). Mas o trimestre é colapsado no mês
  (C1), o `yearSeries` é substituído sem aviso (C2) e a tira não diz o que mede (C3).
- **CAP-10 — a capa, com foto ou traçado.** *Atendida no caso comum.* Falta o terceiro
  caso do contrato (C8) e o anuário é isentado do critério sem declarar a isenção (C7).
- **CAP-11 — a ausência é fato declarado.** *Atendida, e bem.* Seção própria; a colisão de
  três lápides em julho/2026 foi resolvida lendo o contrato em vez de inventar regra. A
  única sobra é a lápide subir ao topo (C9).
- **CAP-12 — a lua sob pré-registro.** *Atendida, com uma cláusula da ADR contrariada.*
  Moldura fixa, três vereditos, contador, cadência, hash como procedência, covariável com
  regra de subida. O furo é o *atrás de um toque* (C5) e o estado antes da primeira
  execução (C6).

**As outras oito:** CAP-1 (errata por caderno), CAP-2, CAP-3 (jornada 2, passo 3), CAP-4 e
CAP-5 (tabela de bases em §Voice) e CAP-14 (`hidden` fica) estão coerentes. **CAP-6 é
contrariada por omissão** (C1). CAP-13 não pede superfície e não foi ferida.

### Achados

- **[alto]** **A camada de luz não tem superfície em caderno nenhum.** CAP-6 exige o fato
  de luz nos quatro pacotes, e `cadernos.md` §Edição exige *"no trimestre, a camada de luz
  em destaque"*. As espinhas citam luz do dia exatamente uma vez cada, sempre no contexto
  da lua; a palavra "trimestre" aparece uma vez em todo o par, dentro de uma célula de
  tabela que o funde com "mês" (EXPERIENCE §IA). *Conserto:* dar ao trimestre uma linha
  própria na tabela de formas e uma regra de destaque para a camada de luz, ou registrar
  por escrito que o trimestre é idêntico ao mês e que CAP-6 vive só na prosa narrada.
- **[alto]** **As quatro tiras substituem o `yearSeries` sem dizer que substituem.**
  `cadernos.md` §Anuário nomeia um bloco que *já existe e já é exclusivo de `year`*; as
  espinhas descrevem outro objeto (uma tira por caderno, na cor do caderno) e nunca citam
  o `yearSeries` (0 ocorrências nos dois arquivos). Quem construir não sabe se envolve,
  substitui ou convive. *Conserto:* uma frase em DESIGN §Tira do anuário dizendo qual é a
  relação com `yearSeries`.
- **[alto]** **A tira não diz o que mede.** *"12 marcas, 34 px de altura, no `accent` do
  caderno"* e *"quatro batimentos paralelos"* não são construíveis: o que varia de marca
  para marca — altura, opacidade, presença? Qual métrica de cada caderno? O que acontece
  num mês sem dado? (DESIGN §Tira do anuário; frontmatter `anuario-tira`.) *Conserto:*
  nomear a grandeza por caderno e o tratamento do mês vazio.
- **[alto]** **A "chamada" não tem origem declarada.** DESIGN estabelece que a manchete da
  capa e a primeira linha do sumário são *a mesma frase* e que o texto é *"reaproveitado do
  caderno"* — mas nada nas duas espinhas diz se a chamada é um campo que o modelo produz,
  a primeira sentença do caderno ou uma extração. Sem isso não se constrói nem a capa nem
  o sumário. (DESIGN §Linha de sumário e §Capa; EXPERIENCE §Component Patterns.)
  *Conserto:* declarar a chamada como campo de saída por caderno, ao lado do texto.
- **[alto]** **ADR 0045 §3 proíbe o negativo "atrás de um toque"; a página da lua está
  atrás de um toque.** A mitigação — a linha de entrada carregando o veredito por extenso,
  idêntica nos três casos — é boa e está bem argumentada, mas a espinha reinterpreta uma
  cláusula de ADR aceita em vez de emendá-la. Quem auditar CAP-12 contra a ADR vai reprovar
  o desenho. (EXPERIENCE §Disciplina de pré-registro, último parágrafo; ADR 0045
  consequência 3.) *Conserto:* nota superveniente na ADR 0045 registrando que a paridade
  passa a morar na linha de entrada, com a condição de identidade tipográfica e de extensão.
- **[alto]** **Não há estado para "o teste lunar ainda não rodou".** As espinhas cobrem os
  três vereditos e nada diz o que o pé do caderno Sono mostra antes da primeira execução —
  que é exatamente o modo de falha que a ADR 0045 existe para impedir (*"a ausência de
  página indistinguível de 'ainda não rodou'"*). *Conserto:* quarto estado da linha de
  entrada, com a mesma tipografia dos outros três.
- **[alto]** **A regra do número na prosa se contradiz.** DESIGN §Do's manda *"escreva
  número em mono e prosa em serifada"*; a rampa fixa o texto de caderno em `edicao`
  (serifada), e todo caderno tem números embutidos na frase. O mockup resolve — *"os
  números da prosa correm na serifada; mono fica para o que é dado solto"*
  (`key-edicao.html`, nota de tipografia) — mas a regra de precedência declarada nos dois
  cabeçalhos faz a espinha vencer o mockup, ou seja, a leitura que fica valendo é a errada.
  A fronteira que o documento chama de epistemológica é a única linha normativa ambígua do
  par. *Conserto:* reescrever o Do's como a nota do mockup.
- **[médio]** **O anuário sem capa isenta uma edição gravada do critério de CAP-10.**
  CAP-10 diz *"cada edição tem uma imagem que diz onde o período aconteceu"* e o anuário
  grava edição. A decisão (as quatro tiras *são* a capa) é defensável e está no memlog, mas
  as espinhas a apresentam como leitura fiel do contrato, não como delta. *Conserto:*
  declarar como exceção nomeada, para que o teste de CAP-10 não conte o ano como falha.
- **[médio]** **Some o terceiro caso de capa.** `cadernos.md` §A capa dá `activity_routes`
  *"ou a grade diária"*; as espinhas só têm foto e traçado. Num arquivo de 436 edições
  desde 22/05/2023 haverá períodos sem foto e sem rota. *Conserto:* terceira natureza de
  capa, ou regra explícita de fallback.
- **[médio]** **A lápide sobe ao topo do caderno, e o contrato a põe no pé.** `spec.md`
  CAP-11 e `bases-e-ranqueamento.md` dizem *"lápide no pé do seu caderno"*; "liderar" ali é
  a posição do **caderno** (passo 5 do ranqueamento), não a da lápide dentro dele. Mover a
  lápide para o topo com um degrau de corpo é adição, não leitura. (DESIGN §Lápide, tabela
  de dois estados; memlog registra como decisão.) *Conserto:* declarar como delta do
  contrato, com a razão.
- **[médio]** **O critério que fecha a moldura da lua é inconsistente.** A covariável é
  mantida fora porque *"os campos da moldura estão enumerados no contrato e um sexto seria
  redecidir"* — mas a mesma página ganha a **fase sinódica desenhada**, que também não está
  na enumeração e é ainda mais proeminente. *Conserto:* escolher um critério: ou a
  enumeração é fechada e a fase também vive fora dela, ou é aberta e a covariável cabe.
- **[médio]** **A ressalva de cobertura desigual não tem forma.** A restrição está citada
  uma vez em EXPERIENCE §Voice e nunca ganha superfície: onde mora, em que corpo, dentro da
  prosa serifada ou fora dela. *Conserto:* uma linha em §Component Patterns ou na rampa
  tipográfica.
- **[médio]** **`all` não tem tela.** As espinhas repetem que `all` não tem edição e que o
  CHECK recusa, e não dizem o que o leitor vê ao escolhê-lo — é um período existente na
  Retrospectiva de hoje. *Conserto:* linha na tabela de formas.
- **[médio]** **O override do precedente "bloco preenchido não é destaque" só existe no
  memlog.** O memlog registra a tensão e a decisão do dono; DESIGN §A faixa é saturada
  justifica pela medição de ΔE mas nunca menciona o precedente que está derrubando. Quem
  construir lê a espinha, não o memlog, e pode "consertar" a faixa. *Conserto:* uma frase
  em §Colors nomeando o precedente e o override.
- **[médio]** **Conflito herdado do contrato, não sinalizado.** `pre-registro-lua.md` §7.2
  manda gravar cada execução em `edicoes_ia` com `caderno='lua'`; `mudancas-mecanicas.md`
  fixa `check (caderno in ('sono','movimento','coracao','rotina'))`. As espinhas decidem a
  procedência da página (hash, sem assinatura de modelo) apoiadas numa linha que o CHECK
  recusa. Não é falha da UX, mas ela é a primeira a esbarrar nele. *Conserto:* levantar
  para quem for escrever a migration.
- **[baixo]** **A assinatura é dada por literal de fornecedor.** DESIGN §Typography fixa o
  formato como `gemini-3.6-flash · 07 set 2026` sem dizer que os dois primeiros campos saem
  das colunas `provedor`/`modelo` da linha — e a restrição 6 proíbe nome de fornecedor até
  em literal de string dentro de `shared/src/ia/`. *Conserto:* nomear a origem do valor.
- **[baixo]** **Glossário divergente.** As espinhas dizem "trimestre"; o contrato e o banco
  dizem `season` (0 ocorrências nas espinhas). *Conserto:* citar o identificador uma vez.

## 1. Cobertura de jornadas — adequada

Quatro jornadas, todas com protagonista nomeado (Sydnei), passos numerados e clímax
rotulado em negrito. O caminho de falha existe e é uma jornada inteira (a 2, reprovação na
conferência) — melhor do que o molde pede. A jornada 1 é o sinal de sucesso do spec
transcrito em passos, o que é a coisa certa a fazer.

### Achados

- **[médio]** **CAP-9 tem três formas e só uma é percorrida.** As quatro jornadas são
  edição de mês (1 e 2), lua (3) e arquivo (4). Nem o **postal** nem o **anuário** têm
  jornada — e são as duas formas mais fáceis de construir erradas, porque são as que se
  parecem com a terceira. *Conserto:* uma jornada de semana e uma de ano, curtas.
- **[médio]** **Três estados não têm caminho: errata, erro e silenciar um caderno.** Os
  três estão na tabela de estados (ou em CAP-14) e nenhum é percorrido. Errata em
  particular é a regra que sustenta *"período fechado congela"* e nunca foi encenada.
  *Conserto:* estender a jornada 2 com a errata, ou uma quinta jornada.

## 2. Completude de tokens — adequada

Todas as 22 referências `{caminho.do.token}` de DESIGN.md resolvem contra o frontmatter —
nenhuma quebrada. Os `sources:` dos dois arquivos resolvem (`../../../../` chega à raiz do
repositório) e os quatro caminhos de código citados existem.

### Achados

- **[alto]** **A assinatura fica abaixo do piso de contraste, e o documento não mediu esse
  par.** `assinatura` é `{typography.assinatura}` (mono, 11 px) em `{colors.ink3}`
  (`#9C928A`): mede **≈3,05:1** sobre `{colors.surface}` e **≈2,87:1** sobre
  `{colors.bg}` — abaixo de 4,5:1, e 11 px não é texto grande. É o menor corpo da revista,
  é declarado obrigatório e visível, e o §Accessibility Floor diz *"contraste medido, não
  conferido"* tendo medido só `onAccent`. (Confirmado no mockup: `.assinatura` usa
  `var(--ink3)`.) *Conserto:* subir para `ink2` (7,5:1) ou declarar a exceção com o alvo
  aceito.
- **[médio]** **O véu da capa não tem piso numérico.** É o único contraste da revista que
  depende de uma imagem, o documento reconhece isso, e a regra fica em *"o véu é
  obrigatório, não opcional"* — sem alvo. *Conserto:* declarar o mínimo que o véu tem de
  garantir na região mais clara da foto.
- **[baixo]** **`on-accent-dark` é o único token com par escuro.** Nenhum outro tem, e o
  documento declara (corretamente) que o escuro pertence ao resolvedor. Um par solitário
  sugere uma convenção que o arquivo não segue; ele também não é referenciado por
  componente nenhum (`caderno-faixa.foreground` aponta só para `{colors.on-accent}`).
- **[baixo]** **Órfãos no frontmatter.** Nunca referenciados: `bg`, `surface`, os quatro
  `*-soft`, `rounded.sm/lg/2xl/3xl/pill` e quase toda a escala `spacing` (`xs`…`4xl`). Os
  `*-soft` existem apenas para serem proibidos no corpo — o que é informação, mas fica
  confuso num mapa de tokens usáveis.
- **[baixo]** **EXPERIENCE.md não tem uma única referência `{token}`.** O molde espera que
  ela cruze DESIGN por nome; ela cruza o documento, não os tokens. O piso de 44 px e o
  4,25 de `onAccent` aparecem como literais repetidos nos dois arquivos.

## 3. Cobertura de componentes — fraca

Nomeados: `capa`, `sumario-linha`, `caderno-faixa`, `caderno-texto`, `assinatura`,
`lapide-pe`, `lapide-do-mes`, `lua-entrada`, `lua-moldura`, `anuario-tira`, `parede-capa`
(frontmatter) + Postal (corpo) + Botão de imprimir, Painel Diagramação e fase sinódica
(prosa). Sete deles têm buraco de um lado ou dos dois.

### Achados

- **[alto]** **O botão de imprimir não tem especificação visual.** Tem linha em
  EXPERIENCE §Component Patterns e **nenhuma** em DESIGN — nem no frontmatter, nem no
  corpo. É a única ação paga do produto e o gesto de que depende a restrição *"a revista
  nunca gera sozinha"*. *Conserto:* linha em DESIGN.Components dizendo onde fica (capa? pé
  da tela?), forma e se usa `primary`.
- **[alto]** **A fase sinódica desenhada não tem especificação em lugar nenhum.** É citada
  em DESIGN §Moldura da lua, em EXPERIENCE (jornada 3, passo 3) e no memlog, sempre em uma
  frase. Sem tamanho, sem cor, sem o que a fatia destacada representa graficamente, sem
  comportamento. É o objeto visual mais novo do desenho inteiro. *Conserto:* linha própria
  nas duas seções.
- **[médio]** **Capa e Moldura da lua não têm linha em EXPERIENCE §Component Patterns.** A
  capa é tocável? Tem paralaxe na rolagem? A moldura rola com a página ou fixa? *Conserto:*
  duas linhas na tabela, mesmo que a regra seja "estático, não tocável".
- **[médio]** **O Postal não tem anatomia.** Está no corpo de DESIGN.Components mas fora do
  `components:` do frontmatter, e sua única regra é "acromático". O contrato lhe dá capa
  pequena, três fatos e só trajetória — nada disso tem forma. *Conserto:* entrada no
  frontmatter e anatomia no corpo.
- **[médio]** **O painel Diagramação e o "olho" só existem em prosa.** É a superfície
  inteira de CAP-14 (a única forma de o leitor discordar da revista) e não tem linha em
  nenhuma das duas seções de componentes. *Conserto:* especificar o delta — o que sai, o
  que fica, como o caderno silenciado se lê.
- **[médio]** **O ícone de Movimento não vem do `ICON_MAP`, e o `ICON_MAP` não tem
  bicicleta.** DESIGN §Faixa de caderno afirma *"ícones herdados do `ICON_MAP` que a
  Retrospectiva já usa: … bicicleta (Movimento)"*. O mapa real
  (`mobile/src/app/retrospectiva/index.tsx:70`) tem `workout: 'barbell-outline'` e
  `distance: 'walk-outline'` — nenhuma bicicleta. Além do erro de fato, Movimento cobre
  corrida e caminhada (`RetroSports`, `cadernos.md`); a bicicleta nomeia um esporte só, e o
  ícone é o segundo portador da identidade em cinco das seis paletas. *Conserto:* escolher
  um ícone que cubra o caderno e corrigir a alegação de herança.
- **[baixo]** **O cabeçalho de sub-página da lua não é especificado.** *"Ela herda a cor do
  Sono no cabeçalho"* é tudo o que existe sobre um componente que a página inteira usa.
- **[baixo]** **Nomes invertidos entre frontmatter e corpo.** `parede-capa` × "Capa da
  parede", `caderno-texto` × "Texto do caderno", `lua-entrada` × "Entrada da lua",
  `sumario-linha` × "Linha de sumário". A convenção do frontmatter é consistente e
  mapeável, mas o molde pede nomes idênticos.

## 4. Cobertura de estados — fraca

A tabela de §State Patterns cobre sete estados da edição (em curso, fechado-não-escrito,
escrevendo, pronta, reprovada, errata, erro) e é boa: o "em curso" como **ausência**, e não
como botão desabilitado, é a decisão certa e está justificada. O problema é que só uma das
superfícies da arquitetura de informação foi percorrida.

### Achados

- **[alto]** **O Arquivo não tem estado nenhum.** É uma grade de até 436 capas, várias
  delas apontando para a biblioteca de fotos do iPhone. Faltam: carga fria, capa cuja
  imagem não carrega (o repositório já registra `ph://` que não carrega, na frente de
  fotos), permissão de biblioteca revogada, e o arquivo vazio antes do primeiro backfill.
  *Conserto:* tabela de estados própria para o Arquivo.
- **[alto]** (ver C6) **Falta o estado "antes da primeira execução" da página da lua.**
- **[médio]** **O estado "reprovada" precisa ser por caderno, explicitamente.** A tabela é
  por edição; a chave, a errata e o indicador de "escrevendo" já são por caderno, e a
  jornada 2 mostra três cadernos impressos e um reprovado. Só a errata está declarada como
  por-caderno. *Conserto:* dizer que a tabela inteira é por caderno.
- **[médio]** **Postal e anuário não têm estados enumerados.** O postal tem dois modos
  (três fatos / prosa efêmera) e nenhum "escrevendo", "erro" ou "sem rede". O anuário não
  diz o que faz no ano em curso. *Conserto:* uma linha por forma.

## 5. Referências visuais — forte

Os quatro arquivos de `mockups/` estão ligados inline, cada um na seção que ilustra e com o
que ilustra nomeado — e com geometria medida (*"capa 0–380, sumário 380–803, a dobra dos
844 corta a faixa 41 px depois"*), o que é acima do exigido. Nenhum órfão. `imports/` está
vazio. A regra de precedência está declarada uma vez em cada arquivo, no blockquote de
abertura.

### Achados

- **[baixo]** **EXPERIENCE liga 2 dos 4 mockups.** `key-formas.html` (as três formas) não é
  ligado de §Information Architecture, que é exatamente onde as três formas vivem; e
  `key-arquivo.html` não é ligado da jornada 4, que é a jornada do arquivo. As duas seções
  que mais precisam da referência são as que não a têm.

## 6. Inchaço — adequada

DESIGN carrega voz editorial e tem direito a ela; a densidade das tabelas de medição (ΔE
nas 216 combinações, `onAccent`) é rationale de decisão que sustenta peso, não decoração. O
problema está no outro arquivo.

### Achados

- **[médio]** **Boa parte de EXPERIENCE é o contrato redigitado.** A tabela "Ausência
  declarada", o parágrafo da lápide-uma-vez-só, as três invariantes de impressão e quase
  toda a §Disciplina de pré-registro reproduzem `bases-e-ranqueamento.md`, `spec.md` e a
  ADR 0045 quase palavra por palavra. É protetor no curto prazo e é risco de deriva no
  primeiro dia em que o contrato mudar. *Conserto:* citar por referência onde a regra é
  literalmente do contrato, e reservar a prosa para o que a UX decidiu.
- **[médio]** **Regras duplicadas entre as duas espinhas.** *"O anuário não tem capa"*, *"a
  lápide vira capa uma vez só"* e a parede de duas colunas aparecem nos dois arquivos com
  palavras quase iguais. Duas cópias divergem na primeira edição. *Conserto:* uma dona por
  regra — forma em DESIGN, condição em EXPERIENCE.
- **[baixo]** **Valores fora de qualquer escala.** `anuario-tira.altura: 34px` e `lapide` a
  12,5 px não pertencem à escala do app nem à rampa tipográfica (todo o resto é inteiro).

## 7. Forma — forte

DESIGN.md tem as oito seções canônicas na ordem travada: Brand & Style → Colors →
Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts.
EXPERIENCE.md tem as oito obrigatórias: Foundation, Information Architecture, Voice and
Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key
Flows.

**Responsive & Platform** foi corretamente omitida (superfície única declarada; web é
não-objetivo).

**As três seções inventadas ganham o lugar delas**, e cada uma diz por que existe na
primeira linha: *Ausência declarada* (*"atravessa três padrões e é onde a revista mais
facilmente mentiria"*) é a mais bem justificada das três; *Impressão e congelamento* aloja
a regra do dinheiro, que não caberia inteira em nenhuma das oito; *Disciplina de
pré-registro na tela* aloja o que a ADR 0045 obriga a interface a fazer e nenhuma outra
tela do app faz. Nenhuma é redundante com as canônicas.

### Achados

- **[baixo]** **Inspiration & Anti-patterns está disparada e ausente.** Há produto de
  referência (a revista impressa; o `EdicaoCard` em produção) e rejeitados **medidos**: a
  faixa em `soft` (ΔE 0,8, 216/216 colados), `on` sobre `accent` (1,00–1,28), o precedente
  "bloco preenchido não é destaque", o negativo em nota de rodapé (rejeitado na ADR). O
  material existe e está bem colocado; falta a seção que o reúne para quem só ler uma vez.

## Notas mecânicas

- **A contagem de restrições do contrato é 17, não 16.** O memlog e o enquadramento da
  sessão dizem 16. As 17 estão listadas acima; provavelmente as duas últimas ("o backfill
  pagina" e "verifica antes de gravar") foram lidas como uma. Sem consequência para o
  desenho, mas quem for auditar cobertura deve usar 17.
- **A moldura da lua tem quatro campos no contrato, não cinco.** CAP-12 enumera janela,
  desfecho, contagem de noites e ciclos, próxima leitura — e cita o contador
  separadamente. O memlog conta *"cinco campos … mais o contador"*, e é sobre essa
  enumeração tratada como fechada que se apoia a exclusão da covariável (achado C10).
- **`sources:` de DESIGN.md omite `mudancas-mecanicas.md`**, embora o documento afirme *"a
  capa não ganha coluna no banco"*, que vem de lá. EXPERIENCE.md lista os cinco.
- **A legenda do painel Diagramação perde as duas frases, não uma.** EXPERIENCE (herdando
  `mudancas-mecanicas.md`) diz que muda *"a segunda frase"*. A primeira, em
  `retrospectiva/index.tsx:738`, é *"Esconda o que não usa **e mova o que usa para
  cima**"* — a segunda oração também descreve a regra aposentada.
- **Todos os `{caminho.do.token}` resolvem**; todos os caminhos de código citados existem
  (`sleep/colors.ts`, `EdicaoCard.tsx`, `retrospectiva/index.tsx`); todos os `sources:`
  resolvem. Nenhuma referência quebrada no par.
- **Observação registrada no memlog e fora destas espinhas, mantida aqui para não se
  perder:** `retrospectiva/index.tsx:74` tem `TONE_COLOR` com hex cravado (`#6FA86A`,
  `#D9491B`) — contra a regra que DESIGN §Don'ts reafirma.
