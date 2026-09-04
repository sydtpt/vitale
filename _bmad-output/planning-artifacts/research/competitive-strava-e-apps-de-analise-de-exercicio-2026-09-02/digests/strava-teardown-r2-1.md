---
dimension: strava-teardown
round: 2
assistant: 1
accessed: 2026-09-03
---
## Verification
- id: V1
  outcome: verified
  evidence: Guia independente atualizado em 2026-05 confirma que no plano gratuito ficam só gravação, sensores, Beacon, social e leaderboard de segmento limitado ao top 10, enquanto Live Segments, planejamento/geração de rotas e "fitness progress tracking over time" são de assinante; cobre ~5 dos 12 itens da lista e não contradiz nenhum (Wareable, sem data, acrescenta Fitness & Freshness, leaderboards filtrados, Performance Predictions, mapas offline e Group Challenges como pagos). Cobertura independente é parcial: Matched Activities, GAP, zonas de FC custom, Workout Analysis, Custom Goals, heatmap pessoal e clima não foram confirmados fora da Strava nesta rodada.
  source: https://biketips.com/strava-free-vs-paid/
  publisher: BikeTips
  pub_date: 2026-05-06
  accessed: 2026-09-03
- id: V2
  outcome: verified
  evidence: Blog independente (2026-05-09) afirma "Athlete Intelligence is Strava's AI layer, available to Strava Premium subscribers", descreve-o como resumo em linguagem natural por atividade e o classifica como "descriptive (it explains your past)" em oposição a um coach "prescriptive"; os sub-itens "só mobile" e botão "Say More" NÃO foram confirmados por fonte independente (TechRadar não pôde ser lido — conteúdo truncado).
  source: https://therunninggenie.com/blog/strava-athlete-intelligence-vs-ai-coaches
  publisher: The Running Genie
  pub_date: 2026-05-09
  accessed: 2026-09-03
- id: V3
  outcome: disputed
  evidence: A página primária confirma €10.99/mês, €69.99/ano, Family €119.99/ano e Strava + Runna €149.99/ano vigentes desde 2025-07-01, mas o rodapé lista 30 países (Áustria a Suécia, incluindo Islândia, Liechtenstein e Noruega), não 23; nenhuma fonte independente confirmou a harmonização — o BikeTips (atualizado 2026-05-06) ainda publica "EU €7.99 to €10.99/month" (faixa pré-harmonização, provavelmente desatualizada) e o Cyclingnews cobre só a polêmica de 2023. Nenhum aumento posterior a 2025-07-01 foi encontrado, o que é consistente com "sem aumento nos últimos 12 meses". Atenção: o Family nos EUA é US$139.99/ano, diferente dos €119.99 europeus.
  source: https://www.strava.com/pricing
  publisher: Strava (primária; independente não encontrada)
  pub_date: undated (vigência declarada 2025-07-01)
  accessed: 2026-09-03
- id: V4
  outcome: verified
  evidence: Publicação independente (NUA Coach, 2026-06-10) confirma: "On June 1st, 2026, Strava launched ... an official connector that lets Claude — Anthropic's AI — read your training history", exigindo "a paid Strava subscription", com acesso "read-only" e uso no Claude web e desktop; o press release da Strava do mesmo dia bate em data e elegibilidade ("available to all Strava subscribers").
  source: https://nua.coach/en/learn/strava-mcp-claude
  publisher: NUA Coach
  pub_date: 2026-06-10
  accessed: 2026-09-03

## Claims
- claim: O MCP Connector da Strava expõe dados de stream completos (frequência cardíaca e ritmo por segundo), GPS para análise geográfica, potência em ciclismo e dados de clubes e eventos, em modo somente leitura, escopado à conta do atleta e revogável nas configurações da Strava.
  source: https://press.strava.com/articles/strava-launches-mcp-connector
  publisher: Strava Press
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O MCP Connector é "available to all Strava subscribers" e o press release cita apenas Claude como cliente MCP; nenhum outro cliente (ChatGPT, Gemini, Cursor) é mencionado nem no press release nem na cobertura independente, e não há ângulo de API para desenvolvedores além da justificativa de substituir "unsecure third-party tools".
  source: https://press.strava.com/articles/strava-launches-mcp-connector
  publisher: Strava Press
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: terms
- claim: Segundo a Strava, a motivação do MCP Connector é demanda dos atletas por análise dos próprios dados — Ryan Dixon (VP of Partnerships & Developer Relations): "Athletes have been telling us, in increasingly creative ways, that they want more ways to analyze their own training data."
  source: https://press.strava.com/articles/strava-launches-mcp-connector
  publisher: Strava Press
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: high
  class: trajectory
- claim: A cobertura independente do MCP Connector avalia a análise como "spectacular" mas conclui que "it's still not a coach": não há proatividade ("Claude waits for your prompt. It won't text you on Monday with your week planned"), não mantém plano vivo e a metodologia é inconsistente entre conversas.
  source: https://nua.coach/en/learn/strava-mcp-claude
  publisher: NUA Coach
  pub_date: 2026-06-10
  accessed: 2026-09-03
  confidence: medium
  class: sentiment
- claim: Preço nos EUA, harmonizado por país a partir de 2025-07-01: US$11.99/mês ou US$79.99/ano, Family US$139.99/ano e Strava + Runna US$149.99/ano, mais impostos; a Strava avisa por e-mail 30 dias antes da renovação. (Fonte quase-primária: hub da comunidade Strava via snippet de busca; corroborado por BikeTips 2026-05-06 e The Running Genie 2026-05-09 para US$11.99/US$79.99.)
  source: https://communityhub.strava.com/t5/campfire-chat/subscription-fee-increase/m-p/25821
  publisher: Strava Community Hub
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: Runna continua um app separado com assinatura própria de US$19.99/mês; o blog afirma que "Strava hasn't bundled them yet" em nível de produto, embora a página de preços da Strava já venda um plano "Strava + Runna" (€149.99/ano na Europa, US$149.99/ano nos EUA) — ou seja, existe bundle comercial, não fusão de produto.
  source: https://therunninggenie.com/blog/strava-athlete-intelligence-vs-ai-coaches
  publisher: The Running Genie
  pub_date: 2026-05-09
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: A Strava mantém dois produtos de IA distintos: Athlete Intelligence (descritivo, dentro do app principal, incluso no Premium) e Runna (prescritivo, app e assinatura separados); o Athlete Intelligence resume ritmo, FC, elevação e Relative Effort logo após o upload e detecta tendências numa janela de 30 dias (pace mais rápido, maior distância, maior subida).
  source: https://therunninggenie.com/blog/strava-athlete-intelligence-vs-ai-coaches
  publisher: The Running Genie
  pub_date: 2026-05-09
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Year in Sport 2025 foi, pela primeira vez desde a estreia em 2016, restrito a assinantes; exige a versão mais recente do app, assinatura ativa e pelo menos três atividades em 2025 para gerar o relatório.
  source: https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425
  publisher: road.cc
  pub_date: 2025-12
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: O paywall do Year in Sport gerou reação negativa concentrada no Reddit e foi enquadrado pela imprensa como "Strava follows Garmin", em referência ao Rundown do Garmin Connect+ também pago; a Strava respondeu que "core benefits remain as accessible as possible".
  source: https://gadgetsandwearables.com/2025/12/20/strava-year-in-sport/
  publisher: Gadgets & Wearables (corroborado por Slashdot 2025-12-19 e road.cc)
  pub_date: 2025-12-20
  accessed: 2026-09-03
  confidence: high
  class: sentiment
- claim: No plano gratuito ficam visíveis apenas os 10 primeiros do leaderboard de cada segmento; leaderboards completos e filtrados são de assinante, e Live Segments (corrida contra o PR em tempo real) é exclusivo de assinante.
  source: https://biketips.com/strava-free-vs-paid/
  publisher: BikeTips
  pub_date: 2026-05-06
  accessed: 2026-09-03
  confidence: high
  class: feature
- claim: Local Legends aparece no plano gratuito ao menos para visualização ("KOM/QOM and Local Legend records" listados entre as funções free), assim como Beacon (localização ao vivo), conexão de sensores de FC/potência e integrações Garmin/Wahoo/Fitbit; já criação e geração automática de rotas circulares são de assinante.
  source: https://biketips.com/strava-free-vs-paid/
  publisher: BikeTips
  pub_date: 2026-05-06
  accessed: 2026-09-03
  confidence: medium
  class: feature
- claim: Group Challenges migraram para o Premium em agosto de 2024, e Performance Predictions e mapas offline são listados como pagos junto com Fitness & Freshness e leaderboards filtrados.
  source: https://www.wareable.com/sport/is-strava-premium-worth-it
  publisher: Wareable
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature
- claim: A página de preços da Strava para a Europa não enumera funcionalidades por plano — só preços e a nota de vigência; portanto o que "Training Plans" entrega ao assinante não é inferível dessa página.
  source: https://www.strava.com/pricing
  publisher: Strava
  pub_date: undated
  accessed: 2026-09-03
  confidence: medium
  class: terms

## Leads
- L1 continua aberto para Global Heatmap, Flyby, Flyover/3D, Perceived Exertion, Quick Edit e pace zones: buscar os artigos individuais do Help Center (support.strava.com) ou o guia do Wareable completo.
- L2: confirmar se o MCP Connector também roda no Claude Code e em clientes não-Anthropic — o Help Center "Strava MCP Connector" (support.strava.com/en-us/articles/15401531) e a página appsforstrava.com/mcp mencionam Claude Code; verificar ali e num teste real.
- L3: obter o preço USD numa fonte primária legível — a App Store devolveu HTTP 429; tentar de novo ou o press release "Clarifying Subscription Pricing Confusion" (press.strava.com).
- L4: o que o item "Training Plans" do assinante entrega hoje (planos estáticos antigos? Runna embutido?) — nenhuma fonte lida descreve; buscar Help Center "Training Plans" e cobertura DC Rainmaker da aquisição da Runna.
- L5: cartões de estatística mensal — não apareceram nas notícias do paywall do Year in Sport; checar Help Center "Monthly Stats" / "Progress" e Reddit r/Strava dez-2025.
- L5: Best Efforts de corrida — confirmar se ainda há porção gratuita (fonte independente).
- L6: The Breakaway — nenhuma menção no press release do MCP nem nas fontes lidas; buscar "Breakaway Strava" em DC Rainmaker e no Help Center.
- V3: reconciliar "23 países" da rodada 1 com os 30 listados hoje na página de preços (a lista pode ter mudado ou a rodada 1 contou errado); buscar cobertura independente da harmonização de 2025-07-01 (road.cc, DC Rainmaker, Reddit).
- Recorrência de marketing/análise: a ida do Year in Sport para o paywall e o MCP para assinantes sugerem que "retrospectiva agregada" e "acesso conversacional aos próprios dados" são hoje os diferenciais que a Strava cobra — vale checar se Garmin/Apple mantêm equivalentes gratuitos.

## Looked for and could not find
- Confirmação independente de que Athlete Intelligence é só mobile e de que existe o botão "Say More" (TechRadar não pôde ser lido; The Running Genie não menciona plataforma nem botão).
- Cobertura independente (DC Rainmaker, road.cc, Cycling Weekly) da harmonização de preços de 2025-07-01 na Europa; só a página primária da Strava foi lida.
- Preço USD em página primária legível (App Store 429; strava.com/pricing serviu preços em EUR mesmo ao fetcher).
- Status free/pago de Global Heatmap, Flyby, Flyover, Perceived Exertion, Quick Edit e pace zones (nenhuma fonte lida cobre).
- Conteúdo do item "Training Plans" para assinantes.
- Se os cartões de estatística mensal foram para o paywall junto com Year in Sport.
- Se Best Efforts de corrida mantém porção gratuita.
- Qualquer aparição de The Breakaway dentro do produto Strava (não pesquisado por falta de orçamento; ausente do press release do MCP).
- Lista oficial de clientes MCP suportados além de Claude web/desktop.
