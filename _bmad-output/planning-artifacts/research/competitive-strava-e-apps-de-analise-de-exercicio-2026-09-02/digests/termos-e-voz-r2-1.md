---
dimension: termos-e-voz
round: 2
assistant: 1
accessed: 2026-09-03
---
## Verification
- id: V1
  outcome: verified
  evidence: A data "Effective Date: June 1, 2026" é confirmada de forma independente pela issue #53 do strava-mcp (aberta em 2026-06-01, citando o post do Community Hub, TechCrunch e Neowin) e por snippets de Notebookcheck/BigGo; as duas frases-destaque ("Strava Data provided by a specific user can only be displayed or disclosed in your Developer Application to that user" e "You may not create applications that compete with or replicate Strava functionality") foram reconfirmadas letra por letra nesta rodada, mas apenas no texto primário (strava.com/legal/api) — nenhum publisher independente as citou verbatim, então a independência é parcial (data sim, redação da cláusula não).
  source: https://github.com/r-huijts/strava-mcp/issues/53 (data) · https://www.strava.com/legal/api (redação, primário)
  publisher: GitHub (r-huijts/strava-mcp) · Strava
  pub_date: 2026-06-01 · 2026-06-01
  accessed: 2026-09-03
- id: V2
  outcome: verified
  evidence: A issue #53 do strava-mcp (fonte independente, desenvolvedor de ferramenta open-source) lista exatamente: Standard Tier passa a exigir assinatura Strava (novos devs em 2026-06-01, devs existentes em 2026-06-30); em 2026-09-01 `segments/explore` fica restrito ao Extended Access tier e `/clubs/{id}/activities`, `/admins`, `/members` são descontinuados; até 2027-06-01 tornam-se obrigatórios base URL `https://www.api-v3.strava.com`, token no header (`Authorization: Bearer`) e `oauth/revoke` no lugar de `oauth/deauthorize`; o fórum do intervals.icu (Julian_Flieller, 2026-06-02) confirma "A flat subscription for around $11.99/month" e "3-months free" até 2026-06-30. O teto de "até 10 atletas" do Standard tier NÃO apareceu em nenhuma fonte independente lida — fica não verificado nesse detalhe.
  source: https://github.com/r-huijts/strava-mcp/issues/53 · https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240
  publisher: GitHub (r-huijts/strava-mcp) · Intervals.icu Forum
  pub_date: 2026-06-01 · 2026-06-01 a 2026-06-04
  accessed: 2026-09-03
- id: V3
  outcome: disputed
  evidence: DC Rainmaker (2024-11-19) confirma que a Strava afirmou que "coaching platforms focused on providing feedback to users and tools that help users understand their data" continuam permitidos, mas argumenta que uma cláusula ampla do mesmo texto ("You may not process or disclose Strava Data...for analytics") contradiz essa promessa na prática; o artigo não fixa 11 nem 15 de novembro (fala em vigência "almost immediately" com aviso de 30 dias aos parceiros); a data 2024-11-11 apareceu só em snippet de busca (Marathon Handbook/Cybernews, ecoando o press release). Ou seja: a permissão existe na palavra da Strava, mas um publisher independente a considera contraditória — registrado como disputa de interpretação, não de fato.
  source: https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: DC Rainmaker
  pub_date: 2024-11-19
  accessed: 2026-09-03
- id: V4
  outcome: verified
  evidence: O blog da Tredict (ferramenta de análise concorrente, fonte independente, 2026-06-05) descreve o Strava MCP server como "exclusive to Strava subscribers, currently only available through Claude, and the rollout is still being done in stages" e "read-only. Data can be queried but not modified"; a Garmin Rumors titula "Strava Now Lets Subscribers Analyze Training Data With Claude AI" (snippet). Existência e restrição a assinantes confirmadas; escopo não pesquisado (a cargo de outro assistente).
  source: https://www.tredict.com/blog/strava_mcp_server/
  publisher: Tredict (blog)
  pub_date: 2026-06-05
  accessed: 2026-09-03

## Claims

### Termos da API
- claim: No texto vigente do API Agreement (Effective Date 2026-06-01), a extração desta rodada NÃO encontrou nenhuma frase sobre artificial intelligence, machine learning ou model training — a cláusula de nov/2024 citada por DC Rainmaker ("You may not use the Strava API Materials (including Strava Data), directly or indirectly, for any model training related to artificial intelligence, machine learning or similar applications") não aparece na leitura do texto atual; como o Wayback estava bloqueado e a extração foi feita por modelo pequeno, tratar como indício forte a reconfirmar com leitura integral.
  source: https://www.strava.com/legal/api · https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: Strava · DC Rainmaker
  pub_date: 2026-06-01 · 2024-11-19
  accessed: 2026-09-03
  confidence: medium
  class: terms
- claim: A cláusula de "look and feel" de nov/2024 (DC Rainmaker: apps "not allowed to replicate Strava's 'distinctive look and feel'") não foi encontrada com essa redação no texto de jun/2026; o que existe é a frase mais ampla "You may not create applications that compete with or replicate Strava functionality" — ou seja, a proibição migrou de aparência para funcionalidade.
  source: https://www.strava.com/legal/api · https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: Strava · DC Rainmaker
  pub_date: 2026-06-01 · 2024-11-19
  accessed: 2026-09-03
  confidence: medium
  class: terms
- claim: O API Agreement de jun/2026 não contém nenhuma isenção ou definição para uso pessoal, single-user, hobby ou não comercial, nem define tiers ou tetos de atletas — essas regras vivem fora do contrato, nos posts do Developer Program; para um app de um único atleta a única brecha textual é a frase "can only be displayed or disclosed in your Developer Application to that user", que é satisfeita por construção quando o dev é o próprio usuário.
  source: https://www.strava.com/legal/api
  publisher: Strava
  pub_date: 2026-06-01
  accessed: 2026-09-03
  confidence: medium
  class: terms
- claim: Em nov/2024 a restrição de exibição tinha a redação "you may not disclose such data to, or use it for, another user nor any other third party" e convivia com a cláusula "You may not process or disclose Strava Data...for analytics", que DC Rainmaker apontou como contraditória com a promessa de que "tools that help users understand their data" seguiam permitidos; apps listados como quebrados à época: Intervals.icu, Final Surge, Xert, TrainerRoad, VeloViewer e plataformas de coaching (baseline histórico, não estado atual).
  source: https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html
  publisher: DC Rainmaker
  pub_date: 2024-11-19
  accessed: 2026-09-03
  confidence: high
  class: terms
- claim: A linguagem oficial da Strava sobre intermediários é "Apps routing Strava data through third-party intermediary platforms are no longer supported", com o complemento "Direct integrations are not impacted"; ninguém no fórum do intervals.icu conseguiu definir o que conta como intermediário — giventotri (2026-06-01 15:51): "I have no idea what this means and it's vague enough to mean anything. What counts as an 'intermediary platform'?" — e nem intervals.icu (David Tinker não respondeu à pergunta "@david any idea if these changes affect you?") nem Terra se pronunciaram nas fontes lidas.
  source: https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240 · https://github.com/r-huijts/strava-mcp/issues/53
  publisher: Intervals.icu Forum · GitHub (r-huijts/strava-mcp)
  pub_date: 2026-06-01 a 2026-06-04 · 2026-06-01
  accessed: 2026-09-03
  confidence: medium
  class: terms
- claim: A assinatura exigida do desenvolvedor é a assinatura comum da Strava (US$ 11,99/mês nos EUA, varia por país), com 3 meses grátis para devs existentes e prazo 2026-06-30; integrações de wearables (Garmin, Amazfit) foram declaradas não afetadas (este último ponto só em snippet de busca).
  source: https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240 · https://www.notebookcheck.net/Strava-just-pulled-a-Reddit-on-its-developer-community.1312468.0.html
  publisher: Intervals.icu Forum · Notebookcheck
  pub_date: 2026-06-02 · 2026-06 (snippet, undated)
  accessed: 2026-09-03
  confidence: medium
  class: pricing
- claim: A justificativa pública da Strava para o programa de jun/2026 é abuso da API — "developer applications jumping 448% year-to-date, driven by AI companies scraping data" — e a imprensa enquadra como preparação para IPO (TechCrunch: "Strava declares war on scrapers ahead of IPO"); número não auditável, ecoado por vários domínios a partir de uma única fonte upstream.
  source: https://github.com/r-huijts/strava-mcp/issues/53 · https://appsforstrava.com/blog/strava-developer-program-changes-2026
  publisher: GitHub (r-huijts/strava-mcp) · Apps for Strava
  pub_date: 2026-06-01 · 2026-06 (snippet, undated)
  accessed: 2026-09-03
  confidence: low
  class: trajectory
- claim: Reações de ferramentas terceiras ao programa de jun/2026 documentadas no fórum do intervals.icu: OpenRowingMonitor (Jaap_van_Ekris) "going to abandon Strava"; Avitu (Maarten_Aerts) "drop Strava after the grace period"; Incyclist (Gegfi) indeciso e frustrado com a assinatura forçada; BreakAway: Indoor Cycling (app4g) sinaliza fim do upload direto; nenhuma menção a Runalyze, Golden Cheetah, VeloViewer, Statshunters ou Terra; Tredict lê o MCP como a Strava "significantly restricting third-party access via the regular API and positioning its own MCP as a controlled, secured channel".
  source: https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240 · https://www.tredict.com/blog/strava_mcp_server/
  publisher: Intervals.icu Forum · Tredict (blog)
  pub_date: 2026-06-01 a 2026-06-04 · 2026-06-05
  accessed: 2026-09-03
  confidence: medium
  class: trajectory
- claim: Em 2026-09-03 o fórum de desenvolvedores do Community Hub mostra, nas últimas 24h, pelo menos três pedidos de aumento de capacidade de atletas negados ou sem resposta ("Athlete capacity increase rejected with no specific feedback", 2 kudos; "Failed application for increased rate limits and/or athlete capacity", 1 kudo) e dúvidas pós-remoção dos endpoints de clube ("Clarification needed: How to handle API access for a club with ~80 athletes") — sinal de que o Standard Tier+ está sendo concedido com parcimônia.
  source: https://communityhub.strava.com/t5/ideas/idb-p/feature-suggestions/label-name/fitness%20&%20freshness (redirecionou para o fórum de devs)
  publisher: Strava Community Hub
  pub_date: 2026-09-02 a 2026-09-03
  accessed: 2026-09-03
  confidence: medium
  class: trajectory
- claim: Desde as restrições de nov/2024 o intervals.icu não pode mostrar a seguidores atividades vindas da API da Strava (coaches podem), e um MCP server de coach via API do intervals.icu não enxerga atividades importadas da Strava — resposta oficial no fórum: "Strava API forbids data forwarding" (snippet de busca; thread não lida).
  source: https://forum.intervals.icu/t/solved-mcp-server-for-coaches-via-api-do-not-see-athletes-activities-brought-from-strava-ans-strava-api-forbids-data-fowarding/113828
  publisher: Intervals.icu Forum
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: terms
- claim: A "decisão impopular revertida" do Tom's Guide é o bloqueio de links externos em atividades/posts (introduzido em setembro de 2024 como antispam) — a Strava reativou links após melhorar a detecção de spam e pediu desculpas: "disabling and removing links last September was disruptive to our community. This was never the intention."; artigo bloqueado (403), data inferida como início de 2025 (o texto diz "last September"); nada a ver com análise de treino.
  source: https://tomsguide.com/wellness/fitness/good-news-for-strava-users-the-app-just-reversed-a-hugely-unpopular-decision
  publisher: Tom's Guide
  pub_date: undated (provável 2025-Q1)
  accessed: 2026-09-03
  confidence: medium
  class: trajectory

### Voz dos usuários
- claim: Em dezembro de 2025 a Strava colocou o recap "Year in Sport" — gratuito desde 2016 — atrás da assinatura de US$ 80/ano, o que "has roiled numerous Strava users" (snippet de feed republicando cobertura de imprensa; sem citações diretas de usuários capturadas).
  source: https://tagteam.harvard.edu/hub_feeds/3415/feed_items/17132945/content
  publisher: TagTeam (Harvard) republicando imprensa — upstream não identificado
  pub_date: 2025-12
  accessed: 2026-09-03
  confidence: low
  class: sentiment
- claim: Best Efforts para ciclistas foi lançado como recurso exclusivo de assinantes (TechRadar: "Strava Best Efforts finally arrives for cyclists"), e a mesma publicação resume a percepção geral como "still the best training app for runners and cyclists, but it's getting expensive" — voz de imprensa, não de usuário.
  source: https://www.techradar.com/health-fitness/fitness-apps/strava-best-efforts-finally-arrives-for-cyclists
  publisher: TechRadar
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature
- claim: No board de ideias do Community Hub há 11 ideias rotuladas Fitness & Freshness; as que apareceram na busca pedem (a) "Better Fitness and Freshness chart for long term analysis - include custom date range" (aberta a votação, usuário pede "Custom date range" para ver vários meses em detalhe) e (b) "Fitness and Freshness to factor sleep and weight"; contagens de kudos e datas não foram capturadas (o listing redirecionou) — registrar como baseline stale de lacunas percebidas: janela longa customizável e cruzamento com sono/peso.
  source: https://communityhub.strava.com/t5/ideas/better-fitness-and-freshness-chart-for-long-term-analysis/idi-p/406 · https://communityhub.strava.com/t5/ideas/fitness-and-freshness-to-factor-sleep-and-weight/idi-p/408
  publisher: Strava Community Hub (Ideas)
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: sentiment
- claim: Threads do Community Hub registram duas fricções recorrentes de Fitness & Freshness: valores divergentes entre web e app ("Fitness & Freshness values are different from Web vs App", thread arquivada) e ausência do dado na API ("Is there any way to GET Fitness & Freshness?", fórum de devs) — ou seja, quem quer a curva fora da Strava precisa recalculá-la a partir de streams/Relative Effort.
  source: https://communityhub.strava.com/developers-api-7/is-there-any-way-to-get-fitness-freshness-1625
  publisher: Strava Community Hub
  pub_date: undated
  accessed: 2026-09-03
  confidence: low
  class: feature
- claim: Voz de desenvolvedor-usuário sobre o programa de jun/2026 (fórum intervals.icu, 2026-06-01 a 06-04): a queixa dominante não é preço mas a obrigação de assinar para manter uma integração pessoal/open-source funcionando — Gegfi (Incyclist) "frustrated about forced subscription"; Jaap_van_Ekris (OpenRowingMonitor) "going to abandon Strava".
  source: https://forum.intervals.icu/t/strava-api-update-new-terms-subs-required-for-api-access/130240
  publisher: Intervals.icu Forum
  pub_date: 2026-06-01 a 2026-06-04
  accessed: 2026-09-03
  confidence: medium
  class: sentiment

## Leads
- Reconfirmar a ausência das cláusulas de AI/ML e "look and feel" com leitura integral do https://www.strava.com/legal/api (a extração foi por modelo pequeno) e com captura de arquivo via archive.ph ou Wayback a partir de outra rede (web.archive.org é bloqueado para este crawler).
- Definição de "intermediary platform": ler o thread do Community Hub "New STRAVA API UPDATE, what the message means" (https://communityhub.strava.com/developers-api-7/new-strava-api-update-what-the-message-means-13433) e procurar post da Terra (tryterra.co/blog) de jun/2026 — a Terra é o caso de teste óbvio de intermediário.
- Reddit segue inacessível (allowed_domains devolve 400; fetch direto bloqueado): tentar obter URLs de threads via buscador que não seja o do crawler e então fetch em old.reddit.com/…/.json; alvos: r/Strava "premium worth it 2026", r/AdvancedRunning "Fitness & Freshness accuracy", r/Velo "intervals.icu vs Strava".
- Ideias com mais kudos no Community Hub estão na plataforma nova (as URLs /t5/ redirecionam); descobrir o padrão de URL do board de ideias atual e capturar kudos/datas para Fitness & Freshness, Best Efforts, Relative Effort e Training Log.
- Confirmar o teto "até 10 atletas" do Standard tier em fonte independente (não apareceu na issue #53 nem no fórum).
- Data e autor do artigo do Tom's Guide via espelho MSN (ar-AA1Aij1W) ou 24matins.uk.
- Cobertura de DC Rainmaker/the5krunner sobre o programa de jun/2026 não apareceu na busca — vale uma busca dirigida (site:dcrainmaker.com 2026 developer program).
- Ler a thread "Strava API Update Implications" do intervals.icu (130445 devolveu 404; pode ter sido movida) e o post da Tredict sobre o developer program, se existir.
- Cobrar o número 448% na fonte upstream (TechCrunch "Strava declares war on scrapers ahead of IPO").

## Looked for and could not find
- Qualquer citação independente e verbatim das duas frases-destaque do API Agreement de jun/2026 (só o texto primário as traz).
- Texto do API Agreement de 2024 no Wayback (web.archive.org bloqueado para o crawler).
- Voz de usuário final (não desenvolvedor) dos últimos 12 meses sobre o que justifica pagar a Strava e o que a análise faz mal: Reddit inacessível, App Store/Google Play não alcançados, board de ideias do Community Hub redirecionou para o fórum de devs — a meta de 6–10 citações com data e votos não foi atingida (obtive 3 citações datadas, todas de desenvolvedores).
- Reações de Runalyze, Golden Cheetah, VeloViewer, Statshunters ou Terra ao programa de jun/2026.
- Qualquer posicionamento do intervals.icu (David Tinker) sobre intermediários ou sobre a assinatura obrigatória.
- Definição oficial de "intermediary platform".
- Data de publicação do artigo do Tom's Guide (403).
- Isenção para uso pessoal/single-user/não comercial no API Agreement (procurada e não encontrada — a ausência é o achado).
