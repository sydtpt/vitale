---
title: 'Pesquisa competitiva: terreno e contexto de rota em apps de ciclismo'
type: 'competitive'
topic: 'Análises de terreno/piso e contexto de rota (tipo de via, ciclovia, tempo parado, vento, clima, noturno, exploração, equipamento) em Komoot, Strava, Ride with GPS, Garmin Connect, Wandrer, VeloViewer, Statshunters, intervals.icu e pares'
decision: 'Que análises de terreno e contexto o Orbe constrói sobre o dado que já colhe (e com que passe externo), depois do piso das rotas — priorizando as que mudam uma decisão (pneu, bicicleta, rota, horário)'
source: 'run nativo (WebSearch + WebFetch + curl), 2 dimensões, 6 assistentes + 1 verificador, 2 rodadas, 7 digests'
status: complete
preset: 'standard'
validation: 'normal'
claims_verified: 8
claims_unverified: 4
claims_disputed: 1
claims_overturned: 1
citation_check: 'mecânica ok (0 marcadores pendentes, 0 linhas órfãs); a checagem semântica por assistente foi interrompida pelo usuário em 06/09 e não rodou'
created: '2026-09-05'
updated: '2026-09-06'
---

# Pesquisa competitiva: terreno e contexto de rota em apps de ciclismo

**Decisão que esta pesquisa serve:** que análises de terreno e contexto o Orbe constrói sobre o dado que já colhe, depois do piso das rotas — priorizando as que **mudam uma decisão** (pneu, bicicleta, rota, horário).

---

## Sumário executivo

**A recomendação: construa o piso das rotas como já está desenhado, e faça dele o eixo de tudo — não construa vento, e trate semáforo e noturno como frases da retrospectiva, não como features.** Quatro achados sustentam isso.

**1. O que o Orbe fez hoje — piso de atividade gravada, agregado por período e por bicicleta — quase ninguém faz, e ninguém agrega.** A afirmação "nenhum app mostra piso de atividade já gravada" foi testada e **caiu pela metade**: o Garmin mostra, sim, a quebra pavimentado/não pavimentado por pedalada, calculada **no aparelho** contra o mapa instalado ("88% paved and 12% unpaved" no Edge Explore 2; "post-ride trail breakdown" no Edge 850 de 2025) [20][21]. A Strava só pinta o mapa da atividade com linha tracejada, sem número nem legenda [1]; os percentuais que ela tem em algum lugar do produto não ficaram provados como sendo de atividade [5]. Komoot e Ride with GPS documentam piso **só no planejamento** — o RwGPS lançou o recurso em 2021 como "CURRENTLY FOR ROUTES ONLY" e nada indica que mudou [13][17][18]. E **nenhum** dos oito apps soma piso por ano, por bicicleta ou por pneu: o "gravel" que Strava e intervals.icu contam é o rótulo que o usuário deu à atividade, não o chão medido [43][44].

**2. "Km de terra por pneu" é terra de ninguém.** As ferramentas de exploração (Wandrer, VeloViewer, Statshunters) sabem por onde você passou e não olham piso; as de manutenção (intervals.icu, Strautomator, Componentry) contam quilômetro bruto e não sabem o chão; o único fornecedor que fala em "surface-condition multipliers" os tira de rota **planejada** [30][54][55]. Com a bicicleta como entidade (feita hoje) e os segmentos de piso (Fase 1), essa soma custa uma linha — e é a única análise deste relatório que nenhum concorrente documentado entrega.

**3. O que mais dói no usuário é piso errado — e a lição não é "confie no OSM".** É a reclamação nº 1 em quatro fontes independentes, e o caso mais bem documentado se resolveu descobrindo que o erro vinha do **mapa proprietário instalado no aparelho**, não do OpenStreetMap [20]. Duas consequências de desenho: guardar **de que fonte e versão** saiu cada trecho, e manter "não especificado" como **classe visível** — o bug reconhecido da Strava, percentuais que somam 61%, é exatamente o que acontece quando ela some [5].

**4. A decisão de pneu, nas fontes lidas, ninguém toma por dado próprio — e a regra publicada é prospectiva.** O review mais recente decide largura por sensação ("not as squirmy in the corners") [39]; a única regra numérica encontrada é "≥ 40% da rota em classe 3–4 → pneu de 35–42 mm", aplicada à rota ou ao evento de amanhã, não ao histórico [40]. O agregado retrospectivo por bicicleta é o que o dono usou hoje; a mesa não tem outro relato igual.

**O que não construir:** vento por trecho. O intervals.icu — que o dono já usa — anexa clima histórico do Open-Meteo e tem em desenvolvimento headwind/tailwind "MyWindsock-style" [33]; o myWindsock já faz isso há anos com contrafactual de potência [35][37]. Construir é correr atrás. Semáforo e noturno: **zero** pedido de usuário em duas rodadas; o dado já está no banco (tempo parado só comparável a partir do Garmin, 18/07/2026; pôr do sol já existe no núcleo para o esquema solar) — valem uma frase na retro, não uma tela.

**A maior ressalva:** o Reddit ficou inacessível o dia inteiro, três fóruns relevantes devolveram 403, e quase todo help center é sem data. A voz do usuário aqui vem de fóruns oficiais (Garmin, intervals.icu, Strava Hub por resumo) e de imprensa. Suficiente para orientar prioridade; insuficiente para dimensionar demanda.

---

## D1 — Teardown: o que cada app faz com terreno e contexto

### Piso: planejar antes de sair × medir o que foi pedalado

Os quatro grandes derivam piso da mesma fonte — o OpenStreetMap — e ninguém mede pelo sensor. A Strava admite por escrito: "We use OpenStreetMaps and the tags associated with each surface" [2], e no tipo de mapa "surface type" é "crowdsourced data from OpenStreetMap" [1]. O RwGPS diz OSM e colapsa em três classes, PAVED / UNPAVED / **UNKNOWN**, assumindo a lacuna em vez de fingir cobertura [17][19]. A Komoot é a taxonomia mais rica: separa **way type** (path, cycleway, street, singletrack, road) de **surface** (asphalt, cobblestones, gravel, sand) [13]. Nenhum dos quatro nomeia as tags que consome (`surface`, `tracktype`, `smoothness`) — o mais perto é a Strava citando o valor `track` do OSM no glossário [2].

Onde o piso aparece é a diferença que importa:

| App | Planejamento de rota | Atividade gravada | Como mostra |
|---|---|---|---|
| Strava | preferência pavimentado/terra/qualquer; tag de % pavimentado na rota sugerida [4]; seção Terrain em rotas da comunidade [3] | **só pintura de mapa** (assinante): tracejado = não pavimentado, laranja = pavimentado, branco = não especificado; "no legend available on the activity page" [1] | linha no mapa; percentuais existem em algum lugar do produto (bug de nov/2024: "16% paved, 32% dirt, 13% not specified") mas não provado que na atividade [5] — *unverified* |
| Komoot | quebra way type × surface da rota inteira, por filtro nas configurações [14]; perfil de elevação colorido por **inclinação**, não por piso [14] | **não achado**: página de Tour gravado mostra só duração, distância, velocidade e elevação [15] — ausência de prova, *low* | lista de categorias com distância por tipo; clima ao longo da rota é Premium [13] |
| Ride with GPS | **percentual do total** + linha sólida/tracejada no traçado **e no perfil de elevação**; seletor Paved/Unpaved/Any; grátis em todos os planos [17] | "CURRENTLY FOR ROUTES ONLY (MORE SOON)" no lançamento de set/2021 [18]; nada recuperado sobre "trips" — *medium* | é a melhor visualização do grupo: piso e inclinação no mesmo eixo de distância [17] |
| Garmin Connect | courses sem camada de piso; o usuário infere pela espessura da linha do mapa base [22] | **sim** — quebra paved/unpaved por pedalada ("88% paved and 12% unpaved"), calculada no aparelho contra o mapa instalado; Edge 850 (2025) com "post-ride trail breakdown" e "Gravel vs Road" no Connect [20][21] — *verified* | percentual no resumo da atividade; o usuário **não pode editar** [20] |

**Verificação que mudou o texto.** A primeira rodada, lendo só help centers, concluiu "nenhum dos quatro publica piso de atividade gravada". A rodada de voz do usuário trouxe o fio do Garmin, um verificador em contexto limpo confirmou o Garmin com duas fontes independentes, e a afirmação geral foi **derrubada** [20][21]. Para Strava, Komoot e RwGPS ela segue de pé — por ausência de prova, não por prova de ausência.

O achado metodológico mais útil do Garmin: a mesma pedalada dá percentuais diferentes conforme o **mapa carregado no aparelho** — o caso do fio se resolveu trocando um mapa topográfico de revendedor pelo mapa Garmin [20]. Piso é função do mapa, e o mapa tem versão.

### As ferramentas de nicho: exploração, equipamento, vento

**Wandrer** não conta tiles: reduz cada atividade a frações de via do OSM — "0–100% of Main Street, 25–72% of Spring Street" — guardadas como `(osm_id, faixas %)`, com geometria só na renderização via `ST_LineSubstring()` [25]. Filtra o OSM por `highway` e por **acesso legal** a pé ou de bicicleta; a lista de tags fica atrás de login [25][26]. A **tolerância** do casamento GPS↔via, o número que decidiria uma reimplementação, **não é publicada**: o post técnico a deixa para "a separate post" que não existe [25]. Os vestígios são indiretos e eloquentes: o FAQ pede gravação a 1 Hz sem smart recording, lista "matched to a parallel road" como falha conhecida resolvida pelo suporte [26], e em agosto de 2025 o autor entregou um **editor manual de traço** dizendo que aperfeiçoar o algoritmo "is difficult for a variety of reasons" [52]. Piso? Zero ocorrências de `surface`, `unpaved`, `tracktype` ou `smoothness` nas 2.745 palavras do FAQ [26]; não pavimentado é só um filtro de exibição.

**VeloViewer e Statshunters** trabalham por tile do OSM no zoom 14 (~1,6 km, variando com a latitude): Explorer Score, Max Square, Max Cluster, e um "Visits by me" que é o heatmap pessoal de tiles [27][28][49]. A regra de engenharia que vale roubar: "any straight line >500m in length will not tick any map tiles" — GPS perdido não vira exploração falsa [27]. O VeloViewer está vivo em 2026 (post de Explorer em 14/08/2026, métrica nova a pedido de usuário) [53][57]; a doc do método é de 2016. Nenhum dos três analisa piso [56]. O Statshunters injeta os tiles **dentro do route builder do Strava** via extensão — a análise vai até onde a decisão acontece [29].

**intervals.icu** é o único com gear de verdade: distância, tempo e contagem por equipamento, lembretes ("replace chains, top up sealant"), componentes **compartilhados entre bicicletas**, export CSV [30][31]. Nada de terreno na página oficial [30].

**myWindsock** é o contexto meteorológico levado a sério: vento **na via** a partir de topologia, uso do solo e edificações do OSM; Weather Impact por contrafactual (um "Virtual Rider" com vento zero, a diferença de potência é o impacto); timeline de tempo ganho/perdido por trecho; relê rides passados e escreve o relatório de volta na Strava [35][36][37]. Cores: vermelho de frente, roxo de través, azul de cauda [38]. Atenção ao nome: "Surface" ali é rugosidade aerodinâmica, não pavimento [35].

### Contexto de rota: quem faz o quê

| Contexto | Nativo em | Terceiros | Não achado em |
|---|---|---|---|
| Parado × movimento | Strava (moving vs elapsed, auto-pause documentados) [7][51] | — | Komoot, RwGPS, Garmin Connect (não buscado a fundo) |
| Vento por trecho | ninguém dos quatro | myWindsock [35][36]; **intervals.icu em desenvolvimento** [33] | — |
| Clima na atividade | Strava, pobre: temperatura só do início [48] | Strautomator, wthr.app, Klimat [47] | Komoot (Premium só na rota) [13] |
| Noturno | Strava Night Heatmap (2024-11): noite = pôr ao nascer do sol, mas heat da **comunidade**, para planejar [9] | — | estatística do próprio histórico: ninguém |
| Vias novas | Strava Personal Heatmap (onde já passei) [8] | Wandrer (frações de via) [25]; VeloViewer, Statshunters, Squadrats (tiles) [27][28][56] | — |
| Equipamento | Strava My Gear com componentes, alerta só para tênis [10][12]; Garmin Gear Tracking com alerta de fim de vida, inclusive no Edge, e Gear Collections em 2026 [23][24] | Strautomator GearWear, Componentry [11][12] | piso × equipamento: **ninguém** [54][55] |

## D2 — Voz do usuário e lacunas

**Piso errado é a reclamação nº 1**, e o usuário não tem conserto local. No fio do Edge Explore 2: "Garmin Connect and the Edge Explore display 100% of my rides as 100% paved!" (95% em trilha de MTB) e, de outro usuário, "88% paved and 12% unpaved, which I think is incorrect… Makes me wonder how garmin determines the type of surface" [20]. A comunidade culpa o OSM ("might not be set correctly for your local unpaved roads") — e no caso principal **não era**: o mapa era de um revendedor local [20]. O viés existe, e é antigo: sem tag de superfície, o OSM assume pavimentado, o que quebra fora das cidades [45]. A Komoot manda editar o OSM e avisa que leva "one to two weeks… some can take up to four" [16]. Na Strava, os percentuais que não somam 100% viraram Known Issue em novembro de 2024 [5], e há pedido de marcar trechos com condição — "muddy passage", "avoid when raining" — isto é, qualificar o piso com época, não só classificá-lo [6].

**Equipamento: o pedido dominante é componente por atividade, não por bicicleta.** Quatro usuários independentes no mesmo fio do intervals.icu: trocar pedal e taco entre bikes, escolher rodas por treino, o rolo "counts every ride, indoor and outdoor" inflando o desgaste, e quilometragem inicial retroativa [31]. Uma troca sazonal de pneu na mesma bicicleta — o plano do dono para março — cai exatamente nesse buraco. O gear tracking da Strava é descrito como contador puro: "no thresholds, no alerts… no path to action" [50] — *só resumo, fonte de parte interessada*. Apps de manutenção morrem e deixam órfãos ("Pro Bike Garage… the developer left it behind") [31].

**Vento é o segundo contexto mais pedido, e o pedido já vem com a decisão embutida.** "Transform that in felt elevation while cycling", de quem mora em lugar "extremely windy" [32]; "starting into headwind and returning with tailwinds" [34]. E o intervals.icu está respondendo: clima histórico do Open-Meteo já anexado, headwind/tailwind "MyWindsock-style" em desenvolvimento [33] — *unverified, só resumo*.

**O que não apareceu.** Em duas rodadas, **zero** pedidos de "quanto gravel eu pedalei este ano", zero de tempo parado em semáforo como métrica, zero de estatística noturna própria, e nenhum relato de ciclista escolhendo pneu ou bicicleta por análise do próprio histórico. O tempo parado só aparece como dúvida sobre o auto-pause (2014) [42]. O que existe é adjacente: na literatura, ciclistas **superestimam a espera no semáforo em ~5×** [41] — *só resumo* — o que faz de "seu semáforo custa menos do que você sente" uma hipótese com lastro e sem concorrente, mas sem demanda.

**Pneu por dado.** O review mais recente decide por sensação: "quick enough to keep pace with road bikes, not as squirmy in the corners" [39]. A única regra numérica é prospectiva: "if 40% or more of the route is Class 3 and 4 mileage… 35-42 mm" e eventos publicam sua composição ("only 35% of the route unpaved") [40] — *só resumo, 403*. A porcentagem move a decisão quando é a rota de amanhã. O dono usou a de ontem: por bicicleta, com fronteira de data. Nenhuma fonte mostra outra pessoa fazendo isso.

**Ressalva de cobertura.** Reddit inacessível por três caminhos; Strava Community Hub, Weight Weenies, The Service Course e In The Know Cycling em 403; os 44 comentários do lançamento do RwGPS não lidos. Achado negativo aqui é "não encontrado sob orçamento", não "não existe".

## Insights cruzados

1. **A fronteira competitiva não é "piso", é "piso agregado com contexto próprio".** Garmin mostra o número por pedalada e não deixa editar nem somar; Strava pinta sem número; Wandrer sabe a via e ignora o chão; intervals.icu sabe o desgaste e ignora o chão. O Orbe é o único lugar onde piso, bicicleta (entidade desde hoje), período e, em março, pneu, ficam na mesma tabela. A soma é trivial e é inédita.

2. **O erro que todos cometem é o mesmo, e é de produto, não de dado:** expor um percentual sem procedência e sem classe "não sei". A Strava somou 61%; o Garmin mudou de resposta ao trocar de mapa; a Komoot leva um mês para corrigir. Para o Orbe isso vira duas regras de Fase 1: guardar fonte e versão por trecho (o Wandrer atualiza o OSM a cada 2–3 meses [26]) e nunca esconder o inferido — hoje são 14,5% dos pontos.

3. **O casamento GPS↔via é um problema que a referência do nicho desistiu de resolver por algoritmo.** O Wandrer não publica a tolerância e resolveu GPS ruim com editor manual [52]. Isso rebaixa a ambição certa da Fase 1: heurística simples (via mais próxima em 25 m, ciclovia a ≤ 12 m vence rua), guarda de reta > 500 m do VeloViewer [27], golden set de 10 pedaladas do dono — e aceitar que o resto é suporte humano, que aqui é o próprio dono.

4. **Onde o dado já está no banco, a demanda não está.** Tempo parado e noturno custam zero e ninguém pede. Onde a demanda está (vento), o app que o dono já usa está entregando. A régua de custo do dado, sozinha, apontaria para semáforo e noturno; a régua de decisão aponta para piso × bike × pneu. Vence a segunda.

## Recomendações

Cada uma amarrada à decisão e ao artefato que a consome (`_bmad-output/implementation-artifacts/piso-das-rotas/tasks.md`, salvo indicação).

- **R1 — Piso das rotas segue como está planejado (Fases 1–3), com duas regras novas na Fase 1.** (a) `surface_segments` carrega, por trecho, a **fonte e a data do extrato OSM** (T1.1); (b) "não especificado/inferido" é classe própria em toda tela e toda soma, nunca redistribuída (T1.1, T2.2). Confiança: alta — sustentada por [1][5][20] verificados e pelo achado de que ninguém agrega [43][44].
- **R2 — A visão global por bicicleta é a superfície de decisão, e o mockup já a tem.** Manter as duas fronteiras (bike, relógio) e o filtro por bike; o agregado retrospectivo por bike é o que decidiu o pneu hoje e não tem paralelo nas fontes [39][40]. Confiança: média — a evidência de que "ninguém faz" é ausência sob orçamento, com Reddit fora.
- **R3 — "Km por piso por equipamento" entra no tasks como T3.3, dependente do pneu virar filho de `gear` (março/2027).** É a única análise deste relatório sem concorrente documentado [30][54][55], e cai no buraco que os usuários do intervals.icu descrevem (componente por atividade, rolo inflando km) [31]. Custo: uma soma sobre o que as Fases 0 e 1 já guardam. Confiança: alta para a lacuna, média para a demanda (um fio, quatro usuários).
- **R4 — Não construir vento por trecho.** Registrar em `backlog-de-features.md` como "observar o intervals.icu" com data de reavaliação em março/2027 [33][35]. Se um dia entrar, o modelo é o contrafactual do myWindsock e a fonte é Open-Meteo histórico. Confiança: média — a trajetória do intervals.icu é *unverified* (só resumo).
- **R5 — Semáforo e noturno viram fatos da retrospectiva, não features.** "Tempo parado por cidade" só da era Garmin (18/07/2026 em diante, confusor medido); "km depois do pôr do sol" pela efeméride que o núcleo já tem. Sem demanda medida [41][42][9]; custo perto de zero; a hipótese acadêmica "você superestima o semáforo em 5×" é a única razão para existir. Confiança: baixa para demanda, alta para custo.
- **R6 — Método da Fase 1: não perseguir a tolerância do Wandrer.** Ela não é pública [25]; adotar a heurística atual + guarda de reta > 500 m [27] + golden set (T1.4). Quando o golden set falhar, a resposta é edição manual do trecho, como o Wandrer fez [52], não outro algoritmo. Para validação futura, existe método publicado de inferir piso do próprio traço GPS [46] — não lido, só título verificado.
- **R7 — Exploração ("km em vias nunca pedaladas") fica no backlog como candidata forte para depois do piso.** O ciclismo do dono tem zero rotas recorrentes, o que faz da novidade a métrica natural; o modelo é o do Wandrer (fração de via, não tile) [25]. Sem evidência de decisão associada — é prazer, não decisão. Confiança: média.

## Perguntas abertas

- **A Strava mostra percentuais de piso na atividade ou só na rota?** Decide se o Garmin é o único par. Resolve-se abrindo o fio do Known Issue logado no navegador [5], que este ambiente não alcança.
- **O RwGPS cumpriu o "(MORE SOON)" de 2021 para trips gravadas?** Help center em 403 e anúncio em JS [17][18]. Checagem de dois minutos num navegador.
- **Quais Edge além do Explore 2 e do 850 trazem a quebra por pedalada?** Lead não lido: fio "24.19 Surface Wrong" no fórum do Edge 840. Interessa porque o dono grava no Garmin Venu 4 (relógio), que pode ou não trazer o dado.
- **A tolerância do Wandrer.** Não publicada; só resolve com o autor.
- **A demanda real por "quanto gravel eu pedalei".** Só com Reddit acessível (r/gravelcycling, r/Strava) ou com os 44 comentários do BIKEPACKING [18]. Rota: Deepen com outro ambiente de rede, ou um prompt para ferramenta de deep research do dono.

## Apêndice de fontes

| [n] | Sustenta | Publisher | Publicado | Acessado | Confiança |
|---|---|---|---|---|---|
| [1] | Surface Type na atividade é pintura de mapa, assinante, sem legenda; dado crowdsourced do OSM | [Strava Help Center — Map Types](https://support.strava.com/en-us/articles/15401748-map-types) | s.d. | 2026-09-05 | alta |
| [2] | "We use OpenStreetMaps and the tags associated with each surface"; simbologia do glossário | [Strava Help Center — Maps Glossary](https://support.strava.com/en-us/articles/15402016-strava-maps-glossary) | s.d. | 2026-09-05 | alta |
| [3] | Seção Terrain em rotas da comunidade; tracejado/laranja/branco | [Strava Help Center — Route Terrain](https://support.strava.com/en-us/articles/15401687-route-terrain) | s.d. | 2026-09-05 | alta |
| [4] | Preferência de superfície e tag de % pavimentado na rota sugerida | [Strava Help Center — Generated Community Routes](https://support.strava.com/en-us/articles/15401756-generated-community-routes) | s.d. | 2026-09-05 | média (resumo) |
| [5] | Known Issue: percentuais "16% paved, 32% dirt, 13% not specified"; superfície não verificada | [Strava Community Hub — Known Issue surface type overview](https://communityhub.strava.com/strava-features-chat-5/known-issue-surface-type-overview-doesn-t-match-what-s-shown-in-the-elevation-profile-7646) | 2024-11 | 2026-09-05 | baixa (403, resumo) — *unverified* |
| [6] | Pedido de marcar trechos com condição ("muddy passage") | [Strava Community Hub — User specified surface types](https://communityhub.strava.com/general-chat-2/user-specified-surface-types-and-road-conditions-9030) | s.d. | 2026-09-05 | média (resumo) |
| [7] | Moving time vs elapsed documentados | [Strava Help Center — Moving Time](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations) | s.d. | 2026-09-05 | média |
| [8] | Personal Heatmaps para assinantes | [Strava Help Center — Personal Heatmaps](https://support.strava.com/hc/en-us/articles/216918467-Personal-Heatmaps) | s.d. | 2026-09-05 | média |
| [9] | Night Heatmap: noite = pôr ao nascer do sol; heat da comunidade | [Strava Help Center — Night Heatmap](https://support.strava.com/hc/en-us/articles/31335253810701-Night-Heatmap) | 2024-11-13 | 2026-09-05 | média |
| [10] | My Gear com componentes; alerta só para tênis | [road.cc — Strava My Gear expanded](https://road.cc/content/tech-news/stravas-my-gear-tracker-expanded-bike-maintenance-286417) | s.d. | 2026-09-05 | média |
| [11] | GearWear: alerta de desgaste por componente da Strava | [Strautomator — GearWear](https://strautomator.com/feature/gearwear) | s.d. | 2026-09-05 | média |
| [12] | Componentry: contadores por distância e lembretes por data | [Componentry — Strava bike maintenance](https://www.componentry.app/blog/strava-bike-maintenance) | s.d. | 2026-09-05 | baixa (parte interessada) |
| [13] | Way type × surface; informação de rota; clima Premium | [komoot — Tour characteristics](https://www.komoot.com/tour-characteristics) | s.d. | 2026-09-05 | alta |
| [14] | Quebra da rota por filtro; perfil colorido por inclinação | [komoot — Route planner help](https://www.komoot.com/help/routeplanner) | s.d. | 2026-09-05 | alta |
| [15] | Tour gravado sem seção de way types/surfaces | [komoot — Tour 2191223099](https://www.komoot.com/tour/2191223099) | 2025-04-26 | 2026-09-05 | baixa (pode ser render por JS) |
| [16] | Edição do OSM leva 1–4 semanas para chegar ao Komoot | [Komoot Support — Improving the map using OSM](https://support.komoot.com/hc/en-us/articles/360022830972-Improving-the-komoot-map-using-OpenStreetMap) | s.d. | 2026-09-05 | média |
| [17] | PAVED/UNPAVED/UNKNOWN; percentual do total; no traçado e no perfil; grátis | [RwGPS Help Center — Surface Types](https://support.ridewithgps.com/hc/en-us/articles/4419010273179-Surface-Types) | s.d. | 2026-09-05 | baixa (403, resumo) |
| [18] | "CURRENTLY FOR ROUTES ONLY (MORE SOON)" | [BIKEPACKING.com — RwGPS Surface Types](https://bikepacking.com/news/ride-with-gps-surface-types/) | 2021-09-14 | 2026-09-05 | alta |
| [19] | Surface Types como recurso do planejador, dado OSM | [Velo/Outside — RwGPS adds surface types](https://velo.outsideonline.com/road/road-racing/ride-with-gps-adds-surface-types-to-route-planning-tool/) | 2021-09 | 2026-09-05 | média |
| [20] | Garmin Connect mostra paved/unpaved por pedalada; causa do erro era o mapa do aparelho; usuário não edita | [Garmin Forums — Edge Explore 2 all roads as paved](https://forums.garmin.com/sports-fitness/cycling/f/edge-explore-2/421042/edge-explore-2-and-garmin-connect-display-all-roads-as-paved) | 2024–2025 | 2026-09-05 | alta — *verified* (2 leituras independentes) |
| [21] | Edge 850: "post-ride trail breakdown"; "Gravel vs Road" no Connect | [DC Rainmaker — Garmin Edge 850 review](https://www.dcrainmaker.com/2025/09/garmin-edge-850-in-depth-review-brilliance.html) | 2025-09-09 | 2026-09-05 | alta |
| [22] | Courses sem camada de piso; inferência pela espessura da linha | [Garmin Forums — Edge 530 surface type on courses](https://forums.garmin.com/sports-fitness/cycling/f/edge-530/337729/is-there-a-way-to-see-surface-type-on-courses) | s.d. | 2026-09-05 | baixa |
| [23] | Gear tracking no próprio Edge com alerta de fim de vida | [BikeRadar — Garmin on-device gear tracking](https://www.bikeradar.com/news/garmin-on-device-gear-tracking) | s.d. | 2026-09-05 | média |
| [24] | Gear Collections em 2026 | [Garmin Forums — Gear Collections](https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-mobile-andriod/439583/gear-collections-should-automatically-assign-components-based-on-the-selected-bike) | 2026 | 2026-09-05 | baixa |
| [25] | Frações de via, `(osm_id, ranges)`, ST_LineSubstring, filtro highway + acesso legal; tolerância "subject of a separate post" | [Wandrer News — untraveled roads](https://news.wandrer.earth/2026/01/30/wandrer-untraveled-roads.html) | 2026-01-30 | 2026-09-05 | alta — *verified* |
| [26] | FAQ: 1 Hz, via paralela, OSM a cada 2–3 meses, zero menção a surface | [Wandrer — FAQ](https://wandrer.earth/faq) | s.d. | 2026-09-05 | alta |
| [27] | Tiles zoom 14; reta > 500 m não marca; Explorer/Max Square/Cluster | [VeloViewer — Explorer tiles](https://blog.veloviewer.com/veloviewer-explorer-score-and-max-square/) | 2016-12-05 | 2026-09-05 | alta (método), velha |
| [28] | Statshunters: tiles zoom 14, filtro por gear/tipo/data, Eddington | [StatsHunters — FAQ](https://www.statshunters.com/faq) | s.d. | 2026-09-05 | média (resumo) |
| [29] | Extensão que injeta tiles no route builder da Strava | [Chrome Web Store — StatsHunters](https://chromewebstore.google.com/detail/statshunters/ldhkneiheabejbefhgjddpamijajabmm) | s.d. | 2026-09-05 | média |
| [30] | Gear por distância/tempo/contagem, lembretes, CSV; nada de terreno | [intervals.icu — Gear tracking](https://www.intervals.icu/features/gear-tracking/) | s.d. | 2026-09-05 | alta — *verified* |
| [31] | Componentes compartilhados; pedidos: por atividade, pedal/taco, rolo, retroativo; PBG abandonado | [intervals.icu forum — Bike and other gear usage tracking](https://forum.intervals.icu/t/bike-and-other-gear-usage-tracking/10492) | 2022-04 | 2026-09-05 | alta — *verified* |
| [32] | "Felt elevation"; lugar "extremely windy" | [intervals.icu forum — Wind impact on cycling](https://forum.intervals.icu/t/wind-impact-on-cycling/80393) | 2024-11/12 | 2026-09-05 | alta |
| [33] | Clima histórico do Open-Meteo; headwind/tailwind MyWindsock-style em desenvolvimento | [intervals.icu forum — Weather on activities and map](https://forum.intervals.icu/t/weather-on-activities-and-map/79308) | s.d. | 2026-09-05 | média (resumo) — *unverified* |
| [34] | "Starting into headwind and returning with tailwinds" | [intervals.icu forum — Weather forecast for future workouts](https://forum.intervals.icu/t/make-weather-forecatst-available-for-future-private-workouts/129018) | 2026 | 2026-09-05 | média (resumo) |
| [35] | Vento na via por topologia/landuse/edificações do OSM; rota e atividade; timeline por trecho | [myWindsock — Surface](https://surface.mywindsock.com/) | s.d. | 2026-09-05 | alta — *verified* |
| [36] | Relê rides passados; escreve de volta na Strava; yaw e cores | [myWindsock — Strava help](https://mywindsock.com/page/help/strava/) | s.d. | 2026-09-05 | média |
| [37] | Weather Impact por contrafactual (Virtual Rider) | [myWindsock — wImpact](https://mywindsock.com/page/wwatts/) | s.d. | 2026-09-05 | média |
| [38] | Fontes NOAA/Met Office; cores headwind/cross/tail | [BikeRadar — myWindsock](https://www.bikeradar.com/news/mywindsock-takes-strava-nerdiness-to-the-next-level) | s.d. | 2026-09-05 | média |
| [39] | Decisão de largura por sensação, não por medição | [BikeRadar — bigger gravel tyres opinion](https://www.bikeradar.com/features/opinion/everyone-says-bigger-gravel-tyres-are-better-i-m-not-convinced) | 2026-01-17 | 2026-09-05 | alta — *verified* |
| [40] | "≥ 40% classe 3–4 → 35–42 mm"; eventos publicam composição | [In The Know Cycling — Choosing gravel tires](https://intheknowcycling.com/choosing-gravel-bike-tires/) | s.d. | 2026-09-05 | média (403, resumo) |
| [41] | Ciclistas superestimam a espera em ~5× | [Findings — Perceived vs actual waiting time, Enschede](https://findingspress.org/article/9636-perceived-versus-actual-waiting-time-a-case-study-among-cyclists-in-enschede-the-netherlands) | s.d. | 2026-09-05 | média (resumo) — *unverified* |
| [42] | Tempo parado só como dúvida sobre auto-pause | [Singletrack forum — Does strava stop when you do](https://singletrackworld.com/forum/bike-forum/does-strava-stop-when-you-do/) | 2014-08-01 | 2026-09-05 | alta, velha |
| [43] | "Gravel" contado por rótulo de atividade no Year in Sport | [Cycling Weekly — gravel boom Strava report](https://www.cyclingweekly.com/news/gravel-boom-shows-no-signs-of-slowing-strava-report-reveals) | s.d. | 2026-09-05 | média |
| [44] | Gravel Ride como rótulo que quebra totais no intervals.icu | [intervals.icu forum — Gravel rides not counted](https://forum.intervals.icu/t/gravel-ride-activities-not-being-taken-into-account-for-weekly-bike-totals/130236) | s.d. | 2026-09-05 | baixa (resumo) |
| [45] | OSM assume pavimentado sem tag; viés rural | [OSM tagging list — paved=yes/no](https://lists.openstreetmap.org/pipermail/tagging/2014-September/019489.html) | 2014-09 | 2026-09-05 | baixa, histórica |
| [46] | Método publicado de inferir piso do traço GPS | [arXiv 1809.09745 — Surface Type Estimation from GPS Tracked Bicycle Activities](https://arxiv.org/pdf/1809.09745) | 2018-09 | 2026-09-05 | baixa (só título) |
| [47] | Clima na atividade via terceiros | [Strautomator — Weather](https://strautomator.com/feature/weather) | s.d. | 2026-09-05 | média |
| [48] | Temperatura só do início da atividade | [Strava Community Hub — weather data doesn't make sense](https://communityhub.strava.com/general-chat-2/the-weather-data-doesn-t-make-any-sense-this-is-frustrating-how-can-i-solved-it-7655) | s.d. | 2026-09-05 | baixa (resumo) |
| [49] | Explorer Tiles e "Visits by me" | [VeloViewer — Explorer](https://veloviewer.com/explorer) | s.d. | 2026-09-05 | média |
| [50] | Gear da Strava: "no thresholds, no alerts" | [The Service Course — Strava gear tracking](https://theservicecourse.net/strava-gear-tracking/) | s.d. | 2026-09-05 | baixa (403, parte interessada) |
| [51] | Auto-pause: pausas do arquivo respeitadas; cálculo no upload | [Strava Help Center — Auto-Pause](https://support.strava.com/en-us/articles/15402141-auto-pause) | s.d. | 2026-09-05 | média (resumo) |
| [52] | Editor manual de traço; "matching algorithm… is difficult" | [Wandrer News — Activity editor](https://news.wandrer.earth/2025/08/14/activity-editor-is-available.html) | 2025-08-14 | 2026-09-05 | alta |
| [53] | Explorer ativo em 2026, métrica nova a pedido | [VeloViewer blog — Tiling tales](https://blog.veloviewer.com/tiling-tales-chasing-tiles-in-arctic-conditions/) | 2026-08-14 | 2026-09-05 | alta |
| [54] | "Surface-condition multipliers" vindos de rota planejada do RwGPS; Strava/Garmin/PBG só km | [Trail Hits — best bike maintenance app](https://www.trailhits.com/best-bike-maintenance-app) | 2026-06 | 2026-09-05 | baixa (fornecedor) |
| [55] | Strautomator escolhe gear por tipo de esporte declarado | [Strautomator — home](https://strautomator.com/) | s.d. | 2026-09-05 | alta |
| [56] | Plataformas de tiles não analisam piso; Squadrats com dois tamanhos | [We Love Cycling — Tile hunting](https://www.welovecycling.com/wide/2026/04/14/tile-hunting-which-platform-is-best-for-you/) | 2026-04-14 | 2026-09-05 | média |
| [57] | VeloViewer vivo: planos e Explorer no menu | [VeloViewer — Pro](https://veloviewer.com/pro) | s.d. | 2026-09-05 | alta |

## Mapa de frescor

Janelas do pack competitivo: features e preço 3 meses · trajetória 6 · sentimento 12 · acadêmico 24. Páginas de help center sem data foram datadas pelo acesso (2026-09-05), então o re-check delas é dezembro de 2026; as datas abaixo saem de `recon_kit.py staleness`.

| Afirmação | Classe | Publicado | Re-check | Situação |
|---|---|---|---|---|
| Garmin mostra piso por pedalada [20][21] | capability | 2025-09-09 | 2025-12-09 | **já vencida** — conferir quais Edge/relógios e se o Venu 4 traz o dado |
| RwGPS só para rotas [17][18] | capability | 2021-09-14 | 2021-12-14 | **já vencida** — o "(MORE SOON)" tem cinco anos |
| Strava: percentuais em algum lugar [5] | gap | 2024-11 | 2025-02-01 | **já vencida** — abrir o fio logado |
| Wandrer: método sem tolerância [25] | method | 2026-01-30 | 2026-04-30 | vencida — só resolve com o autor |
| VeloViewer: método de tiles [27] | method | 2016-12-05 | 2017-03-05 | vencida; produto confirmado vivo em 2026-08 [53] |
| Night Heatmap [9] | capability | 2024-11-13 | 2025-02-13 | vencida, baixa importância |
| Strava atividade só pinta mapa [1]; Komoot planejamento [13]; OSM como fonte [2] | viz/capability/method | acesso 2026-09-05 | 2026-12-05 | válida |
| intervals.icu gear [30]; myWindsock [35] | gear/capability | acesso 2026-09-05 | 2026-12-05 | válida |
| intervals.icu vento em desenvolvimento [33] | trajectory | acesso 2026-09-05 | 2027-03-05 | válida — é a data de reavaliar R4 |
| Piso errado é a queixa nº 1 [20] | data-trust | 2025-10 | 2026-10-01 | válida por um mês |
| Gear por componente e atividade [31] | feature-request | 2022-04-22 | 2023-04-22 | vencida — fio antigo; o pedido de 2026 (retroativo) confirma que persiste |
| Vento como pedido [32][34] | feature-request | 2024-12-04 | 2025-12-04 | vencida |
| Ninguém decide pneu por dado [39][40] | decision-evidence | 2026-01-17 | 2027-01-17 | válida |
| Semáforo superestimado 5× [41] | academic | acesso 2026-09-05 | 2028-09-05 | válida |

**O re-check mais urgente é o do Garmin e o do RwGPS** (já vencidos e centrais): dois minutos num navegador logado decidem se o "quase ninguém faz" vira "só o Garmin faz" ou "Garmin e RwGPS fazem". A reavaliação de vento (R4) fica para **março de 2027**, junto com a troca de pneu.
