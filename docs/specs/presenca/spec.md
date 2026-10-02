# Presença — onde o dia foi

> **Status:** **Fase 0 medida, aprovada e com o log fora do aparelho.** O portão foi
> respondido em 30/09/2026; em 02/10 o log dos **24 dias** foi extraído do iPhone e virou
> medição (ver [retrospectiva.md §8](retrospectiva.md)). O desenho do produto foi fechado em
> 02/10 numa mesa de seis rodadas. **O núcleo puro e a migração estão prontos**: as quatro
> tabelas entraram em produção em 02/10 e `packages/shared/src/presence/` tem 54 checagens.
> Falta o aparelho — a fila, a semeadura e a guarda da permissão.
> Backup do log: `~/Documents/Orbe/presenca-backup-2026-10-02/`.
> Decisão: [ADR 0059](../../decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md).
> Data-model: [data-model.md](data-model.md).
> Métricas do jornal: [retrospectiva.md](retrospectiva.md) — o bloco "Onde você esteve",
> as fórmulas e as cinco recorrências.
> Tarefas: [tasks](../../../_bmad-output/implementation-artifacts/presenca/tasks.md).
> Proposta original (06/09/2026, fechada): artifact `claude.ai/artifact/3afe66ba-f459-4570-8c5f-fca0f140d42d`.
> UX do editor de local (07/09/2026, aprovada e construída): artifact `claude.ai/artifact/00920792`.
>
> Este documento existe porque, até 30/09/2026, todo o raciocínio da Presença vivia só em
> dois artifacts e na memória de sessão. O código da Fase 0 estava na `main` havia 23 dias
> sem um spec que o explicasse.

## 1. Problema

O dono do app quer responder **"quanto tempo fiquei em casa"** sem digitar nada — e, depois
disso, carimbar com um lugar tudo que o Orbe já registra: refeição, transação, hábito,
registro avulso, batimento.

Nada disso existe hoje. O app conhece **onde ele pedalou** (rotas, cidades, países) e não
conhece **onde ele viveu**. São dois mapas diferentes, e só um está no banco.

**Não existe retroativo.** Investigado e encerrado em 06/09/2026, não reinvestigar: o
histórico de localização do Google está desativado na conta dele; geofence e `CLVisit` não
têm API histórica; os Locais Significativos do iOS são E2E e sem API pública; a exportação
da Apple traz o histórico do app Mapas, não rastro de posição. Sobram fotos geotagged e
rotas de treino — as duas enviesadas para o novo, úteis como acelerador da fase 3 e nunca
como base da 1. **"Tempo em casa" começa no dia em que a medição ligou.**

## 2. O portão: o que a Fase 0 mediu

A Fase 0 não escreveu nada no banco. Ela existiu para responder uma pergunta que nenhum
documento responde no papel — **o iOS relança o app encerrado para entregar um evento de
região?** — e para calibrar três limiares com o dado dele, não com a média de ninguém.

**A prova, em 30/09/2026 às 18:36:04:** `chegou · Casa · background · ±40 m · fix de 0s`.
Uma chegada em casa de verdade, entregue com o app fora da tela. O portão passou.

Os 23 dias (07→30/09/2026), lidos na tela `/configuracoes/presenca`:

| Medida | Valor | O que ela decide |
|---|---|---|
| Travessias | **73**, em **23 dias distintos** | Nenhum dia mudo: o instrumento não emudeceu |
| Relatórios de estado | 290 | Fora de toda medida — ver §2.1 |
| Pior dia | **5** (alarme em 60) | Não há flapping |
| Passagens (< 8 min) | **1** | O limiar quase não pega nada; errá-lo custa ~1 visita |
| Colagens (< 20 min) | **4** | **O único dos três que se sustenta** |
| Bordas sem saída | **1** | `inferred_edges` continua necessário, mas o volume é desprezível |
| Precisão mediana | **±19,8 m** | O piso de 100 m tem folga de 5× |
| Lugares | Casa (58 eventos, raio 150 m) · Trabalho (15, 220 m) | 2 das 20 vagas do iOS |

**Veredito: a proposta de 06/09 sobrevive inteira.** Nenhum limiar precisa mudar. A regra
escrita na própria tela — *"se os seus contradisserem o que a proposta assumiu, quem muda é
a proposta"* — não foi acionada.

Duas correções de premissa que a Fase 0 já pagou, e que a Fase 1 herda de graça:

- **A precisão real é ±6 a ±19 m**, não os ~100 m de folclore. O raio de 100 m não é
  recomendação, é piso: abaixo dele o evento deixa de ser sobre movimento e passa a ser
  sobre flutuação de sinal.
- **O iOS entrega reavaliação de estado como entrada** (§2.1).

### 2.1 Travessia ≠ relatório de estado

O iOS reavalia o estado de todas as regiões monitoradas **a cada lançamento do app e a cada
`startGeofencingAsync`**, e o `expo-location` traduz a reavaliação como `enter`. Sem separar
as duas coisas, cada abertura do app vira uma "chegada em casa": o primeiro log real, de
07/09, tinha 16 chegadas e zero saídas com o dono parado em casa — 12 delas entre 01:03 e
01:53, **uma por build instalado**.

O conserto (`f5b790c`) é o último estado por região, persistido em `vitale:presence-state`,
porque o caso que ele resolve é justamente o relançamento: em memória, toda subida do app
começaria sem estado anterior e passaria por travessia. Um evento que não muda o estado
nasce `redundant`, fica fora de toda medida e de todo agregado, mas **continua no log** — ele
é a prova de que a task rodou.

Isto não é detalhe da Fase 0: **a Fase 1 grava visita a partir de travessia, nunca de
relatório.** Um relatório que virasse `visits` inventaria uma chegada por lançamento do app.

## 3. Os dois motores

| | (A) geofence — `expo-location` | (B) `CLVisit` — módulo Swift |
|---|---|---|
| Quem descobre o lugar | você cadastra | o iOS descobre sozinho |
| Borda | nítida, entregue na hora | difusa; a saída atrasa minutos e chega a invadir a visita seguinte |
| Teto | 20 regiões | sem teto |
| Serve para alertar | **sim** | não — ele mede, não avisa |
| Fase | 1 | 3 |

A prioridade declarada do dono é **medir duração**, e nisso o geofence é melhor. Começar
pelo `CLVisit` seria pagar cem linhas de Swift para receber a versão pior da métrica
principal.

Mas ele tem cauda longa de lugares eventuais e quer diário de viagem, e nada disso o
geofence alcança — então (B) não é opcional, é a fase 3. A jogada que faz as duas coisas
caberem é [a ADR 0059](../../decisions/0059-os-dois-motores-de-presenca-escrevem-na-mesma-tabela.md):
**os dois motores escrevem na mesma tabela**, separados por `source`. Nada do que a fase 1
construir é jogado fora quando o Swift chegar.

**Bateria e permissão não são o discriminador.** Os dois usam a mesma infra de baixo consumo
(célula e Wi-Fi, sem GPS contínuo) e os dois exigem "Sempre". O que separa (A) de (B) é quem
descobre o lugar e quão nítida é a borda. Vinte regiões não custam nada: **o motor não é o
problema, o callback é** — se cada `enter` abrir conexão com o Supabase e manter o app
acordado, aí o consumo aparece. Daí a fila local antes de qualquer rede.

## 4. O que a Fase 1 entrega

**Entrega:** as quatro tabelas, a fila local que vira `visits`, a caixa de entrada que dá
nome a um lugar, o rollup diário que os módulos leem, o cartão na Semana, e o **alerta por
lugar** — chegada e saída, com o texto que ele escrever.

**Não entrega, de propósito:**

- **Descoberta automática de lugar.** É `CLVisit`, fase 3. Na fase 1, lugar sem cadastro
  simplesmente não existe — e o dia fecha com "não coberto", nunca com zero.
- **Carimbo nos módulos.** Refeição, transação, registro e hábito recebendo `place_id` é
  fase 2.
- **Gatilho que renderiza conteúdo.** "Chegou no mercado → a lista" é fase 4. O alerta cru
  da fase 1 já sustenta o caso; `alert_route` é a ponte, e quando Compras estiver pronto o
  alerta só muda de destino.
- **Qualquer coisa que aconselhe.** "Você chegou tarde, vá dormir" é exatamente o que a
  Retrospectiva se recusa a ser, e não entra por uma notificação só porque a notificação não
  é a Retrospectiva. O Sono ganha *dados* de chegada em casa; não ganha opinião.

## 5. Comportamento

### 5.1 A visita

Uma visita é `arrived_at → departed_at` num lugar. O par nasce de duas travessias do mesmo
`place_id`. Quatro regras a governam, e **nenhuma delas apaga nada** — o dono pediu para
guardar tudo e limpar depois.

| Regra | Limiar | Causa real | Medido em 23 dias |
|---|---|---|---|
| **Colagem** | vão < **20 min** no mesmo lugar | desceu para jogar o lixo | 4 |
| **Passagem** | duração < **8 min** | passou em frente | 1 |
| **Órfã** | teto de **16 h** | a saída se perdeu | 1 |
| **Sobreposição** | — | dois motores na mesma janela | fase 3 |
| **Saída** | ausência > **45 min**, configurável | ir ao mercado × jogar o lixo | 23 sobreviveram à colagem; ver [§7](retrospectiva.md) |

- **Colagem** funde via `merged_into`: a filha é absorvida, não destruída, e o vão continua
  consultável.
- **Passagem** nasce `provisional` e não entra em agregado nenhum. Aparece na caixa de
  entrada, porque ele prefere errar a mais. Se o mesmo ponto acumular **três** passagens, ele
  vira candidato: um lugar cruzado todo dia *é* informação.
- **Órfã** fecha pelo próximo `enter` em outro lugar, ou pelo teto de 16 h, e
  `departed_source` fica `inferred`.
- **Sobreposição** só existe a partir da fase 3: geofence ganha nos lugares âncora, `CLVisit`
  ganha no resto; duas visitas do mesmo `kind` nunca se sobrepõem.

### 5.2 A tela nunca mente sobre a borda

`inferred_edges` no rollup é o que permite escrever **"3 h 40 em casa (1 borda estimada)"**.
Não é enfeite: é a mesma disciplina de *dado velho não pontua* que a Prontidão já aplica.

A saída é sempre menos nítida que a chegada — o iOS aplica histerese antes de disparar o
`exit`, tipicamente 1 a 3 minutos, e mais se ele sair a pé e devagar. **A tela de
configuração precisa dizer isso**, senão o alerta de saída parece quebrado. Um alerta de
saída serve para *"fechou a janela?"*; ele não serve para *"esqueceu a chave na porta"*.

### 5.3 Meia-noite e fuso

O dia de uma visita é o **dia local da chegada** — daí `tz` estar na tabela. Uma visita que
cruza a meia-noite é **dividida no rollup**, senão "tempo em casa hoje" está errado toda
manhã. É óbvio, e é sempre o que se esquece.

### 5.4 Viagem

- Modo viagem liga sozinho: **mais de 100 km do lugar `home` por mais de 24 h**. E desliga
  sozinho. Não depende de ele lembrar.
- Nos dias de viagem, "tempo em casa" fica **em branco, nunca zero** — zero é mentira. E as
  médias do período excluem esses dias, senão o histórico de rotina apodrece devagar.

## 6. Como um lugar ganha nome

1. **Candidato.** Uma visita sem `place_id` é só um ponto. Vira candidato quando **duas ou
   mais** visitas caem dentro de ~150 m uma da outra, ou quando **uma sozinha passa de
   90 min**.
2. **A caixa de entrada mostra o que já sabe:** "5 visitas, 6 h 20 no total, quase sempre
   entre 12h e 14h", um mini-mapa e um nome sugerido.
3. **A sugestão vem de dentro do aparelho.** `reverseGeocodeAsync` é o `CLGeocoder` da Apple
   rodando no iPhone. Nenhuma coordenada sai para serviço externo — e isso evita repetir a
   lição do Overpass, que não alcança de dentro de uma edge function.
4. **O nome nunca é automático.** O geocode sugere; ele nomeia. Ao nomear, todas as visitas
   do cluster são vinculadas **retroativamente**, inclusive as de meses atrás.

E o centro se corrige sozinho: não é o primeiro ponto, é a **mediana** dos pontos das visitas
confirmadas, ponderada por duração. Mediana e não média — um outlier não arrasta o centro.
O casamento nunca é por distância pura: `dist(ponto, centro) < radius_m + accuracy_m`, porque
uma visita com 300 m de erro não pode valer o mesmo que uma com 40. Empate desempata por
frequência histórica **naquele horário do dia**.

## 7. O alerta (andar 1)

Todo lugar ganha dois interruptores independentes, **chegada** e **saída**, cada um com o
texto que ele escrever. É quase de graça: as notificações locais já existem no app, com
preferências em `notification_prefs`. O que entra de novo são quatro colunas em `places` e a
regra de disparo.

Quatro regras fechadas:

1. **Alerta exige vaga.** Só um lugar com `geofence_slot` pode alertar. Isso transforma as
   **20 vagas do iOS no orçamento real dos alertas**, e dá à alocação uma regra em vez de um
   chute: lugares com alerta primeiro, depois os mais visitados. A tela mostra o placar —
   hoje ela já diz "2 de 20 vagas".
2. **Saída atrasa mais que chegada** (§5.2), e a tela diz isso.
3. **Silêncio.** `alert_cooldown_min`, padrão 60 min por lugar — sem ele, um flapping na
   borda vira spam e a feature inteira é desligada numa tarde. Mais o horário de silêncio, e
   a regra de **não disparar nada enquanto houver atividade aberta no HealthKit**.
4. **Todo alerta abre uma tela.** `alert_route` leva a uma rota do app. É o que faz o andar 2
   nascer sem reescrever o andar 1.

## 8. Esquecer deixa lápide

Decidido em 06/09/2026, depois de três alternativas. A visita some inteira — linha,
coordenada e `raw` — e o dia guarda só **quanto** foi esquecido, nunca *o quê*.

`forgotten_days` é tabela separada **de propósito**: dentro de `place_days` a própria chave
(`place_id`) denunciaria o lugar que ele mandou esquecer.

Três consequências que vêm junto:

1. **O total continua fechando.** `medido + esquecido + não coberto` = o dia. A tela diz
   "3 h 40 em casa · 1 h 10 esquecida", e a Retrospectiva carrega a mesma linha no período.
   Nenhum agregado passa a mentir por omissão.
2. **O lugar pode ter que ir junto.** Se um lugar ficar sem nenhuma visita depois do
   esquecimento, `places` pergunta se ele some também — senão o nome sobrevive e entrega
   exatamente o que ele mandou apagar.
3. **Um guarda de 48 h impede a ressurreição.** O `CLVisit` reentrega a mesma chegada quando
   descobre a saída; sem guarda, a visita recém-esquecida volta sozinha. O guarda registra
   **só o instante**, nunca a coordenada, e é purgado depois.

## 9. Lugar não é módulo

São 10 módulos, e a [ADR 0031](../../decisions/0031-sono-e-categoria-nao-modulo.md)
já estabeleceu que Sono é categoria, não módulo. **Lugar é uma dimensão**, como o tempo: ele
carimba os outros.

Sem papel novo na paleta, sem cor própria. Cada visita usa a cor do módulo apontado por
`places.module`, via `moduleOf()`. Nenhum hex autorado. A tela vive pelo Mais, não na barra.

## 10. Riscos, em ordem de dano

### A permissão cai e o app emudece — **o pior**

O iOS mostra periodicamente o aviso "o Orbe usou sua localização N vezes em background".
Num dia de irritação a permissão é rebaixada para "durante o uso" — e a partir daí o app
**não erra: ele emudece**. Os números continuam aparecendo, só que menores.

É exatamente o modo de falha dos buracos de sono até 18/07, quando o pipeline foi
investigado e o problema era o Foco de Sono. **Mitigação obrigatória:** checar o status a
cada foreground, marcar os dias afetados como incompletos no rollup, e a tela mostrar o
buraco em vez de um número menor.

Nota lateral que remove um medo: **não há revisão da Apple aqui.** O app é dele, distribuído
por EAS e por cabo — "Sempre" não precisa ser justificado para ninguém.

### Dado errado — alto

- **Saída perdida** infla justamente a métrica principal: 14 h em casa porque o `exit` sumiu.
  `departed_source` e `inferred_edges` são o antídoto, não luxo.
- **Flapping na borda**, resolvido pela colagem de 20 min e por raio generoso. Medido: pior
  dia de 5 eventos, contra o alarme em 60. Não é um risco vivo no aparelho dele.
- **Passagem contada como visita**, resolvida pelo limiar de 8 min + `provisional`.
- **Meia-noite** (§5.3).

### Viagem — médio, e silencioso

Fuso desloca todos os dias sem ninguém perceber (§5.3); "casa" deixa de existir e precisa
ficar em branco (§5.4). Bônus da fase 3: o `CLVisit` registra os dois aeroportos, e a viagem
se conta sozinha.

### Bateria — baixo, se o callback for magro

Fila local e sincronização em lote, o mesmo padrão do ingest que já existe. Instrumentação:
contar eventos por dia — mais de ~60 é sinal de flapping, não de vida agitada. **Medido: 5.**

### Privacidade — o que sobra depois do RLS

Banco de um usuário só, com RLS, já resolve o essencial. Sobram três coisas: o backup do
Supabase passa a conter o rastro dele (aceitável — é dele); `is_private` nos lugares de
terceiros, que ficam fora de export e de qualquer texto da Retrospectiva; e a regra de
**nunca mandar coordenada para serviço externo**, garantida enquanto o reverse geocode ficar
no `CLGeocoder`.

## 11. As fases

| | Fase | Estado |
|---|---|---|
| **0** | Observação sem escrever no banco: geofence, log local, tela de debug | **Medida e aprovada** (07→30/09/2026) |
| **1** | O esqueleto e os alertas: as tabelas, a fila, a caixa de entrada, o cartão na Semana | **liberada, não começada** |
| **2** | Os carimbos: `place_id` em refeição, transação, registro e hábito; FC por lugar | — |
| **3** | O `CLVisit`: módulo Swift, cauda longa, modo viagem, o mapa da vida | — |
| **4** | Os gatilhos de módulo: chegou no mercado → a lista renderizada | — |

Cômodos (quarto, cozinha, escritório de casa) ficam **fora de todas elas**: distam 5–10 m,
uma ordem de grandeza abaixo do ruído do sensor, e só sairiam com `CLBeaconRegion` — que
custa hardware, módulo Swift e vagas do **mesmo teto de 20**. Adiado em 07/09/2026.

## 12. O que a Fase 1 faz com os 24 dias já medidos

O log da Fase 0 tem **74 travessias reais** entre 07/09 e 01/10/2026. A Fase 1 o importa: cada
par `enter`/`exit` do mesmo `placeId` vira uma visita `source='geofence'`, com
`client_event_id` herdado do id do evento — que já é único e já deduplica no aparelho.

**O log já não vive só no aparelho.** Em 02/10 ele foi copiado por cabo
(`xcrun devicectl device copy from --domain-type appDataContainer`, só a pasta
`RCTAsyncLocalStorage_V1`, 124 KB) para `~/Documents/Orbe/presenca-backup-2026-10-02/`, com
`LEIA-ME.md` e conferência por `sha256`. A semeadura pode ler **desse arquivo** em vez de ler
do iPhone.

Isso nunca foi urgente pelo teto — o corte sacrifica relatório antes de travessia, e as 74
travessias só encostariam nos 500 por volta de **fevereiro de 2027**. Era urgente porque **o
log morre com o app**: uma reinstalação que apague o container levaria tudo junto, e nada
disso é recuperável por outro caminho (§1). O backup fecha esse risco até 01/10; **o que for
medido depois só existe no aparelho**.

## 13. Depois desta rodada

1. Construir na ordem das fases do tasks — o núcleo puro primeiro, testável sem aparelho.
2. A migration é aplicada à mão, com confirmação (política do AGENTS.md), e registrada em
   `supabase_migrations.schema_migrations`.
3. Conferir no iPhone com uma semana de verdade antes de considerar entregue: é a única
   forma de medir o custo do callback e o comportamento da permissão.
4. Candidato natural a seguir: **FC por lugar** (fase 2). O `health_series` tem a série
   minuto a minuto desde 05/09 e a visita é só um intervalo — FC de repouso em casa contra o
   escritório é leitura que nenhum app comercial entrega, porque nenhum deles tem as duas
   séries.

## Apêndice A — o que passa a existir como número

O inventário dos usos, levantado na proposta de 06/09/2026. Ele está aqui porque a pergunta
"e depois, como se usa isso?" é a que mais custa recuperar: **(A)** precisa só do geofence
(fase 1–2), **(B)** precisa do `CLVisit` (fase 3). Nada nesta lista é compromisso de
entrega — é o mapa do que o dado destrava.

| Módulo | Leitura | Motor |
|---|---|---|
| **Casa** | Tempo em casa por dia e por semana, contra o período anterior | A |
| | Hora de chegada e de saída, e a **dispersão** delas — a mesma leitura de regularidade do Sono | A |
| | Dias em que não saiu. Com híbrido 2–3 dias, esse número é invisível hoje | A |
| | O maior intervalo sem cruzar a porta. Não é "tempo em casa": é confinamento contínuo | A |
| **Sono** | Hora de chegar em casa × hora de `deitou`. A hipótese óbvia que ele nunca mediu | A |
| | Dispersão da chegada × dispersão do deitar, lado a lado | A |
| | A última saída do dia × latência do sono. 36% das noites têm latência > 30 min sem explicação | A |
| **Saúde** | **FC por lugar** — repouso em casa vs. escritório. Nenhum app comercial tem as duas séries | A |
| | A FC nos 30 min após chegar em casa: o tempo de descompressão, medido | A |
| | Horas fora de casa como proxy de exposição à luz. Na Bélgica, no inverno, isso é variável | A |
| **Treino** | Tempo na academia × duração do treino no HealthKit. A diferença é o custo real de treinar | A |
| | Minutos entre a saída de casa e a chegada no treino | A |
| | Paradas dentro da pedalada — a rota diz por onde passou, não onde ficou | B |
| **Alimentação** | QuickAdd carimbado com o lugar ativo, sem digitar | A+B |
| | Proporção comeu-em-casa vs. comeu-fora, por semana | A+B |
| | Cerveja com endereço: metade da história do hábito é se ela acontece na cozinha ou num café | B |
| **Água** | Hidratação por lugar. Se o contador cai nos dias de escritório, ele descobre sem procurar | A |
| **Hábitos** | Cada hábito ganha um "onde". Qual deles só sobrevive em casa? | A |
| | Cumprimento nos dias de escritório vs. de casa — n suficiente em dois meses | A |
| **Compras** | Frequência e duração das idas ao mercado, cruzadas com o tamanho da lista | A+B |
| | O intervalo entre idas **é o ciclo real de reposição da casa**, e não depende de lembrar de escrever | A |
| **Finanças** | Transação carimbada com o lugar | A+B |
| | **A lacuna:** 50 min num restaurante e nenhuma transação. É medição, não conselho | A+B |
| **Tarefas** | Onde ele de fato conclui cada tipo de tarefa | A |
| **Cultura** | Cinema, livraria e sala de concerto viram lugares | B |
| **Registros** | Toda marcação avulsa nasce com lugar — "dor de cabeça" ganha geografia | A+B |
| **Metas** | "50 dias no escritório este ano", "12 cidades novas". `evaluateGoal` é pura: só muda a fonte | A+B |
| **Semana** | Faixa de 7 dias com as horas fora de casa. É onde o cartão da fase 1 nasce | A |
| **Retrospectiva** | Bloco **Onde você esteve**: casa / fora / escritório, contra o período anterior | A |
| | Lugares novos no período — a única coisa aqui que **só** (B) produz | B |
| | No Ano: série "horas fora de casa" por dia, ao lado de Sono e Acordado | A |
| | Por estação: o verão belga tira ele de casa? Mensurável a partir do segundo ano | A |
| **Mapa por país** | Hoje o mapa conhece onde ele **pedalou**; com visitas, passa a conhecer onde ele **viveu** | B |

A ampliação mais forte é a última: o mapa deixa de ser de treino e vira de vida.
