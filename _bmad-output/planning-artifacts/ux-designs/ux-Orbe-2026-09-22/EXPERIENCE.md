---
name: Motores — o modelo como objeto
description: Arquitetura de informação, comportamento, estados, interações e jornadas da tela de Motores redesenhada. Par do DESIGN.md, que é dono da aparência.
status: draft
updated: 2026-09-23
design: DESIGN.md
sources:
  - .memlog.md
  - review-edge-case.md (lente de caso de borda, 22/09 — os achados aplicados nesta versão)
  - https://claude.ai/artifact/YFsPB8F89eH74GWDr8m1b7 (mockups aprovados 22/09, relidos na versão 10)
  - ~/Orbe-dados/progresso-da-compilacao-2026-09-22.md (a compilação não emite fração — medido em 22/09)
  - ../../../../mobile/src/app/configuracoes/motores/index.tsx
  - ../../../../mobile/src/app/configuracoes/motores/bancada.tsx
  - ../../../../mobile/src/lib/motores/catalogo.ts
  - ../../../../mobile/src/lib/motores/preferencia.ts
  - ../../../../mobile/src/lib/motores/amostra.ts
  - ../../../../mobile/src/lib/motores/amostras.ts
  - ../../../../mobile/src/lib/motores/amostras-regras.ts
  - ../../../../packages/shared/src/sleep/leitura.ts
  - ../../../../packages/shared/src/ia/retrospectiva.ts
  - ../../../../packages/shared/src/routes/descritor.ts
  - ../../../../docs/decisions/0047-a-porta-do-motor-e-uma-so-e-a-ponte-do-aparelho-e-nossa.md
  - ../../../../docs/decisions/0048-o-motor-e-escolhido-por-aparelho-e-a-lista-da-nuvem-e-do-servidor.md
  - ../../../../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md
---

> **Espinha de comportamento.** Par do [`DESIGN.md`](DESIGN.md), que é dono de *como se
> parece*; este é dono de *como funciona*. Os dois vencem qualquer mockup em conflito, e
> há conflitos — cada um está nomeado no lugar em que aparece. Nenhum dos dois redecide o
> contrato dos motores, que continua nas ADRs 0047–0050.

## Foundation — o chão

**Formato:** iPhone, retrato. Superfície única. A web fica de fora por definição: a
escolha de motor é **propriedade do aparelho** (AD-8), mora no `AsyncStorage` e não
sincroniza — um navegador não tem ponte, não tem pesos e não tem o que escolher.

**Onde mora:** `/configuracoes/motores`, com a subárvore que este redesenho cria. A
família inteira é acessível por `Configurações → Motores` e por mais nenhum lugar. Nada
aqui aparece numa tab.

**Sistema de interface:** o do próprio app — Expo Router, `ScreenHeader`,
`useThemedStyles`, tema de eixos. `Animated` do React Native; **Reanimated não se usa**
(ADR 0010).

**Usuário: um.** Sydnei é o dono do aparelho, o autor das medições e o leitor dos
resultados. Boa parte do desenho abaixo existe porque essas três pessoas são a mesma — não
há administrador remoto para explicar por que uma escolha desapareceu, e não há suporte
para perguntar.

**O estado de verdade não é desta tela.** A disponibilidade de um motor vem do
diagnóstico da ponte (`EstadoDaPonte`), a lista de nuvem vem do servidor
(`ListaAprovada`), o bloqueio por recurso vem de `motivoDeBloqueio`, quem de fato
escreveria agora vem de `resolverCadeia` — e **se um modelo está compilado vem de
`isCached`**, nunca de uma constante, de um carimbo guardado ou do que a tela pintou da
última vez. A tela **mostra** esses fatos; ela não os decide. Onde ela discordasse do
orquestrador, ela estaria mentindo.

Essa última é a regra mais cara desta família e ela tem uma seção própria — ver
*O estado nasce de `isCached`, nunca do desenho*. Ela existe porque a suposição contrária
("todo build nasce não compilado") estava escrita em três lugares e é **falsa**: o cache
é particionado por build do **iOS**, não do app.

## O que a tela de hoje faz, e o que muda

Isto é o delta contra `mobile/src/app/configuracoes/motores/index.tsx` e `bancada.tsx` no
estado do fim de 22/09 (worktree `life-organizer-wt-motores-5-7`, branch
`spike/qwen3-4b-iphone`, `da73f3e`). **A noite de 22/09 moveu quatro linhas desta tabela**,
e elas estão marcadas: o que era fiação a inventar virou código a vestir.

| Hoje | Depois | Por quê |
|---|---|---|
| **Uma seção por recurso**, e dentro dela **todos** os motores como cartões com círculo de marcação. Com 3 recursos × 5 motores = 15 cartões, empilhados. | **Uma linha por recurso**, mostrando só quem escreve. A lista completa vive numa folha que abre ao tocar a linha. | A lista de recursos vai crescer (nome de rota, edição de imagem, avaliar atividade, registros, hábitos) e a de modelos também. Hoje o produto é `recursos × motores`; depois é `recursos + motores`. |
| **A lista de modelos já existe** (`PESOS_ABERTOS`, N entradas, com diagnóstico **por modelo** via `estadoDoPesoAberto`). O que não existe é o modelo como **objeto de tela**: ele é um id com rótulo, repetido em cada seção. | O modelo tem **página própria**: tamanho instalado + compilado, data e duração da compilação, janela, onde está em uso, e a ação de apagar com o preço declarado. | O catálogo deixou de ser de um peso só na mesma noite em que o iPhone provou o segundo. A página é o que falta para "quanto isto me custa e o que eu ganho" ter onde ser respondido. |
| Não há estado de **instalação/compilação**. `EstadoDaPonte` só sabe `ausente / fora-do-ios / consultando / lido`. | Cada modelo na lista mostra `compilado` ou `instalado, não compilado`, com tamanho — **lido de `isCached` na montagem**, nunca suposto. `compilando` não é estado de lista. | A primeira chamada de um peso aberto leva 11–15 min. Sem esse estado, isso é uma leitura que trava sem explicação. E `isCached` responde em ~0,5 ms **antes** de começar — o estado é barato de saber, e caro de supor: o cache é particionado por build do **iOS**, então um build novo pode nascer compilado. |
| A compilação **não tem lugar**. Ela acontece dentro da primeira chamada, e a Bancada avisa em prosa que "o prazo dele é de 45 min, não de 1". | **Tela própria**, com **cinco fases** (*correndo · terminou · parada · falhou · interrompida*): relógio, faixa indeterminada, **uma** etapa, o aviso de que sair interrompe, e um "parar" que não apaga nada. | A decisão de 22/09: a espera vira ato deliberado, nunca surpresa no meio de uma leitura. E a de 23/09: sair interrompe, então a tela tem de dizer isso antes e ter um fim escrito para cada saída. |
| A **Bancada já mede as três leituras** (`8225370`), com fonte de amostra por recurso em `amostras.ts` e as duas regras puras testadas em `amostras-regras.ts`. Ela continua sendo uma tela de desenvolvimento: PeriodNav, botão, cartão de amostra separado. | Vira **Comparar**: escolhe a leitura, a amostra e quem entra; um só caminho. | O requisito do dono de 22/09 **já foi atendido no motor**; o que resta é a arquitetura de informação da tela, não a fiação. |
| **Quem entra na corrida** já virou chips — um por motor, a régua fixa e não desligável, os pesos abertos nascendo fora, o conjunto guardando **quem está de fora**. | Fica como está, e ganha contrato escrito (§ *Quem entra na corrida*). | A caixinha tudo-ou-nada anterior não sobrevive a N modelos. O código chegou lá primeiro; esta espinha o especifica em vez de o reinventar. |

**O que não muda:** a preferência continua por aparelho e no `AsyncStorage`; o motivo de
bloqueio continua vindo de `motivoDeBloqueio` (agora por `ehPesoAberto`, não por um id
único); a lista de nuvem continua do servidor; o recurso continua vindo de
`CATALOGO_DE_RECURSOS` (e um recurso novo sem nome em português continua não compilando —
e, desde 22/09, também não compila sem **fonte de amostra**, porque `POR_RECURSO` é
fechado sobre `RecursoId`).

**E uma correção que veio de medir, não de desenhar:** `verificarTexto` passou a mascarar
as datas do próprio período também no formato `14/09`. O cabeçalho do caderno é
`# 14/09 - 20/09`, e todo motor que o repetia era reprovado por quatro números que o pacote
lhe deu. Medido no iPhone com os dois pesos abertos: **metade da reprovação era nossa**. A
tela de Comparar herda isso de graça, e é a razão de um "recusada" na Comparação valer mais
hoje do que valia ontem.

## Information Architecture — arquitetura de informação

Cinco telas vivas e uma parada.

```
/configuracoes/motores                    Motores          a tela raiz
  ├── (folha)  escolher/[recurso]         Escolher         quem escreve esta leitura
  ├── modelo/[id]                         Modelo           a ficha de um modelo
  ├── compilar/[id]                       Compilando       o ato pago
  └── comparar                            Comparar         (era Bancada)

  ✖ instalar                              Instalar         parada — não existe no app
```

**As duas rotas com parâmetro não abrem em branco.** `modelo/[id]` e `compilar/[id]`
recebem um id cru, e um id que **este build não traz** é o caso normal, não o exótico: o
dono chega por um link de rascunho, por um estado restaurado pelo Expo Router depois de o
iOS encerrar o app, ou por um build antigo que embarcava um peso que o novo não embarca.
As duas resolvem o id contra `pesoAbertoDe` **antes de desenhar qualquer coisa** e, quando
ele não existe, mostram uma tela com uma frase e o caminho de volta — *este build não traz
o modelo `<id>`* —, nunca um título vazio com um relógio zerado. `compilar/[id]` em
particular **não começa nada** nesse caso: a tela que compila ao abrir é a mesma que tem de
se recusar a abrir para um modelo que não está aqui.

### A tela raiz tem três blocos, nesta ordem

**1 · Modelos no aparelho.** Cabeçalho em `{typography.secao}` com a contagem e o total em
`{typography.medida}` (`2 neste build · 2,4 GB`). Abaixo, uma
`{components.lista-de-modelos}`: um cartão único com uma `{components.linha-de-modelo}`
por modelo, cada uma abrindo a ficha dele. Um modelo instalado e não compilado carrega o
`{components.botao-pilula}` **Compilar** em vez do chevron.

**O total é uma soma, e ela pode ser parcial.** Os tamanhos de hoje — 1,3 e 1,34 GB do
Qwen3, 1,1 e 1,14 GB do Tucano2 — foram **medidos à mão em 22/09** e vivem ao lado do
modelo no catálogo, não num cálculo. Logo um modelo novo entra em `PESOS_ABERTOS` **sem
número**, e a regra da voz vale aqui como em todo lugar: a linha dele diz *tamanho não
medido*, e o cabeçalho soma só o que tem medida e declara o resto —
`3 neste build · 2,4 GB (1 sem medida)`. Um total que engolisse o modelo sem número
mentiria justamente sobre o único assunto desta seção. (Enquanto o app não ler o tamanho do
disco, esta é a forma honesta; quando ler, o parêntese some sozinho — ver *Onde a
informação nasce*.)

**2 · Modelos na nuvem.** A mesma forma, lista mais curta, e um rodapé que diz de onde ela
vem: *Esta lista vem do servidor: modelo novo aparece aqui sozinho, sem atualizar o app*
(ADR 0048). Estas linhas **não abrem ficha** — não há tamanho, não há compilação, não há o
que apagar. Elas existem para que a lista de motores seja uma coisa só aos olhos do dono.

**3 · Quem escreve o quê.** Uma linha por recurso de `CATALOGO_DE_RECURSOS`, com o nome da
leitura em `{typography.nome}` à esquerda e o motor efetivo à direita. Tocar abre a folha.

E, abaixo dos três, a linha **Comparar** — um `{components.cartao}` solto, sem seção, com
o mesmo alvo de 44 pt das linhas de lista.

O topo da tela raiz é o `{components.titulo-de-pagina}`: "Motores" em
`{typography.titulo-pagina}`, à esquerda, com *Quem escreve cada coisa, neste aparelho.*
em `{typography.subtitulo}` embaixo. **O título mora no conteúdo, não no cromo** — as
telas de pilha usam o `{components.cabecalho-de-pilha}`, cujo rótulo é o nome da tela
**anterior** ("Motores"), e repetem o título grande como primeiro bloco de conteúdo. Isso
é uma mudança contra o `ScreenHeader` de hoje, que centraliza o título da tela atual;
`ScreenHeader` ganha a variante, ou a família escreve o seu.

**Por que o modelo vem antes da leitura.** A ordem contrária seria a mais óbvia — primeiro
o que o app faz, depois com o quê. Mas a pergunta que traz Sydnei a esta tela em 2026 é
"o que eu tenho instalado e quanto está custando", não "quem escreve a Retrospectiva". O
inventário é o assunto; a atribuição é a consequência.

### A folha de escolha agrupa por onde roda

Três grupos, sempre: **Sem modelo** · **No aparelho** · **Fora do aparelho**. É exposição
crescente, e é a mesma ordem do recuo de `resolverCadeia`. Com N modelos só o grupo do
meio cresce.

O cabeçalho da folha diz **o que esta leitura é**, em uma linha, e a linha inclui a
propriedade que governa tudo o mais: *Uma frase por leitura. Esta não grava nada — por
isso aceita qualquer motor.* Para a Retrospectiva e o nome de rota, a frase é a oposta, e
ela explica por que faltam opções ali.

### Onde a informação nasce

| O que a tela mostra | De onde vem | Existe hoje? |
|---|---|---|
| lista de recursos | `CATALOGO_DE_RECURSOS` | sim |
| nome do recurso em português | `NOME_DO_RECURSO` (Record fechado) | sim |
| lista de motores por recurso | `motoresDoRecurso(recurso, pontes, lista)` | sim |
| quem escreveria agora | `resolverCadeia(descritor, escolhido, ids)[0]` | sim |
| por que um motor não dá | `motivoDeBloqueio(...)` | sim |
| disponibilidade do aparelho | `ponteDoAparelho` / `estadoDosPesosAbertos` | sim |
| lista de nuvem | `garantirListaAprovada()` (ADR 0048) | sim |
| **amostra por recurso** | `amostras.ts` — uma fonte por recurso, fechada sobre `RecursoId` | **sim**, desde 22/09 |
| **diagnóstico por modelo** | `estadoDoPesoAberto(pontes.coreai, pesos)` | **sim**, desde 22/09 |
| **tamanho instalado de um modelo** | ao lado do modelo no catálogo, medido à mão (1,3 e 1,1 GB) | **não** no app — e modelo novo entra sem número |
| **tamanho do compilado** | idem, medido à mão (1,34 e 1,14 GB) | **não** no app — idem |
| **estado compilado / não compilado** | `isCached`, relido na montagem e ao focar | **não** — a ponte ainda não o devolve |
| **a janela do modelo** (`4.096`, `8.192`) | `detalheDoAparelho(ponte)` — o diagnóstico devolve `janela`, e o catálogo a formata | **sim**, para o modelo do sistema |
| **a janela de um peso aberto** | — | **não** — o diagnóstico do Core AI não a devolve hoje |
| **"raciocínio longo desligado"** | `PesoAberto.descricao`, escrito no catálogo | **sim**, como prosa — não como campo |
| **progresso da compilação** | não existe em camada nenhuma do iOS 27 | **não, e nunca vai haver** |
| **estimativa de quanto vai levar** | só o carimbo de uma compilação já feita **neste aparelho** | **não** — nada é guardado hoje |
| **data e duração da última compilação** | os carimbos do `coreai-cache` | **não** — lidos à mão em 22/09 |
| **medianas medidas por motor** | parcialmente (`bancada/`) | **parcial** |

A tabela virou de cabeça para baixo na noite de 22/09: as duas primeiras linhas eram
"parcial" e hoje são fato, e a única linha que continua irrespondível é a do **progresso** —
não por falta de trabalho, mas porque a resposta é não. As demais são fiação nova, e é o
tamanho real do que falta.

**As três últimas linhas entraram nesta revisão**, e entraram porque a ficha do modelo já
mostrava dois valores que não estavam aqui: a **janela** (`4.096 tokens`) e o
**raciocínio longo desligado**. Uma vem do diagnóstico e pode ser mostrada; a outra é
prosa do catálogo e só pode ser dita como prosa. E a janela de um **peso aberto** não vem
de lugar nenhum hoje — o diagnóstico do Core AI não a devolve —, então a ficha de um peso
aberto **não tem essa linha**, em vez de ter um número que ninguém mediu. Era exatamente
esse o buraco: um número autorado na tela cuja família existe para não autorar números.

## Voice and Tone — voz

A tela fala como uma ficha técnica escrita por alguém que respeita o leitor.

**Afirma fatos, com número quando há.** *compilado · 2,6 GB*. *de ~11 min*. *7,1 s*. Onde
não houve medição neste aparelho, **não há número** — a frase é *Ainda não medido*, e ela
é um convite a medir, não um valor estimado.

**Diz o preço antes do ato, não depois.** *Compilar leva minutos*. *Remover devolve o
compilado; refazê-lo custa 15 minutos*. Um botão que esconde o custo é uma armadilha para
alguém que vai apertá-lo enquanto anda na rua.

**Explica com a causa, nunca com o rótulo.** Jamais *indisponível*: sempre *este recurso
não guarda o que a nuvem escreve*, *o peso aberto é uma prova de caminho, e só a Saúde do
sono a mostra*, *Apple Intelligence desligada*. O catálogo já escreve assim; a tela não
pode rebaixar isso a um ícone cinza.

**Não vende, não elogia, não motiva.** Não há "o mais rápido!", não há estrela, não há
recomendado. Sydnei decide olhando medida.

**Usa o vocabulário dele, e só esse.** **Instalar** é baixar o modelo. **Compilar** é
prepará-lo para o chip. Os dois são atos distintos e nunca se chamam pelo nome do outro. A
palavra "modelo" é do modelo; "motor" é a coisa que escreve, e um motor pode não ter
modelo nenhum (o template).

**Nomeia modelos, não fornecedores.** *Modelo do aparelho*, não *Apple*. A versão 10
consertou dois dos três escorregões — a linha *Nome de rota* na raiz e o chip de "quem
entra" na Comparação já dizem `Modelo do aparelho` — e **sobrou um**: a frase
*"Comparar com o template, a Apple e a nuvem"* na ficha do modelo. O catálogo diz
`Modelo do aparelho`, e é ele que ganha. (Dizer *"da Apple"* como
**procedência**, na linha de detalhe da opção, é outra coisa e pode ficar: ali a palavra
responde "de onde vem este modelo", não "como ele se chama".)

**A microcópia do padrão foi corrigida na tela, e o núcleo não mudou.** O rodapé antigo
prometia *"Leitura nova começa em Sem modelo, até você escolher"*, o que era falso para
duas das três leituras. A versão 10 escreve o que os descritores fazem: *Cada leitura começa
onde o código manda — o sono, no template; as outras, na nuvem — até você escolher.*
**Decisão do dono, 22/09:** conserta-se a frase, não a `cadeiaPadrao`. Os padrões reais,
lidos dos descritores:

| Leitura | `cadeiaPadrao` | Grava? |
|---|---|---|
| Saúde do sono | `[sem-modelo]` | não |
| Retrospectiva | `[nuvem:padrao, sem-modelo]` | sim, e só a nuvem pode |
| Nome de rota | `[nuvem:padrao, sem-modelo]` | sim, nuvem e aparelho |

Cada linha da tela diz **onde a sua leitura começa**, e o rodapé só resume as três. A
promessa mais forte — "tudo começa em Sem modelo" — está **descartada**: ela exigiria mexer
na `cadeiaPadrao` do núcleo, e a consequência real seria a Retrospectiva deixar de escrever
sem uma escolha explícita do dono. Ele leu isso e escolheu a frase.

## Component Patterns — comportamento dos componentes

### Linha de modelo

Toque na linha → abre `modelo/[id]`. Toque no botão **Compilar** → abre `compilar/[id]`,
e a compilação **começa ao abrir**, não por um segundo toque: o botão na lista já foi o
consentimento, e uma tela com um botão "começar" no meio seria um segundo pedágio para a
mesma decisão.

**O botão Compilar só existe onde há o que compilar.** Uma linha em `compilado` não o
carrega — ela carrega o chevron da ficha. É uma regra de *não oferecer*, não de recusar
depois: um botão que recompilasse o que já está compilado cobraria quinze minutos por um
toque que não mudaria nada, e é o tipo de dano que um gesto de dedo entrega sem aviso.
Apagar o compilado continua existindo, com o preço declarado, no pé da ficha — é lá que a
decisão de refazer se toma.

**E ele fica inerte quando outra compilação está em curso.** Ver *Um modelo de cada vez*.

**Nenhuma linha desta lista diz "compilando".** Esse estado só existe dentro de
`compilar/[id]`, e a razão é a decisão do dono de 23/09: sair da tela interrompe. Uma linha
que anunciasse trabalho em curso estaria prometendo o que ninguém garante, justamente no
lugar de onde o dono acabou de sair.

### Linha de recurso

Toque em qualquer ponto → abre a folha daquele recurso. O valor à direita é **quem
escreveria agora**, resolvido por `resolverCadeia`, não o que foi tocado por último: se o
dono escolheu a nuvem e o regime do recurso a recusa, a linha mostra o recuo, porque é
isso que vai acontecer.

Um recurso que a camada não hospeda (`HOSPEDAGEM[x].hospedado === false`) aparece
**com o motivo e sem chevron**. Hoje os três estão ligados e esse caso não ocorre; o
comportamento existe para o quarto recurso não nascer mudo.

### Folha de escolha

A folha sobe sobre a tela raiz, que continua visível atrás sob o véu do
`{components.folha-de-escolha}`. Os três grupos usam `{typography.grupo}`; o título da
leitura usa `{typography.titulo-folha}`, e a linha que diz se ela grava usa
`{typography.subtitulo}`.

Escolher **fecha a folha imediatamente** e a linha na tela raiz já mostra o novo valor. A
gravação é otimista e **volta atrás se falhar** — o módulo de preferência rejeita de
propósito quando o armazenamento falha, e engolir isso deixaria a linha marcada na tela e
a escolha perdida no próximo arranque. Esse comportamento já existe e é para ser
preservado.

**E a volta atrás tem de ser vista.** Hoje ela é silenciosa: a folha já fechou, a linha
muda de valor sozinha atrás do dono, e do ponto de vista dele a escolha simplesmente não
pegou. Guarda: quando a gravação falha, a linha volta ao valor anterior **e diz por quê**,
no lugar do valor e até o toque seguinte — *não deu para guardar esta escolha*, em
`{typography.estado}` e `{colors.ink2}`. Não é alerta e não é modal: a folha já se foi, e
um alerta perguntaria algo a quem não pediu nada. É a mesma regra de sempre — a tela mostra
o que o orquestrador faria, e o que ele faria é escrever com o motor de antes.

A opção escolhida é a variante `selecionada` do `{components.opcao-da-folha}` — borda em
`{colors.primary}` e tique, **não** fundo preenchido.

**A folha marca quem escreveria agora**, resolvido por `resolverCadeia`, e não o id que
está gravado. Os dois coincidem quase sempre; quando não coincidem, é porque a preferência
aponta para um motor que **sumiu** — um peso aberto que o build novo não embarca, uma
variante de nuvem que o servidor despublicou. Nesse caso uma opção fica marcada (a do
recuo) e nada explica a troca. Guarda: a folha diz a troca em uma linha, abaixo do
subtítulo — *o motor que você escolheu não está neste build; esta leitura voltou para
`<nome>`*. A preferência gravada **não é apagada** por isso: se o modelo voltar num build
seguinte, a escolha dele volta junto, e apagá-la agora seria decidir por ele.

Uma opção bloqueada **não responde ao toque** e é anunciada como desabilitada, com o
motivo dentro do rótulo acessível. Ela usa a variante `bloqueada`
(`{colors.surface-mute}`) com o motivo em `{typography.estado}` e em `{colors.ink2}` —
**nunca em vermelho**: um motor bloqueado é propriedade do recurso, não erro do dono. (E
nunca em `{colors.ink3}`: o motivo é informação obrigatória, e `ink3` não paga 4,5.)

Uma opção "consultando" é **ocupada, não indisponível**: ela é anunciada `busy` com o
próprio rótulo, porque um diagnóstico a caminho não é a mesma coisa que um motor que não
existe. **E ocupada também não responde ao toque.** Um diagnóstico a caminho pode voltar
`ausente`, e gravar a preferência antes da resposta escreveria a escolha de um motor que o
próprio diagnóstico vai recusar meio segundo depois — a linha da raiz mostraria o recuo, a
folha mostraria a marca, e as duas estariam certas dizendo coisas diferentes. O código de
hoje já bloqueia (`motivoDeBloqueio` devolve `MOTIVO_CONSULTANDO`); a espinha estava
frouxa e passa a dizer o que o código faz.

**No grupo "Sem modelo", a opção diz o que ela é naquela leitura.** Na Saúde do sono ela é
o template, e a linha de detalhe é a neutra — *instantâneo · sempre igual · nada sai
daqui*. Nas outras duas ela é uma **lápide**, e repetir ali a frase neutra ofereceria como
alternativa o que os descritores declaram como ausência. A linha de detalhe passa a ser o
que o `semModelo` daquele descritor devolve: *a revista não imprime sem modelo* ·
*sem modelo não há região a nomear: o percurso fica com o nome da fonte*. A opção continua
no grupo e continua sendo o último degrau da cadeia — o que muda é ela parar de se anunciar
como escolha equivalente.

**Nenhuma opção da folha diz "compilando"** — mesma razão da linha de modelo. Um peso
aberto que este aparelho ainda não compilou aparece como `instalado, não compilado`, com o
`{components.botao-pilula}` **Compilar** ao lado, e o toque nele **fecha a folha** antes de
empurrar `compilar/[id]` (o iOS não empilha três camadas — ver a atenção de implementação
abaixo).

O CTA no pé da folha — *Comparar os N nesta janela* — leva a `comparar` **já com a
leitura preenchida**. O número é contado, nunca cravado.

**O atalho marca só quem já nasceria ligado** — decisão do dono, 23/09. Chegar por ali é
idêntico a entrar em Comparar pela raiz: o template é régua, o modelo do aparelho e a
nuvem nascem dentro, e **os pesos abertos nascem fora**, mesmo que a folha de onde se veio
os estivesse listando. A regra "peso aberto nasce desligado" não tem exceção, e o atalho
não é uma. O porquê é o preço: cada peso aberto sobe mais de um gigabyte e é o elo mais
lento da corrida, e um atalho que os marcasse faria o dono disparar vários minutos de
medição sem ter ligado nada. O caso comum — template, aparelho e nuvem — responde em
segundos, e é ele que o atalho serve.

**E o número do rótulo conta as colunas que vão aparecer**, não as opções que a folha
lista: os motores marcados, mais a régua onde ela existe. Na Saúde do sono, com os dois
pesos abertos fora, são três — *Comparar os 3 nesta janela*. No nome de rota, sem régua e
com os pesos fora, são dois. Contar as opções da folha prometeria colunas que a corrida não
vai produzir, e é a mesma mentira do chip de régua onde não há régua.

**Atenção de implementação:** o iOS não empilha três modais; navegar para `comparar` a
partir de uma folha exige fechar a folha primeiro e só então empurrar a rota, ou a terceira
camada não aparece. É um achado pago na frente de fotos e ele se aplica aqui — e vale
igualmente para o `{components.botao-pilula}` **Compilar** dentro da folha.

### Chip da corrida

`accessibilityRole="switch"` com `checked`. Marcado entra; desmarcado não corre. Ver
§ *Quem entra na corrida* para o contrato completo.

## State Patterns — estados

### Na lista, um modelo tem dois estados — e "compilando" não é um deles

| Estado | Na lista | Como se sai dele |
|---|---|---|
| **instalado, não compilado** | anel vazado em `{colors.ink4}` · nome · `instalado, não compilado · 1,1 GB` em `{colors.ink3}` · `{components.botao-pilula}` **Compilar** | compilado, por uma compilação que **terminou** |
| **compilado** | tique + `compilado · 2,6 GB` em `{colors.feito-text}` · uso em `{colors.ink3}` · chevron | *instalado*, apagando o compilado — ou sozinho, ver *"Compilado" não é para sempre* |

Os dois usam o `{components.selo-de-estado}`, que **não preenche**: glifo mais palavra
sobre `{colors.surface}`. **Todas as linhas da lista têm uma altura só.**

**"Compilando" saiu da lista, e é decisão do dono de 23/09.** Sair da tela de compilação
interrompe a compilação; logo, no instante em que o dono está olhando para a lista, não há
compilação nenhuma acontecendo. Uma terceira linha de estado ali anunciaria um trabalho em
curso que ninguém garante — e o desenho anterior tinha essa contradição escrita duas vezes
(a lista e a folha mostrando `compilando` enquanto o aviso dizia que perder o foco mata).
A contradição morreu do lado da lista: `compilando` é estado **da tela** `compilar/[id]`, e
de mais nenhum lugar. A `{components.faixa-de-compilacao}` de 4 pt embutida na linha deixa
de existir junto.

Uma compilação que **não terminou** deixa rastro, e o rastro é uma frase, não um estado: na
volta, a linha diz `instalado, não compilado · a última compilação foi interrompida`, até
a próxima tentativa. É a diferença entre "nunca comecei" e "comecei e não acabou", e ela é
o que impede o dono de achar que o toque de quinze minutos atrás não fez nada.

### O estado nasce de `isCached`, nunca do desenho

**"Todo build nasce não compilado" é falso**, e estava escrito como fato em três lugares
desta família. O cache do Core AI é particionado por **build do iOS**, não por build do
app: instalar um app novo sobre o mesmo sistema abre com os modelos **já compilados**, e o
dono não espera nada. A espera só volta quando o **iOS** muda.

Portanto:

- **Na montagem**, cada linha pergunta `isCached` e pinta o que a resposta disser. Nunca
  uma constante, nunca o valor de antes, nunca "acabou de instalar, então não".
- **Ao focar a tela e ao voltar ao primeiro plano**, pergunta de novo — pela mesma razão
  que o diagnóstico da ponte é relido: o dono pode ter atualizado o sistema, o iOS pode ter
  purgado o cache, e nesses dois casos o número do cabeçalho **cai sozinho**.
- A pergunta é barata: `isCached` responde em ~0,5 ms. Não há motivo de desempenho para
  guardar a resposta, e guardá-la é exatamente como se produz a mentira.
- **O que é guardado é só o carimbo** — data e duração de uma compilação que terminou
  aqui. Ele alimenta a frase *da última vez levou N minutos* e **não** decide o estado. Um
  carimbo sem `isCached` é uma lembrança, não uma promessa.

E o corolário que o dono lê: quando um modelo volta a `instalado, não compilado` sem
ninguém ter tocado em nada, **a tela diz por que**, em vez de deixá-lo achar que o app se
desfez. Ver *"Compilado" não é para sempre*.

### Um modelo de cada vez

Nada impedia tocar **Compilar** numa segunda linha com a primeira em curso, e dois modelos
de mais de um gigabyte disputando memória é **como o app morreu em 22/09**, com o Qwen3-4B.
A guarda é a mais simples possível: enquanto uma compilação corre, o **Compilar** das
outras linhas fica inerte, com a causa ao lado — *um modelo de cada vez* — e no rótulo
acessível. Não enfileira, não pergunta, não abre a outra tela.

Hoje a guarda é quase teórica, porque sair da tela já interrompe e não há duas telas de
compilação abertas ao mesmo tempo. Ela fica escrita porque o dia em que a compilação
sobreviver ao segundo plano (é a pergunta aberta nº 1) é o dia em que ela passa a ser a
única coisa entre o dono e um encerramento do app pelo iOS.

**"Não cabe" não é um estado que a tela possa prever.** O Qwen3-4B foi medido em 22/09 e o
iOS encerrou o app ao carregá-lo. Ele não está em nenhum build, e a memória do fato vive na
tela **parada** de Instalar, que é onde ela serviria para algo. Mas um build **pode**
embarcar um modelo que não cabe — foi um build que provou isso —, e nesse caso ele
**tem linha**: embarcado é instalado, e a lista mostra o que está no aparelho. O que a tela
não faz é adivinhar: ela não escreve "não cabe" antes de alguém ter medido, porque o único
instrumento disponível é o app sendo encerrado. O que ela mostra é o rastro — *a última
compilação foi interrompida* —, e é o dono quem lê duas dessas seguidas e conclui.

### A tela de compilação tem cinco fases, e todas terminam

Ela era a única tela da família sem fim escrito: começava a correr ao abrir e nada dizia
o que fazer quando parasse, falhasse ou fosse cortada pelo sistema. A espinha lhe dá uma
máquina de estados, e o nome de cada fase é o que a tela mostra.

| Fase | Entra quando | O que a tela mostra | Como sai |
|---|---|---|---|
| **correndo** | ao abrir, com `isCached` falso | relógio + faixa + a etapa única + a lembrança + o aviso + **Parar** | por `isCached` verdadeiro, por Parar, por falha ou por saída |
| **terminou** | `isCached` vira verdadeiro | `compilado · N min` com o tique, o tamanho novo, e **Voltar para Motores** | pelo caminho de volta |
| **parada** | o dono confirmou Parar (ou voltou pela borda) | *parada aos `M:SS` · o modelo continua instalado* e **Compilar de novo** | por Compilar de novo, ou voltando |
| **falhou** | a especialização devolveu erro | o motivo **em palavras** e **Tentar de novo** | idem |
| **interrompida** | o app reabre em `compilar/[id]` sem carimbo e com `isCached` falso | *a compilação foi interrompida* — **sem relógio e sem carimbo** — e **Compilar de novo** | idem |

Cinco regras governam a tabela, e cada uma fecha um caso que estava aberto:

1. **A fase é lida, não lembrada.** `isCached` é a única transição de saída para
   *terminou*: não há evento de conclusão, então o que existe é a pergunta feita em laço
   enquanto a tela está acesa. *Terminou* não é uma animação que acaba; é uma resposta que
   mudou.
2. **Só *terminou* carimba.** A duração e a data vão para o carimbo **exclusivamente**
   quando `isCached` vira verdadeiro. Parar aos três minutos num dia e compilar de verdade
   noutro não pode produzir *da última vez levou 3 min* — seria uma promessa falsa no lugar
   mais caro de dá-la, e é ela que o dono usaria para decidir se cabe no intervalo antes de
   sair.
3. **O motivo de *falhou* vem do vocabulário que já existe.** `MOTIVO_DO_COREAI_EM_PALAVRAS`
   traduz o que a ponte devolve — *este build não traz os pesos deste modelo*, *a pasta dos
   pesos veio neste build e não se lê* —, e um motivo que esta versão não conhece cai em
   `MOTIVO_COREAI_DESCONHECIDO`, que também é uma frase. Disco cheio e memória estourada
   chegam por esse caminho ou não chegam: a tela **não inventa** a causa, e a barreira de
   vocabulário do `architecture.test.ts` é o que garante que um motivo novo do lado Swift
   não vire silêncio do lado de cá.
4. **Sair é interromper, e a tela diz isso antes.** Decisão do dono, 23/09. O aviso deixa
   de pedir e passa a declarar a consequência: *Sair desta tela interrompe a compilação*.
   Ele fica acima do botão de parar, num `{components.cartao-de-aviso}`, e não enterrado no
   pé.
5. **O gesto de voltar custa o mesmo que o botão.** Deslizar da borda esquerda durante a
   fase *correndo* é, hoje, um caminho silencioso para jogar fora quinze minutos com um
   movimento de polegar. Enquanto a fase é *correndo*, o gesto é desligado
   (`gestureEnabled: false`) e o chevron de voltar pede **a mesma confirmação que Parar**,
   com o preço em minutos: *isto joga fora os `M:SS` já corridos; compilar de novo leva
   cerca de N minutos*. Nas outras quatro fases o gesto volta ao normal — não há o que
   perder.

**E "sair interrompe" é hipótese escolhida, não fato medido.** O dono a escolheu em 23/09
sem esperar pela medição, por ser o lado que não promete demais. Se um dia a medida mostrar
que a compilação sobrevive ao segundo plano, o que ganhamos é **folga** — o aviso afrouxa,
a lista pode voltar a mostrar trabalho em curso, a confirmação do gesto pode cair — e não
retrabalho. A pergunta continua na lista de medir, agora com essa nota. Ver *Perguntas em
aberto*, nº 1.

A tela inteira gira em torno de um `{components.cartao-de-custo}`: `{typography.relogio}`
em mono para o decorrido, a `{components.faixa-de-compilacao}` de 6 pt — listrada e
indeterminada, **nunca em `{colors.primary}`**, que é a cor do que se aperta — e a etapa em
curso. O aviso é um `{components.cartao-de-aviso}`, acima do `{components.botao-suave}` de
parar.

**Uma etapa, não três.** Os mockups desenham três anéis — *instalado no aparelho*,
*compilando para o chip*, *primeira frase de teste* — e **nada avança do segundo para o
terceiro**: não há evento, não há fração, e a primeira frase de teste *é* a compilação, não
um passo depois dela. Três anéis que não andam durante quinze minutos são uma tela travada;
pior, são uma **fração desenhada em forma** — um terço, dois terços —, exatamente o que a
regra "não desenhe porcentagem" proíbe em número. A espinha reduz a sequência à única coisa
que está acontecendo: um anel, girando, com a palavra **compilando** ao lado. O que era a
etapa 1 vira o que sempre foi — um fato já verdadeiro antes de a tela abrir, e ele vira uma
linha de contexto (*instalado no aparelho · 1,1 GB*). O que era a etapa 3 vira a fase
*terminou*.

- **Parar** não apaga nada: o modelo fica instalado, esperando ser compilado de novo. A
  confirmação diz o preço em minutos, não pergunta "tem certeza?".
- Enquanto compila, **nada no app fica parado**: as leituras continuam com quem já as
  escreve, e a tela diz isso por extenso, nomeando o motor atual.
- A tela **fica acesa** enquanto compila (`useKeepAwake`), como a Bancada já faz ao medir.
  Se o bloqueio automático mata a compilação ou não continua sendo pergunta aberta; manter
  a tela acesa é o que torna a pergunta irrelevante no uso normal, e é barato o bastante
  para se fazer antes de saber a resposta.
- **Perder o foco para**, e não só desmontar. Empurrar outra rota deixa a tela montada; sem
  essa guarda o processo seguiria atrás de uma tela que o dono já trocou. É o mesmo arranjo
  que a medição da amostra já usa hoje (`useFocusEffect`), e agora é também o que a fase
  *parada* registra.

### O sistema não diz quanto falta, e a tela também não

**Pergunta fechada em 22/09, com evidência.** A API de especialização do iOS 27 tem três
funções e nenhuma aceita progresso; as 1.816 linhas de `.swiftinterface` das cinco
subframeworks do Core AI não citam `Progress`, `callback` nem `AsyncStream`; o cache **não
cresce em disco durante** a compilação (amostragem de 1 em 1 s: zero byte em 200 s de
observação), então nem o sinal indireto existe. A própria Apple documenta a espera e manda
mostrar **mensagem indeterminada**. Qualquer porcentagem seria invenção nossa.

O que a tela promete, então:

- **O decorrido**, no relógio. É medido e é dela.
- **A lembrança**, em uma frase: *Da última vez, neste iPhone, levou 11 minutos. O sistema
  não diz quanto falta — só avisa quando termina.* A segunda metade não é desculpa; é a
  informação que impede o dono de ficar olhando uma tela esperando um número que não vem.
- **Nada**, quando não há lembrança. Ver *Tempo*.
- **O aviso antes de começar.** `isCached` custa ~0,5 ms e responde **se vai compilar**
  antes de qualquer toque caro. É o que permite ao botão **Compilar** existir na lista com
  o preço no rótulo, em vez de a leitura descobrir o preço no meio do caminho.

No VoiceOver isso é **texto**, nunca `progressbar` — um `progressbar` sem valor é pior do
que nenhum, porque promete uma fração que ninguém vai anunciar.

### "Compilado" não é para sempre

Duas armadilhas medidas na mesma investigação, e as duas produzem o mesmo sintoma: um
modelo que estava `compilado` volta a `instalado, não compilado` **sem ninguém ter tocado
em nada**.

1. **O cache é particionado por build do iOS.** Atualizar o sistema recompila tudo. Não é
   defeito e não é perda de dado — é quinze minutos que voltaram a existir, e a tela tem de
   dizer isso quando acontecer, em vez de deixar o dono achar que o app se desfez.
2. **O iOS pode apagar o cache sob pressão de espaço.** `AIModelCache.Policy` tem
   `PurgeConditions.storagePressure`, e há um `.persistent` a investigar — decisão de
   engenharia, não de tela, mas a tela herda o resultado.

Em ambos os casos o estado de verdade continua sendo `isCached`, relido **na montagem** e
ao focar a tela: a tela **mostra** o fato, não se lembra dele. É a mesma regra do
diagnóstico da ponte, e vale aqui pela mesma razão.

E a primeira das duas tem uma consequência que ninguém esperava do lado bom: **um build
novo sobre o mesmo iOS abre com tudo já compilado**. Era isso que "todo build nasce não
compilado" escondia. A espera não é um pedágio de instalação; é um pedágio de **sistema**,
e o dono só o paga quando atualiza o iPhone.

### Uma medição tem três desfechos, e nenhum é um veredito

**passou** · **recusada** (com o problema nomeado) · **defeito** (não chegou ao modelo).
Os dois primeiros usam o `{components.selo-de-desfecho}`; o problema vem numa linha
própria em `{colors.recusa-text}`, abaixo da frase, e a frase em si é
`{typography.frase}` — serifada, porque é ela o objeto em julgamento.
A tela **não soma, não pontua e não recomenda**. Os limiares da
[ADR 0050](../../../../docs/decisions/0050-o-limiar-do-portao-sai-de-medicao-e-tem-quatro-condicoes.md)
— aprovação ≥ 90%, os sete casos nos dois alcances, nada idêntico ao template, mediana
≤ 20 s — são do dono lendo o resultado, não da tela calculando por ele.

Isto tem um caso real que prova a regra: em 22/09, na mesma janela, o **Tucano2 foi o mais
rápido dos três** (7,1 s contra 9,8 s do Qwen3 e 10,4 s da nuvem) e **passou** na
conferência — e mesmo assim vazou jargão do pedido para dentro da frase ("durante a
janela de leitura"). **O portão não pega isso.** Uma tela que exibisse um selo de
"aprovado" grande teria mentido para o dono naquele dia. Ela exibe o tempo, o desfecho e
**a frase**, e a frase é o que ele lê.

### Estados vazios

| Onde | Vazio | O que a tela diz |
|---|---|---|
| Modelos no aparelho | build sem pesos | *Este build não embarca nenhum modelo aberto.* Sem CTA — não há de onde instalar. |
| Modelos na nuvem | lista nunca lida | a lista que o app conhece por conta própria (já inclui `nuvem:padrao`), **nunca um spinner bloqueante** |
| Como ele escreve (ficha) | nunca medido | *Ainda não medido* + o caminho para Comparar |
| Comparar, antes de medir | nenhuma linha | na Saúde do sono, o `{components.cartao-regua}` com o texto do template já visível, e mais nada; nas outras duas, o mesmo cartão dizendo que **ali não há régua** |
| Comparar, leitura sem caso | a fonte devolveu lista vazia | o motivo em palavras que a própria fonte deu (*os dados da semana anterior ainda não chegaram*, *nenhuma pedalada com cidades e traçado no acervo carregado*), e o botão **Medir** inerte |
| Comparar, **janela de sono sem noite** | a janela existe e não tem o que ler | *esta janela não tem noite para ler*, e **Medir** inerte — ver abaixo |
| Escreve hoje (ficha) | não escreve nada | *Não escreve nenhuma leitura hoje* |
| `modelo/[id]` · `compilar/[id]` | id que este build não traz | *este build não traz o modelo `<id>`* e o caminho de volta; `compilar` **não começa nada** |

**A janela de sono vazia é o buraco mais perigoso da tabela**, porque ele não parece um
vazio. As outras duas fontes devolvem lista vazia com motivo quando não há caso; a da
Saúde do sono **sempre devolve um caso** — a janela que o `PeriodNav` escolheu, com dado
ou sem —, e uma janela sem noite nenhuma atravessa a corrida inteira e sai `mudo` em todas
as colunas. É o mesmo sintoma que mordeu em 22/09 pela rota degenerada, e é o pior possível:
parece defeito de todos os modelos ao mesmo tempo. Guarda: a fonte pergunta antes de
oferecer — a mesma pergunta pura que `rotaMedivel` faz do outro lado — e devolve
`{ casos: [], motivo: 'esta janela não tem noite para ler' }`. O lugar é `amostras.ts`, ao
lado das outras duas regras, e a pergunta é de graça.

### Carregamento

**Nada nesta família bloqueia atrás de rede.** A lista do servidor é buscada ao abrir e
nunca é um obstáculo: enquanto ela não volta, a tela mostra o que o app conhece. O cache
é o ponto de partida, para que voltar à tela não faça um motor já conhecido piscar fora
da lista. O diagnóstico da ponte é relido ao focar a tela e quando o app volta ao primeiro
plano — **enquanto ele não disser "disponível"** —, porque o dono pode ter ido aos Ajustes
ligar a Apple Intelligence e voltado. Tudo isso já existe e é para continuar existindo.

## Quem entra na corrida — a escolha que vale só para a medição

Requisito do dono de 22/09, 21h45. A Comparação mede **quem ele marcar**, não todos.

### O contrato

- **O conjunto é uma seção própria**, "Quem entra", com **um `{components.chip-da-corrida}`
  por motor conhecido** daquela leitura — os mesmos que `motoresDoRecurso` devolve, nem
  mais nem menos. Ligado é preenchido em `{colors.ink}`; desligado é contorno em
  `{colors.line}`; indisponível é a forma de desligado em opacidade 0,45.
- **Menos um: o que o `regimeMaximo` do recurso não admite não tem chip.** Não desligado,
  não apagado: **ausente**. Medir não grava, mas medir manda o caso para fora do aparelho,
  e isso é exposição, não escrita — o teto de exposição não se afrouxa para medir (ver
  *Medir não é gravar*). Um chip desligado convidaria a ligar o que a regra proíbe, e um
  chip apagado prometeria um motivo que o recurso nunca vai deixar de ter. Hoje os três
  recursos admitem nuvem e o caso não ocorre; a regra existe para o quarto recurso —
  só-aparelho — não nascer com um botão que sai do telefone.
- **O template é régua fixa, onde ele existe.** Ele não é desligável, não tem estado e não
  conta como motor. Uma corrida sem régua não compara nada: é contra a frase do template
  que se lê "isto aqui é diferente do que o código já escrevia". Ele usa o
  `{components.chip-regua}` — `{colors.surface-mute}` com borda tracejada —, porque o
  tracejado diz "isto não é um controle" sem gastar uma palavra, e a ausência de estado
  precisa ser vista, não descoberta por toque.
- **E onde não há régua, não há chip de régua.** Na Retrospectiva e no nome de rota o
  `semModelo` devolve uma lápide, não um texto: um chip escrito *Template · régua* ali
  promete uma coluna que nunca vai aparecer, ao lado de um cartão que explica justamente
  que ela não existe. Trocar a leitura para uma dessas duas **remove o chip**, e a fileira
  passa a ser só de motores. A ausência já está dita uma vez, no
  `{components.cartao-regua}`; dizê-la e contradizê-la na mesma tela é pior do que não
  dizê-la.
- **O estado guardado é quem está de FORA**, não quem está dentro. É uma inversão
  deliberada: um motor que aparece no meio da sessão — uma variante que o servidor
  aprovou, um peso que acabou de compilar — precisa **nascer ligado**. Guardando os de
  dentro, ele nasceria de fora e ficaria invisível sem ninguém entender por quê.
- **Os pesos abertos nascem fora.** Cada um é mais de um gigabyte de memória e é o elo
  mais lento da corrida. Ligar um é uma decisão, e a tela avisa o preço quando ele é
  ligado: *a primeira chamada de cada modelo compila e leva minutos*.
- **A escolha vale só para a corrida.** Ela **não é** a preferência de "quem escreve",
  que mora na tela raiz, no `AsyncStorage`, e que nenhuma medição toca. Marcar um chip
  não muda quem escreve nada; desmarcar não remove ninguém de lugar nenhum. A folha de
  escolha e os chips da corrida são dois controles diferentes sobre o mesmo catálogo, e
  a tela nunca sugere o contrário.
- **A escolha não sobrevive à sessão.** Ela é estado de tela, não preferência. Reabrir
  Comparar volta ao padrão (todos dentro, pesos abertos fora). Persistir isso criaria uma
  segunda memória de motores competindo com a primeira, e o dono teria dois lugares para
  procurar quando algo não fosse medido.

### Nenhum motor marcado

**O botão Medir fica inerte**, e a causa fica escrita ao lado dele, não em um alerta:

> *Só a régua está marcada — ligue ao menos um motor para a corrida medir algo.*

O botão é anunciado `disabled` e a frase é parte do rótulo acessível dele, porque um botão
apagado sem motivo audível não diz nada a quem usa VoiceOver. Um motor **indisponível**
marcado não conta como marcado: a condição é "existe ao menos um motor marcado **e**
disponível".

### Um chip que não está compilado

Um modelo que este aparelho ainda não compilou **não pode ser marcado**: ele não tem como
responder em segundos, e a primeira chamada dele é a compilação. O chip aparece na forma
desligada, sem toque, com o motivo no próprio rótulo (`Qwen3 0.6B · não compilado`), e um
toque nele não faz nada — não enfileira, não abre a tela de compilação, não avisa.

**A corrida não compila nada.** Marcar um chip nunca dispara uma compilação de 15 minutos
por tabela. Um modelo não compilado simplesmente não corre, com o motivo à vista e a ficha
dele a um toque, onde o botão Compilar está.

**E não há "chip compilando".** Enquanto Comparar está aberta, nenhuma compilação está
correndo — sair da tela de compilação a interrompe (decisão de 23/09). O que pode mudar
debaixo da tela é o contrário: um modelo `compilado` voltar a não estar, porque o iOS
purgou o cache. Nesse caso o chip **nasceria ligado e não responderia**, que é a razão da
guarda abaixo.

### A corrida relê antes de correr

**Os chips são pintados uma vez; a verdade não fica parada.** Entre o instante em que o
dono marcou um peso aberto e o instante em que ele toca **Medir** podem passar minutos, e
nesse intervalo o iOS pode purgar o cache ou a Apple Intelligence pode ser desligada nos
Ajustes. O chip continua marcado, e o toque em Medir manda compilar — **quinze minutos
disparados por uma tela que promete o contrário**, e pela única porta desta família que
diz, por escrito, que não compila nada.

Guarda, e ela é a primeira instrução do botão: **antes do laço**, a corrida relê `isCached`
de cada peso aberto marcado e o diagnóstico da ponte de cada motor de aparelho marcado.
Quem perdeu a condição **sai da corrida antes de começar**, com o motivo, e a tela o diz na
mesma linha em que diria o resultado — *`Tucano2 1.5B` — fora: o compilado deste modelo não
está mais no aparelho*. Não é um erro; é uma coluna que não aconteceu, e ela vale tanto
quanto uma que aconteceu.

Se **nenhum** motor sobrevive à releitura, a corrida não começa e a causa fica escrita ao
lado do botão, pela mesma regra de *Nenhum motor marcado*.

### Durante a corrida os chips ficam travados, e Medir também

Enquanto mede, nenhum chip responde. Trocar a composição no meio mediria motores sob
conjuntos diferentes e o resultado seria incomparável consigo mesmo — que é o erro que
esta tela existe para não cometer. O mesmo vale para trocar a leitura ou a amostra.

**E o próprio Medir fica inerte.** Um segundo toque com a corrida em curso largaria uma
segunda corrida sobre a mesma lista, com duas publicações incrementais pintando o mesmo
lugar — e o dono lendo uma mistura de duas composições sem saber que são duas. Enquanto
corre, o botão é `busy`, nomeia o motor atual (*medindo Tucano2 1.5B…*) e **não aceita
toque**; quem quer parar usa o **Parar** ao lado dele, que é o controle que existe para
isso.

**Toda chamada tem teto de espera.** Um motor que não devolve nem resposta nem erro deixa o
botão `busy` para sempre, e a tela inteira fica refém de uma coluna. Estourado o teto, a
coluna fecha como **defeito** — *o motor não respondeu* — e o laço segue para o próximo,
que é o desfecho que a tela já sabe mostrar. O valor do teto **sai de medida, não de
gosto**: a maior mediana conhecida é a da nuvem, 13,6 s sobre 22 janelas, e o aparelho ficou
entre 1,6 e 9,8 s. Ele fica declarado uma vez, no código da corrida, com folga de ordem de
grandeza sobre essas medidas — e nunca aparece na tela, porque um teto que o dono lesse
viraria uma promessa de tempo que esta família não faz.

**Sair da tela abandona a corrida**, e isso já existe: o `useFocusEffect` da Bancada de hoje
solta o laço quando a tela perde o foco, para nenhum motor seguir medindo — com a tela
acesa — atrás de uma rota que o dono já trocou. É para ser preservado, e é o mesmo arranjo
que a tela de compilação usa.

## Medir não é gravar — a regra que libera a medição

Esta é a propriedade que faz a Comparação valer para **todas** as leituras, e não só para
a que não grava.

**Um recurso que grava recusa um motor na hora de escrever**, e com razão: o nome de rota
admite motor de aparelho e **grava no banco**, e um nome errado gravado não se desfaz. Por
isso o peso aberto não é escolhível ali — *o peso aberto é uma prova de caminho, e só a
Saúde do sono a mostra*.

**Medir não escreve em lugar nenhum.** A frase medida morre na tela, no modo `medicao`,
um motor por vez, sem recuo e sem piso. Logo:

> **Na Comparação, um motor entra em leituras em que ele não pode escrever.**

O peso aberto pode ser medido contra o nome de rota e contra a Retrospectiva, e é assim
que o dono descobre se vale a pena algum dia deixá-lo escrever ali. Esta é a razão de a
Comparação ter um catálogo de entrada mais largo que o da folha de escolha, e a tela diz
isso em uma linha:

> *Medir não grava — por isso o peso aberto entra aqui até nas leituras em que ele não
> pode escrever.*

**Dois limites continuam valendo, e não são negociáveis:**

1. **O `regimeMaximo` do recurso.** Dado de um recurso só-aparelho **não vai à nuvem nem
   para medir**. Medir não grava, mas medir *manda o caso para fora* — e isso é exposição,
   não escrita. O que a regra libera é o `grava.admite`; o teto de exposição fica. **E ele
   tem onde ser aplicado**: o motor que passa do teto não ganha chip na seção "Quem entra"
   — ausente, não desligado (ver *O contrato*). Era a metade que faltava: a regra estava
   escrita e não tinha consumidor de tela.
2. **Nada do que a tela mostra sai do aparelho.** Ela é o único lugar do app onde o texto
   cru do fornecedor aparece, e ele não é gravado, não é sincronizado e não sobrevive à
   tela.

## O custo declarado — gigabytes, minutos e o que sai daqui

Um motor tem três custos, e nenhum deles pode virar letra miúda.

### Espaço

Um peso aberto ocupa o aparelho **duas vezes**: o arquivo instalado e o compilado para o
chip. A ficha do modelo mostra os dois, com uma barra de duas partes:

| Modelo | Instalado | Compilado | Total |
|---|---|---|---|
| Qwen3 1.7B | 1,3 GB | 1,34 GB | 2,6 GB |
| Tucano2 1.5B | 1,1 GB | 1,14 GB | ~2,2 GB |

O compilado do Tucano2 foi medido em 22/09 e são **três arquivos**, não um — 1.017 MB,
98,5 MB e 28 MB. A tela soma; o detalhe fica no relatório. O que o número diz é que o
modelo mais leve dos dois custa **400 MB a menos no total**, e que essa diferença é a
metade de um argumento: a outra metade é a frase que cada um escreve, e ela só aparece em
Comparar.

O cabeçalho da seção soma o que está no aparelho agora. **A soma muda quando um modelo
compila**, e ela tem de mudar — é o número que responde "por que meu telefone encheu". E
ela pode **cair sozinha**, se o iOS apagar um cache ou se o sistema for atualizado; ver
*"Compilado" não é para sempre*.

### Tempo

A compilação é **uma vez por modelo por aparelho** — e por build do iOS: Qwen3 1.7B levou
**15 min**, Tucano2 1.5B levou **11 min**, medidos em 22/09 no iPhone 17 Pro pelos carimbos
do cache. A ficha guarda a data e a duração reais daquele aparelho, não o número publicado.

**E é só daí que sai qualquer estimativa.** Um modelo que este iPhone já compilou tem um
número, porque ele aconteceu aqui. Um modelo que ele **nunca** compilou não tem nenhum: não
existe número publicado confiável, o tamanho do arquivo não prediz o tempo (o Tucano2 é 15%
menor e compilou 27% mais rápido, numa amostra de dois), e o que o Mac mediu não vale para
o telefone. Nesse caso a tela diz **"leva minutos"**, sem cifra, e o dono descobre o número
junto com o aparelho. Chutar uma estimativa na primeira vez seria inventar exatamente o
único número que esta família existe para não inventar.

(Há uma proposta técnica não calibrada — derivar a estimativa de
`AIModelAsset.summary(includingStatistics:)`, que é síncrona e entrega a contagem de
funções sem compilar nada. Enquanto não for medida contra os dois casos reais, ela não
vira número na tela.)

A leitura, depois de compilado, é de segundos: na mesma janela de 22/09, **Tucano 7,1 s ·
Qwen3 9,8 s · nuvem 10,4 s** — os dois de aparelho mais rápidos que a nuvem. A tela mostra
**a mediana do que este aparelho mediu**, e nada onde não mediu. (A nuvem tem mediana de
13,6 s sobre 22 janelas na medição de 12/09, e teve 10,4 s numa chamada em 22/09. As duas
são verdade; só uma é mediana, e é ela que a linha mostra.)

### Exposição

Cada motor declara, na própria linha, o que sai do aparelho:

- **Sem modelo** — *instantâneo · sempre igual · nada sai daqui*
- **Modelo do aparelho** — *nada sai daqui*
- **Peso aberto** — *nada sai daqui*
- **Nuvem** — *os números da leitura saem do aparelho*

A frase da nuvem é a mais importante da tela, e ela é **específica**: não é "seus dados";
é *os números desta janela*. O dono sabe exatamente o que é a janela, porque ele acabou de
escolhê-la.

### Apagar — e o que "remover" significa de verdade

**Aqui a espinha diverge do mockup, e a divergência é factual.**

`Modelo.dc.html` oferece *Remover do aparelho* e promete *Remover devolve 2,6 GB*.
**Sob a ordem do dono de 22/09, isso é falso.** Sem hospedagem, os modelos vêm **dentro do
app**: o arquivo instalado é parte do bundle e não pode ser apagado sem desinstalar o app.
O que se pode apagar é **o compilado**.

Portanto:

- A ação chama-se **Apagar o compilado**, e usa a `{components.acao-destrutiva}`:
  contorno em `{colors.recusa-soft}`, texto em `{colors.recusa-text}`, nunca preenchida.
- O preço declarado é: *Devolve 1,34 GB. Compilar de novo leva 15 minutos.* — em
  `{typography.estado}` e `{colors.ink3}`, imediatamente abaixo do botão.
- Ela não some: apagar o compilado é a única alavanca real de espaço que o dono tem, e ela
  é legítima — um modelo que ele decidiu não usar está custando mais de um giga à toa.
- O texto do mockup volta a valer **no dia em que houver hospedagem** e o modelo vier de
  fora do bundle. Até lá, prometer 2,6 GB e devolver 1,34 seria a tela mentindo sobre o
  único número que ela existe para dizer.

Confirmação e um segundo toque: **apagar não é destrutivo de dado**, é destrutivo de
trabalho. A confirmação diz quanto tempo custa refazer, não pergunta "tem certeza?".

## Comparar — a leitura, a amostra e quem entra

Três controles no topo, na ordem em que a pergunta se forma.

**1 · Qual leitura.** Uma fileira de chips com os recursos de `CATALOGO_DE_RECURSOS`. Hoje
três. Trocar a leitura **apaga o que já foi medido** — comparar a frase de um motor numa
leitura com a de outro em outra é exatamente o erro que esta tela existe para não cometer.

**2 · Sobre o quê.** A amostra, **e ela é própria de cada leitura**. É aqui que morava o
requisito do dono e a maior parte do trabalho novo — e é aqui que a noite de 22/09
entregou: `amostras.ts` tem uma fonte por recurso, fechada sobre `RecursoId`, e cada fonte
diz quatro coisas (como se chama, qual descritor percorrer, quais casos existem agora, como
virar texto a saída). A tela escolhe uma fonte e um caso, e recebe linhas prontas.

| Leitura | Fonte da amostra | Como se escolhe o caso |
|---|---|---|
| Saúde do sono | a janela do `PeriodNav`, já montada (`EntradaDaSaude`) | o próprio `PeriodNav` — **um caso por vez**, identificado pela mesma `chaveDaJanela` da produção |
| Retrospectiva | **um caso por caderno** da semana **fechada anterior**, pela porta `pacotesComDado` | chips: *caderno Sono*, *caderno Treino*… |
| Nome de rota | até **5 pedaladas** recentes com cidade e traçado, **não degeneradas** | chips: *pedalada de 14/09 · Ittre* |

**Duas regras puras, e as duas nasceram de erro silencioso.** A semana da Retrospectiva é a
**anterior** (`OFFSET_DA_SEMANA_FECHADA = −1`): com `+1` a bancada pedia a semana que vem,
que nunca está fechada, e o descritor devolve nulo para período aberto. E a rota
**degenerada** não entra na amostra (`rotaMedivel`): o descritor recusa montar pedido para
ela, com razão — uma rota de 0 km não custa um token —, mas oferecê-la assim mesmo fazia a
tela mostrar **`mudo` em todos os motores**, que é o pior sintoma possível, porque parece
defeito do modelo. As duas erraram em 22/09 sem levantar exceção; hoje moram em
`amostras-regras.ts`, com teste, longe das stores que impediriam testá-las.

**A tela conta, nunca crava.** Quando não há caso, a fonte devolve lista vazia **com o
motivo em palavras** — *nenhuma pedalada com cidades e traçado no acervo carregado*, *as 15
pedaladas mais recentes são curtas demais para ganhar nome* —, e é esse motivo que a tela
mostra. Nenhum número de acervo é escrito no desenho: as "135 rotas aprovadas" que
circulavam eram o acervo da **sonda no Mac**; em produção a coluna `activities.route_name`
está vazia e `route_name_meta` nem existe, porque a story 5.7 nunca foi deployada. Uma tela
que prometesse 135 casos abriria com uma mentira de três dígitos.

**Uma amostra de uma janela e uma de N janelas produzem resultados diferentes, e a tela
tem de dizer qual está olhando.** Com **uma** janela, o resultado é o que o mockup desenha:
um cartão por motor, com a frase inteira, lado a lado com a régua. Com **N** janelas, a
frase de cada uma não cabe: o resultado são as medidas da ADR 0050 — aprovação, mediana,
nada idêntico ao template — com os casos abríveis um a um. As duas metades existem hoje,
separadas em dois cartões e em dois arquivos: o caso único vem de `amostras.ts`, que serve
as três leituras, e a corrida de N janelas vem de `amostra.ts`, que **continua sendo só de
sono**. Este redesenho as unifica sob um só controle e separa o **resultado**, não a
pergunta.

**E é por isso que os chips de amostra não são os mesmos nas três leituras.** O mockup
desenha *esta semana · 22 janelas · o ano* e os deixa de pé com a leitura trocada — mas
"22 janelas" e "o ano" só existem onde há corrida de N janelas, que hoje é só o sono. Na
Retrospectiva e no nome de rota a fileira é a que a fonte daquela leitura devolve, e só ela:
*caderno Sono · caderno Treino…*, *pedalada de 14/09 · Ittre…*. A regra é a de sempre —
**a tela conta, nunca crava** —, aplicada agora também ao controle, e não só ao resultado.
Um chip *o ano* numa leitura sem série anual é um botão que não tem o que abrir.

E uma consequência de número: onde há corrida de N janelas, o **N é contado na hora**.
"22 janelas" foi o que a medição de 12/09 teve; não é uma constante da tela.

### A régua só existe numa das três leituras

O `{components.cartao-regua}` mostra a frase que o código escreve **sem modelo**, e é
contra ela que se lê "isto aqui é diferente do que o app já fazia". Só que **só a Saúde do
sono tem template**. Os outros dois descritores declaram ausência, com estas palavras:

| Leitura | O que o `semModelo` devolve |
|---|---|
| Saúde do sono | a frase inteira, montada pelo código |
| Retrospectiva | `'a revista não imprime sem modelo'` |
| Nome de rota | `'sem modelo não há região a nomear: o percurso fica com o nome da fonte'` |

Logo **a tela não pode prometer régua nas três leituras**. Onde há template, o cartão-régua
vem primeiro e a comparação é *motor contra código*. Onde não há, o cartão diz o que ele é
— *Só a Saúde do sono tem template. Aqui, sem modelo não há texto: a comparação é entre os
motores* — e a leitura se faz entre as colunas medidas, uma contra a outra.

**E a promessa some do controle junto com o resultado.** O chip *Template · régua* em
"Quem entra" é a mesma promessa escrita mais acima na tela, e o mockup a deixa de pé nas
três leituras. Onde não há régua, o chip **não existe** — ver *O contrato*. A tela não
pode explicar uma ausência num cartão e oferecê-la num chip trinta pixels acima.

Isso não enfraquece a medição das outras duas; muda a pergunta. Na Saúde do sono a pergunta
é "vale a pena trocar o template por um modelo?". Na Retrospectiva e no nome de rota o
template não é alternativa nenhuma — a ausência é a lápide —, e a pergunta é "qual destes
motores escreve melhor o que **tem** de ser escrito".

**3 · Quem entra.** § anterior.

**O botão é Medir**, um `{components.botao-forte}` e o único `{colors.primary}` da tela.
Enquanto mede, ele nomeia o que está medindo (*medindo Tucano2 1.5B…*), porque uma corrida
de quatro motores leva mais de meio minuto e um spinner mudo não diz se travou. Cada
resultado chega como um `{components.cartao-de-motor}`.

**A publicação é incremental.** Cada motor aparece assim que termina. Esperar todas as
colunas deixaria a tela vazia por meio minuto.

**Trocar a janela no meio abandona a corrida.** O laço compara a chave da janela a cada
volta e desiste se ela mudou — senão ele continuaria pintando medições da janela velha sob
o cabeçalho novo.

## Instalar é uma tela parada, e isso é uma decisão

**Ordem do dono, 22/09, vale até segunda ordem:** sem hospedagem, **nenhuma tela oferece
instalar**. Todo build embarca os modelos.

Consequências, que valem como regra de construção:

- **Não existe rota `instalar`.** Nada no app navega para lá. A tela vive no canvas, com a
  faixa que diz o que ela é.
- **Não há catálogo de modelos disponíveis** em lugar nenhum da UI. Nenhuma linha "ver
  mais modelos", nenhum vazio que convide a baixar.
- **O verbo "instalar" continua no vocabulário** e continua aparecendo — em
  *instalado, não compilado* e em *Instalado no aparelho · 1,1 GB*. Ele descreve um fato
  (o modelo está aqui), não oferece um ato.
- O portão técnico **já foi respondido**: baixar modelo em execução é viável, a ponte
  aceita pasta fora do bundle. A tela está parada por falta de **onde hospedar**, não por
  falta de caminho. Quando houver, ela acorda inteira — junto com a promessa de "remover"
  do § anterior.

## Interaction Primitives — primitivas de interação

| Gesto | O que faz | Onde |
|---|---|---|
| toque na linha | abre a ficha do modelo / a folha do recurso | tela raiz |
| toque no botão-pílula | abre `compilar/[id]` e **começa** | linha de modelo não compilado |
| toque na opção | escolhe, grava e **fecha a folha** | folha |
| toque no chip | liga/desliga na corrida | Comparar |
| arrastar para baixo / tocar fora | fecha a folha sem mudar nada | folha |
| deslizar da borda esquerda | voltar (nativo) | telas de pilha |
| deslizar da borda esquerda | **desligado** (`gestureEnabled: false`); o voltar pede a confirmação de Parar, com o preço | `compilar/[id]` na fase *correndo* |
| rolagem | tudo é lista; nada é paginado | todas |

**Não há**: gesto longo, deslizar para apagar, arrastar para reordenar, puxar para
atualizar. Apagar o compilado é uma ação nomeada no pé de uma ficha, nunca um gesto — é
destrutiva de quinze minutos e não pode acontecer por acidente de dedo.

**Feedback de toque** é `opacity: 0.6`, o mesmo do resto do app. Sem animação de escala,
sem háptico — nada aqui é comemorável.

**Nenhuma folha abre sozinha.** Nenhuma compilação começa sozinha. Nenhuma medição começa
sozinha. Todo ato caro desta família tem um toque do dono na origem.

## Accessibility Floor — piso de acessibilidade

**Alvos.** `{spacing.alvo}` (44 pt) para qualquer linha que abre ou grava;
`{spacing.alvo-compacto}` (36 pt) para chips e botões-pílula em linha. **Os dois são
mínimos, não medidas** — ver *Texto grande*. O sistema **não tem token de alvo nem de
`hitSlop`** — cada tela escreve o número — e esta família passa a usar os do DESIGN. Botões
de ícone mantêm `hitSlop` de 12, o valor dominante no app.

**Contraste.** Todo texto ≥ 4,5. As consequências disso já estão no DESIGN: **nenhum selo
desta família preenche** (e o contorno, que é objeto gráfico, usa o token `graphic`, com
piso 3,0 garantido); a palavra "compilando" é `{colors.andando-text}` e nunca
`{colors.andando-accent}`, que mede 1,76 contra o branco; e `{colors.on-primary}` sobre
`{colors.primary}` mede **3,31** na marca `laranja`, o que é o piso de objeto gráfico e
**não** o de texto — dívida pré-existente do app, tornada visível aqui e listada em aberto.

**E há uma regra de tinta que vale para o comportamento, não só para a cor:** o que muda a
decisão do dono é texto e cobra 4,5, então vai em `{colors.ink2}`. `{colors.ink3}` mede
3,05 e fica para o dispensável — o "uso" à direita, as medidas de apoio. Por isso o
**motivo de um motor bloqueado** (que é a única coisa que explica por que ele não pode
tocar naquela opção) subiu para `{colors.ink2}`, e por isso ele é a última coisa a sair em
corpo grande.

**O texto sobre preenchimento de tinta é `{colors.bg}`, não `{colors.on-primary}`.** Vale
para o `{components.chip-da-corrida}` ligado e para o `{components.botao-pilula}`:
`onPrimary` é a cor de cima da **marca**, e com a marca `tinta` no escuro ela viraria
laranja sobre tinta. O par tinta/fundo se inverte junto com o esquema e continua legível.

**Cor nunca é o único portador.** Compilado tem tique **e** a palavra, em
`{colors.feito-text}`. Compilando tem faixa **e** a palavra **e** o relógio.
Passou/recusada tem a palavra dentro do selo, que é contorno e não preenchimento. Um chip
ligado é preenchido **e** anunciado `checked`. Nada nesta família se lê só por cor — o que também
é o que a faz sobreviver às seis paletas e ao esquema escuro.

**VoiceOver, por componente:**

- **Linha de modelo** — `button`; rótulo `"<nome> — <estado> — <tamanho> — escreve <uso>"`.
  Sem medida de tamanho, a parte do tamanho vira `"tamanho não medido"`; nunca some.
- **Botão Compilar** — `button`; rótulo `"Compilar <nome> — leva cerca de <n> minutos"`, ou
  `"Compilar <nome> — leva minutos"` quando este aparelho nunca compilou este modelo. A
  duração está no rótulo porque ela é o custo, e o custo não pode ser só visual. Inerte por
  haver outra compilação em curso, é `disabled` **com a causa**:
  `"Compilar <nome> — indisponível: um modelo de cada vez"`.
- **A tela de compilação anuncia a fase, não o movimento.** Cada uma das cinco tem uma
  frase de estado que o leitor de tela recebe ao entrar nela: *compilando*, *compilado em N
  minutos*, *parada aos M minutos*, *falhou: `<motivo>`*, *a compilação foi interrompida*.
  As quatro últimas movem o foco para a frase, porque nelas a tela parou de mudar e nada
  mais vai chegar.
- **Confirmar a saída** — o diálogo do gesto e o do botão Parar são o mesmo, e o rótulo
  carrega o preço: `"Parar a compilação de <nome> — joga fora os M minutos já corridos"`.
- **Opção da folha** — `button` com `accessibilityState={{ selected, disabled }}`; rótulo
  `"<nome> — <detalhe>"`, e `" — indisponível: <motivo>"` quando bloqueada. Consultando é
  `busy`, com o próprio rótulo, **não** como um motor que não existe.
- **Chip da corrida** — `switch` com `checked`; rótulo `"<nome> na corrida"`, mais
  `" — <motivo>"` quando travado.
- **Medir** — `button`; quando inerte, `disabled` **com a causa no rótulo**
  (`"Medir — nenhum motor marcado"`). Enquanto corre, `busy` e o nome do motor atual.
- **Faixa de compilação** — **`text`, nunca `progressbar`**. A pergunta foi fechada em
  22/09: não há fração em camada nenhuma. O que é anunciado é o decorrido e a lembrança
  (`"compilando o Tucano2 1.5B — 5 minutos até agora; da última vez levou 11"`), atualizado
  por minuto e não por segundo, para não transformar o leitor de tela num relógio falante.
- **A etapa da compilação** — **uma**, e o estado dela está na palavra, não no anel. Não há
  lista de três: três itens anunciados em sequência prometeriam um andamento que o sistema
  não emite, e o segundo deles ficaria "em curso" por quinze minutos.
- **Apagar o compilado** — `button`; rótulo com o preço:
  `"Apagar o compilado de <nome> — devolve <n> GB, refazer leva <n> minutos"`.

**Movimento.** Dois elementos animados, os dois na tela de compilação e os dois dizendo a
mesma coisa — "está correndo": o anel da etapa única e as listras da
`{components.faixa-de-compilacao}`. Sob **Reduzir movimento** os dois param, e nada se
perde: o que eles comunicam também está na palavra *correndo*, e o decorrido continua no
relógio, que é número. **Parar o movimento não pode apagar a faixa** — ela ainda é a forma
que diz onde a compilação está na tela.

**Texto grande.** Tudo escala. As duas linhas mais frágeis são a linha de modelo (nome +
estado + tamanho + uso) e o cabeçalho do cartão de motor (nome + tempo + selo): as duas
**quebram em duas linhas** antes de truncar, e o que nunca some é o **estado**. Em corpo
grande, o "uso" à direita é o primeiro a sair.

**E há uma terceira, que é a mais fácil de deixar passar: o chip.** Os 36 pt de
`{spacing.alvo-compacto}` são **mínimo**, nunca altura fixa. Um chip travado carrega o
motivo dentro do próprio rótulo, porque ele não tem linha de baixo onde pô-lo — `Qwen3 0.6B
· não compilado` —, e é justamente esse pedaço que uma altura fixa corta primeiro, em
corpo grande. O chip cresce, quebra em duas linhas se precisar, e a fileira quebra com ele.
Cortar o motivo deixaria na tela um controle apagado sem explicação, que é o defeito que
toda esta família existe para não ter.

## Key Flows — jornadas

### 1. Sydnei instala um build novo — e o que ele vê depende do iOS, não do build

São 22h30. Ele acabou de instalar um build que traz os dois pesos abertos e abre a Saúde do
sono esperando ver a frase que o Tucano escreveu de tarde. Toca **Ler**. Nada acontece por
dez segundos. Depois por trinta.

No app de hoje, é aqui que a noite acaba: a leitura está compilando um modelo de 1,1 GB,
vai levar onze minutos, e **nada na tela diz isso**. Ele vai concluir que quebrou.

No app depois ele abre Motores antes, por curiosidade — e **vê uma de duas telas, sem poder
adivinhar qual**, porque a resposta não está no app.

**O caso comum: o iOS é o mesmo.** Ele instalou o build sobre o mesmo sistema de ontem, o
cache do Core AI continua lá, e a seção abre com as duas linhas em **`compilado`**, tique
verde, `2 neste build · 2,4 GB`. Não há botão Compilar em lugar nenhum, porque não há o que
compilar. Ele volta para a Saúde do sono, toca **Ler**, e a frase chega em sete segundos.
**A virada é não haver virada**: o build novo não cobrou nada dele, e o desenho anterior —
que fazia *todo* build nascer não compilado — teria mostrado dois botões prometendo vinte e
seis minutos de trabalho que já estavam feitos.

**O outro caso: ele atualizou o iPhone esta semana.** O cache é particionado por build do
**iOS**, e a atualização o levou junto. As duas linhas estão em `instalado, não compilado`,
cada uma com um botão **Compilar**, e o cabeçalho caiu para o tamanho instalado.
**A virada é a palavra "não".** `instalado, não compilado` é a frase que reorganiza tudo
que ele sabia: o modelo está no telefone, e ainda assim não está pronto. E a explicação está
ali, porque ele não tocou em nada — foi o sistema.

Ele toca **Compilar** no Tucano. A tela abre com `0:04`, um anel girando e a palavra
**compilando**; logo abaixo, *Da última vez, neste iPhone, levou 11 minutos. O sistema não
diz quanto falta — só avisa quando termina.* Mais abaixo, o aviso que mudou de tom:
**Sair desta tela interrompe a compilação**. Ele põe o telefone na mesa, virado para cima,
e fica por perto — uma espera que ele **escolheu**, num momento em que não queria ler nada.

Aos oito minutos ele esquece e desliza da borda para voltar. O app pergunta, com o preço:
*isto joga fora os 8:11 já corridos; compilar de novo leva cerca de 11 minutos*. Ele
cancela. **A segunda virada é essa**: o gesto mais barato do iPhone deixou de ser o mais
caro desta tela.

Quando termina, a tela vira `compilado · 11 min`, o cabeçalho sobe para 2,4 GB e o carimbo
fica. **E é só daí que sai qualquer estimativa** — o app não ficou mais esperto; ele passou
a ter uma memória que antes não tinha, e é a única forma de estimativa que esta família
admite.

### 2. Sydnei compara os quatro na janela de ontem

Ele quer saber se vale a pena deixar um peso aberto escrevendo a Saúde do sono. Abre
**Comparar**, a leitura já está em *Saúde do sono*, a amostra em *esta semana*. Em **Quem
entra**, o template está tracejado, o Modelo do aparelho e a Nuvem estão escuros, e os
dois pesos abertos estão **em contorno** — fora, por padrão.

Ele toca nos dois. Aparece a linha: *a primeira chamada de cada modelo compila e leva
minutos*. Ele já compilou os dois ontem, então ignora, e toca **Medir**.

A régua aparece primeiro, tracejada. Depois o Modelo do aparelho, em 1,6 s, **recusada** —
marcador fora do lugar. Depois o Tucano, 7,1 s, **passou**. Depois o Qwen, 9,8 s,
**passou**. Depois a nuvem, 10,4 s, **passou**.

**A virada não é nenhum desses números.** É ele lendo a frase do Tucano e encontrando lá
dentro, em português perfeito e aprovado pelo portão, a expressão **"durante a janela de
leitura"** — que é vocabulário do *pedido*, não da vida dele. O modelo mais rápido dos
quatro, mais rápido que a nuvem, aprovado, copiando a instrução para dentro da resposta.

Se a tela tivesse mostrado um selo verde grande e um tempo, ele teria escolhido o Tucano
ali. O que o impede é a tela mostrar **a frase** com o mesmo peso que mostra o número. A
medida diz que passou; a leitura diz que não serve. Ele sai sem escolher nada — que é um
desfecho legítimo e a tela não o pressiona.

### 3. Sydnei tenta pôr o peso aberto para nomear as rotas

Ele gostou do português do Tucano e quer usá-lo para os nomes de rota. Abre Motores, toca
na linha **Nome de rota**. A folha sobe, e no alto ela diz: *Esta leitura grava no banco.*

No grupo **No aparelho**, o Tucano está lá — apagado, sem responder ao toque, com o motivo
escrito embaixo: *o peso aberto é uma prova de caminho, e só a Saúde do sono a mostra —
ela não guarda o que ele escreve*.

**A virada é ele entender que o veto não é sobre qualidade.** É sobre permanência. A frase
da Saúde do sono morre na tela; um nome de rota errado fica no banco e não se desfaz.

Mas a folha tem um pé, e o pé diz *Comparar os 2 nesta leitura* — dois, porque o atalho
marca só quem já nasceria ligado (o modelo do aparelho e a nuvem) e porque aqui não há
régua. Ele toca. A Comparação abre em *Nome de rota* — e ali o Tucano **está marcável**,
porque medir não grava. Ele o liga com o dedo, e o número vira três.

**A segunda virada é essa: o app não ligou o Tucano por ele.** Era o que o atalho faria se
marcasse a folha inteira, e teria disparado vários minutos de medição sem ninguém ter
pedido — cada peso aberto é mais de um gigabyte e é o elo mais lento da corrida. O que o
atalho fez foi abrir a porta certa já aberta; quem paga o preço decide pagá-lo.

Ele mede contra as rotas já aprovadas e passa a ter o número que um dia vai sustentar o
pedido de deixá-lo escrever. O app disse **não** e, no mesmo gesto, mostrou onde fica o
**ainda não**.

### 4. Sydnei precisa de espaço e abre a ficha do Qwen

O telefone reclamou de armazenamento. Ele abre Motores e o cabeçalho responde antes da
pergunta: os modelos estão custando gigabytes, e a maior parte disso é compilado.

Abre o **Qwen3 1.7B**. A barra de duas partes mostra 1,3 GB instalado e 1,34 GB compilado.
**Escreve hoje: nenhuma leitura** — desde a noite da comparação, é o Tucano que está na
Saúde do sono, e o Qwen não escreve nada há dias.

No pé, **Apagar o compilado**, e sob ele: *Devolve 1,34 GB. Compilar de novo leva 15
minutos.*

**A virada é o que a frase não promete.** Ele esperava recuperar os 2,6 GB inteiros. A
tela lhe diz, sem rodeio, que o outro 1,3 GB é o app — ele veio junto no build e não sai
sem desinstalar. Ele apaga o compilado, o modelo volta para `instalado, não compilado` com
o botão **Compilar** ao lado, e o total do cabeçalho cai na hora. Nada foi perdido: só
trabalho, e o trabalho está a um toque e quinze minutos de voltar.

## Perguntas em aberto

Onde faltou fato, a tela não inventou. Cada item abaixo trava um pedaço da construção, e
nenhum deles trava a **espinha**.

**Seis restaram, e são as mesmas de 22/09.** A revisão de borda de 22/09 não abriu nenhuma
nova: os 36 achados dela ou tinham guarda escrevível, ou caíam nestas duas primeiras. As
duas primeiras são de máquina e têm plano de medição escrito — e a nº 1 ganhou, em 23/09,
uma **hipótese escolhida pelo dono** enquanto a medida não vem; a terceira é de
engenharia; as três últimas são do dono.

1. **A compilação sobrevive a sair da tela — ou a bloquear o iPhone?** Não há medida. **O
   dono escolheu a hipótese conservadora em 23/09**, sem esperar por ela: *não sobrevive*.
   É o lado que não promete demais, e é dele que saem três regras já escritas — a lista e a
   folha não dizem `compilando`, o aviso declara a consequência em vez de pedir, e o gesto
   de voltar pede confirmação com o preço. **Isso é hipótese escolhida, não fato medido.**
   A pergunta continua aqui, e a resposta "sim, sobrevive" seria **folga** — o aviso
   afrouxa, a lista pode voltar a mostrar trabalho em curso, a confirmação do gesto pode
   cair —, nunca retrabalho. O `useKeepAwake` cobre o bloqueio automático; o botão lateral
   apertado por reflexo, não. `[A MEDIR]`, pelo plano abaixo.
2. **Parar recomeça do zero?** O mockup afirma *"recomeça do zero na próxima vez"*. Não há
   medição disso. Se houver retomada parcial, o texto do aviso e o preço da confirmação
   mudam — e mudam para melhor, porque "parar" deixaria de custar quinze minutos. `[A
   MEDIR]`, com a mesma regra: a tela não afirma o que não foi medido, e a confirmação diz
   o que se perde em **minutos corridos**, que é o que ela sabe.
3. **O iOS apaga o cache sob pressão de espaço — e dá para impedir?**
   `AIModelCache.Policy.PurgeConditions` tem `.storagePressure`, e há um `.persistent` a
   investigar. A consequência de tela já está escrita (*"Compilado" não é para sempre*); o
   que falta é saber se o app escolhe a política ou apenas a sofre. `[A DEFINIR]`.
4. **O rótulo de "uso" quando um modelo escreve mais de uma leitura.** O mockup mostra o
   nome da leitura na lista (`Saúde do sono`) e uma contagem na ficha (`1 de 3 leituras`).
   Com duas leituras, a linha mostra o quê? Regra proposta: **o nome quando é uma, a
   contagem quando é mais de uma**. `[A DEFINIR]` — confirmar a redação.
5. **`{colors.on-primary}` mede 3,31 contra `{colors.primary}`** e o botão **Medir** é
   texto de 15 px sobre ele (ver DESIGN, aberta nº 2). É dívida do app, não desta tela,
   mas é aqui que ela fica visível e é aqui que dá para pagá-la barato.
6. **A goteira de 20 pt versus o resto de `/configuracoes`** (ver DESIGN, aberta nº 1).

### Como medir as duas primeiras de propósito

Elas não se respondem por leitura de documentação — ninguém documenta nem uma nem outra — e
não vale gastar quinze minutos por tentativa. **A cobaia é o Qwen3 0.6B**: é o menor dos
modelos considerados (0,4 GB instalado) e compila mais rápido que os dois de hoje, o que
transforma cada tentativa de um quarto de hora em alguns minutos. Ele **não está em nenhum
build** — entrar exige um build que o embarque, e é a única coisa que essas duas medições
custam.

**O instrumento é o cronômetro, e só ele.** Ficou provado que o cache não cresce em disco
durante a compilação, então tamanho de pasta não serve de sinal; e `isCached` é binário,
então ele responde *se* acabou, nunca *quanto* andou. As duas perguntas são, por isso,
perguntas de duração.

- **Bloquear a tela, e sair do app.** Compilar o 0.6B uma vez, com a tela acesa, e anotar a
  duração — é a referência. Repetir **com `useKeepAwake` desligado de propósito**,
  bloqueando o iPhone aos 60 s e desbloqueando bem depois da duração de referência.
  Perguntar `isCached`. Repetir uma terceira vez mandando o app para segundo plano em vez de
  bloquear. Duas saídas em cada passada, e as duas são resposta: compilado (não mata — e aí
  o desenho de hoje ganha folga: o aviso afrouxa, a lista pode voltar a mostrar trabalho em
  curso, a confirmação do gesto pode cair) ou não compilado (mata, e a **hipótese escolhida
  em 23/09 vira fato**, sem uma linha de tela para mudar). É por isso que a hipótese
  conservadora foi a escolha barata: ela só pode ser confirmada ou afrouxada.
- **Parar.** Compilar o 0.6B até a metade da duração de referência e parar. Compilar de
  novo, **cronometrando**. Se a segunda passada durar o mesmo que a referência, recomeça do
  zero. Se durar sensivelmente menos, há retomada parcial — e aí a pergunta seguinte é se o
  que sobrou vence uma troca de build do iOS, que é a mesma armadilha da aberta nº 3.
- **Registrar as duas no relatório de 22/09**, ao lado da resposta sobre progresso: são a
  mesma investigação, feita no aparelho em vez de no Mac, e é no aparelho que a diferença
  entre 102 s e 15 min mora.

### Fechadas em 23/09, quando os achados de borda entraram

A lente de caso de borda de 22/09 (`review-edge-case.md`) apontou **três contradições entre
regras que estavam ambas escritas**. As três foram decididas pelo dono em 23/09, e nenhuma
sobrou como decisão pendente:

- **"Perder o foco mata a compilação" × a lista e a folha mostrando `compilando`.** Vence
  o primeiro: a compilação **não sobrevive** a sair da tela, `compilando` só existe dentro
  de `compilar/[id]`, e o aviso vira consequência declarada. É hipótese escolhida — ver a
  aberta nº 1.
- **O atalho da folha marcando os motores daquela folha × "peso aberto nasce desligado".**
  Vence o segundo: o atalho marca só quem já nasceria ligado, e os pesos abertos nascem
  fora por ali também. Ver *A folha de escolha*.
- **O chip `Template · régua` nas duas leituras sem template.** O chip some onde não há
  régua. Ver *A régua só existe numa das três leituras*.

### Fechadas na noite de 22/09

Ficam registradas porque a resposta é parte do desenho, e porque reabri-las custaria a
mesma medição de novo:

- **A compilação informa progresso?** Não, em camada nenhuma. Ver *O sistema não diz quanto
  falta*.
- **De onde sai a estimativa?** Só de uma compilação já feita **neste** aparelho. Ver
  *Tempo*.
- **O tamanho do compilado do Tucano2.** 1,14 GB; ~2,2 GB no total. Ver *Espaço*.
- **As amostras de Retrospectiva e de nome de rota, e o que é a régua em cada uma.**
  Existem em `amostras.ts`; e **só a Saúde do sono tem régua**. Ver *A régua só existe numa
  das três leituras*.
- **Quantas rotas aprovadas?** Nenhuma, em produção: as 135 eram o acervo da sonda no Mac.
  A tela conta em tempo de execução. Ver *Comparar*.
- **"Leitura nova começa em Sem modelo".** Descartada pelo dono: corrige-se a frase, não o
  núcleo. Ver *Voice and Tone*.
- **O par preenchido do `selo-de-desfecho`.** Deixou de existir — nenhum selo desta família
  preenche. Ver DESIGN, *Selo de estado*.
