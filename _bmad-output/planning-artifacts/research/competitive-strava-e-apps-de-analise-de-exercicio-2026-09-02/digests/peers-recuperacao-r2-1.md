---
dimension: peers-recuperacao
round: 2
assistant: 1
accessed: 2026-09-03
---
## Verification
- id: V1
  outcome: verified (parcial)
  evidence: A road.cc confirma, com reportagem própria, três tiers anuais One/Peak/Life com split de hardware (One e Peak = WHOOP 5.0, Life = WHOOP MG com ECG e pressão arterial) a £169/£229/£349 por ano; os preços em USD (199/239/359) e a lista completa de insumos do Recovery (RHR, HRV, frequência respiratória, sono, temperatura da pele, SpO2) NÃO foram confirmados por fonte independente nesta rodada — a road.cc só nomeia HRV como componente.
  source: https://road.cc/content/review/whoop-50-315523
  publisher: road.cc
  pub_date: 2025-09-01
  accessed: 2026-09-03
- id: V2
  outcome: verified (parcial)
  evidence: O preço da Oura Membership de US$5,99/mês ou US$69,99/ano é repetido por guias independentes de 2026 (unanswered.io, bettervitals.com — agregadores de qualidade média, consistentes entre si); a lista de nove contributors do Readiness não foi enumerada por publisher independente — só o próprio suporte da Oura apareceu, confirmando que "Sleep regularity" é contributor e mede a consistência de horários de dormir/acordar nas duas semanas anteriores; os preços em euro ficaram sem confirmação.
  source: https://unanswered.io/guide/oura-ring-pricing-and-monthly-fee
  publisher: unanswered.io (agregador) + support.ouraring.com (Readiness Contributors)
  pub_date: 2026 (mês não exibido)
  accessed: 2026-09-03
- id: V3
  outcome: verified
  evidence: A ficha na App Store (publisher: Apple, listagem escrita pelo desenvolvedor MyndArc, LLC) mostra compras in-app de US$4,99/mês e US$29,99/ano, declara "Athlytic integrates with the Health App on your iPhone to retrieve the data it displays" e nomeia Recovery, Exertion, Sleep, Training Load e Stress entre as métricas; o "on-device" é afirmado textualmente para o Ask Athlytic ("your data never leaves your device"), não para todo o cálculo.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store (ficha da MyndArc, LLC)
  pub_date: 2026-08 (versão 26.5.6 publicada "5 days ago" em 2026-09-03)
  accessed: 2026-09-03
- id: V4
  outcome: verified (parcial)
  evidence: A AppleInsider confirma a composição do Sleep Score com o exemplo "40/50 points for sleep duration, 30/30 for bedtime, and 14/20 for interruptions" (máximos 50/30/20), mas não menciona a janela de 13 noites; T3 e Tom's Guide (via Yahoo) confirmam, em snippet, o Training Load como comparação dos últimos 7 dias contra os 28 dias anteriores, com effort estimado automaticamente em cardio e ajustável manualmente — e entrada manual em força.
  source: https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26
  publisher: AppleInsider (+ T3 https://www.t3.com/tech/smartwatches/apple-watch-training-load em snippet)
  pub_date: 2025-09-12
  accessed: 2026-09-03

## Claims

### Whoop
- claim: O tier One (£169/ano) traz a WHOOP 5.0 com carregador com fio e "basic health monitoring, recovery insights, women's hormonal insights"; o Peak (£229/ano) adiciona o Wireless PowerPack; o Life (£349/ano, ou £589 por 2 anos) traz a WHOOP MG com ECG e monitoramento de pressão arterial e pulseira SuperKnit Luxe — preços com 12 meses de idade, marcar como stale.
  source: https://road.cc/content/review/whoop-50-315523
  publisher: road.cc
  pub_date: 2025-09-01
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: A WHOOP anunciou a WHOOP 5.0 e a WHOOP MG em 2025-05-08 (press release "WHOOP Unveils WHOOP 5.0 and WHOOP MG Powerful New Devices with Breakthrough Health and Longevity Features").
  source: https://www.businesswire.com/news/home/20250508546933/en/WHOOP-Unveils-WHOOP-5.0-and-WHOOP-MG-Powerful-New-Devices-with-Breakthrough-Health-and-Longevity-Features
  publisher: BusinessWire (press release da WHOOP — fonte do fabricante)
  pub_date: 2025-05-08
  accessed: 2026-09-03
  confidence: high
  class: trajectory
- claim: A calibração do Recovery/Strain não é imediata — "it still takes a number of days to start providing insights into your health and it'll be weeks before the system is properly calibrated to your body", e "if you don't pull historical data in, Whoop's strain score will take over a month to settle".
  source: https://road.cc/content/review/whoop-50-315523
  publisher: road.cc
  pub_date: 2025-09-01
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O Whoop Coach entrega recomendações diárias de atividade ("three ways you can crush this workout"), mas o revisor o considera "lacking in depth and detail" frente a apps de coaching dedicados.
  source: https://road.cc/content/review/whoop-50-315523
  publisher: road.cc
  pub_date: 2025-09-01
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O lançamento da 5.0/MG gerou backlash em maio de 2025 por causa da política de taxa de upgrade (comentário citado: usuário em trial com Whoop 4 é cobrado "upgrade fee" para assinar com a 5.0 — "Do they never learn?").
  source: https://www.dcrainmaker.com/2025/05/whoop-5-mg-backlash.html
  publisher: DC Rainmaker
  pub_date: 2025-05-25
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: Após meses de uso, o DC Rainmaker relata que a bateria de 14 dias se sustenta, que o ECG medicamente certificado tem valor, mas que a função de pressão arterial "isn't actually medically certified and requires calibration with a blood pressure monitor anyway".
  source: https://www.dcrainmaker.com/2025/12/backlog-product-reviews.html
  publisher: DC Rainmaker
  pub_date: 2025-12
  accessed: 2026-09-03
  confidence: medium
  class: feature

### Oura
- claim: O Health Radar amplia o Symptom Radar com duas capacidades — Blood Pressure Signals (tendências cardiovasculares a partir de PPG noturno em períodos de avaliação de 30 dias) e Nighttime Breathing (visão rolante de 30 dias de disrupções do ritmo respiratório noturno) — desenvolvidas com "more than 40 in-house MDs and PhDs".
  source: https://ouraring.com/blog/introducing-health-radar/
  publisher: Oura (The Pulse Blog — fonte do fabricante, via snippet de busca)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O Health Radar tem artigo próprio no Member Care da Oura (id 52627030482707), sinal de que já é feature em produção e não experimento do Oura Labs.
  source: https://support.ouraring.com/hc/en-us/articles/52627030482707-Health-Radar
  publisher: Oura Member Care
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: trajectory
- claim: A Oura anunciou um "Oura Ring 5" habilitado por IA com recursos preditivos de saúde, lançado junto com novas features de software (títulos da MobiHealthNews e TechTarget; corpo não acessível — 403).
  source: https://www.mobihealthnews.com/news/oura-unveils-ai-enabled-oura-ring-5-predictive-health-features
  publisher: MobiHealthNews (+ TechTarget https://www.techtarget.com/virtualhealthcare/news/366643738/Oura-launches-new-health-features-with-new-ring-release)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: trajectory
- claim: O contributor "Sleep regularity" do Readiness mede a consistência dos horários de dormir e acordar nas duas semanas anteriores e não é afetado por cochilos.
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Sem membership, o app da Oura ainda mostra os três scores diários (Sleep, Activity, Readiness), bateria e perfil; o restante fica atrás da assinatura de US$5,99/mês ou US$69,99/ano, com primeiro mês grátis.
  source: https://www.bettervitals.com/learn/oura-ring-subscription-worth-it-2026
  publisher: bettervitals.com (agregador)
  pub_date: 2026 (mês não exibido)
  accessed: 2026-09-03
  confidence: medium
  class: terms
- claim: O Oura Ring 4 custa de US$349 (Silver/Black) a US$499 (cerâmica), com Brushed Silver e Stealth a US$399.
  source: https://www.tomsguide.com/wellness/fitness-trackers/oura-ring-4
  publisher: Tom's Guide
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: pricing

### Athlytic
- claim: A ficha da App Store hoje se chama "Athlytic: Fitness & Recovery" (slug da URL e títulos de busca ainda dizem "AI Fitness Coach"), com nota 4,8/5 em 11 mil avaliações, versão 26.5.6 publicada há 5 dias e compras in-app de US$4,99/mês e US$29,99/ano.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store (ficha da MyndArc, LLC)
  pub_date: 2026-08
  accessed: 2026-09-03
  confidence: high
  class: pricing
- claim: As métricas nomeadas na ficha vão além dos cinco scores: Recovery, Exertion, Target Exertion, Sleep, Target Sleep, HRV, Resting Heart Rate, Blood Oxygen, Respiratory Rate, Wrist Temperature, Training Load, Stress, Cardio Fitness, Heart Rate Recovery, Training Effect, Effort Score e Athlytic Age — "VO2max" aparece como Cardio Fitness; "HRV baseline" não aparece nominalmente.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store (ficha da MyndArc, LLC)
  pub_date: 2026-08
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: A versão 26.5.6 quebra corridas intervaladas em reps e recoveries (usando a estrutura planejada do treino ou detectando segmentos corrida/caminhada por cadência, ritmo e potência), adiciona cartões de recorde pessoal (corridas e pedais mais longos, maior Effort, maior subida, primeiros 10K/meia) e um widget de estágios de sono.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store (ficha da MyndArc, LLC)
  pub_date: 2026-08
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Athlytic tem "Ask Athlytic" (chat com os dados, "your data never leaves your device so the conversation is completely private") e "Workout Insights"/"Journal Insights" movidos por Apple Intelligence; não exige Apple Watch, mas HRV e RHR precisam dele.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store (ficha da MyndArc, LLC)
  pub_date: 2026-08
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Requisitos: iOS 17.0+, iPadOS 17.0+, watchOS 10.6+, visionOS 1.0+.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store
  pub_date: 2026-08
  accessed: 2026-09-03
  confidence: high
  class: terms

### Apple Fitness
- claim: O Sleep Score chegou com o watchOS 26 em 2025-09-15 e exige Apple Watch Series 6 ou posterior, SE 2 ou posterior ou qualquer Ultra, com iOS 26 (iPhone 11 ou posterior); Series 11 e Ultra 3 chegaram em 2025-09-19.
  source: https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26
  publisher: AppleInsider
  pub_date: 2025-09-12
  accessed: 2026-09-03
  confidence: high
  class: trajectory
- claim: O Sleep Score compara cada noite com o histórico do próprio usuário (hora de dormir, duração, consistência, interrupções e tempo por estágio) e foi desenvolvido com a American Academy of Sleep Medicine, National Sleep Foundation e World Sleep Society, apoiado em 5 milhões de noites do Apple Heart and Movement Study.
  source: https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26
  publisher: AppleInsider (+ Neowin em snippet)
  pub_date: 2025-09-12
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: No watchOS 26.2 / iOS 26.2 a Apple reclassificou as faixas do Sleep Score — Very Low 0–40, Low 41–60, OK 61–80, High 81–95, Very High 96–100 — porque a implementação inicial era "a bit too forgiving".
  source: https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/
  publisher: 9to5Mac (+ GSMArena https://m.gsmarena.com/apple_watchos_26_2_update_released-news-70706.php)
  pub_date: 2025-11-04
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Training Load (desde o watchOS 11) estima o effort automaticamente em tipos de cardio populares a partir de idade, altura, peso, GPS, frequência cardíaca e elevação, permite ajuste manual (1–10), exige entrada manual em força, precisa de 10 dias de baseline e classifica os últimos 7 dias contra a média ponderada de 28 dias como well below / below / steady / above / well above.
  source: https://www.t3.com/tech/smartwatches/apple-watch-training-load
  publisher: T3 (+ Apple Newsroom 2024-06 https://www.apple.com/newsroom/2024/06/watchos-11-brings-powerful-health-and-fitness-insights/)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Nenhuma fonte recuperada nesta rodada descreve mudança do Training Load no watchOS 26; as novidades de fitness citadas para o watchOS 26 são Sleep Score e Workout Buddy.
  source: https://www.neowin.net/amp/apple-rolls-out-watchos-26-with-sleep-score-liquid-glass-and-other-improvements/
  publisher: Neowin (snippet) + AppleInsider
  pub_date: 2025-09
  accessed: 2026-09-03
  confidence: low
  class: trajectory

### Validação e sentimento
- claim: Segundo resumo do trabalho do The Quantified Scientist, a WHOOP 5.0 no bíceps é "near-perfect" em ciclismo indoor e corrida, mas no pulso pode travar na cadência em ciclismo outdoor e musculação; ele coloca a Whoop na "second league" ao lado de Fitbit/Pixel Watch, com a Oura mais forte no sono e a Whoop mais forte no exercício.
  source: https://newzapiens.com/magazine/oura-vs-whoop-vs-apple-watch-the-quantified-scientist-on-what-the-accuracy-data-shows
  publisher: New Zapiens (secundário, resumindo The Quantified Scientist)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment
- claim: A road.cc considera o Recovery útil para insights de estilo de vida (álcool, hidratação, horário de dormir), mas critica que a Whoop atribui frequência cardíaca elevada a stress em vez de atividade leve, que "throws off my metrics", e que não dá para remover pontos de dados errados que afetam o score.
  source: https://road.cc/content/review/whoop-50-315523
  publisher: road.cc
  pub_date: 2025-09-01
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: A Tom's Guide elogia o app da WHOOP 5.0 MG ("excellent app", insights fáceis de interpretar, bateria de 14 dias "unrivalled") mas conclui que o preço da MG é muito alto, que o plano básico não traz algumas features novas e que é "difficult to recommend, especially at the Life subscription tier".
  source: https://www.tomsguide.com/wellness/fitness-trackers/whoop-5-0-review-should-you-give-a-whoop-about-this-new-tracker
  publisher: Tom's Guide
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: O Sleep Score da Apple foi percebido como generoso demais no lançamento, a ponto de a Apple recalibrar as faixas dois meses depois (26.2) — sinal de que score de sono sem baseline pessoal rígida perde credibilidade rápido.
  source: https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/
  publisher: 9to5Mac
  pub_date: 2025-11-04
  accessed: 2026-09-03
  confidence: high
  class: sentiment

## Leads
- Preços da WHOOP em USD (One/Peak/Life) e o que cada tier libera em software (Healthspan/WHOOP Age, Advanced Labs, Coach) — o press release da BusinessWire de 2025-05-08 deve trazer tudo; a road.cc só deu GBP. Checar também se a WHOOP alterou preços em 2026.
- Insumos do Healthspan / WHOOP Age / Pace of Aging — nenhuma fonte recuperada os enumerou.
- Data de lançamento e regiões do Health Radar e do Oura Ring 5 — MobiHealthNews devolveu 403; tentar TechTarget (URL acima) ou o próprio blog da Oura (introducing-health-radar), que não foi buscado por falta de orçamento.
- Resilience da Oura (insumos e janelas) e Oura Advisor (escopo, se incluso na membership) — não chegou a ser pesquisado.
- Confirmar por publisher independente os nove contributors do Readiness (ninguém fora da Oura os enumerou nos resultados).
- watchOS 27 / release de 2026: nenhuma busca feita; conferir se a Apple adicionou métrica de recuperação (ex.: readiness/HRV baseline) na WWDC 2026.
- Vídeo original do The Quantified Scientist sobre WHOOP 5.0 / Oura Ring 4 (a fonte usada é um resumo secundário).
- DC Rainmaker "2025 Review Backlog" (2025-12) tem quick review da WHOOP 5.0 MG — vale ler por inteiro para sentimento e detalhes de tiers.

## Looked for and could not find
- Confirmação independente da lista de seis insumos do WHOOP Recovery (RHR, HRV, frequência respiratória, sono, temperatura da pele, SpO2) — a road.cc só cita HRV.
- Número exato de dias de baseline do WHOOP Recovery — só a afirmação qualitativa "days… weeks… over a month" da road.cc.
- Janela de 13 noites da Bedtime Consistency do Sleep Score da Apple — AppleInsider não a menciona.
- Preços da Oura Membership em euro.
- Qualquer mudança no Training Load da Apple no watchOS 26 ou posterior.
- Corpo do artigo da Tom's Guide sobre a WHOOP 5.0 e da TechRadar sobre o Oura Ring 4 — ambos vieram truncados no fetch; só snippets foram aproveitados.
- Contagem de avaliações do Athlytic na App Store além de "11K" e a data exata em que o nome mudou para/de "AI Fitness Coach".
