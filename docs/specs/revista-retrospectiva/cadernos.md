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
vez: custo de superfície zero, e ela já passou pelas cinco regras de verificação.

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
construíveis: não há campo novo, não há valor novo a verificar pelas cinco regras, e a
manchete é literalmente o que o caderno diz primeiro. A contrapartida é uma regra a mais
no prompt — o modelo escreve a primeira frase sabendo que ela vira capa e sumário.

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

**O anuário não tem capa.** As quatro tiras são a capa do ano.

## Apresentação

- **Cabeçalho de caderno forte** — cor de módulo por `moduleOf()`, nome grande. Em
  revista de ordem fixa o leitor reconhece pela posição; em ordem variável, pela cara.
- **Texto em fonte serifada** — é para ler, não para conferir. Já é a regra do
  `EdicaoCard`.
- **A assinatura fica visível** embaixo do texto de cada caderno (modelo + data),
  pela mesma razão que jornal assina coluna.
