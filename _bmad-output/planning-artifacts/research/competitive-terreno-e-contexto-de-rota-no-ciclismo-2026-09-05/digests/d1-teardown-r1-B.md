# D1 · Teardown B (Wandrer, VeloViewer, Statshunters, intervals.icu + pares) · rodada 1

> **Nota de método.** `wandrer.earth` e `news.wandrer.earth` responderam **HTTP 403** ao
> WebFetch, e o espelho no `communityhub.strava.com` derrubou a conexão (socket hang up).
> Todo claim sobre Wandrer nesta rodada vem de **resumo de motor de busca sobre a página
> primária**, não da leitura direta — por isso saem com `confidence: medium` e a URL
> primária citada. Recuperar essas duas páginas é a tarefa nº 1 da rodada 2.
> Orçamento consumido: 15 chamadas, 4 WebFetch bem-sucedidos.

## Achados

- claim: Wandrer filtra o extrato do OpenStreetMap de uma região pelas vias com a tag `highway` e depois aplica um conjunto de regras para manter só o que é legalmente acessível a pé ou de bicicleta.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News (blog oficial)
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Wandrer

- claim: Wandrer não credita a via inteira: reduz o GPS das atividades a "porções completadas de vias" — do tipo 0–100% da Main Street, 25–72% da Spring Street — ou seja, o crédito é fracionário ao longo da geometria.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News (blog oficial)
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Wandrer

- claim: No backend, Wandrer mantém uma tabela de referência com as geometrias das vias do OSM e uma tabela separada de "segments" com os trechos completados, e usa `ST_LineSubstring()` do PostGIS sobre a geometria da via do OSM para gerar a geometria percorrida que aparece no mapa.
  source: https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html
  publisher: Wandrer News (blog oficial)
  pub_date: 2026-01-30
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Wandrer

- claim: Wandrer permite escolher se as vias não-percorridas exibidas incluem as **não pavimentadas**, e o padrão do mapa fica salvo em Preferences, na página de Settings.
  source: https://wandrer.earth/faq
  publisher: Wandrer (FAQ oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Wandrer

- claim: A conta gratuita do Wandrer sincroniza apenas 50 atividades passadas do Strava, participa das Explorer Activities e baixa 10 mapas para GPS; a conta paga processa todo o histórico, dá mapas ilimitados, a extensão de navegador que pinta vias percorridas/não-percorridas dentro de ferramentas de rota, os desafios mensais/anuais e as vias "Super Unique" e "Never Traveled".
  source: https://wandrer.earth/faq
  publisher: Wandrer (FAQ oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: pricing
  app: Wandrer

- claim: O preço original do Wandrer era US$ 30/ano, mantido por cinco anos, e o reajuste comunicado equivale a US$ 0,83/mês a mais que esse valor.
  source: https://news.wandrer.earth/2026/04/11/onward-to-2026.html
  publisher: Wandrer News (blog oficial)
  pub_date: 2026-04-11
  accessed: 2026-09-05
  confidence: low
  class: pricing
  app: Wandrer

- claim: O VeloViewer sobrepõe ao mundo inteiro uma grade descrita como "16,348 x 16,348", com cada quadrado sendo um Explorer Tile, baseada nos Slippy Map Tilenames da projeção Web Mercator usada por OpenStreetMap e Google Maps no **zoom 14** — o que dá tiles de aproximadamente 1 milha de lado.
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: method
  app: VeloViewer

- claim: O tamanho em km de cada tile do VeloViewer varia com a latitude — quanto mais perto dos polos, menor o tile.
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: method
  app: VeloViewer

- claim: No VeloViewer basta a atividade **cruzar** o tile para ele ser marcado, e a marcação em lote usa a linha simplificada da atividade (não o stream GPS completo) por desempenho; a página de detalhe de uma atividade reprocessa com o GPS completo e preenche tiles que a simplificação perdeu.
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: method
  app: VeloViewer

- claim: O VeloViewer tem uma guarda explícita contra erro de GPS: "Any straight line >500m in length will not tick any map tiles" — um segmento reto de mais de 500 m não credita tile nenhum.
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: method
  app: VeloViewer

- claim: O VeloViewer define três métricas de exploração: Explorer Score (contagem de tiles distintos atravessados em todas as atividades), Max Square (o maior quadrado cheio de tiles marcados) e Max Cluster (o maior conjunto conectado de tiles visitados em que cada tile também tem os quatro vizinhos ortogonais visitados).
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: VeloViewer

- claim: O Max Cluster foi criado como alternativa ao Max Square para quem tem terreno inacessível (mar, montanha) impedindo fechar um quadrado.
  source: https://blog.veloviewer.com/introducing-the-explorer-cluster-and-configurable-explorer-visuals/
  publisher: VeloViewer (blog oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: VeloViewer

- claim: A documentação do Explorer do VeloViewer não menciona piso, tipo de via ou tag de superfície em momento algum — a unidade de análise é o tile, nunca a via.
  source: https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/
  publisher: VeloViewer (blog oficial)
  pub_date: 2016-12-05
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: VeloViewer

- claim: Os explorer tiles do Statshunters são o tile padrão do OpenStreetMap no zoom 14, e o tamanho depende da latitude — mesma definição do VeloViewer.
  source: https://www.statshunters.com/faq-10-what-are-explorer-tiles
  publisher: StatsHunters (FAQ oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Statshunters

- claim: O Statshunters conecta a conta do Strava e coloca todas as pedaladas e fotos num mapa só, com filtro por gear, tipo, elevação, distância e data aplicado tanto às estatísticas quanto ao heatmap.
  source: https://www.statshunters.com/faq
  publisher: StatsHunters (FAQ oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Statshunters

- claim: O Statshunters calcula o número de Eddington e concede badges por atividades e desafios, além de max square e max cluster sobre os tiles.
  source: https://www.statshunters.com/faq
  publisher: StatsHunters (FAQ oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Statshunters

- claim: O Statshunters tem uma extensão de Chrome que desenha os tiles dentro do route builder do próprio Strava, para planejar rota mirando tiles novos.
  source: https://chromewebstore.google.com/detail/statshunters/ldhkneiheabejbefhgjddpamijajabmm
  publisher: Chrome Web Store / StatsHunters
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: viz
  app: Statshunters

- claim: O Squadrats usa um segundo nível de granularidade além do explorer tile — os "squadratinhos", tiles de zoom 17, 64 deles dentro de cada tile de zoom 14.
  source: https://hugovk.github.io/tiles/
  publisher: Hugo van Kemenade (página independente sobre tiles)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: method
  app: Squadrats

- claim: O intervals.icu tem gear (bicicletas, tênis e outros equipamentos) com acumulação automática de **distância, tempo e contagem de atividades**.
  source: https://www.intervals.icu/features/gear-tracking/
  publisher: intervals.icu (página oficial de features)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: intervals.icu

- claim: O intervals.icu dispara lembretes por distância, tempo ou contagem de atividades — o exemplo dado na própria página é "replace chains, top up sealant".
  source: https://www.intervals.icu/features/gear-tracking/
  publisher: intervals.icu (página oficial de features)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: intervals.icu

- claim: A página de gear do intervals.icu oferece list view com filtro, ordenação e colunas configuráveis, totais e médias, e exportação CSV do gear.
  source: https://www.intervals.icu/features/gear-tracking/
  publisher: intervals.icu (página oficial de features)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: intervals.icu

- claim: No intervals.icu os **componentes são compartilhados entre itens de gear**, o que permite acompanhar o desgaste de um mesmo componente atravessando mais de uma bicicleta; dá para lançar à mão distância, tempo e atividades de equipamento já aposentado.
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (anúncio do autor do produto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: intervals.icu

- claim: A página oficial de gear tracking do intervals.icu não menciona elevação acumulada por equipamento, nem qualquer análise de terreno ou piso.
  source: https://www.intervals.icu/features/gear-tracking/
  publisher: intervals.icu (página oficial de features)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: intervals.icu

- claim: O myWindsock "Surface" modela a velocidade do vento **na via** a partir de topologia, uso do solo (landuse) e edificações vindas do OpenStreetMap, mais dinâmica de ciclismo — ou seja, "surface" aqui é rugosidade aerodinâmica do terreno, **não** pavimento.
  source: https://surface.mywindsock.com/
  publisher: myWindsock (site oficial do produto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: myWindsock

- claim: O myWindsock Surface roda tanto sobre rota planejada (prever tempo e achar trechos críticos) quanto sobre **atividade já concluída** (impacto do vento, CdA, métricas de desempenho).
  source: https://surface.mywindsock.com/
  publisher: myWindsock (site oficial do produto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: myWindsock

- claim: A visualização do myWindsock Surface combina overlay de velocidade/direção de vento no mapa interativo com uma **timeline de "tempo ganho/perdido" por trecho** e um acumulado de impacto de vento separando frente e cauda.
  source: https://surface.mywindsock.com/
  publisher: myWindsock (site oficial do produto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: myWindsock

- claim: O Weather Impact™ (wImpact) do myWindsock é definido por contrafactual: um "Virtual Rider" completa o percurso com vento zero e condições perfeitas, e a diferença de potência necessária para igualar aquela velocidade sob o clima real/previsto é o Weather Impact.
  source: https://mywindsock.com/page/wwatts/
  publisher: myWindsock (página oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: myWindsock

- claim: O myWindsock estima a velocidade do ar a partir do ângulo do vento predominante ajustado pelo terreno, estima CdA cruzando clima observado com potência, velocidade e elevação, e define "air penalty" como a diferença entre o ar atravessado e a distância percorrida no chão.
  source: https://mywindsock.com/page/help/navigating-and-understanding-the-information/metrics-explained/
  publisher: myWindsock (help oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: myWindsock

- claim: A gramática de cor do myWindsock é vermelho para vento de frente, roxo para vento de través e azul-claro para vento de cauda.
  source: https://www.bikeradar.com/news/mywindsock-takes-strava-nerdiness-to-the-next-level
  publisher: BikeRadar
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: viz
  app: myWindsock

- claim: O myWindsock tem camada gratuita com o núcleo e uma assinatura Premium que libera análise de tendência de clima, extensões customizadas e previsão avançada — sem valor em moeda publicado na página do Surface.
  source: https://surface.mywindsock.com/
  publisher: myWindsock (site oficial do produto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: pricing
  app: myWindsock

- claim: O myWindsock monitora segmentos com previsão (Segment Weather Monitor), isto é, olha para frente no tempo — não é análise retrospectiva de piso.
  source: https://mywindsock.com/my/monitors/
  publisher: myWindsock (página oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: capability
  app: myWindsock

## Por app

### Wandrer
Faz uma coisa e faz fundo: **cobertura de vias**, não de tiles. Extrai do OSM as ways com tag
`highway`, filtra por regras de acesso legal a pé/bicicleta, e credita **frações de via** —
"25–72% da Spring Street" — guardando os trechos numa tabela `segments` e materializando a
geometria percorrida com `ST_LineSubstring()` do PostGIS. É a granularidade mais fina do grupo:
enquanto VeloViewer e Statshunters perguntam "passei nesse quadrado de ~1 milha?", o Wandrer
pergunta "que pedaço desta rua ainda me falta?". Toca em piso apenas como **filtro de
visualização** (mostrar ou não as untraveled roads não pavimentadas), com padrão salvo em
Preferences — não como métrica: não achei nesta rodada nenhum "% de terra da sua pedalada".
Monetiza no histórico (grátis = 50 atividades) e nos mapas para GPS; a extensão de navegador que
pinta vias percorridas dentro de ferramentas de rota é paga. **Não encontrei a tolerância em
metros** do casamento GPS↔via — o número que mais importaria para reimplementar.

### VeloViewer
Não analisa terreno. Analisa **presença em grade**: mundo em tiles de zoom 14 (~1 milha),
Explorer Score = tiles distintos, Max Square = maior quadrado cheio, Max Cluster = maior
componente conexo onde cada tile tem os 4 vizinhos ortogonais. O detalhe de engenharia que vale
roubar é a **guarda anti-GPS-ruim**: a marcação em lote roda sobre a linha simplificada da
atividade e "any straight line >500m in length will not tick any map tiles" — sinal perdido não
vira exploração falsa; a página de detalhe reprocessa com o stream cheio e recupera o que a
simplificação comeu. Visualização é mapa com tiles verdes e o Max Square em azul. A doc do
Explorer é de **2016** — ponto de frescor a conferir. Zero menção a superfície, tipo de via ou
gradiente.

### Statshunters
Mesma definição de tile do VeloViewer (OSM zoom 14, tamanho variando com a latitude), montado
sobre o Strava. O diferencial é ser um agregador de estatística geral, não só tiles: heatmap de
tudo num mapa, **filtro por gear, tipo, elevação, distância e data** aplicado ao mesmo tempo às
estatísticas e ao heatmap, número de Eddington, badges. O movimento mais esperto do produto é a
extensão de Chrome que injeta os tiles **dentro do route builder do Strava** — a análise vai até
onde a decisão é tomada, em vez de esperar o usuário vir ao site. Nada sobre piso encontrado.

### intervals.icu
É o único do grupo com **gear de verdade**: bicicletas, tênis e outros equipamentos acumulando
distância, tempo e contagem de atividades, com lembretes disparados por qualquer um dos três
("replace chains, top up sealant"). Componentes são compartilhados entre itens de gear, então um
mesmo par de rodas ou uma corrente rastreada atravessa mais de uma bicicleta; dá para lançar
manualmente o acumulado de equipamento aposentado. A camada de leitura é lista com filtro,
ordenação, colunas configuráveis, totais/médias e export CSV. **Nenhuma menção a terreno ou piso**
na página de gear — o desgaste é contado em km, nunca em km de terra, que é exatamente o
cruzamento que o app pessoal já tem condição de fazer.

### myWindsock (par descoberto nº 1)
Contexto meteorológico levado a sério, retrospectivo e prospectivo. O produto "Surface" usa
topologia, landuse e edificações do OSM para estimar o vento **na via**, não na estação
meteorológica — atenção à armadilha de nome: "surface" ali é rugosidade aerodinâmica, não
pavimento. O modelo mental exportável é o **contrafactual**: o Weather Impact™ faz um Virtual
Rider percorrer o mesmo trajeto com vento zero e mede a diferença de potência necessária para
igualar a velocidade; daí saem "tempo ganho/perdido" por trecho, CdA estimado a partir de clima +
potência + velocidade + elevação, e o "air penalty" (ar atravessado menos distância no chão).
Cores: vermelho de frente, roxo de través, azul-claro de cauda. Grátis com Premium por cima.

### Squadrats (par descoberto nº 2)
Só arranhado nesta rodada, e por fonte de terceiro. Diferencia-se por uma **segunda escala**: além
do explorer tile de zoom 14, os "squadratinhos" de zoom 17, 64 dentro de cada tile grande — o que
transforma um quadrado já conquistado em terreno com granularidade nova. Precisa de fonte primária.

## Pistas para a rodada 2

- **Contradição numérica.** O blog do VeloViewer diz grade "16,348 x 16,348", mas 2^14 = **16.384**.
  Ou é erro de digitação no post oficial, ou é outra coisa. Conferir antes de citar o número.
- **Wandrer é um buraco de leitura, não de conteúdo.** `wandrer.earth/faq` e `news.wandrer.earth`
  devolvem 403 ao fetch, e o espelho no communityhub.strava.com caiu. Rotas alternativas para a
  rodada 2: Wayback Machine, a review detalhada do DC Rainmaker (2020, velha — usar só para
  contexto) e a busca por texto integral do post de 2026-01-30.
- **A pergunta de método que ficou em aberto:** que tolerância/buffer em metros o Wandrer usa para
  dizer que o track passou por aquela way do OSM? Map matching (Valhalla/OSRM/HMM) ou buffer
  geométrico simples? É o número que decide se dá para reimplementar em PostGIS.
- **Frescor do VeloViewer.** A documentação central do Explorer é de dezembro de 2016. Verificar se
  o produto segue mantido em 2026 e se a regra dos 500 m ainda vale.
- **Entidades novas a checar:** Squadrats (fonte primária), e os que ficaram intocados —
  Elevate/Sauce (extensões sobre o Strava), cycle.travel, Bikemap, Trailforks e JOIN.
- **Pergunta de produto que a rodada 1 levanta:** ninguém encontrado até aqui liga **piso a gear**.
  O intervals.icu conta km por componente sem saber o piso; o Wandrer sabe o piso sem contar
  desgaste. "Km de terra por pneu/bicicleta" parece ser terra de ninguém — vale confirmar na
  rodada 2 antes de tratar como lacuna real.

## Procurei e não achei

- **Nenhum app do grupo publica "% não pavimentado de uma atividade já feita" derivado da tag
  `surface` do OSM.** O Wandrer é o único que toca em unpaved, e como filtro de mapa, não como
  métrica por pedalada. Ausência sob 15 chamadas ≠ inexistência — mas é o sinal mais forte da
  rodada, e casa com o fato de o app pessoal já ter feito exatamente isso.
- **Nenhuma menção a `tracktype`, `smoothness`, `highway=track` ou qualquer tag de qualidade de
  piso** em nenhuma das fontes lidas. Só `highway` (Wandrer) e landuse/buildings (myWindsock).
- **Tolerância/buffer do casamento GPS↔OSM do Wandrer:** procurada em duas consultas, não
  encontrada.
- **Preço em moeda do myWindsock Premium** e valor atual da assinatura do Wandrer: só a variação
  (+US$ 0,83/mês sobre US$ 30/ano) apareceu, nunca o número final.
- **Tempo parado / semáforo / análise noturna:** procurado dentro do escopo dos cinco apps, zero
  ocorrências. Nenhuma fonte lida trata hora do dia como dimensão de análise, exceto o myWindsock
  para efeito de previsão de vento.
- **Terreno no intervals.icu:** a página de gear não menciona; não sobrou orçamento para varrer o
  fórum atrás de campos custom de terreno/piso.
- **Statshunters e Squadrats em fonte primária fetchada:** a FAQ do Statshunters voltou vazia ao
  WebFetch (página provavelmente renderizada em JS); tudo que consta veio de resumo de busca.

## Fontes lidas

1. https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html — "The evolution of Wandrer's 'untraveled roads' feature" (403 no fetch; conteúdo via resumo de busca)
2. https://wandrer.earth/faq — Wandrer FAQ (403 no fetch; conteúdo via resumo de busca)
3. https://news.wandrer.earth/2026/04/11/onward-to-2026.html — "Onward to 2026" (via resumo de busca)
4. https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/ — "VeloViewer Explorer Tiles and Max Square" (fetch OK, 2016-12-05)
5. https://blog.veloviewer.com/introducing-the-explorer-cluster-and-configurable-explorer-visuals/ — "Introducing the Explorer Cluster" (via resumo de busca)
6. https://www.statshunters.com/faq-10-what-are-explorer-tiles — "What are explorer tiles?" (fetch retornou vazio)
7. https://www.statshunters.com/faq — StatsHunters FAQ (via resumo de busca)
8. https://chromewebstore.google.com/detail/statshunters/ldhkneiheabejbefhgjddpamijajabmm — extensão StatsHunters (via resumo de busca)
9. https://hugovk.github.io/tiles/ — "How big is an explorer tile?" (via resumo de busca)
10. https://www.intervals.icu/features/gear-tracking/ — "Gear Tracking | Intervals.icu" (fetch OK)
11. https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492 — "Bike and other gear usage tracking" (via resumo de busca)
12. https://surface.mywindsock.com/ — myWindsock Surface (fetch OK)
13. https://mywindsock.com/page/wwatts/ — "Weather Impact™ (wImpact)" (via resumo de busca)
14. https://mywindsock.com/page/help/navigating-and-understanding-the-information/metrics-explained/ — "Metrics Explained" (via resumo de busca)
15. https://www.bikeradar.com/news/mywindsock-takes-strava-nerdiness-to-the-next-level — BikeRadar sobre myWindsock (via resumo de busca)
16. https://communityhub.strava.com/insider-journal-9/developer-voices-the-evolution-of-wandrer-s-untraveled-roads-feature-12652 — espelho do post do Wandrer (socket hang up)
