# D2 · Voz do usuário · rodada 2 (os quatro pedidos)

> Rodada executada em 2026-09-05, atrás do firewall de pesquisa: só web, nesta execução.
> **Aviso de honestidade epistêmica:** esta rodada foi *pobre em voz de usuário*. O
> Reddit não foi acessível por nenhum caminho tentado, três das quatro perguntas não
> produziram relato de ciclista nenhum, e o que sobrou é majoritariamente evidência de
> produto (o que os apps entregam) e de mídia especializada — não gente pedindo. O que
> está abaixo como `gap` é achado negativo verificado, não preguiça de busca; o que não
> foi verificado está na seção "Procurei e não achei".

## Achados

- claim: O Ride With GPS lançou "Surface Types" — quebra de terreno no mapa e **em porcentagem numérica** — explicitamente **só para rotas planejadas**, não para atividades gravadas: o artigo abre com "*CURRENTLY FOR ROUTES ONLY (MORE SOON)*" e descreve o recurso como tendo "the goal of showing riders what to expect on a route".
  source: https://bikepacking.com/news/ride-with-gps-surface-types/
  publisher: BIKEPACKING.com (mídia especializada)
  pub_date: 2021-09-14
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Ride With GPS

- claim: O mesmo recurso classifica em três baldes — "Paved (including asphalt, concrete, and chip seal), Unpaved (including gravel, dirt, cobblestones and natural/unimproved trails), and Unknown (when insufficient data is available)" — ou seja, a categoria "Unknown" é parte declarada do modelo, não um defeito escondido.
  source: https://ridewithgps.com/news/4930-introducing-surface-types
  publisher: Ride With GPS (blog do produto) — recuperado via resumo de busca; o fetch direto voltou só com o título
  pub_date: 2021-09
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Ride With GPS

- claim: O "gravel" que o Strava conta é **tipo de atividade declarado**, não piso medido: o relatório Year in Sport fala em "the share of athletes logging a gravel ride" (+55%), e o suporte a gravel veio como adicionar 'Gravel Ride', 'Mountain Bike', 'e-Mountain Bike' e 'Trail Run' aos tipos suportados.
  source: https://www.cyclingweekly.com/news/gravel-boom-shows-no-signs-of-slowing-strava-report-reveals
  publisher: Cycling Weekly
  pub_date: s.d. (cobertura do Year in Sport 2023)
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Strava

- claim: No intervals.icu, "gravel" também é só rótulo de atividade, e rótulo que quebra: há relato de bug de que "bike workouts weren't showing up in the weekly bar graphs on the Fitness page, nor being counted towards the weekly totals and those missing activities all coincided with Gravel rides", além de "Gravel rides marked in Strava are shown as bicycling instead of gravel rides".
  source: https://forum.intervals.icu/t/gravel-ride-activities-not-being-taken-into-account-for-weekly-bike-totals/130236
  publisher: Intervals.icu Forum
  pub_date: s.d. (só o resumo de busca; não abri o tópico)
  accessed: 2026-09-05
  confidence: low
  class: complaint
  app: intervals.icu

- claim: A escolha de pneu **é** decidida por porcentagem de piso da rota, com regra explícita publicada: "If your off-road sections only amount to a mile or two, you can base your tire choice solely on the gravel portions. However, if you're riding a significant amount of road between off-road sectors, choosing a tire that finds a middle ground might be wise" — e "For rides where 40% or more of the route is Class 3 and 4 mileage, most enthusiasts will get the best combination of performance from 'small knob' gravel tires labeled with 35-42 mm widths".
  source: https://intheknowcycling.com/choosing-gravel-bike-tires/
  publisher: In The Know Cycling (blog de review independente)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: decision-evidence
  app: —
  nota: o fetch direto da página voltou **HTTP 403**; os trechos vêm do resumo do buscador, não de leitura integral. Tratar como citação de segunda mão até reler.

- claim: A composição de piso de um evento é publicada como número justamente porque orienta equipamento — "The Tour of Battenkill is a mixed-surface event with only 35% of the route unpaved, of which 80% is Class 1 and 20% Class 2".
  source: https://intheknowcycling.com/choosing-gravel-bike-tires/
  publisher: In The Know Cycling
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: decision-evidence
  app: —
  nota: mesma ressalva de 403 acima.

- claim: O Strava tem um "Night Heatmap" (anunciado 2024-11-13) que define noite como **do pôr do sol ao nascer do sol** e agrega 1 ano de atividades públicas — mas é mapa de *comunidade* para planejar rota, não estatística do próprio histórico ("shows heat from activities recorded from sunset to sunrise"), e é exclusivo de assinante.
  source: https://support.strava.com/hc/en-us/articles/31335253810701-Night-Heatmap
  publisher: Strava Support / cobertura Engadget e T3
  pub_date: 2024-11-13
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Strava

- claim: Na literatura, tempo parado no semáforo é um problema *percebido* muito maior que o real: ciclistas "considerably overestimate their waiting time", por um fator de ~5, "showing that traffic lights are perceived by cyclists as an important source of delay".
  source: https://findingspress.org/article/9636-perceived-versus-actual-waiting-time-a-case-study-among-cyclists-in-enschede-the-netherlands
  publisher: Findings (periódico acadêmico) — Enschede, NL
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: decision-evidence
  app: —
  nota: é evidência acadêmica, **não** voz de usuário de app. Vale como hipótese: medir o parado pode contradizer a sensação — que é exatamente o tipo de análise que muda decisão.

- claim: Na voz real de ciclista, tempo parado só aparece como *dúvida sobre a corretude do auto-pause*, nunca como métrica desejada. No fio "Does strava stop when you do?" o único trecho sobre parada é "I think it pauses the clock if your speed drops bellow 1mph for junctions or lights etc..." — e ninguém no fio pede para medir quanto perdeu parado, contar paradas ou escolher rota/horário com isso.
  source: https://singletrackworld.com/forum/bike-forum/does-strava-stop-when-you-do/
  publisher: Singletrack World Magazine Forum
  pub_date: 2014-08-01
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Strava
  nota: fio antigo (12 anos). Achado negativo com data velha — confiança rebaixada como sinal de mercado hoje.

- claim: A discussão popular sobre semáforo é *comportamental*, não analítica: a pergunta corrente é se se deve pausar o relógio no vermelho, e "64% of runners surveyed voted to keep their watches running rather than pause at traffic lights".
  source: https://www.stylist.co.uk/fitness-health/workouts/running-motivation-pause-fitness-watch/625798
  publisher: Stylist
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: complaint
  app: Strava
  nota: pesquisa com corredores, não ciclistas; entra só como textura.

- claim: Não foi encontrado, nesta rodada, nenhum script/ferramenta pública que case um GPX gravado com `surface` do OSM para produzir proporção de piso. O que existe em GPX + OSM é de outra natureza: um analisador que "includes a module estimating GPS signal quality using actual building data from OpenStreetMap", plotagem de velocidade/FC, redução de tracklog.
  source: https://medium.com/@alex.gascon1999/gpx-analyzer-v2-86337e2cde3d
  publisher: Medium / GoPenAI (+ github.com/topics/gpx-tracks)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: —
  nota: ausência em uma única consulta ≠ inexistência. Não repetir esta conclusão sem mais uma rodada.

## Resposta por pedido

**1. "Quanto gravel eu pedalei?"** — Zero fontes independentes de *pedido de usuário* encontradas nesta rodada; nenhuma. O que se achou foi o formato do buraco, por três fontes: o RwGPS entrega a porcentagem de piso **só para rota planejada** ("CURRENTLY FOR ROUTES ONLY", 2021, e nada indica que mudou), e tanto o Strava quanto o intervals.icu contam gravel por **rótulo declarado de atividade**, não por piso medido — o Year in Sport conta "athletes logging a gravel ride". Ou seja: a indústria responde "quantos pedais você chamou de gravel", não "quantos km seus foram em terra". Isso reforça a rodada 1 (piso errado é a queixa nº 1) por outro ângulo, mas sigo **sem** um único ciclista citado pedindo a proporção do próprio histórico. Nenhuma solução caseira (script, planilha, GPX+OSM) encontrada.

**2. Semáforo / tempo parado** — Uma fonte de ciclista (Singletrack, 2014) e ela é negativa: o assunto é se o auto-pause funciona, não medir a perda. Duas fontes acadêmicas dizem algo mais interessante e adjacente: o ciclista **superestima a espera em ~5×**. Não achei ferramenta, script nem relato de alguém escolhendo rota ou horário por tempo parado. Sustentação: 1 fonte de voz (negativa) + 2 acadêmicas (indiretas). Como pedido de usuário, isto **não existe** na evidência recuperada; como hipótese de produto ("seu semáforo custa menos do que você sente"), tem lastro acadêmico e nenhum concorrente.

**3. Noturno / iluminação** — Nenhum pedido de usuário encontrado. Uma fonte de produto relevante: o Night Heatmap do Strava (2024-11) já normalizou **pôr do sol → nascer do sol** como a definição de noite, e é de assinante. Mas é heat *da comunidade*, para planejar; ninguém entrega "quantos km seus foram depois do pôr do sol". Sustentação: 1 fonte de produto, 0 de voz. Barato de construir (o dado é hora + lat/lon), sem demanda demonstrada.

**4. Escolha de bike/pneu por dado** — Nenhum relato pessoal do tipo "vi X% de gravel no meu histórico e por isso comprei o pneu Y" — o que confirma a rodada 1 (decidem por sensação). Mas achei o elo que faltava, em 1 fonte (In The Know Cycling, 2 trechos, lida só por snippet — 403): a porcentagem de não-pavimentado **é** o parâmetro publicado da decisão de pneu ("40% or more of the route is Class 3 and 4 mileage" → 35–42 mm com knob pequeno; poucos quilômetros de terra → decida só pela parte de gravel), e eventos publicam a sua ("only 35% of the route unpaved"). A distinção que importa para o app: a porcentagem move a decisão quando é **prospectiva** (a rota de amanhã, o evento), não retrospectiva. Confiança média — uma fonte só, e de segunda mão.

## Procurei e não achei

- **Reddit: falhou inteiramente, por três caminhos.** (a) `site:reddit.com track gravel miles percentage` no buscador retornou **zero** resultados do Reddit — só perfis do Komoot e Wikipédia; não deu nem para descobrir títulos. (b) Espelho redlib `https://redlib.catsarch.com/search?...` → **HTTP 403**. (c) `https://old.reddit.com/r/gravelcycling/search?...` → bloqueado pela própria ferramenta ("unable to fetch from old.reddit.com"). Não tentei i.reddit, libreddit alternativos nem safereddit — o orçamento de 15 chamadas acabou. **Nada do Reddit entrou neste digest.**
- Comentários do lançamento do Surface Types: a página do RwGPS voltou só com o título; o artigo do BIKEPACKING declara "44 Conversation" mas o corpo dos comentários não veio no fetch. Há 44 comentários de leitores não lidos ali — alvo óbvio da próxima rodada.
- `intheknowcycling.com` bloqueia leitura (403). Os dois trechos citados vêm de snippet; a seção de comentários dele (que costuma ter conversa longa de leitor sobre escolha de pneu) segue **não lida**.
- Fóruns pedidos no brief que não cheguei a consultar por orçamento: bikeforums.net (só apareceu um fio de roteamento do RwGPS, não aberto), weightweenies, gravelcyclist, Escape Collective, Komoot community, Garmin ideas, Strava feature requests (o communityhub apareceu, não foi aberto).
- Nenhuma evidência recuperada de que o Surface Types do RwGPS tenha, entre 2021 e 2026, passado a valer para atividades gravadas. O "(MORE SOON)" de 2021 pode ter sido cumprido — **não verifiquei**, e essa é a checagem mais barata e mais decisiva da próxima rodada.

## Fontes lidas

1. https://bikepacking.com/news/ride-with-gps-surface-types/ — **lida na íntegra** (corpo do artigo; comentários não vieram)
2. https://singletrackworld.com/forum/bike-forum/does-strava-stop-when-you-do/ — **lida na íntegra**
3. https://ridewithgps.com/news/4930-introducing-surface-types — **fetch falhou** (só o título); conteúdo via resumo de busca
4. https://intheknowcycling.com/choosing-gravel-bike-tires/ — **403**; conteúdo via resumo de busca
5. https://www.cyclingweekly.com/news/gravel-boom-shows-no-signs-of-slowing-strava-report-reveals — só por resumo de busca
6. https://forum.intervals.icu/t/gravel-ride-activities-not-being-taken-into-account-for-weekly-bike-totals/130236 — só por resumo de busca
7. https://support.strava.com/hc/en-us/articles/31335253810701-Night-Heatmap — só por resumo de busca
8. https://findingspress.org/article/9636-perceived-versus-actual-waiting-time-a-case-study-among-cyclists-in-enschede-the-netherlands — só por resumo de busca
9. https://www.stylist.co.uk/fitness-health/workouts/running-motivation-pause-fitness-watch/625798 — só por resumo de busca
10. https://medium.com/@alex.gascon1999/gpx-analyzer-v2-86337e2cde3d — só por resumo de busca
11. https://redlib.catsarch.com/search — **403, nada obtido**
12. https://old.reddit.com/r/gravelcycling/search — **bloqueado, nada obtido**
