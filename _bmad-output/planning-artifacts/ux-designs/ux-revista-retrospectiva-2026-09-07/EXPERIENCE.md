---
name: A revista da Retrospectiva
description: Arquitetura de informação, comportamento, estados e jornadas da Retrospectiva como revista. Par do DESIGN.md, que é dono da aparência.
status: final
updated: '2026-10-01'
sources:
  - ../../../../docs/specs/revista-retrospectiva/spec.md
  - ../../../../docs/specs/revista-retrospectiva/cadernos.md
  - ../../../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - ../../../../docs/specs/revista-retrospectiva/mudancas-mecanicas.md
  - ../../../../docs/specs/revista-retrospectiva/pre-registro-lua.md
  - ../../../../docs/specs/revista-retrospectiva/correcao-pre-registro-lua.md
  - ../../../../docs/specs/revista-retrospectiva/pre-registro-lua-outras-fases.md
  - ../../../../docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md
  - ../../../../docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md
design: DESIGN.md
---

> **Espinha de comportamento.** Par do [`DESIGN.md`](DESIGN.md), que é dono de *como se
> parece*; este é dono de *como funciona*. Os dois vencem qualquer mockup em conflito, e
> nenhum dos dois redecide o contrato em
> [`spec.md`](../../../../docs/specs/revista-retrospectiva/spec.md).

## Foundation — o chão

**Formato:** iPhone, retrato. Superfície única na v1.

**Mobile-first é lei do projeto**, não preferência: *se não está no celular, ele não
vê*. Web, PDF e e-mail são **não-objetivos declarados** — são renderização de um texto já
gravado, não geração, e ficam para depois sem custo de arquitetura. Nada aqui pode
inviabilizá-los: a edição é texto no banco, e a revista é a primeira leitura dele, não a
única possível.

**Sistema de interface:** o do próprio app — Expo Router, componentes do
[`mobile/src/components/`](../../../../mobile/src/components/), tema de quatro eixos.
Animação com `Animated` do React Native; **Reanimated não se usa** (ADR 0010).

**Usuário:** um. O autor do teste, o sujeito do teste e o leitor do resultado são a mesma
pessoa — e boa parte do desenho abaixo existe por causa disso.

## Information Architecture — arquitetura de informação

A revista tem **três objetos**, não três profundidades do mesmo objeto (CAP-9):

| Objeto | Período | Forma | Grava edição? |
|---|---|---|---|
| **Postal** | semana | uma tela, sem sumário, **sem capa de meia tela e sem cor de módulo** | **não** — calcula na hora |
| **Edição** | mês, trimestre | capa · sumário · quatro cadernos | sim, quatro linhas |
| **Anuário** | ano | **sem capa** — quatro tiras · depois os cadernos, com extremos datados | sim |

`all` **não tem edição**, e o CHECK do banco recusa.

**O postal ao reabrir volta aos três fatos apurados, sem prosa.** O texto escrito por
modelo só existe se o dono mandar escrever, e some ao sair — folhear seis semanas custa
zero, que é a mesma lei do resto da revista. Não há terceiro estado de persistência: ou é
gravado (edição, anuário) ou é efêmero (postal).

**O anuário não tem capa: as quatro tiras são a capa do ano.** Na parede, o volume anual
aparece como as **quatro tiras em miniatura** — o que também o distingue dos meses dentro
da grade.

### A superfície da edição

> Referência visual: [`mockups/key-edicao.html`](mockups/key-edicao.html). Geometria medida: capa 0–380, sumário 380–803, a dobra dos 844 corta a faixa do primeiro caderno 41 px depois de ela começar.

Uma **página contínua**, nesta ordem:

```
capa  (45vh, sangrada, manchete do caderno em posicao = 1)
sumário  (4 chamadas, na ordem ranqueada)
caderno em posicao 1
caderno em posicao 2
caderno em posicao 3
caderno em posicao 4
```

A ordem do miolo **é variável e vem do dado** (`ordenarCadernos`), e **congela na
impressão** — `posicao` é coluna, não array. Reabrir uma edição fechada seis semanas
depois devolve a mesma ordem mesmo que a função tenha mudado no meio-tempo.

**O sumário existe sempre, mesmo com um caderno.** A forma da edição é constante — capa,
sumário, cadernos —, e o leitor aprende uma forma só. O custo é conhecido e aceito: das 39
edições mensais do backfill, **22 têm um caderno só** (Coração começa 24/03/25, Sono
23/04/25, Rotina 01/05/26), e nelas o sumário é uma linha que repete a frase logo acima.
Quem folhear até 2023 — a jornada 4 — passa a maior parte do tempo nessas.

Um caderno **vazio não ocupa lugar**: a edição pode ter dois cadernos, ou um. Um caderno
**silenciado** pelo leitor (`hidden`) não aparece nem quando o ranqueamento o colocaria em
primeiro — é a única forma de discordar da revista, e o ranqueamento não a substitui,
porque um caderno indesejado lidera justamente no mês em que varia mais.

### As telas

| Tela | Chega-se por | Volta para |
|---|---|---|
| **Revista** (postal / edição / anuário) | Retrospectiva, escolhendo o período | de onde veio |
| **Página da lua** | linha no pé do caderno Sono | o caderno Sono, na posição em que estava |
| **Arquivo** — parede de capas | ação na revista | a revista |

**A página da lua é a única tela filha.** Tudo o mais da edição é rolagem.

## Onde a revista mora

A revista **não nasce numa tela vazia**: ela ocupa a Retrospectiva, que já existe e já tem
doze blocos em produção (`lede`, `kpis`, `highlights`, `heatmap`, `tasks`, `dailyTasks`,
`fitness`, `sleep`, `sports`, `health`, `habits`, `yearSeries`). Duas consequências que
nenhuma outra seção cobre:

- **O seletor de período foi expulso pela capa.** A capa sangra a 45vh a partir do topo, e
  o seletor de período estava lá. Ele precisa de lugar novo, e a espinha **não decide qual**
  — é decisão de tela que depende de como a Retrospectiva inteira se reorganiza.
- **Os doze blocos não foram absorvidos.** A revista descreve capa, sumário, cadernos,
  lápide e lua; ela não diz o que acontece com `kpis`, `heatmap`, `highlights` e os outros.
  Eles convivem com os cadernos, são substituídos por eles, ou passam a viver abaixo deles?
  **Está aberto**, e é o maior buraco desta espinha.

O que **está** decidido é o painel **Diagramação**: ele emagrece — perde as duas setas de
cada linha e fica só o olho —, e a legenda muda porque a segunda frase falava de uma regra
que deixou de existir.

## Voice and Tone — voz

**É um jornal: informa, não aconselha.**

| Nunca | Porque |
|---|---|
| "Parabéns", "muito bem", "continue assim" | elogio é conselho com outra roupa |
| "Que tal…", "experimente…", "verifique suas conexões" | conselho, e a lei da casa proíbe |
| "Seu sono melhora quando…" | afirmação de causa. A camada narra, nunca decide |
| Exclamação, emoji | não é a voz de um jornal |
| "435 km, contra 380 no ano passado" | base citada **sem nome** — reprova na quinta regra |

**Toda base comparada é nomeada.** Não é estilo: é a quinta regra de `verificar.ts`, e
ela **reprova**, não avisa. Três bases sem nome é um alfabeto três vezes maior; três bases
com nome é uma gramática — o número tem que bater **e a preposição junto**.

| Base | Como se escreve |
|---|---|
| **B1** — o período anterior | "contra julho" |
| **B2** — o mesmo período do ano anterior | "contra agosto do ano passado" |
| **B3** — a normal dele para este período | "contra o que você costuma fazer em agosto" |
| **Trajetória** | "cai pelo terceiro mês seguido" — direção, nunca valor bruto |

Trajetória lê melhor que duas bases consecutivas, e é a única comparação que o caderno
**Rotina** consegue antes de mai/2027.

**Cobertura desigual obriga ressalva no texto.** E **a ausência se declara**: a revista
nunca narra silêncio como estabilidade.

## Component Patterns — comportamento dos componentes

Aparência em [`DESIGN.md`](DESIGN.md); aqui, só o que eles fazem.

| Componente | Comportamento |
|---|---|
| **Linha de sumário** | Alvo de toque é **a linha inteira**, mínimo 44 px. Toca → rola com âncora até a faixa daquele caderno, na mesma página. Sem navegação, sem nova entrada na pilha. **A rolagem move o foco de acessibilidade junto** — ver §Accessibility Floor. |
| **Faixa de caderno** | Não é tocável e não colapsa. É âncora de rolagem e identidade — nada mais. Não vira barra fixa: a decisão foi explícita. |
| **Texto do caderno** | Estático. Não expande, não corta com "ler mais". Uma edição é curta por desenho; truncá-la seria esconder o produto. |
| **Assinatura** | Sempre visível, nunca atrás de toque. |
| **Lápide** | Não é tocável e não leva a lugar nenhum — em particular, **não leva a Conexões**. O alerta operacional vive fora da revista. |
| **Entrada da lua** | Tocável, alvo de bloco inteiro. Carrega **a frase coletiva** — **duas linhas, uma por família**, com placar e fase nomeada em cada: quem não tocar já leu o resultado. |
| **Cabeçalho de sub-página da lua** | Não é tocável fora do botão de voltar, que volta ao caderno Sono na posição em que estava. Não colapsa e não vira barra fixa. É cabeçalho de seção para o leitor de tela. |
| **A frase coletiva** | Estática, não tocável. **Duas linhas de família, dois compartimentos cada, e nenhum deles some** em tupla nenhuma — e as duas linhas nunca se somam num número. É o primeiro texto da página, e é o texto que a entrada da lua carrega. |
| **A figura das quatro janelas** | Não é tocável e **não tem estado**: não destaca uma fase por vez e não reage à rolagem. É dado desenhado, não gráfico interativo. |
| **Bloco de fase** | Estático. Sempre os quatro, um por fase, mesmos campos nas quatro. Não colapsa, não expande, e **não tem dimensão fixa**. |
| **Cabeçalho de família** | Não é tocável e não colapsa. Imprime o α **uma vez por família** e a razão da separação. Grupo e bloco vivem na mesma sub-seção de [`DESIGN.md`](DESIGN.md) — *Os grupos e os blocos de fase*. |
| **Tira do anuário** | Não é gráfico interativo. Sem toque, sem tooltip, sem scrub — é **formato**, não visualização. |
| **Capa da parede** | Toca → abre aquela edição. A capa inteira é o alvo, com o rótulo. |
| **Botão de imprimir** | Só aparece em período **fechado e ainda não escrito**. Nunca em período em curso, nunca em edição já impressa. |

## State Patterns — estados

> Referência visual: [`mockups/key-estados.html`](mockups/key-estados.html) — os quatro cadernos em quatro estados na mesma tela, e os dois estados que são ausência.

Herdados do `EdicaoCard` que já está em produção, agora **por caderno** em vez de por
edição:

| Estado | O que a tela mostra |
|---|---|
| **período em curso** | **nada**. Não é botão desabilitado nem aviso: é ausência. Um jornal não anuncia a edição que ainda não fechou |
| **fechado, não escrito** | a ação de escrever a edição, explícita |
| **escrevendo** | indicador por caderno — a edição chega em quatro peças, e cada uma aparece quando fica pronta |
| **pronta** | capa, sumário e cadernos, congelados |
| **reprovada na conferência** | o texto foi **descartado de propósito**; a tela diz por quê, listando os problemas. Não é erro do app: é a conferência funcionando |
| **errata** | a edição continua exatamente como está, com a marca de que os números abaixo foram reprocessados depois dela. **Errata não reescreve** |
| **erro** | a mensagem, e a ação de tentar de novo |

**A errata é por caderno.** Marcar errata no caderno de Sono não toca a linha do de
Movimento — é a razão de a chave incluir `caderno`.

## Ausência declarada — quando a revista fica cega

Seção própria porque atravessa três padrões e é onde a revista mais facilmente mentiria.

| Caso | Comportamento |
|---|---|
| **Caderno vazio** — não aconteceu nada | **some**. Sem espaço reservado, sem "nenhuma atividade registrada" |
| **Caderno cego** — o sensor morreu | **lápide**: nome, última data, ponto |
| **Base inexistente** | declarada **no pacote**, como fato |

A regra que fecha o buraco: o modelo **não pode descobrir sozinho** que não há ano
anterior — ele tem que ser **informado** de que não há. Sem isso, a revista narra o
silêncio como melhora: *"sua respiração está estável"* quando não há respiração há dois
meses.

**A lápide vira capa uma vez só**, na edição do período em que a métrica morreu — condição
testável: *a última medida cai dentro deste período*. Agosto/2026 é o mês em que os anéis
pararam; setembro não é. Sem essa regra ela lideraria toda edição para sempre, porque
sensor morto não ressuscita sozinho, e depois da terceira o leitor para de ver.

**Diagnosticar a causa é trabalho independente**, e não é da revista. As quatro métricas
mortas já foram diagnosticadas — troca de relógio, não cano quebrado —, e a lápide segue
necessária: a revista continua tendo que dizer que ficou cega.

### Quando mais de um caderno tem lápide no mesmo período

Já acontece duas vezes em 2026, e o contrato resolve sem regra nova:

- **julho/2026** — VO₂max (14/07) em Movimento; respiração (10/07) e SpO₂ (16/07) em
  Coração. Os dois cadernos são forçados a posição 1.
- **ano/2026** — as quatro mortes caem dentro do período, então o anuário do ano também
  abre por lápide.

O desempate é o **passo 4 do ranqueamento**: ordem do catálogo, fixa, *para a função nunca
ser ambígua*. Catálogo é Sono · Movimento · Coração · Rotina, então **Movimento lidera nos
dois casos**.

E o *uma vez só* continua de pé, porque vale **por tipo de período**: o ano de 2026 dispara
uma vez, o de 2027 não dispara.

## Impressão e congelamento — o ato pago

**A revista nunca gera sozinha.** Abrir a retro **só lê**; imprimir é **ato do usuário**.
Sem essa regra, folhear seis meses dispara seis chamadas pagas.

Três invariantes que a tela tem que preservar:

1. **Verifica antes de gravar**, sempre, em qualquer hospedeiro. Um texto reprovado nunca
   chega ao banco.
2. **Período fechado congela.** Dado que muda vira **errata**, não reescrita.
3. **A ordem congela na impressão.** `ordenarCadernos` é código, e ajustar o peso da
   confiança em novembro faria agosto se reordenar sozinho — reescrita silenciosa de
   período fechado.

O painel **Diagramação** continua existindo e **emagrece**: perde as setas de reordenar e
fica só o olho de esconder. A legenda muda junto, porque a segunda frase falava de uma
regra que deixou de existir — a prova de gráfica por usuário saiu, e o congelamento passou
a ser **por edição, na impressão**.

## Disciplina de pré-registro na tela — CAP-12

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html)
> — quatro **quadros** (três tuplas mais o pré-execução) com os blocos agrupados por família, e as
> quatro unidades do que falta.
> O [`mockups/key-lua.html`](mockups/key-lua.html) de 07/09 continua valendo para o que não
> mudou: a moldura de cinco campos, o rodapé do método e a linha de entrada no pé do caderno
> Sono.

O que o protocolo obriga a interface a fazer, e que nenhuma outra tela do app faz.

### São quatro fases em duas famílias

O segundo pré-registro (28/09/2026) acrescentou lua nova, quarto crescente e quarto minguante
à cheia, e **as quatro não são iguais perante o teste**:

| Família | Fases | α | Direção |
|---|---|---|---|
| **A cheia, sozinha** | lua cheia | **5%** | unilateral, no atraso |
| **Nova, crescente e minguante** | as outras três | **1,67%** (0,05 / 3) | bilateral |

A separação é de **procedência**: em 07/09 a cheia era a única exposição que existia, com
direção tirada da literatura; as três nascem juntas em 28/09, nenhuma com precedência sobre as
outras. O **§11** do documento de 28/09 obriga a página a **nomear as duas famílias
separadamente e mostrar os dois α** — uma página que imprima os quatro resultados com a mesma
tipografia, sem dizer que um vale a 5% e três a 1,67%, *"desfaz no leitor a distinção que a §3
pagou para manter"*.

**As quatro rodam juntas, ou nenhuma roda** (§9). Uma execução calcula, grava e publica as
quatro — então a página nunca mostra três fases lidas e uma pendente, e o contador de execuções
continua sendo um só. *Não existe "eu testei as quatro fases": são dois testes de proveniência
diferente.*

### A frase coletiva — o primeiro texto da página

A página **abre pelo desenho**; o **primeiro texto** é a frase coletiva. Ela é **uma linha por
família**, as duas sempre presentes, e cada linha tem **dois compartimentos que nunca
desaparecem**:

```
A CHEIA
  A cheia decidiu.                                       ← compartimento 1 · o placar da família
  Nas noites que antecedem a cheia, a hora de apagar     ← compartimento 2 · o quê, ou por quê
  ficou mais tarde.

AS TRÊS
  Nenhuma das três decidiu.
  Os três testes rodaram sem poder para decidir entre as duas colunas.
```

**Nunca há um número sobre quatro**, e as duas linhas **nunca se somam**. O §2 do documento de
28/09 escreveu a proibição para ser citada aqui: *"a partir daqui não existe 'eu testei as quatro
fases'. (…) Qualquer página, qualquer frase da revista e qualquer relato posterior que junte os
quatro num só resultado está errado, e este parágrafo é o que autoriza chamá-lo de errado."* Os
denominadores são **um** e **três** — e três é o divisor que o α das três usa (0,05 / 3).

> **Correção de 30/09/2026, sobre a mesma data.** A redação escolhida mais cedo em 30/09 abria
> com *"Das quatro fases, …"*: um denominador único sobre quatro, exatamente o que o §2 proíbe.
> A **forma** que o dono decidiu sobrevive inteira e é o que se preserva — compartimentos que
> nunca desaparecem, sem variante curta, e a linha de entrada carregando o mesmo texto. O que
> cai é o **denominador**, e cai com ele a terceira razão que sustentava o placar: *"quatro é o
> número que calibra a multiplicidade"* é **falsa**, porque o §3 de 28/09 tira a cheia da
> correção e divide por **três** — multiplicidade sobre quatro é o *Bonferroni nas quatro* que
> aquele documento recusou.

Duas razões seguem de pé, e são as que decidiram:

- **A forma nunca muda.** Não há variante curta para quando não deu nada, que é o modo de falha
  que a ADR 0045 existe para impedir.
- **Quem nunca tocar lê o resultado, não o placar.** É o segundo compartimento de cada linha
  que sustenta a mitigação da cláusula §3 — ver o fim desta seção.

**São estas duas linhas que a linha de entrada no pé do caderno Sono carrega**, com os quatro
compartimentos. A linha e a abertura da página dizem a mesma coisa, palavra por palavra.

> **A emenda à ADR 0045 — escrita em 01/10/2026 — mudou de objeto.** A decisão de 08/09 dizia que a linha de
> entrada era *"idêntica nos três casos"* — redação que quebrou quando as fases viraram quatro.
> O que a substitui **não é uma frase**, é a regra da seção seguinte: a emenda declara que a
> linha de entrada carrega o veredito por extenso **para toda tupla que o protocolo possa
> produzir**, e cita a regra de composição. Uma emenda escrita contra *"a frase coletiva"* como
> objeto declararia satisfeita uma garantia demonstrada em três casos de 81.

### A regra de composição — não há 81 redações, há uma regra

O veredito é **por fase** e tem três valores, então uma execução tem **81 tuplas** possíveis
(3⁴), mais o estado pré-execução. Redação autorada existe para três delas. Não existe redação
para 81 casos e não deve existir: o que a construção recebe é a **regra** abaixo, que gera as
duas linhas a partir da tupla — e é a regra que se cobre com teste, não as 81 saídas.

A entrada é o que o motor devolve: as quatro `ResultadoDaFase` (`veredito`, `motivo`, `familia`)
mais `acervo.noitesSemLuz`, em `packages/shared/src/sleep/lua-protocolo.ts`. **A UX obedece ao
código**: os nomes de família (`cheia`, `as-tres`), de veredito e de motivo são os dele.

> **Toda a redação desta seção é autorada aqui, não decidida pelo dono.** O que ele decidiu em
> 30/09 é a **forma** — dois compartimentos, nada desaparece, sem variante curta — e, na
> correção do mesmo dia, o **placar por família**. As palavras, e a definição de *decidir* do
> passo 2, são minhas.

**Passo 1 — o portão da luz vem antes de tudo, porque é global às quatro.** Se o acervo tem
noite sem horas de luz do dia, as quatro param no **mesmo** portão, **nenhum poder foi
calculado**, e as duas linhas trazem **o mesmo motivo**. É o único motivo que sobe para as duas
linhas, porque é o único que é propriedade do **acervo** e não da fase. Nesse caso é **proibido**
escrever *"não houve poder"*: seria falso, e mandaria esperar cem noites quando o que falta é
consertar dado que já está no acervo.

**Passo 2 — o compartimento 1 conta quantas decidiram, dentro da família.** *Decidir* aqui é
**chegar a um veredito com poder**: sair `achado` **ou** `nenhum_padrao`. Só `inconclusivo` é
não decidir. `d` é quantas fases da família decidiram, e o denominador é o tamanho da família,
**1** ou **3**.

> **Por que o verbo é este, e não "achou algo"** — decisão do dono em 01/10/2026. A §5 de 07/09
> diz que *"um teste com poder que não acha nada é **informação**; um teste sem poder que não
> acha nada é **silêncio**"*, e chama confundir os dois de *o erro mais fácil deste documento*.
> Com `decidir = achado`, as duas execuções escreviam **a mesma primeira linha** e a distinção
> ficava só no compartimento 2, que é o menor. Com esta definição o compartimento **grande** já
> as separa: quatro `nenhum_padrao` dizem *"A cheia decidiu. As três decidiram."*, e quatro
> `inconclusivo` dizem *"A cheia não decidiu. Nenhuma das três decidiu."*
>
> **O custo, declarado:** *decidiu* deixa de significar *achou algo*. Quem ler rápido pode
> entender *"a cheia decidiu"* como *"deu resultado"* — e é o compartimento 2 que desfaz isso,
> na mesma frase. **É por isso que ele nunca desaparece.**

| família | `d` | compartimento 1 |
|---|---|---|
| a cheia | 0 | *A cheia não decidiu.* |
| a cheia | 1 | *A cheia decidiu.* |
| as três | 0 | *Nenhuma das três decidiu.* |
| as três | 1 | *Uma das três decidiu.* |
| as três | 2 | *Duas das três decidiram.* |
| as três | 3 | *As três decidiram.* |
| as duas | pré-execução | *A cheia não foi lida.* · *As três não foram lidas.* |

**O verbo concorda com o numeral**, e o numeral tem quatro valores na família das três (0 a 3) e
dois na da cheia. É a lição do *"1 dias"* da story 2.8: o defeito nasce no template escrito para
um valor só. **Na família da cheia a concordância é sempre singular** — ela tem uma fase, e
*"nenhuma das uma"* não é frase; por isso o texto dela nomeia a fase em vez de contar.

**Passo 3 — o compartimento 2 diz o quê, ou por quê, e nunca quanto.**

| dentro da família | compartimento 2 |
|---|---|
| `d = 1` | nomeia a fase e o **sentido** do deslocamento. A cheia só pode decidir no atraso; as três decidem nos dois sentidos |
| `d ≥ 2` | nomeia **cada** fase que decidiu, na ordem do protocolo, com o sentido de cada uma — orações coordenadas, a segunda em elipse quando o verbo repete: *"…ficou mais tarde; nas que antecedem o minguante, mais cedo."* O compartimento tem de **caber mais de um nome** |
| `d ≥ 1` e sobra fase que não decidiu **na mesma família** | a oração final diz **quantas** e **por quê**, no mesmo compartimento. Nunca omitida, nunca em variante curta |
| `d` máximo e **todas** `nenhum_padrao` | *"Nenhuma mostrou deslocamento de 15 minutos ou mais"* — e aqui o *"com poder"* **não precisa** ser dito: o compartimento 1 já disse *decidiu*, e é essa palavra que separa do inconclusivo. Na família da cheia, que tem uma fase e é unilateral: *"…não houve deslocamento de 15 minutos ou mais **na direção que este teste pode achar**"* |
| `d` entre 1 e o máximo, com `achado` **e** `nenhum_padrao` na mesma família | nomeia o que achou (acima) e a oração final diz quantas decidiram **sem** achar — as duas decidiram, e o compartimento não pode sugerir que uma delas ficou sem resposta |
| `d = 0`, todas `inconclusivo` com o **mesmo** motivo | o motivo real, nomeado: `luz` (o portão global — ver passo 1) · `amostra` (vagas de coluna) · `ciclos` (ciclos sinódicos) · `poder` (*"rodaram sem poder para decidir entre as duas colunas"*) |
| `d = 0`, **motivos mistos**, ou mistura de `nenhum_padrao` com `inconclusivo` | a frase **não escolhe um motivo**: diz a partição e manda ao bloco — *"Duas pararam num portão e uma rodou sem poder; cada bloco diz qual, e em que unidade."* **Proibido** afirmar o motivo majoritário como se fosse de todas |

**Nenhum número sobe.** O quanto falta fica no bloco, com a unidade daquele motivo — ver
§Quantas noites faltam tem unidade. A frase pode dizer que faltou poder; nunca quanto.

**Passo 4 — a invariância, e o que ela é.** As **duas** linhas existem sempre, com os **dois**
compartimentos cada, na página e na linha de entrada, em qualquer tupla que o protocolo produza
e no estado pré-execução. Nenhuma linha some, nenhum compartimento some, não há variante curta,
e as duas nunca viram um número só.

> **Fechado em 01/10/2026.** Este parágrafo registrava que, com todas `nenhum_padrao`, o
> compartimento 1 dizia *"nenhuma decidiu"* — a mesma palavra de todas `inconclusivo` —, e que
> separá-las exigia trocar o verbo que o dono aprovou em tela. **Ele trocou.** A definição de
> *decidir* no passo 2 é a do veredito com poder, e o compartimento 1 passou a carregar a
> distinção do §5 sozinho.

### O que a moldura imprime, sempre

- **A moldura é invariável em campos, não em pixels.** Não existe variante curta da
  página para quando não deu nada.
- **Os cinco campos valem para as quatro fases.** Janela testada, desfecho, noites e ciclos,
  leitura e contador **não mudam de fase para fase** — por isso a moldura é uma só, acima dos
  blocos, e não se repete quatro vezes.
- **São três vereditos, não dois.** *"Nenhum padrão"* e *"inconclusivo"* não são a mesma
  coisa: um teste com poder que não acha nada é informação; um teste sem poder que não
  acha nada é silêncio, e imprimi-lo como "nenhum padrão" seria mentir com o mesmo tom de
  voz. Os três valem **por fase**: uma execução pode terminar com vereditos diferentes nas
  quatro — são **81 tuplas** possíveis, e é por isso que o texto da abertura sai de uma
  **regra**, não de uma lista de casos. Ver §A regra de composição.
- **O inconclusivo imprime o quanto falta no bloco da sua fase**, no mesmo corpo de letra de
  um achado — e **com a unidade daquele motivo**. **O número** nunca sobe para a frase
  coletiva; o **motivo** sobe quando é o da luz, que é global — ver §Quantas noites faltam tem
  unidade.
- **O contador de execuções é visível.** Se foram seis, a página diz *sexta execução*.
  Cada tentativa é permanente e contável — nunca substitui, **acumula**.
- **A próxima leitura é impressa na página.** Reexecuta a cada +100 noites, por cadência
  pré-fixada, não por vontade. **No quarto estado o campo imprime uma frase, não uma data**, e a
  frase é a **condição**: *quando a primeira execução autorizada rodar — as quatro juntas*. A
  cadência de +100 noites governa a **re**execução e documento nenhum fixa a data da primeira;
  fabricar uma data ali seria inventar compromisso. E **nome de story não entra no campo**: *"a
  primeira execução da 4.2"* era vocabulário de desenvolvimento num campo de leitor, e fazia o
  quarto estado parecer *esperando o build* em vez de *esperando dado* — que é a diferença exata
  que o campo existe para dizer.
- **A covariável aparece no rodapé do método**, e **sobe quando o portão da luz é o que
  reprovou** — para o bloco de cada fase **e para as duas linhas da frase coletiva**. Sem horas
  de luz o teste não roda: a janela lunar anda pelo calendário, a luz na Bélgica vai de ~8 h a
  ~16 h 30, e um achado lunar seria um achado sazonal com outro nome. Quando é isso que barra o
  teste, o leitor tem que saber que foi isso.

  > **Corrigido em 30/09/2026 contra o código.** As duas espinhas diziam que *"o portão é por
  > fase, então a subida é por bloco — não para a frase coletiva"*. **O portão da luz é global às
  > quatro**, e está escrito no motor já mergeado: *"Portão 1 — a luz. Global às quatro: é
  > pré-requisito do §3, não ressalva"* (`sleep/lua-protocolo.ts`), com a mesma contagem passada
  > às quatro linhas e o campo do acervo declarando *"acima de zero, as quatro fases param"*. É
  > estrutural e não implementação: cada fase é comparada contra **todas as outras noites**, então
  > uma noite sem luz está em alguma coluna das quatro. A proibição de a luz subir para a frase
  > foi **derivada dessa premissa falsa** e cai com ela: como o motivo é global, o lugar certo
  > dele é justamente o segundo compartimento das duas linhas. E aí a razão *"não houve poder"*
  > seria **falsa** — nenhum poder foi calculado, o portão retorna antes —, além de apontar para o
  > conserto errado: mandaria esperar cem noites quando faltam três dias de covariável.
- **Há um quarto estado, antes dos três vereditos: o teste ainda não rodou.** A moldura
  aparece igual, com os campos que já existem (janela, desfecho, noites e ciclos), *Primeira
  leitura* no lugar de *Próxima leitura* e o contador em **nenhuma execução**. Os quatro blocos
  aparecem igual, cada um com o nome da fase e **"sem leitura"** — e *"sem leitura"* ocupa o
  lugar da **palavra de veredito**, na mesma tipografia e na mesma tinta dos outros três estados
  (`lua-veredito`, 21 / 26, serifada, `ink`). **Nunca em corpo menor e nunca em `ink2`:** são
  duas das três atenuações que a ADR 0045 §3 proíbe por nome, e este é o estado em que a página
  passa a maior parte do tempo. A frase que explica desce para a linha de apoio, que é onde
  `lua-apoio` pertence.
- **As execuções acumulam, então a página tem histórico.** O contador diz *sexta execução*
  porque houve cinco antes, e as cinco continuam gravadas. A página imprime a mais recente
  em corpo cheio e as anteriores como lista de veredito + data abaixo dela — sem isso, o
  contador anuncia um histórico que a tela esconde — e isso é gaveta com selo de honestidade.
  **Com quatro fases por execução, o grão dessa lista é pergunta nova** e está em §Open
  Questions: uma linha por execução com quatro vereditos dentro, ou quatro linhas por execução?

### Quantas noites faltam tem unidade, e ela varia por motivo

Os quatro motivos de inconclusivo **não se contam na mesma moeda**, e o vocabulário é fechado
no banco — o grão de `lua_execucoes` é uma linha por fase por execução justamente para que
`veredito`, `motivo` e a unidade do que falta sejam vocabulário fechado:

| Motivo | Unidade | O que o número conta |
|---|---|---|
| o portão da luz reprovou | `noites-sem-luz` | noites do acervo sem horas de luz. **Não se coletam: conserta-se o dado.** É o único dos quatro que é **global às quatro fases** |
| o portão da amostra reprovou | `noites-de-coluna` | vagas que faltam nas duas colunas somadas — nem toda noite nova preenche uma |
| o portão dos ciclos reprovou | `ciclos` | ciclos sinódicos que faltam. Colher cem noites do mesmo ciclo não move este número |
| os três portões passaram e faltou poder | `noites-coletaveis` | a **única** unidade em que *"faltam N noites"* é frase verdadeira |

> **Os quatro identificadores são do código, não desta espinha.** Eles nascem em
> `sleep/lua-protocolo.ts` (`UNIDADE_DO_MOTIVO`, story 4.2a) e desde a 4.2b são o **CHECK de
> `falta_unidade`** na migração `20260928130000_lua_execucoes.sql`, já mergeada. Estão grafados
> aqui **exatamente** como o banco os aceita — `noites-coletaveis` **sem acento**. A palavra
> acentuada é a exibida ao leitor; o identificador, não. Quem mexer aqui obedece ao código.

**A soma delas não é um número.** Então o quanto falta vive **no bloco de cada fase, com a
unidade dela**, e **nunca é somado na frase coletiva** — a frase pode dizer que faltou poder,
não quanto. Imprimir *"faltam 4 noites"* sobre `ciclos` erraria por ~118 dias. É a lição do
*"1 dias"* da story 2.8 chegando na tela.

**Três dos quatro motivos são por fase; o da luz é global.** `amostra`, `ciclos` e `poder` são
cobrados linha por linha, e podem reprovar fases diferentes na mesma execução — daí a regra do
passo 3 para motivos mistos, que proíbe afirmar o motivo majoritário como se fosse de todas.
`luz` não: acima de zero, as quatro param juntas, e é por isso que ele é o único motivo que sobe
para as duas linhas da frase coletiva. Uma execução **nunca** tem uma fase parada na luz ao lado
de outra parada em outro motivo — quem desenhar esse estado desenhou algo que o motor não produz.

Quando um portão reprovou, o bloco diz **efeito não medido** e não zero: *o portão reprovou
antes, e zero seria mentira*.

### Os quatro blocos, agrupados por família

A ordem é **por família**, e as três ordenadas pelo ciclo:

```
figura das quatro janelas          (sem legenda: ela desceu — ver §A dobra)
frase coletiva                     linha da cheia    (placar + o quê/por quê)
                                   linha das três    (placar + o quê/por quê)
legenda da figura + a medida dos 68%
moldura                            (cinco campos)
grupo — A cheia, sozinha                 α 5% · unilateral · direção do atraso
    bloco  lua cheia
grupo — Nova, crescente e minguante      α 1,67% (0,05 / 3) · bilateral
    bloco  lua nova
    bloco  quarto crescente
    bloco  quarto minguante
rodapé do método · procedência
```

**O cabeçalho de cada grupo carrega o α e a razão da separação.** O α é propriedade de
**família**, não de fase: agrupando, cada α aparece **uma** vez e a fronteira é a própria
disposição. Na ordem sinódica a cheia cairia no meio das outras três, cada bloco carregaria o
seu α, e a página imprimiria 1,67% três vezes e 5% uma, intercalados — o leitor teria de
reagrupar de cabeça para ver que existem duas famílias, que é exatamente o efeito que o §11
proíbe.

**A razão existe para que a posição da cheia não seja lida como hierarquia.** A precedência dela
é de **procedência** — foi pré-registrada em 07/09, com a direção tirada da literatura —, não de
importância. Sem a frase, quem abrir a página em 2027 lê *"a cheia primeiro"* como *"a cheia
importa mais"*.

**A razão de cada grupo diz o fato datado e não compara.** *"Antes das outras três"* é
comparativo e o fato não precisa ser: o comparativo instala, no menor corpo da página, a
hierarquia que a frase existe para negar — e a negação, feita no menor corpo contra cinco sinais
que todos favorecem a cheia (α mais folgado, poder maior, lateralidade que gasta menos, primeira
posição, respaldo de literatura), não impede a leitura: ela a pede de desconto. No grupo vizinho,
a ausência de literatura é **razão de desenho**, não carência das três: o §5 de 28/09 diz que
*"não existe literatura que dê direção a essas três"* e que a ausência dela *"é justamente o
argumento"* — então o cabeçalho a imprime como o que ela é, a razão de serem bilaterais.

> Redação autorada, não decidida (o memlog 60(e) já declarava as palavras como autoradas):
> *"Pré-registrada em 07 set 2026, com a direção tirada da literatura. A posição aqui é de
> procedência, não de importância."* / *"Nascidas juntas em 28 set 2026, sem direção na
> literatura — e é por isso que são bilaterais. Entre as três a correção por multiplicidade se
> aplica inteira."*

Custo aceito: a ordem dos blocos deixa de acompanhar o ciclo que a figura desenha. Aceito porque
a figura já dá a posição relativa melhor do que a ordem daria.

Cada bloco imprime, nas quatro fases, os mesmos campos: **nome da fase · palavra de veredito ·
o número com a unidade dele · a legenda do número · as linhas de apoio**. No quarto estado o
bloco existe igual e diz **"sem leitura"** — **não travessão**: travessão leria como nulo
**medido**, e a gramática de ausência da casa proíbe confundir ausência de medida com medida
nula. E *"sem leitura"* ocupa a **vaga da palavra de veredito**, no degrau dela: 21 / 26,
serifada, `ink`. Imprimi-lo em 12,5 / 18 em `ink2` é **corpo menor mais tinta de apoio**, duas
das três atenuações que a ADR 0045 §3 proíbe por nome, no estado que o leitor vai encontrar por
meses.

### O efeito na direção que o pré-registro não cobre

A cheia é unilateral no atraso. Um **adiantamento** medido ali não é achado por este protocolo —
e a moldura é invariável em campos, então o bloco imprime o efeito de qualquer jeito: *−40 min*
ao lado de *"nenhum padrão"*.

**O bloco explica isso em uma linha, no mesmo corpo dos outros rótulos** — sem ícone, sem cinza
e sem itálico apologético, porque a ADR 0045 §3 proíbe os três. Não imprimir o efeito nesse caso
quebraria a moldura invariável; e uma página que imprime os dois sem explicar não é discreta, é
incoerente — parece defeito, e o leitor conclui que a tela quebrou em vez de que o protocolo
recusou a direção.

O risco de a explicação virar manchete está fechado **por construção**, não por disciplina: um
adiantamento na cheia produz *"A cheia não decidiu"* na linha da família, e a explicação não tem
caminho até a frase coletiva.

### A figura que abre a página não tem estado

**As quatro janelas são destacadas igualmente.** A figura entrega, antes de qualquer texto, a
**geometria** do protocolo: quatro janelas de cinco noites, vinte noites dentro de uma janela —
**68% do ciclo** — e o que sobra fora de todas elas. São **trinta noites desenhadas para um ciclo
de 29,5**: o desenho arredonda, e a legenda diz o número exato para que ninguém derive 20/30 da
contagem de discos. Ela abre a página porque **é dado, não símbolo**.

> **Corrigido em 30/09/2026.** Este parágrafo afirmava que a figura *"explica os α menores, a
> contaminação das colunas e o poder baixo"*. Nenhuma das três é derivável de um desenho: os α
> vêm do argumento de procedência do §3, a contaminação vem de saber que cada fase é comparada
> contra todas as outras noites (§7, e na página isso está no rodapé do método), e o poder vem das
> tabelas do §6 e da geometria 49 × 241. A figura entrega **a geometria**; os elos que a
> transformam em explicação são texto. A figura segue abrindo a página — ela é dado, e isso basta
> —, mas era o argumento inflacionado que pagava a dobra, e ele cai.

**Não tem estado:** não destaca uma fase por vez, não acompanha a rolagem, não é tocável. Uma
figura com estado vira a coisa que o leitor olha em vez de ler. O complemento — as ~9,5 noites
por ciclo fora de todas as janelas, cerca de 93 das 290 — é boa nota **dentro do rodapé do
método**, não a primeira coisa que a página diz.

### A dobra, e por que ela é aceitável

**Nenhum bloco de fase cabe na primeira tela.** Medido nos quatro quadros da prancha **com as
fontes reais do app**, a dobra dos 844 px cai **dentro da moldura**: a primeira tela entrega o
desenho, a frase coletiva inteira e a maior parte da moldura, e os quatro vereditos ficam abaixo.

> **Esta espinha não nomeia a linha em que a dobra cai, de propósito.** Três medições deram três
> linhas diferentes — *Noites e ciclos*, *Próxima leitura* e *Desfecho* — porque a posição
> depende da fonte, do corpo e do estado. **O que é estável é a folga**, e é ela que está escrita
> abaixo. Quem nomear a linha de novo cria um quarto número que ninguém sabe confrontar.

> **Número corrigido em 30/09/2026.** Estas espinhas diziam *"na linha Noites e ciclos"*. A
> prancha **não embarca `@font-face`**, então medida sozinha num Mac ela cai no fallback do
> sistema e a página inteira fica ~45 px mais baixa — e nesse fallback a dobra cai, sim, em
> *Noites e ciclos*. Com Manrope, Geist Mono e Instrument Serif, que é o que o aparelho usa, cabe
> mais coisa acima. O erro estava na direção segura e não muda nenhuma conclusão; quem remedir,
> **diga com que fontes**, senão aparece um terceiro número e ninguém sabe qual vale.

Aceito como está, e o que paga a conta é a **frase coletiva estar acima da dobra**: ela já diz,
por família, quantas decidiram e qual, então o veredito não está fora da primeira tela — só o
detalhe dele está. Recusadas as duas alternativas: mover a moldura para depois dos blocos, e
encolher o desenho.

**Mas a aceitação vale para corpo normal, e não para corpo de acessibilidade.** Remedido em
01/10/2026 com as **duas** linhas de família e com o conserto de ordem abaixo já aplicado, nas
fontes reais, no pior dos quatro estados: a frase coletiva cabe inteira até a escala **1,45**,
com **71 px de folga no XXXL (1,353)**, que é o maior corpo não-acessibilidade; **quebra a partir
de 1,5**, onde faltam 11 px; e faltam **252 px no AX1 (1,786)** e **1.019 px no AX3**. Acima da
frase, no AX1, restam 400 px, dos quais **86 são SVG congelado** — **nenhum arranjo de ordem
fecha o AX3**, e isto está escrito para ninguém tentar. Isso é a ADR 0045 §3 sendo violada **por corpo de letra**, exatamente para
quem o `DESIGN.md` nomeia ao proibir altura fixa: *quem lê em AX3 é quem tem baixa visão*. Não é
o defeito de altura congelada — nada aqui é congelado, e os blocos crescem; o texto é empurrado
para **fora da primeira tela**, que é o que a aceitação da dobra comprou.

**O conserto não redecide nada, e é de ordem:** a **legenda da figura e a medida dos 68% descem
para depois da frase coletiva**. Elas são o texto que engorda com o corpo (somam 80 px no padrão,
**307 px no AX1** e **693 px no AX3** — medidos em 01/10, contra os 257 e 551 **estimados**, que
eram baixos), e a figura não engorda — ela é SVG. A figura continua abrindo a página e a frase
coletiva continua sendo o **primeiro texto**; o que desce é a **explicação** da figura, não a
figura. É esse conserto que faz o XXXL caber com folga em vez de raspar, e é a única
das três saídas que não mexe em nada que o dono escolheu — as duas que ele recusou em 30/09 foram
recusadas contra a medida do **corpo padrão**, e esta não estava na mesa.

> **Remedido em 01/10/2026, e é por isso que a emenda pode ser assinada.** Os números acima já
> são os da frase de **duas** linhas, nas fontes reais, com o conserto de ordem aplicado. A frase
> perdeu **um degrau** por causa da segunda linha (o último corpo seguro foi de 1,5 para 1,45) e o
> conserto de ordem pagou quase a diferença.
>
> **E a emenda à ADR 0045 muda de objeto por causa desta medida.** Ela declara a garantia sobre a
> **linha de entrada**, não sobre a página: a linha vive no pé do caderno Sono, **não tem dobra
> própria** — ninguém a lê sem rolar, em corpo nenhum — e é **íntegra em todas as escalas**
> (141 px no padrão, 290 px no AX1, os dois compartimentos das duas famílias nos quatro estados).
> O que a emenda **não pode** afirmar é que a *página* entrega o veredito na primeira tela: de
> **1,5** para cima ela não entrega. A mitigação sempre foi a linha de entrada; o erro de 08/09
> foi declará-la sobre a página.

> **Limitação declarada, com a mitigação ao lado.** No **AX3** a segunda linha de família começa
> **216 px abaixo da dobra**: a página não mostra, sem rolar, que existem **duas** famílias — o
> efeito que o §11 de 28/09 proíbe. Isso é consequência do placar por família, que entrou para
> obedecer ao §2, e não tem conserto de ordem (ver acima: nem 86 px de SVG saem do caminho). **A
> mitigação é a mesma da emenda:** a linha de entrada carrega as duas famílias e é íntegra em
> todas as escalas, então o que o AX3 esconde na página, a linha mostra.

### O cabeçalho de sub-página, e o que ele não tem

A página da lua **tem cabeçalho de sub-página sangrando na cor do Sono** — é assim que ela diz
de qual caderno saiu, e é o que a prancha aprovada desenha. O que ela **não tem é o ícone**: o
ícone é o portador de identidade de **caderno** (CAP-7), e esta é sub-página.

> **Emendado em 30/09/2026.** O texto anterior das duas espinhas dizia que a página *"não tem
> faixa"*. A aprovação do dono foi sobre o **renderizado**, então o desenho vence e o texto se
> corrige: há cabeçalho sangrado, não há ícone. Registrado para ninguém "corrigir" a prancha de
> volta lendo a espinha velha.

Para o leitor de tela o cabeçalho é o título da sub-página, com o nome do caderno de origem; o
botão de voltar dentro dele volta ao caderno Sono na posição em que estava.

### O que a página nunca faz

- **Nenhum secundário vira manchete.** Duração, latência e despertares são exploratórios
  **só na cheia** — para as três novas não são relatados por fase (§8 de 28/09) — e **não
  entram na capa da edição sob nenhuma condição**.
- **Nenhuma causa é afirmada.** O teste mede associação; a hipótese de mecanismo não é
  dele.
- **A página não assina modelo.** Ela não é narrada, é calculada — e a procedência que ela
  imprime é a **cadeia de pré-registros** que autorizou a execução: os dois documentos e as duas
  correções, com o hash de cada um, mais as versões carimbadas por execução (**régua** e
  **aritmética**) e o contador.

  > **Rótulo renomeado em 30/09/2026.** A versão carimbada da conta se chamava `motor v1`. Neste
  > app *motor* é a palavra de **motor de IA**, visível ao usuário em `/configuracoes/motores` e
  > nas ADRs 0047, 0048 e 0049 — então `motor v1` num rodapé de procedência lê como **assinatura
  > de modelo**, que é justamente o que esta página declara não fazer três parágrafos acima. O
  > que o rótulo carimba é a **aritmética**: Hodges–Lehmann, Mann–Whitney e a conta de poder,
  > versionadas porque trocá-las depois de ver o resultado não deixaria rastro. O rótulo passa a
  > ser `aritmética v1`.

**A página fica atrás de um toque, e isso exige emendar a ADR 0045.** A cláusula §3 diz,
literalmente: *"O negativo não vai em cinza, em itálico apologético, em corpo menor, **atrás
de um toque**, nem acompanhado de ícone de aviso."* A sub-página foi mantida por decisão do
dono em 08/09/2026, com a cláusula na mão.

A mitigação é a linha de entrada, e **desde 30/09/2026 o que ela carrega é a frase coletiva** —
duas linhas, uma por família, com os dois compartimentos cada —, de modo que quem nunca tocar lê
o resultado assim mesmo. O que é invariável nela é a **forma**: as duas linhas, os dois
compartimentos, a mesma tipografia e a mesma extensão de campos, **em qualquer tupla que o
protocolo produza**. A redação de *"idêntica nos três casos"* morreu quando as fases viraram
quatro.

**E o objeto da emenda não é uma frase, é a regra.** A mitigação é uma afirmação universal —
*"quem nunca tocar lê o resultado"* —, e uma emenda escrita contra *"a frase coletiva"* declararia
satisfeita uma garantia que só existe autorada em três das 81 tuplas. A emenda declara que **a
linha de entrada carrega o veredito por extenso para toda tupla que o protocolo possa produzir** e
cita §A regra de composição, que é o que produz o texto de cada uma.

Mas mitigação não revoga cláusula. **A emenda à ADR 0045 era pré-requisito de construção, e foi
escrita em 01/10/2026** — está na própria ADR, como `## Emenda de 2026-10-01`, no precedente da
emenda da ADR 0050. Ela declara a garantia sobre a **linha de entrada**, enfrenta o *"corpo
menor"* do §3 em vez de contorná-lo (a paridade que a cláusula cobra é entre negativo e positivo,
não entre superfícies), e **não** afirma que a página entrega o veredito na primeira tela. O
parágrafo abaixo descreve o raciocínio de 08/09 que levou a ela —
regra da casa: quem derruba uma lei, derruba declarando. Ela é trabalho fora desta sessão de
UX, e não está feita.

## Interaction Primitives — primitivas de interação

| Primitiva | Regra |
|---|---|
| **Rolagem** | A edição é um documento contínuo. Uma rolagem, do começo ao fim |
| **Âncora** | A linha do sumário rola até a faixa do caderno. Sem pilha de navegação |
| **Toque** | Alvo mínimo de 44 px. Três alvos na edição: linha de sumário, entrada da lua, capa da parede |
| **Voltar** | Sai da edição inteira. Da página da lua, volta ao caderno Sono na posição em que estava |
| **Gesto horizontal** | **Nenhum.** Não há troca de período por deslizar, nem carrossel de capas. A borda esquerda pertence ao voltar do sistema |
| **Compartilhar** | **Não existe** em lugar nenhum da revista |
| **Hover / tooltip** | Não existem. No celular não há hover — o apoio fica visível no lugar, como o `support` dos destaques já faz |

## Accessibility Floor — piso de acessibilidade

- **Cor nunca é o único portador de significado.** A identidade do caderno é
  cor **+ ícone + nome**. Laranja e vermelho medem ΔE 4,1 a 9,9 em cinco das seis
  paletas; o ícone é o que sustenta a distinção ali, e é também o que a sustenta sob
  daltonismo.
- **Ordem de leitura de tela** segue a ordem visual, que é a ordem impressa (`posicao`).
  A faixa é cabeçalho de seção para o leitor de tela — o nome do caderno é o rótulo, e o
  ícone é decorativo.
- **A imagem da capa tem descrição textual**: a legenda de três campos já é a descrição
  (`Ittre · km 31,1 · 12:38`). Quando a capa é traçado, a descrição é o período e a rota.
- **A rolagem ancorada move o foco do leitor de tela.** Tocar uma linha do sumário rola a
  página; sem `setAccessibilityFocus` na faixa de destino, quem usa VoiceOver toca e nada
  acontece — a única navegação da revista seria inerte. Hoje nem
  `setAccessibilityFocus` nem `announceForAccessibility` aparecem em `mobile/src/`, então
  isto é código novo, não ajuste.
- **A coluna de rótulos da moldura é dimensionada por conteúdo, COM TETO.** Largura fixa é
  proibida — medido, 104 px fazia *"Próxima leitura"* quebrar em duas linhas já no corpo padrão, e
  no AX3 *"Execuções"* pedia 174 px. Mas `max-content` **sem teto** troca um defeito por outro:
  medido em 01/10, a coluna vai a 281 px no AX3, come a do valor e depois transborda os 340 px
  (+15 px no AX1, +158 no AX3) — e antes de transbordar **estrangula o valor** a 137 px no AX1,
  onde `~49 dentro · 241 fora, por fase` vira cinco linhas. No iOS o que é recortado é o **valor**,
  não o rótulo. O teto é **40% da moldura**, e acima dele o rótulo empilha sobre o valor em vez de
  disputar a linha com ele.
- **Tipo dinâmico honrado, e nada de dimensão fixa onde há texto.** A faixa cresce com o
  nome — altura mínima, nunca fixa. Os casos mais graves são a moldura da lua **e os quatro
  blocos de fase**: cortar o veredito em AX3 anula a garantia da ADR 0045 exatamente para quem
  tem baixa visão, e agora há quatro lugares onde isso pode acontecer.
- **A regra é de dimensão, não de altura — e o eixo esquecido era a largura.** A regra dizia
  *"nada de altura fixa"*, e por isso não pegava a **coluna de rótulos da moldura da lua**,
  congelada em 104 px. Medido com as fontes reais: *"Próxima leitura"* já quebra em **duas
  linhas** no corpo padrão; no **AX1** *"Desfecho"* pede 105 px e *"Execuções"* 121 px, palavras
  únicas, sem oportunidade de quebra — corte ou transbordo; no **AX3** os cinco transbordam e
  *"Execuções"* pede **174 px numa coluna de 104**. São exatamente os cinco rótulos que esta
  espinha promoveu de `ink3` para `ink2` **porque são informação obrigatória**: subir a tinta e
  congelar a caixa cancela metade do trabalho. **A coluna dimensiona por conteúdo** — largura da
  maior etiqueta, ou o rótulo empilha acima do valor a partir de AX1 — e nenhuma caixa com texto
  tem largura, altura ou proporção congelada.
- **Na página da lua o α tem que viajar com o bloco.** Ele é impresso **uma vez por família**,
  no cabeçalho do grupo — então cada grupo é uma região rotulada, e o leitor de tela que entra
  num bloco de fase chega nele pelo cabeçalho que diz o α e a razão. Sem isso, a economia de
  imprimir o α uma vez vira perda de informação para quem não vê a disposição.
- **O cabeçalho de sub-página é o cabeçalho da página** para o leitor de tela, com o nome do
  caderno de origem. Não tem ícone, então não há nada decorativo a suprimir ali.
- **A figura das quatro janelas tem descrição textual obrigatória** — as quatro janelas, as
  cinco noites de cada uma e o instante da fase caindo fora delas. A figura é dado, e é por isso
  que a descrição é obrigatória. **Os 68% viajam em prosa**, não no `alt`: na medida logo depois
  da frase coletiva e de novo no rodapé do método. Escrito assim para ninguém "consertar" enfiando
  o número no `alt` e apagando o parágrafo — o portador é o parágrafo.
- **Informação obrigatória não usa `ink3`.** Medido no claro: `ink3` dá 3,05 sobre
  `surface` e **2,87 sobre `bg`** — abaixo até do piso de objeto gráfico. Assinatura,
  rótulos da ficha da lua e período das capas usam `ink2` (7,52 / 7,09), no mesmo corpo.
- **Alvo de toque ≥ 44 px** em todos os três alvos.
- **Contraste medido, não conferido**: `onAccent` mínimo 4,25 nas 36 combinações. O texto
  sobre a capa é o único ponto em que o contraste depende de uma imagem que o app não
  escolhe; o piso do véu está em [`DESIGN.md`](DESIGN.md) §Elevation & Depth.
- **A paleta acessível é a única `cvdSafe`.** As outras cinco são estéticas e não prometem
  separação; por isso a identidade não depende só delas.

## Key Flows — jornadas

### 1. Sydnei reabre agosto, seis semanas depois

É o **sinal de sucesso do spec**, e a única jornada que a revista precisa ganhar.

1. Sydnei abre a Retrospectiva no iPhone, sem ser convidado a isso. Escolhe agosto/2026 —
   um mês que **já leu**.
2. A capa carrega: a foto de uma parada em Ittre, com `Ittre · km 31,1 · 12:38`, e a
   manchete de **Movimento** sobre ela.
3. Ele rola. O sumário traz quatro chamadas, Movimento em primeiro.
4. Ele toca **SONO** e a página rola até a faixa azul.
5. **Clímax:** ele fecha e diz, sem olhar de novo, **qual caderno liderou e por quê** — foi
   Movimento, porque os anéis pararam em agosto. A edição que ele acabou de ler é
   **palavra por palavra e na mesma ordem** a de seis semanas atrás, mesmo com
   `ordenarCadernos` tendo mudado no meio-tempo.

### 2. Sydnei imprime setembro

1. Outubro começa. Setembro fechou.
2. Ele abre setembro e encontra a capa e o convite de escrever a edição — **nada foi
   gerado sozinho**; folhear não custou nada.
3. Ele toca. Quatro cadernos são narrados a partir de **quatro pacotes separados** — o de
   Sono não sabe quantos quilômetros ele pedalou.
4. O caderno de Rotina **reprova na conferência**: o texto citou um número sem nomear a
   base.
5. **Clímax:** a tela diz que aquele texto foi **descartado**, e por quê. Os outros três
   cadernos estão impressos e íntegros. Ele manda escrever de novo só o que falhou — e
   entende, sem que ninguém explique, que a revista prefere não dizer a dizer errado.

> **Ressalva de construção nesta jornada.** Reimprimir um caderno só precisa conviver com
> `unique (user_id, tipo_periodo, inicio, fim, posicao)`. Se o caderno reprovado voltar com
> `posicao` diferente da que os outros três já gravaram, o banco recusa. Ou a `posicao` do
> caderno reprovado é reservada na primeira impressão, ou o conjunto é reordenado em
> transação. É decisão de arquitetura, não de UX, e está aberta.

### 3. Sydnei abre a página da lua e não encontra nada

Esta jornada existe para um resultado **negativo**. É o teste da ADR 0045.

> Referência visual: [`mockups/key-lua-quatro-fases.html`](mockups/key-lua-quatro-fases.html) — o estado 1 é exatamente esta jornada, e é onde a página vai viver depois da primeira execução.

1. Dentro do caderno Sono, no pé, **duas linhas, uma por família**, cada uma em dois
   compartimentos: *"A cheia não decidiu."* / *"O teste rodou sem poder para decidir entre as
   duas colunas."* e *"Nenhuma das três decidiu."* / *"Os três testes rodaram sem poder para
   decidir entre as duas colunas."*
2. Ele já leu o resultado — **a linha carrega a frase coletiva inteira**, e ela não junta as duas
   famílias num número. Tocar é opcional.
3. Ele toca. A página abre com **o ciclo sinódico desenhado** e as **quatro janelas de cinco
   noites destacadas igualmente**. Antes de qualquer texto.
4. O primeiro texto são **as mesmas duas linhas** que estavam na entrada — nada de novo, e é isso
   que prova que a linha não era resumo.
5. Abaixo delas, a legenda da figura e a medida: vinte das 29,5 noites do ciclo, **68% dele**.
6. A moldura: janela testada · hora de apagar · ~49 noites dentro × ~241 fora, 17 ciclos ·
   próxima leitura a cada +100 noites · **primeira execução**. A dobra cai aqui, dentro dela.
7. Ele rola e encontra **dois grupos**: a cheia sozinha a 5% unilateral, e as outras três a
   1,67% bilateral, cada cabeçalho dizendo por que estão separadas. Quatro blocos, quatro
   *inconclusivo* — **106 noites coletáveis** na cheia, **382** em cada uma das três.
8. **Clímax:** cada veredito ocupa **o mesmo corpo de letra** que ocuparia um achado, e o número
   do que falta vem **na unidade dele**. Ele tinha um prior declarado sobre a lua — *"estou me
   observando nisso já faz um tempo"* — e o que a página lhe entrega é que **o teste ainda não
   tem poder para responder**, escrito com a mesma seriedade com que teria escrito um sim. Nada
   some, nada encolhe, e a próxima leitura tem cadência.

### 4. Sydnei folheia até 2023

1. Ele abre o arquivo. **Duas colunas de capas**, ~6 por tela, da mais recente para trás.
2. As primeiras são fotografias — 2026.
3. Ele rola. Em algum ponto de 2025 as fotos acabam e começam os **traçados**: rotas
   belgas desenhadas, uma por período, cada uma diferente.
4. **Clímax:** ele não precisa de nenhuma legenda para saber **quando começou a
   fotografar**. A parede conta isso pela textura. E ele chegou lá **folheando capas**, não
   escolhendo datas num seletor.

## Open Questions — questões em aberto

A sessão começou com o contrato declarando **zero perguntas abertas**. A passagem de UX
abriu estas — e as três primeiras **não são de UX**: são contradições dentro do próprio
contrato, verificadas no código e nos documentos.

### Defeitos no contrato — resolver antes de construir

| # | O quê | Prova |
|---|---|---|
| 1 | ~~**A lua não tem chave legal no banco.** O pré-registro §7.2 manda gravar `caderno='lua'`; o CHECK recusa. E a chave primária inclui `caderno`, o que torna o *"nunca substitui — acumula"* impossível de qualquer forma~~ · **Resolvido pelo contrato, não por esta espinha:** o quarto elo da cadeia (30/09) move a execução para `lua_execucoes` e declara o grão — **uma linha por fase por execução**, quatro por identificador, cobradas no commit | [`correcao-2-pre-registro-lua-outras-fases.md`](../../../../docs/specs/revista-retrospectiva/correcao-2-pre-registro-lua-outras-fases.md) §Correção 3 e §O grão da tabela |
| 2 | **`hidden` não fala a língua dos cadernos.** CAP-14 diz que `hidden` continua funcionando sobre cadernos, e `mudancas-mecanicas.md` diz "sem migration" — mas `hidden` é `Partial<Record<RetroBlockId, string>>`, e `RetroBlockId` é `lede`/`kpis`/`highlights`/…, nenhum caderno | [`retro-blocks.ts:87`](../../../../packages/shared/src/period/retro-blocks.ts) |
| 3 | ~~**A ADR 0045 §3 proíbe o negativo "atrás de um toque"**~~ — **RESOLVIDA em 01/10/2026: a emenda está escrita**, na própria ADR, como `## Emenda de 2026-10-01`. A lua ficou atrás de um toque por decisão do dono. O que 30/09 mudou é o **objeto** dela: não *"idêntica nos três casos"*, nem *"a frase coletiva"* como frase, mas **§A regra de composição** — a emenda declara que a linha de entrada carrega o veredito por extenso para toda tupla que o protocolo produza, e cita a regra. **A medida que faltava foi feita em 01/10 e a emenda é assinável:** ela declara a garantia sobre a **linha de entrada**, que não tem dobra própria e é íntegra em todas as escalas — e **não** pode afirmar que a *página* entrega o veredito na primeira tela, porque de 1,5 para cima não entrega. Ver §A dobra | [`0045`](../../../../docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md) §3 |
| 4 | **A capa não congela.** `coverOf` lê `isCover` e `state==='linked'`, os dois mutáveis depois da impressão — a estrela, o vínculo automático de 40 m, o `ph://` que some da biblioteca. A foto de agosto pode ser outra seis semanas depois, contra *"período fechado congela"* | `photos/retro.ts` |
| 5 | **Lápide × caderno vazio se contradizem.** O passo 5 força posição 1; o passo 6 tira o caderno vazio da lista. O mês em que o relógio para é justamente o mês sem dado, e `ordenarCadernos` é declarada determinística | [`bases-e-ranqueamento.md`](../../../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md) §ranqueamento |
| 6 | **`posicao` congelada × reimpressão por caderno.** Reimprimir um caderno só pode bater no `unique (…, posicao)` | ver a ressalva na jornada 2 |
| 7 | **Errata em massa.** `AGG_VERSION` é global e já se moveu nove vezes; um bump marca todas as edições de uma vez | `mudancas-mecanicas.md` |

### Não declarado — a UX não inventa

| # | O quê | Por que trava |
|---|---|---|
| 8 | **De onde sai a "chamada".** `cadernos.md` diz que é *"a manchete que o próprio caderno já escreveu"*, mas não diz como se extrai do texto — primeira frase? campo à parte? Sem isso **nem a capa nem o sumário são construíveis** | bloqueia CAP-8 e CAP-10 |
| 9 | **O que a tira do anuário mede.** Ela tem 12 marcas na cor do caderno, e nenhum documento diz de qual valor. E ela substitui o `yearSeries` do contrato sem citá-lo | bloqueia CAP-9 |
| 10 | **A camada de luz não tem superfície.** CAP-6 põe luz em todos os pacotes e `cadernos.md` exige *"no trimestre, a camada de luz em destaque"* — nada disso foi desenhado. É omissão desta sessão | CAP-6 |
| 11 | **O sumário em estado misto.** Duas das quatro chamadas não existem quando um caderno está sendo escrito e outro foi reprovado. A linha some, fica sem chamada, ou o sumário só aparece completo? | estados |
| 12 | **A manchete da capa sem `posicao = 1`** — quando o caderno líder está sendo escrito, foi reprovado, ou a edição ainda não foi impressa | estados |
| 13 | **A ressalva de cobertura desigual não tem forma.** É restrição do contrato e nenhuma das duas espinhas diz como ela aparece na tela | restrição |
| 14 | **O Arquivo não tem estados.** 436 capas, muitas apontando para a biblioteca de fotos do iPhone: carregando, foto sumida, rolagem longa | CAP-10 |
| 15 | **Onde vai o seletor de período**, e o que acontece com os doze blocos da Retrospectiva de hoje | ver §Onde a revista mora |
| 16 | **O grão do histórico de execuções, agora que cada execução tem quatro fases.** A regra de imprimir a mais recente em corpo cheio e as anteriores como lista de veredito + data foi escrita quando havia um veredito por execução. Com quatro, a lista é uma linha por execução com os quatro vereditos dentro, quatro linhas por execução, ou só os **dois placares de família** por execução? Aberto em 30/09/2026, e não aparece em nenhum dos quatro estados da prancha — todos são de primeira execução ou de nenhuma | CAP-12 · ADR 0045 |

### Fechado, mas com custo declarado

- **`onAccent` é mudança no sistema de tema**, não na revista: entra em `derive.ts` com
  barreira em `theme.test.ts` e passa a existir para todo papel.
- **A separação laranja × vermelho** fica sustentada pelo ícone nas cinco paletas
  estéticas. Se em uso real a semelhança incomodar mesmo com o ícone, o caminho já medido
  é remapear Coração — não retocar hex, que o sistema não permite.
- **`bicycle-outline` é ícone novo** e assume o viés da pedalada sobre corrida e caminhada.
