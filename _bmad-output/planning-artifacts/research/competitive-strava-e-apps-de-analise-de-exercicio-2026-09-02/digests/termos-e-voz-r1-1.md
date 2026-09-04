---
dimension: termos-e-voz
round: 1
assistant: 1
accessed: 2026-09-03
---
## Claims

### Termos da API

- claim: A versão vigente do Strava API Agreement traz "Effective Date: June 1, 2026" no topo da página — é essa a versão que governa hoje, não a de novembro de 2024.
  source: https://www.strava.com/legal/api
  publisher: Strava (legal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: O destaque nº 4 do agreement vigente diz, verbatim: "Strava Data provided by a specific user can only be displayed or disclosed in your Developer Application to that user." — um app de um único atleta que só mostra os dados dele ao próprio satisfaz essa cláusula por construção.
  source: https://www.strava.com/legal/api
  publisher: Strava (legal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: O destaque nº 2 do agreement vigente diz, verbatim: "You may not create applications that compete with or replicate Strava functionality." — é a única cláusula anti-replicação que consegui ler no texto de 2026; não há definição do que conta como "replicate".
  source: https://www.strava.com/legal/api
  publisher: Strava (legal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: O agreement vigente não traz números de rate limit — só o destaque nº 5: "Your use of the Strava API is subject to volume limits and other use restrictions."; o texto também não contém as expressões "single user" nem "non-commercial" (duas passagens de busca no texto retornaram NOT FOUND), ou seja, não existe isenção explícita para app pessoal.
  source: https://www.strava.com/legal/api
  publisher: Strava (legal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: medium
  class: terms

- claim: CRENÇA NÃO VERIFICADA — em duas leituras automatizadas do texto de 2026-06-01 as expressões "artificial intelligence", "machine learning" e "look and feel" NÃO foram encontradas; como Strava afirmou em 2024-11 que essas cláusulas existiam, ou o extrator falhou ou o texto foi reescrito na versão de junho de 2026. Tratar a cláusula anti-IA como provavelmente vigente até leitura humana do texto completo.
  source: https://www.strava.com/legal/api
  publisher: Strava (legal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: low
  class: terms

- claim: A nota oficial de Strava (publicada 2024-11-15, atualizada 2024-11-19) diz que o agreement atualizado "went into effect on November 11" e lista três mudanças: (1) "Third-party apps may now only display a user's Strava activity data to that specific user."; (2) "Our terms now explicitly prohibit third parties from using any data obtained via Strava's API in artificial intelligence models or similar applications."; (3) "Additional terms have been added to protect Strava's unique look and feel and functionality, helping users easily distinguish between Strava and third-party platforms." — nota: o brief presumia vigência em 2024-11-15; a fonte primária diz 11 de novembro.
  source: https://press.strava.com/articles/updates-to-stravas-api-agreement
  publisher: Strava (press)
  pub_date: 2024-11-15
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: Na mesma nota, Strava afirma que as mudanças afetam "less than .1%" dos apps e que continuam permitidos "coaching platforms focused on providing feedback to users and tools that help users understand their data and performance" — é a frase oficial mais próxima de uma autorização para análise pessoal de dados.
  source: https://press.strava.com/articles/updates-to-stravas-api-agreement
  publisher: Strava (press)
  pub_date: 2024-11-19
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: DC Rainmaker (2024-11-19) cita a cláusula anti-IA da versão de 2024 verbatim: "You may not use the Strava API Materials (including Strava Data), directly or indirectly, for any model training related to artificial intelligence, machine learning or similar applications." — proíbe treinar modelos; não proíbe cálculo determinístico (médias móveis, PRs, heatmaps) por si só.
  source: https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: DC Rainmaker
  pub_date: 2024-11-19
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: DC Rainmaker lê a cláusula de 2024 que veda processar Strava Data para "analytics, analyses, customer insights generation, and products or services improvements" como abrangente o bastante para proibir resumo de quilometragem semanal, comparação de um treino com o histórico e heatmaps; nomeia Final Surge, Xert, Intervals.icu, VeloViewer, TrainerRoad e Relive como afetados, e observa que o esclarecimento de Strava de 19/11 contradiz o texto legal, que não mudou.
  source: https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: DC Rainmaker
  pub_date: 2024-11-19
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: O artigo de suporte de Strava sobre a atualização de 2024 resume a terceira mudança como "Restricted Processing: Apps can't process or disclose Strava Data for the purposes of analytics, analyses, customer insights generation, and products or services improvements" (visto só em snippet de busca; página não aberta nesta rodada).
  source: https://support.strava.com/hc/en-us/articles/31798729397773-API-Agreement-Update-How-Data-Appears-on-3rd-Party-Apps
  publisher: Strava (support)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: terms

- claim: Em 2026-06-01 Strava publicou "An Update To Our Developer Program": dois tiers — Standard (até 10 atletas, rate limits maiores que antes, todo app atual e futuro cai nele automaticamente) e Extended Access (mais usuários, suporte priorizado, elegível ao Partner API, exige candidatura, sem exigência de assinatura).
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: terms

- claim: Desde 2026-06-01 um desenvolvedor novo no tier Standard precisa manter uma assinatura Strava ativa para usar a API; desenvolvedores existentes tiveram até 2026-06-30, e os elegíveis ganharam "3-months free" — para um app pessoal isso converte o acesso à API num custo recorrente igual ao da assinatura (US$ 11,99/mês ou US$ 79,99/ano segundo a imprensa).
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: pricing

- claim: Em 2026-09-01 foram aposentados os endpoints Club Activities, Club Administrators e Club Members, e Segments Explore passou a ser acessível só a apps Extended Access aprovados com caso de uso qualificado — endpoints de segment efforts dentro da própria atividade não são citados como afetados.
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: trajectory

- claim: Com efeito em 2027-06-01: token de autorização obrigatório no header (não mais em form parameter), base URL muda de https://www.strava.com/api/v3 para https://www.api-v3.strava.com, e oauth/deauthorize é aposentado em favor de oauth/revoke.
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: trajectory

- claim: O mesmo post restringe, desde 2026-06-01, o acesso de "third-party intermediary platforms" (agregadores que repassam dados Strava a outros apps) e afirma que download dos próprios dados continua gratuito e integrações com relógios/dispositivos não mudam.
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: medium
  class: terms

- claim: Strava lançou um MCP oficial "for personal data analysis", incluído na assinatura — sinal de que Strava trata análise pessoal dos próprios dados como uso legítimo e, ao mesmo tempo, como algo que ela própria quer monetizar.
  source: https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
  publisher: Strava Community Hub (Insider Journal)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: trajectory

- claim: Resposta à pergunta 3 (síntese, parcialmente crença não verificada): um app de um único atleta que mostra só a ele fitness/fadiga, PRs, segment efforts e heatmaps calculados sobre as próprias atividades atende ao destaque nº 4 e cabe na frase oficial "tools that help users understand their data and performance"; o risco residual está no destaque nº 2 ("compete with or replicate Strava functionality") e na proteção de "look and feel" — reproduzir a aparência dos gráficos/heatmaps de Strava é zona cinzenta; reproduzir a análise com apresentação própria é o que a própria Strava disse continuar permitido.
  source: https://www.strava.com/legal/api
  publisher: Strava (legal) + Strava (press)
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: medium
  class: terms

- claim: Cobertura independente enquadrou a mudança de 2024 como hostil a apps ("Strava's Big Changes Aim To Kill Off Apps", DC Rainmaker; "Strava Pulls the Plug on their API", Terra; "Strava's new API agreement will destroy the app, users warn", Cybernews) e a de 2026 como preparação para IPO ("Strava Tightens Its API Ahead of an IPO", fórum Slowtwitch) — títulos vistos em busca; só o DCR foi lido.
  source: https://forum.slowtwitch.com/t/strava-tightens-its-api-ahead-of-an-ipo/1298514
  publisher: Slowtwitch / Terra / Cybernews (agregados)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: trajectory

### Voz dos usuários

- claim: Em dezembro de 2025 Strava colocou o "Year in Sport" atrás da assinatura (US$ 79,99/ano) pela primeira vez desde 2016; a reação foi de revolta pública, com usuário citado: "How pathetic does an app need to be to put their 'Year In Review' behind a paywall when EVERYONE ELSE does theirs for free as a thanks for using their app?" (reportagem Ars Technica, replicada em Slashdot/road.cc).
  source: https://news.slashdot.org/story/25/12/19/2158235/strava-puts-popular-year-in-sport-recap-behind-an-80-paywall
  publisher: Ars Technica via Slashdot; road.cc
  pub_date: 2025-12-19
  accessed: 2026-09-03
  confidence: medium
  class: sentiment

- claim: Strava justificou o paywall do Year in Sport dizendo que "core benefits remain as accessible as possible" (road.cc); a crítica recorrente da imprensa é que Strava "has been paywalling its features one piece at a time" (T3, "Dear Strava, we have a paywall problem that's gone a step too far").
  source: https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425
  publisher: road.cc / T3
  pub_date: 2025-12
  accessed: 2026-09-03
  confidence: medium
  class: sentiment

- claim: Preço atual reportado pela imprensa: US$ 11,99/£8,99 por mês ou US$ 79,99/£54,99 por ano, mais um pacote anual Strava+Runna a US$ 149,99/£119,99; a TechRadar resume o humor do mercado no título "Still the best training app for runners and cyclists, but it's getting expensive".
  source: https://www.techradar.com/health-fitness/strava-is-still-the-best-training-app-for-runners-and-cyclists-but-its-getting-expensive
  publisher: TechRadar
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: pricing

- claim: No fórum do intervals.icu (2025-01-30), o usuário Paul_Haynes relata que o Fitness de Strava e o do intervals.icu divergem a ponto de "Not only are the numbers different but the fitness trend line is almost the opposite", apesar de VO2max ter subido de 49 para 53; a resposta explica que Fitness "is a 42 day exponentially weighted moving average of your training load" e que a diferença vem da janela e da base de carga (TSS vs Relative Effort) — sinal de que Fitness & Freshness de Strava é percebido como opaco e pouco confiável por quem compara.
  source: https://forum.intervals.icu/t/intervals-v-strava/88823
  publisher: intervals.icu Forum
  pub_date: 2025-01-30
  accessed: 2026-09-03
  confidence: high
  class: sentiment

- claim: A base de conhecimento da Athletica confirma o mesmo fenômeno de forma neutra: Fitness/Form/Fatigue não batem entre Athletica, intervals.icu e Strava porque cada um usa um modelo de carga diferente (PMC com TSS vs. o de Strava).
  source: https://support.athletica.ai/hc/en-us/articles/32994375773339-Understanding-Fitness-Form-and-Fatigue-Discrepancies-Between-Athletica-Intervals-icu-and-Strava
  publisher: Athletica (support)
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: feature

- claim: Athlete Intelligence (resumo de treino por IA) foi recebido como piada por usuários assíduos: "I do think it is more amusing, but also kind of pointless. It just feels more like a meme than anything right now." (Fortune, 2024-10-11), com usuários no Reddit forçando descrições absurdas para rir das saídas — sentimento com mais de 12 meses, incluído como linha de base, não como estado atual.
  source: https://fortune.com/2024/10/11/strava-app-artificial-intelligence-fitness-athletic-memes
  publisher: Fortune
  pub_date: 2024-10-11
  accessed: 2026-09-03
  confidence: medium
  class: sentiment

- claim: A narrativa "por que uso os dois" aparece no material de terceiros como: Strava para registro social (kudos, feed, segmentos) e intervals.icu para curvas de fitness/fadiga, carga ao longo do tempo, distribuição por zonas e planejamento de treinos estruturados sem assinatura — mas a fonte lida é de um vendedor de ferramenta companheira do intervals.icu (registro de marketing), então vale como hipótese, não como voz de usuário.
  source: https://icusync.icu/resources/strava-vs-trainingpeaks-vs-intervalsicu-which-training-platform-is-right-for-you
  publisher: IcuSync (vendor)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment

- claim: Em fóruns de ciclismo, Golden Cheetah é descrito como "free and powerful, but is a local install and somewhat advanced", e a lista de alternativas gratuitas para análise costuma ser intervals.icu, Elevate e Golden Cheetah (snippets do Bike Forums / LetsRun; threads não abertas).
  source: https://www.bikeforums.net/training-nutrition/1227033-training-program-has-best-analytics.html
  publisher: Bike Forums / LetsRun
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment

- claim: Em thread do fórum TrainerRoad, o desenvolvedor do intervals.icu teria batido nos rate limits de Strava sem opção de upgrade, e a sincronização com Strava virou recurso pago no intervals.icu para reduzir o volume — precedente de como os limites de volume atingem ferramentas de análise mesmo pequenas (snippet; thread não aberta; data não confirmada).
  source: https://www.trainerroad.com/forum/t/intervals-icu-hitting-strava-rate-limits-big-consequences-for-tr-users/81273
  publisher: TrainerRoad Forum
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: trajectory

## Leads

- Conflito de data: o brief presumia vigência em 2024-11-15; a nota oficial de Strava diz que o agreement "went into effect on November 11" e DC Rainmaker fala em 30 dias de aviso. Resolver lendo o artigo de suporte de Strava e, se possível, a versão arquivada do agreement (Wayback, nov/2024).
- Texto integral do agreement de 2026-06-01: as cláusulas anti-IA e de "look and feel" não foram localizadas pelo extrator em duas passagens. Precisa de leitura humana ou diff Wayback (nov/2024 vs jun/2026) para saber se foram mantidas, reescritas ou removidas.
- Nova entidade: MCP oficial de Strava "for personal data analysis", incluído na assinatura. O que expõe? Se Strava passa a vender análise pessoal por IA, a fronteira do "replicate Strava functionality" pode se mover para cima.
- Segments Explore passou a Extended Access em 2026-09-01. Confirmar se o app usa esse endpoint (busca de segmentos por área) ou só os segment_efforts embutidos no detalhe da atividade, que não foram citados como afetados.
- Restrição a "intermediary platforms" desde 2026-06-01: o app também sincroniza pelo intervals.icu. Se dados de origem Strava chegam via intervals.icu, verificar se o intervals.icu mudou algo (o blog da Terra sugere que agregadores foram o alvo).
- Custo: desde 2026-06 manter o acesso Standard à API exige assinatura Strava do desenvolvedor. Para um app pessoal isso é um custo fixo anual (US$ 79,99 se pago anual) — entra no cálculo de "vale a pena continuar puxando de Strava vs. só de Apple Health/intervals.icu".
- Mudanças técnicas com prazo 2027-06-01 (token no header, nova base URL api-v3.strava.com, oauth/revoke) — item de manutenção da sincronização, não de roadmap de análise.
- Tom's Guide publicou "the app just reversed a hugely unpopular decision" — não consegui ler qual decisão; possivelmente o Year in Sport. Confirmar em outro veículo.
- Voz de usuário ficou rasa: o thread "Is intervals.icu + free strava a viable alternative to premium strava?" (Weight Weenies) devolveu 403 e o do intervals.icu era de troubleshooting. Próxima rodada: r/Strava ("is premium worth it" 2026), Strava Community Hub (Ideas sobre Fitness & Freshness / Best Efforts), avaliações 1–3 estrelas via agregador de reviews, fórum Runalyze e GitHub do Golden Cheetah sobre a mudança de junho de 2026.
- Hipótese para testar: o motivo declarado mais forte para assinar continua sendo segmentos/leaderboards e Route Builder (features sociais e de mapa), não a análise; se confirmado, o espaço de diferenciação de um app pessoal é justamente a análise que Strava faz mal (Fitness & Freshness opaco, Relative Effort não comparável entre apps).

## Looked for and could not find

- Isenção explícita para app pessoal / single-user / non-commercial no agreement vigente — não existe no texto lido; o único abrigo é a frase oficial de nov/2024 sobre "tools that help users understand their data and performance".
- Números de rate limit por tier (Standard vs Extended Access) — o post oficial diz apenas "higher rate limits"; a página legal diz apenas "volume limits".
- Texto verbatim da cláusula de "look and feel" — nem DC Rainmaker nem a página de 2026 forneceram a redação.
- Reações datadas de Runalyze, Golden Cheetah, VeloViewer e Statshunters ao programa de desenvolvedores de junho de 2026 — não recuperadas nesta rodada.
- Avaliações 1–3 estrelas de App Store / Google Play dos últimos 12 meses — não lidas (sem fonte aberta nesta rodada).
- Reações de usuários a paywalls de Segments, Route Builder e Best Efforts nos últimos 12 meses — só apareceu o histórico de 2020 (the5krunner), fora da janela de frescor.
- Threads de Reddit (r/Strava, r/running, r/cycling) sobre o que justifica a assinatura — as buscas devolveram imprensa, não threads; nenhum fio de Reddit foi aberto.
