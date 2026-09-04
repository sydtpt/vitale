---
artifact: citation-check
report: ../research.md
checked: 2026-09-03
method: digests (8 arquivos) como camada primária; fetch ao vivo nas claims de sustentação [38][89][85][13][67][50][79][78][20] + api_policy, road.cc, DC Rainmaker, Slashdot, G&W
live_fetches: 11 WebFetch + 6 curl (texto bruto com grep)
totals: { match: 84, partial: 12, mismatch: 2, unreachable: 14, rows: 112 }
---

# Conferência de citações — research.md

Legenda da coluna nota: **(L)** = confirmado ao vivo na URL; **(D)** = confirmado só contra o digest; **(S)** = o próprio digest só viu snippet/403.

## MISMATCH e PARTIAL (primeiro)

| ref | sentence (short) | verdict | note |
|---|---|---|---|
| [85] | A2: "As cláusulas de 2024 sobre IA e 'look and feel' não aparecem no texto de 2026 … o que restou é a frase mais ampla sobre 'replicate Strava functionality'" | MISMATCH | (L) O literal está certo para strava.com/legal/api: extração própria do texto integral (27.632 chars, §1–§14, 63 itens numerados) dá 0 ocorrências de "artificial intelligence", "machine learning", "look and feel", "model training", "analytics", "single user", "non-commercial". **Mas** o Agreement incorpora por referência a **API Policy** (strava.com/legal/api_policy, também "Effective Date: June 1, 2026": "incorporated by reference into, and forms part of, the Strava API Agreement"). A Policy traz **§5.3 "No AI/ML Training, Fine-Tuning, Grounding, Evaluation, Embedding, or Retrieval-Augmented Generation"**: "You may not use the Strava API Materials or Strava Data, directly or indirectly, in connection with the development, training, evaluation, or operation of any AI Application" — estendida a "retrieval-augmented generation, ingestion into a context window or working memory"; **§5.4**: "You may not process or disclose Strava Data—even publicly viewable Strava Data—including in an aggregated, de-identified, or anonymized manner, for the purposes of analytics, analyses, customer insight generation, or product or service improvements"; e cláusula "competitive to Strava or the Strava Platform". "artificial intelligence" aparece em §5.14 (EU AI Act). "machine learning" e "look and feel" não aparecem em nenhuma das duas páginas. Conclusão: a cláusula de IA não sumiu — mudou de página e ficou mais ampla; a de analytics (a que o DCR [87] apontou como contraditória) também está vigente. Só "look and feel" de fato não sobreviveu. Ressalva: a Policy é renderizada em JS (curl devolve 849 chars); o verbatim vem de duas leituras renderizadas consistentes — confirmar com leitura humana de /legal/api_policy. |
| [41] | B7: a imprensa resume … "paywalling its features one piece at a time" [41] | MISMATCH | (L) A frase não está no road.cc (0 ocorrências de "one piece at a time" no texto integral, incl. comentários). O digest termos-r1 atribui a citação à **T3** ("Dear Strava, we have a paywall problem that's gone a step too far"), cuja URL não consta das Fontes. Citação verbatim com atribuição errada. |
| [41] | Achado 2: "Year in Sport virou pago em dezembro de 2025, pela primeira vez desde 2016, exigindo assinatura ativa e três atividades no ano" | PARTIAL | (L) road.cc sustenta: paywall em dez/2025, só assinantes, "core benefits remain as accessible as possible", "monthly stat cards" atrás da assinatura. **Não** contém "2016" (isso está em [42] Slashdot/Ars: "since the review's debut in 2016") nem qualquer exigência de "três atividades" (0 ocorrências de three/3 activities/at least em [41], [42] e [55]). O digest strava-r2 afirmou ambos com confiança alta — origem provável é outra página não listada. |
| [13] | Sumário e Achado 1: Connect+ "which currently lack compelling features" / "sem recursos convincentes" | PARTIAL | (L) Data 2026-07-22, aquisição já fechada, "cross-platform ecosystem" verbatim, sem mudança de preço, sem plano de levar TSS/NP/IF ao Connect, 120 pessoas, termos não divulgados, riscos (bloqueio de upload de terceiros; licenciamento estilo Firstbeat): tudo confirmado. A frase entre aspas **não é verbatim**: o texto diz "Connect+ simply doesn't offer a compelling reason for people to pay for it" e "there's no compelling reason for most people to subscribe" ("lacking" só aparece num comentário de leitor). Sentido preservado; aspas indevidas. |
| [20] | Achado 3: "Segundo o autor … as constantes 42/7 são configuráveis e TRIMP é alternativa para atividades só com FC" (ecoa no Sumário 1, tabela F/F/F e R1) | PARTIAL | (L) Do autor (David Tinker) estão confirmados: Fitness/Fatigue "derived from your training load for each activity and your FTP", FC quando não há potência; Form "as a percentage of your fitness, not an absolute number like Strava"; "estimates load from HR activities differently to Strava" (2020-09-11). **Configurabilidade de 42/7** vem de um usuário (Alvarosilva, 2021) relatando usar "10 instead of 7 and 50 instead of 42" — nenhuma afirmação do autor; **TRIMP como alternativa** vem do usuário J_H (2021-02-25). O digest peers-r2 já dizia "parecem ser configuráveis" (média); o relatório afirma sem hedge. |
| [34] | Sumário 1 "grátis … na Runalyze" e tabela "Grátis em algum lugar? Sim (intervals.icu, Runalyze) [15][34]"; tabela "ACWR, monotonia, strain … Só pagantes via MCP [34]" | PARTIAL | (D) [34] (the5krunner) sustenta: MCP em 2026-06-09, só pagantes, Claude/Mistral/Gemini CLI, e a lista de métricas expostas (CTL/ATL/TSB, ACWR, monotonia, strain, marathon shape, HRV baseline, sono, FC noturna). **Não** diz que Fitness/Fatigue é gratuito na Runalyze — a gratuidade do tier Free vem de [29] (403, snippet). E "só pagantes via MCP" é ambíguo: a fonte diz que o MCP é pago, não que ACWR/monotonia/strain estejam ausentes da interface gratuita. |
| [100] | Sumário 1: "uma curva própria … com janela longa customizável responde à **queixa mais citada** [100]" | PARTIAL | (D) A ideia "Better Fitness and Freshness chart for long term analysis - include custom date range" existe; mas o digest termos-r2 diz que kudos e datas não foram capturados (o próprio relatório repete isso em B6). "Mais citada" não tem base. |
| [100][101] | B6: "as ideias pedem janela longa customizável e **cruzamento com sono e peso**" | PARTIAL | (D) A ideia de sono/peso é idi-p/408, URL distinta da de [100] (idi-p/406) e ausente das Fontes. |
| [89] | Sumário "Maior ressalva": "exige a assinatura do desenvolvedor, US$ 11,99/mês ou €10,99 [89]" | PARTIAL | (L) [89] confirma a exigência de assinatura (novos em 2026-06-01, existentes até 2026-06-30, "3-months free") mas não traz preço; US$ 11,99 está em [91]/[54] e €10,99 em [43]. No corpo (A3) o grupo [89][90][91][93] também não inclui [43] para o valor em euro. Menor. |
| [87] | Sumário: "a leitura integral do texto de 2026 ficou pendente [87]" | PARTIAL | (D) [87] é o DC Rainmaker de nov/2024 — traz as cláusulas de 2024 que motivam a releitura, não a pendência em si (nota de método do próprio relatório). Citação deslocada. |
| [85][86] | A5: "O risco residual é 'replicate Strava functionality', que o contrato não define [85]" | PARTIAL | (L) Cláusula de exibição por construção e "tools that help users understand their data" [86]: sustentadas. Mas o risco residual omite §5.4 (analytics/analyses) e §5.3 (IA, incl. RAG e "ingestion into a context window") da API Policy vigente — ver linha MISMATCH de [85]. Afeta R6 e R7. |
| [27] | Achado 4 TP: "A inovação de 2026 está no simulador indoor (TrainingPeaks Virtual, AI Bots) **e em recursos para coaches**" | PARTIAL | (D) [27] cobre só Virtual/AI Bots/rubberband. "Recursos para coaches" vem de um webinar no YouTube (digest peers-r1, confiança baixa) que não está nas Fontes. Menor. |
| [24] | Insight 1: "a TrainingPeaks [cobra] pelo PMC [24]" | PARTIAL | (D) A página de preços (por digest) lista seis promessas ("Analyze workouts and track your fitness", "Track your Peak Performances"…) sem nomear o PMC; PMC-atrás-do-Premium está em [21]. Menor. |
| [102] | A4: "Em 03/09/2026 o fórum de desenvolvedores mostra pedidos de capacidade de atletas negados sem feedback [102]" | PARTIAL | (D) O conteúdo bate com o digest, mas a URL das Fontes é o board de ideias com label "fitness & freshness", que **redirecionou** para o fórum de devs; a URL não aponta para o que foi lido. Integridade da referência, não do fato. |

## UNREACHABLE (o digest só viu snippet, título ou 403)

| ref | sentence (short) | verdict | note |
|---|---|---|---|
| [29] | Runalyze tiers Free / Supporter €2,50 / Premium €6 ou €66 | UNREACHABLE | (S) 403; valores do índice de busca. O relatório já marca como disputado. |
| [37] | Premium €5,50 | UNREACHABLE | (S) snippet, sem data. |
| [54] | Preço USD 11,99 / 79,99 / Family 139,99 / Runna 149,99 | UNREACHABLE | (S) snippet do Community Hub; relatório diz "primária não lida". |
| [57] | WHOOP One/Peak/Life US$ 199/239/359 | UNREACHABLE | (S) 403; relatório já avisa. |
| [70] | Health Radar: Blood Pressure Signals, Nighttime Breathing, 30 dias | UNREACHABLE | (S) blog da Oura via snippet. |
| [74] | Oura Ring 5 "AI-enabled" | UNREACHABLE | (S) 403; relatório marca confiança baixa. |
| [83] | Training Load: esforço automático (idade, peso, GPS, FC, elevação), 1–10, força manual, 10 dias de baseline, cinco classes, média ponderada | UNREACHABLE | (S) T3 em snippet. Atenção: é [83], não [79], que sustenta todos esses detalhes — o guia da Apple [79] só dá 7 vs 28, "Rate your effort" e "well below to well above". |
| [88] | "Restricted Processing … analytics, analyses, customer insights generation" | UNREACHABLE | (S) snippet. (Coerente com §5.4 da API Policy 2026 vista ao vivo.) |
| [93] | wearables não afetados; assinatura exigida | UNREACHABLE | (S) snippet. |
| [94] | "448% year-to-date"; enquadramento IPO | UNREACHABLE | (S) snippet; relatório já marca baixa. |
| [95] | "Strava Tightens Its API Ahead of an IPO" | UNREACHABLE | (S) só o título. |
| [103] | "Strava API forbids data forwarding"; intervals.icu não repassa atividades do Strava | UNREACHABLE | (S) snippet; thread não lida. Nota: o digest diz que seguidores não veem, mas coaches veem — o relatório simplifica para "não repassa". |
| [104] | intervals.icu batendo rate limits do Strava | UNREACHABLE | (S) snippet. |
| [105] | Tom's Guide: reversão = bloqueio de links externos | UNREACHABLE | (S) 403; teor inferido de snippet. |

## MATCH

| ref | sentence (short) | verdict | note |
|---|---|---|---|
| [1] | Connect+ US$ 6,99/69,99; paywall de Active Intelligence, Performance Dashboard, Live Activity, coaching, LiveTrack, social; "all existing features and data … remain free" | MATCH | (D) |
| [2] | Training Readiness = sono + recovery time + HRV status + acute load + 3 noites + 3 dias de stress; cinco faixas poor→prime | MATCH | (D) |
| [3] | HRV Status de "peaking" a "strained" vs baseline | MATCH | (D) |
| [4] | Training Status só descrição qualitativa | MATCH | (D) |
| [5] | Firmware fev/2026: gear tracking, Course Planner | MATCH | (D) |
| [6] | Firmware jun/2026 | MATCH | (D) |
| [7] | Q3 2026: voz, queda; sem métrica nova | MATCH | (D) |
| [8] | Recepção morna do Connect+ | MATCH | (D, baixa) |
| [9] | US$ 6,99 confirmado em 2026-03 | MATCH | (D) |
| [10] | Perímetro cresceu (Trails+, 3D Maps, Rundown, nutrição IA); "Still Not Worth It After a Year"; Rundown dentro do Connect+ | MATCH | (D) |
| [11] | Active Intelligence e Performance Dashboard | MATCH | (D) |
| [12] | Patente: pico semanal / pico mensal | MATCH | (D, baixa; relatório já marca) |
| [14] | 120 pessoas; termos não divulgados | MATCH | (D) |
| [15] | intervals.icu: F/F/F, intervalos, power curve, HR analytics, custom charts, calendário, builder grátis; Supporter US$ 4 = clima, plano anual, histórico Strava, zonas custom, times | MATCH | (D) |
| [16] | 29/04/2026 expressões matemáticas; comparação de curvas | MATCH | (D) |
| [17] | Dark mode 03/06/2026 | MATCH | (D) |
| [18] | Push 11/08/2026 | MATCH | (D) |
| [19] | Huawei 08/03/2026 | MATCH | (D) |
| [21] | Supporter US$ 4; TP Premium destrava PMC, analytics, plano anual, treinos estruturados; conecta direto ao Strava; forças da TP | MATCH | (D) |
| [22] | 160 mil+ atletas; tempo integral 2024; sem investidores; "vence" para autotreinado | MATCH | (D) |
| [23] | LetsRun: "highly customizable"; contraste econômico; Runalyze "significant depth, though it can be a bit clunky" | MATCH | (D, baixa) |
| [24] | TP Premium US$ 19,95/mês ou 134,99/ano | MATCH | (D) — ver linha PARTIAL para o uso em Insight 1 |
| [25] | Blog ainda diz US$ 124,99 | MATCH | (D) |
| [26] | +8% em 02/04/2025 | MATCH | (D) |
| [28] | Aquisição 22/07/2026 | MATCH | (D) |
| [30] | O que o Premium da Runalyze acrescenta | MATCH | (D) |
| [31] | Redesign 05/05/2026 | MATCH | (D) |
| [32] | Changelog ago/2026: TRIMP no mini-calendário, streaks | MATCH | (D) |
| [33] | Recurring Routes; climbs com score | MATCH | (D) |
| [35] | Effective VO2max pela relação FC × ritmo | MATCH | (D) |
| [36] | Marathon Shape corrige prognose pela "missing fitness" | MATCH | (D) |
| [38] | Lista de assinante: F&F, Relative Effort, Best Efforts, leaderboards (overall/filtrados/seus/Segment Efforts/Live), Training Log, Matched Activities, Cumulative Stats, GAP, Custom HR Zones, Workout/Power/Pace Analysis, Goals, Training Plans, Group Challenges, rotas, Personal Heatmaps, offline, Weather; "atualizada em 03/09/2026" | MATCH | (L) 21 itens confirmados um a um; página marca "Updated today" no dia do acesso |
| [39] | /subscribe: free = gravar, comunidade, segurança, "Try Routes made for you" | MATCH | (D) |
| [40] | Athlete Intelligence: assinantes/trial; "Say More"; só mobile; sem opt-out; não cobre potência estimada, PE, cadência | MATCH | (D) |
| [42] | Reação ao paywall; "$80"; "since 2016" | MATCH | (L) "since the review's debut in 2016" confirmado no Slashdot |
| [43] | €10,99 / 69,99 / Family 119,99 / Runna 149,99; 01/07/2025; 30 países | MATCH | (D) |
| [44] | Sem reajuste documentado; aviso 30 dias | MATCH | (D) |
| [45] | Índice mar–set/2026: Events, Race Discovery, adidas, Galaxy Watch; nenhuma evolução do Athlete Intelligence | MATCH | (D) |
| [46] | Maio/2026: 14 parceiros de força, muscle maps, Adaptive Workouts, Route Deviation Alerts (assinantes); Physical Therapy | MATCH | (D) |
| [47] | Hiking 11/06/2026 | MATCH | (D) |
| [48] | Março: muscle maps, cinco esportes | MATCH | (D) |
| [49] | Janeiro: Instant Workouts global para assinantes | MATCH | (D) |
| [50] | MCP Connector 01/06/2026; "available to all Strava subscribers"; read-only; streams por segundo de FC/ritmo, GPS, potência, clubes, eventos; só Claude; "unsecure third-party tools"; fala de Ryan Dixon | MATCH | (L) tudo verbatim |
| [51] | NUA: "spectacular", "it's still not a coach"; Claude web e desktop; sem proatividade | MATCH | (D) |
| [52] | BikeTips: top 10 no free; Live Segments, rotas, "fitness progress tracking over time" pagos; Local Legends visível | MATCH | (D) |
| [53] | Running Genie: "descriptive (it explains your past)"; Runna US$ 19,99 separado; tendências 30 dias | MATCH | (D) |
| [55] | "Strava follows Garmin"; Reddit; Rundown do Connect+ | MATCH | (L) título e trechos confirmados |
| [56] | Wareable: Performance Predictions; Group Challenges pagos desde ago/2024 | MATCH | (D, baixa) |
| [58] | Recovery 0–100% de RHR, HRV, respiração, sono, temperatura da pele, SpO2 | MATCH | (D; relatório já avisa que a lista de seis não teve confirmação independente) |
| [59] | Strain 0–21 logarítmico; fórmula proprietária | MATCH | (D) |
| [60] | Stress Monitor: HRV contínua diurna vs baseline de 14 dias | MATCH | (D) |
| [61] | road.cc: £169/229/349; MG com ECG e PA; calibração semanas / "over a month"; Coach "lacking in depth and detail"; FC alta atribuída a stress; sem remover pontos | MATCH | (D) |
| [62] | 5.0 e MG em 08/05/2025 | MATCH | (D) |
| [63] | Backlash da taxa de upgrade | MATCH | (D) |
| [64] | PA sem certificação médica | MATCH | (D) |
| [65] | "difficult to recommend, especially at the Life subscription tier" | MATCH | (D) |
| [66] | Oura US$ 5,99/69,99; € igual; primeiro mês grátis | MATCH | (D) |
| [67] | Nove contributors; faixas 85–100/70–84/60–69/0–59; "Last updated: July 14, 2026"; RHR 3–5 acima / 10–15 abaixo; HRV 14 d vs 3 meses; Sleep Balance 2 semanas vs 7–9 h; Sleep Regularity 2 semanas; Activity Balance 14 d vs 2 meses; Recovery Index = curva de FC noturna, 6 h | MATCH | (L) tudo confirmado |
| [68] | Symptom Radar: temperatura, respiração, RHR, HRV, inatividade | MATCH | (D) |
| [69] | Cardiovascular Age do PPG após 14 dias | MATCH | (D) |
| [71] | Health Radar com artigo no Member Care | MATCH | (D) |
| [72] | Sem membership restam três scores | MATCH | (D) |
| [73] | Preço confirmado por agregador | MATCH | (D) |
| [75] | Athlytic site: US$ 29,99/ano; Recovery de HRV+RHR do sono; duas pessoas; "Data Not Collected" | MATCH | (D) |
| [76] | App Store: 26.5.6 (ago/2026), 4,8 em 11 mil, métricas ampliadas, intervalados em reps, recordes, Ask Athlytic com Apple Intelligence, US$ 29,99 | MATCH | (D) |
| [77] | Recovery pesa demais o cardio; Exertion ≈ TSS/Training Effect | MATCH | (D, baixa) |
| [78] | Sleep Score = duração 50 + consistência 30 (13 noites) + interrupções 20; faixas 0–40…96+ ; sem HRV | MATCH | (L) verbatim |
| [79] | Training Load compara últimos 7 dias com os 28 anteriores; "Rate your effort"; "well below to well above"; guia watchOS 26 (e 11) | MATCH | (L) — os detalhes de esforço automático/1–10/10 dias/média ponderada são de [83], não deste guia |
| [80] | Vitals: faixa típica por métrica noturna | MATCH | (D) |
| [81] | Sleep Score no watchOS 26 em 15/09/2025; composição 50/30/20 confirmada; sem mudança do Training Load | MATCH | (D) |
| [82] | 26.2 recalibrou faixas; "a bit too forgiving"; Very Low 0–40 … Very High 96–100 | MATCH | (D) |
| [84] | Quantified Scientist via resumo: "second league" | MATCH | (D, baixa) |
| [85] | A1: "Effective Date: June 1, 2026"; "Strava Data provided by a specific user can only be displayed or disclosed in your Developer Application to that user"; "You may not create applications that compete with or replicate Strava functionality"; sem isenção pessoal/single-user/non-commercial; sem tiers/tetos no contrato | MATCH | (L) verbatim no texto integral — ver linhas MISMATCH/PARTIAL para A2 e A5 |
| [86] | Nov/2024: três mudanças; "coaching platforms … and tools that help users understand their data and performance" | MATCH | (D) |
| [87] | DCR 2024: cláusula "model training related to artificial intelligence, machine learning"; "distinctive look and feel"; contradição com "for analytics, analyses, customer insights generation" | MATCH | (D) — ver PARTIAL para o uso no Sumário |
| [89] | Tiers Standard ("up to 10 athletes") e Extended Access; assinatura para Standard (novos 01/06, existentes até 30/06, 3 meses grátis); 01/09/2026 Segments Explore → Extended, clubes aposentados; até 01/06/2027 api-v3, token no header, oauth/revoke; "Apps routing Strava data through third-party intermediary platforms are no longer supported … Direct integrations are not impacted"; download e wearables não mudam; MCP oficial | MATCH | (L) tudo confirmado, incl. "up to 10 athletes" só na primária |
| [90] | Issue #53: data, assinatura, Segments Explore, prazos de 2027 | MATCH | (D) |
| [91] | Fórum intervals.icu: OpenRowingMonitor, Avitu, Incyclist, BreakAway; "vague enough to mean anything"; "$11.99/month"; queixa é assinatura forçada | MATCH | (D) |
| [92] | Tredict: só assinantes, só Claude, read-only; "controlled, secured channel" | MATCH | (D) |
| [96] | 30/01/2025: "Not only are the numbers different but the fitness trend line is almost the opposite"; 42 dias; TSS vs Relative Effort | MATCH | (D) |
| [97] | Athletica: discrepâncias entre plataformas | MATCH | (D) |
| [98] | Fortune 2024-10-11: "more like a meme than anything" | MATCH | (D) |
| [99] | TechRadar: "still the best training app … but it's getting expensive" | MATCH | (D) |
| [101] | F&F não existe na API | MATCH | (D) |

## Números, datas e citações sem [n]

- **Tabela "Free vs assinatura (setembro de 2026)"** — nenhuma célula tem marcador; carrega "top 10" (vem de [52]) e a lista de assinante (vem de [38]). Derivável dos achados, mas sem rastro na tabela.
- **B, "Cobertura fraca"**: "Reddit devolveu 400 e 403", "meta de seis a dez citações", "três citações datadas" — sem [n]; nota de método, confirmada pelo digest termos-r2.
- **Mapa de staleness**: "31 claims do ledger", "Doze claims já estão fora da janela" — sem [n]; metodologia (ledger não conferido aqui). Nota: [13] aparece em duas linhas (2026-12 e 2027-01).
- **Sumário 2**: "sete dos nove saem de RHR, HRV, sono e atividade" — cláusula após o [67] na mesma frase; sustentada pelo digest de [67].
- **Achado 5 Strava**: "The Breakaway não apareceu em nenhuma fonte" — afirmação de ausência sem [n]; digests confirmam.
- **Perguntas abertas**: "patente Firstbeat US 10.580.532" sem [n] ali (é [12] no corpo).
