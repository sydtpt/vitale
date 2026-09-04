---
dimension: peers-desempenho
round: 2
assistant: 1
accessed: 2026-09-03
---
## Verification
- id: V1
  outcome: verified
  evidence: DC Rainmaker (reportagem própria, não sindicação) confirma que a Garmin anunciou em 2026-07-22 a aquisição de TrainingPeaks e TrainHeroic, já fechada no anúncio, com a TrainingPeaks afirmando que "will continue to operate as a cross-platform ecosystem, enabling athletes and coaches to use the devices, platforms and services that best suit their needs"; nenhuma mudança de preço anunciada e nenhum plano divulgado de levar métricas da TrainingPeaks (TSS, NP, IF) para o Garmin Connect ou vice-versa; porta-vozes citados: Brad Trenkle (Garmin Co-COO) e Andy Stephens (CEO Peaksware). Corroborado pela nota oficial da Garmin (newsroom) e pela distribuição PR Newswire/Yahoo/Investing.com (uma só fonte upstream): 120 associados em Louisville (CO) passam à Garmin, termos financeiros não divulgados.
  source: https://www.dcrainmaker.com/2026/07/garmin-acquires-training-trainheroic.html
  publisher: DC Rainmaker
  pub_date: 2026-07-22
  accessed: 2026-09-03
- id: V2
  outcome: verified
  evidence: Should I Train (2026-03-02, independente da Garmin) confirma US$6,99/mês ("For the first time, Garmin is asking users to pay a monthly subscription - $6.99/month"); snippets de busca (TrackerVS / Should I Train, 2026) dizem que a estrutura US$6,99/mês ou US$69,99/ano está estável desde o lançamento e sem reajuste anunciado até maio de 2026; a lista de recursos do lançamento (Active Intelligence, Performance Dashboard, Live Activity, LiveTrack com alertas por SMS e página de perfil, conteúdo extra de Garmin Coach, badges e desafios exclusivos, estrela no perfil) é confirmada por the5krunner (2026-04-20) e TechRadar; a promessa de que a experiência gratuita "is not going away" é reportada pela TechRadar (2025-03, stale) citando a própria Garmin — ou seja, a parte "métricas fisiológicas continuam grátis" é confirmada apenas como declaração da Garmin reproduzida por terceiros, não por auditoria independente. Nota: desde o lançamento entraram no Connect+ Garmin Trails/Trails+ routing, 3D Maps, Connect Rundown e rastreamento nutricional com reconhecimento de imagem por IA — o perímetro do paywall cresceu.
  source: https://www.shoulditrain.com/blog/garmin-connect-plus-review
  publisher: Should I Train
  pub_date: 2026-03-02
  accessed: 2026-09-03
- id: V3
  outcome: verified
  evidence: Apps for Strava (2026-06, independente do site da intervals.icu) afirma que o tier gratuito inclui "the fitness and fatigue modeling (CTL, ATL, TSB), the power curve, automatic interval detection, the calendar, the workout builder, and Strava sync" e que o Supporter custa US$4/mês e adiciona "weather analysis, an annual plan builder, full Strava history import, and fully custom zones"; Coachbox (2026) repete que fitness chart, power curve e interval analysis são grátis com Supporter opcional de US$4. Não encontrei confirmação independente explícita de "HR analytics" e "custom charts" no tier grátis (a fonte fala genericamente em "deep customizable analytics").
  source: https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/
  publisher: Apps for Strava
  pub_date: 2026-06
  accessed: 2026-09-03
- id: V4
  outcome: disputed
  evidence: the5krunner (2026-06-22, independente do blog/changelog da Runalyze) confirma o lançamento do MCP Server em 2026-06-09, "open only to paying members and is still in testing", com Claude, Mistral e Gemini CLI — a parte "junho de 2026" está verificada; o suporte a Grok em 2026-08-26 ficou sem verificação independente; sobre preços, um snippet de busca (Runify Blog "TrainingPeaks vs Runalyze 2026" ou Apps for Strava, data não visível) diz "Premium costs €5.50 a month", em conflito com os €6/mês da rodada 1 — pode ser preço antigo antes de reajuste, mas não consegui datar; Supporter €2,50/mês não foi confirmado nem negado.
  source: https://the5krunner.com/2026/06/22/runalyze-mcp-server/
  publisher: the5krunner
  pub_date: 2026-06-22
  accessed: 2026-09-03

## Claims

### Garmin Connect
- claim: A aquisição de TrainingPeaks/TrainHeroic foi anunciada como concluída em 2026-07-22; a Garmin não declarou mudança de preço da TrainingPeaks nem plano de integrar TSS/NP/IF ao Garmin Connect, e Ray Maker aponta como riscos abertos bloqueio de upload de aparelhos de terceiros e restrições de licenciamento "estilo Firstbeat".
  source: https://www.dcrainmaker.com/2026/07/garmin-acquires-training-trainheroic.html
  publisher: DC Rainmaker
  pub_date: 2026-07-22
  accessed: 2026-09-03
  confidence: high
  class: trajectory
- claim: Na leitura do DC Rainmaker, a motivação provável da compra é fortalecer o Garmin Connect+, "which currently lack compelling features" — sinal de que a análise de treino paga da Garmin ainda é considerada fraca por revisores.
  source: https://www.dcrainmaker.com/2026/07/garmin-acquires-training-trainheroic.html
  publisher: DC Rainmaker
  pub_date: 2026-07-22
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: 120 associados de TrainingPeaks e TrainHeroic (sede em Louisville, Colorado) passam ao quadro global da Garmin; os termos financeiros não foram divulgados.
  source: https://www.prnewswire.com/news-releases/garmin-acquires-trainingpeaks-and-trainheroic-leading-endurance-and-strength-training-platforms-for-athletes-and-coaches-302832078.html
  publisher: PR Newswire (release da Garmin)
  pub_date: 2026-07-22
  accessed: 2026-09-03
  confidence: high
  class: trajectory
- claim: Garmin Connect+ custa US$6,99/mês (e US$69,99/ano segundo snippets de 2026), sem reajuste desde o lançamento em março de 2025; a revisão descreve o núcleo pago como conselhos de treino por IA, sugestões de treino personalizadas, orientação de recuperação e previsões de prova/coaching por meta, todos alimentados por training load, recovery metrics, sono, HRV e histórico.
  source: https://www.shoulditrain.com/blog/garmin-connect-plus-review
  publisher: Should I Train
  pub_date: 2026-03-02
  accessed: 2026-09-03
  confidence: high
  class: pricing
- claim: Desde o lançamento, o Connect+ ganhou Garmin Trails e Trails+ routing, 3D Maps, Connect Rundown (resumo de fim de ano) e rastreamento nutricional nativo com reconhecimento de imagem por IA e leitura de código de barras — e a revisão de um ano do the5krunner conclui "Still Not Worth It After a Year BUT More To Come".
  source: https://the5krunner.com/2026/04/20/garmin-connect-plus-review/
  publisher: the5krunner
  pub_date: 2026-04-20
  accessed: 2026-09-03
  confidence: medium
  class: trajectory
- claim: Active Intelligence gera prompts de IA ao acordar, após o treino e à noite, cruzando sono, HRV, training load e stress; o Performance Dashboard permite comparar dados de fitness e saúde em gráficos personalizáveis com presets de força, corrida, ciclismo, multisport ou totalmente custom.
  source: https://www.garmin.com/en-US/blog/fitness/what-is-the-garmin-connect-performance-dashboard/
  publisher: Garmin (blog oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: A receita do Training Status da Garmin/Firstbeat está ao menos parcialmente pública em patente (US 10.580.532, "Method and an apparatus for determining training status"): a tendência de carga compara a carga semanal com a do mês anterior ("weekly training load peak sum divided by monthly training load peak sum") — indício de que o recorte é replicável a partir de carga diária, mesmo sem a Garmin publicar a fórmula.
  source: https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10580532
  publisher: USPTO (patente Firstbeat)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature

### intervals.icu
- claim: O tier gratuito inclui modelagem CTL/ATL/TSB, power curve, detecção automática de intervalos, calendário, construtor de treinos e sync com Strava; o Supporter (US$4/mês) adiciona análise de clima, planejador anual, importação do histórico completo do Strava e zonas totalmente customizadas.
  source: https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/
  publisher: Apps for Strava
  pub_date: 2026-06
  accessed: 2026-09-03
  confidence: high
  class: pricing
- claim: Segundo David Tinker (autor), Fitness e Fatigue "are derived from your training load for each activity and your FTP at the time (assuming you have a power meter, otherwise HR data is used)" e Form é exibida "as a percentage of your fitness, not an absolute number like Strava".
  source: https://forum.intervals.icu/t/fitness-fatigue-and-form/1259
  publisher: Intervals.icu Forum (post do autor, 2020-06-30)
  pub_date: 2020-06-30
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: As constantes 42/7 dias parecem ser configuráveis pelo usuário — um participante relata usar "10 instead of 7 and 50 instead of 42" para compensar recuperação mais lenta com a idade (a fórmula em si não é enunciada no tópico).
  source: https://forum.intervals.icu/t/fitness-fatigue-and-form/1259
  publisher: Intervals.icu Forum (post de usuário, 2021-02-24)
  pub_date: 2021-02-24
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Para atividades só com FC, a intervals.icu "estimates load from HR activities differently to Strava" (Tinker) e oferece TRIMP como alternativa a tempo-em-zonas, o que aproxima as curvas das do Strava.
  source: https://forum.intervals.icu/t/fitness-fatigue-and-form/1259
  publisher: Intervals.icu Forum (Tinker 2020-09-11; usuário 2021-02-25)
  pub_date: 2021-02
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: A intervals.icu tem 160.000+ atletas ativos e 193 milhões+ de atividades analisadas; David Tinker ficou em tempo integral no projeto em 2024, financiado por assinaturas voluntárias de Supporter, sem investidores.
  source: https://coachbox.app/en/compare/intervals-icu-vs-trainingpeaks/
  publisher: Coachbox
  pub_date: 2026
  accessed: 2026-09-03
  confidence: medium
  class: trajectory
- claim: Consenso dos comparativos de 2026: para atleta autotreinado a intervals.icu "wins" (fitness chart, power curve e interval analysis que a TrainingPeaks cobra ~US$20/mês são grátis); para atleta com coach e para coaches a TrainingPeaks "wins" (rede de coaches, marketplace com 70.000+ planos vendidos, 35+ federações parceiras).
  source: https://coachbox.app/en/compare/intervals-icu-vs-trainingpeaks/
  publisher: Coachbox
  pub_date: 2026
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: Diferença arquitetural: a intervals.icu "connects to Strava directly", enquanto a TrainingPeaks "expects your device to feed it" — relevante para um app que já ingere do Strava.
  source: https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/
  publisher: Apps for Strava
  pub_date: 2026-06
  accessed: 2026-09-03
  confidence: medium
  class: feature

### TrainingPeaks
- claim: O Premium anual subiu de US$124,99 para US$134,99 (+8%) nas renovações a partir de 2025-04-02; mensal (US$19,95) e trimestral (US$49) não mudaram; a TrainingPeaks justificou por "new Premium features and integrations".
  source: https://help.trainingpeaks.com/hc/en-us/articles/12916774026765-TrainingPeaks-Annual-Premium-Subscription-Pricing-Update
  publisher: TrainingPeaks Help Center
  pub_date: 2025-02
  accessed: 2026-09-03
  confidence: high
  class: pricing
- claim: Em junho de 2026 o Premium seguia em US$19,95/mês ou US$134,99/ano e é o que destrava "the Performance Management Chart, the deeper analytics, annual planning, and sending structured workouts to your device"; o Basic é descrito só como "limited features".
  source: https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/
  publisher: Apps for Strava
  pub_date: 2026-06
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: Pontos fortes atribuídos à TrainingPeaks: colaboração coach–atleta ("the back and forth between athlete and coach is what the platform was built around"), planos de marketplace e qualidade do app mobile.
  source: https://appsforstrava.com/blog/intervals-icu-vs-trainingpeaks/
  publisher: Apps for Strava
  pub_date: 2026-06
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: Pós-aquisição, a incerteza central para o mercado é se a TrainingPeaks continuará aceitando upload de aparelhos não-Garmin e se métricas da TrainingPeaks migram para o Connect — nada foi prometido além do compromisso "cross-platform".
  source: https://www.dcrainmaker.com/2026/07/garmin-acquires-training-trainheroic.html
  publisher: DC Rainmaker
  pub_date: 2026-07-22
  accessed: 2026-09-03
  confidence: high
  class: trajectory

### Runalyze
- claim: O MCP Server da Runalyze foi lançado em 2026-06-09, só para membros pagantes e ainda em teste, com Claude, Mistral e Gemini CLI; expõe CTL, ATL, TSB, acute:chronic ratio, training monotony e strain, marathon shape, "HRV baseline and normal range", estágios/qualidade de sono, FC noturna, respiração, FC de repouso, peso, composição corporal, glicose, pressão, temperatura, stress, humor, fadiga, notas, lesões e doenças.
  source: https://the5krunner.com/2026/06/22/runalyze-mcp-server/
  publisher: the5krunner
  pub_date: 2026-06-22
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: A lista exposta pelo MCP indica que a Runalyze calcula, a partir de HRV, uma linha de base e uma faixa normal por atleta (mesmo padrão de HRV Status da Garmin), além de monotonia e strain de treino (métricas de Foster) e ACWR.
  source: https://the5krunner.com/2026/06/22/runalyze-mcp-server/
  publisher: the5krunner
  pub_date: 2026-06-22
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Effective VO2max é estimado "for every run with heart rate data based on the relation of heart rate and pace" e "corresponds to a combination of the scientific VO2max and the running efficiency" — insumos: FC e ritmo por corrida (FCmáx/FC de repouso como parâmetros), sem laboratório.
  source: https://runalyze.com/help/article/vo2max
  publisher: RUNALYZE (help oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Marathon Shape é "an invention of Runalyze to optimize prognoses for long distances, that are based on the effective VO2max": a previsão de prova é ajustada continuamente pela "missing fitness" (base de endurance) — a prognose cobre de 3 km a (ultra)maratona.
  source: https://runalyze.com/glossary/marathon-shape
  publisher: RUNALYZE (glossário oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Um comparativo de 2026 diz que o Premium custa €5,50/mês e adiciona contador de "tiles", visão de sessões de qualidade para intervalados, melhores tempos por segmento extraídos de qualquer atividade (não só provas) e quilometragem em média móvel — número em conflito com os €6/mês da rodada 1.
  source: https://www.runifyapp.com/blog/trainingpeaks-vs-runalyze-2026
  publisher: Runify Blog
  pub_date: 2026
  accessed: 2026-09-03
  confidence: low
  class: pricing

## Leads
- Garmin L1 ficou aberto: a página garmin.com/garmin-technology/running-science/physiological-measurements é renderizada por JS (fetch devolve só navegação) e a busca restrita a support.garmin.com não retornou FAQs; tentar os manuais estáticos (www8.garmin.com/manuals/webhelp) ou as páginas de feature da Firstbeat (firstbeat.com/en/consumer-feature/…) para Training Status, Load Focus, Training Effect, Endurance Score, Hill Score e Race Predictor.
- Ler a patente US 10.580.532 (Firstbeat) para extrair a lógica de Training Status (tendência de carga × mudança de VO2max) — provavelmente o único lugar onde a receita está escrita.
- intervals.icu eFTP: tópicos do fórum "How does intervals.icu calculate eFTP?" (https://forum.intervals.icu/t/how-does-intervals-icu-calculate-eftp/81001) e "How is the estimated FTP being calculated?" (…/87527) e "Question regarding math behind fitness/fatigue" (…/63699) — não lidos por orçamento.
- TrainingPeaks: o artigo do help center com a tabela Basic vs Premium (PMC, TSS/IF/NP, time in zones, peak performances, Metrics) não foi localizado; buscar "Premium vs Basic feature comparison" em help.trainingpeaks.com.
- Runalyze: datar o preço €5,50 vs €6 (Premium) e confirmar Supporter €2,50; confirmar Grok em 2026-08-26; definir "advanced HRV analysis" do Premium e as fórmulas de monotony/strain em https://blog.runalyze.com/tutorial/runalyze-understanding-the-calculations/ (aparece na busca, não lido).
- Sentimento em Reddit (L5) não foi capturado — a busca devolveu comparativos comerciais, não threads; próxima rodada usar allowed_domains reddit.com com "intervals.icu", "Connect+", "TrainingPeaks price", "Runalyze".

## Looked for and could not find
- Definições oficiais da Garmin (insumos e janelas) para Training Status, Training Load Focus, Acute Load, Training Effect, Endurance Score, Hill Score e Race Predictor — duas tentativas (página de tecnologia e busca em support.garmin.com) sem retorno útil.
- Confirmação independente e explícita de que Training Readiness, Training Status, HRV Status e VO2max continuam grátis fora do Connect+ em 2026 — só a promessa da Garmin reproduzida pela TechRadar (2025-03).
- Método do eFTP da intervals.icu (durações da power curve usadas) e fórmula literal de Fitness/Fatigue.
- Plano declarado da Garmin/TrainingPeaks para preço e para métricas da TrainingPeaks no Garmin Connect — o DC Rainmaker afirma que nada foi divulgado.
- Suporte a Grok no MCP da Runalyze (2026-08-26) e o preço do Supporter (€2,50).
- Threads de Reddit dos últimos 12 meses sobre os quatro produtos.
