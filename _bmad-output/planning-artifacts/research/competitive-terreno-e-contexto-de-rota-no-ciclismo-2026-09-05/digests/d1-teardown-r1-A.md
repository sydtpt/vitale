# D1 · Teardown A (Komoot, Strava, RwGPS, Garmin Connect) · rodada 1

> Firewall de pesquisa: tudo abaixo veio de recuperação web em 2026-09-05. Onde a
> evidência é um resumo de resultado de busca (e não o texto da página em si), a
> confiança está rebaixada e o fato está anotado.
> **Limite de orçamento atingido** (15 chamadas): Garmin Connect ficou com cobertura
> rasa e a dimensão (d) — contexto de rota: parado/semáforo, vento, clima, noturno,
> vias novas — ficou quase toda por fazer. Ver "Procurei e não achei".

## Achados

- claim: A Strava usa OpenStreetMap e as tags de superfície associadas a cada via como fonte do tipo de piso mostrado em seus produtos ("We use OpenStreetMaps and the tags associated with each surface to display the surface types you see within our products").
  source: https://support.strava.com/en-us/articles/15402016-strava-maps-glossary
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Strava

- claim: No glossário de mapas da Strava, a simbologia de via é: linha branca sólida = estrada pavimentada; branca tracejada = footpath (pedestre, sem tag de trilha); rosa tracejada = hiking/trail/bridleway; rosa sólida = "track" do OpenStreetMap ("bikes or even vehicles may be allowed but likely still unpaved").
  source: https://support.strava.com/en-us/articles/15402016-strava-maps-glossary
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Strava

- claim: No "Route Terrain" da Strava, o traçado usa linha tracejada para trecho não pavimentado, laranja sólido para pavimentado e branco para não especificado; a pré-visualização vive na aba Maps do app móvel, deslizando entre mapas de terreno.
  source: https://support.strava.com/en-us/articles/15401687-route-terrain
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Strava

- claim: O artigo "Route Terrain" da Strava trata de rotas planejadas (community routes) — não descreve piso de atividade já registrada, nem percentual por superfície, nem sobreposição do piso no perfil de elevação.
  source: https://support.strava.com/en-us/articles/15401687-route-terrain
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Strava

- claim: Ao criar rota na Strava dá para escolher a preferência de superfície (majoritariamente pavimentado, terra, ou "Any"), e as polylines de rota sugerida exibem uma tag com o percentual pavimentado/não pavimentado da rota.
  source: https://support.strava.com/en-us/articles/15401756-generated-community-routes
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Strava
  nota: recuperado via resumo de busca, não pelo texto integral da página.

- claim: Além do OSM, a Strava afirma usar dado próprio sobre o tipo de quadro de bicicleta que os atletas usam para inferir o tipo de superfície das rotas.
  source: https://support.strava.com/en-us/articles/15401756-generated-community-routes
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: method
  app: Strava
  nota: só apareceu em resumo de busca; precisa de confirmação no texto da página.

- claim: Existe pedido aberto de usuários na comunidade Strava para poder editar/corrigir o tipo de superfície, o que indica que a correção hoje só acontece contribuindo ao próprio OSM.
  source: https://communityhub.strava.com/t5/ideas/editable-surface-type/idi-p/26586
  publisher: Strava Community Hub
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Strava

- claim: A Strava tem notificação de quilometragem para tênis (padrão 250 milhas, ajustável até 800), gerenciada só pelo site.
  source: https://support.strava.com/en-us/articles/15401878-managing-shoe-notifications
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: context
  app: Strava

- claim: A Strava expandiu o "My Gear" para rastrear quilometragem de componentes de bicicleta, mas não oferece alertas de desgaste por componente equivalentes aos de tênis — o vazio é preenchido por terceiros (Strautomator, Componentry, Biker) que leem a API.
  source: https://road.cc/content/tech-news/stravas-my-gear-tracker-expanded-bike-maintenance-286417
  publisher: road.cc
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Strava
  nota: fonte secundária + resumo de busca; validar no help center da Strava na rodada 2.

- claim: A komoot separa dois eixos: "way type" (path, cycleway, street, highway, trail, singletrack, road) e "surface type" (a condição real: sand, asphalt, cobblestones, gravel).
  source: https://www.komoot.com/tour-characteristics
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Komoot

- claim: A komoot promete "at-a-glance way type and surface type details" como um dos indicadores de preparo antes da saída.
  source: https://www.komoot.com/tour-characteristics
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: viz
  app: Komoot

- claim: No planejador da komoot, o detalhamento de way type e superfície da rota inteira aparece ao aplicar o filtro de way types e surfaces nas configurações ("See way type and surface breakdowns for your entire route by applying the way type and surfaces filter in settings").
  source: https://www.komoot.com/help/routeplanner
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Komoot

- claim: O perfil de elevação da komoot é colorido por inclinação (verde = plano, vermelho = íngreme) e permite clicar e arrastar para dar zoom num trecho — ou seja, a cor do perfil está gasta com gradiente, não com piso.
  source: https://www.komoot.com/help/routeplanner
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: viz
  app: Komoot

- claim: A komoot usa informação de way types, superfícies e acessibilidade das vias para recomendar tours de caminhada e ciclismo calibrados por nível de experiência.
  source: https://www.komoot.com/help/routeplanner
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Komoot
  nota: via resumo de busca sobre páginas de suporte da komoot; confirmar a redação exata.

- claim: A komoot coloca "ver o clima ao longo da rota" atrás do tier Premium na página pública de um tour.
  source: https://www.komoot.com/tour/289408856
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: pricing
  app: Komoot

- claim: Numa página pública de tour gravado da komoot (Road Ride, 26,3 km), o HTML servido mostra duração, distância, velocidade média/máxima e ganho/perda de elevação, e abas "Elevation", "Waypoints" e "Route Details" — sem quebra visível de way types/superfícies no conteúdo estático.
  source: https://www.komoot.com/tour/289408856
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Komoot
  nota: ausência no HTML recuperado pode ser render por JS ou tour sem dado; NÃO tratar como prova de que a komoot não mostra piso em tour gravado — resultados de busca mostram tours com "Way Types"/"Surface". Resolver na rodada 2.

- claim: O Ride with GPS classifica pavimentado (asphalt, concrete, tarmac, chip seal) com linha sólida e não pavimentado (gravel, dirt, natural/unimproved trails) com linha tracejada; onde o dado é insuficiente o trecho fica "unknown".
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: RwGPS
  nota: página deu HTTP 403 no fetch direto; conteúdo veio do resumo de busca.

- claim: No RwGPS a superfície aparece em dois lugares ao mesmo tempo: ao longo da linha do traçado no mapa E no perfil de elevação.
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: viz
  app: RwGPS

- claim: No modo de roteamento de ciclismo do RwGPS há um seletor (caret ao lado da superfície atual) para alternar entre Paved, Unpaved e Any, o que enviesa a rota gerada para a superfície preferida.
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: RwGPS

- claim: Surface Types é gratuito no RwGPS — disponível para Starter, Basic e Premium.
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: pricing
  app: RwGPS

- claim: O RwGPS lançou o Surface Types em setembro de 2021 e o posicionou como ferramenta para "planejar antes de pedalar" e casar cada trecho com a bicicleta certa.
  source: https://ridewithgps.com/news/4930-introducing-surface-types
  publisher: Ride with GPS (blog oficial)
  pub_date: 2021-09
  accessed: 2026-09-05
  confidence: low
  class: capability
  app: RwGPS
  nota: o fetch da página voltou só o título; a data vem da cobertura de imprensa (the5krunner, BIKEPACKING.com, GearJunkie) datada de 2021-09-14.

- claim: No Garmin Connect não há como fazer a linha do curso mostrar diferença de superfície; usuários distinguem gravel de asfalto pela simbologia do mapa base (gravel aparece como "path" — linha preta fina; asfalto como "road" — linha mais grossa; service roads em cinza fino).
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses
  publisher: Garmin Forums (fórum oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Garmin Connect
  nota: fórum oficial mas conteúdo de usuário e sem data recuperada; recuperado via resumo de busca.

- claim: A Garmin mantém um artigo de suporte dedicado ao caso "Garmin Connect Course Took Me on an Unpaved Road", o que sugere que o roteamento do Connect não garante superfície e o tratamento é por ajuste/exceção, não por camada de piso.
  source: https://support.garmin.com/en-US/?faq=HxQRMArEad5d7MAkqZslt7
  publisher: Garmin Customer Support
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Garmin Connect
  nota: só o título foi recuperado; ler a página na rodada 2.

- claim: Os dispositivos Garmin (linhas fēnix/quatix, manuais web) expõem "Routing Settings" com opção de escolher tipos de via a evitar, isto é, a preferência de superfície é config de dispositivo/roteamento e não análise de rota.
  source: https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-4D9C1A64-B6FE-466C-87D7-5A31C3CFDED5.html
  publisher: Garmin (manual do proprietário)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: capability
  app: Garmin Connect
  nota: recuperado via resumo de busca; é manual de relógio, não do Connect web.

## Por app

### Strava
Faz **planejamento** com consciência de piso: preferência pavimentado/terra/qualquer na criação de rota, tag de percentual pavimentado nas rotas sugeridas, e terreno visível no mapa. **Calcula** por OpenStreetMap — o glossário admite isso literalmente, incluindo as tags de superfície — com um possível ingrediente próprio (tipo de quadro dos atletas) que não consegui confirmar no texto da página. **Mostra** por estilo de linha e cor: tracejado = não pavimentado, laranja sólido = pavimentado, branco = indefinido; no glossário de mapas o vocabulário é mais fino (branco sólido = estrada, rosa sólido = "track" do OSM, rosa tracejado = trilha). **Não faz**, pelo que a documentação recuperada mostra: piso da atividade *já feita* (o material é todo sobre rotas planejadas), percentual por tipo de superfície granular (só pavimentado/não), e correção de superfície dentro do app — há pedido aberto na comunidade para isso.

### Komoot
É o mais explícito conceitualmente: separa **way type** (path, cycleway, street, highway, trail, singletrack, road) de **surface type** (sand, asphalt, cobblestones, gravel) e usa os dois, mais acessibilidade da via, para recomendar tours por nível de experiência. No planejador a quebra da rota inteira sai por um filtro nas configurações. O perfil de elevação é colorido por **inclinação** (verde plano, vermelho íngreme), não por piso — os dois eixos vivem em lugares diferentes. Clima ao longo da rota é Premium. Ponto em aberto: se a mesma quebra aparece em tour **gravado** — os títulos de páginas de tour indexadas sugerem que sim, mas o HTML que consegui puxar de um tour gravado não trouxe a seção.

### Ride with GPS
O mais preciso na taxonomia útil para pneu: pavimentado = asphalt/concrete/tarmac/chip seal (linha sólida); não pavimentado = gravel/dirt/natural-unimproved (tracejado); **"unknown"** quando o dado é insuficiente — assume a lacuna em vez de fingir cobertura. Diferencial de visualização: a superfície aparece **no traçado E no perfil de elevação**, o que casa piso com inclinação no mesmo eixo de distância. No roteamento há seletor Paved/Unpaved/Any. Gratuito em todos os tiers. Não consegui confirmar a fonte do dado (presumivelmente OSM, mas nenhuma fonte recuperada afirma isso) nem se a camada de superfície aparece em passeios gravados.

### Garmin Connect
O mais fraco nos quatro, pela evidência que consegui: não há camada de superfície na linha do curso — o usuário infere pela simbologia do mapa base (path fino preto ≈ gravel; road grosso ≈ asfalto). A Garmin mantém artigo de suporte para o sintoma "meu curso me jogou numa estrada de terra", e a alavanca real é a configuração de roteamento do dispositivo (tipos de via a evitar), não uma análise. Cobertura desta rodada é rasa e toda de baixa confiança: nenhuma página oficial do Connect foi lida integralmente.

## Pistas para a rodada 2

- **Contradição a resolver (Komoot):** páginas de tour indexadas mostram rótulos "Way Types" e "Surface" com categorias (Unpaved, Paved, Asphalt, Natural, State Road, Mountain Hiking Path…), mas o HTML servido do tour gravado que fetchei não trouxe a seção. Testar com um tour de ciclismo recente e com o app; a pergunta que importa para nós é exatamente **piso de atividade já feita**.
- **Fonte do dado do RwGPS:** nenhuma fonte recuperada disse "OpenStreetMap". Confirmar (help center via cache/Google, ou o post oficial do blog com JS renderizado).
- **A alegação "own data on bike frames" da Strava** — se verdadeira, é um método híbrido interessante (inferir piso pelo tipo de bike de quem passou ali). Vale confirmar no texto de https://support.strava.com/en-us/articles/15401756-generated-community-routes.
- **Entidades novas que apareceram:** Strautomator (gearwear), Componentry, Biker (App Store) — todos vivem do buraco de alerta de desgaste por componente na Strava. Terceiros que preenchem lacuna são mapa das lacunas.
- **Strava Community Hub como fonte de lacuna:** o board de ideias ("Editable surface type") é um catálogo de "o que não fazem" com voto de usuário. Vale uma varredura por "surface", "gravel", "unpaved".
- **Garmin:** ler o FAQ HxQRMArEad5d7MAkqZslt7, o thread do Edge Explore 2 ("all roads as paved") e checar se o Garmin Connect tem "Course Surface" ou dado de superfície em Trendline/Popularity Routing.
- **Perguntas abertas:** algum dos quatro colore o perfil de elevação **por piso** (RwGPS parece ser o único a juntar os dois)? Algum deles reporta "vias novas exploradas" (novidade vs. repetição de rota)? Qual deles mostra `smoothness`/`tracktype` do OSM, e não só paved/unpaved?

## Procurei e não achei

- **Dimensão (d) — contexto de rota — ficou praticamente descoberta.** Não busquei nesta rodada: tempo parado vs. em movimento (moving vs elapsed), semáforos/paradas, vento (headwind, mywindsock), clima na atividade registrada, noturno/iluminação, "novas vias exploradas". Orçamento de 15 chamadas esgotou nas dimensões (a)–(c). É o primeiro alvo da rodada 2.
- **Método documentado do RwGPS:** busquei o help center oficial de Surface Types — a página devolve **HTTP 403** para fetch automatizado; o post oficial do blog devolve só o título (conteúdo por JS). Nenhuma fonte recuperada nomeia a fonte de dados nem as tags OSM.
- **Tags OSM específicas:** nenhuma das quatro empresas nomeia as tags que consome (`surface=`, `tracktype=`, `smoothness=`, `highway=track`). O mais perto é o glossário da Strava, que cita "OpenStreetMaps and the tags associated with each surface" e o valor `track` do OSM, sem listar chaves.
- **Piso em atividade já registrada:** não achei documentação de nenhum dos quatro apps descrevendo quebra de superfície de um passeio **já feito** (só de rota planejada). Se isso se confirmar na rodada 2, é a lacuna competitiva mais relevante para a decisão em pauta.
- **Percentual por categoria fina de superfície** (ex.: "18% cobblestone"): só vi pavimentado/não pavimentado na Strava e no RwGPS; a komoot tem as categorias finas mas não recuperei a visualização com números.
- **Tier de piso na Strava e na komoot:** não achei declaração de gating para superfície em rota (só o clima na komoot, que é Premium). Não confirmado nos dois sentidos.

## Fontes lidas

1. https://support.strava.com/en-us/articles/15401687-route-terrain — "Route Terrain" (Strava Help Center) — lida via WebFetch
2. https://support.strava.com/en-us/articles/15402016-strava-maps-glossary — "Strava Maps Glossary" (Strava Help Center) — lida via WebFetch
3. https://www.komoot.com/tour-characteristics — "Tour characteristics" (komoot) — lida via WebFetch
4. https://www.komoot.com/help/routeplanner — "Route Planner Tips and Tricks" (komoot) — lida via WebFetch
5. https://www.komoot.com/tour/289408856 — página pública de tour gravado (komoot) — lida via WebFetch
6. https://ridewithgps.com/news/4930-introducing-surface-types — "Introducing: Surface Types" (blog oficial RwGPS) — fetch retornou só o título
7. https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types — "Surface Types" (RwGPS Help Center) — HTTP 403 no fetch; conteúdo via resumo de busca
8. https://support.strava.com/en-us/articles/15401756-generated-community-routes — "Generated Community Routes" (Strava Help Center) — via resumo de busca
9. https://communityhub.strava.com/t5/ideas/editable-surface-type/idi-p/26586 — "Editable surface type" (Strava Community Hub) — via resumo de busca
10. https://support.strava.com/en-us/articles/15401878-managing-shoe-notifications — "Managing Shoe Notifications" (Strava Help Center) — via resumo de busca
11. https://road.cc/content/tech-news/stravas-my-gear-tracker-expanded-bike-maintenance-286417 — "Strava expands 'My Gear' mileage tracker" (road.cc) — via resumo de busca
12. https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses — "Is there a way to see surface type on courses?" (Garmin Forums) — via resumo de busca
13. https://support.garmin.com/en-US/?faq=HxQRMArEad5d7MAkqZslt7 — "Garmin Connect Course Took Me on an Unpaved Road" (Garmin Support) — só título
14. https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-4D9C1A64-B6FE-466C-87D7-5A31C3CFDED5.html — "Routing Settings", fēnix 7 (manual Garmin) — via resumo de busca
