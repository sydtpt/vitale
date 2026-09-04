---
title: 'competitive research: Strava e apps de análise de exercício'
type: 'competitive'
topic: 'Strava e apps de análise de exercício'
decision: 'Quais funcionalidades de análise de exercício (Strava free/Premium e apps pares) entram no roadmap do Orbe nos próximos meses'
source: 'run'
status: complete
preset: 'standard'
validation: 'normal'
claims_verified: 18
claims_unverified: 10
claims_disputed: 3
claims_overturned: 1
created: '2026-09-02'
updated: '2026-09-03'
---

# competitive research: Strava e apps de análise de exercício

**Decisão que esta pesquisa serve:** Quais funcionalidades de análise de exercício (Strava free/Premium e apps pares) entram no roadmap do Orbe nos próximos meses

## Sumário executivo

**O que a evidência diz fazer.** Priorizar três blocos de análise que o Strava cobra, que têm receita pública e que rodam com dados que o Orbe já sincroniza (atividades com FC, potência e ritmo via Strava e intervals.icu; HRV, FC de repouso e sono via Apple Health):

1. **Carga e forma: Fitness/Fatigue/Form, ACWR, monotonia e strain.** Pago no Strava e na TrainingPeaks, grátis no intervals.icu e na Runalyze, com receita aberta (médias exponenciais de 42 e 7 dias, que usuários relatam ajustar, e TRIMP quando só há FC) [15][20][24][29]. O Fitness & Freshness do Strava é percebido como opaco, diverge entre plataformas e não sai pela API [96][97][101]; uma curva própria, transparente e com janela longa customizável responde a uma queixa recorrente [100].
2. **Prontidão composta e recuperação noturna.** A Garmin publica os seis componentes do Training Readiness [2] e a Oura os nove contributors do Readiness, com faixas e janelas [67]; sete dos nove saem de RHR, HRV, sono e atividade. O Athlytic prova que Recovery, Exertion, Sleep e Training Load rodam só com HealthKit, por US$ 29,99/ano [76]. Training Load (7 dias contra 28, com esforço) e Sleep Score (50/30/20) da Apple são triviais de replicar [78][79].
3. **Recordes, esforços e rotas recorrentes.** Best Efforts, Segment Efforts, Matched Activities e heatmap pessoal são pagos no Strava [38]; a Runalyze agrupa rotas recorrentes e pontua climbs [33]. Cabem nos termos quando exibidos só ao próprio atleta [85][86].

**O que não fazer agora.** Copiar o "acesso conversacional aos dados" (MCP) e a prescrição de treino. Em 2026 todos vendem isso como premium: MCP do Strava e da Runalyze, Active Intelligence da Garmin, Adaptive Workouts do Strava [1][34][46][50]; a recepção é "spectacular" mas "still not a coach" [51]; e a Garmin comprou a TrainingPeaks para dar substância a um Connect+ que, segundo o DC Rainmaker, "doesn't offer a compelling reason for people to pay for it" [13]. O mercado correu para prescrição e IA; a análise transparente sobre os próprios dados é a lacuna que ficou aberta.

**Maior ressalva.** O custo e a fronteira legal do Strava. Desde 01/06/2026 a integração pessoal exige a assinatura do desenvolvedor [89], US$ 11,99/mês [91] ou €10,99 [43]. O Agreement vigente veda "replicate Strava functionality" sem definir o termo [85], e a API Policy que ele incorpora, também de 01/06/2026, veda processar Strava Data "for the purposes of analytics, analyses" (§5.4) e usá-los "in connection with the development, training, evaluation, or operation of any AI Application", inclusive por ingestão em contexto de modelo (§5.3) [106]. Para análise própria, Apple Health e intervals.icu são fontes mais limpas que o Strava; a leitura humana da Policy segue pendente. A voz de usuário final ficou rasa porque Reddit e lojas bloquearam o crawler.

## Strava: teardown, preço e trajetória

**O que a dimensão responde:** o que o Strava dá de graça e o que fecha atrás da assinatura em setembro de 2026, quanto custa, e para onde o produto está indo.

### Free vs assinatura (setembro de 2026)

Fontes da tabela: help center [38], página comercial [39], BikeTips [52], Wareable [56].

| Bloco | Free | Assinante |
|---|---|---|
| Registrar, feed, kudos, clubes, Beacon, sensores | sim | sim |
| Leaderboard de segmento | top 10 | completo, filtrado, Live Segments, Segment Efforts |
| Fitness & Freshness, Relative Effort, Training Log, Matched Activities, Cumulative Stats | não | sim |
| Best Efforts, GAP, zonas de FC custom, Workout, Power e Pace Analysis | não | sim |
| Goals, Training Plans, Group Challenges, Performance Predictions | não | sim |
| Rotas (criar, sugerir, offline), Personal Heatmap, Weather | amostra de rotas | sim |
| Year in Sport, Athlete Intelligence, MCP Connector, Adaptive Workouts | não | sim |
| Local Legends, Global Heatmap, Flyby, Flyover, Perceived Exertion, Quick Edit | provável sim, não verificado item a item | |

### Achados

**1. Praticamente toda análise é paga.** A página "Strava Subscription Features" do help center (atualizada em 03/09/2026) lista como exclusivos de assinante: Fitness & Freshness, Relative Effort, Best Efforts, leaderboards de segmento (overall, filtrados, seus resultados, Segment Efforts e Live Segments), Training Log, Matched Activities, Cumulative Stats, GAP, Custom Heart Rate Zones, Workout, Power e Pace Analysis, Custom Goals, Training Plans, Group Challenges, criação e sugestão de rotas, Personal Heatmaps, mapas offline e Weather [38]. A página comercial deixa no plano gratuito apenas gravar, comunidade, segurança e "Try Routes made for you" [39]. Fonte independente de maio de 2026 confirma o recorte: leaderboard limitado ao top 10 no free, Live Segments, rotas e "fitness progress tracking over time" pagos [52]; a Wareable acrescenta Performance Predictions e Group Challenges (pago desde agosto de 2024) [56]. Local Legends parece visível no free [52]. Global Heatmap, Flyby, Flyover, Perceived Exertion, Quick Edit e pace zones não constam da lista de assinante e ficaram sem verificação individual [38].

**2. Year in Sport virou pago em dezembro de 2025**, pela primeira vez desde a estreia em 2016 [41][42]. A reação negativa concentrou-se no Reddit e a imprensa enquadrou como "Strava follows Garmin", em referência ao Rundown pago do Connect+ [42][55]. Retrospectiva agregada virou feature premium no mercado.

**3. Athlete Intelligence é descritivo, não coach.** Só para assinantes e trial; gera resumo por atividade com IA generativa, com o botão "Say More" aprofundando em ritmo, velocidade, FC e zonas, e detecta tendências numa janela de 30 dias; segundo o help center só existe no mobile, sem opt-out, e não cobre potência estimada, perceived exertion nem cadência [40][53]. Fonte independente confirma "descriptive (it explains your past)" [53]. Nenhum press release de março a setembro de 2026 anuncia evolução dele [45].

**4. O movimento de IA de 2026 é o MCP Connector (01/06/2026).** Assinantes conectam o Claude (web e desktop) ao histórico, em modo somente leitura, com streams por segundo de FC e ritmo, GPS, potência, clubes e eventos; só o Claude é citado como cliente; a Strava justifica pela demanda dos atletas por analisar os próprios dados e por substituir "unsecure third-party tools" [50][51]. A avaliação independente: análise "spectacular", mas "it's still not a coach", sem proatividade nem plano vivo [51].

**5. Trajetória: força e prescrição.** Maio de 2026 trouxe 14 integrações de força (Garmin, COROS, WHOOP, Hevy, Runna e outros) com muscle maps e métricas de volume, Adaptive Workout Recommendations por objetivo declarado e Route Deviation Alerts, tudo para assinantes, além de Physical Therapy como esporte [46]. Março: muscle maps e cinco esportes novos [48]. Janeiro: Instant Workouts global para assinantes [49]. Junho: pacote de hiking com rotas, off-route alerts e offline [47]. Julho: aba Events, Race Discovery, parceria adidas e Strava pré-instalado no Galaxy Watch [45]. Runna segue app e assinatura separados a US$ 19,99/mês; o "Strava + Runna" é bundle comercial, não fusão de produto [53][43]. The Breakaway não apareceu em nenhuma fonte.

**6. Preço.** Europa: €10,99/mês ou €69,99/ano, Family €119,99, Strava + Runna €149,99, harmonizados desde 01/07/2025; a página lista 30 países e a rodada 1 contou 23 [43]; sem reajuste documentado nos últimos 12 meses [44]. EUA: US$ 11,99/mês ou US$ 79,99/ano, Family US$ 139,99, Strava + Runna US$ 149,99, via hub da comunidade e dois blogs de maio de 2026, primária não lida [54][52][53].

### Verificação na chegada
- Análise quase toda paga: **verified** por BikeTips (2026-05) e Wareable, com cobertura parcial dos 12 itens [52][56].
- Athlete Intelligence assinante e descritivo: **verified** [53]; "só mobile" e "Say More": **unverified**.
- Preço EUR e harmonização: **disputed** no detalhe (23 vs 30 países; nenhuma cobertura independente da harmonização) [43][52].
- MCP Connector em 01/06/2026, só assinantes: **verified** [50][51].

### Perguntas que a dimensão deixou abertas
Parada por teto de rodadas. Status individual de Global Heatmap, Flyby, Flyover, Perceived Exertion, Quick Edit e pace zones; o que o item "Training Plans" do assinante entrega hoje; se os stat cards mensais foram para o paywall; porção gratuita dos Best Efforts de corrida; preço USD em primária legível; The Breakaway dentro do produto.

## Peers de análise de desempenho: Garmin Connect, intervals.icu, TrainingPeaks, Runalyze

**O que a dimensão responde:** o que cada um entrega de análise, o que é pago, e qual receita está publicada (portanto replicável a partir de FC, ritmo, potência, HRV e sono).

### O que é replicável com os dados que o Orbe já tem

| Análise | Onde existe | Insumos | Receita pública? | Grátis em algum lugar? |
|---|---|---|---|---|
| Fitness/Fatigue/Form (CTL/ATL/TSB) | intervals.icu, TP, Runalyze, Strava | carga por atividade (potência ou FC/TRIMP) | Sim; usuários relatam ajustar as constantes 42/7 [20] | Sim (intervals.icu [15]; Runalyze [29]) |
| Prontidão composta | Garmin Training Readiness | sono, recovery time, HRV, carga aguda, 3 noites, 3 dias de stress | Sim, componentes e faixas [2] | Sim (Garmin, com relógio) [1] |
| HRV vs baseline pessoal | Garmin HRV Status, Runalyze | HRV noturno | Parcial (faixas, sem fórmula) [3][34] | Sim |
| ACWR, monotonia, strain | Runalyze | carga diária | Métricas de Foster, literatura aberta [34] | Expostas via MCP pago; disponibilidade no tier free não verificada [34] |
| VO2max efetivo e prognose | Runalyze, Garmin | FC × ritmo por corrida | Sim (Runalyze) [35][36] | Sim (Runalyze) |
| Curvas de potência/ritmo comparáveis | intervals.icu | séries por atividade | Sim [16] | Sim [15] |
| Rotas recorrentes, climbs | Runalyze | GPS | Sim [33] | Sim |
| Perguntas em linguagem natural (MCP/IA) | Runalyze, Garmin, Strava | tudo acima | n/a | Não; sempre pago [34][1] |

### Achados

**1. O mapa mudou em julho de 2026.** A Garmin anunciou e fechou em 22/07/2026 a compra da TrainingPeaks e da TrainHeroic; 120 pessoas passam ao quadro da Garmin e os termos não foram divulgados [13][14][28]. Nenhum plano declarado de levar TSS/PMC ao Garmin Connect nem de mexer no preço da TrainingPeaks; o DC Rainmaker lê a jogada como tentativa de dar substância a um Connect+ que "doesn't offer a compelling reason for people to pay for it", e aponta como riscos abertos o bloqueio de upload de aparelhos de terceiros e licenciamento "estilo Firstbeat" [13].

**2. Garmin: métricas grátis, IA paga.** Connect+ custa US$ 6,99/mês ou US$ 69,99/ano desde março de 2025, sem reajuste até 2026 [1][9]. O paywall fecha Active Intelligence (insights por IA cruzando sono, HRV, carga e stress), Performance Dashboard (gráficos personalizáveis entre períodos), Live Activity, vídeos de coaching, LiveTrack expandido e social [1][11]; a Garmin declarou que "all existing features and data in Garmin Connect will remain free", promessa reproduzida por terceiros mas não auditada [1][9]. O perímetro pago cresceu (Trails+, 3D Maps, Rundown, nutrição com IA) e a revisão de um ano segue "still not worth it" [10]; a recepção inicial foi morna pelo mesmo motivo, as métricas de valor já eram grátis [8]. Os firmwares de 2026 trouxeram gear tracking, Course Planner, voz e detecção de queda, nenhuma métrica nova de análise [5][6][7].
Receitas publicadas: **Training Readiness** = Sleep score da noite + Recovery time + HRV status + Acute load + histórico de 3 noites de sono + 3 dias de stress, em cinco faixas de poor a prime [2]. **HRV Status** = HRV noturno contra a baseline pessoal, de "peaking" a "strained" [3]. **Training Status** só tem descrição qualitativa pública [4]; a patente Firstbeat US 10.580.532 mostra a tendência de carga como pico semanal dividido pelo pico mensal (confiança baixa) [12].

**3. intervals.icu: o núcleo é grátis.** Fitness/Fatigue/Form (CTL/ATL/TSB), detecção de intervalos, power curve e HR analytics, custom charts, calendário e workout builder estão no tier gratuito; o Supporter (US$ 4/mês) compra clima, plano anual, importação completa do histórico do Strava, zonas totalmente custom e coaching de equipes [15][21]. Segundo o autor, Fitness e Fatigue derivam da carga por atividade e do FTP da época, com FC quando não há potência, e Form é exibida como percentual da Fitness; usuários do mesmo tópico relatam ajustar as constantes 42/7 e usar TRIMP em atividades só com FC [20]. Lançamentos de 2026: expressões matemáticas no gráfico da atividade e comparação de curvas de potência e ritmo entre períodos e atletas (abril) [16], dark mode (junho) [17], push (agosto) [18], Huawei (março) [19]. Mais de 160 mil atletas ativos, autor em tempo integral desde 2024, sem investidores [22]. Sentimento: "highly customizable", workout builder por percentual do limiar [23]; nos comparativos de 2026 "vence" para o atleta autotreinado [22]. Conecta-se ao Strava diretamente, enquanto a TrainingPeaks espera o aparelho alimentá-la [21].

**4. TrainingPeaks: cobra o que a intervals.icu dá de graça.** Premium a US$ 19,95/mês ou US$ 134,99/ano, reajuste de 8% em 02/04/2025 [24][26]; o blog oficial ainda diz US$ 124,99 [25]. O Premium destrava PMC, analytics profundos, plano anual e envio de treinos estruturados [21][24]. A inovação de 2026 está no simulador indoor (TrainingPeaks Virtual, AI Bots), não em análise pós-treino [27]. Força reconhecida: colaboração coach-atleta, marketplace de planos e app mobile [21][22]. No fórum, o contraste é econômico e o PMC/TSS não aparece como diferencial defendido [23].

**5. Runalyze: o catálogo derivado mais rico, e o mais "geek".** Tiers Free, Supporter a €2,50/mês e Premium a €6/mês ou €66/ano; a página de preços bloqueou o fetch e um comparativo de 2026 diz €5,50, valor disputado [29][30][37]. Effective VO2max é estimado por corrida pela relação entre FC e ritmo [35]; Marathon Shape corrige a prognose de longas distâncias pela "missing fitness" [36]; TRIMP é métrica de primeira classe, com streaks e mini-calendário desde agosto de 2026 [32]; Recurring Routes agrupa atividades pela mesma rota e há visão de climbs com score [33]. O MCP Server (09/06/2026, só pagantes, com Claude, Mistral e Gemini CLI) expõe CTL/ATL/TSB, ACWR, monotonia e strain de Foster, marathon shape, baseline e faixa normal de HRV, sono e FC noturna [34]. Redesign completo em 05/05/2026 [31]. Sentimento: "significant depth, though it can be a bit clunky", curva de aprendizado [23].

### Verificação na chegada
- Garmin comprou a TrainingPeaks: **verified** por reportagem própria do DC Rainmaker e release da Garmin [13][14].
- Connect+ preço e perímetro: **verified** [9][10]; "métricas fisiológicas seguem grátis" é declaração da Garmin, não auditoria.
- intervals.icu núcleo grátis e Supporter US$ 4: **verified** [21][22].
- Runalyze MCP em junho de 2026: **verified** [34]. Preço do Premium: **disputed** (€6 vs €5,50) [29][37]. Grok em 26/08 e Supporter €2,50: **unverified**.

### Perguntas que a dimensão deixou abertas
Parada por teto de rodadas, não por cobertura. Faltam: definições oficiais da Garmin para Training Load Focus, Training Effect, Endurance Score, Hill Score e Race Predictor (páginas em JS, busca no suporte sem retorno); método do eFTP e a fórmula literal de Fitness/Fatigue da intervals.icu; tabela Basic vs Premium da TrainingPeaks; preço datado da Runalyze; sentimento de Reddit dentro de 12 meses para os quatro.

## Peers de recuperação e prontidão: Whoop, Oura, Athlytic, Apple Fitness

**O que a dimensão responde:** quais análises de recuperação e prontidão existem, de que sinais são calculadas, quanto custam, e quais dá para computar só com dados tipo HealthKit (HRV, FC de repouso, sono, treinos), sem sensor proprietário.

### O que é computável só com dados tipo HealthKit

| Análise | Referência | Insumos | Replicável sem sensor proprietário? |
|---|---|---|---|
| Readiness composto (7 de 9 contributors) | Oura | RHR, HRV, sono, regularidade, atividade; janelas de 14 dias e 2 a 3 meses | Sim [67] |
| Recovery por HRV e RHR do sono | Athlytic, Whoop | HRV e RHR noturnos contra baseline | Sim [75][58] |
| Carga aguda vs crônica (7 d vs 28 d) com esforço | Apple Training Load | treinos mais rating de esforço | Sim [79] |
| Sleep Score 50/30/20 | Apple | início, fim, acordado, 13 noites | Sim [78] |
| Symptom e Health Radar (desvio noturno) | Oura | RHR, HRV, respiração, temperatura, inatividade | Parcial: precisa das séries noturnas; temperatura depende do relógio [68][70] |
| Vitals (faixa típica por métrica) | Apple | métricas noturnas | Sim [80] |
| Stress diurno contínuo | Whoop | HRV contínua acordado | Não [60] |
| Body Temperature, Recovery Index, Blood Pressure Signals | Oura, Whoop | sensor térmico, curva de FC noturna, PPG | Não, ou parcial [67][70] |

### Achados

**1. A Oura publica a receita do Readiness, e sete dos nove contributors saem de dados tipo HealthKit.** A página oficial, atualizada em 14/07/2026, lista Resting Heart Rate, HRV Balance, Body Temperature, Recovery Index, Sleep, Sleep Balance, Sleep Regularity, Previous Day Activity e Activity Balance, em escala 0 a 100 com faixas Optimal 85 a 100, Good 70 a 84, Fair 60 a 69 e Pay Attention 0 a 59 [67]. Os detalhes também estão lá: o RHR pesa contra quando está 3 a 5 bpm acima ou 10 a 15 abaixo do habitual; HRV Balance compara 14 dias ponderados com a média de três meses; Sleep Balance compara duas semanas com a referência de 7 a 9 h; Sleep Regularity mede a consistência de horários em duas semanas; Activity Balance compara 14 dias com dois meses [67]. Só Body Temperature (sensor) e Recovery Index (curva de FC ao longo da noite) ficam fora do alcance de dados agregados [67]. Symptom Radar acompanha desvios noturnos de temperatura, respiração, RHR, HRV e inatividade contra a baseline [68]; Health Radar amplia com Blood Pressure Signals e Nighttime Breathing em janelas de 30 dias sobre PPG noturno, já com artigo em produção [70][71]. Cardiovascular Age sai do PPG após 14 dias [69]. Membership a US$ 5,99/mês ou US$ 69,99/ano, mesmo valor em euros, primeiro mês grátis; sem assinatura restam só os três scores [66][72][73]. Um Oura Ring 5 "AI-enabled" foi anunciado, mas a fonte não abriu (confiança baixa) [74].

**2. O Athlytic é a prova de existência: tudo sai do HealthKit por US$ 29,99/ano.** Recovery (HRV e RHR do sono), Exertion 0 a 10 com Target Exertion, Sleep (qualidade, débito, consistência), Training Load, Stress, Cardio Fitness, Heart Rate Recovery, Training Effect, Effort Score e Athlytic Age; 4,8 estrelas em 11 mil avaliações; a versão 26.5.6, de agosto de 2026, quebra intervalados em reps e recoveries e adiciona cartões de recorde pessoal; "Ask Athlytic" e insights rodam com Apple Intelligence no aparelho; empresa de duas pessoas, sem conta, "Data Not Collected" [75][76]. A crítica independente: o Recovery pesa demais o cardio (HRV e RHR) e subestima fadiga muscular; o Exertion se comporta como TSS ou Training Effect [77].

**3. Apple: Training Load e Sleep Score são triviais de replicar e não usam HRV.** O Training Load, desde o watchOS 11, compara intensidade vezes duração dos últimos 7 dias com a média ponderada dos 28 anteriores; o esforço é estimado automaticamente em cardio (idade, peso, GPS, FC, elevação), ajustável de 1 a 10, manual em força, com 10 dias de baseline e cinco classes de "well below" a "well above" [79][83]; nenhuma mudança encontrada no watchOS 26 [81]. O Sleep Score, lançado com o watchOS 26 em 15/09/2025, soma duração (50 pontos), consistência de horário (30 pontos, 13 noites) e interrupções (20 pontos); a Apple recalibrou as faixas na 26.2 porque a versão inicial era "a bit too forgiving", ficando Very Low 0 a 40 até Very High 96 a 100 [78][81][82]. O app Vitals estabelece uma faixa típica por métrica noturna e alerta quando várias saem dela [80]. Tudo grátis com o relógio.

**4. WHOOP mostra o que depende de hardware contínuo.** Recovery de 0 a 100% ao acordar, a partir de RHR, HRV, respiração, sono, temperatura da pele e SpO2 [58]; Strain de 0 a 21 em escala logarítmica, de tempo por zona de FC mais carga muscular, fórmula proprietária [59]; o Stress Monitor exige HRV contínua durante o dia contra uma baseline de 14 dias, o que não se replica com HRV esparsa [60]. Tiers One, Peak e Life a £169, £229 e £349 por ano (US$ 199, 239 e 359 via snippet; o site bloqueou o fetch); o Life traz a WHOOP MG com ECG e pressão arterial; 5.0 e MG foram lançadas em 08/05/2025 [57][61][62]. A calibração leva semanas e o Strain "over a month" sem histórico [61]. O Whoop Coach é "lacking in depth and detail" [61]. Críticas: atribuir FC alta a stress em vez de atividade leve, sem poder remover pontos errados [61]; a taxa de upgrade gerou backlash [63]; a pressão arterial não tem certificação médica [64]; "difficult to recommend" no tier Life [65]. O Quantified Scientist, via resumo secundário, coloca a WHOOP 5.0 na "second league", com a Oura melhor no sono e a Whoop melhor no exercício (confiança baixa) [84].

### Verificação na chegada
- WHOOP tiers e Recovery: **verified (parcial)** pela road.cc, que confirma tiers e split de hardware em libras; preços em dólar e a lista de seis insumos: **unverified** [61].
- Oura Readiness com nove contributors e preço: **verified (parcial)**; preço confirmado por agregadores independentes; contributors só na fonte da Oura [67][73].
- Athlytic inteiro em HealthKit a US$ 29,99/ano: **verified** pela App Store [76].
- Apple Training Load 7/28 e Sleep Score 50/30/20: **verified (parcial)** por AppleInsider e T3; a janela de 13 noites: **unverified** [81][83].

### Perguntas que a dimensão deixou abertas
Parada por teto de rodadas. Preços WHOOP em dólar e o que cada tier libera em software; insumos do Healthspan; Oura Resilience e Oura Advisor; datas do Health Radar e do Ring 5; se o watchOS 27 trouxe métrica de recuperação; o vídeo original do Quantified Scientist.

## Termos da API do Strava e voz dos usuários

**O que a dimensão responde:** (A) o que o Orbe pode fazer com dados sincronizados do Strava sob os termos vigentes e o que mudou no programa de desenvolvedores; (B) o que os usuários dizem que justifica pagar o Strava e o que a análise dele faz mal.

### A. Termos da API

**1. O contrato vigente é de 01/06/2026.** Duas frases-destaque importam: "Strava Data provided by a specific user can only be displayed or disclosed in your Developer Application to that user" e "You may not create applications that compete with or replicate Strava functionality" [85]. Não há isenção para uso pessoal, single-user, hobby ou não comercial, e o contrato não define tiers nem tetos de atletas; essas regras vivem nos posts do Developer Program [85]. A data foi confirmada de forma independente pela issue #53 do strava-mcp [90]; a redação das cláusulas só aparece no texto primário.

**2. A cláusula de IA não sumiu: mudou de página e ficou mais ampla. A de "look and feel" sumiu.** O Agreement de 2026 não contém as palavras "artificial intelligence", "machine learning", "look and feel" nem "analytics" [85], mas incorpora por referência a API Policy, também com vigência de 01/06/2026. O §5.3 dela diz "You may not use the Strava API Materials or Strava Data … in connection with the development, training, evaluation, or operation of any AI Application", estendido a "retrieval-augmented generation, ingestion into a context window or working memory"; o §5.4 diz "You may not process or disclose Strava Data … for the purposes of analytics, analyses, customer insight generation, or product or service improvements"; e há vedação a uso "competitive to Strava" [106]. A Policy é renderizada por JavaScript; o verbatim vem de duas leituras automatizadas consistentes e pede confirmação humana. Em novembro de 2024 a Strava afirmou que seguiam permitidos "coaching platforms focused on providing feedback to users and tools that help users understand their data and performance" [86], e o DC Rainmaker já apontava que a cláusula de analytics contradizia essa promessa [87][88]; em 2026 a contradição persiste, agora na Policy.

**3. Programa de desenvolvedores de junho de 2026: a API pessoal passou a custar a assinatura.** Dois tiers: Standard, para onde todo app cai, com "até 10 atletas" só na fonte primária, e Extended Access, por candidatura [89]. Desde 01/06/2026 um desenvolvedor novo no Standard precisa manter assinatura Strava ativa; os existentes tiveram até 30/06, com três meses grátis; na prática, US$ 11,99/mês ou €10,99 para manter uma integração pessoal [89][90][91][93]. Em 01/09/2026 o Segments Explore foi para Extended Access e os endpoints de clube foram aposentados; os segment efforts dentro da atividade não foram citados como afetados [89][90]. Até 01/06/2027 tornam-se obrigatórios token no header, a base URL api-v3.strava.com e oauth/revoke [89][90]. "Apps routing Strava data through third-party intermediary platforms are no longer supported" e "Direct integrations are not impacted"; ninguém no fórum do intervals.icu conseguiu definir intermediário ("vague enough to mean anything"), e nem o intervals.icu nem a Terra se pronunciaram [89][91]. A justificativa pública é abuso: apps "jumping 448% year-to-date, driven by AI companies scraping data"; a imprensa enquadra como preparação para IPO (confiança baixa) [90][94][95]. Download dos próprios dados e integrações com relógios não mudam [89].

**4. Reações.** No fórum do intervals.icu, OpenRowingMonitor diz "going to abandon Strava", Avitu "drop Strava after the grace period", Incyclist se declara frustrado e BreakAway sinaliza fim do upload; nada de Runalyze, Golden Cheetah, VeloViewer ou Statshunters [91]. A Tredict lê o MCP oficial como a Strava "positioning its own MCP as a controlled, secured channel" enquanto restringe a API [92]. Em 03/09/2026 o fórum de desenvolvedores mostra pedidos de capacidade de atletas negados sem feedback [102]. Desde novembro de 2024 o intervals.icu não repassa atividades vindas do Strava ("Strava API forbids data forwarding") [103]; há precedente de rate limits atingindo o próprio intervals.icu (confiança baixa) [104].

**5. Resposta à pergunta central.** Um app de um único atleta que mostra só a ele fitness e fadiga, recordes, esforços em segmentos e heatmaps calculados sobre as próprias atividades satisfaz a cláusula de exibição por construção e cabe na frase oficial sobre "tools that help users understand their data" [85][86]. Contra ele pesam três textos: "replicate Strava functionality", que o Agreement não define [85]; o §5.4 da API Policy, que veda processar Strava Data para "analytics, analyses" e é o mesmo texto que a Strava disse em 2024 não atingir ferramentas de compreensão dos próprios dados [106][86]; e o §5.3, que veda levar Strava Data a qualquer aplicação de IA, inclusive por contexto de modelo [106]. O custo novo é a assinatura do desenvolvedor [89]. Conclusão: análise determinística exibida só ao atleta é defensável pela palavra da Strava, não pelo texto literal; IA sobre dados de origem Strava está vedada. Depende de leitura humana da Policy.

### B. Voz dos usuários

**6. Fitness & Freshness é percebido como opaco.** No fórum do intervals.icu (30/01/2025): "Not only are the numbers different but the fitness trend line is almost the opposite"; a resposta explica a média exponencial de 42 dias e a base de carga diferente, TSS contra Relative Effort [96]; a Athletica documenta o mesmo desencontro entre Athletica, intervals.icu e Strava [97]. No Community Hub, as ideias pedem janela longa customizável e cruzamento com sono e peso; os valores divergem entre web e app; a curva não existe na API, então quem a quer fora do Strava recalcula a partir dos streams [100][107][101]. Kudos e datas não foram capturados; baseline stale.

**7. O que faz pagar e o que irrita.** O paywall do Year in Sport em dezembro de 2025 foi a maior revolta dos últimos 12 meses (ver [41][42][55]); a imprensa resume "still the best training app for runners and cyclists, but it's getting expensive" [99]. O Athlete Intelligence foi recebido como piada em outubro de 2024 ("more like a meme than anything", sinal stale) [98]. Entre desenvolvedores-usuários, a queixa de junho de 2026 não é o preço, é a obrigação de assinar para manter uma integração pessoal ou open source [91]. A "decisão impopular revertida" do Tom's Guide foi o bloqueio de links externos, irrelevante para análise [105].

**Cobertura fraca:** Reddit devolveu 400 e 403, App Store e Google Play não foram alcançados, o board de ideias redirecionou; a meta de seis a dez citações datadas de usuários finais não foi atingida (três citações datadas, todas de desenvolvedores). Hipótese não testada: os motivos declarados para assinar seguem sendo segmentos, leaderboards e rotas, não análise.

### Verificação na chegada
- Data e destaques do agreement de 2026-06-01: **verified** na data, via issue #53; redação só na primária [85][90].
- Assinatura obrigatória, Segments Explore e prazos de 2027: **verified** [90][91]; teto de 10 atletas: **unverified**.
- "Tools that help users understand their data" permitidos: **disputed**, o DC Rainmaker vê contradição com a cláusula de analytics [86][87].
- Cláusulas de IA e look and feel ausentes em 2026: **overturned** na parte de IA pela API Policy §5.3 e §5.4, encontrada na checagem de citações [106]; confirmada só para look and feel.
- MCP oficial só para assinantes, read-only: **verified** pela Tredict [92].

### Perguntas que a dimensão deixou abertas
Parada por teto de rodadas. Leitura humana da API Policy de 2026 (§5.3 e §5.4) e do Agreement; definição de intermediário e posição do intervals.icu e da Terra; teto de 10 atletas; voz de usuário final em Reddit e lojas; reações de Runalyze, Golden Cheetah, VeloViewer e Statshunters.

## Insights cruzados

1. **A análise migrou para o paywall em todo lugar, mas a receita ficou pública.** O Strava cobra por toda análise [38], a Garmin cobra pela IA [1], a TrainingPeaks pelo PMC [21][24]; ao mesmo tempo intervals.icu, Runalyze, o manual da Garmin e o suporte da Oura publicam fórmulas ou componentes [2][20][35][67]. Quem já tem os dados brutos não precisa do vendor para a análise.
2. **Retrospectiva agregada virou premium.** Year in Sport foi para o paywall em dezembro de 2025 [41] e o Rundown da Garmin nasceu dentro do Connect+ [10]. O Orbe já tem a Retrospectiva: é um diferencial pelo qual os concorrentes passaram a cobrar.
3. **A dependência do Strava ficou mais cara e mais frágil no mesmo mês em que o Strava lançou o MCP.** Assinatura obrigatória para o desenvolvedor, endpoints removidos e restrição a intermediários [89][90] chegaram junto com o canal oficial e pago para analisar os próprios dados [50][92], e a API Policy do mesmo dia veda analytics e qualquer uso em IA sobre Strava Data [106]. Apple Health e intervals.icu cobrem os insumos da análise; o Strava tende a virar fonte social, não de dado.
4. **Todos convergem para MCP, e a crítica é a mesma.** Strava, Runalyze e Garmin vendem "perguntar aos próprios dados" [1][34][50]; a falta é proatividade e plano vivo [51]. Se o Orbe fizer IA, o valor está na camada proativa sobre métricas próprias, não em expor dados a um chat.
5. **Score sem baseline pessoal perde credibilidade rápido.** A Apple recalibrou o Sleep Score em dois meses por ser generoso demais [82]; o Whoop é criticado por atribuir FC alta a stress sem permitir correção [61]; o Recovery só de HRV e RHR subestima fadiga muscular [77]. Qualquer score do Orbe precisa de baseline por pessoa, faixas explícitas e correção manual.

## Evidência contrária

O red team ficou desligado nesta rodada; nenhum passe adversarial foi executado. Os contrapontos que surgiram nas dimensões: o DC Rainmaker considera a promessa de que "tools that help users understand their data" seguem permitidos contraditória com a cláusula que veda processar dados "for analytics" [87]; e a Garmin declarou, sem auditoria independente, que as métricas fisiológicas seguem grátis fora do Connect+ [1][9].

## Recomendações

Destino: as ideias entram em `_bmad-output/planning-artifacts/backlog-de-features.md`; as que avançarem viram spec via `bmad-spec`; a decisão sobre o Strava vira ADR.

| # | Recomendação | Base de confiança | Destino |
|---|---|---|---|
| R1 | Fitness/Fatigue/Form transparente: constantes 42/7 configuráveis, TRIMP quando só há FC, Form como percentual, janela longa customizável | Alta: receita pública e commodity grátis [15][20]; queixa documentada sobre o Strava [96][100] | backlog, candidata a spec |
| R2 | Prontidão diária composta: sono da noite, HRV contra baseline de 14 dias e 3 meses, RHR contra habitual, carga aguda, regularidade de sono, com faixas explícitas e baseline pessoal | Média: componentes publicados por Garmin e Oura, fórmula não [2][67]; Athlytic prova viabilidade em HealthKit [76] | backlog |
| R3 | ACWR, monotonia e strain de Foster sobre a carga diária, junto de R1 | Média: expostos pela Runalyze via MCP [34]; literatura aberta | backlog, junto de R1 |
| R4 | Recordes e esforços: Best Efforts por distância, PRs por rota recorrente, climbs com score | Alta: pagos no Strava [38]; Runalyze faz de graça [33]; conferir sobreposição com "Recordes e segmentos" já mergeado no Orbe | backlog |
| R5 | Sleep Score 50/30/20 e Training Load 7 contra 28 dias com esforço editável, à moda da Apple, com baseline pessoal | Alta: receitas publicadas e verificadas [78][79][81]; lição da recalibração [82] | backlog |
| R6 | Governança do Strava: decidir se a assinatura de desenvolvedor vale a pena ou se o Strava vira só destino social; preferir Apple Health e intervals.icu como fonte das análises; não usar Segments Explore; migrar para api-v3, token no header e oauth/revoke antes de 06/2027 | Alta no programa de 2026 [89][90]; média na fronteira legal: "replicate functionality" sem definição [85] e API Policy §5.3/§5.4 lida só por renderização automatizada [106] | ADR |
| R7 | Não priorizar MCP, IA conversacional nem prescrição de treino nos próximos meses; com dados de origem Strava, qualquer uso em IA está vedado pela API Policy | Média: mercado saturado e crítica convergente [46][50][51]; termos [106] | decisão de roadmap |

## Perguntas abertas

- **API Policy de 2026 (§5.3 e §5.4) e Agreement.** Confirmar por leitura humana o verbatim obtido por renderização automatizada, e se dados de origem Strava que chegam via intervals.icu contam como Strava Data. Resolve-se em strava.com/legal/api_policy e strava.com/legal/api.
- **Voz de usuário final sobre o Strava.** O que justifica pagar e o que a análise faz mal, em Reddit e lojas dos últimos 12 meses. Resolve-se com Deepen por outro caminho de acesso, ou com Draft para uma ferramenta externa de deep research.
- **Definições da Garmin** para Training Load Focus, Training Effect, Endurance Score, Hill Score e Race Predictor. Manuais estáticos ou a patente Firstbeat US 10.580.532 [12].
- **Método do eFTP e fórmula literal de Fitness/Fatigue do intervals.icu.** Tópicos do fórum listados nos digests.
- **Status individual** de Global Heatmap, Flyby, Flyover, Perceived Exertion, Quick Edit e pace zones no Strava, e o conteúdo de "Training Plans" do assinante. Artigos do help center.
- **Preços WHOOP em dólar por tier, Oura Resilience e Oura Advisor.** Press release da WHOOP e suporte da Oura.
- **Definição de "intermediary platform"** e a posição do intervals.icu e da Terra. Thread do Community Hub e blog da Terra.

## Mapa de staleness

Computado com `recon_kit.py staleness` sobre as 32 claims do ledger, janelas do pack competitivo: preço, feature e termos 3 meses; trajetória 6 meses; sentimento 12 meses. Páginas sem data usam o dia do acesso (2026-09-03) como âncora. Treze claims já estão fora da janela pela data de publicação, ainda que tenham sido relidas ou verificadas em 2026-09-03; é o que Refresh deve recolher primeiro.

| Reconferir em | Claims | Por quê |
|---|---|---|
| Já vencidas (reconferir no próximo Refresh) | [85][87][89][106] termos e API Policy (jun/2026); [1] Connect+ preço (mar/2025, reverificado mar/2026); [24] TrainingPeaks preço (fev/2025); [43] Strava EUR (jul/2025); [61] WHOOP tiers (set/2025); [41] Year in Sport (dez/2025); [78] Sleep Score (set/2025); [86] nota de nov/2024; [96] sentimento F&F (jan/2025); [20] receita intervals.icu (2020, estável) | janela de 3 ou 12 meses já passou; termos podem mudar com o programa de desenvolvedores em curso |
| 2026-10-01 | [67] Oura Readiness contributors | página atualizada em jul/2026 |
| 2026-11-01 | [46] Strava maio/2026; [76] Athlytic | trajetória e preço |
| 2026-12-01 a 2026-12-03 | [38][40] Strava features; [15][29][54][66] preços; [2][35][60][79] features; [13][34][50][91][92] trajetória | janela cheia a partir da leitura de set/2026 |
| 2027-01-01 a 2027-03-03 | [13] Garmin×TrainingPeaks; [70] Oura Health Radar | trajetória de 6 meses |

**Reconferência mais próxima:** os termos e a API Policy do Strava [85][87][89][106], já fora da janela; na prática, antes de qualquer decisão sobre a assinatura de desenvolvedor (R6) e de novo em 2026-12-01.

## Fontes

| [n] | Sustenta | Publisher | Publicação | Acesso | Confiança |
|---|---|---|---|---|---|
| [1] | Connect+ preço e o que fecha; métricas seguem grátis | [Garmin newsroom](https://www.garmin.com/en-US/newsroom/press-release/wearables-health/elevate-your-health-and-fitness-goals-with-garmin-connect/) | 2025-03-27 | 2026-09-03 | alta |
| [2] | Composição do Training Readiness | [Garmin, manual Forerunner 965](https://www8.garmin.com/manuals/webhelp/GUID-0221611A-992D-495E-8DED-1DD448F7A066/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html) | sem data | 2026-09-03 | alta |
| [3] | HRV Status vs baseline | [Garmin blog](https://www.garmin.com/en-US/blog/fitness/new-features-on-garmin-smartwatches-help-to-maximize-your-training/) | sem data | 2026-09-03 | média |
| [4] | Training Status descrição qualitativa | [Garmin Technology](https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/training-readiness/) | sem data | 2026-09-03 | média |
| [5] | Firmware fev/2026 sem métrica nova | [Garmin, PDF de atualização](https://www8.garmin.com/wearables/PDF/WearablesSoftwareUpdate/2026/February2026.pdf) | 2026-02 | 2026-09-03 | média |
| [6] | Firmware jun/2026 | [Garmin, PDF de atualização](https://www8.garmin.com/wearables/PDF/WearablesSoftwareUpdate/2026/June2026.pdf) | 2026-06 | 2026-09-03 | média |
| [7] | Atualização Q3 2026 | [Gadgets & Wearables](https://gadgetsandwearables.com/2026/09/01/garmin-q3-2026-feature-update/) | 2026-09-01 | 2026-09-03 | média |
| [8] | Recepção morna do Connect+ | [Android Authority](https://www.androidauthority.com/garmin-connect-plus-features-3542436/) | sem data (2025) | 2026-09-03 | baixa |
| [9] | Connect+ US$ 6,99 confirmado em 2026 | [Should I Train](https://www.shoulditrain.com/blog/garmin-connect-plus-review) | 2026-03-02 | 2026-09-03 | alta |
| [10] | Perímetro do Connect+ cresceu; "not worth it" | [the5krunner](https://the5krunner.com/2026/04/20/garmin-connect-plus-review/) | 2026-04-20 | 2026-09-03 | média |
| [11] | Active Intelligence e Performance Dashboard | [Garmin blog](https://www.garmin.com/en-US/blog/fitness/what-is-the-garmin-connect-performance-dashboard/) | sem data | 2026-09-03 | média |
| [12] | Tendência de carga na patente Firstbeat | [USPTO, US 10.580.532](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10580532) | sem data | 2026-09-03 | baixa |
| [13] | Garmin compra TrainingPeaks; sem plano de métricas/preço | [DC Rainmaker](https://www.dcrainmaker.com/2026/07/garmin-acquires-training-trainheroic.html) | 2026-07-22 | 2026-09-03 | alta |
| [14] | Release oficial da aquisição | [PR Newswire (Garmin)](https://www.prnewswire.com/news-releases/garmin-acquires-trainingpeaks-and-trainheroic-leading-endurance-and-strength-training-platforms-for-athletes-and-coaches-302832078.html) | 2026-07-22 | 2026-09-03 | alta |
| [15] | intervals.icu free vs Supporter | [Intervals.icu pricing](https://www.intervals.icu/pricing/) | sem data | 2026-09-03 | alta |
| [16] | Expressões matemáticas e comparação de curvas | [Intervals.icu Forum](https://forum.intervals.icu/t/intervals-icu-news-2026-04-29/128374) | 2026-04-29 | 2026-09-03 | média |
| [17] | Dark mode | [Intervals.icu Forum](https://forum.intervals.icu/t/intervals-icu-news-2026-06-03/130271) | 2026-06-03 | 2026-09-03 | média |
| [18] | Push notifications | [Intervals.icu Forum](https://forum.intervals.icu/t/intervals-icu-news-2026-08-11/130965) | 2026-08-11 | 2026-09-03 | média |
| [19] | Suporte Huawei | [Intervals.icu Forum](https://forum.intervals.icu/t/intervals-icu-news-2026-03-08/123942) | 2026-03-08 | 2026-09-03 | média |
| [20] | Receita de Fitness/Fatigue/Form | [Intervals.icu Forum, post do autor](https://forum.intervals.icu/t/fitness-fatigue-and-form/1259) | 2020-06-30 | 2026-09-03 | alta |
| [21] | intervals.icu vs TrainingPeaks 2026 | [Apps for Strava](https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/) | 2026-06 | 2026-09-03 | média |
| [22] | Tração da intervals.icu; quem vence para quem | [Coachbox](https://coachbox.app/en/compare/intervals-icu-vs-trainingpeaks/) | 2026 | 2026-09-03 | média |
| [23] | Sentimento intervals.icu, TP, Runalyze | [LetsRun fórum](https://www.letsrun.com/forum/flat_read.php?thread=12445016) | sem data | 2026-09-03 | baixa |
| [24] | TP Premium preço e promessas | [TrainingPeaks pricing](https://www.trainingpeaks.com/pricing/for-athletes/) | sem data | 2026-09-03 | alta |
| [25] | Blog TP com preço antigo | [TrainingPeaks blog](https://www.trainingpeaks.com/blog/trainingpeaks-pricing/) | sem data | 2026-09-03 | média |
| [26] | Reajuste anual de 2025-04-02 | [TrainingPeaks Help Center](https://help.trainingpeaks.com/hc/en-us/articles/12916774026765-TrainingPeaks-Annual-Premium-Subscription-Pricing-Update) | 2025-02 | 2026-09-03 | alta |
| [27] | TP Virtual release notes | [TrainingPeaks Help Center](https://help.trainingpeaks.com/hc/en-us/articles/34924247758477-TrainingPeaks-Virtual-Release-Notes) | sem data | 2026-09-03 | média |
| [28] | Aquisição Garmin×TP (primeira fonte) | [the5krunner](https://the5krunner.com/2026/07/22/garmin-acquires-trainingpeaks-what-changes/) | 2026-07-22 | 2026-09-03 | média |
| [29] | Tiers Runalyze (página 403) | [Runalyze pricing](https://runalyze.com/pricing) | sem data | 2026-09-03 | média |
| [30] | O que o Premium da Runalyze acrescenta | [Runalyze blog](https://blog.runalyze.com/allgemein-en/runalyze-early-premium/) | sem data | 2026-09-03 | média |
| [31] | Redesign 2026-05-05 | [Runalyze blog](https://blog.runalyze.com/releases/the-new-runalyze-design-is-now-live/) | 2026-05-05 | 2026-09-03 | média |
| [32] | Changelog ago/2026 (TRIMP, streaks) | [Runalyze changelog](https://runalyze.com/changelog?_locale=en) | 2026-08-26 | 2026-09-03 | média |
| [33] | Recurring Routes e climbs | [Runalyze blog](https://blog.runalyze.com/allgemein-en/new-feature-recurring-routes/) | sem data | 2026-09-03 | média |
| [34] | MCP Server da Runalyze e métricas expostas | [the5krunner](https://the5krunner.com/2026/06/22/runalyze-mcp-server/) | 2026-06-22 | 2026-09-03 | alta |
| [35] | Effective VO2max | [Runalyze help](https://runalyze.com/help/article/vo2max) | sem data | 2026-09-03 | alta |
| [36] | Marathon Shape | [Runalyze glossário](https://runalyze.com/glossary/marathon-shape) | sem data | 2026-09-03 | alta |
| [37] | Premium €5,50 (conflita com €6) | [Runify blog](https://www.runifyapp.com/blog/trainingpeaks-vs-runalyze-2026) | 2026 | 2026-09-03 | baixa |
| [38] | Lista de recursos exclusivos de assinante | [Strava Help Center](https://support.strava.com/hc/en-us/articles/216917657-Strava-Subscription-Features) | sem data (atualizada 2026-09-03) | 2026-09-03 | alta |
| [39] | O que fica no plano gratuito | [Strava, /subscribe](https://www.strava.com/subscribe) | sem data | 2026-09-03 | alta |
| [40] | Athlete Intelligence: escopo e limites | [Strava Help Center](https://support.strava.com/en-us/articles/15401629-athlete-intelligence-on-strava) | sem data | 2026-09-03 | alta |
| [41] | Year in Sport só para assinantes | [road.cc](https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425) | 2025-12 | 2026-09-03 | alta |
| [42] | Reação ao paywall do Year in Sport | [Slashdot (Ars Technica)](https://news.slashdot.org/story/25/12/19/2158235/strava-puts-popular-year-in-sport-recap-behind-an-80-paywall) | 2025-12-19 | 2026-09-03 | média |
| [43] | Preços EUR e harmonização 2025-07-01 | [Strava, /pricing](https://www.strava.com/pricing) | sem data | 2026-09-03 | alta |
| [44] | Sem reajuste documentado; aviso 30 dias | [Strava Help Center, Pricing FAQ](https://support.strava.com/en-us/articles/15401674-subscription-pricing-faq) | sem data | 2026-09-03 | média |
| [45] | Índice de anúncios mar–set/2026 | [Strava Press](https://press.strava.com/) | 2026 | 2026-09-03 | média |
| [46] | What's New maio/2026: força, Adaptive Workouts | [Strava Stories](https://stories.strava.com/articles/whats-new-on-strava-may-2026) | 2026-05-28 | 2026-09-03 | alta |
| [47] | Pacote de hiking | [Strava Press](https://press.strava.com/articles/strava-adds-new-features-for-hiking-making-the-outdoor-experience-more-discoverable-navigable-and-social) | 2026-06-11 | 2026-09-03 | média |
| [48] | What's New março/2026: muscle maps | [Strava Stories](https://stories.strava.com/articles/whats-new-on-strava-muscle-maps-new-sports-and-expanded-training-tools) | 2026-03 | 2026-09-03 | média |
| [49] | Instant Workouts global | [Strava Press](https://press.strava.com/articles/strava-launches-new-instant-workouts-feature-worldwide-to-provide) | 2026-01 | 2026-09-03 | média |
| [50] | MCP Connector: dados, elegibilidade, motivação | [Strava Press](https://press.strava.com/articles/strava-launches-mcp-connector) | 2026-06-01 | 2026-09-03 | alta |
| [51] | MCP Connector confirmado; "still not a coach" | [NUA Coach](https://nua.coach/en/learn/strava-mcp-claude) | 2026-06-10 | 2026-09-03 | média |
| [52] | Free vs paid confirmado; top 10; Local Legends | [BikeTips](https://biketips.com/strava-free-vs-paid/) | 2026-05-06 | 2026-09-03 | alta |
| [53] | Athlete Intelligence descritivo; Runna separado | [The Running Genie](https://therunninggenie.com/blog/strava-athlete-intelligence-vs-ai-coaches) | 2026-05-09 | 2026-09-03 | média |
| [54] | Preço USD | [Strava Community Hub](https://communityhub.strava.com/t5/campfire-chat/subscription-fee-increase/m-p/25821) | sem data | 2026-09-03 | média |
| [55] | "Strava follows Garmin" | [Gadgets & Wearables](https://gadgetsandwearables.com/2025/12/20/strava-year-in-sport/) | 2025-12-20 | 2026-09-03 | alta |
| [56] | Performance Predictions, Group Challenges pagos | [Wareable](https://www.wareable.com/sport/is-strava-premium-worth-it) | sem data | 2026-09-03 | baixa |
| [57] | Tiers WHOOP (página 403, via snippet) | [WHOOP membership](https://www.whoop.com/us/en/membership/) | sem data | 2026-09-03 | média |
| [58] | Insumos do WHOOP Recovery | [WHOOP, The Locker](https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/) | sem data | 2026-09-03 | média |
| [59] | WHOOP Strain 0–21 | [WHOOP, The Locker](https://www.whoop.com/us/en/thelocker/how-does-whoop-strain-work-101/) | sem data | 2026-09-03 | média |
| [60] | Stress Monitor exige HRV contínua | [WHOOP Support](https://support.whoop.com/s/article/Get-to-Know-the-Stress-Monitor?language=en_US) | sem data | 2026-09-03 | média |
| [61] | WHOOP 5.0: tiers em GBP, calibração, Coach, críticas | [road.cc](https://road.cc/content/review/whoop-50-315523) | 2025-09-01 | 2026-09-03 | média |
| [62] | Lançamento WHOOP 5.0 e MG | [BusinessWire (release WHOOP)](https://www.businesswire.com/news/home/20250508546933/en/WHOOP-Unveils-WHOOP-5.0-and-WHOOP-MG-Powerful-New-Devices-with-Breakthrough-Health-and-Longevity-Features) | 2025-05-08 | 2026-09-03 | alta |
| [63] | Backlash da taxa de upgrade | [DC Rainmaker](https://www.dcrainmaker.com/2025/05/whoop-5-mg-backlash.html) | 2025-05-25 | 2026-09-03 | média |
| [64] | Pressão arterial sem certificação | [DC Rainmaker](https://www.dcrainmaker.com/2025/12/backlog-product-reviews.html) | 2025-12 | 2026-09-03 | média |
| [65] | "Difficult to recommend" no tier Life | [Tom's Guide](https://www.tomsguide.com/wellness/fitness-trackers/whoop-5-0-review-should-you-give-a-whoop-about-this-new-tracker) | sem data | 2026-09-03 | média |
| [66] | Oura Membership preço | [Oura Member Care](https://support.ouraring.com/hc/en-us/articles/4409086524819-Oura-Membership) | sem data | 2026-09-03 | média |
| [67] | Nove contributors do Readiness e suas janelas | [Oura Member Care](https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors) | 2026-07-14 | 2026-09-03 | alta |
| [68] | Symptom Radar | [Oura Member Care](https://support.ouraring.com/hc/en-us/articles/35593651188115-Symptom-Radar) | sem data | 2026-09-03 | média |
| [69] | Cardiovascular Age | [Oura, The Pulse Blog](https://ouraring.com/blog/heart-health-at-oura/) | sem data | 2026-09-03 | média |
| [70] | Health Radar: Blood Pressure Signals, Nighttime Breathing | [Oura, The Pulse Blog](https://ouraring.com/blog/introducing-health-radar/) | sem data | 2026-09-03 | média |
| [71] | Health Radar em produção | [Oura Member Care](https://support.ouraring.com/hc/en-us/articles/52627030482707-Health-Radar) | sem data | 2026-09-03 | média |
| [72] | O que resta sem membership | [bettervitals.com](https://www.bettervitals.com/learn/oura-ring-subscription-worth-it-2026) | 2026 | 2026-09-03 | média |
| [73] | Preço Oura confirmado | [unanswered.io](https://unanswered.io/guide/oura-ring-pricing-and-monthly-fee) | 2026 | 2026-09-03 | média |
| [74] | Oura Ring 5 anunciado (corpo 403) | [MobiHealthNews](https://www.mobihealthnews.com/news/oura-unveils-ai-enabled-oura-ring-5-predictive-health-features) | sem data | 2026-09-03 | baixa |
| [75] | Athlytic: métricas e preço | [Athlytic, site oficial](https://www.athlyticapp.com/) | sem data | 2026-09-03 | alta |
| [76] | Athlytic na App Store: versão 26.5.6, métricas, preço | [Apple App Store (ficha MyndArc)](https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755) | 2026-08 | 2026-09-03 | alta |
| [77] | Recovery pesa demais o cardio | [ibikerun (Substack)](https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch) | sem data | 2026-09-03 | baixa |
| [78] | Sleep Score 50/30/20 | [Apple Support](https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos) | sem data | 2026-09-03 | alta |
| [79] | Training Load 7 d vs 28 d | [Apple Support](https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/watchos) | sem data | 2026-09-03 | alta |
| [80] | Vitals: faixa típica por métrica | [Apple Support](https://support.apple.com/guide/watch/vitals-apd15aa7ed96/watchos) | sem data | 2026-09-03 | média |
| [81] | Sleep Score no watchOS 26; composição confirmada | [AppleInsider](https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26) | 2025-09-12 | 2026-09-03 | alta |
| [82] | Recalibração das faixas na 26.2 | [9to5Mac](https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/) | 2025-11-04 | 2026-09-03 | alta |
| [83] | Training Load: esforço automático, 10 dias de baseline | [T3](https://www.t3.com/tech/smartwatches/apple-watch-training-load) | sem data | 2026-09-03 | média |
| [84] | Quantified Scientist (resumo secundário) | [New Zapiens](https://newzapiens.com/magazine/oura-vs-whoop-vs-apple-watch-the-quantified-scientist-on-what-the-accuracy-data-shows) | sem data | 2026-09-03 | baixa |
| [85] | API Agreement vigente: cláusulas-destaque, sem isenção pessoal | [Strava, legal](https://www.strava.com/legal/api) | 2026-06-01 | 2026-09-03 | alta |
| [86] | Nota de nov/2024: três mudanças; "tools that help users understand their data" | [Strava Press](https://press.strava.com/articles/updates-to-stravas-api-agreement) | 2024-11-15 | 2026-09-03 | alta |
| [87] | Cláusulas de IA e look and feel de 2024; contradição com analytics | [DC Rainmaker](https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html) | 2024-11-19 | 2026-09-03 | alta |
| [88] | "Restricted Processing" (snippet) | [Strava Help Center](https://support.strava.com/hc/en-us/articles/31798729397773-API-Agreement-Update-How-Data-Appears-on-3rd-Party-Apps) | sem data | 2026-09-03 | média |
| [89] | Developer Program 2026: tiers, assinatura, prazos, intermediários, MCP | [Strava Community Hub, Insider Journal](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428) | 2026-06-01 | 2026-09-03 | alta |
| [90] | Confirmação independente do programa de 2026 | [GitHub, r-huijts/strava-mcp issue #53](https://github.com/r-huijts/strava-mcp/issues/53) | 2026-06-01 | 2026-09-03 | alta |
| [91] | Reações de terceiros; intermediário indefinido | [Intervals.icu Forum](https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240) | 2026-06-01 a 06-04 | 2026-09-03 | média |
| [92] | MCP oficial só assinantes, read-only; leitura da Tredict | [Tredict blog](https://www.tredict.com/blog/strava_mcp_server/) | 2026-06-05 | 2026-09-03 | média |
| [93] | Assinatura exigida; wearables não afetados (snippet) | [Notebookcheck](https://www.notebookcheck.net/Strava-just-pulled-a-Reddit-on-its-developer-community.1312468.0.html) | 2026-06 | 2026-09-03 | média |
| [94] | 448% de apps; enquadramento IPO (snippet) | [Apps for Strava](https://appsforstrava.com/blog/strava-developer-program-changes-2026) | 2026-06 | 2026-09-03 | baixa |
| [95] | "Strava Tightens Its API Ahead of an IPO" | [Slowtwitch fórum](https://forum.slowtwitch.com/t/strava-tightens-its-api-ahead-of-an-ipo/1298514) | sem data | 2026-09-03 | baixa |
| [96] | Fitness & Freshness diverge do intervals.icu | [Intervals.icu Forum](https://forum.intervals.icu/t/intervals-v-strava/88823) | 2025-01-30 | 2026-09-03 | alta |
| [97] | Discrepâncias de Fitness/Form entre plataformas | [Athletica support](https://support.athletica.ai/hc/en-us/articles/32994375773339-Understanding-Fitness-Form-and-Fatigue-Discrepancies-Between-Athletica-Intervals-icu-and-Strava) | sem data | 2026-09-03 | média |
| [98] | Athlete Intelligence "more like a meme" | [Fortune](https://fortune.com/2024/10/11/strava-app-artificial-intelligence-fitness-athletic-memes) | 2024-10-11 | 2026-09-03 | média |
| [99] | "Getting expensive" | [TechRadar](https://www.techradar.com/health-fitness/strava-is-still-the-best-training-app-for-runners-and-cyclists-but-its-getting-expensive) | sem data | 2026-09-03 | média |
| [100] | Ideia: F&F com janela longa customizável | [Strava Community Hub, Ideas](https://communityhub.strava.com/t5/ideas/better-fitness-and-freshness-chart-for-long-term-analysis/idi-p/406) | sem data | 2026-09-03 | baixa |
| [101] | F&F não existe na API | [Strava Community Hub, devs](https://communityhub.strava.com/developers-api-7/is-there-any-way-to-get-fitness-freshness-1625) | sem data | 2026-09-03 | baixa |
| [102] | Pedidos de capacidade negados (fórum de devs, 2026-09-03) | [Strava Community Hub, fórum de devs](https://communityhub.strava.com/developers-api-7) | 2026-09-03 | 2026-09-03 | média |
| [103] | "Strava API forbids data forwarding" | [Intervals.icu Forum](https://forum.intervals.icu/t/solved-mcp-server-for-coaches-via-api-do-not-see-athletes-activities-brought-from-strava-ans-strava-api-forbids-data-fowarding/113828) | sem data | 2026-09-03 | baixa |
| [104] | intervals.icu batendo rate limits do Strava | [TrainerRoad Forum](https://www.trainerroad.com/forum/t/intervals-icu-hitting-strava-rate-limits-big-consequences-for-tr-users/81273) | sem data | 2026-09-03 | baixa |
| [105] | Reversão do bloqueio de links externos | [Tom's Guide](https://tomsguide.com/wellness/fitness/good-news-for-strava-users-the-app-just-reversed-a-hugely-unpopular-decision) | sem data (2025) | 2026-09-03 | média |
| [106] | API Policy 2026-06-01: §5.3 IA e RAG, §5.4 analytics, uso competitivo | [Strava, legal, API Policy](https://www.strava.com/legal/api_policy) | 2026-06-01 | 2026-09-03 | média (renderização JS, duas leituras) |
| [107] | Ideia: F&F cruzado com sono e peso | [Strava Community Hub, Ideas](https://communityhub.strava.com/t5/ideas/fitness-and-freshness-to-factor-sleep-and-weight/idi-p/408) | sem data | 2026-09-03 | baixa |
