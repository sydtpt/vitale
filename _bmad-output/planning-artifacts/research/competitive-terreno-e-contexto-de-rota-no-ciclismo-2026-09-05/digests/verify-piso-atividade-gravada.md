# Verificação · piso de atividade GRAVADA (Garmin, Strava, Komoot, RwGPS)

Contexto: resolver a contradição entre a rodada que leu help centers ("nenhum dos quatro
publica proporção de piso de atividade já gravada") e a rodada que leu fóruns (usuários
relatando percentuais no Garmin Connect e um "surface type overview" no Strava).

Data da verificação: 2026-09-05. Toda conclusão abaixo vem de recuperação feita nesta
execução; nada foi assumido de conhecimento prévio.

## Veredito por pergunta

### 1. Garmin — quebra paved/unpaved em ATIVIDADE gravada: **CONFIRMADO**

O fórum oficial da Garmin traz relato direto de usuário vendo a proporção numa pedalada
já registrada: **"Garmin says it was 88% paved and 12% unpaved"**, e o autor do fio
reclamando que o Connect marca **"100% of my rides as 100% paved"** mesmo em trilha de
MTB. Pela regra 2, relato em fórum oficial é evidência de que a feature EXISTE (alguém a
viu), ainda que o help center não a descreva — e a reclamação só faz sentido se a tela
mostrar o número.
Dispositivo confirmado por relato: **Edge Explore 2** (único citado no fio). Não
consegui confirmar Edge 540/840/1040/1050 nem Fenix por leitura direta (ver "Procurei e
não achei").
Reforço independente: a review do Edge 850 no DC Rainmaker (09/09/2025) lista **"Added
post-ride trail breakdown"** entre os recursos do Edge MTB e registra que **"Garmin has
increased the surface types in Garmin Connect recently (e.g., Gravel vs Road)"** — ou
seja, tipo de piso é dado vivo no Connect, embora a review não detalhe percentuais.
- https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
- https://www.dcrainmaker.com/2025/09/garmin-edge-850-in-depth-review-brilliance.html

### 2. Strava — "surface type overview" com percentuais na página de ATIVIDADE: **NÃO VERIFICÁVEL**

Duas evidências que não se encaixam, e a que decidiria está atrás de 403.
(a) O help center (fonte primária, atualizada) documenta o **Surface Type como stat map
para assinante na atividade** e é explícito quanto ao que ele mostra: *"Dashed lines
indicate the section is unpaved, solid orange indicates the section is paved, and white
is unspecified"*, com a FAQ dizendo *"There's no legend available on the activity page at
this time."* Nenhum percentual, nenhuma distância — só linha colorida no mapa.
(b) O fio "[Known Issue] Surface type overview doesn't match what's shown in the elevation
profile" no Community Hub existe e cita percentuais (**"16% paved, 32% dirt, 13% not
specified"**, somando 61%), uma barra de visualização e reconhecimento da Strava em
**novembro de 2024** — mas só consegui o resumo indexado: o site devolve 403 ao crawler e
o Wayback está bloqueado neste ambiente. O material recuperado **não estabelece se essa
"overview" fica numa atividade gravada ou numa rota**, e o artigo *Route Terrain* mostra
que existe uma seção **Terrain** em rotas da comunidade (*"Select any of the community
routes and scroll down to the Terrain section"*), o que torna a hipótese "é de rota"
igualmente viável.
Portanto: percentuais de piso existem em algum lugar do produto Strava — isso está
confirmado; que apareçam numa ATIVIDADE gravada, não.
- https://support.strava.com/en-us/articles/15401748-map-types
- https://support.strava.com/en-us/articles/15401687-route-terrain
- https://communityhub.strava.com/strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646 (403; lido só por resumo de busca)

### 3. Komoot e Ride with GPS — quebra de piso de atividade GRAVADA: **NÃO VERIFICÁVEL** (nenhum indício positivo)

**Ride with GPS:** quatro publicações independentes (BIKEPACKING.com, Velo/Outside,
BikePortland, the5krunner) e a própria nota da RwGPS tratam Surface Types como recurso do
**planejador de rotas** — "adds Surface Types to route planning tool", percentual de
não-pavimentado sobre a rota, três classes (PAVED / UNPAVED / UNKNOWN), dado do
OpenStreetMap. Nada no material recuperado fala de **trips** (o nome da RwGPS para
atividade gravada). A tentativa de ler a nota oficial `ridewithgps.com/news/4930` voltou
sem corpo de texto.
**Komoot:** a página *Tour Characteristics* documenta a quebra por **way types** e
**surfaces** como característica de Tour, mas o texto recuperado é de planejamento
("breakdown of how long the route will take to complete… e a distância em cada way type e
surface"). Não recuperei nada que diga que uma Tour **gravada** recebe a mesma quebra.
- https://www.komoot.com/tour-characteristics
- https://bikepacking.com/news/ride-with-gps-surface-types/
- https://velo.outsideonline.com/road/road-racing/ride-with-gps-adds-surface-types-to-route-planning-tool/

### Efeito sobre a contradição

A afirmação geral da primeira rodada está **REFUTADA como blanket statement**: o Garmin
Connect exibe, sim, proporção de piso em atividade gravada. Para Strava, Komoot e RwGPS
ela **permanece de pé sobre a evidência disponível**, mas por ausência de prova em
contrário, não por prova de ausência — em Strava há forte indício de que percentuais
existem em alguma superfície do produto.

## Claims

- claim: O Garmin Connect exibe proporção paved/unpaved de uma pedalada já gravada; usuário relata "88% paved and 12% unpaved" numa saída mista.
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums (fórum oficial), relato de usuário
  pub_date: s.d. (fio aberto "over 1 year ago"; última resposta "11 months ago")
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Garmin Connect

- claim: A classificação de piso da Garmin vem do metadado `surface` do OpenStreetMap — "The 'surface' is part of the OSM road meta data and might not be set correctly for your local unpaved roads".
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums (resposta de usuário)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Garmin Connect

- claim: A quebra depende do MAPA CARREGADO NO APARELHO, não de pós-processamento no Connect: o caso do fio se resolveu quando se descobriu que um mapa topográfico de terceiro, pré-instalado por revendedor regional, rotulava as superfícies errado — com o mapa Garmin a classificação saiu correta.
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Garmin Connect / Edge

- claim: O Edge MTB ganhou "post-ride trail breakdown", e a Garmin ampliou recentemente os tipos de piso no Garmin Connect (ex.: Gravel vs Road).
  source: https://www.dcrainmaker.com/2025/09/garmin-edge-850-in-depth-review-brilliance.html
  publisher: DC Rainmaker
  pub_date: 2025-09-09
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Garmin Edge / Connect

- claim: Na Strava, o Surface Type na página da ATIVIDADE é um stat map só de assinante e mostra apenas traço tracejado (não pavimentado), laranja sólido (pavimentado) e branco (não especificado) — sem percentual e sem legenda.
  source: https://support.strava.com/en-us/articles/15401748-map-types
  publisher: Strava Help Center (primária)
  pub_date: s.d. ("Updated over 2 weeks ago")
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Strava

- claim: A Strava tem uma seção "Terrain" em rotas da comunidade, acessada pela aba Maps > Routes no app móvel.
  source: https://support.strava.com/en-us/articles/15401687-route-terrain
  publisher: Strava Help Center (primária)
  pub_date: s.d. ("Updated over 2 weeks ago")
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Strava

- claim: Existe na Strava uma "surface type overview" com percentuais (relato de "16% paved, 32% dirt, 13% not specified", somando 61%) e barra de visualização, com bug reconhecido pela Strava em nov/2024; a superfície onde ela aparece (atividade × rota) não foi verificada.
  source: https://communityhub.strava.com/strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646
  publisher: Strava Community Hub (oficial) — lido apenas por resumo de busca; página devolve 403
  pub_date: 2024-11 (resposta da Strava, conforme resumo)
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Strava

- claim: O Surface Types da Ride with GPS foi lançado como recurso do planejador de rotas, com percentual de piso sobre a rota, três classes (PAVED/UNPAVED/UNKNOWN) e dado do OpenStreetMap; nada indica a mesma quebra para "trips" gravadas.
  source: https://velo.outsideonline.com/road/road-racing/ride-with-gps-adds-surface-types-to-route-planning-tool/
  publisher: Velo (Outside) — corroborado por BIKEPACKING.com e BikePortland
  pub_date: 2021-09
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Ride with GPS

- claim: A Komoot documenta quebra por way type e surface como característica de Tour, em linguagem de planejamento; não recuperei confirmação de que a Tour GRAVADA receba a mesma quebra.
  source: https://www.komoot.com/tour-characteristics
  publisher: komoot (primária)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Komoot

## Como o dado é calculado

O que ficou documentado converge num ponto: **ninguém mede piso pelo sensor; todos casam
o traçado com o metadado `surface` do OpenStreetMap.**

- **Garmin** — a evidência mais informativa da rodada. O fio do Edge Explore 2 mostra que
  o resultado muda conforme o **mapa instalado no aparelho**: com um mapa topográfico de
  terceiro, tudo saía "paved"; com o mapa Garmin, a classificação ficou correta. Isso
  posiciona o cálculo no *map-matching contra o mapa carregado no device* (que por sua vez
  deriva de OSM), e não num pós-processamento server-side no Connect. Consequência
  prática: a mesma pedalada, em dois aparelhos com mapas diferentes, dá percentuais
  diferentes — e o usuário **não pode editar** o tipo de piso da atividade.
- **Strava** — o help center atribui o Surface Type a dado *crowdsourced* do
  OpenStreetMap. O bug reconhecido (percentuais que somam 61%) sugere que o
  "not specified" do OSM é propagado como classe própria e que a agregação diverge do que
  o perfil de elevação desenha — dois caminhos de cálculo distintos sobre o mesmo traçado.
- **Ride with GPS** — declaradamente OSM, com colapso deliberado para três classes
  (PAVED / UNPAVED / UNKNOWN).
- **Komoot** — separa dois eixos, *way type* (path, cycleway, street, singletrack…) e
  *surface* (asfalto, cascalho, areia, paralelepípedo), o que é o modelo mais rico dos
  quatro.

Nota para o nosso caso: qualquer proporção de piso que a gente derive de rota GPS herda a
cobertura do OSM local — e o "não especificado" precisa ser uma classe visível, não um
arredondamento silencioso, exatamente o erro que a Strava cometeu.

## Procurei e não achei

- **Documentação primária da Garmin** (support.garmin.com, manuais em www8.garmin.com)
  descrevendo o campo de piso no resumo de atividade — não veio nas buscas; a evidência
  ficou toda em fórum oficial + review.
- **Confirmação de quais Edge além do Explore 2** trazem a quebra. Apareceu na busca um
  fio "24.19 Surface Wrong" no fórum do **Edge 840** (https://forums.garmin.com/sports-fitness/cycling/f/edge-840-series/387030/24-19-surface-wrong)
  — pista forte de que a 840 também tem o dado, mas **não li o fio**; fica como lead, não
  como evidência. Nada sobre Fenix.
- **O fio do Strava Community Hub na íntegra** — 403 ao crawler e web.archive.org
  bloqueado neste ambiente. É a peça que decidiria a pergunta 2; recomendo abrir no
  navegador, logado, e ver se a captura de tela do fio é de atividade ou de rota.
- **Corpo do anúncio oficial da RwGPS** (`/news/4930-introducing-surface-types`) — a
  página voltou só com o título.
- **support.ridewithgps.com sobre "trips"** e **support.komoot.com "Tour details"** sobre
  tour gravada — não recuperados dentro do orçamento.
- **Datas absolutas** do fio da Garmin (o fórum exibe só "over 1 year ago").

## Fontes lidas

1. **Garmin Forums — "Edge Explore 2 and Garmin Connect display all roads as paved!"** — *lido na íntegra* — https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
2. **Strava Help Center — "Map Types"** — *lido na íntegra* — https://support.strava.com/en-us/articles/15401748-map-types
3. **Strava Help Center — "Route Terrain"** — *lido na íntegra* — https://support.strava.com/en-us/articles/15401687-route-terrain
4. **DC Rainmaker — "Garmin Edge 850 In-Depth Review"** (09/09/2025) — *lido na íntegra* — https://www.dcrainmaker.com/2025/09/garmin-edge-850-in-depth-review-brilliance.html
5. Strava Community Hub — "[Known Issue] Surface type overview…" — **não lido** (403); só resumo de busca — https://communityhub.strava.com/strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646
6. komoot — "Tour Characteristics" — **não lido na íntegra**; só resumo de busca — https://www.komoot.com/tour-characteristics
7. Velo/Outside, BIKEPACKING.com, BikePortland, the5krunner sobre RwGPS Surface Types (set/2021) — **não lidos na íntegra**; resumo de busca, publishers independentes entre si — https://velo.outsideonline.com/road/road-racing/ride-with-gps-adds-surface-types-to-route-planning-tool/
8. Ride with GPS — "Introducing: Surface Types" — **tentado, sem corpo de texto** — https://ridewithgps.com/news/4930-introducing-surface-types
