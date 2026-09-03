# 0025 — Carga de treino tem pesos de zona próprios

**Status:** aceita
**Data:** 2026-09-03

## Contexto

A curva de forma (`packages/shared/src/fitness/form-curve.ts`) precisa de uma **carga diária** para rodar as duas médias exponenciais que separam o que foi construído do que está pesando. O núcleo já tinha uma ponderação de zonas de FC pronta: `HR_ZONE_WEIGHTS`, em `health/who-activity.ts`, fixada pela [ADR 0002](0002-minutos-de-esforco-ancorados-no-vigoroso.md).

Reusá-la era o caminho óbvio, e é o errado. Aquela tabela responde a **outra pergunta**:

| | `HR_ZONE_WEIGHTS` (ADR 0002) | `FORM_ZONE_WEIGHTS` (esta) |
|---|---|---|
| Pergunta | "bati o mínimo de saúde da OMS?" | "quanto isso vai me cobrar de recuperação?" |
| z1 | 0 | 0,2 |
| z2 | 0,25 | 0,5 |
| z3 | 0,5 | 1 |
| z4 | 1 | 2 |
| z5 | 1 | 3,5 |

Dois traços daquela tabela a inviabilizam aqui, e os dois são **deliberados** lá:

**z4 e z5 valem igual.** A OMS enuncia duas categorias, moderado e vigoroso; z4 e z5 são as duas "vigoroso", e para a diretriz não há diferença entre elas. Para recuperação há toda: tiro em z5 cobra muito mais que rodízio em z4, e é exatamente o topo da escala que uma curva de forma existe para enxergar. Com a tabela da OMS, um intervalado e um treino contínuo de limiar da mesma duração dariam a mesma fadiga.

**Nenhum peso passa de 1.** É a invariante `effectiveSeconds(a) <= a.durationS`, de que o gráfico de Duração depende para manter a linha de esforço dentro da barra. Um teto em 1 significa que uma hora de treino nunca pode custar mais que uma hora — o que é verdade para "quanto disso contou para a meta semanal" e falso para "quanto isso me derrubou".

## Decisão

Uma segunda tabela de pesos, `FORM_ZONE_WEIGHTS`, exportada e documentada em `fitness/form-curve.ts`. `HR_ZONE_WEIGHTS` fica intocada.

Âncora em **z3 = 1**: um segundo de aeróbico é um segundo de carga. O limiar dobra (z4 = 2) e o máximo quase dobra de novo (z5 = 3,5). Z1 é 0,2 e não zero — recuperação ativa mexe pouco na fadiga, mas mexe, e zerá-la faria um pedal longo e fácil desaparecer do modelo.

A carga de uma atividade tem duas fontes, e qual delas manda é decidido **por atividade**, não por trecho. **Com zonas válidas**, as zonas mandam no trecho que cobrem, e o resto da duração é cobrado a z1: com relógio medindo, tempo fora das zonas é aquecimento ou caminhada abaixo de 50% da reserva (onde z1 começa) ou lacuna de amostra, não trecho "não medido". **Sem zona nenhuma**, o treino inteiro vira **estimativa por tipo**: `durationS × activityWeight(activityId)`, a tabela de MET que `effectiveSeconds` já usa — nunca zero.

**Sem o `Math.max` que o `effectiveSeconds` aplica.** Lá a estimativa por tipo vale para o treino inteiro, porque a leitura canônica da OMS é tipo × duração sem olhar FC, e sem ele *gravar* FC podia valer menos que não gravar. Aqui a pergunta é custo de recuperação e a resposta honesta é que três horas em z1 custam pouco: quando há medição, ela manda. A estimativa por tipo fica só onde não há medição nenhuma — que é onde ela é de fato um chute.

## Alternativas rejeitadas

**Reusar `HR_ZONE_WEIGHTS`.** Uma tabela só, uma coisa a manter. Perde a distinção z4/z5, que é o sinal principal do modelo, e herda um teto que existe para uma invariante de gráfico que a curva não tem.

**Alargar `HR_ZONE_WEIGHTS` para servir aos dois.** Quebraria `effectiveSeconds(a) <= a.durationS` — a linha de esforço sairia por cima da barra de duração — e a ADR 0002 é explícita sobre quem mexer nos pesos precisar preservar o teto. Uma tabela que serve a duas perguntas acaba não servindo bem a nenhuma, e a próxima mudança teria de ser negociada entre elas.

**Pesos de Edwards (1, 2, 3, 4, 5).** É a receita pública e clássica de TRIMP por zona, e teria a vantagem de ser citável. Mas põe uma hora fácil em duas horas de carga e tira a escala do vocabulário do app, que pensa em tempo (a meta semanal é em minutos). Com z3 = 1, um treino aeróbico rende aproximadamente o tempo de relógio, e todo número da curva continua legível como "minutos equivalentes por semana".

**Manter a estimativa por tipo como piso (`Math.max`) também aqui.** Foi a primeira implementação, e o teste a derrubou: `activityWeight(37)` (corrida) é 0,975, quase o mesmo que a âncora z3 = 1. O piso engolia a ponderação em praticamente toda corrida — um rodízio fácil e um treino de limiar davam a mesma carga, e o modelo ficava cego justamente onde precisa enxergar.

## Decisões companheiras

Os pesos não são a única coisa que fixa o resultado. Estas também estão no módulo, cada uma com o porquê no docblock, e mudar qualquer uma delas é ADR nova pelo mesmo motivo dos pesos: muda o histórico inteiro de uma vez.

- **Alpha `1 − e^(−1/n)`**, e não `2/(n+1)`: é a convenção da literatura de carga (a família que intervals.icu e TrainingPeaks usam), e a outra reage no dobro da velocidade.
- **Janelas 42 e 7 dias**: os padrões da literatura para base e cansaço; configuráveis por parâmetro, mas o padrão é o que os apps consomem.
- **Saída em minutos equivalentes por semana** (segundos ponderados por dia × 7/60): é o vocabulário da meta semanal do app; a conversão não muda o saldo, só a unidade.
- **`typical` é mediana de 90 dias**, não média: uma lesão ou uma viagem derrubam a média e passariam a chamar de "normal" um período em que nada aconteceu.
- **As médias começam em zero**, e `shortWindow` declara a imaturidade enquanto o histórico é menor que a janela da base: semear a média no primeiro dia esconderia o problema em vez de resolvê-lo.
- **`trusted` cai a partir de 4 dias sem atividade**: até 3 dias é descanso; do quarto em diante silêncio é indistinguível de sincronização parada, e a curva leria o sync parado como descanso. A regra é a mesma do cartão, fechada na revisão de UX.
- **Resto não coberto pelas zonas vai a z1 quando há zonas, e por tipo quando não há**: com relógio medindo, tempo fora das zonas é aquecimento abaixo de z1 ou lacuna de amostra; sem relógio, não há nada melhor que o tipo.

## Consequências

Passam a existir **duas** ponderações de zona no núcleo, e um leitor desavisado pode pegar a errada. Mitigação: as duas são constantes exportadas e nomeadas pela pergunta que respondem, cada uma com o docblock apontando para a outra, e esta ADR é citada do código.

Os números da curva saem em minutos equivalentes por semana, o vocabulário da meta semanal, mas **não** são comparáveis com ela, nem com os minutos de esforço da OMS, nem com o TSS de outros apps: a unidade de carga é outra. Comparam-se só com eles próprios ao longo do tempo, que é para o que `typical` (a mediana pessoal de 90 dias) existe.

Uma atividade **medida** pode render menos carga que a mesma atividade **sem zona nenhuma**: um pedal de três horas quase todo em z1 dá 0,2 × 10 800 s; o mesmo pedal sem relógio dá 10 800 × `activityWeight(ciclismo)`. Com a regra do resto a z1, a diferença fica restrita a esse caso — uma atividade com relógio nunca mistura as duas fontes. Aqui isso é a resposta certa, não a inversão que a ADR 0002 conserta: o que muda entre os dois casos é a qualidade da estimativa, não o custo do treino. A mitigação prevista é calibrar a estimativa por tipo pela distribuição de zonas que o próprio usuário costuma ter naquele tipo de atividade (o banco já tem essa distribuição), não achatar o trecho medido.

O modelo é só de frequência cardíaca: treino de força entra como duração × tipo, independentemente da intensidade, e subconta o custo de recuperação — uma hora de agachamento pesado e uma hora de mobilidade valem o mesmo. O modelo de carga de força fica registrado como trabalho diferido.

Reverter é barato enquanto não houver UI: apagar a constante e o módulo. Depois de a curva estar num cartão, mudar os pesos muda o histórico inteiro de uma vez — a curva de ontem passa a ter outro valor sem que nada tenha acontecido. Mudança de peso, de alpha, de janela ou de unidade daqui para a frente é ADR nova, não edição.
