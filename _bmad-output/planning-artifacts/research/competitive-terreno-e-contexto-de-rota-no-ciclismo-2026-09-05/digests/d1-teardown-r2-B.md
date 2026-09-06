# D1 · Teardown B · rodada 2 (método Wandrer, Squadrats e pares, VeloViewer hoje, piso × equipamento)

> Firewall de pesquisa: tudo abaixo vem de páginas recuperadas em 2026-09-05.
> `wandrer.earth` e `news.wandrer.earth` devolvem 403 para o WebFetch, mas respondem 200
> a `curl` com User-Agent de navegador — foi assim que os textos primários foram lidos.
> `web.archive.org` está bloqueado neste ambiente e não foi usado.

## Achados

### Método do Wandrer

- claim: Todo o dado de GPS de uma atividade é reduzido a "porções completadas de estrada" expressas como faixas percentuais por via do OSM — "0-100% of Main Street, 25-72% of Spring Street".
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News (Craig, criador do Wandrer)
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: O próprio post declara que COMO essas faixas são determinadas fica fora do texto — "Determining these numbers of a subject of a separate post" —, ou seja, tolerância, buffer e snapping continuam sem documentação pública.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Wandrer

- claim: O esquema histórico do banco era uma tabela `segments` com linhas `user_id, osm_id, completed_ranges, geometry`, e o `ST_LineSubstring()` do PostGIS gerava a geometria da porção percorrida a partir da geometria OSM + `completed_ranges`.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: A tabela `segments` chegou a 100 GB (quase tudo geometria) e foi eliminada; hoje o estado do usuário é só o par agregado `(osm_id, ranges)`, e o "não percorrido" nunca é armazenado, por ser o inverso do percorrido.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: O pipeline atual exporta um SQLite com as atividades do usuário e as geometrias OSM para um servidor Hetzner de CPU alta, que agrega, roda o `tippecanoe` e publica Mapbox Vector Tiles num VPS de US$10/mês — quase 400.000 arquivos de tiles servidos assim.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: As vias não percorridas são calculadas sob demanda por subtração no tile (percorrido do usuário menos geometria OSM total), só aparecem a partir do zoom 11 e têm cache de 5 minutos.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Wandrer

- claim: Quando o Wandrer saiu de Atlanta para o mundo, a pergunta recorrente virou "o que conta como estrada?", e a resposta é declaradamente filosófica e variável por país e por preferência do usuário — acesso legal, becos, trilhas de mountain bike. Piso não é citado em nenhum momento.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: context
  app: Wandrer

- claim: Em 9 de dezembro de 2025 o planeta tinha, pela contagem do Wandrer, 76 milhões de km de vias pedaláveis, e para quase todo usuário 99% do planeta é "não percorrido".
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: high
  class: context
  app: Wandrer

- claim: O FAQ descreve o filtro assim: "In OpenStreetMap (OSM), roads and trails are labeled with a 'highway' tag. We filter the OSM data for a region to identify all ways tagged with 'highway' and then apply a set of rules designed to filter these highways to identify what can be accessed legally on foot / bicycle."
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: A lista concreta de regras de filtragem por tag está em `wandrer.earth/filters`, mas a página exige login — em 2026-09-05 ela devolve a tela de autenticação, então o conjunto exato de valores de `highway` aceitos/rejeitados não é público.
  source: https://wandrer.earth/filters
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Wandrer

- claim: A única orientação do FAQ sobre qualidade de GPS é do lado do dispositivo: "Setting your GPS device to record 1 time per second and turning off smart tracking may improve the quality of road matching in Wandrer."
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: O FAQ lista como causa conhecida de crédito errado o casamento com via paralela: "Your GPS points from traveling on that road matched to a parallel road. Contact us if you think this has happened to you." — não há tolerância publicada, e o tratamento é suporte humano.
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Wandrer

- claim: Em vez de aperfeiçoar o casamento, o Wandrer entregou um editor de traço: "Rather than spend a lot of time perfecting Wandrer's matching algorithm (which, to be clear, I have also tried, but is difficult for a variety of reasons), here's a simple solution: let you edit the activity trace so that it falls in the correct place."
  source: https://news.wandrer.earth/2025/08/14/activity-editor-is-available.html
  publisher: Wandrer News
  pub_date: 2025-08-14
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Wandrer

- claim: O editor permite arrastar um ponto ou vários (seleção por caixa com shift) e tem ferramenta "straighten" que joga os pontos selecionados sobre a reta entre o primeiro e o último; é exclusivo de assinantes e só no desktop.
  source: https://news.wandrer.earth/2025/08/14/activity-editor-is-available.html
  publisher: Wandrer News
  pub_date: 2025-08-14
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Wandrer

- claim: O autor admite que às vezes você NÃO quer o casamento correto — se há ciclovia paralela a uma via movimentada e as duas estão no mapa, pedale a ciclovia duas vezes e mova uma das linhas para a via, ganhando crédito nas duas ("Wandrer should be fun, not frustrating").
  source: https://news.wandrer.earth/2025/08/14/activity-editor-is-available.html
  publisher: Wandrer News
  pub_date: 2025-08-14
  accessed: 2026-09-05
  confidence: high
  class: context
  app: Wandrer

- claim: Trilhas fora de estrada entram no mapa de bicicleta desde que sejam legalmente pedaláveis ("If you can legally travel a trail on a bicycle, it should be included in the Wandrer Bike Map") — o critério é acesso legal, nunca piso.
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Wandrer

- claim: O texto completo do FAQ (2.745 palavras, varrido por grep em 2026-09-05) não contém uma única ocorrência de `surface`, `unpaved`, `paved`, `gravel`, `tracktype` ou `smoothness`; "meter/tolerance/snap/accuracy" também não aparecem.
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: Wandrer

- claim: O dado OSM subjacente do Wandrer é atualizado "roughly every 2-3 months", e o assinante pode pedir a atualização da sua região (conclui em ~24 h).
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Wandrer

- claim: O Wandrer mantém progressos separados por modo — pontuações Foot, Bicycle e Combined — porque o filtro de acesso legal difere entre pé e bicicleta.
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Wandrer

- claim: Os Explorer Achievements (bairros, cidades, rotas longas como EuroVelo e Appalachian Trail) vêm sobretudo do OSM, complementados por GIS municipal para limites, e pagam bônus ao cruzar 25%, 50%, 75%, 90% e 99% das vias da área.
  source: https://wandrer.earth/faq
  publisher: Wandrer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Wandrer

### Squadrats, VeloViewer, Statshunters

- claim: O Squadrats trabalha com dois tamanhos de tile — os "Squadrats" padrão e os menores "Squadratinhos" — e em 2026 tem app móvel para coleta ao vivo e extensão de navegador para planejamento de rota.
  source: https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/
  publisher: We Love Cycling (Škoda)
  pub_date: 2026-04-14
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Squadrats

- claim: A equivalência "Squadrats = zoom 14 e Squadratinhos = zoom 17 (~186 m de lado, 64 por tile de zoom 14)" circula em fontes de terceiros, mas NÃO foi verificada em fonte primária nesta rodada — `squadrats.com`, `/faq` e `/about` devolvem o "Vercel Security Checkpoint" (HTTP 429) tanto por curl quanto por WebFetch.
  source: https://squadrats.com/faq
  publisher: Squadrats
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Squadrats

- claim: Nenhuma das plataformas de caça a tiles comparadas (Squadrats, VeloViewer, Statshunters) analisa superfície de via, pavimentado × não pavimentado, gravel ou classificação de tipo de via — a cobertura é puramente geográfica por tile.
  source: https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/
  publisher: We Love Cycling (Škoda)
  pub_date: 2026-04-14
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Squadrats · VeloViewer · Statshunters

- claim: O Statshunters combina caça a tiles com estatísticas de desempenho, conquistas e heatmap, é totalmente gratuito e tem extensão de navegador para planejamento, ao custo de um mapa mais lento.
  source: https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/
  publisher: We Love Cycling (Škoda)
  pub_date: 2026-04-14
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Statshunters

- claim: O VeloViewer segue vivo e com Explorer no menu principal em setembro de 2026 (itens "Leaderboards · Explorer · Global Heatmap"), com plano grátis limitado a 25 atividades, 10 rotas e 250 segmentos, PRO a £10 e PRO+ a £20.
  source: https://veloviewer.com/pro
  publisher: VeloViewer
  pub_date: s.d. (rodapé "© VeloViewer 2012-2026")
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: VeloViewer

- claim: O blog do VeloViewer publicou em 14/08/2026 um perfil de caçador de tiles na categoria "Explorer", com as métricas do usuário citadas nominalmente — "Eddington 124 ml / 169 km, max square 67 x 67 and cluster 11 045 tiles" — e anuncia "the new VeloViewer metric now available thanks to Pekka's request", prova de que o Explorer/Max Square continua em desenvolvimento ativo.
  source: https://blog.veloviewer.com/tiling-tales-chasing-tiles-in-arctic-conditions/
  publisher: VeloViewer (Lucy Sibbald)
  pub_date: 2026-08-14
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: VeloViewer

- claim: A lista de features do VeloViewer em 2026 (Summary, Activities, Segments, Efforts, Routes, Challenges, Wheel, Infographic, Explorer, Global Heatmap, Year Infographic) não traz nenhum item de superfície, piso ou tipo de via.
  source: https://blog.veloviewer.com/
  publisher: VeloViewer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: VeloViewer

### Piso × equipamento

- claim: O rastreio de equipamento do intervals.icu é por quilometragem, tempo e contagem de atividades, com lembretes por distância/tempo/contagem e filtros avançados para casar equipamento com o medidor de potência usado — a página oficial não menciona superfície, terreno nem tipo de via.
  source: https://www.intervals.icu/features/gear-tracking/
  publisher: Intervals.icu Ltd
  pub_date: s.d. (rodapé "© 2026 Intervals.icu Ltd")
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: intervals.icu

- claim: O Strautomator escolhe equipamento "based on the activity metadata, date, sensors and more" e sabe pôr a bike padrão para "rides, MTB and gravel" — isto é, pelo tipo de esporte declarado no Strava, não por piso medido do traçado.
  source: https://strautomator.com/
  publisher: Strautomator
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: Strautomator

- claim: A única ligação encontrada entre superfície e desgaste de componente é do Trail Hits, que diz receber metadados de superfície de rotas do Ride with GPS e alimentá-los em multiplicadores: "Ride-planned rides with surface metadata flow straight into the gravel-grit and surface-condition multipliers" — a origem desse metadado (OSM ou não) não é declarada, e o gatilho é a rota planejada, não o GPS gravado.
  source: https://www.trailhits.com/best-bike-maintenance-app
  publisher: Trail Hits (material do próprio fornecedor)
  pub_date: 2026-06 (página marcada "Updated June 2026")
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: Trail Hits

- claim: A mesma página não atribui a Strava, Garmin Connect ou ProBikeGarage qualquer medição de superfície a partir de dados de mapa — esses apps aparecem rastreando só quilometragem, elevação e tempo.
  source: https://www.trailhits.com/best-bike-maintenance-app
  publisher: Trail Hits
  pub_date: 2026-06
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: ProBikeGarage · Strava · Garmin Connect

## Método do Wandrer — o que está documentado e o que continua desconhecido

O que ficou **documentado**, e agora com fonte legível: o Wandrer filtra o extrato OSM da região por `highway`, aplica um conjunto de regras de **acesso legal** a pé e de bicicleta (regras que existem numa página `/filters`, mas atrás de login), e reduz cada atividade a um conjunto de faixas percentuais por `osm_id` — `(osm_id, ranges)`, nada mais. O percorrido vira geometria só na hora de desenhar, via `ST_LineSubstring()`; o não percorrido nunca é gravado, é o complemento calculado por subtração dentro do tile, sob demanda, a partir do zoom 11 e com cache de 5 minutos. O pipeline é assíncrono: SQLite com atividades + geometrias OSM → servidor de CPU alta → `tippecanoe` → MVT num VPS barato.

O que **continua desconhecido** é exatamente o que interessa ao piso das rotas: a **tolerância**. O post de 30/01/2026 corta o assunto numa frase — "Determining these numbers of a subject of a separate post" — e esse post separado não existe no índice do news.wandrer.earth (páginas 1 de 14 inspecionadas; nenhum título sobre o algoritmo de casamento). Não há metro, buffer, snapping, fração mínima de via para creditar, nem tratamento de outlier publicados em lugar nenhum. Os únicos vestígios do problema são indiretos e reveladores: o FAQ pede gravação a 1 Hz e desligar o smart recording "to improve the quality of road matching"; lista o casamento com via paralela como falha conhecida cuja solução é escrever para o suporte; e em agosto de 2025 o autor entregou um **editor manual de traço** dizendo explicitamente que tentou aperfeiçoar o algoritmo e que isso "is difficult for a variety of reasons". Ou seja: a referência do nicho resolve GPS ruim com mão humana, não com heurística publicada. Sobre `surface`, `tracktype` ou `smoothness` não há uma única menção — nem no post técnico, nem nas 2.745 palavras do FAQ. O eixo do Wandrer é **acesso legal e ineditismo**, não terreno.

## Pares

**Squadrats** — dois tamanhos de tile (Squadrats e Squadratinhos), app móvel para coletar tile ao vivo e extensão de navegador para planejar rota; a promessa é mapa rápido e ranking global. A equivalência com zoom 14/17 é folclore de terceiros que não consegui confirmar: o site está atrás de um Vercel Security Checkpoint que devolve 429 a qualquer cliente automatizado. Nada de piso.

**VeloViewer** — vivo e ativo em 2026: Explorer no menu, blog com post de Explorer em 14/08/2026, métricas Eddington / max square / cluster citadas como correntes e uma métrica nova adicionada a pedido de usuário. Grátis dá 25 atividades; PRO £10, PRO+ £20. O catálogo inteiro de features é geometria e desempenho — zero superfície.

**Statshunters** — tiles + estatísticas + conquistas + heatmap, grátis, mapa mais lento, extensão para planejar. Também sem superfície.

**cycle.travel / Bikemap / Trailforks / Elevate / Sauce** — nenhuma evidência recuperada de exibição de piso para atividade **já gravada**. O que aparece no material sobre piso é sempre **planejamento**: o cycle.travel oferece preferências 'Paths & roads' × 'Paved only' na hora de traçar; o Ride with GPS tem uma feature nomeada "Surface Types" cujo anúncio existe (`ridewithgps.com/news/4930-introducing-surface-types`), mas cujo corpo é renderizado por JS e o help center está atrás de Cloudflare — não consegui ler o mecanismo nem confirmar se vale para atividades gravadas. Elevate e Sauce for Strava aparecem só com métricas de potência, fitness e picos de esforço.

## Piso × equipamento — quem faz / ninguém faz

**Ninguém liga piso medido a equipamento.** O intervals.icu, que é a referência de gear tracking real, conta quilômetro, tempo e número de atividades e casa equipamento por medidor de potência — nunca por terreno. O Strautomator chega mais perto e ainda assim erra o alvo: ele escolhe a bike/tênis por *metadado da atividade* (tipo de esporte "gravel", data, sensores), o que é a etiqueta que o usuário deu, não o chão que ele pisou. O único fornecedor que fala em "surface-condition multipliers" é o Trail Hits, e o próprio material dele diz que o metadado de superfície vem de rota planejada importada do Ride with GPS — nada de derivar piso do GPS gravado, e a origem do dado não é declarada.

Buscas feitas para essa pergunta, todas em 2026-09-05:
- `intervals.icu gear component tracking tyre wear gravel surface distance` → só a página oficial de Gear Tracking e o tópico do fórum; nenhuma feature de superfície.
- `ProBikeGarage tire wear tracking terrain surface gravel road` → ProBikeGarage rastreia por distância e tempo de pedal; o único "terreno" citado é o de material de marketing do Trail Hits.
- `Strautomator features gravel surface OR terrain gear component` → gear por metadado/sensor; "gravel" é tipo de atividade.
- `Sauce for Strava OR Elevate for Strava unpaved gravel surface analysis activity` → ambos entregam potência/fitness; nada de superfície.
- `cycle.travel unpaved surface breakdown of ride distance logged` → resultados voltaram para planejamento (cycle.travel routing, Ride with GPS Surface Types), não para atividade gravada.

Isto é o achado com mais valor de decisão da rodada: **"km de gravel por pneu" e "distância não pavimentada por bicicleta" não existem em nenhuma ferramenta documentada** — nem nas de exploração (que só medem ineditismo), nem nas de manutenção (que só medem quilometragem bruta).

## Procurei e não achei

- **A tolerância do Wandrer em metros.** Nem no post técnico, nem no FAQ, nem no índice de posts. O post que a explicaria foi prometido e não publicado.
- **A lista de tags `highway` aceitas/rejeitadas pelo Wandrer.** Existe em `wandrer.earth/filters`, mas exige login.
- **Qualquer menção a `surface`, `tracktype` ou `smoothness` no Wandrer.** Zero ocorrências no FAQ inteiro e no post de arquitetura.
- **Fonte primária do Squadrats.** O domínio devolve Vercel Security Checkpoint (429) para todo cliente automatizado; a listagem que tentei na App Store (id1583783203) devolveu 404.
- **O mecanismo do "Surface Types" do Ride with GPS.** Anúncio existe, corpo é JS; o help center devolve 403 (Cloudflare). Fica como lead da próxima rodada — é o parente mais próximo de "porcentagem de piso", ainda que para rota planejada.
- **Qual é a "nova métrica" do VeloViewer de 14/08/2026.** Prometida na abertura do post, não nomeada no texto recuperado (pode estar em imagem).
- **Wayback Machine.** `web.archive.org` está bloqueado neste ambiente ("Claude Code is unable to fetch from web.archive.org"); o acesso primário foi obtido por curl com User-Agent de navegador, o que tornou o espelho desnecessário para Wandrer.

## Fontes lidas

1. https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html — "The evolution of Wandrer's 'untraveled roads' feature", Craig, 2026-01-30 (texto integral, via curl)
2. https://wandrer.earth/faq — FAQ do Wandrer, s.d. (texto integral, 2.745 palavras, via curl)
3. https://wandrer.earth/filters — regras de filtragem OSM; retorna tela de login (via curl)
4. https://news.wandrer.earth/2025/08/14/activity-editor-is-available.html — "Activity editor is available", Craig, 2025-08-14 (texto integral, via curl)
5. https://news.wandrer.earth/ — índice de posts (página 1 de 14), acessado 2026-09-05
6. https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/ — "Tile Hunting: Which Platform Is Best for You?", We Love Cycling, 2026-04-14
7. https://veloviewer.com/pro — página de features/planos do VeloViewer, acessada 2026-09-05
8. https://blog.veloviewer.com/ e https://blog.veloviewer.com/tiling-tales-chasing-tiles-in-arctic-conditions/ — blog do VeloViewer, post de 2026-08-14
9. https://www.intervals.icu/features/gear-tracking/ — página oficial de Gear Tracking, acessada 2026-09-05
10. https://strautomator.com/ — página inicial com a lista de automações, acessada 2026-09-05
11. https://www.trailhits.com/best-bike-maintenance-app — comparativo do próprio fornecedor, "Updated June 2026"

Tentadas e inacessíveis: https://squadrats.com/ (429, Vercel checkpoint) · https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types (403, Cloudflare) · https://ridewithgps.com/news/4930-introducing-surface-types (200, corpo só em JS) · https://web.archive.org/ (bloqueado no ambiente)
