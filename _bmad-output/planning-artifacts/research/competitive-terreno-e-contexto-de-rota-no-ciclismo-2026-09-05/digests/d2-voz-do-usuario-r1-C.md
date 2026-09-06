# D2 · Voz do usuário e lacunas · rodada 1

> **Aviso de método.** Quatro páginas foram lidas na íntegra com WebFetch. Várias outras
> devolveram **HTTP 403** ao crawler (Strava Community Hub, Weight Weenies, The Service
> Course) e o **Reddit está bloqueado** para este agente (a API recusa `reddit.com` como
> domínio). Onde a página não pôde ser lida, o claim vem do **resumo do buscador** e está
> marcado com `confidence: medium|low` e a observação `[só snippet]`. Nada aqui foi
> escrito de memória.

## Achados

- claim: Um review pessoal de gravel decidiu ficar em 45 mm — e não subir para 50 mm+ — pela mistura de terreno que pedala, por percepção e não por medição: "On the road, they're great – quick enough to keep pace with road bikes, not as squirmy in the corners and fast on lighter gravel roads"; e sobre o pneu largo, que "feel ponderous" e "squirmy in corners" no asfalto.
  source: https://www.bikeradar.com/features/opinion/everyone-says-bigger-gravel-tyres-are-better-i-m-not-convinced
  publisher: BikeRadar (coluna de opinião, Warren Rossiter)
  pub_date: 2026-01-17
  accessed: 2026-09-05
  confidence: high
  class: decision-evidence
  app: —

- claim: O mesmo autor reconhece o trade-off do pneu mais estreito ("thinner tyres find their limits quicker in rougher conditions") e o compensa com suspensão, não com dado — a decisão de largura na imprensa especializada é argumentada por sensação e por tipo de terreno declarado, nunca por percentual medido do próprio histórico.
  source: https://www.bikeradar.com/features/opinion/everyone-says-bigger-gravel-tyres-are-better-i-m-not-convinced
  publisher: BikeRadar
  pub_date: 2026-01-17
  accessed: 2026-09-05
  confidence: high
  class: gap
  app: —

- claim: Um usuário de Edge Explore 2 relata que o percentual de superfície do Garmin é simplesmente falso para ele: "Garmin Connect and the Edge Explore display 100% of my rides as 100% paved!", sendo que 95% dos seus pedais são em trilha de MTB.
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums (Edge Explore 2)
  pub_date: 2024 (thread marcada "over 1 year ago" em 2026-09)
  accessed: 2026-09-05
  confidence: high
  class: data-trust
  app: Garmin Connect / Edge Explore 2

- claim: Outro usuário do mesmo fio desconfia do número mesmo quando ele é plausível: "88% paved and 12% unpaved, which I think is incorrect" — "there was more than 12% unpaved" — e conclui: "Makes me wonder how garmin determines the type of surface."
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums (usuário kochmans)
  pub_date: 2024
  accessed: 2026-09-05
  confidence: high
  class: data-trust
  app: Garmin Connect

- claim: A explicação que a comunidade dá para o piso errado é sempre a mesma — o dado de base: "The 'surface' is part of the OSM road meta data and might not be set correctly for your local unpaved roads" (usuário L.Rouge).
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums
  pub_date: 2024
  accessed: 2026-09-05
  confidence: high
  class: data-trust
  app: Garmin Connect / OSM

- claim: **Contradição útil:** naquele caso a culpa NÃO era do OSM. O usuário achou a causa meses depois — "It turns out that in my country the local Garmin retailer makes his own local topographical map...the road labeling is definitely wrong!" — e a decisão que tomou foi desligar o mapa custom, o que corrigiu o percentual: "all my rides are accurately recorded as paved/unpaved."
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums (usuário mjanowski)
  pub_date: 2025 ("11 months ago")
  accessed: 2026-09-05
  confidence: high
  class: data-trust
  app: Garmin Connect

- claim: Usuários não conseguem editar o tipo de superfície de atividades passadas no Garmin Connect — o número errado fica no histórico para sempre. [só snippet]
  source: https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved
  publisher: Garmin Forums
  pub_date: 2024
  accessed: 2026-09-05
  confidence: medium
  class: complaint
  app: Garmin Connect

- claim: O Strava tem um bug reconhecido em que os percentuais de superfície não fecham 100% — o exemplo do fio é "16% paved, 32% dirt, 13% not specified", que soma 61%. [só snippet — communityhub.strava.com devolve 403 ao crawler]
  source: https://communityhub.strava.com/archived-strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646
  publisher: Strava Community Hub (thread "[Known Issue]")
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: complaint
  app: Strava

- claim: Usuários do Strava pedem poder marcar trechos com superfície e nota pessoal — os exemplos citados são "muddy passage", "avoid when raining" e "Fast cat. 1 gravel" — ou seja, querem qualificar o piso com condição e época, não só classificá-lo. [só snippet — 403]
  source: https://communityhub.strava.com/general-chat-2/user-specified-surface-types-and-road-conditions-9030
  publisher: Strava Community Hub
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: feature-request
  app: Strava

- claim: O pedido de análise de vento no intervals.icu é explicitamente por "elevação sentida": "transform that in felt elevation while cycling" e "I'd love the be able to graph the 'felt' elevation and 'felt' % and compare with the 'real'" — o motivo é morar em lugar ventoso, "a extemely windy place where cycling with 12-17 knots sometimes in the norm".
  source: https://forum.intervals.icu/t/wind-impact-on-cycling/80393
  publisher: Intervals.icu Forum (usuário Sapo74)
  pub_date: 2024-11-21 / 2024-12-04
  accessed: 2026-09-05
  confidence: high
  class: feature-request
  app: intervals.icu (referência ao MyWindsock)

- claim: Segundo usuário confirma a mesma necessidade e a liga à direção da rota: "its both very flat and very windy here", com "huge speed differences depending on the direction I'm traveling".
  source: https://forum.intervals.icu/t/wind-impact-on-cycling/80393
  publisher: Intervals.icu Forum (usuário WindWarrior)
  pub_date: 2024-11-21
  accessed: 2026-09-05
  confidence: high
  class: feature-request
  app: intervals.icu

- claim: Há pedido para previsão do tempo em treinos futuros com a decisão nomeada: adaptar a rota planejada "by starting into headwind and returning with tailwinds" — vento decidindo sentido e horário da saída. [só snippet]
  source: https://forum.intervals.icu/t/make-weather-forecatst-available-for-future-private-workouts/129018
  publisher: Intervals.icu Forum
  pub_date: s.d. (2026, thread recente)
  accessed: 2026-09-05
  confidence: medium
  class: feature-request
  app: intervals.icu

- claim: O intervals.icu já anexa clima histórico às atividades (fonte Open-Meteo, com vento na perspectiva do atleta) e tem em desenvolvimento algo "MyWindsock-style" com percentual e duração de vento de frente/de costas — ou seja, headwind/tailwind por atividade está deixando de ser lacuna nesse app. [só snippet]
  source: https://forum.intervals.icu/t/weather-on-activities-and-map/79308
  publisher: Intervals.icu Forum (anúncio do desenvolvedor)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: feature-request
  app: intervals.icu

- claim: No rastreio de equipamento, o pedido dominante é granularidade **por atividade**, não por bicicleta: "I could specify (for the specific activity done) one bike and then select the wheels, shoes, pedals, powermeter, computer etc. that I used for that specific wo".
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (usuário Alessandro_Cella)
  pub_date: 2022-04-22
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: intervals.icu

- claim: O vínculo grosseiro gear↔bike quebra com troca de peça: "I use to swap pedals from Ultegra to PM Assioma and wish I could track cleat usage" / "I swap pedals and use other shoes and cleats with same bike" — o mesmo problema que uma troca sazonal de pneu na mesma bike produz.
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (usuário Oleg_Gio)
  pub_date: 2022-04-20 / 2022-04-21
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: intervals.icu

- claim: A atribuição errada polui a quilometragem do equipamento: "How can i track my Kickr...looks like it counts every ride, indoor and outdoor" — o contador soma o que não desgasta o pneu.
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (usuário thrstn)
  pub_date: 2022-04-22
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: intervals.icu

- claim: Quem adota rastreio de componente precisa de quilometragem inicial retroativa: "I added some gear (e.g. bike chain, bottom bracket, etc) and back-dated the purchase dates" — e o pedido persiste em 2026 num fio próprio ("Retroactively Add Starting Mileage for Gear").
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492 · https://forum.intervals.icu/t/retroactively-add-starting-mileage-for-gear/131111
  publisher: Intervals.icu Forum (usuário Robert_Keith_Oswald)
  pub_date: 2022-04-11 (o segundo fio, s.d./recente)
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: intervals.icu

- claim: Ciclistas dependem de apps de manutenção de terceiros e ficam órfãos quando eles morrem: "I'm using the app 'Pro Bike Garage' but seems the developer left it behind so I was looking to migrate my gear/reminders somewhere else".
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (usuário Filippo)
  pub_date: 2022-04-12
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: Pro Bike Garage → intervals.icu

- claim: Existe demanda por importar os componentes já cadastrados no Strava em vez de recadastrar: "Are you able to fetch the components of each gear from Strava?".
  source: https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492
  publisher: Intervals.icu Forum (usuário MaxBarj)
  pub_date: 2022-04-12
  accessed: 2026-09-05
  confidence: high
  class: gear
  app: Strava / intervals.icu

- claim: O gear tracking do Strava é descrito como contador puro: "no thresholds, no alerts, no visual indicators, and no path to action"; a página de componentes fica escondida na web e não existe no app; e valem as restrições "one component per type per bike, retired components can never be un-retired, nothing transfers between bikes". [só snippet — theservicecourse.net devolveu 403]
  source: https://theservicecourse.net/strava-gear-tracking/ · https://www.componentry.app/blog/strava-bike-maintenance
  publisher: The Service Course / Componentry (blogs de produto — parte interessada)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: gear
  app: Strava
  
- claim: Os limiares que os apps não aplicam sozinhos circulam como números conhecidos: corrente trocada a 0,5% de alongamento, ~3.000–5.000 km; cassete durando 2–3 correntes; pneu traseiro terminando entre 3.000 e 6.000 km. [só snippet, blog comercial — tratar como ordem de grandeza, não como fonte técnica]
  source: https://theservicecourse.net/strava-gear-tracking/
  publisher: The Service Course (blog)
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gear
  app: Strava

- claim: A correção do piso é lenta por construção: o Komoot instrui o usuário a editar o OpenStreetMap e avisa que a mudança leva "one to two weeks" para aparecer no planner, "though some can take up to four weeks" — o ciclista que descobre um erro não o conserta na hora.
  source: https://support.komoot.com/hc/en-us/articles/360022830972-Improving-the-komoot-map-using-OpenStreetMap
  publisher: Komoot Support
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: data-trust
  app: Komoot / OSM

- claim: O OSM assume pavimentado quando não há tag de superfície — viés vindo de cidades ocidentais que quebra em zona rural, onde "road data is often added without specific surface tags", deixando o motor de rota sem saber se a estrada é de bike de estrada ou de MTB.
  source: https://lists.openstreetmap.org/pipermail/tagging/2014-September/019489.html
  publisher: OpenStreetMap tagging mailing list
  pub_date: 2014-09
  accessed: 2026-09-05
  confidence: low (fonte de 12 anos; entra só como origem histórica do viés)
  class: data-trust
  app: OSM

- claim: A própria classificação de atividade é frágil e contamina qualquer estatística por superfície: há fio de "Gravel ride saves as Road Cycling" no Garmin e bug no intervals.icu de "Gravel Ride activities not being taken into account for weekly Bike totals". [só snippet]
  source: https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/epix-2/400838/gravel-ride-saves-as-road-cycling · https://forum.intervals.icu/t/gravel-ride-activities-not-being-taken-into-account-for-weekly-bike-totals/130236
  publisher: Garmin Forums / Intervals.icu Forum
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: medium
  class: complaint
  app: Garmin Connect / intervals.icu

- claim: Ciclistas procuram um "multiplicador de equivalência" entre gravel e asfalto — existe fio dedicado no Bike Forums: "How much harder is gravel riding vs road? ('Equivalence multiplier')". [só título e URL; o Bike Forums não foi lido nesta rodada]
  source: https://www.bikeforums.net/cyclocross-gravelbiking-recreational/1120061-how-much-harder-gravel-riding-vs-road-equivalence-multiplier.html
  publisher: Bike Forums
  pub_date: s.d.
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: —

- claim: A opção de filtrar rota por piso já é vendida como diferencial em apps menores (Bikemap: "filter by paved, unpaved and gravel surfaces as per your bike"; Komoot com perfis distintos de road/gravel/MTB) — a lacuna não é planejar por piso, é **medir o piso que já foi pedalado**. [só snippet]
  source: https://droidlore.com/cycling/cycling-apps-gravel
  publisher: DroidLore (review de apps)
  pub_date: 2026
  accessed: 2026-09-05
  confidence: low
  class: gap
  app: Bikemap / Komoot

## Padrões

1. **"O piso está errado" é a reclamação nº 1, e o usuário não tem conserto local** — 4 fontes independentes (fio do Garmin Edge Explore 2, help do Komoot, lista de tagging do OSM, thread do Strava sobre percentuais que não somam). Em todas, o app expõe o número mas não expõe a procedência nem permite correção na atividade.
2. **A causa nem sempre é o OSM** — 1 fonte forte contradiz a narrativa fácil: o percentual 100% pavimentado vinha do mapa proprietário de um revendedor local, não do OSM. Lição de produto: um app pessoal deve **guardar de qual fonte/versão de mapa saiu cada trecho**, para poder recalcular quando a fonte muda.
3. **Percentual de superfície já existe em Strava e Garmin, mas como número solto por atividade** — 3 fontes. Ninguém lido oferece a soma por ano, por bike ou por pneu; e quando o percentual existe, ele é desconfiado (2 usuários independentes no mesmo fio).
4. **Gear tracking: o pedido repetido é componente por atividade, não por bicicleta** — 4 usuários independentes num único fio do intervals.icu (troca de pedal/taco, seleção de rodas por treino, rolo somando como se fosse rua, quilometragem inicial retroativa). Uma troca sazonal de pneu na mesma bike cai exatamente nesse buraco.
5. **Nenhum app dá limiar, alerta ou ação** — 2 blogs de produto convergem na mesma descrição do Strava ("counter... no alerts"). O mercado de apps de manutenção existe porque essa camada falta, e é instável (o "Pro Bike Garage" abandonado).
6. **Vento é a segunda dimensão de contexto mais pedida, e o pedido já vem com a decisão embutida** — 3 fios do intervals.icu: "elevação sentida", "sair contra o vento e voltar a favor", percentual de headwind/tailwind. Note que o intervals.icu está fechando essa lacuna agora — planejar contra ela é correr atrás.
7. **A decisão de largura de pneu, na literatura e nos fóruns lidos, nunca é tomada por medição do próprio histórico** — é tomada por sensação, por teste back-to-back de revista, ou por conselho. Este é o achado mais importante para a decisão em pauta: o app do dono fez algo que a fonte lida **não mostra ninguém fazendo**.

## Pistas para a rodada 2

- **Fios a ler inteiros:** `forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492` páginas 4, 5, 7 e 10 (o fio tem 10 páginas e só a 1ª foi lida — as posteriores devem trazer o que o desenvolvedor recusou e por quê); `bikeforums.net/.../1120061` (multiplicador de equivalência gravel×asfalto — é literalmente a métrica que um app pessoal poderia calibrar com dado próprio); `forums.garmin.com/.../237116` ("how does garmin determine gravel ride").
- **Contradição aberta:** o piso errado vem do OSM ou do mapa de base do device/app? Uma rodada 2 deveria buscar casos em que a correção no OSM **resolveu** (validando a via de conserto do Komoot) contra casos em que não resolveu.
- **Perguntas ainda sem nenhuma evidência:** tempo parado em semáforo; km por pneu como pedido explícito; decisão de **qual bike levar** por análise de rota; ciclovia paralela confundida com a rua (a hipótese (c) do brief não apareceu em nenhuma fonte — pode ser hipótese do autor, não dor observada).
- **Superfícies não tocadas:** reviews 1–3★ nas lojas (Komoot, Strava, RideWithGPS), Wandrer e VeloViewer (zero resultados úteis nesta rodada), comunidade Komoot, TrainerRoad forum, e buscas em português/neerlandês/francês — nenhuma foi feita, o orçamento acabou no inglês.

## Procurei e não achei

- **Reddit inacessível.** A busca com `allowed_domains: ["reddit.com"]` retorna erro explícito: o domínio não é acessível ao user agent. Nenhum r/cycling, r/gravelcycling, r/Strava ou r/bicycling entrou nesta rodada — e boa parte da "evidência de decisão" pedida no brief vive lá.
- **HTTP 403 ao ler:** `communityhub.strava.com` (os dois fios mais relevantes sobre superfície), `weightweenies.starbike.com` (fio "45 vs 40 tires, is wider more grip but slower?"), `theservicecourse.net`. Desses só há o resumo do buscador, marcado como tal.
- **Nenhum relato encontrado** de: troca de pneu decidida por medição de piso do próprio histórico; compra ou escolha de bicicleta decidida por análise de terreno de app; contagem de tempo parado em semáforo; alerta de desgaste de pneu por km que alguém use de fato.
- **Nenhuma evidência** de usuário reclamando de ciclovia paralela sendo confundida com a rua — a hipótese não se confirmou nem se refutou.

## Fontes lidas

Lidas integralmente (WebFetch com sucesso):

1. [Wind Impact on Cycling — Feature Requests](https://forum.intervals.icu/t/wind-impact-on-cycling/80393) — Intervals.icu Forum
2. [Bike and other gear usage tracking (página 1 de 10)](https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492) — Intervals.icu Forum
3. [Edge Explore 2 and Garmin Connect display all roads as paved!](https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved) — Garmin Forums
4. [Everyone says bigger gravel tyres are better, but I'm not convinced – here's why](https://www.bikeradar.com/features/opinion/everyone-says-bigger-gravel-tyres-are-better-i-m-not-convinced) — BikeRadar, 2026-01-17

Vistas apenas por resumo do buscador (página não lida — 403 ou não fetchada):

5. [User specified surface types and road conditions](https://communityhub.strava.com/general-chat-2/user-specified-surface-types-and-road-conditions-9030) — Strava Community Hub *(403)*
6. [[Known Issue] Surface type overview doesn't match the elevation profile](https://communityhub.strava.com/archived-strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646) — Strava Community Hub *(403)*
7. [Strava Gear Tracking: What It Does and What's Missing](https://theservicecourse.net/strava-gear-tracking/) — The Service Course *(403)*
8. [Strava Bike Maintenance: What Your Favourite Riding App Can't Do](https://www.componentry.app/blog/strava-bike-maintenance) — Componentry
9. [Improving the komoot map using OpenStreetMap](https://support.komoot.com/hc/en-us/articles/360022830972-Improving-the-komoot-map-using-OpenStreetMap) — Komoot Support
10. [Make weather forecast available for future (private) workouts](https://forum.intervals.icu/t/make-weather-forecatst-available-for-future-private-workouts/129018) — Intervals.icu Forum
11. [Weather on activities and map](https://forum.intervals.icu/t/weather-on-activities-and-map/79308) — Intervals.icu Forum
12. [Retroactively Add Starting Mileage for Gear](https://forum.intervals.icu/t/retroactively-add-starting-mileage-for-gear/131111) — Intervals.icu Forum
13. [Gravel Ride activities not counted in weekly Bike totals](https://forum.intervals.icu/t/gravel-ride-activities-not-being-taken-into-account-for-weekly-bike-totals/130236) — Intervals.icu Forum
14. [Gravel ride saves as Road Cycling](https://forums.garmin.com/outdoor-recreation/outdoor-recreation/f/epix-2/400838/gravel-ride-saves-as-road-cycling) — Garmin Forums
15. [How much harder is gravel riding vs road? ("Equivalence multiplier")](https://www.bikeforums.net/cyclocross-gravelbiking-recreational/1120061-how-much-harder-gravel-riding-vs-road-equivalence-multiplier.html) — Bike Forums
16. [New key proposal - paved=yes/no](https://lists.openstreetmap.org/pipermail/tagging/2014-September/019489.html) — OSM tagging list, 2014-09
17. [Best Cycling Apps for Gravel and Adventure Riders (2026)](https://droidlore.com/cycling/cycling-apps-gravel) — DroidLore
18. [45 vs 40 tires, is wider more grip but slower?](https://weightweenies.starbike.com/forum/viewtopic.php?t=170832) — Weight Weenies *(403, não lido)*
