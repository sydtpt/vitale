# Digest — D1 métrica-âncora — rodada 1

**Dimensão:** métrica-âncora e modelo derivado
**Rodada:** 1 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 10 chamadas de ferramenta (teto), ~7 fontes lidas

## Achados

**A1 — Oura: âncora é o "Sleep Score", 0–100, com sete "Sleep Contributors"**
Composto por 7 contribuidores nomeados — Total Sleep, Efficiency, Restfulness, REM Sleep, Deep Sleep, Latency, Timing — cada um com alvo declarado (7–9h; ≥85%; ~1,5h de REM; 15–20% de deep; 15–20 min de latência; midpoint entre meia-noite e 3h).
`fonte: https://support.ouraring.com/hc/en-us/articles/360057792293-Sleep-Contributors | publisher: Oura (suporte oficial) | pub: artigo irmão marcado "atualizado 14/07/2026" | acesso: 04/09/2026 | confiança: alta | classe: composicao-de-score`

**A2 — Oura: escala e faixas nomeadas**
85–100 "Optimal", 70–84 "Good", 60–69 "Fair", 0–59 "Pay Attention".
`fonte: https://support.ouraring.com/hc/en-us/articles/360025445574-Sleep-Score + .../360057792293-Sleep-Contributors | publisher: Oura (duas páginas concordantes) | pub: 14/07/2026 | acesso: 04/09/2026 | confiança: alta | classe: escala-e-interpretacao`

**A3 — Oura NÃO publica pesos**
Nenhuma das duas páginas expõe pesos numéricos; a única hierarquia divulgada é qualitativa — "total sleep time is the most significant contributor".
`fonte: as duas URLs acima | publisher: Oura | pub: 14/07/2026 | acesso: 04/09/2026 | confiança: alta | classe: composicao-de-score`

**A4 — Oura: regularidade NÃO é contribuidor do Sleep Score**
"Sleep Regularity" não aparece como contribuidor. Regularidade de horário é tratada como *recomendação de melhoria*; o que entra no score é "Timing" (alinhamento com cronotipo / midpoint da noite), não a variabilidade entre noites.
`fonte: https://support.ouraring.com/hc/en-us/articles/360057792293-Sleep-Contributors | publisher: Oura | pub: 14/07/2026 | acesso: 04/09/2026 | confiança: média (ausência numa página de suporte não prova ausência no produto) | classe: regularidade`

**A5 — Apple: "Sleep Score" 0–100 com pesos PUBLICADOS 50/30/20**
Duração = 50 pontos, consistência de horário de dormir = 30 pontos, interrupções = 20 pontos.
`fonte: https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos | publisher: Apple (guia oficial watchOS) | pub: página viva, sem data exposta | acesso: 04/09/2026 | confiança: alta — corroborado independentemente por AppleInsider 12/09/2025 | classe: composicao-de-score`

**A6 — Apple: a componente de regularidade tem janela de 13 noites**
"Bedtime consistency considers when you fell asleep during the last 13 nights"; "interruptions" conta frequência e duração dos despertares.
`fonte: https://support.apple.com/guide/watch/view-your-sleep-score-apded441a669/watchos | publisher: Apple | pub: sem data | acesso: 04/09/2026 | confiança: média-alta (fonte única, mas é o fabricante) | classe: regularidade`

**A7 — Apple: mudança de modelo em watchOS 26.2 (relabel das faixas)**
Faixas revistas para Very Low 0–40, Low 41–60, OK 61–80, High 81–95, Very High 96–100 — "Very High" substituindo "Excellent". Motivo declarado: alinhar o rótulo à sensação subjetiva pós-noite. A fórmula não mudou.
`fonte: https://www.macrumors.com/2025/11/04/watchos-26-2-updates-sleep-score-ranges/ + https://9to5mac.com/2025/11/04/watchos-26-2-sleep-score-changes-apple-watch/ | publisher: MacRumors / 9to5Mac | pub: 04/11/2025 (release final 12/12/2025) | acesso: 04/09/2026 | confiança: média — dois publishers, provável upstream único (notas da beta); ~10 meses, FORA da barra de 3 meses | classe: mudanca-de-modelo + escala-e-interpretacao`

**A8 — Apple: proveniência do modelo**
Desenvolvido com American Academy of Sleep Medicine, National Sleep Foundation e World Sleep Society; calibrado sobre ~5 milhões de noites do Apple Heart and Movement Study.
`fonte: https://appleinsider.com/articles/25/09/12/how-sleep-score-works-on-apple-watch-with-watchos-26 | publisher: AppleInsider | pub: 12/09/2025 | acesso: 04/09/2026 | confiança: média (terceiro; não verificado na página da Apple) | classe: composicao-de-score`

**A9 — Whoop: âncora é razão, não score — "Sleep Performance %"**
Sleep Performance = tempo total de sono ÷ "Sleep Need", em %. O Sleep Need é recalculado diariamente = baseline (7–9h) + acréscimo por strain recente + débito acumulado − crédito de cochilos.
`fonte: https://www.whoop.com/us/en/thelocker/how-much-sleep-do-i-need/ + .../everything-to-know-about-sleep/ | publisher: WHOOP (The Locker, oficial) | pub: sem data recuperada | acesso: 04/09/2026 | confiança: média — lido via extração de busca; fetch direto retornou 403 | classe: composicao-de-score + escala-e-interpretacao`

**A10 — Whoop: "Sleep Consistency" existe como métrica própria**
Exibida ao lado de Performance, Efficiency e Sleep Debt; janela citada de 4 dias.
`fonte: https://www.whoop.com/us/en/thelocker/new-feature-sleep-consistency-why-we-track-it/ (existência confirmada, conteúdo NÃO lido — 403) + janela via https://whoopal.com/whoop-sleep | publisher: WHOOP / Whoopal (terceiro) | pub: sem data | acesso: 04/09/2026 | confiança: BAIXA para a janela de 4 dias e para o agrupamento | classe: regularidade`

**A11 — Rise Science: âncora é DÉFICIT EM HORAS, não score**
Ancora em "sleep debt" — sono necessário menos sono obtido, acumulado sobre as últimas 14 noites — e trata "circadian alignment" como segundo eixo, rejeitando explicitamente o sleep score como métrica-guia.
`fonte: https://www.risescience.com/blog/sleep-tracking + https://www.risescience.com/blog/sleep-score | publisher: Rise Science (blog oficial) | pub: sem data recuperada | acesso: 04/09/2026 | confiança: média | classe: escala-e-interpretacao + regularidade`

## Tabela comparativa

| Produto | Âncora ("o número da noite") | Escala | Componentes conhecidos | Pesos publicados? |
|---|---|---|---|---|
| **Oura** | "Sleep Score" | 0–100 · Optimal 85+ / Good 70–84 / Fair 60–69 / Pay Attention <60 | Total Sleep, Efficiency, Restfulness, REM, Deep, Latency, Timing (7) | **Não** — só "total sleep é o mais significativo" |
| **Apple Watch (watchOS 26)** | "Sleep Score" | 0–100 · faixas revistas no 26.2: Very Low 0–40 / Low 41–60 / OK 61–80 / High 81–95 / Very High 96–100 | Duração, consistência do horário de dormir (13 noites), interrupções (3) | **Sim — 50 / 30 / 20** |
| **Whoop** | "Sleep Performance" | % de uma necessidade calculada (≥95% = necessidade atendida) | Total sleep ÷ Sleep Need; Need = baseline + strain + débito − naps. Ao lado: Efficiency, Consistency, Sleep Debt | Parcial — a razão é declarada; a composição do Need não é quantificada |
| **Rise Science** | "Sleep debt" (déficit) | Horas de débito acumulado em 14 noites + "circadian alignment" como eixo separado | Necessidade individual vs. sono obtido; timing vs. ritmo circadiano | N/A — não é score ponderado |
| **Garmin** | "Sleep Score" + "Sleep Coach" | não verificado | não verificado | não verificado |
| **AutoSleep / Sleep Cycle / Athlytic / Bevel** | não verificado | — | — | — |

## Pistas

- **CONTRADIÇÃO com a premissa do briefing (prioridade máxima).** O briefing supunha que a Oura tem "Sleep Regularity" ancorando regularidade. A página oficial de contribuidores lista sete e **nenhum é regularidade entre noites** — o mais próximo é "Timing" (alinhamento com cronotipo/midpoint), não variabilidade. Ou a feature existe fora do Sleep Score (Readiness? insight separado?), ou a premissa está desatualizada. **Não resolvido** — exige busca dedicada antes de qualquer decisão apoiada nela.
- **Inversão instrutiva Apple × Oura.** A Apple é o único que **publica pesos** e o único cuja âncora dá 30% a **regularidade de horário**, com janela explícita de 13 noites. A Oura, com 7 componentes fisiológicos, publica zero pesos. Para uma tela pessoal, o modelo Apple é auditável e reproduzível a partir de dados que qualquer app tem (hora de dormir, duração, despertares); o modelo Oura exige estágios confiáveis e ainda é caixa-preta.
- **Duas famílias de âncora, não uma.** Score composto normalizado (Oura, Apple, Garmin) versus razão/déficit contra uma necessidade calculada (Whoop %, Rise horas). A segunda é acionável sem calibração de estágios e explica por si o que fazer ("dormir X h a mais"); a primeira comprime tudo num número que não diz o que corrigir.
- **A Rise argumenta ativamente CONTRA sleep scores** — página inteira em `/blog/sleep-score` posicionando débito como a métrica correta. É o contra-argumento explícito à decisão em jogo.
- **Mudança de modelo recente e barata de imitar:** a Apple mexeu nas faixas em 26.2 sem mexer na fórmula — só nos rótulos, para casar com a sensação subjetiva. Sinaliza que a calibração dos *rótulos* é onde mora o valor percebido, não a precisão do número.

## O que procurei e não achei

- **Garmin (Sleep Score + Sleep Coach):** fetch retornou só navegação/rodapé. **Zero evidência recuperada** sobre composição, escala ou inputs. Próximo passo: `support.garmin.com` FAQ ou whitepaper do Firstbeat Analytics.
- **Whoop, página oficial de Sleep Consistency:** HTTP 403 no `whoop.com/thelocker`. Tudo da Whoop vem de extração de busca; a janela de 4 dias vem de terceiro. **A cláusula de dupla fonte NÃO está satisfeita** para a composição do Sleep Need.
- **AutoSleep, Sleep Cycle, Athlytic, Bevel:** orçamento esgotado antes de qualquer busca. Zero evidência. A hipótese de que o AutoSleep usa anéis/readiness é **crença não verificada**.
- **Apple Sleep Score em fonte oficial com data:** guia é página viva, sem data. A datação veio de terceiros.
- **Qualquer redesign recente da Oura (≤3 meses):** nada encontrado; as páginas de suporte não registram histórico de versão do modelo.
- **Barra de frescor:** só a Oura (14/07/2026) cumpre o ≤3 meses. Apple, Whoop e Rise estão em páginas sem data ou cobertura de nov/dez 2025 — sinalizado item a item.
