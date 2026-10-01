# 0059 — Os dois motores da presença escrevem na mesma tabela

**Status:** aceita
**Data:** 2026-09-30

## Contexto

O Orbe quer responder "quanto tempo fiquei em casa" sem digitar nada, e carimbar com um lugar
o que os outros módulos já registram. O iOS oferece **dois** caminhos para isso, e eles não
são versões boa e ruim da mesma coisa — são instrumentos diferentes:

| | (A) geofence — `expo-location` | (B) `CLVisit` — módulo Swift |
|---|---|---|
| Quem descobre o lugar | o usuário cadastra | o iOS descobre sozinho |
| Borda | nítida, entregue na hora | difusa; a saída atrasa minutos e chega a invadir a visita seguinte |
| Teto | 20 regiões por app | sem teto |
| Serve para alertar | sim | não — mede, não avisa |

Duas premissas correntes foram checadas e **descartadas como discriminador**: bateria e
permissão. Os dois motores usam a mesma infraestrutura de baixo consumo (célula e Wi-Fi, sem
GPS contínuo) e os dois exigem a permissão "Sempre". O que separa (A) de (B) é quem descobre
o lugar e quão nítida é a borda.

A prioridade declarada do dono é **medir duração**, e ele pediu depois **alerta de chegada e
de saída em qualquer lugar** — duas coisas que apontam para (A). Mas ele também tem cauda
longa de lugares eventuais e quer diário de viagem, e nada disso o geofence alcança.

Entre 07 e 30/09/2026 rodou uma **Fase 0** que não escreveu nada no banco, só para medir o
motor (A) no aparelho dele. Ela respondeu o portão — *o iOS relança o app encerrado para
entregar um evento de região?* — com a prova `chegou · Casa · background · ±40 m · fix de 0s`,
em 30/09 às 18:36:04. E mediu 23 dias: **73 travessias em 23 dias distintos**, pior dia com
**5** eventos (o alarme de flapping estava em 60), **1** passagem abaixo de 8 min, **4**
colagens abaixo de 20 min, **1** borda sem saída, precisão mediana **±19,8 m**.

## Decisão

**Um motor por vez, uma tabela só.**

1. O geofence (A) é o produtor da **fase 1**. Ele entrega a métrica principal — duração com
   bordas nítidas — e é o único que sustenta alerta.
2. O `CLVisit` (B) entra na **fase 3**, e **escreve na mesma tabela `visits`**, distinguido
   por uma coluna `source` (`geofence` | `clvisit` | `manual`). Cada motor tem seu índice
   único de idempotência; as regras de sobreposição decidem quem ganha (geofence nos lugares
   âncora, `CLVisit` no resto).
3. Nenhuma tela, agregado ou módulo consulta `source`. Eles leem visita, e o rollup
   `place_days`.
4. O alerta cru — chegada e saída, com texto do usuário — nasce na **fase 1**, não na 4,
   porque ele é propriedade de qualquer lugar e depende de (A).

A consequência prática: **nada do que a fase 1 construir é jogado fora quando o Swift
chegar.**

## Alternativas rejeitadas

**Começar pelo `CLVisit`.** É o caminho mais "esperto" — descobre lugares sozinho, sem
cadastro, sem teto de 20. Perdeu porque entrega a **versão pior da métrica principal**: a
saída chega minutos depois do fato, às vezes só quando a visita seguinte já começou. Seriam
cem linhas de Swift para receber uma duração pior do que a de (A), e ainda sem poder alertar.

**Só geofence, para sempre.** Simples e suficiente para casa e escritório. Perdeu porque o
dono declarou cauda longa de lugares eventuais e diário de viagem, e as 20 vagas do iOS são
um teto rígido: o café do almoço, a livraria, o aeroporto nunca teriam vaga. Descartar (B)
seria decidir hoje que essas perguntas não terão resposta.

**Uma tabela por motor** (`geofence_visits` e `clvisit_visits`). Perdeu porque empurra a
união para todo leitor: Semana, Sono, Saúde, Retrospectiva e metas passariam a fazer `union
all` com regras de precedência duplicadas em cada consulta — e a primeira que esquecesse
viraria um número errado sem sintoma. O custo de `source` numa tabela é uma coluna; o custo
de duas tabelas é uma regra espalhada.

**Os dois motores desde a fase 1.** Perdeu por sequenciamento, não por mérito (é o padrão de
[custo vs risco](../../CLAUDE.md): sequenciar em vez de descartar). O módulo Swift é a parte
cara e a que menos se sabe; começar por ela atrasaria as três perguntas com que o dono abriu
— quanto tempo em casa, quanto no escritório, a que horas ele chega — que (A) responde
sozinho.

**Relatório de estado virando visita.** Não é bem uma alternativa: era o comportamento
acidental do primeiro log, em 07/09, quando 12 "chegadas em casa" numa noite parada eram, na
verdade, uma por build instalado. O iOS reavalia o estado das regiões a cada lançamento do
app e o `expo-location` traduz isso como `enter`. A decisão explícita é que **só travessia
vira visita**, com o estado por região persistido no aparelho.

## Consequências

**O que isso custa.**

- Uma coluna `source` e dois índices únicos parciais em `visits`, escritos na fase 1 para
  serem usados de verdade só na fase 3. É dívida deliberada e barata.
- Quatro colunas de alerta em `places` desde a fase 1, embora o gatilho rico (a lista de
  compras renderizada) só chegue na fase 4. `alert_route` é a ponte: muda o destino, não o
  mecanismo.
- A fase 1 fica com um buraco visível: lugar não cadastrado não existe, e o dia fecha com
  "não coberto". A tela precisa mostrar isso como buraco, nunca como zero.

**O que custa reverter.** Pouco, enquanto a fase 3 não existir: `source` seria uma coluna
com um valor só. Depois dela, separar os motores exigiria reescrever todo leitor — que é
exatamente o custo que esta decisão evita pagar.

**O que fica amarrado.** O teto de 20 regiões do iOS vira o orçamento dos alertas
(`places.geofence_slot`, `unique (user_id, geofence_slot)`), e a alocação passa a ter regra:
alerta primeiro, depois os mais visitados. Passar do teto não dá erro — o iOS simplesmente
para de entregar as regiões excedentes, em silêncio.

**O que esta decisão não decide.** Como um lugar ganha nome (caixa de entrada, geocode no
aparelho), o que acontece ao esquecer uma visita (a lápide de `forgotten_days`) e o
tratamento de viagem. Os três estão fechados no
[spec da Presença](../specs/presenca/spec.md), §6, §8 e §5.4.
