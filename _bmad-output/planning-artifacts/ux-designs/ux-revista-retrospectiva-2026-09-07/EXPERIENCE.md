---
name: A revista da Retrospectiva
description: Arquitetura de informação, comportamento, estados e jornadas da Retrospectiva como revista. Par do DESIGN.md, que é dono da aparência.
status: final
updated: 2026-09-08
sources:
  - ../../../../docs/specs/revista-retrospectiva/spec.md
  - ../../../../docs/specs/revista-retrospectiva/cadernos.md
  - ../../../../docs/specs/revista-retrospectiva/bases-e-ranqueamento.md
  - ../../../../docs/specs/revista-retrospectiva/mudancas-mecanicas.md
  - ../../../../docs/specs/revista-retrospectiva/pre-registro-lua.md
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
| **Entrada da lua** | Tocável, alvo de linha inteira. Carrega o veredito por extenso: quem não tocar já leu o resultado. |
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

> Referência visual: [`mockups/key-lua.html`](mockups/key-lua.html) — os três vereditos e as três linhas de entrada.

O que o protocolo obriga a interface a fazer, e que nenhuma outra tela do app faz.

### O que a moldura imprime, sempre

- **A moldura é invariável em campos, não em pixels.** Não existe variante curta da
  página para quando não deu nada.
- **São três vereditos, não dois.** *"Nenhum padrão"* e *"inconclusivo"* não são a mesma
  coisa: um teste com poder que não acha nada é informação; um teste sem poder que não
  acha nada é silêncio, e imprimi-lo como "nenhum padrão" seria mentir com o mesmo tom de
  voz.
- **O inconclusivo imprime quantas noites faltam**, no mesmo corpo de letra de um achado.
- **O contador de execuções é visível.** Se foram seis, a página diz *sexta execução*.
  Cada tentativa é permanente e contável — nunca substitui, **acumula**.
- **A próxima leitura é impressa na página.** Reexecuta a cada +100 noites, por cadência
  pré-fixada, não por vontade.
- **A covariável aparece no rodapé do método**, e **sobe para o veredito** quando o portão
  da luz do dia é o que reprovou. Sem horas de luz o teste não roda: a janela lunar anda
  pelo calendário, a luz na Bélgica vai de ~8 h a ~16 h 30, e um achado lunar seria um
  achado sazonal com outro nome. Quando é isso que barra o teste, o leitor tem que saber
  que foi isso.
- **Há um quarto estado, antes dos três vereditos: o teste ainda não rodou.** A moldura
  aparece igual, com os campos que já existem (janela, desfecho, noites e ciclos) e a data
  da primeira leitura no lugar da próxima. É o estado em que a página passa a maior parte
  do tempo, e omiti-lo seria justamente o modo de falha que a ADR existe para impedir.
- **As execuções acumulam, então a página tem histórico.** O contador diz *sexta execução*
  porque houve cinco antes, e as cinco continuam gravadas. A página imprime a mais recente
  em corpo cheio e as anteriores como lista de veredito + data abaixo dela — sem isso, o
  contador anuncia um histórico que a tela esconde — e isso é gaveta com selo de honestidade.

### O que a página nunca faz

- **Nenhum secundário vira manchete.** Duração, latência e despertares são exploratórios e
  **não entram na capa da edição sob nenhuma condição**.
- **Nenhuma causa é afirmada.** O teste mede associação; a hipótese de mecanismo não é
  dele.
- **A página não assina modelo.** Ela não é narrada, é calculada — e a procedência que ela
  imprime é o **hash do pré-registro** que autorizou a execução.

**A página fica atrás de um toque, e isso exige emendar a ADR 0045.** A cláusula §3 diz,
literalmente: *"O negativo não vai em cinza, em itálico apologético, em corpo menor, **atrás
de um toque**, nem acompanhado de ícone de aviso."* A sub-página foi mantida por decisão do
dono em 08/09/2026, com a cláusula na mão.

A mitigação é a linha de entrada: ela carrega **o veredito por extenso**, com tipografia e
extensão idênticas nos três casos, de modo que quem nunca tocar lê o resultado assim mesmo.
Mas mitigação não revoga cláusula. **A emenda à ADR 0045 é pré-requisito de construção** —
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
- **Tipo dinâmico honrado, e nada de altura fixa onde há texto.** A faixa cresce com o
  nome — altura mínima, nunca fixa. O caso mais grave é a moldura da lua: cortar o veredito
  em AX3 anula a garantia da ADR 0045 exatamente para quem tem baixa visão.
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

1. Dentro do caderno Sono, no pé, uma linha: o teste lunar rodou, e **faltam cerca de 106
   noites** para ele ter poder.
2. Ele já leu o resultado — **a linha o carrega por extenso**. Tocar é opcional.
3. Ele toca. A página abre com **a fase sinódica desenhada**: o disco, e a fatia das cinco
   noites que antecedem a cheia.
4. A moldura: janela testada · hora de apagar · ~49 noites dentro × ~241 fora, 17 ciclos ·
   próxima leitura a cada +100 noites · **primeira execução**.
5. **Clímax:** o veredito ocupa **a mesma altura e o mesmo corpo de letra** que ocuparia um
   achado. Ele tinha um prior declarado sobre a lua — *"estou me observando nisso já faz um
   tempo"* — e o que a página lhe entrega é que **o teste ainda não tem poder para
   responder**, escrito com a mesma seriedade com que teria escrito um sim. Nada some, nada
   encolhe, e a próxima leitura tem data.

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
| 1 | **A lua não tem chave legal no banco.** O pré-registro §7.2 manda gravar `caderno='lua'`; o CHECK recusa. E a chave primária inclui `caderno`, o que torna o *"nunca substitui — acumula"* impossível de qualquer forma | [`mudancas-mecanicas.md:12`](../../../../docs/specs/revista-retrospectiva/mudancas-mecanicas.md) × [`pre-registro-lua.md:159`](../../../../docs/specs/revista-retrospectiva/pre-registro-lua.md) |
| 2 | **`hidden` não fala a língua dos cadernos.** CAP-14 diz que `hidden` continua funcionando sobre cadernos, e `mudancas-mecanicas.md` diz "sem migration" — mas `hidden` é `Partial<Record<RetroBlockId, string>>`, e `RetroBlockId` é `lede`/`kpis`/`highlights`/…, nenhum caderno | [`retro-blocks.ts:87`](../../../../packages/shared/src/period/retro-blocks.ts) |
| 3 | **A ADR 0045 §3 proíbe o negativo "atrás de um toque"**, e a lua ficou atrás de um toque por decisão do dono. A emenda é pré-requisito de construção e não está escrita | [`0045`](../../../../docs/decisions/0045-o-resultado-negativo-publica-com-o-mesmo-destaque.md) §3 |
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

### Fechado, mas com custo declarado

- **`onAccent` é mudança no sistema de tema**, não na revista: entra em `derive.ts` com
  barreira em `theme.test.ts` e passa a existir para todo papel.
- **A separação laranja × vermelho** fica sustentada pelo ícone nas cinco paletas
  estéticas. Se em uso real a semelhança incomodar mesmo com o ícone, o caminho já medido
  é remapear Coração — não retocar hex, que o sistema não permite.
- **`bicycle-outline` é ícone novo** e assume o viés da pedalada sobre corrida e caminhada.
