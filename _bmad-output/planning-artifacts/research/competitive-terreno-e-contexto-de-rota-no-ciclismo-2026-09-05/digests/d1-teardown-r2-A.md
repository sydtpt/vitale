# D1 · Teardown A · rodada 2 (piso de atividade gravada, contexto, contradições)

> Rodada executada em 2026-09-05, atrás do firewall de pesquisa: só web, só nesta execução.
> Orçamento gasto: 15 chamadas de ferramenta, 4 páginas lidas por WebFetch (uma delas
> devolveu 403), 9 consultas de busca. Onde a evidência recuperada é resumo de busca e não
> leitura da página primária, a `confidence` cai para `medium` ou `low` e isso está dito.

## Achados

- claim: A Strava afirma que "Crowdsourced data from OpenStreetMap determines surface types. Dashed lines indicate the section is unpaved, solid orange indicates the section is paved, and white is unspecified."
  source: https://support.strava.com/hc/en-us/articles/360049869011-Map-Types
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Strava

- claim: O tipo de mapa "surface type" da Strava é um recurso de assinante, acessível pelo controle "Change Map Type" **na página de detalhe da atividade** — ou seja, o piso aparece como camada de mapa sob a atividade gravada, não como estatística dela.
  source: https://support.strava.com/hc/en-us/articles/360049869011-Map-Types
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: capability
  app: Strava

- claim: A página de ajuda "Map Types" da Strava **não** menciona nenhum método de inferência de piso a partir do tipo de bicicleta dos atletas; a única fonte de dado citada é o OpenStreetMap.
  source: https://support.strava.com/hc/en-us/articles/360049869011-Map-Types
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: method
  app: Strava

- claim: A Strava não publica, em nenhuma página que esta rodada recuperou, uma porcentagem de piso (pavimentado/não pavimentado) de uma atividade gravada — só a linha tracejada no mapa.
  source: https://support.strava.com/hc/en-us/articles/360049869011-Map-Types
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Strava

- claim: O komoot define way type como "whether a route is a path, cycleway, street, highway, trail, singletrack or road" e surface type como "the actual condition of these particular routes: whether it's sand, asphalt, cobblestones, or gravel".
  source: https://www.komoot.com/tour-characteristics
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: high
  class: capability
  app: Komoot

- claim: A página "Route characteristics" do komoot enquadra way/surface types como informação **de rota, para antes de sair** ("Each komoot route delivers detailed characteristic information on way and surface types"), sem nenhuma menção a atividades gravadas nem a gráficos de porcentagem.
  source: https://www.komoot.com/tour-characteristics
  publisher: komoot
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Komoot

- claim: Uma página pública de Tour **gravado** do komoot (atividade de 26/04/2025, 12,2 km, 03:17, 310 m de ganho) exibe duração, distância, velocidade média e ganho/perda de elevação, e **não** exibe seção "Way Types" ou "Surfaces" com porcentagens.
  source: https://www.komoot.com/tour/2191223099
  publisher: komoot
  pub_date: 2025-04-26
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: Komoot

- claim: O Ride with GPS mostra a superfície como **porcentagem do total** além do traçado: "The surface breakdown is shown as a percentage of the total route, as well as in a visual representation", e a informação entra também no perfil de elevação.
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center (recuperado via resumo de busca; a página devolveu HTTP 403 ao acesso direto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: viz
  app: RwGPS

- claim: O RwGPS classifica em três estados — paved (linha sólida: asphalt, concrete, chip-and-seal), unpaved (tracejada: gravel, dirt, natural/unimproved trails) e unknown (linha branca contornada, quando falta dado).
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center (via resumo de busca; 403 no acesso direto)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: capability
  app: RwGPS

- claim: O dado de superfície do RwGPS vem do OpenStreetMap e admite correção pelos próprios usuários; o recurso foi lançado em setembro de 2021 e é gratuito para todos os planos.
  source: https://ridewithgps.com/news/4930-introducing-surface-types
  publisher: Ride with GPS (anúncio) / cobertura em BIKEPACKING.com e velo.outsideonline.com
  pub_date: 2021-09
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: RwGPS

- claim: A documentação do RwGPS recuperada nesta rodada descreve Surface Types em termos de **route planning** ("as you plan or view routes"); nenhuma página lida disse que a quebra de piso é calculada para um **ride gravado**.
  source: https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types
  publisher: Ride with GPS Help Center (via resumo de busca)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: RwGPS

- claim: No Garmin, o que existe de "superfície" é distinção visual de traço no mapa de **courses** — trechos de cascalho aparecem como "paths" (linha fina, preta) e pavimentados como "roads" (linha grossa) — discutido por usuários no fórum oficial, sem nenhum documento de suporte descrevendo tipo de piso como propriedade de atividade.
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses
  publisher: Garmin Forums (fórum oficial, conteúdo de usuários)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Garmin Connect

- claim: A Strava tem artigo de ajuda dedicado a "Moving Time, Speed, and Pace Calculations" e outro a "Auto-Pause", isto é, tempo em movimento vs. decorrido é conceito de primeira classe documentado.
  source: https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: context
  app: Strava

- claim: A Strava respeita as pausas gravadas no arquivo (auto ou manuais) e usa o "timer time" para o moving time; com auto-pause desligado, ela calcula tempo em movimento e em repouso no **upload**.
  source: https://support.strava.com/en-us/articles/15402141-auto-pause
  publisher: Strava Help Center (via resumo de busca, corroborado por fio no Garmin Forums)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Strava

- claim: A Strava mantém um post de engenharia sobre a evolução do auto-pause ("Improving Auto-Pause for Everyone"), indicando que o algoritmo é acelerômetro/movimento e não só GPS.
  source: https://medium.com/strava-engineering/improving-auto-pause-for-everyone-13f253c66f9e
  publisher: Strava Engineering (Medium)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: Strava

- claim: A Strava exibe nativamente clima básico na atividade (sensação térmica e precipitação), mas a temperatura mostrada é sempre a do **início** da atividade, vinda de uma estação meteorológica próxima.
  source: https://communityhub.strava.com/general-chat-2/the-weather-data-doesn-t-make-any-sense-this-is-frustrating-how-can-i-solved-it-7655
  publisher: Strava Community Hub (fórum oficial)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: context
  app: Strava

- claim: Ferramentas de terceiros preenchem a lacuna de clima na Strava escrevendo dados na atividade: Strautomator ("add icons, temperature, humidity, wind and other weather conditions to your activity name or description"), wthr.app e Klimat.
  source: https://strautomator.com/feature/weather
  publisher: Strautomator
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: context
  app: terceiro: Strautomator / wthr.app / Klimat

- claim: O myWindsock enriquece atividades da Strava com análise de vento por ponto do percurso — "wind speed, direction, yaw angles and more for any point on the course" — com código de cor: vermelho para headwind, roxo para crosswind, azul-claro para tailwind.
  source: https://mywindsock.com/page/help/strava/
  publisher: myWindsock
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: context
  app: terceiro: myWindsock

- claim: O myWindsock permite reler **rides passados** no contexto do vento ("view past rides in the context of the weather to see if the wind was at your back during a PR"), e escreve o relatório de volta na atividade da Strava.
  source: https://mywindsock.com/page/help/strava/add-mywindsock-data-to-strava-activity/
  publisher: myWindsock
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: context
  app: terceiro: myWindsock

- claim: As fontes de dado do myWindsock são modelos da NOAA/NCEP e do UK Met Office, ajustados por geografia para prédios, árvores e topografia.
  source: https://www.bikeradar.com/news/mywindsock-takes-strava-nerdiness-to-the-next-level
  publisher: BikeRadar
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: method
  app: terceiro: myWindsock

- claim: A Strava tem Personal Heatmaps para assinantes, com seletor por grupo de esporte e controles de privacidade/commutes, acessível por Maps na navegação do site e do app.
  source: https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps
  publisher: Strava Help Center
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: viz
  app: Strava

- claim: A métrica de "vias novas exploradas" não é nativa da Strava: quem a oferece é o VeloViewer, com Explorer Tiles (grade de ~1 km² global) que marcam tiles visitados a partir das atividades sincronizadas, mais um "Visits by me" que é o heatmap pessoal de tiles.
  source: https://veloviewer.com/explorer
  publisher: VeloViewer
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gap
  app: terceiro: VeloViewer

- claim: A Strava adicionou componentes de bicicleta ao My Gear, mantendo quilometragem acumulada por peça a partir dos rides enviados; componentes só se editam no site, enquanto bikes e tênis já estão no app.
  source: https://road.cc/content/tech-news/stravas-my-gear-tracker-expanded-bike-maintenance-286417
  publisher: road.cc
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gear
  app: Strava

- claim: A Strava oferece notificação de quilometragem para **tênis de corrida**, mas não para componentes de bicicleta como pneus e correntes — a lacuna que os terceiros exploram.
  source: https://www.componentry.app/blog/strava-bike-maintenance
  publisher: Componentry (parte interessada — vende a solução; rebaixar)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Strava

- claim: O Strautomator vende exatamente essa função — "GearWear", com aviso de desgaste e quilometragem por componente da Strava.
  source: https://strautomator.com/feature/gearwear
  publisher: Strautomator
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gear
  app: terceiro: Strautomator

- claim: O Componentry usa **distância** para incrementar contadores de desgaste (correntes, cassetes, pneus, pastilhas) e usa a **data do ride** para lembretes por calendário, quando o serviço se mede melhor em tempo do que em km.
  source: https://www.componentry.app/blog/strava-bike-maintenance
  publisher: Componentry (parte interessada)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: terceiro: Componentry

- claim: O Garmin Connect tem Gear Tracking por distância, horas e dias de uso, com categorias que incluem "Bike Component", e envia notificação no celular quando o equipamento se aproxima do fim de vida.
  source: https://wiki.garminrumors.com/Gear_Tracking
  publisher: Garmin Wiki (garminrumors — não é fonte primária Garmin)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: Garmin Connect

- claim: Os ciclocomputadores Edge ganharam rastreamento de componentes **no próprio aparelho**, com tela de barras de progresso e alerta quando cada peça se aproxima da vida útil teórica.
  source: https://www.bikeradar.com/news/garmin-on-device-gear-tracking
  publisher: BikeRadar
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gear
  app: Garmin Connect

- claim: Uma atualização de 2026 introduziu "Gear Collections" no Garmin Connect — agrupar equipamentos e atribuí-los a uma atividade como conjunto, com uso contabilizado para todos os itens de uma vez.
  source: https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/439583/gear-collections-should-automatically-assign-components-based-on-the-selected-bike
  publisher: Garmin Forums (fórum oficial, conteúdo de usuários)
  pub_date: 2026
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: Garmin Connect

- claim: No Garmin Connect a atribuição automática de equipamento funciona só para as categorias principais de atividade (Running, Cycling, Walk, Swimming), não para as subcategorias.
  source: https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/225619/cycling-activity-types-associated-to-gear-types
  publisher: Garmin Forums (fórum oficial, conteúdo de usuários)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: Garmin Connect

## Resposta a A (piso de atividade gravada)

**Nenhum dos quatro publica a proporção de piso de uma atividade gravada.** O mais perto é a
Strava: o tipo de mapa "surface type" — dado do OpenStreetMap, tracejado = não pavimentado,
laranja sólido = pavimentado, branco = não especificado — é oferecido pelo controle "Change
Map Type" **na página de detalhe da atividade**, mas continua sendo pintura de basemap, não
estatística: nenhuma página recuperada nesta rodada mostra um número, uma porcentagem ou uma
barra de composição de piso para o que foi pedalado
([Strava Help Center, Map Types](https://support.strava.com/hc/en-us/articles/360049869011-Map-Types)).
O RwGPS é o único que calcula a **porcentagem** do total ("The surface breakdown is shown as a
percentage of the total route"), e toda a documentação recuperada a enquadra em *route* — planejar
e visualizar rotas, com o dado entrando no perfil de elevação — sem nenhuma frase que estenda o
cálculo a um ride gravado
([RwGPS Help Center, Surface Types](https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types)).
O komoot descreve way/surface types como característica **de rota**, "para saber o que esperar
antes de sair" ([komoot, Route characteristics](https://www.komoot.com/tour-characteristics)), e uma
página pública de Tour gravado que abri mostra só duração, distância, velocidade média e elevação —
nenhuma seção de Way Types ou Surfaces ([Tour 2191223099](https://www.komoot.com/tour/2191223099)).
No Garmin não achei nem documentação nem discussão de piso como propriedade de atividade: o único
fio no fórum oficial trata de distinguir cascalho por espessura de linha em **courses**
([Garmin Forums, Edge 530](https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses)).
Conclusão operacional: **a composição de piso do que já foi pedalado é um espaço vazio** — o achado
central desta rodada, e a oportunidade mais barata de diferenciação, já que o dado (GPS + OSM) é o
mesmo que os quatro usam no planejamento.

Ressalva honesta: os três achados de ausência (komoot, RwGPS, Garmin) são evidência de **não ter
encontrado**, não prova de inexistência. O caso do RwGPS é o mais frágil — a página de ajuda
devolveu 403 e só a li por resumo de busca; a do komoot é a segunda mais frágil, porque a página de
Tour pode renderizar seções por JavaScript ou só para quem está logado.

## Resposta a B — app × contexto

| Contexto | Strava | Komoot | RwGPS | Garmin Connect |
|---|---|---|---|---|
| Parado vs. movimento | **Nativo** — moving time vs. elapsed com artigo de ajuda próprio; respeita pausas do arquivo, e com auto-pause off calcula movimento/repouso no upload | não achei | não achei | não achei |
| Vento (headwind/tailwind) | **terceiro: myWindsock** — vento por ponto do percurso, yaw, headwind/cross/tail por cor, relê rides passados e escreve de volta na atividade | não achei | não achei | não achei |
| Clima / temperatura | **Nativo, mas pobre** — sensação térmica e precipitação, temperatura só do **início**, de estação próxima · **terceiro: Strautomator, wthr.app, Klimat** para dado ao longo do ride | não achei | não achei | não achei |
| Noturno / iluminação | não achei | não achei | não achei | não achei |
| Vias novas / heatmap pessoal | **Nativo** (Personal Heatmaps, assinante) para *onde já passei*; **terceiro: VeloViewer** (Explorer Tiles ~1 km², "Visits by me") para *o que é novo* | não achei | não achei | não achei |
| Equipamento / desgaste | **Nativo parcial** — My Gear com componentes de bicicleta e km por peça (componentes só no site); alerta de quilometragem existe para tênis, **não** para componentes de bike · **terceiro: Strautomator (GearWear), Componentry** para alerta por km e por calendário | não achei | não achei | **Nativo** — Gear Tracking por distância/horas/dias, categoria "Bike Component", notificação de fim de vida; alertas com barras de progresso **no próprio Edge**; Gear Collections em 2026 |

Leia a tabela como mapa do que esta rodada conseguiu recuperar, não como censo: o orçamento de 15
chamadas foi consumido quase todo em Strava e nas contradições, e as colunas de komoot, RwGPS e
Garmin ficaram sub-pesquisadas em contexto. "não achei" ali significa literalmente isso.

Duas leituras que mudam decisão de produto, se sobreviverem a checagem:
1. **Vento e clima ao longo do trecho são território de terceiros**, não dos quatro grandes. A
   Strava dá um único ponto (o início). Quem quer saber *em que trecho o vento bateu de frente*
   paga myWindsock ou reconstrói o cálculo — o que um app pessoal com GPS + histórico horário de
   vento consegue fazer sozinho.
2. **Alerta de desgaste por componente é lacuna da Strava e força da Garmin.** A Strava tem o
   contador mas não o alarme para peças de bike; a Garmin tem os dois, inclusive no aparelho.

## Resposta a C — as duas contradições

**C1 — o komoot mostra Way Types/Surface de um tour GRAVADO?** *Não resolvido, com forte indício de
que não.* Duas evidências apontam para "não": a página oficial de características fala em "Each
komoot **route** delivers detailed characteristic information on way and surface types", enquadrando
tudo em planejar antes de sair, sem menção a atividades; e uma página pública de Tour gravado real
(26/04/2025) trouxe só duração, distância, velocidade e elevação, sem seção de Way Types ou Surfaces
([komoot](https://www.komoot.com/tour-characteristics) ·
[Tour 2191223099](https://www.komoot.com/tour/2191223099)). O que impede fechar: não achei nenhum
artigo do support.komoot.com que diga explicitamente o que a tela de um tour **gravado** contém, e a
página de tour pode esconder seções atrás de JavaScript ou de login. Para fechar na próxima rodada:
abrir 2–3 tours gravados públicos de **ciclismo** (não caminhada) e o artigo do support sobre
"Tour details".

**C2 — a Strava infere piso pelo tipo de bicicleta dos atletas ou só pelo OSM?** *Resolvido: só pelo
OSM, até onde a Strava documenta.* A frase da página de ajuda é inequívoca sobre a origem do dado —
"Crowdsourced data from OpenStreetMap determines surface types" — e a página inteira não menciona
nenhum sinal derivado dos atletas (tipo de bicicleta, velocidade, cadência, vibração)
([Strava Help Center, Map Types](https://support.strava.com/hc/en-us/articles/360049869011-Map-Types)).
Nota para não confundir origem: a busca por método híbrido devolveu um paper acadêmico —
["Surface Type Estimation from GPS Tracked Bicycle Activities", arXiv:1809.09745](https://arxiv.org/pdf/1809.09745) —
que **existe e faz** estimativa de piso a partir de atividades de bicicleta com GPS, mas é literatura
independente, **não** documentação da Strava; a hipótese do método híbrido provavelmente nasceu de
uma leitura cruzada desse tipo de trabalho. Como pista técnica para o app próprio, porém, é o
achado mais interessante da rodada: existe método publicado para inferir superfície do traço, o que
abre caminho para corrigir/complementar o OSM em vez de só consumi-lo. (O paper não foi lido nesta
execução — só o título e o fato de existir estão verificados.)

## Procurei e não achei

- **Piso de atividade gravada em komoot, RwGPS e Garmin Connect.** Buscas: "Komoot recorded tour way
  types surface", "komoot Tour details way types recorded", "Ride with GPS ride details surface
  types", "Garmin Connect activity surface type cycling". Nenhuma devolveu página oficial ligando
  superfície a atividade concluída.
- **Release notes 2025–2026 dos quatro sobre superfície.** Nenhuma consulta trouxe changelog datado
  nessa janela; toda a evidência de superfície que recuperei é de help center sem data ou de
  cobertura de imprensa de 2021 (lançamento do RwGPS).
- **Noturno / iluminação em qualquer um dos quatro.** Não sobrou orçamento para consulta dedicada —
  a linha da tabela está vazia por falta de busca, não por busca frustrada. Fica como primeira
  pergunta da próxima rodada.
- **Contexto (parado, vento, clima, vias novas) em komoot, RwGPS e Garmin.** Mesmo motivo: o
  orçamento foi consumido em A, em C e no eixo Strava.
- **Página de ajuda do RwGPS lida em primeira mão.** HTTP 403 no WebFetch; todo o conteúdo de
  Surface Types entrou por resumo de busca, daí a `confidence: low` nesses claims.
- **Datas de publicação.** Praticamente todo o help center dos quatro apps é publicado sem data
  visível; por isso tantos `pub_date: s.d.` — e por isso o critério de frescor de 3 meses não pôde
  ser aplicado a quase nada nesta rodada.

## Fontes lidas

1. https://www.komoot.com/tour-characteristics — komoot, "Route characteristics" (WebFetch)
2. https://support.strava.com/hc/en-us/articles/360049869011-Map-Types — Strava Help Center, "Map Types" (WebFetch)
3. https://www.komoot.com/tour/2191223099 — komoot, Tour gravado de 26/04/2025 (WebFetch)
4. https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types — RwGPS Help Center, "Surface Types" (WebFetch → HTTP 403; conteúdo só por resumo de busca)
5. https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations — Strava Help Center (via busca)
6. https://support.strava.com/en-us/articles/15402141-auto-pause — Strava Help Center (via busca)
7. https://medium.com/strava-engineering/improving-auto-pause-for-everyone-13f253c66f9e — Strava Engineering (via busca)
8. https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps — Strava Help Center (via busca)
9. https://mywindsock.com/page/help/strava/ — myWindsock, Strava Help (via busca)
10. https://mywindsock.com/page/help/strava/add-mywindsock-data-to-strava-activity/ — myWindsock (via busca)
11. https://www.bikeradar.com/news/mywindsock-takes-strava-nerdiness-to-the-next-level — BikeRadar (via busca)
12. https://strautomator.com/feature/gearwear — Strautomator, GearWear (via busca)
13. https://strautomator.com/feature/weather — Strautomator, Weather (via busca)
14. https://www.componentry.app/blog/strava-bike-maintenance — Componentry, parte interessada (via busca)
15. https://road.cc/content/tech-news/stravas-my-gear-tracker-expanded-bike-maintenance-286417 — road.cc (via busca)
16. https://www.bikeradar.com/news/garmin-on-device-gear-tracking — BikeRadar (via busca)
17. https://wiki.garminrumors.com/Gear_Tracking — Garmin Wiki / garminrumors (via busca)
18. https://veloviewer.com/explorer — VeloViewer, Explorer Tiles (via busca)
19. https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses — Garmin Forums (via busca)
20. https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/439583/gear-collections-should-automatically-assign-components-based-on-the-selected-bike — Garmin Forums (via busca)
21. https://communityhub.strava.com/general-chat-2/the-weather-data-doesn-t-make-any-sense-this-is-frustrating-how-can-i-solved-it-7655 — Strava Community Hub (via busca)
22. https://ridewithgps.com/news/4930-introducing-surface-types — Ride with GPS, anúncio de 2021-09 (via busca)
23. https://arxiv.org/pdf/1809.09745 — "Surface Type Estimation from GPS Tracked Bicycle Activities" (só título/existência verificados)

> Itens 1–4 foram abertos com WebFetch (o 4 falhou com 403). Os demais entraram como URL +
> publisher + trecho vindos de resultados de busca, e por isso carregam `confidence` menor.
