# Presença na Retrospectiva — o bloco "Onde você esteve"

> Spec: [spec.md](spec.md) · [data-model](data-model.md) ·
> [ADR 0059](../../decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md)
>
> **Status:** desenho fechado em **02/10/2026**, numa mesa de seis rodadas (party mode). Nada
> construído — a Fase 1 da Presença não existe. Pedido do dono:
> *"tirar métricas e incluir na retrospectiva para todas as recorrências"*.
>
> As cinco recorrências são as do app: `week` · `month` · `season` (trimestre) · `year` ·
> `all` (período), de [`period/bounds.ts`](../../../packages/shared/src/period/bounds.ts).
>
> **Tudo aqui foi conferido contra os 24 dias reais dele** (§8), que saíram do iPhone em
> 02/10 e estão em `~/Documents/Orbe/presenca-backup-2026-10-02/`.

## 0. O obstáculo, e como ele foi resolvido

**Um bloco novo nasceria invisível.** A Story 2.5 removeu as setas de reordenar. O catálogo
tem **13 blocos**, a `order` salva dele tem 13 entradas, e `resolveRetroPrefs` acrescenta
bloco novo **no fim** da ordem gravada — de propósito, para que seção nova nunca suma. Ele lê
as cinco primeiras.

**Decisão do dono (02/10): a Presença ganha bloco próprio e as setas de reordenar voltam.**

Isso não contraria a 2.5 — **ataca o custo que ela deixou declarado**. O cabeçalho de
[`retro-blocks.ts`](../../../packages/shared/src/period/retro-blocks.ts) escreve, com todas as
letras, que *"um bloco criado depois da 2.5 entra no fim da `order` já salva e fica lá para
sempre, porque não existe mais UI para movê-lo"*, e lista "devolver as setas" como a primeira
saída. A regra que a 2.5 removeu foi a do **congelamento**; as setas caíram junto, de carona.

E **não existe teto de blocos**: conferido no catálogo, no `resolveRetroPrefs`, na migration
`user_preferences_retro_prefs`, na tela do celular e na web. O catálogo é uma lista. Um 14º
bloco entra sem migration nenhuma. Dos 13, só a manchete (`lede`) é `fixed` — por isso a tela
de Diagramação mostra **12** manipuláveis, e esse é o único "12" que existe no sistema.

## 1. A fórmula: por que "tempo em casa" é a pergunta errada

Ele escreveu: *"quanto tempo fico em casa (preciso pensar melhor na fórmula, não quero
considerar dormindo e talvez de manhã)"*. O instinto está certo e o problema é maior do que
parece: **das 24 h, ~8 são sono, quase todo em casa.** Uma métrica bruta de tempo em casa
mede principalmente quanto ele dormiu — e quem dorme mais "fica mais em casa".

### 1.1 As três definições, aninhadas

| | Definição | Como se calcula | O que ela estraga |
|---|---|---|---|
| **Bruto** | `seconds` em Casa no dia local | direto do `place_days` | o sono domina |
| **Acordado** | bruto − \|Casa ∩ sono\| | interseção **exata** com `sleep_periods`, no eixo do tempo, recortada depois por dia local | some junto com a noite não medida |
| **Eletivo** | acordado − \|acordar → primeira saída\| | a rotina matinal, que é logística e não escolha | **assimétrico** — ver §1.2 |

O **Acordado** é exato, não estimado: desde 04/09 o sono é evento com instantes
(`sleep_periods`), não um bloco diário. Nada de "descontar das 00h às 07h" — isso seria
inventar uma noite fixa para alguém cuja dispersão de horário o próprio app já mede.

A interseção precisa ser feita **no eixo do tempo e só depois recortada por dia local**, pela
mesma razão que a visita é: a noite cruza a meia-noite. É a mesma máquina do rollup
(data-model §2.3).

### 1.2 Por que o Eletivo não pode ser a manchete

A rotina matinal só existe em dia que tem **primeira saída**. Num dia em que ele não sai, não
há desconto nenhum — então o Eletivo desconta de dias de escritório e não desconta de dias em
casa. É exatamente a comparação que ele mais quer fazer, **enviesada pela própria definição**.

Eletivo serve como leitura secundária, dentro da mesma classe de dia. Nunca como manchete.

### 1.3 A manchete é **dias sem sair de casa** (decidido em 02/10)

A mesa recomendou "horas fora de casa" — virar a métrica do avesso, porque toda hora fora é
hora acordado e nenhum desconto é necessário. **O dono recusou:** a pergunta dele é *"em
quantos dias eu não saí"*, e horas fora fica como número **secundário**, não como manchete.

A troca melhorou duas coisas que a recomendação não tinha:

- **O desenho.** "Horas fora" num heatmap anual é um gradiente de 365 tons. **"Saiu / não
  saiu" é binário** — célula cheia, célula vazia — e a reclusão de um ano se enxerga de longe,
  sem ler número nenhum. Com **três** estados, nunca quatro: cheia, vazia e **sem cobertura**.
- **A pergunta.** "Dias sem sair" responde sozinha; "horas fora" precisa de contexto (fora
  fazendo o quê, comparado com qual semana).

E piorou uma, que é o resto deste documento: **é a métrica mais frágil da lista.**

### 1.4 Por que a manchete escolhida é a mais frágil — e o que a sustenta

Em "horas fora" uma falha de sensor tira minutos de um número. Em "dias sem sair" ela
**inverte o dia inteiro**: perdida a saída, o iOS acha que ele nunca saiu, não entrega
chegada nenhuma, e o dia vira uma estadia contínua em casa. Erro binário, para o lado bonito.

**Duas testemunhas sustentam a métrica, e cada uma cobre uma borda diferente:**

| Testemunha | Audita | Como |
|---|---|---|
| `sleep_periods` | a **chegada** | noite dormida sem visita em Casa cobrindo = ou dormiu fora, ou a chegada se perdeu |
| **atividade com rota** | a **saída** | dia "não saiu" com uma pedalada de 42 km dentro é um dia que o sensor perdeu |

E uma terceira que não precisa de testemunha nenhuma — **a própria sequência**:
`exit` → `exit` sem chegada no meio é uma **chegada perdida**; `enter` → `enter` é uma
**saída perdida**. O app acha isso sozinho, lendo o próprio log.

Nos 24 dias reais isso achou **4 anomalias** (§8.2). Não é hipótese.

### 1.5 A invariante que impede o bloco de mentir

```
fora de casa  +  em casa acordado  +  dormindo  +  não coberto  =  24 h
```

É a mesma disciplina de `medido + esquecido + não coberto` da lápide (spec §8). Se as quatro
fatias não fecham, o bloco está errado — e o teste dessa identidade é o que trava a
implementação.

## 2. As cinco que ele pediu, definidas

| # | Nome no jornal | Definição operacional |
|---|---|---|
| 1 | **Dias sem sair de casa** — **A MANCHETE** | dias cobertos sem nenhuma ausência acima do limiar de saída (§7) |
| 2a | **Dias em que saí** | dias cobertos com ≥ 1 saída — o complemento de (1) |
| 2b | **Noites fora de casa** | dias em que \|Casa ∩ sono\| = 0: ele dormiu em outro lugar |
| 3 | **Horas fora de casa** | mediana por dia — número **secundário** desde 02/10 (§1.3), com "em casa acordado" ao lado |
| 4 | **Tempo no escritório** | mediana **por dia de escritório**, mais o total do período |
| 5 | **Dias de escritório** | dias com ≥ 1 visita **confirmada** (não `provisional`) a `kind='work'` |

**O item 2 do pedido dele era ambíguo** e vira duas métricas diferentes: "fiquei fora de
casa" pode ser *saí de casa naquele dia* (2a) ou *não dormi em casa* (2b). As duas são úteis
e nenhuma substitui a outra — 2b é a métrica de viagem e de noite fora, e tende a zero na
rotina normal, o que a torna uma boa manchete quando acontece.

**Por que a mediana e não a média** (itens 3 e 4): é a decisão já tomada no Sono — um dia
anômalo não pode mover o número do período. Para o item 4 a divisão é por **dia de
escritório**, não por dia do período: dividir 18 h por 30 dias produziria "0,6 h/dia", que não
é nada.

**Por que visita confirmada** (item 5): passar de carro em frente ao escritório não é ir ao
escritório. O limiar de 8 min já existe e mediu **1** passagem em 23 dias — barato de aplicar,
e evita a única forma de esse número inflar.

## 3. Como cada uma se comporta nas cinco recorrências

| Métrica | semana | mês | trimestre | ano | período |
|---|---|---|---|---|---|
| Dias sem sair | contagem | contagem + % | contagem + **média por semana** | idem + o mês campeão | idem + a sequência mais longa |
| Dias em que saí | contagem | contagem | % dos dias cobertos | % | % |
| Noites fora | contagem | contagem + onde (fase 3) | contagem | contagem + a mais longa | contagem |
| Horas fora | mediana/dia | mediana + p25–p75 | mediana + **por estação** | mediana + a **série por dia** | mediana + "X dias inteiros fora" |
| Tempo no escritório | total | mediana/dia de ida | mediana | total → "N semanas de trabalho" | total |
| Dias de escritório | contagem | contagem + **média por semana** | média por semana + **quais dias da semana** | idem + o padrão por mês | idem |

Três regras de redação, herdadas do jornal:

- **Contagem crua só funciona em período curto.** "48 dias no escritório" não diz nada
  sozinho; "2,3 dias por semana" diz. Da `season` para cima, contagem sempre vem com taxa.
- **Soma grande vira conversão.** No `year` e no `all`: "238 dias fora de casa" → "7,8 meses".
  É o que um jornal faz com número grande.
- **Comparação com o período anterior** é a gramática existente, e sai em **minutos e dias**,
  nunca em seta, nota ou índice.

## 4. Honestidade — o que o bloco se recusa a dizer

| Situação | O que o bloco faz |
|---|---|
| Dia com a permissão caída (`place_days.incomplete`) | fora de toda média, e contado à parte |
| Dia de viagem | "tempo em casa" fica **em branco, nunca zero**, e sai das médias |
| Borda estimada (`inferred_edges`) | aparece: "3 h 40 em casa *(1 borda estimada)*" |
| Período com menos de **10 dias cobertos** | o bloco **não existe** naquele período |
| Noite sem medição de sono | derruba só o *Acordado* do dia, nunca o *fora* |

O mínimo de 10 é o mesmo piso da lápide ("nada com menos de 10 medidas", 23/09) — não vale a
pena inventar um segundo limiar para a mesma pergunta.

E a cobertura aparece escrita, sempre: *"sobre 23 dos 30 dias"*. É a diferença entre um
número menor e um buraco, que é o modo de falha nº 1 da feature inteira (spec §10).

## 5. O que mais essa leitura destrava

Além das cinco. Agrupadas pelo que cada grupo custa: **(1)** sai com a Fase 1 e só a Casa
cadastrada · **(2)** precisa de mais lugares · **(3)** precisa da Fase 2 (carimbos) ·
**(B)** precisa do `CLVisit`, fase 3.

### 5.1 O ritmo da porta — tudo (1)

- **Hora de sair e hora de chegar**, com a dispersão — exatamente a leitura de regularidade
  que o Sono já faz. *"Você sai às 8h12, mais ou menos 34 min."* O código do SRI já existe.
- **Dias de porta única** (saiu uma vez) × **dias de vai-e-vem** (3+ saídas). É a textura do
  dia, e nenhum app tem.
- **O maior intervalo sem cruzar a porta** no período. Não é "tempo em casa": é confinamento
  contínuo, que é outra coisa — e numa semana de chuva belga vira manchete.
- **A primeira saída por dia da semana.** O fim de semana aparece sozinho.
- **O dia mais longo fora** e o mais curto, com data.

### 5.2 O escritório — (1) com o lugar já cadastrado

- **Quais dias da semana ele vai.** *"Seu escritório é terça e quinta"* é frase de jornal, e
  com híbrido 2–3 dias é a estrutura real da semana dele.
- **A jornada**: chegada → saída, e quanto dela foi contínua (vs. saiu para almoçar).
- **O trajeto**: minutos entre a saída de casa e a chegada no escritório, e a **variação** —
  trem atrasado aparece como cauda. Custa zero: são duas travessias que já existem.
- **Dias de escritório que viraram dias sem treino**, cruzando com o que já está no banco.

### 5.3 Os cruzamentos — o que só o Orbe consegue

| Leitura | Precisa de | Por que importa |
|---|---|---|
| Chegada em casa × hora de apagar | (1) | a hipótese óbvia que ele **nunca mediu** |
| Última saída do dia × latência do sono | (1) | 36% das noites têm latência > 30 min e nenhuma explicação |
| FC de repouso em casa × no escritório | (3) | `health_series` é minuto a minuto; nenhum app comercial tem as duas séries |
| Horas fora × **nota do dia** (1–5) | (1) | exposição × humor, de graça: os ratings diários já existem |
| Horas fora **por estação** | (1) | na Bélgica isso é variável real, não detalhe. Mensurável a partir do 2º ano |
| Tempo em casa × litros de cerveja | (3) | metade da história do hábito é se ela acontece na cozinha ou num café |
| Dias de escritório × hidratação / hábitos | (3) | a comparação natural da rotina dele, com n suficiente em dois meses |

### 5.4 O ano

- **Série "horas fora de casa" por dia**, ao lado de Sono e Acordado no `yearSeries`. Entra
  no bloco que já existe, sem desenho novo.
- **Heatmap de presença**: o ano inteiro, uma célula por dia, intensidade = horas fora.
- **Lugares novos no período** — a matéria-prima de uma retrospectiva anual, e a única coisa
  da lista que **só** o `CLVisit` produz **(B)**.

## 6. Os lugares a cadastrar

Ele usa **2 das 20 vagas**. As vagas não são só monitoramento: são o **orçamento dos
alertas** (spec §7), então a alocação tem regra — lugares com alerta primeiro, depois os mais
visitados.

| Lugar | O que destrava | Prioridade |
|---|---|---|
| **Academia / ginásio** | o **custo real de treinar**: tempo na academia × duração do treino no HealthKit. A diferença é vestiário, espera e conversa, e hoje ela some | **alta** |
| **Supermercado principal** | o **ciclo real de reposição da casa** — mais honesto que a lista, porque não depende de lembrar de escrever. E é o gatilho canônico da fase 4 | **alta** |
| **Casa de família / amigo recorrente** | `is_private = true`: entra no tempo total, nunca aparece nomeado na Retrospectiva nem em export | média |
| **Estação de trem / parada** | fecha o trajeto com precisão. **Cuidado:** raio de 100 m numa estação urbana engole o comércio em volta | média |
| **Aeroporto (Zaventem)** | a viagem passa a se contar sozinha, com ida e volta, sem ele fazer nada | média |
| **Café / padaria de ritual** | só vale se for ritual. Lugar de uma visita é `CLVisit`, fase 3 — nunca vaga de geofence | baixa |

**A regra que evita desperdiçar vaga:** cadastrar lugar que ele visita **uma vez** é o erro
clássico. Cauda longa é o trabalho do `CLVisit`; vaga de geofence é para o que se repete ou
para o que precisa alertar.

**Consequência medida de cadastrar mais:** cada lançamento do app gera **um relatório de
estado por região** (spec §2.1). Com 2 lugares foram 290 relatórios em 23 dias (~6,3
lançamentos/dia). Com 8 lugares seriam ~50/dia, e o log de 500 passaria a ser quase só
relatório — **nenhuma travessia se perde** (o `aparar` poda relatório primeiro), mas a tela de
debug fica menos legível. A partir da Fase 1 isso deixa de importar: o evento vai para o
banco.

## 7. Os dois limiares

Eles fazem coisas diferentes e **não são o mesmo número**:

| | Valor | O que faz | De onde saiu |
|---|---|---|---|
| **Colagem** | **20 min** | a ausência **some**: duas visitas a Casa separadas por menos que isso viram uma | medido na Fase 0 — 4 colagens em 23 dias |
| **Saída** | **45 min**, configurável | a ausência **existe e conta em horas**, mas o dia continua "não saí" | escolhido pelo dono em 02/10, conferido contra o dado em §8.1 |

Disso decorre um fato que precisa estar escrito **antes** de alguém ver na tela:
**um dia pode ter 40 minutos fora de casa e ainda contar como "não saí".**

O limiar de saída é **configurável e derivado na leitura — nunca gravado**. É o precedente do
`habits.unit_price`: mudar o número vale **retroativo, sem backfill**, porque o banco guarda
segundos e chegadas, e o binário "saiu / não saiu" nasce na hora de ler. Gravar o binário
congelaria a resposta e obrigaria um backfill a cada ajuste do botão.

> **A revista congela o que a tela recalcula.** Uma edição já impressa guarda o texto com o
> número do dia em que foi impressa. Mudar o limiar depois faz a edição antiga discordar da
> tela — e está certo que discorde: ela é um jornal daquele dia.

## 8. A medição: 24 dias reais (07/09 → 01/10/2026)

O log saiu do iPhone em 02/10 por `xcrun devicectl device copy from --domain-type
appDataContainer`, copiando **só** `Library/Application Support/com.sydtpt.vitale/RCTAsyncLocalStorage_V1`
(124 KB). Copiar o container inteiro puxa **16 GB** — quase tudo `Library/Caches/VideoThumbnails`,
JPGs de 4 a 7 MB cada — e enche o disco do Mac.

**372 eventos · 74 travessias · 298 relatórios de estado · 24 dias distintos.**
Casa (raio 150 m): 59 travessias · Trabalho (220 m): 15.

### 8.1 O limiar de saída caiu num buraco da distribuição

As quatro menores ausências de casa: **5 · 5 · 10 · 25 min**. A seguinte: **65 min**.
Não existe **nenhuma** ausência entre 26 e 64 minutos em 24 dias.

| Limiar | Dias que saiu | Dias sem sair |
|---|---|---|
| 20 min | 21 | **4** |
| 30 min | 21 | **4** |
| **45 min** | 21 | **4** |
| 60 min | 21 | **4** |
| 90 min | 19 | 6 |

**Consequências.** O 45 está seguro: qualquer valor entre 26 e 64 produz resultado idêntico.
O botão de configuração só começa a mudar alguma coisa por volta de **90 min** — abaixo disso
ele é um controle sobre uma faixa vazia. E a objeção de que 45 apagaria a ida ao mercado
**não se sustenta no dado dele**: ele sai por 25 minutos ou por mais de uma hora, e nada no
meio. *(Isso pode mudar quando houver mais lugares cadastrados — o botão existe para isso.)*

### 8.2 O sensor erra uma vez a cada seis dias

| Quando | Assinatura | O que foi |
|---|---|---|
| 17/09 (duas vezes) | `exit` → `exit` | **chegada perdida** |
| 24/09 | `exit` → `exit` | **chegada perdida** |
| 26/09 | `enter` → `enter` | **saída perdida** |

**3 chegadas perdidas contra 1 saída perdida** — o inverso do que a proposta assumia como
falha dominante. E o dano é concreto: a chegada perdida de 17/09 fabrica uma ausência de
**30 h 48 min**, das 09:11 de quinta às 15:56 de sexta, que **parece noite fora e não foi**.

Dos quatro períodos fora que atravessam a noite (11/09, 17/09, 19/09, 26/09), só o de **19/09**
(19 h 34, sábado→domingo) é noite fora de verdade.

### 8.3 A manchete, medida pela primeira vez

**4 dias sem sair de casa, em 25.**

## 9. A correção manual

Quatro casos reais já esperam por ela (§8.2), com data. O desenho:

- **É uma visita manual com horário**, não um binário: `source='manual'`, `place_id` **nulo**
  — que em `place_days` já significa *"fora de qualquer lugar conhecido"*. Nenhuma tabela nova.
- **Pré-preenchida pela testemunha** que acusou a contradição. Se o detector foi a pedalada,
  o app já tem `start_at` e `end_at` dela: a folha abre com *"saiu 14:02, voltou 16:48"* e ele
  confirma ou arrasta. Ninguém reconstitui horário de memória.
- **Precedência `manual > geofence > clvisit`**, escrita e testada. Sem ela o dia soma 26 horas,
  porque o geofence continua afirmando que ele ficou em casa no mesmo intervalo.
- **O dia corrigido continua valendo nas medianas de duração** — a duração dele é conhecida.
  *(Era o preço que a recomendação original, binária, pagava; o horário o devolve.)*
- **A correção nunca sobrescreve a medição.** Padrão da casa: `type_edited`, `name_edited`,
  duração editada. E a cicatriz junto: o `type_edited` nasceu porque a correção **não durava** —
  o sync regravava o campo sem guarda e desfazia tudo *sem erro, sem aviso, sem marca*. Aqui
  o reescritor não é o sync, **é o rollup**: se ele não ler a correção, ela some em silêncio
  toda noite.

**Onde ela mora:** a Retrospectiva já tem **caixa de correções** — o conceito está em produção
em `sleep/retro.ts`. A Presença não inventa tela de correção; ela põe as contradições dela na
caixa que já está impressa. Cada linha tem duas respostas, e **as duas gravam**: "saí" e "está
certo" — senão a mesma pergunta volta toda semana.

## 10. O que depende de qual fase

| Entrega | Fase |
|---|---|
| As cinco métricas pedidas, com só Casa e Trabalho cadastrados | **1** |
| O ritmo da porta (§5.1) e o escritório (§5.2) | **1** |
| Chegada em casa × sono, horas fora × nota do dia | **1** |
| Academia e supermercado | 1, assim que ele cadastrar |
| FC por lugar, hábitos e cerveja por lugar | **2** |
| Lugares novos, noites fora **com nome**, o mapa da vida | **3** |

Nada aqui exige o `CLVisit` para começar a existir. **A Fase 1 entrega o bloco inteiro** —
é o argumento mais forte a favor da ordem escolhida na ADR 0059.
