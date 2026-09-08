# Revisão adversarial — A revista da Retrospectiva

## Veredito geral

O desenho é forte onde foi medido (faixa, `onAccent`, colisão laranja × vermelho, os três
vereditos da lua) e frágil onde ninguém renderizou: **quase tudo o que ele descreve é a
edição cheia de agosto/2026, com quatro cadernos, foto na capa e tudo impresso de uma vez**
— e essa edição é a minoria do que o dono vai abrir. Dos 39 meses que o backfill vai
imprimir, **22 têm um caderno só** (Coração começa em 24/03/25, Sono em 23/04/25, Rotina em
01/05/26): mais da metade do arquivo é uma edição em que o sumário tem uma linha e essa
linha repete, palavra por palavra, a manchete que está 380 px acima. A jornada 4 —
"Sydnei folheia até 2023" — leva ele exatamente para lá.

Há três buracos que não são refinamento: **CAP-14 não tem superfície nenhuma** (o único
olho de esconder do app opera sobre 13 `RetroBlockId`, não sobre quatro cadernos), **a
página da lua desenha um registro que o DDL do contrato recusa gravar** (`caderno='lua'`
bate no CHECK, e a PK impede o "acumula" do pré-registro §7.2), e **a revista não diz onde
ela mora** em relação aos 12 blocos que a Retrospectiva já tem em produção — que as
espinhas mantêm vivos por escrito ("a sombra fica onde já estava", "Diagramação continua
existindo") sem nunca os colocar na página.

---

## Ataques

### 1. A edição degenerada — QUEBRA

**O caso não é hipotético: é 56% do arquivo.** `mudancas-mecanicas.md` conta 39 edições de
mês para Movimento, 17 para Coração, 16 para Sono, 4 para Rotina. Todo mês anterior a
março/2025 sai do backfill **com um caderno**.

O que o desenho diz: *"Um caderno vazio não ocupa lugar: a edição pode ter dois cadernos,
ou um"* (EXPERIENCE, §A superfície da edição). O que ele não diz é o que sobra da forma
quando isso acontece:

- **O sumário de uma linha.** CAP-8 é *"o sumário é a lista de chamadas"* e a razão de ele
  existir é escolher: *"o leitor decide em qual caderno entrar"*. Com um caderno não há
  escolha, e a linha vira um botão de rolar 400 px. Pior: ela é **a mesma frase da capa**,
  agora sem nenhuma outra linha ao lado para justificar a lista. O argumento que sustenta a
  repetição ("é o que revista impressa faz: a capa anuncia e o sumário lista de novo")
  depende de haver uma lista. Não há.
- **A âncora morta.** *"Toca → rola com âncora até a faixa daquele caderno"*. Numa edição de
  um caderno, o caderno já está logo abaixo do sumário e a página pode não ter altura de
  rolagem sobrando: o toque no único alvo da tela não produz movimento nenhum. Alvo de 44 px
  que não responde é pior que alvo ausente.
- **Zero cadernos.** Não está escrito em lugar nenhum o que acontece. Mecanicamente a edição
  é *zero linhas* em `edicoes_ia` — ou seja, indistinguível de "fechado, não escrito". A
  tela então oferece a ação de escrever; ele toca; paga (ou não — também não está dito se a
  chamada chega a sair); e volta ao mesmo estado. Loop.
- **A capa sem posição 1.** *"A capa não ganha coluna no banco. A manchete é derivada do
  caderno em `posicao = 1`"*. Sem caderno não há `posicao = 1` e não há manchete — sobra
  meia tela de foto com o nome do período e nada mais, num objeto cuja identidade inteira é
  "capa + sumário + cadernos".

**Severidade:** crítico (a edição de um caderno acontece no primeiro dia do backfill; a de
zero cadernos é rara mas o estado é indistinguível de "não escrita").

**O que falta decidir:** (a) o sumário existe abaixo de dois cadernos? Se não, quem é o alvo
de toque; (b) com um caderno, a capa ainda imprime a manchete, sabendo que ela reaparece
imediatamente abaixo?; (c) período fechado com zero cadernos: a tela diz o quê, e o botão de
imprimir aparece?

---

### 2. O silenciamento — QUEBRA

Duas quebras independentes, e a primeira é a mais grave.

**(a) CAP-14 não tem controle em lugar nenhum do desenho.** As espinhas afirmam o
comportamento — *"Um caderno silenciado pelo leitor (`hidden`) não aparece nem quando o
ranqueamento o colocaria em primeiro"* — e mandam manter o painel que o operaria: *"o painel
Diagramação continua existindo e emagrece: perde as setas de reordenar e fica só o olho de
esconder"*. Mas esse olho opera sobre outro alfabeto. Em
[`packages/shared/src/period/retro-blocks.ts:33`](../../../../packages/shared/src/period/retro-blocks.ts)
`RetroBlockId` é `lede · kpis · highlights · heatmap · tasks · dailyTasks · purchases ·
fitness · sports · health · sleep · habits · yearSeries`, e `prefs.hidden` é
`Partial<Record<RetroBlockId, string>>`. **Não existe `hidden['sono']`.** O painel renderiza
`prefs.order.map(...)` sobre `RETRO_BLOCKS`
([`mobile/src/app/retrospectiva/index.tsx:740`](../../../../mobile/src/app/retrospectiva/index.tsx)),
os 13 blocos antigos. `mudancas-mecanicas.md` chega a dizer **"Sem migration"** e "o jsonb em
produção fica como está" — o que garante que o espaço de ids fica como está, isto é, sem
cadernos. Nenhum dos dois documentos desenha onde o dono toca para dizer *"Rotina nunca"*.

E há a herança silenciosa: se ele já escondeu o bloco `sleep` na prova de gráfica, o caderno
Sono nasce escondido? Some sem aviso? Ninguém decidiu.

**(b) A capa de um caderno invisível.** Se ele silencia o caderno em `posicao = 1`, a
manchete da capa é derivada dele. Dois caminhos, os dois ruins, e nenhum escolhido:

- **Recalcular** a manchete a partir do primeiro caderno visível — mas aí a capa de uma
  edição congelada muda quando uma preferência muda, e a promessa central do desenho
  (*"o que ele leu em agosto continua exatamente igual"*) cai por um toque num olho.
- **Manter** a manchete gravada — e a capa anuncia, em 28/33 serifada sobre meia tela, uma
  matéria que não está na revista. O leitor rola procurando e não acha.

O mesmo vale para a linha do sumário: some junto (e volta ao ataque 1, com o sumário
encolhendo) ou fica como âncora para uma faixa que não foi renderizada.

**Severidade:** crítico para (a) — é uma capability inteira sem superfície; alto para (b).

**O que falta decidir:** onde mora o olho de silenciar caderno e sobre qual id; o que
acontece com as chaves `hidden` já gravadas em produção; e se a manchete da capa é derivada
na leitura (muda com `hidden`) ou congelada na impressão (mostra o invisível).

---

### 3. A lápide, levada ao limite — SOBREVIVE em dois casos, QUEBRA em dois

**Julho/2026 (três lápides, dois cadernos) e ano/2026 (as quatro) — SOBREVIVEM, e o
contrato já responde.** Passo 5 força posição 1 para Movimento e Coração; passo 4 (ordem do
catálogo, *"fixa, para a função nunca ser ambígua"*) desempata; catálogo é Sono · Movimento ·
Coração · Rotina, logo Movimento lidera. E o *uma vez só* vale por tipo de período, então
2026 dispara e 2027 não. Está escrito em `bases-e-ranqueamento.md` §Ausência declarada e
repetido no EXPERIENCE. Nada a decidir.

**QUEBRA 1 — a lápide contra o caderno vazio.** Os passos 5 e 6 do ranqueamento se
contradizem e nenhum documento diz quem ganha:

```
5. Lápide — posição 1 forçada  (a última medida cai neste período)
6. Vazio  — fora da lista
```

O caso é o **mais provável de todos**, porque as duas condições têm a mesma causa: o dono
para de usar o relógio. Um mês em que Coração não tem número nenhum é exatamente o mês em
que respiração e SpO₂ morrem. Se **vazio** vence, o caderno some e a revista fica cega
calada — a falha que CAP-11 existe para impedir (*"nenhuma edição narra silêncio como
estabilidade"*). Se **lápide** vence, a edição abre por um caderno cujo corpo inteiro é uma
frase de 12,5 px. `ordenarCadernos` é declarada *"pura e determinística"*; aqui ela é
ambígua.

**QUEBRA 2 — silenciar o caderno que a lápide forçou.** As espinhas dizem que `hidden` vence
o ranqueamento *"nem quando o ranqueamento o colocaria em primeiro"* — o que inclui a
posição forçada pela morte. Consequência: o dono pode silenciar Coração e **a revista nunca
mais diz que ficou cega**, nem no mês da morte nem depois (a lápide dos meses seguintes vive
no pé do mesmo caderno silenciado). CAP-11 e CAP-14 colidem de frente e ninguém arbitrou.
Note que essa é justamente a situação em que ele *quer* silenciar: um caderno que ficou sem
dado é um caderno chato.

**OMISSO — a ressurreição.** A edição de agosto congelada dizendo que os anéis morreram está
certa, e o desenho argumenta isso bem. A de setembro também: a lápide vai para o pé e não
sobe de novo. O buraco é o mês em que a métrica **volta**: não há fato de ressurreição, e a
comparação B1 do mês do retorno é contra um mês de ausência. `|deltaPct|` contra zero/ausente
é enorme, e o passo 1 do ranqueamento poria esse caderno em primeiro com uma manchete de
falso feito. O portão do passo 2 (`cobertura.comparavel === true`) **provavelmente** segura —
mas nenhum documento diz que ausência marca a base como não-comparável, e essa é a única
coisa que separa "a revista percebeu que o relógio voltou" de "a revista deu manchete a uma
divisão por lacuna".

**Severidade:** alto (as duas quebras), médio (a ressurreição).

**O que falta decidir:** precedência explícita entre os passos 5 e 6; se `hidden` pode
suprimir uma lápide (proposta: não pode — a declaração de cegueira migra para fora do
caderno silenciado, ou o silêncio não se aplica a `FatoTexto` de morte); e se a ausência
força `comparavel = false` na base.

---

### 4. A lua na sexta execução — QUEBRA

Este é o pior achado do relatório, porque a página desenhada **não pode ser gravada** e
porque o que ela esconde é exatamente o que o pré-registro existe para impedir.

**(a) O registro é ilegal pelo próprio contrato.** `pre-registro-lua.md` §7.2: *"Toda
execução grava linha em `edicoes_ia` com `caderno='lua'` e o hash do pré-registro que a
autorizou. Nunca substitui — **acumula**."* Contra isso, `mudancas-mecanicas.md`:

```sql
primary key (user_id, tipo_periodo, inicio, fim, caderno)
caderno text not null check (caderno in ('sono','movimento','coracao','rotina'))
```

`'lua'` **bate no CHECK**. E mesmo que passasse, a PK torna o "acumula" impossível: a
segunda execução sobre a mesma janela colide com a primeira e `upsertEdicao` a
**substitui** — o oposto literal do §7.2. Some-se o terceiro problema: o teste roda sobre
todo o histórico (23/04/2025 → hoje), que não é `week`, `month`, `season` nem `year`; e
`all` é recusado pelo CHECK de `tipo_periodo`, já vivo em produção
([`supabase/migrations/20260906150000_edicoes_ia.sql:22`](../../../../supabase/migrations/20260906150000_edicoes_ia.sql)).
**A execução da lua não tem chave legal.** As espinhas desenharam a moldura, o contador e a
"próxima leitura" em cima de um registro que o esquema recusa.

**(b) O acúmulo não tem superfície.** A moldura tem cinco campos e o quinto é *"1ª
execução"* nos três quadros de [`mockups/key-lua.html`](mockups/key-lua.html) (linhas 390,
523, 649). Na sexta execução o campo diz *"6ª execução"* — e **só o veredito mais recente é
impresso**. O contrato manda acumular; a página conta. Um número não é um histórico.

Isso é grave por uma razão específica deste documento: §7 se chama *"Contra refazer até dar
certo"* e o mecanismo é *"tornar cada tentativa permanente e contável"*. Uma página que
imprime "6ª execução · achado" sem mostrar que as cinco anteriores disseram "nenhum padrão"
**é o file drawer com um selo de honestidade em cima**. Cordi 2014, citada no próprio
pré-registro, tem o problema no título. O desenho que se propõe a matar a gaveta construiu
uma.

**Severidade:** crítico. O item (a) trava a construção; o item (b) só aparece daqui a ~100
noites (≈6 meses ao ritmo de cobertura dele) mas anula o propósito do CAP-12.

**O que falta decidir:** onde vive a execução da lua (tabela própria com `execucao_n`, ou
coluna nova em `edicoes_ia` + CHECK ampliado + PK ampliada); e **que superfície tem o
histórico** — proposta mínima: as execuções anteriores como linhas mono no rodapé do método
(`3ª · 12/2026 · inconclusivo · faltam 106`), no mesmo lugar onde já vive a covariável, para
não tocar nos cinco campos enumerados pelo contrato.

---

### 5. O período sem foto E sem rota — OMISSO

`cadernos.md` oferece três recursos: `coverOf` → traçado de `activity_routes` → **"ou a
grade diária"**. O DESIGN.md desce para dois e fecha a porta por escrito: *"Duas naturezas,
e a diferença entre elas é conteúdo"*. O terceiro recurso do contrato **não foi desenhado**.

E ele é necessário com frequência. Rota existe para 275 das 555 atividades; um mês de
academia, yoga e caminhada urbana não produz traçado nenhum (dos 33 nomes editados à mão,
31 são "Yoga"). O caso mais frequente é o **postal**: a semana tem uma "capa pequena" de
146 px em [`mockups/key-formas.html`](mockups/key-formas.html) e uma semana sem pedalada é
banal — não uma vez por ano, várias vezes por mês no inverno belga.

Duas consequências:

- **Um tile em branco na parede**, ou pior, um tile que não se distingue de um erro de
  carregamento.
- **A jornada 4 perde o clímax.** *"Ele não precisa de nenhuma legenda para saber quando
  começou a fotografar. A parede conta isso pela textura."* A textura só conta a história se
  for binária: foto acima, traçado abaixo. Com um terceiro material (grade diária) ou com
  buracos, a fronteira de 2026 vira ruído e a jornada não fecha.

**Severidade:** alto (certeza de acontecer no backfill; atinge a jornada declarada e o
postal semanal).

**O que falta decidir:** existe a terceira natureza de capa? Se sim, ela é a grade diária
desenhada e como ela se distingue do traçado na parede sem virar uma terceira textura que
quebra a leitura da jornada 4. Se não, o que a capa mostra quando não há nem foto nem rota —
e o DESIGN.md precisa dizer que descartou o terceiro recurso do contrato, em vez de calar.

---

### 6. A errata parcial — QUEBRA

**O DESIGN.md não menciona errata uma única vez.** Nem token, nem componente, nem posição.
O EXPERIENCE define o comportamento (*"a edição continua exatamente como está, com a marca
de que os números abaixo foram reprocessados depois dela"*) e a regra (*"a errata é por
caderno"*), mas "a marca" não existe em lugar nenhum da espinha visual nem dos mockups. Numa
página contínua de quatro seções, uma marca sem âncora é uma decisão adiada: ela vai na
faixa (que é sangrada, saturada e não tem espaço), acima do texto, ou junto da assinatura?

E na capa: se o caderno em errata for o de `posicao = 1`, a manchete que abre a revista é a
que ficou desatualizada. A capa carrega a marca? Se não, a promessa da errata (*o leitor
sabe que o número mudou*) falha justamente na frase mais lida da edição.

**A quebra maior é a errata em massa.** `agg_version_no_momento` é **uma constante global**
— [`mobile/src/services/health-sync.ts:90`](../../../../mobile/src/services/health-sync.ts):
`const AGG_VERSION = 9;` — e ela já se moveu nove vezes, duas delas nos últimos quatro meses
(sono, 2→4). `precisaErrata` compara essa versão única com a gravada. Logo **o próximo bump
marca todas as 436 edições × 4 cadernos de uma vez**: ~1.744 linhas em errata, toda capa da
parede com a marca, todo caderno com a marca. Uma marca que está em tudo não informa nada —
e o dado que mudou foi o de sono, não o de ciclismo. O desenho supõe errata como evento
raro e pontual; a mecânica a produz como evento global e frequente.

**Severidade:** alto (o bump de `AGG_VERSION` é rotina neste repositório).

**O que falta decidir:** onde a marca de errata se ancora numa página contínua e se ela sobe
para a capa; e se a errata passa a ser **por assunto** (a versão de agregação do sono só
marca o caderno Sono) em vez de por versão global — senão a marca nasce inútil.

---

### 7. O congelamento contra o que muda por fora — QUEBRA (a capa), SOBREVIVE (a cor)

**A cor — SOBREVIVE, com uma ressalva que as espinhas deviam assumir.** Trocar de paleta em
novembro muda a cara de agosto, e isso está certo: o congelamento é do **texto e da ordem**
(`posicao` é coluna gravada), e a cor é identidade de seção resolvida na leitura por
`moduleOf()` — a mesma regra que rege todo o app. O que envelhece mal é a **redação da
promessa**: *"o que ele leu em agosto continua exatamente igual quando ele reabrir em
outubro"* (DESIGN, §Brand & Style) é mais larga do que o que o desenho garante. E há um caso
que ela cobriria e não deveria: a própria questão aberta do EXPERIENCE (*"o caminho já medido
é remapear Coração"*) mudaria retroativamente a cor de toda edição já impressa. Escopar a
promessa a *texto e ordem* resolve nas duas direções.

**A capa — QUEBRA, e essa é séria.** *"A capa não ganha coluna no banco. A foto sai de
`coverOf`, que já é pura."* Pura, sim; **estável, não**. Em
[`packages/shared/src/photos/retro.ts:44`](../../../../packages/shared/src/photos/retro.ts)
a escolha depende de `p.state === 'linked'` e de `p.isCover` — dois campos que mudam depois
da impressão, e que a frente de Fotos foi desenhada para mudar:

- **A estrela.** "O app escolhe, a estrela corrige" — o dono marcar outra foto como capa em
  novembro **troca a capa de agosto**, e com ela a legenda de três campos e a descrição
  textual de acessibilidade.
- **O vínculo automático.** A varredura do corredor de 40 m roda *"uma vez por pedalada, na
  primeira abertura"*. Abrir uma pedalada antiga em novembro pode **ligar fotos novas** a
  ela e mudar o cluster que `coverOf` elege.
- **A biblioteca.** A foto é um ponteiro `ph://` para a biblioteca do iPhone, e "ph:// não
  carrega" já é um achado registrado. Apagar a foto → a capa da edição congelada fica em
  branco. O arquivo apodrece sozinho.

A jornada 1 é literalmente *"a foto de uma parada em Ittre, com `Ittre · km 31,1 · 12:38`"*.
Seis semanas depois pode ser outra parada, outro km, outra hora — no mesmo movimento em que
o desenho promete "palavra por palavra e na mesma ordem".

**Severidade:** alto para a capa (a estrela é uma funcionalidade entregue, feita para ser
usada); baixo para a cor.

**O que falta decidir:** a capa congela na impressão (o que exige a coluna que o contrato
recusou — ou um ponteiro para o `activity_photo` eleito) ou é assumida como **a única parte
viva de uma edição morta**, dito por escrito e retirado da promessa de imutabilidade. E o
que a capa mostra quando o `ph://` não resolve.

---

### 8. A repetição aceita — OMISSO

A aceitação é defensável no caso desenhado (quatro cadernos, capa + lista de quatro). Ela
envelhece mal em três casos, e nenhum deles foi olhado:

1. **A edição de um caderno** (ataque 1): capa e sumário imprimem a mesma frase e não há
   segunda linha para a lista existir. 22 dos 39 meses.
2. **A parede acrescenta uma terceira impressão.** O rótulo do tile é *"período + manchete
   curta"*. Ele toca o tile que diz *"435 km, metade de julho"* e a tela que abre diz a mesma
   coisa na capa e de novo na primeira linha do sumário: **três vezes em dois toques**. O
   argumento da revista impressa não cobre isso — capa e sumário estão no mesmo objeto; a
   parede é a estante.
3. **Tipo dinâmico.** A defesa é geométrica — *"sempre dentro da primeira tela e meia"*,
   medida em 844 px. Com corpo de letra grande a manchete de 28/33 cresce, as chamadas de
   16/22 quebram em três linhas e a faixa *"cresce com o nome"*. A distância entre as duas
   impressões pode passar de duas telas, e aí não é eco de revista: é o app se repetindo. A
   medição foi feita num aparelho e num tamanho.

Some-se a leitura de tela: VoiceOver lê a manchete da capa e, segundos depois, a mesma
sentença como primeira linha do sumário, sem o salto de olho que perdoa a repetição no
visual.

**Severidade:** médio.

**O que falta decidir:** manter a repetição sob quais condições (nº de cadernos ≥ 2? rótulo
da parede sem manchete?), e se a geometria que a justifica vale nos tamanhos de tipo
dinâmico grandes.

---

### 9. O postal efêmero — QUEBRA (por uma razão maior que a efemeridade)

A interrupção **não foi considerada**: o memlog registra *"a prosa some ao sair"* e o
EXPERIENCE repete, mas nenhum dos dois define o que é *sair*. Voltar do multitarefa? O app
sendo morto em segundo plano pelo iOS? Navegar para a página de outra semana e voltar? Em
Expo Router a diferença entre "desmontou" e "ficou em background" é implementação, não
desenho — e o custo do erro é uma chamada paga e um texto perdido no meio da leitura.

Isso é chato. **O que quebra é outra coisa, e ninguém a viu:** a restrição do contrato é
*"**Verifica antes de gravar**, sempre, em qualquer hospedeiro"*. O postal **nunca grava**.
Logo, pela letra, ele não é obrigado a verificar — e nenhuma das duas espinhas manda o
postal passar por `verificar.ts`. Ou seja: a superfície **mais frequente** da revista (uma
por semana, contra uma por mês da edição) é a única que pode imprimir um número alucinado.
E o alfabeto do postal é o pior possível: *"três fatos"*, provavelmente inteiros pequenos —
exatamente a faixa em que `bases-e-ranqueamento.md` mediu que **um inteiro alucinado entre 0
e 100 passa 16% das vezes**.

Terceiro fio, menor: o gasto repetido não tem contador. A lua ganhou *"cada tentativa é
permanente e contável"* porque refazer até dar certo é risco; o postal pode ser reescrito
quantas vezes ele quiser, sem registro, sem contador e sem nada dizendo que a semana passada
já foi narrada de três formas diferentes.

**Severidade:** alto (a lacuna de verificação); baixo (a interrupção em si).

**O que falta decidir:** o postal verifica antes de **imprimir**, não antes de gravar — e o
que a tela mostra quando o postal reprova (não há linha para descartar; sobra a tela dos três
fatos e uma explicação); e onde termina a vida da prosa efêmera, em termos de ciclo de vida
do Expo Router, não de "sair".

---

### 10. Onde a revista mora — QUEBRA

O desenho descreve a edição como *"uma página contínua, nesta ordem: capa · sumário · quatro
cadernos"* e nada mais. Mas a Retrospectiva de hoje
([`mobile/src/app/retrospectiva/index.tsx`](../../../../mobile/src/app/retrospectiva/index.tsx),
995 linhas) é: cabeçalho · seletor de tipo de período · navegação anterior/próximo · painel
Diagramação · **13 blocos**, e a edição de IA é *um* deles (`lede`, que contém o
`EdicaoCard`). Os outros doze — `kpis`, `highlights`, `heatmap`, `tasks`, `dailyTasks`,
`purchases`, `fitness`, `sports`, `health`, `sleep`, `habits`, `yearSeries` — são onde os
números realmente vivem hoje.

As espinhas os mantêm vivos **por escrito**, duas vezes: *"A sombra fica onde já estava — nos
cartões que a Retrospectiva tinha antes"* (DESIGN) e *"o painel Diagramação continua
existindo e emagrece"* (EXPERIENCE). E nunca os colocam em lugar nenhum. Daí saem perguntas
que decidem a construção inteira:

- A revista é **tela nova** (e a Retrospectiva antiga fica intacta como porta de entrada) ou
  é **a nova forma da Retrospectiva** (e os doze blocos morrem)? O quadro "As telas" sugere
  a primeira (*"Revista — chega-se por Retrospectiva, escolhendo o período"*), o que
  significa que o dono passa a ter **duas retrospectivas do mesmo mês**: uma numérica e uma
  narrada, com o bloco `sleep` e o caderno Sono dizendo a mesma coisa em duas gramáticas
  visuais diferentes.
- Se é tela nova, **onde estão o seletor de tipo e as setas de período**? A capa sangra do
  topo com só um "voltar" por cima ([`mockups/key-edicao.html`](mockups/key-edicao.html)).
  Trocar de mês exige sair, e "gesto horizontal: nenhum" fecha a outra saída.
- O anuário abre com **quatro tiras** inventadas pelas espinhas, mas `cadernos.md` diz que
  ele abre com *"o bloco `yearSeries`, que já existe e já é exclusivo de `year` — ele é um
  **formato**, não um gráfico"*. São o mesmo objeto ou dois? Se são dois, o ano abre com duas
  aberturas.
- E o `EdicaoCard` de hoje, com o estado e o botão de gerar: ele fica na Retrospectiva antiga
  (e é dali que se imprime), ou migra para dentro da revista?

**Severidade:** crítico. Não é um caso de borda: é a arquitetura de informação da tela mais
importante do épico, e as duas espinhas passam por ela sem cravar.

**O que falta decidir:** a revista substitui a Retrospectiva ou vive ao lado dela; o destino
dos doze blocos; e onde ficam os controles de período que a capa sangrada expulsou.

---

### 11. A posição congelada contra a reimpressão por caderno — QUEBRA

**A jornada 2 do próprio EXPERIENCE cria o problema.** Rotina reprova na conferência; os
outros três estão impressos; *"ele manda escrever de novo só o que falhou"*. Mecanicamente:

```sql
unique (user_id, tipo_periodo, inicio, fim, posicao)
```

Três linhas gravadas com `posicao` 1, 2, 4 (Rotina era a 3 e não existe). Quando ele reimprime
Rotina — dias depois, ou em novembro — de onde vem a `posicao` dela? Se `ordenarCadernos` é
executada de novo e a função mudou no meio-tempo (o cenário que o congelamento existe para
cobrir), Rotina pode voltar como 1 e **bater no `unique`** com Movimento. Se ela herda a
posição da execução original, alguém precisa ter guardado a ordem completa — mas o contrato
diz explicitamente *"a ordem é coluna, não array"* justamente para **não** guardar a ordem do
conjunto em lugar nenhum.

O contrato diz *"a ordem congela **na impressão**"* no singular, e o desenho tornou a
impressão plural: *"a edição chega em quatro peças, e cada uma aparece quando fica pronta"*
(estado "escrevendo"). Quatro impressões, um congelamento.

Sub-caso relacionado: o quadro Component Patterns diz *"Botão de imprimir: só aparece em
período fechado e ainda não escrito. Nunca em edição já impressa"* — em **edição**. Pela
jornada 2 ele tem que ser por **caderno**, senão o caderno reprovado nunca pode ser
reimpresso. Os dois documentos usam granularidades diferentes na mesma regra.

**Severidade:** alto (a jornada 2 é uma das quatro declaradas, e a reprovação é o caminho
que ela existe para demonstrar).

**O que falta decidir:** a ordem congela na **primeira** impressão da edição e cadernos
reimpressos herdam a `posicao` já reservada (o que exige reservar a posição de um caderno que
não tem linha) — ou a ordem é recalculada a cada impressão e o `unique` vira o mecanismo de
falha. E o botão de imprimir passa a ser por caderno, no texto dos dois documentos.

---

### 12. A "manchete curta" da parede — OMISSO

O DESIGN inventa um campo que o contrato não tem: o rótulo do tile é *"período + manchete
curta"*. Não existe manchete curta em lugar nenhum — a manchete é a chamada do caderno,
texto gerado, de comprimento arbitrário, sujeito a **cinco regras de verificação**. Logo o
rótulo é ou (a) uma geração nova, e aí a parede custa uma chamada paga por edição, ou (b)
uma truncagem.

Se for truncagem, ela pode cortar exatamente o que a quinta regra existe para exigir. *"435
km, metade de julho — e o terceiro mês seguido caindo"* truncado em duas linhas de tile vira
**"435 km, metade de…"**: um número sem a base nomeada. A verificação reprova essa frase
quando o modelo a escreve; o layout a produz sozinho, e a produz seis vezes por tela.

**Severidade:** médio (certeza de acontecer; o dano é uma violação da lei central da voz,
num lugar onde ninguém vai procurá-la).

**O que falta decidir:** o rótulo da parede é o **nome do caderno líder** (curto, seguro,
zero geração) em vez da manchete; ou a truncagem tem regra que preserve a base nomeada.

---

### 13. A lua que fica sem noites — OMISSO

A moldura imprime *"próxima leitura: a cada +100 noites"*, e a página inteira é uma promessa
com prazo. O prazo depende de as noites continuarem chegando em `sleep_periods` — e as
quatro métricas mortas são **exatamente as exclusivas do Apple Watch**, conforme o
diagnóstico das Open Questions do spec (*"troca de relógio, não cano quebrado"*). Se o sono
migrar para o Garmin e a ponte não alimentar `sleep_periods` com a mesma fidelidade — o
histórico de buracos de sono por perda do relógio já aconteceu uma vez, até 18/07/2025 —,
a página imprime *"faltam cerca de 106 noites"* para sempre.

O desenho tem lápide para caderno cego e não tem nada para **teste cego**. A única superfície
que envelhece sem revisão humana é a que mais depende de o dado continuar chegando.

**Severidade:** médio (probabilidade real; o dano é uma página que mente por omissão durante
meses).

**O que falta decidir:** a moldura declara **desde quando não chegam noites novas** (a mesma
gramática da lápide, no rodapé do método), ou a "próxima leitura" ganha data estimada que
recua visivelmente quando o dado para.

---

### 14. A jornada 1 prova a exceção, não a regra — OMISSO

O clímax da jornada declarada como *"a única que a revista precisa ganhar"* é: *"ele fecha e
diz, sem olhar de novo, qual caderno liderou e por quê — foi Movimento, porque os anéis
pararam em agosto"*.

Movimento lidera agosto pelo **passo 5** — a lápide, o caminho de exceção. Os passos 1 a 3
(afastamento, portão, confiança), que são o ranqueamento de verdade e o que CAP-7 promete,
**não são exercidos por nenhuma das quatro jornadas**. Pior: quando a lápide não está lá — em
setembro, e em 435 das 436 edições — **nada na página explica a ordem**. A lápide é o único
elemento visual que diz "é por isso que este caderno abre": ela sobe ao topo, um degrau
acima. Um caderno que lidera por `|deltaPct|` abre exatamente como um que lidera por
desempate de catálogo.

Isso não pede um "por que este caderno lidera" impresso — seria explicar a máquina, e a
revista não faz isso. Mas significa que o sinal de sucesso do spec foi demonstrado com o caso
mais fácil, e que a forma foi validada contra o mês em que ela é mais legível.

**Severidade:** médio.

**O que falta decidir:** uma jornada (ou um mockup) de uma edição **sem lápide**, para provar
que a manchete do caderno em posição 1 sustenta sozinha o "e por quê" — ou aceitar por escrito
que ela não sustenta e que o clímax da jornada 1 vale só no mês de uma morte.

---

## Placar

| Veredito | Ataques |
|---|---|
| **SOBREVIVE** | 2 (julho/2026 e ano/2026 com múltiplas lápides; a cor que não congela) |
| **OMISSO** | 6 (capa sem foto nem rota · repetição em três lugares · manchete curta da parede · lua sem noites · jornada 1 · ressurreição da métrica) |
| **QUEBRA** | 8 (edição degenerada · silenciamento sem superfície · lápide × vazio · lápide silenciada · lua sem chave legal e sem histórico · errata sem âncora e em massa · capa que não congela · onde a revista mora · posição × reimpressão) |

**Críticos:** a edição de um caderno (56% do arquivo), CAP-14 sem controle nenhum, a execução
da lua sem chave legal no esquema, e a arquitetura de informação da tela em relação aos 12
blocos que já existem.
