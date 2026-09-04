---
dimension: peers-recuperacao
round: 1
assistant: 1
accessed: 2026-09-03
---
## Claims

### Whoop

- claim: A WHOOP vende três tiers de membership — One (US$ 199/ano), Peak (US$ 239/ano) e Life (US$ 359/ano); a página de membership e as páginas de cada plano existem em whoop.com, mas devolvem HTTP 403 ao crawler, então os valores vêm do resumo de busca das páginas oficiais e não de leitura direta.
  source: https://www.whoop.com/us/en/membership/
  publisher: WHOOP
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: O Recovery da WHOOP é calculado ao acordar como percentual 0–100% a partir de medições do dia anterior e da noite: resting heart rate, HRV, respiratory rate, duração/qualidade do sono, skin temperature e blood oxygen.
  source: https://www.whoop.com/us/en/thelocker/how-does-whoop-recovery-work-101/
  publisher: WHOOP (The Locker)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O Strain da WHOOP é um número 0–21 em escala logarítmica, composto de carga cardiovascular (tempo acumulado por zona de FC, com esforço sustentado pesando mais que picos breves) e carga muscular; a fórmula e os pesos são proprietários e não publicados.
  source: https://www.whoop.com/us/en/thelocker/how-does-whoop-strain-work-101/
  publisher: WHOOP (The Locker)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O Stress Monitor da WHOOP mede HRV ao longo do dia em períodos sem movimento e calcula um Stress Score comparando HR e HRV do momento com a baseline pessoal de HRV dos últimos 14 dias e o RHR típico; mede estresse fisiológico (doença e altitude também elevam o score) e oferece Sessions de respiração guiada.
  source: https://support.whoop.com/s/article/Get-to-Know-the-Stress-Monitor?language=en_US
  publisher: WHOOP Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Existe um artigo oficial "Healthspan: WHOOP Age & Pace of Aging Guide" no suporte da WHOOP, confirmando que Healthspan é feature ativa com as métricas WHOOP Age e Pace of Aging; o conteúdo (inputs, cálculo, tier que inclui) não pôde ser lido porque a página do suporte (Salesforce) não renderiza para o crawler.
  source: https://support.whoop.com/s/article/Healthspan-WHOOP-Age-Pace-of-Aging-Guide?language=en_US
  publisher: WHOOP Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature
- claim: A WHOOP oferece um mês de teste gratuito ("Try WHOOP Free for One Month") como porta de entrada para os planos pagos.
  source: https://www.whoop.com/us/en/whoop-trials/
  publisher: WHOOP
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: pricing
- claim: Comparativos de 2026 descrevem o Recovery da WHOOP como "score contra o Strain acumulado" (HRV medida em sono de ondas lentas + RHR + respiratory rate + SpO2 + skin temperature + sono obtido vs. necessário) e o de Oura como "recuperação a partir da HRV noturna" — e concluem que um 80 numa marca não equivale a 80 na outra, porque cada uma pontua contra a própria baseline.
  source: https://www.athletedata.health/guides/whoop-vs-oura-vs-garmin
  publisher: athletedata.health (agregador; baixa qualidade editorial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment

### Oura

- claim: O Oura Membership custa US$ 5,99/mês ou US$ 69,99/ano nos EUA e € 5,99/mês ou € 69,99/ano na União Europeia, com o primeiro mês grátis para novos membros; demais regiões variam.
  source: https://support.ouraring.com/hc/en-us/articles/4409086524819-Oura-Membership
  publisher: Oura Member Care
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: O Readiness Score da Oura (atualizado em 14/07/2026) soma nove contributors — Resting Heart Rate, HRV Balance, Body Temperature, Recovery Index, Sleep, Sleep Balance, Sleep Regularity, Previous Day Activity e Activity Balance — em escala 0–100 com faixas Optimal 85–100, Good 70–84, Fair 60–69 e Pay Attention 0–59.
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: 2026-07-14
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O contributor Resting Heart Rate da Oura compara a menor FC da noite anterior com a média de longo prazo e cai quando o RHR está 3–5 bpm acima ou 10–15 bpm abaixo do habitual; o HRV Balance compara os últimos 14 dias (ponderando os mais recentes) com a média de três meses.
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: 2026-07-14
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Recovery Index da Oura mede quanto tempo de sono ocorre depois que a FC atinge o ponto mais baixo da noite e só é "optimal" com no mínimo seis horas de sono após esse ponto; o Body Temperature compara a variação da temperatura da noite anterior com a média noturna de longo prazo.
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: 2026-07-14
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Sleep Balance avalia quantidade de sono e débito nas últimas duas semanas contra a baseline (referência 7–9 h/noite da AASM); Sleep Regularity mede consistência de horários de dormir/acordar em duas semanas e ignora sonecas; Activity Balance pondera os últimos 14 dias contra dois meses para sinalizar sobrecarga ou subcarga de treino; Previous Day Activity compara atividade e inatividade do dia anterior com médias longas (5–8 h ou menos de inatividade pesa positivo).
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: 2026-07-14
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Symptom Radar da Oura monitora, a partir dos dados de sono, desvios de temperatura corporal média, respiratory rate, resting heart rate, HRV e tempo inativo; vem ligado por padrão para membros ativos e, quando detecta sinal claro de sobrecarga, destaca o aviso na tela Today na manhã seguinte.
  source: https://support.ouraring.com/hc/en-us/articles/35593651188115-Symptom-Radar
  publisher: Oura Member Care
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O Cardiovascular Age da Oura é estimado a partir de características ligadas à idade no sinal de fotopletismografia (PPG) e, após 14 dias de uso do app, indica se o membro está abaixo, acima ou alinhado com a idade cronológica.
  source: https://ouraring.com/blog/heart-health-at-oura/
  publisher: Oura (The Pulse Blog)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Resilience é feature ativa da Oura com artigo próprio no suporte; o conteúdo do cálculo (inputs, janelas) não foi lido nesta rodada.
  source: https://support.ouraring.com/hc/en-us/articles/25358829055251-Resilience
  publisher: Oura Member Care
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature
- claim: Oura publicou no blog um post "From Early Signals to Early Intervention: Introducing Health Radar", indicando um sucessor/expansão do Symptom Radar; data e escopo não verificados nesta rodada.
  source: https://ouraring.com/blog/introducing-health-radar/
  publisher: Oura (The Pulse Blog)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: trajectory
- claim: O blog da Oura lista Oura Advisor, Cardiovascular Age, Symptom Radar e Resilience como parte do pacote atual de "long-term health insights" — o que confirma existência do Oura Advisor (IA), mas nada além do nome foi verificado.
  source: https://ouraring.com/blog/the-oura-difference/
  publisher: Oura (The Pulse Blog)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature

### Athlytic

- claim: O Athlytic custa US$ 4,99/mês ou US$ 29,99/ano, com 7 dias de teste grátis; é um único plano, sem desbloqueio vitalício nem tiers.
  source: https://www.athlyticapp.com/
  publisher: Athlytic (site oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: pricing
- claim: O Athlytic entrega Recovery (0–100%), Exertion (0–10), Target Exertion Zone diária, Sleep (qualidade, débito e consistência), Training Load, Stress, Live Workouts com zonas de FC e Journal com análise de impacto — tudo derivado do Apple Health/HealthKit e processado no aparelho.
  source: https://www.athlyticapp.com/
  publisher: Athlytic (site oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Recovery do Athlytic é calculado durante o sono a partir de HRV e resting heart rate do Apple Watch; o app não exige conta, declara "Data Not Collected" na App Store, é feito por uma empresa de duas pessoas fundada em 2017 e exibe 4,8 estrelas com mais de 10.000 avaliações.
  source: https://www.athlyticapp.com/
  publisher: Athlytic (site oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Uma resenha independente descreve o Recovery do Athlytic como baseado "principalmente" em HRV e RHR noturnos, o que o faz pesar demais o cardio e subestimar fadiga muscular; o Sleep Score "concorda com Garmin e Oura" e o Exertion se comporta como TSS ou Training Effect.
  source: https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch
  publisher: ibikerun (Substack, resenha independente)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment
- claim: A listagem do app na App Store se chama "Athlytic: AI Fitness Coach" (id 1543571755), sinal de reposicionamento em torno de coaching por IA.
  source: https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755
  publisher: Apple App Store
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: trajectory

### Apple Fitness

- claim: O Sleep Score do Apple Watch vai de 0 a 100 e soma três componentes — duração do sono (50 pontos), consistência do horário de dormir (30 pontos, analisando as últimas 13 noites) e interrupções (20 pontos, quantidade e duração dos períodos acordado) — com faixas Very Low 0–40, Low 41–60, OK 61–80, High 81–95 e Very High 96+; o guia não menciona uso de HRV ou FC no score.
  source: https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Training Load do Apple Watch compara intensidade × duração dos treinos dos últimos 7 dias com os 28 dias anteriores e classifica de "well below" a "well above"; o usuário pode editar o esforço ("Rate your effort") de cada treino; o guia existe nas versões watchOS 11 e watchOS 26 e liga para os Vitals noturnos na base da tela.
  source: https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O app Vitals do Apple Watch estabelece uma faixa típica por métrica coletada durante o sono e notifica quando várias métricas saem da faixa, com contexto de fatores possíveis (medicação, mudança de altitude, doença).
  source: https://support.apple.com/guide/watch/vitals-apd15aa7ed96/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: O app Sleep do Apple Watch mostra, além do score, o tempo em cada estágio de sono, o total da última noite e a média dos últimos 14 dias — tudo em apps embarcados no relógio, sem assinatura mencionada nos guias.
  source: https://support.apple.com/guide/watch/track-your-sleep-apd830528336/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature

### Computável a partir do HealthKit

- claim: O Athlytic é a prova de existência de que Recovery (HRV + RHR do sono), Exertion/Training Load (treinos + FC), Sleep (duração, débito, consistência) e Stress podem ser computados só com dados do HealthKit, sem sensor proprietário.
  source: https://www.athlyticapp.com/
  publisher: Athlytic (site oficial)
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Dos nove contributors do Readiness da Oura, sete dependem só de RHR, HRV, totais de sono, regularidade de horários e atividade — todos disponíveis em dados tipo HealthKit; Body Temperature exige sensor de temperatura noturna e Recovery Index exige a curva de FC ao longo da noite (amostras de FC durante o sono), não apenas o RHR agregado.
  source: https://support.ouraring.com/hc/en-us/articles/360057791533-Readiness-Contributors
  publisher: Oura Member Care
  pub_date: 2026-07-14
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Training Load da Apple é essencialmente uma razão de carga aguda (7 dias) sobre crônica (28 dias) com esforço editável por treino — replicável a partir de treinos sincronizados mais um rating de esforço do usuário.
  source: https://support.apple.com/guide/watch/track-your-training-load-apde4c07a6cf/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Sleep Score da Apple usa só duração, consistência de horário (13 noites) e interrupções — três sinais que qualquer fonte de sono com início/fim/acordado fornece; não precisa de estágios nem de HRV.
  source: https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos
  publisher: Apple Support
  pub_date: undated
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O Stress Monitor da WHOOP depende de HRV contínua durante o dia em períodos parados (comparada à baseline de 14 dias) e o Recovery da WHOOP usa SpO2 e skin temperature — sinais contínuos de hardware dedicado; a versão diurna do Stress não é replicável com HRV esparsa, enquanto o Symptom Radar da Oura (desvio noturno de RHR, HRV, respiratory rate, temperatura e inatividade vs. baseline) é replicável na medida em que a fonte grave essas séries noturnas.
  source: https://support.whoop.com/s/article/Get-to-Know-the-Stress-Monitor?language=en_US
  publisher: WHOOP Support + Oura Member Care (https://support.ouraring.com/hc/en-us/articles/35593651188115-Symptom-Radar)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature

## Leads
- Contradição resolvida por recência: o blog da Oura e resumos antigos falam em "sete" Readiness Contributors; a página de suporte atualizada em 14/07/2026 lista nove (Resting Heart Rate e Activity Balance entram). Usar nove.
- Nova entidade Oura: "Health Radar" (post "From Early Signals to Early Intervention: Introducing Health Radar") — parece expansão do Symptom Radar; data e escopo a confirmar (candidato a lançamento dos últimos 6 meses).
- WHOOP: o artigo "Healthspan: WHOOP Age & Pace of Aging Guide" existe, mas o suporte da WHOOP (Salesforce) e o whoop.com (403) não renderizam para o crawler. Follow-up: tentar o espelho Zendesk `support.whoop.com/hc/en-us/articles/...` (aparece nos resultados) ou a cobertura de DC Rainmaker sobre WHOOP 5.0/MG para hardware, Whoop Coach e o que cada tier inclui.
- WHOOP mantém API pública documentada (developer.whoop.com/docs/whoop-101) — não é escopo desta decisão ("replicar análise, não puxar dado"), mas é caminho de ingestão futura.
- Athlytic se rebatizou na App Store como "Athlytic: AI Fitness Coach" — indica que até o app indie de HealthKit está entrando em coaching por IA; vale checar release notes da App Store para datar.
- Apple: os guias de Training Load existem em watchOS 11 e watchOS 26 — vale confirmar no guia do watchOS 26 se houve mudança nos inputs (esforço estimado automaticamente em cardio vs. manual) e se o Sleep Score estreou no watchOS 26.
- Sentimento: reddit.com bloqueia o crawler (erro 400 em ambas as tentativas). Rodada de sentimento precisa de fontes alternativas: Tom's Guide "Whoop vs Oura" (tomsguide.com/wellness/sleep-tech/whoop-vs-oura-...), fóruns da Garmin/intervals.icu, Hacker News, avaliações da App Store do Athlytic.
- Validação (DC Rainmaker, The Quantified Scientist) não foi consultada nesta rodada por orçamento — necessária para calibrar confiança nos scores de Recovery/Readiness antes de copiar a lógica.

## Looked for and could not find
- Preços e inclusões por tier da WHOOP lidos diretamente da página oficial (403); hardware WHOOP 5.0 / MG (ECG, pressão arterial, Advanced Labs) e qual tier inclui o quê.
- WHOOP Coach (IA), Sleep Performance e quantos dias formam a baseline de HRV do Recovery — nenhuma página oficial legível.
- Detalhes de cálculo de Healthspan / WHOOP Age / Pace of Aging.
- Oura Resilience (inputs e faixas), Oura Advisor (o que faz, se está incluso no membership), cycle insights e a lista datada de lançamentos dos últimos 6 meses (changelog).
- Data de publicação de quase todas as páginas oficiais (só a de Readiness Contributors traz "Last Updated").
- Athlytic: VO2max e HRV baseline não aparecem como features nomeadas no site oficial (o site fala em "HRV & Resting Heart Rate" e Recovery); confirmação pela App Store não feita.
- Apple: requisito mínimo de watchOS/modelo para Sleep Score e Training Load; lista de métricas do Vitals (FC, respiração, temperatura de pulso, SpO2, duração do sono) lida da página; se o Training Load estima esforço automaticamente em treinos cardio.
- Sentimento de usuários em r/whoop, r/ouraring, r/AppleWatch dos últimos 12 meses (crawler bloqueado); nenhuma citação de sentimento sobre Apple Sleep Score/Training Load.
- Validação independente (DC Rainmaker, The Quantified Scientist) dos scores de recuperação.
