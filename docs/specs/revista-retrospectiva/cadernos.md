# Os cadernos e as formas

Companion de [`spec.md`](spec.md). Catálogo dos cadernos (CAP-2), da capa (CAP-10) e
das três formas (CAP-9).

## Os quatro cadernos

Todo campo abaixo existe hoje no banco ou sai de função pura. Nada aqui depende de
captura nova.

### Sono

| Campo | Fonte |
|---|---|
| relógios deitou / apagou / acordou | `SleepRetro` (`sleep/retro.ts`) |
| duração mediana | `SleepRetro` |
| continuidade — despertares e sua duração | `SleepRetro` |
| regularidade e jetlag social | `regularityByWeek`, `weekendShift` |
| as 5 dimensões da Saúde do sono | ADR 0036 |
| nota × medição | `ratingsSplit` |
| gatilhos sob a regra das duas colunas | `sleepTriggers` (`sleep/triggers.ts`) |
| extremos com data | `SleepExtremes` |
| **a página da lua** | CAP-12 · [`pre-registro-lua.md`](pre-registro-lua.md) |

Os gatilhos rodam sobre **todo o histórico**, não sobre o período — um mês rende
células de três noites e nenhuma leitura passaria o portão.

### Movimento

| Campo | Fonte |
|---|---|
| km · tempo · esforço duro | `RetroFitness`, `RetroSports` |
| zonas de FC (418 atividades) | `hr_zones` |
| recordes (554 de 555 atividades) | `best_efforts` |
| elevação (275) | `activity_routes` |
| **cidades como fato de texto** (174) | `CityMark` |
| **piso das rotas como fato de texto** (138) | ADR 0043 |
| lápides de VO₂max e anéis | CAP-11 |

Cidades e piso entram como `FatoTexto`, não `FatoNumero`: *"o período aconteceu em
Ittre, Leuven e Bruxelles"*, *"72% pavimentado"*.

### Coração

| Campo | Fonte |
|---|---|
| FC de repouso | `health_daily` |
| VFC | `health_daily` (ponte intervals.icu) |
| a série intradiária — curva do dia, Noites, dia × hora (179 dias) | `health_series` · ADR 0033 |
| lápides de respiração e SpO₂ | CAP-11 |

**Não é o antigo "Corpo".** Das 14 métricas de `health_daily`, quatro são cadáveres,
oito nunca chegaram e peso tem uma medida; sono pertence ao caderno Sono e passos e
andares são subproduto de Movimento. O que resta é um assunto, não uma gaveta — e é
o nome que o painel da web já usa.

### Rotina

| Campo | Fonte |
|---|---|
| aderência de tarefas (551 ocorrências, 102 templates) | `todo_occurrences` |
| hábitos (336 registros, 4 hábitos) — com o gasto derivado por `unit_price` | `habit_logs` |
| registros (96, 6 registros) | `registro_logs` |
| notas do dia (80 dias) | `daily_ratings` |

**Só trajetória como comparação até mai/2027** — não há B2 nem B3 (§4 do brief). É
o único caderno que fala do que o dono **decidiu** em vez do que aconteceu com o
corpo dele; foi mantido por essa razão, contra o corte do PM.

## A capa

Não é caderno. **Onde** o carimbo dela mora é decisão de arquitetura, não deste
companion — ver a espinha do épico.

| Elemento | De onde |
|---|---|
| imagem — foto do período | `coverOf` (`photos/retro.ts`), com a correção manual já gravada em `activity_photos` |
| imagem — **quando não há foto**, o traçado do próprio período | `activity_routes` (275), ou a grade diária |
| legenda | a parada da foto: `Ittre · km 31,1 · 12:38` |
| manchete | a do caderno em `posicao = 1` — derivada, não armazenada |

**A capa é carimbada na impressão.** `coverOf` lê `isCover` e `state === 'linked'`, os
dois mutáveis depois da impressão — a estrela, o vínculo automático de 40 m, o `ph://`
que some da biblioteca. Sem carimbar, a foto de agosto vira outra em outubro, contra
*período fechado congela*. Decidido em 08/09/2026, e **supersede** a decisão de 07/09 de
que nada seria gravado.

**O que o carimbo congela, exatamente.** A **escolha** — qual foto — e a **legenda já
formatada**. Não a imagem: se a foto sair da biblioteca do iPhone, ela some com carimbo
ou sem, porque o app nunca teve o arquivo. É justamente por isso que a legenda é gravada
como valor e não re-derivada — ela continua imprimindo, e continua servindo de descrição
textual, depois que o `ph://` morre.

**A foto informa, não ilustra.** A legenda é um fato de três campos; sem parada, sem
quilômetro e sem hora seria decoração. É a única entrada da revista que diz **onde** o
período aconteceu — e a razão pela qual "Onde" não precisou ser um caderno.

**As fotos são só de 2026**, então três quartos do arquivo não tem imagem. A capa
desenhada não é remendo: 2023 parece 2023 e 2026 parece 2026, e a textura das capas
registra quando o dono passou a fotografar.

## O sumário

Quatro linhas, uma por caderno, cada uma com **a chamada daquele caderno** — não o
nome. A chamada é a manchete que o próprio caderno já escreveu, mostrada uma segunda
vez: custo de superfície zero, e ela já passou pelas nove regras de verificação.

```
SONO          você dormiu 12 minutos a mais que
              em agosto do ano passado

MOVIMENTO     435 km, metade de julho — e o
              terceiro mês seguido caindo
```

Não diz o que tem dentro; diz **por que entrar**. Como a ordem é variável (CAP-7),
cada linha é **tocável** e o sumário é também a navegação.

**A chamada é a primeira frase do texto do caderno**, cortada no primeiro ponto final.
Extração mecânica, decidida em 08/09/2026 porque sem ela nem a capa nem o sumário eram
construíveis: não há campo novo, não há valor novo a verificar pelas nove regras, e a
manchete é literalmente o que o caderno diz primeiro. A contrapartida é uma regra a mais
no prompt — o modelo escreve a primeira frase sabendo que ela vira capa e sumário.

"Primeiro ponto final" é a regra em uma frase; a regra inteira tem dono único em
`packages/shared/src/revista/chamada.ts` (story 1.8), e foi refinada com o dono em
16/09/2026. Ela corta **onde a conferência corta** — ponto que não esteja entre dois dígitos,
`?`, `!` e quebra de linha —, porque a conferência usa os mesmos limites para decidir que
base está colada a um número, e uma chamada que cortasse antes levaria o número à capa sem
a base. Na dúvida, fica mais longa, nunca mais curta. Pula as abreviações que em regra
precedem o complemento (`aprox.`, `p.ex.`, `p. ex.`, `vs.`, `i.e.`, `cf.`, `p.p.`), o ponto
colado a letra (`intervals.icu`, `1.º`), o marcador de lista no começo (`1.`, `a.`, `II.`,
`2)`, `-`) e o fragmento sem letra — `"1. O sono caiu."` é `"O sono caiu."`, nunca `"1."`.
Inclui os terminadores colados (`...`, `?!`) e as aspas, parênteses e colchetes que fecham
logo depois. Texto sem terminador devolve o texto inteiro. Sem texto — ou com texto sem
nenhuma letra fora dos marcadores — a chamada não existe, e quem a desenha trata a ausência.

**Três limites que as telas herdam** (capa, sumário e parede), registrados no trabalho
adiado da 1.8: a chamada **não tem teto de tamanho**, e como uma manchete longa aparece é
decisão de tela; a **reticência não tem resposta** — `…` junta duas frases, e `...` seguido
de minúscula corta uma no meio; e **Markdown sai cru**, porque nenhuma tela da revista o
interpreta.

## As três formas

Não uma por `PeriodKind`. Três objetos distintos.

### Postal — semana

Uma tela. **Sem sumário** (não há o que sumariar). Capa pequena, três fatos, e **só
trajetória** como comparação — semana contra semana anterior é ruído, e o brief já
declarou a semana rasa.

**Não grava edição.** Calcula na hora, como a retro faz hoje. Nada de 172 chamadas
pagas para textos de sete dias.

### Edição — mês e trimestre

Capa · sumário · os quatro cadernos na ordem ranqueada. Três bases quando existem,
trajetória sempre. É a forma central: é onde a v1 vive ou morre.

No trimestre, a **camada de luz em destaque** — é o recorte em que a estação muda de
significado.

### Anuário — ano

Forma diferente, não a edição inflada. Um ano não tem uma manchete; tem doze formas.

Abre **serial**: o ano desenhado mês a mês antes de qualquer texto. O bloco
`yearSeries` já existe e já é exclusivo de `year` — ele é um **formato**, não um
gráfico. Depois da série vêm os cadernos, cada um com os **extremos datados**.

São **quatro tiras de doze meses**, uma por caderno, na cor do caderno. Cada tira mede
**o fato que liderou o ranqueamento daquele caderno naquele mês** — a tira e a ordem
falam do mesmo número, e o ano se lê como quatro batimentos paralelos. O custo é
declarado: quando a métrica líder muda de mês para mês, a tira mistura unidades.

**A frase "o anuário não tem capa" vale para UMA superfície, e não para as duas.**

Ela foi escrita antes de qualquer das duas existir, e por isso lia como regra geral. São
duas telas, nascidas em stories diferentes:

- **na parede de capas** (`/revista`, Story 2.4b · CAP-15) o anuário **não tem capa**: as
  quatro tiras em miniatura, a 16 px, são o que representa o ano ali. É o sentido original
  da frase — o ano é o único período da parede que não é um ladrilho com imagem;
- **na rota da edição** (`/revista/ano/…`, Story 3.2 · CAP-16) o ano **tem capa**, a mesma
  das outras edições. As quatro tiras entram a 34 px **antes** dela, e não no lugar dela: o
  ano é a mesma rota e a mesma edição, com uma abertura a mais. *Elas acrescentam; não
  substituem.*

#### Estreitamento (2026-09-25, Story 2.4b): a tira diz identidade, não grandeza

O parágrafo acima promete **magnitude** — "mede o fato", "a tira e a ordem falam do mesmo
número" —, e o custo que ele declara ("a tira mistura unidades") só existe se houver
número desenhado. Na implementação da parede de capas isso não se sustenta, e a razão é
do modelo de dados, não da tela: **o que a impressão carimba é `metrica_lider`, a chave
da métrica que liderou — nunca o valor dela**. Desenhar a magnitude exigiria recalcular o
ranqueamento a cada abertura, e recalcular é proibido desde a Story 1.9: a ordem congelou
em `posicao` na impressão, e uma tira que recalculasse deixaria de concordar com a edição
que ela anuncia.

Então a tira **lê a chave** e diz três coisas por mês, sem nenhum número:

1. o caderno **liderou** com uma métrica;
2. o caderno **saiu e nenhuma métrica liderou** (`metrica_lider` nulo — ele entrou pela
   lápide, ou nada dele passou no portão de amostra);
3. o caderno **não saiu** naquele mês.

E marca **onde o líder trocou**, de um mês para o seguinte. É isso que preserva a leitura
de "quatro batimentos paralelos": sem a troca, doze meses liderados pelo mesmo fato e doze
meses trocando de fato a cada mês desenhariam a mesma barra.

A promessa de magnitude ficou **em aberto** na 2.4b e foi **recusada** na 3.2 — decisão do
dono de 25/09/2026, quando a tira passou a 34 px e a pergunta "e agora dá para desenhar o
valor?" voltou a ser possível. *Identidade, nunca grandeza.* Reabri-la exige **medição
nova**, não um `flex`: carimbar o valor ao lado da chave é coluna nova em `edicoes_ia`,
migração, e a pergunta de que unidade guardar quando a métrica líder muda. Ver
[ADR 0057](../../decisions/0057-a-parede-mostra-meses-e-o-ano-e-quatro-tiras.md).

#### Ampliação (2026-09-25, Story 3.2): a tira abre a edição do ano

O "abre serial" do começo desta seção era, até a 3.2, uma promessa sem tela: a parede sabia
ler o ano como série, e a rota — que é onde ele se lê — não. A 3.2 fechou isso, e o contrato
dela está em **CAP-16** do [spec](spec.md). O que ela **não** entrega, e por quê:

- **os extremos datados** que o parágrafo do "abre serial" pede em cada caderno. Só o Sono
  os tem hoje (`SleepExtremes`); a forma (`EventoFato`) e a seção `### Eventos` do prompt já
  existem, e falta o **produtor**. Ele serviria as quatro tiras **e** o texto, em todos os
  períodos, e por isso vale como story própria — não como apêndice desta. A dívida está
  nomeada em `period/cadernos.ts`;
- **a web**. O anuário é do iPhone; a rota da revista não existe no navegador.

## Apresentação

- **Cabeçalho de caderno forte** — cor de módulo por `moduleOf()`, nome grande. Em
  revista de ordem fixa o leitor reconhece pela posição; em ordem variável, pela cara.
- **Texto em fonte serifada** — é para ler, não para conferir. Já é a regra do
  `EdicaoCard`.
- **A assinatura fica visível** embaixo do texto de cada caderno (modelo + data),
  pela mesma razão que jornal assina coluna.
