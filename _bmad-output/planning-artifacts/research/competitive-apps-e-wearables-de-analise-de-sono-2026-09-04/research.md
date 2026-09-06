---
title: 'Pesquisa competitiva: apps e wearables de análise de sono'
type: 'competitive'
topic: 'Apps e wearables de análise de sono (Oura, Whoop, AutoSleep, Sleep Cycle, Rise, Athlytic, Garmin, Bevel, Apple Health)'
decision: 'O que a view de Sono do Orbe mostra, e qual dado bruto precisa passar a ser gravado'
source: 'run nativo (WebSearch + WebFetch), 4 dimensões, 6 assistentes, 2 rodadas'
status: complete
preset: 'standard'
validation: 'normal'
claims_verified: 8
claims_unverified: 4
claims_disputed: 2
claims_overturned: 1
citation_check: '2 verificadas · 8 parciais · 0 incorretas · 1 não verificável'
created: '2026-09-04'
updated: '2026-09-04'
---

# Pesquisa competitiva: apps e wearables de análise de sono

**Decisão que esta pesquisa serve:** o que a view de Sono do Orbe mostra, e qual dado bruto precisa passar a ser gravado.

---

## Sumário executivo

**A recomendação central: não construa mais um sleep score. Construa a tela que os concorrentes não conseguem construir.**

Três achados sustentam isso.

**1. A métrica com maior poder preditivo demonstrado é a que o esquema de durações torna incalculável.** O Sleep Regularity Index prediz mortalidade **mesmo depois de ajustar por duração média e fragmentação** — UK Biobank, n=88.975, HR 1,53 (IC95% 1,41–1,66) no percentil 5 contra a mediana, caindo para HR 1,42 (1,31–1,55) no modelo ajustado [41]. O SRI exige série binária sono/vigília por época, comparando o estado em *t* contra *t+24h* — não totais por noite; com durações agregadas ele é incalculável.ᴬ O mesmo vale para jetlag social, midpoint, latência, eficiência e separação de cochilos [12][13].

> ᴬ **Ressalva de citação.** A definição operacional do SRI vem de Phillips et al. 2017, que **não foi lido** (paywall). A fonte secundária consultada [39] confirma a escala (−100 a +100) mas **não reproduz a fórmula** nem a exigência de série por época — remete ao original e ao pacote `sleepreg`. A afirmação de incalculabilidade é **inferência definicional coerente com a escala publicada, não citação verificada**. Confirmar no Phillips 2017 antes de virar requisito de spec.

**2. O dado necessário já está na fonte, e o resgate do passado é provável.** O HealthKit expõe sono como **intervalos com `start`/`end` por amostra** — seis casos, `inBed` a `awake` [12]. Nada precisa ser inventado: basta parar de descartar. Quanto ao histórico, o veredito é **SIM com uma ressalva**: o iPhone aparentemente retém sem purga automática [34][35][37], mas *"a autorização de leitura alcança amostras anteriores à concessão"* **não foi verificado contra a doc da Apple** [34]. (Fora do escopo da pesquisa, o Orbe já responde isso empiricamente — ver Recomendações.)

**3. O padrão nº 1 de reclamação, em quatro fontes independentes, é "a nota discorda do corpo"** [25][26][30][49] — e virou **class action** contra a Oura em agosto de 2026, ajuizada pela Clarkson Law Firm, alegando que as estimativas têm "a coin flip's chance of being correct" [25]. Somado a isso, **ortossonia** é entidade clínica com prevalência estimada pelos próprios autores em **3–5%** (n=523) [31][32]. A tela de sono carrega um risco que a de treino não tem: **mostrar um número contestável para quem acabou de acordar tem custo clínico documentado.**

**A síntese das três:** a categoria inteira ancora num score derivado de estágios que ela mesma mede mal (especificidade sono/vigília com médias de 30% a 61% por aparelho, medições individuais indo de 30% a 73% [16]), e depois é acusada de imprecisão exatamente por isso. O caminho aberto é ancorar em **regularidade de horário** — defensável, barata de calcular, e a melhor evidência de desfecho da literatura — e cruzá-la com a **percepção subjetiva** que só um app capaz de perguntar consegue capturar.

E a decisão tem duas metades. A resposta para *o que a tela mostra* é o **`sleep timing chart`**: barras por noite posicionadas na hora do dia, com os despertares como buracos [18][19]. É o gráfico mais bem documentado do inventário, o melhor caso mobile — e depende exatamente do dado que a primeira metade manda passar a gravar.

**A maior ressalva:** a dimensão de crítica de design voltou praticamente vazia em duas rodadas, e o Reddit esteve bloqueado ao crawler do começo ao fim. O que sabemos sobre a insatisfação dos usuários vem de uma petição judicial, de fóruns de fabricante e de um corpus de 23 reviews no Trustpilot. É suficiente para orientar, não para dimensionar.

---

## D1 — A métrica-âncora

**Existem duas famílias, não uma.**

*Score composto normalizado:* Oura ("Sleep Score" 0–100, sete contribuidores — Total Sleep, Efficiency, Restfulness, REM, Deep, Latency, Timing — com faixas 85+/70–84/60–69/<60 e **zero pesos publicados**; a página não faz nenhuma afirmação comparativa de importância entre os contribuidores) [1][2]. Apple ("Sleep Score" 0–100). Garmin (0–100, três fatores: duração contra padrão etário, qualidade — despertares, *quando* ocorreram e WASO — e overnight recovery por VFC) [24].

*Razão ou déficit contra uma necessidade calculada:* Whoop ("Sleep Performance %" = sono total ÷ Sleep Need, com Need = baseline + strain + débito − cochilos) [7][8], que ainda mantém "Sleep Consistency" como métrica própria ao lado da performance [11]. Rise (débito em horas acumulado sobre 14 noites, com a noite anterior pesando 15% e as 13 restantes os outros 85%) [9][22].

**A Apple é a única que publica os pesos: duração 50 / consistência do horário de dormir 30 / interrupções 20** [3][44], corroborado por terceiro [4][45]. A componente de consistência olha *quando você adormeceu nas últimas 13 noites* [3] — hora do dia, não duração. **30% do score da Apple é posição no eixo do tempo.**

Duas escolhas de apresentação merecem nota. A Apple **não mostra o número cru como protagonista**: rotula as faixas de "Very Low" a "Very High" [44]. E em novembro de 2025 mexeu nas faixas **sem tocar na fórmula**, para o rótulo casar melhor com a sensação ao acordar [5][6] — sinal de que o valor percebido mora na calibração do rótulo, não na precisão do número.

A Rise mantém uma página inteira argumentando **contra** sleep scores, posicionando o débito como a métrica correta [10]. É o contra-argumento explícito à decisão em jogo.

> **Contradição resolvida.** Uma rodada achou que regularidade **não** é contribuidor do Sleep Score da Oura [1]; outra achou que a Oura **tem** "sleep regularity" como métrica escalar com gráfico próprio [18]. As duas são verdadeiras e compatíveis: a regularidade existe no produto, fora da composição do score.

---

## D2 — Instrumentação: o dado bruto por trás

**A tabela de dependência é o achado central desta pesquisa.**

| Métrica derivada | Calculável só com durações? | Reconstruível do banco? |
|---|---|---|
| Sleep efficiency (dormindo ÷ **na cama**) | **Não** — falta o denominador | Não¹ |
| Latência de início | Não | Não¹ |
| WASO / nº e duração de despertares | Não — a soma perde quantos e quão longos | Não¹ |
| **Regularidade / consistência** | **Não** — impossível sem hora do dia | Não¹ |
| **Jetlag social** (MSF, MSFsc, SJL) | **Não** | Não¹ |
| Midpoint de sono / cronotipo | **Não** | Não¹ |
| Cochilo separado da noite | Não — durações somadas fundem os dois | Não¹ |
| VFC noturna (forma da curva) | Não | Não¹ |
| Desvio de temperatura vs. baseline | Não | Não — a baseline exige histórico |
| Fuso / viagem | Não | Não — sem offset os timestamps ficam ambíguos |
| **Sleep debt** | **Sim, parcialmente** | **Sim**, se as durações históricas existirem |

¹ Vale para o *banco do app*. Se a fonte retiver as amostras brutas, o backfill é possível.

**Regra que sai da tabela: quase tudo que não é "quantas horas" exige hora do dia.**

Dois campos que a Whoop trata como primeira classe e quase ninguém copia: **`timezone_offset`** — sem ele, hora-do-dia é ambígua em viagem, e viagem é exatamente onde regularidade e jetlag social importam — e **`nap` como booleano na captura**, não inferência posterior [13]. A Whoop e a Oura também separam **período de sono** (evento com timestamps, vários por dia) de **rolagem diária** (score) [13][14]. Um esquema de "uma linha por noite" já é uma decisão que impede cochilos e sono fragmentado.

Vale saber o teto do que a fonte oferece: a Oura amostra **VFC de 5 em 5 minutos ao longo de toda a noite** [15] — persistir só a média já apaga a forma da curva. E o HealthKit ganhou no iOS 18 um tipo dedicado a distúrbios respiratórios noturnos, `appleSleepingBreathingDisturbances`, que é um `HKQuantityTypeIdentifier` (não Category, ao contrário do que se costuma supor) [38].

**Sobre estágios, a evidência é dura.** Contra polissonografia, a **especificidade sono/vigília** — a capacidade de reconhecer que se está acordado — tem médias de 30% a 61% por aparelho: Garmin Vivosmart 4 30% (estudo único; κ=0,20 na categorização multiestado), Whoop 55,7% (medições de 51% a 60%, κ 0,44–0,47), Fitbit Charge 4 61,3% (medições de 48,8%, 62,2% e 73%) [16]. **O teto individual observado é 73%, não 61% — a faixa citada é de médias, não de medições.** Ainda assim os aparelhos são consistentemente bons em dizer "dormiu" e ruins em detectar vigília, o que contamina eficiência, WASO e contagem de despertares. A modalidade limita o teto: PPG é incapaz de identificar todos os estágios; só EEG chega lá [48].

> **Contradição não resolvida.** Uma meta-análise diz que aparelhos de consumo **subestimam** REM em 50–70% [17]; a revisão de 2024 mede o Whoop **superestimando** em +21 min [16]. Provável explicação: gerações diferentes de aparelho. **A implicação prática é idêntica nos dois casos — trate REM/deep como índice do próprio aparelho, comparável consigo mesmo ao longo do tempo, nunca como grandeza física.**

**Definições formais, para quem for implementar.** SRI = probabilidade percentual de estar no mesmo estado (dormindo ou acordado) em dois instantes separados por 24 h, promediada sobre o registro; escala −100 a +100 [39][40]. Social jetlag: MSF = midpoint em dias livres; MSFsc = MSF − (SD_livre − SD_semana)/2; SJL = |MSF − MSW| [42][43].

**Veredito sobre retenção do HealthKit:** o Apple Watch guarda ~1 semana e a Apple não publica a tabela por tipo — mas o Watch sincroniza para o iPhone, que é o repositório de longo prazo [34]. O iPhone aparentemente retém indefinidamente: usuários relatam 5 GB e 7+ anos acumulados, pedindo uma purga que não existe [37]. **Não há política de expiração documentada — silêncio registrado como achado** [36]. O elo que ficou aberto: se a autorização concedida hoje alcança amostras anteriores. Uma frase de terceiro sugere que não, mas parece confundir `earliestPermittedSampleDate()` (limite de **escrita**) com limite de leitura, e a doc não pôde ser lida (SPA em JS) [34].

⚠️ **Armadilha do teste empírico:** a app **não distingue** "sem permissão" de "não há dados" — sem permissão a query retorna vazio, **sem erro**. Um teste mal construído produz um falso negativo.

---

## D3 — Apresentação: gráficos e navegação

**O gráfico que merece ser o herói é o `sleep timing chart`.** Hora do dia no eixo Y invertido (deitar em cima, acordar embaixo), noites no eixo X; cada noite é uma barra vertical, e as interrupções são **buracos dentro da barra** [18][19]. A Oura é a referência documentada; a Rise tem "sleep/wake times" como um de três gráficos alternáveis [22]. Cabem ~14 barras na largura de um telefone — **é o melhor caso mobile do inventário**, e exige exatamente o dado que a D2 diz que falta.

**Ninguém mostra valor absoluto sozinho.** O AutoSleep exibe simultaneamente a média de 12 semanas, a média da semana atual, uma linha de média móvel de 7 dias e cor de semáforo contra a meta [20][21]. A Garmin faz o oposto e **move a própria referência**: em vez de comparar contra um alvo fixo, avalia a duração contra o padrão da faixa etária [24] — a mesma composição descrita em D1.ᴮ

> ᴮ **Correção de citação.** Uma versão anterior deste relatório afirmava que a Garmin recalcula a necessidade em passos de 10 minutos e **trava o resultado entre 7 e 9 h**, e tratava esse limite como revelador. **A verificação não encontrou nenhum desses detalhes na fonte** [24] — a página só menciona a recomendação genérica de que adultos saudáveis dormem de sete a nove horas. O argumento foi removido por falta de lastro.

**Sobre navegação, o quadro é dividido.** A Apple usa seletor de abas explícito **`D · W · M · 6M`, sem ano**, com `D` como padrão — e um **segundo eixo ortogonal** de abas por métrica (Stages / Amount / Comparisons) mais abaixo [44]. O AutoSleep **rejeita o seletor por completo**: janela rolante de 12 semanas com swipe horizontal, drill-down em dois níveis (tap = banner com o resumo, hold = tela cheia da noite) [20]. A Rise alterna entre **três gráficos** dentro de janela fixa de 14 dias [22]. Leitura: **apps de plataforma usam abas de período; apps de terceiros especializados tendem à rolagem contínua** — mas isso é leitura de duas amostras, confiança média-baixa.

**A Apple não oferece visão de ano. Para no 6M.** É um voto contra a aba de ano.

Há também um sinal de direção na estrutura: em outubro de 2025 a Oura condensou cinco abas (Home, Readiness, Sleep, Activity, Resilience) em três — Today, Vitals e My Health, com as tendências de longo prazo concentradas na última [23]. O mercado está saindo de "uma aba por métrica" e indo para "hoje / sinais / longo prazo" — argumento a favor de uma **tela dedicada alcançada a partir de um hub**, e não de mais uma aba de primeiro nível.

**Barra empilhada de estágios em visão semanal/mensal: NÃO CONFIRMADO.** A página da Apple afirma a decomposição por estágio no contexto **da noite**, e ao explicar W/M/6M fala só em "sleep history" [44]. Uma secundária de 2023 sugere empilhamento no agregado [46], mas não faz dupla fonte. **Não sustenta decisão de design.**

**Correlação não é feita por dispersão.** A Oura usa **tags anotadas sobre a série temporal** [18]; o Sleep Cycle tem "Sleep Notes" com entrada manual de cafeína e exercício [47]. Dois produtos independentes escolheram o mesmo mecanismo. **Nenhum scatter e nenhum heatmap foram evidenciados em qualquer produto.**

---

## D4 — A voz dos usuários

| # | Reclamação | Fontes indep. | Implicação de design |
|---|---|---|---|
| 1 | **A nota discorda do corpo** | **4** [25][26][30][49] | A nota não pode ser a heroína. Se aparecer, precisa de caminho de contestação — mostrar *qual* sub-métrica puxou — e aceitar discordância |
| 2 | **Estagiamento não é crível** (diverge 4–7× entre aparelhos) | **3** [25][28][33] | Métrica de **menor confiança e maior destaque visual** hoje. Inversão de prioridade |
| 3 | **Janela de sono detectada errada** | **3** [28][29][33] | Assuma que vai errar: **correção manual como caminho de primeira classe** |
| 4 | **Número sem veredito** | 2 [27][28] | O gráfico não é a entrega. A entrega é o que aquilo significa contra a linha de base *desta pessoa* |
| 5 | **Métricas do mesmo app se contradizem** | 2 [29][30] | Coerência interna vale mais que quantidade de indicadores |
| 6 | **Rastrear piora o sono** (ortossonia, ~3–5% da população) | **2 peer-reviewed** [31][32] | Risco que a tela pode **causar**. Sem streak de nota, sem notificação matinal com número ruim |
| 7 | Não dá para corrigir o dado | 1 [27] | Sinal isolado, mas é a solução do padrão 3 |

O caso mais concreto do padrão 3: um usuário dormiu 4h30, ficou 2h acordado, dormiu mais 2h30. A Oura mostrou a linha do tempo completa com nota 84; o Garmin Connect mostrou **só o último segmento** — 2h30 e nota 38 [28]. Mesma noite, 46 pontos de diferença.

> **A conexão mais importante desta pesquisa:** a reclamação nº 1 e o padrão nº 6 são **o mesmo fenômeno em dois registros**. A literatura clínica descreve como patologia o que os fóruns descrevem como bug.

---

## Insights entre dimensões

**1. A categoria destaca visualmente exatamente o que mede pior.** A D2 mediu especificidade de 30–61% no estagiamento [16]; a D3 mostrou que estágios ocupam o lugar nobre de quase toda tela [44][46]; a D4 registrou que a divergência de estágios é o padrão de reclamação nº 2 [25][28]. **Três dimensões independentes convergindo na mesma inversão de prioridade.** Duração e regularidade são mais defensáveis e recebem menos pixels.

**2. O gráfico melhor avaliado exige o dado mais descartado.** O `sleep timing chart` foi o achado mais acionável da D3 [18]; a D2 mostrou que ele depende de hora-do-dia, a primeira coisa que um esquema de durações joga fora [12][39]. **A melhor decisão de UI e a melhor decisão de esquema são a mesma decisão.**

**3. "Mais preciso da categoria" e "não confiável o suficiente para exibir com autoridade" podem ser ambas verdadeiras.** A Oura é ré numa ação que a acusa de ter "a coin flip's chance of being correct" [25], e é apontada por um estudo hospitalar como o rastreador de consumo mais preciso em quatro estágios — em press release da própria Oura. **O teto da categoria é baixo.** Não é problema de escolher o fornecedor certo.

**4. A direção do viés é oposta entre produtos — logo, não há calibragem a corrigir.** Apple criticada por superestimar (93/"Excellent" numa noite reprovada por outros) [26]; usuários Garmin reclamam de notas baixas demais [28]. O que é universal não é a direção do erro: é o **descolamento entre nota e sensação**. **Projete para o descolamento.**

---

## Evidência contrária

O red team não rodou (`red_team = off`). O que segue são as alegações que sobreviveram em disputa:

- **Contra ancorar em score composto:** a Rise dedica uma página a argumentar que sleep score é a métrica errada, e ancora em débito [10]. Não é fonte neutra — é posicionamento de produto — mas o argumento é coerente com a D4.
- **Contra confiar no estagiamento em qualquer direção:** meta-análise e revisão de 2024 discordam até no *sinal* do viés de REM [16][17].
- **Contra tratar a retenção do HealthKit como resolvida:** a doc da Apple é silenciosa, e o elo da autorização retroativa não foi verificado [34][36].
- **Contra dimensionar qualquer coisa pela D4:** Reddit bloqueado o run inteiro; o único corpus de reviews lido tem n=23 e é autosselecionado [27].

---

## Recomendações

**R1 — Persistir os timestamps, e bumpar `AGG_VERSION`.** *(confiança alta na direção, média nas citações: [41] verificada nos números, [39] não sustenta a definição operacional, [12] não verificável pela URL — ver Nota de verificação)*
Gravar, **por período de sono** (não por dia):

1. instante de adormecer;
2. instante de acordar;
3. `timezone_offset` junto de cada um;
4. os intervalos de vigília **individualmente** — não a soma;
5. `inBed` como grandeza separada da soma dos estágios;
6. um booleano de cochilo, decidido na captura. **Sobre o resgate do passado, esta pesquisa entrega um SIM com ressalva** [34][35][37] — mas o Orbe já responde isso empiricamente fora do escopo da pesquisa: o `syncHealth` relê `BACKFILL_DAYS = 500` dias do HealthKit a cada bump de `AGG_VERSION`, e o backfill de estágios e latência de agosto já provou que a leitura histórica funciona neste aparelho. **A janela não está fechando — mas gravar a partir de agora é barato e independe do resgate.**

**R2 — Ancorar em regularidade, não em score composto.** *(confiança alta para a evidência de desfecho — [41] teve n, HR e IC conferidos linha a linha; média para as definições formais [39][42], que vieram de secundárias)*
É a métrica com maior poder preditivo demonstrado, é calculável com o dado de R1, não depende de estagiamento — e nenhum concorrente a colocou no centro. A Apple chega mais perto, com 30% do peso [3][44], ambas as fontes verificadas.

**Precisão importante, saída da verificação:** o paper mostra que o SRI **sobrevive ao ajuste por duração média e fragmentação** (HR 1,42 no modelo ajustado) — isso sustenta R2. O que o paper **não** diz é que o SRI supera a duração absoluta; a comparação de superioridade que ele faz é contra *métricas de desvio-padrão* (SD de duração e SD de horário de início), onde acrescentar o SRI melhora o modelo (p<0,001) e o inverso não melhora (p=0,10) [41]. Use o argumento na forma correta: **regularidade acrescenta informação que a duração não carrega**, não "regularidade importa mais que dormir o suficiente".

**R3 — O par percepção × medição é a tela que só o Orbe pode fazer.** *(confiança alta; [25][26][30][31][32])*
O padrão de reclamação nº 1 da categoria inteira é o descolamento entre nota e sensação — e todo concorrente só tem um dos dois lados. O Orbe já grava `sleepQuality` 1–5 ao acordar. **Cruzar os dois transforma o problema estrutural da categoria em conteúdo próprio.**

**R4 — `sleep timing chart` como gráfico principal.** *(confiança alta [18][19]; a leitura de padrão de navegação é média-baixa)*
Barras verticais na hora do dia, buracos para os despertares. Mobile-first de verdade. Ao lado, a regularidade como escalar. O hipnograma fica no **detalhe da noite**, com scrub — nunca no agregado.

**R5 — Estágios com incerteza explícita, e nunca como base de conselho.** *(confiança alta [16][17][48])*
Rotular como índice comparável consigo mesmo. Não publicar percentuais contra normas clínicas.

**R6 — Guarda-corpos contra ortossonia.** *(confiança média — a prevalência foi corrigida na verificação, ver abaixo)*
Sem streak de nota, sem notificação matinal empurrando número ruim, e um modo que mostre tendência sem o placar do dia. **A prevalência que os autores concluem é de ~3–5%**, não os 3–14% que uma versão anterior deste relatório citou: os 14% são o resultado do corte mais frouxo do APSQ (≥30), enquanto ≥35 dá 8,6% e ≥40 dá 3,0% [32]. Mesmo em 3–5%, com 35,8% da amostra usando wearable de sono regularmente, o risco é real e barato de mitigar — mas é honesto dizer que ele **não** é o argumento mais forte desta pesquisa. O padrão nº 1 de reclamação é.

**R7 — Correção manual do dado como caminho de primeira classe.** *(confiança média — padrão 3 tem 3 fontes [28][29][33], o pedido explícito tem 1 [27])*
A janela vai errar. Um app que não deixa consertar converte erro de sensor em desconfiança no produto.

**R8 — Navegação: D/W/M/6M sem ano, com facetas ortogonais.** *(confiança média-baixa — leitura de duas amostras)*
A Apple para no 6M [44]; o AutoSleep dispensa o seletor [20]. Como o Orbe já tem um padrão de navegação temporal no histórico de atividades, **a consistência interna provavelmente pesa mais que o padrão externo** — isso é decisão de produto, não achado de pesquisa.

---

## Perguntas em aberto

| Pergunta | O que responderia |
|---|---|
| A autorização de leitura do HealthKit alcança amostras anteriores à concessão? | `HKSampleQuery` com predicado de data antiga num device com histórico longo — **confirmando a autorização primeiro**, senão o vazio é ambíguo. Minutos, e decisivo |
| A superfície de sono do HealthKit é mesmo como descrita? | A doc oficial [12] é SPA em JS e não abriu em duas tentativas. Conferir no Xcode (autocompletar do enum) ou num espelho da doc — a alegação sustenta R1 |
| Barra empilhada de estágios em visão agregada existe? | Abrir o Health num iPhone e olhar a aba W |
| O que os usuários realmente reclamam? | Reddit esteve bloqueado o run inteiro. Precisa de leitura manual de r/ouraring, r/whoop, r/AppleWatch |
| Crítica de design de telas de sono | Duas rodadas voltaram vazias. A busca é abafada por reviews de acurácia — tentar queries sem a palavra "review": *"sleep app too much data"*, *"hypnogram confusing"* |
| Períodos do Trends do Sleep Cycle | `help.sleepcycle.com` ficou intocado. **Lacuna mais barata de fechar** |
| Sleep consistency e sleep debt do Whoop, visualmente | `whoop.com/thelocker` retorna 403. Precisa de review independente recente |
| Faixas do Garmin Sleep Score | A página oficial não as publica |
| Os 5 identificadores HealthKit restantes | `HeartRateVariabilitySDNN`, `RespiratoryRate`, `AppleSleepingWristTemperature`, `OxygenSaturation`, `RestingHeartRate` — não verificados |
| Quem pede dado de contexto (cafeína, álcool, tela) e como cruza | Classe `dado-de-contexto` ficou com **zero** fontes |

---

## Nota de verificação

Um verificador de contexto limpo conferiu, fonte por fonte, se cada alegação que sustenta decisão é de fato dita pela fonte citada. **Resultado: 2 verificadas, 8 parciais, 0 incorretas na íntegra, 1 não verificável.** As correções já estão aplicadas acima; ficam registradas aqui porque uma alegação corrigida vale **mais** que uma nunca contestada.

| Fonte | Achado da verificação | O que mudou |
|---|---|---|
| [3] [44] | **Verificadas ao pé da letra.** "sleep duration (50 points)", "bedtime consistency (30 points)", "interruptions (20 points)", "considers when you fell asleep during the last 13 nights". E a navegação `D/W/M/6M` sem ano | Nada — são as alegações mais sólidas do relatório |
| [41] | Números conferem exatamente. Mas a **recíproca** que o paper testa é contra *métricas de desvio-padrão*, não contra duração absoluta | Reformulado no sumário e em R2 |
| [39] | GGIR confirma a escala mas **não reproduz a fórmula** nem a exigência de série por época | Rebaixado a inferência definicional, com ressalva explícita |
| [24] | Os 3 fatores conferem. Os **passos de 10 min e a trava 7–9 h não estão na fonte** | Argumento removido de D3 |
| [32] | n=523 confere. Mas 3–14% são **cortes diferentes do APSQ**, e os autores concluem ~3–5% | Corrigido no sumário, na tabela de D4 e em R6 |
| [16] | Números conferem, mas são **médias**; o teto individual medido é 73%, não 61%. É especificidade **sono/vigília**, não "do estagiamento" | Reescrito em D2 e no sumário |
| [25] | A ação existe e a citação "coin flip" é real. Mas **os screenshots de Reddit anexados à petição não estão na fonte** — os links ao Reddit são contexto do repórter | Removido do sumário |
| [1] | Os 7 contribuidores e a ausência de pesos conferem. A frase **"total sleep é o mais significativo" não está na página** | Aspas removidas de D1 |
| [13] | `timezone_offset` e `nap` conferem como campos de topo. Mas **não existe campo `in_bed`** — é `total_in_bed_time_milli`, aninhado em `score.stage_summary`, junto de `disturbance_count` | Linha do apêndice corrigida |
| [12] | **SPA em JS — não abriu.** A alegação central sobre a superfície do HealthKit não pôde ser conferida por esta URL | Marcado no apêndice; ver Perguntas em aberto |

**Nenhuma correção derrubou uma recomendação.** R1, R2 e R3 seguem de pé — R2 numa forma mais precisa e mais defensável. As que perderam força foram R6 (a prevalência real é menor que a citada) e o argumento da meta móvel da Garmin em D3, que caiu inteiro.

---

## Apêndice de fontes

| [n] | Sustenta | Publisher | Publicado | Acesso | Confiança |
|---|---|---|---|---|---|
| [1] | Oura: 7 contribuidores, sem pesos, regularidade fora do score | [Oura Support — Sleep Contributors](https://support.ouraring.com/hc/en-us/articles/360057792293-Sleep-Contributors) | 14/07/2026 | 04/09/2026 | Alta |
| [2] | Oura: faixas do Sleep Score | [Oura Support — Sleep Score](https://support.ouraring.com/hc/en-us/articles/360025445574-Sleep-Score) | 14/07/2026 | 04/09/2026 | Alta |
| [3] | Apple: pesos 50/30/20, janela de 13 noites | [Apple — View your sleep score](https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos) | s/ data | 04/09/2026 | Alta |
| [4] | Apple: proveniência do modelo (AASM, NSF, 5M noites) | [AppleInsider](https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26) | 12/09/2025 | 04/09/2026 | Média |
| [5] | watchOS 26.2: relabel das faixas | [MacRumors](https://www.macrumors.com/2025/11/04/watchos-26-2-updates-sleep-score-ranges/) | 04/11/2025 | 04/09/2026 | Média |
| [6] | idem (segundo publisher, provável upstream único) | [9to5Mac](https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/) | 04/11/2025 | 04/09/2026 | Média |
| [7] | Whoop: Sleep Need e Sleep Performance | [WHOOP — How much sleep do I need](https://www.whoop.com/us/en/thelocker/how-much-sleep-do-i-need/) | s/ data | 04/09/2026 | Média (403 no fetch) |
| [8] | Whoop: estágios, need, debt | [WHOOP — Everything to know about sleep](https://www.whoop.com/us/en/thelocker/everything-to-know-about-sleep/) | s/ data | 04/09/2026 | Média (403 no fetch) |
| [9] | Rise: âncora em débito | [Rise — Sleep Tracking](https://www.risescience.com/blog/sleep-tracking) | s/ data | 04/09/2026 | Média |
| [10] | Rise: argumento contra sleep scores | [Rise — What's a good sleep score?](https://www.risescience.com/blog/sleep-score) | s/ data | 04/09/2026 | Média |
| [11] | Whoop: janela de 4 dias da consistency | [Whoopal](https://whoopal.com/whoop-sleep) | s/ data | 04/09/2026 | **Baixa** |
| [12] | **HealthKit expõe sono como intervalos com start/end** | [Apple Developer — HKCategoryValueSleepAnalysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis) | doc viva | 04/09/2026 | ⚠️ **NÃO VERIFICÁVEL** — SPA em JS, só o `<title>` renderiza |
| [13] | **WHOOP API: `timezone_offset` e `nap` no nível de topo** (`total_in_bed_time_milli` e `disturbance_count` ficam aninhados em `score.stage_summary`) | [WHOOP Developer — Sleep](https://developer.whoop.com/docs/developing/user-data/sleep/) | doc viva | 04/09/2026 | Alta |
| [14] | Oura API: período de sono vs. rolagem diária | [Oura Cloud v2 docs](https://cloud.ouraring.com/v2/docs) | s/ data | 04/09/2026 | Média |
| [15] | Oura: HRV de 5 em 5 min durante o sono | [Open Wearables](https://openwearables.io/blog/oura-api-accessing-ring-data-sleep-hrv-readiness) | s/ data | 04/09/2026 | Média |
| [16] | **Especificidade sono/vigília: médias de 30–61% por aparelho, medições de 30% a 73%** | [JMIR mHealth](https://pmc.ncbi.nlm.nih.gov/articles/PMC11004611/) | 2024 | 04/09/2026 | Alta |
| [17] | Meta-análise: REM subestimado 50–70% (contradiz [16]) | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11874098/) | ~2025 | 04/09/2026 | Média |
| [18] | **Sleep timing chart; trends; correlação por tags** | [Oura Support — Using Trends](https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends) | s/ data | 04/09/2026 | Alta |
| [19] | Sleep timing chart (segunda página) | [Oura Support — Sleep Graphs](https://support.ouraring.com/hc/en-us/articles/4403155260307-Sleep-Graphs) | s/ data | 04/09/2026 | Alta |
| [20] | **AutoSleep: 12 semanas rolantes, drill-down, 3 baselines** | [AutoSleep — History](https://autosleepapp.tantsissa.com/history) | s/ data | 04/09/2026 | Alta |
| [21] | AutoSleep: hipnograma com scrub, séries por checkbox | [AutoSleep — Clock/Sleep](https://autosleepapp.tantsissa.com/clock/sleep) | s/ data | 04/09/2026 | Média |
| [22] | Rise: curva de débito de 14 noites, 3 gráficos alternáveis | [Rise Help](https://help.risescience.com/hc/en-us/articles/6047219133079) | s/ data | 04/09/2026 | Média (403) |
| [23] | Oura: redesign 5→3 abas | [TechCrunch](https://techcrunch.com/2025/10/20/oura-launches-redesigned-app-and-cumulative-stress-feature) | 20/10/2025 | 04/09/2026 | Média |
| [24] | **Garmin Sleep Score: 3 fatores** (a trava 7–9 h foi retratada — ver Nota de verificação) | [Garmin Blog](https://www.garmin.com/en-US/blog/health/garmin-sleep-score-and-sleep-insights/) | 23/06/2021 | 04/09/2026 | Média-alta (**5 anos**) |
| [25] | **Class action Oura: "a nota discorda do corpo"** | [TechCrunch](https://techcrunch.com/2026/08/21/oura-faces-lawsuit-accusing-it-of-misleading-consumers-about-sleep-tracking-accuracy/) | 21/08/2026 | 04/09/2026 | Alta (quanto à ação) |
| [26] | Apple Watch superestimando; recalibração 26.2 | [Tom's Guide](https://www.tomsguide.com/wellness/sleep-tech/why-your-apple-watch-sleep-score-is-low-even-when-you-sleep-eight-hours-a-night) | 2026 | 04/09/2026 | Média |
| [27] | "Sabemos a nota, mas não se estamos ganhando"; pedido de editar cochilos | [Trustpilot — Sleep Cycle](https://www.trustpilot.com/review/www.sleepcycle.com) | até 12/05/2026 | 04/09/2026 | Alta (lido) · **n=23** |
| [28] | Noite fragmentada: 84 vs. 38 na mesma noite | [Garmin Forums](https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-970/443119/inaccurate-sleep-tracking) | s/ data | 04/09/2026 | Média-baixa |
| [29] | AutoSleep superestimando; prontidão contraditória | [MacRumors Forums](https://forums.macrumors.com/threads/apple-watch-ios16-sleep-app-vs-autosleep-app.2358793/) | s/ data | 04/09/2026 | Baixa |
| [30] | "Sleep data COMPLETELY wrong and contradictory" | [Samsung Community](https://us.community.samsung.com/t5/Galaxy-Watch/Sleep-data-COMPLETELY-wrong-and-contradictory/m-p/2314347) | s/ data | 04/09/2026 | Baixa-média |
| [31] | Ortossonia: origem (JCSM 2017, Baron et al.) | [Sleep Foundation](https://www.sleepfoundation.org/orthosomnia) | s/ data | 04/09/2026 | Alta (existência) |
| [32] | **Ortossonia: prevalência ~3–5% pelos autores, n=523** | [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11592250/) | 2024 | 04/09/2026 | Média-alta |
| [33] | Whoop: sensibilidade a vigília 45–60% | [Biosensors via DOAJ](https://doaj.org/article/55f72883d1734718b989697095a0fb7d) | 2021 | 04/09/2026 | Média |
| [34] | **Retenção: Watch ~1 semana; "faça seu próprio teste"** | [Apple Developer Forums 732468](https://developer.apple.com/forums/thread/732468) | s/ data | 04/09/2026 | Alta (p/ o Watch) |
| [35] | Deleção manual; iCloud sincroniza deleções | [Apple Support 108779](https://support.apple.com/en-us/108779) | s/ data | 04/09/2026 | Média-alta |
| [36] | **Silêncio: não há política de expiração documentada** | [Apple Platform Security](https://support.apple.com/guide/security/protecting-access-to-users-health-data-sec88be9900f/web) | s/ data | 04/09/2026 | Alta |
| [37] | iPhone acumula 5 GB / 7+ anos sem purga | [Apple Community](https://discussions.apple.com/thread/254669061) | s/ data | 04/09/2026 | Média-alta |
| [38] | `appleSleepingBreathingDisturbances` é Quantity, iOS 18 | [Apple Developer](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingbreathingdisturbances) | doc viva | 04/09/2026 | Alta |
| [39] | **SRI: definição e exigência de série por época** | [GGIR — Sleep Regularity Index](https://wadpac.github.io/GGIR/articles/SleepRegularityIndex.html) | s/ data | 04/09/2026 | Média |
| [40] | SRI: validação | [Scientific Reports](https://www.nature.com/articles/s41598-018-32402-5) | 2018 | 04/09/2026 | Média |
| [41] | **SRI prediz mortalidade além da duração (n=88.975, HR 1,53)** | [eLife 88359](https://elifesciences.org/articles/88359) | 23/11/2023 | 04/09/2026 | **Alta (lido)** |
| [42] | Social jetlag: MSF, SJL | [Current Biology](https://www.cell.com/current-biology/fulltext/S0960-9822(12)00325-9) | 2012 | 04/09/2026 | Média |
| [43] | MSFsc: fórmula de correção | [CRAN — mctq](https://cran.r-project.org/web/packages/mctq/vignettes/sjl-computation.html) | s/ data | 04/09/2026 | Média |
| [44] | **App Saúde: abas D/W/M/6M sem ano; facetas; 50/30/20** | [Apple Support 108906](https://support.apple.com/en-us/108906) | 14/04/2026 | 04/09/2026 | Alta |
| [45] | Sleep Score: descrição independente | [Engadget](https://engadget.com/mobile/smartphones/how-to-track-your-sleep-and-view-your-sleep-data-in-apple-health-130000023.html) | 07/02/2026 | 04/09/2026 | Média |
| [46] | Cores dos estágios; sugestão de empilhamento no agregado | [MyHealthyApple](https://myhealthyapple.com/how-to-track-your-sleep-stages-with-apple-watch/) | 30/08/2023 | 04/09/2026 | Média (**3 anos**) |
| [47] | Sleep Cycle: Regularity, Sleep Notes, gravação de ronco | [Sleep Cycle — Features](https://sleepcycle.com/features/sleep-tracking/) | s/ data | 04/09/2026 | Média (**marketing**) |
| [48] | PPG não identifica todos os estágios; só EEG | [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7956647/) | 2021 | 04/09/2026 | Média |
| [49] | Vigília silenciosa lida como sono | [Fulcra Dynamics](https://www.fulcradynamics.com/blog/when-sleep-scores-dont-match-how-you-feel) | s/ data | 04/09/2026 | Média (**fornecedor**) |

---

## Mapa de obsolescência

Calculado com `recon_kit.py staleness` sobre o ledger — janelas do pack competitive (capacidades ≤ 3 meses, sentimento ≤ 12 meses) e ≤ 60 meses para literatura revisada por pares.

| Alegação | Classe | Publicado | Rever em | Estado |
|---|---|---|---|---|
| **Garmin Sleep Score = 3 fatores** | composição | 09/2021 | 12/2021 | 🔴 **vencida há ~5 anos** |
| Apple: pesos 50/30/20 | composição | 04/2026 | 07/2026 | 🔴 vencida |
| App Saúde: abas D/W/M/6M | navegação | 04/2026 | 07/2026 | 🔴 vencida |
| Ortossonia: prevalência ~3–5% | (ver nota) | 01/2024 | 01/2025 | 🔴 vencida pela janela aplicada |
| Oura: 7 contribuidores | composição | 07/2026 | 10/2026 | 🟢 |
| Whoop / AutoSleep / Oura timing chart / HealthKit / WHOOP API | várias | 09/2026 | 12/2026 | 🟢 |
| Class action; padrão nº 1 | sentimento | 08/2026 | 08/2027 | 🟢 |
| Especificidade 30–61%; SRI × mortalidade | ciência | 2023–24 | 2028–29 | 🟢 |

**Rever primeiro: a composição do Garmin Sleep Score** — a fonte é de 2021 e nenhuma evidência descreve o modelo de 2026. As duas alegações da Apple estão vencidas por margem pequena e vêm de páginas vivas, sem histórico de versão; revalidar é barato.

*Nota de classificação: o estudo de ortossonia é literatura revisada por pares, mas foi classificado como `sentimento` no ledger, o que lhe aplicou a janela de 12 meses. Pela janela científica de 60 meses estaria 🟢. Registrado como está, sem reclassificar em silêncio.*
