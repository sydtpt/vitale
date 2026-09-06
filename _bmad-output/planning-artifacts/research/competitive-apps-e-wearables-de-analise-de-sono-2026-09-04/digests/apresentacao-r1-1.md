# Digest — D3 apresentação (gráficos e navegação temporal) — rodada 1

**Dimensão:** apresentação — gráficos e navegação temporal
**Rodada:** 1 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 10 chamadas (teto)

**Aviso de cobertura:** bem coberto — Oura e AutoSleep (doc do fabricante, lida direto). Parcial — Rise e Garmin (só trechos de busca). **Sem evidência — Sleep Cycle, Whoop, Bevel, Athlytic, app Saúde da Apple.**

## Achados

**A12 — "Sleep timing chart": barras verticais posicionadas na hora do dia**
Hora de deitar no topo, hora de acordar embaixo; tempo dormido como barra azul sólida; interrupções como falhas (gaps) dentro da barra. Mostra time in bed, time asleep e awake time. Acompanha a métrica escalar "sleep regularity".
`fonte: https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends + .../4403155260307-Sleep-Graphs | publisher: Oura (fabricante) | pub: não datada | acesso: 04/09/2026 | confiança: alta (dois artigos convergentes) | classe: tipo-de-grafico`

**A13 — Oura: quatro períodos, média sempre visível, correlação por tag**
Trends oferece daily/weekly/monthly/yearly. Cada gráfico mostra a métrica mais recente e uma média (90 dias no daily; "desde o início dos dados" nos demais). Rolagem horizontal para ver mais. Tags aplicadas na própria tela de trends revelam correlações entre comportamento e as tendências.
`fonte: https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends | publisher: Oura | pub: não datada | acesso: 04/09/2026 | confiança: alta | classe: navegacao-temporal + linha-de-base + correlacao`
⚠️ A doc **não** diz como se troca de período no celular (dropdown só na versão web) nem se tocar num ponto abre o detalhe da noite. Não assumir nenhum dos dois.

**A14 — Oura: redesign de 5 → 3 abas (out/2025)**
Home/Readiness/Sleep/Activity/Resilience → Today / Vitals / My Health. Vitals dá visões at-a-glance; My Health concentra tendências de longo prazo em gráfico.
`fonte: https://techcrunch.com/2025/10/20/oura-launches-redesigned-app-and-cumulative-stress-feature + https://ouraring.com/blog/new-oura-app-experience/ | publisher: TechCrunch + Oura | pub: 20/10/2025 | acesso: 04/09/2026 | confiança: média (só trechos de busca) | classe: navegacao-temporal`

**A15 — AutoSleep: janela rolante de 12 semanas, SEM seletor de período**
Não oferece dia/semana/mês/ano. Swipe horizontal nos gráficos muda a faixa de datas; swipe vertical no calendário. Caixa branca contornada destaca a semana em foco. Seis abas de métrica por ícone: Sleep Rating, Quality Sleep, Sleep Duration, In Bed At, Heartrate, Deep Sleep (+ REM e Deep Stage com Sleep Stages ligado).
`fonte: https://autosleepapp.tantsissa.com/history | publisher: Tantsissa (fabricante) | pub: não datada | acesso: 04/09/2026 | confiança: alta | classe: navegacao-temporal + tipo-de-grafico`

**A16 — AutoSleep: drill-down em dois níveis (peek → push)**
Tocar numa data abre um banner com as métricas da noite; "touch and hold" leva à Clock view completa daquela noite, com edição.
`fonte: https://autosleepapp.tantsissa.com/history | publisher: Tantsissa | acesso: 04/09/2026 | confiança: alta | classe: navegacao-temporal`

**A17 — AutoSleep: baseline em três camadas simultâneas**
Canto superior direito traz a média das 12 semanas E a média da semana atual; uma linha horizontal fina marca a média da semana. No gráfico Time Asleep (28 dias), linha roxa = média móvel de 7 dias. Barras coloridas por semáforo contra a meta (vermelho ruim, verde bom, azul excepcional).
`fonte: https://autosleepapp.tantsissa.com/history + .../today/time-asleep | publisher: Tantsissa | acesso: 04/09/2026 | confiança: alta (history) / média (time-asleep) | classe: linha-de-base`
→ **O AutoSleep nunca mostra um valor absoluto sozinho.**

**A18 — AutoSleep: hipnograma com scrub e séries sobrepostas por checkbox**
Sleep Session graph mostra o sono como barras (agitação e profundo). Arrastar o dedo abre pop-up com cada bloco de 15 min. Checkboxes ligam/desligam bpm, HRV, ruído (dB), ronco, respiração (BrPM) e SpO2 sobre a mesma base temporal.
`fonte: https://autosleepapp.tantsissa.com/clock/sleep (trecho de busca) | publisher: Tantsissa | acesso: 04/09/2026 | confiança: média (página não aberta) | classe: tipo-de-grafico`

**A19 — Rise: curva de sleep debt de 14 noites com peso decrescente**
Principal gráfico da aba Sleep. A noite anterior pesa 15%; os 13 dias anteriores respondem por 85%, com noites recentes pesando mais. Recomendação: manter o débito abaixo de 5 h. É um de **três gráficos alternáveis** na aba — junto com sleep/wake times e sleep quality. Rolando, o histórico completo aparece **em forma de tabela**.
`fonte: https://help.risescience.com/hc/en-us/articles/6047219133079 + https://www.risescience.com/blog/how-much-sleep-debt-do-i-have | publisher: Rise Science | pub: não datada | acesso: 04/09/2026 | confiança: média (help retornou 403; trechos de busca de duas páginas do fabricante) | classe: tipo-de-grafico + linha-de-base`

**A20 — Garmin: necessidade de sono personalizada em vez de meta fixa**
O sleep coach estima a necessidade pessoal em intervalos de 10 min usando idade, atividade diária e de longo prazo, histórico recente, cochilos e HRV — **nunca abaixo de 7 nem acima de 9 h**. A tela mostra tempo total, fases, horários de deitar/acordar e gráfico detalhado de fases, inclusive no relógio.
`fonte: https://www.garmin.com/en-US/blog/health/garmin-sleep-score-and-sleep-insights/ + https://www.wareable.com/garmin/garmin-sleep-tracking-guide-7529 | publisher: Garmin + Wareable | pub: não confirmada | acesso: 04/09/2026 | confiança: média (só trechos) | classe: linha-de-base`

**A21 — Oura: correlação é por tags anotadas sobre a série, não por dispersão**
`fonte: https://support.ouraring.com/hc/en-us/articles/360055983614-Using-Trends | publisher: Oura | acesso: 04/09/2026 | confiança: alta | classe: correlacao`

## Inventário de gráficos

| Gráfico | Quem usa (evidenciado) | O que responde | Dado que exige | Celular? |
|---|---|---|---|---|
| **Sleep timing chart** (barras verticais na hora do dia, gaps = despertares) | Oura (alta); Rise tem "sleep/wake times" como 1 de 3 (média) | "Meu horário é regular?" | bedtime, waketime, intervalos de vigília | **Sim, e é o melhor caso** — ~14 barras cabem na largura de um telefone |
| **Hipnograma / Sleep Session** (+ scrub por bloco de 15 min) | AutoSleep (média) | "Como foi *esta* noite?" | estágios/agitação com timestamps | Sim, só na tela de detalhe; exige scrub |
| **Séries fisiológicas sobrepostas por checkbox** | AutoSleep (média) | "O que aconteceu com meu corpo às 3h?" | séries intranoite alinhadas | Sim — checkbox evita 6 gráficos empilhados |
| **Curva de sleep debt** (14 noites ponderadas) | Rise (média) | "Quanto estou devendo agora?" | duração + necessidade estimada | Sim; linha única |
| **Barras diárias + linha de média semanal** | AutoSleep (alta) | "Esta semana ficou acima do meu normal?" | duração/noite + média rolante | Sim |
| **Média móvel de 7 dias sobre 28 dias** | AutoSleep (média) | "A tendência sobe?" | 28 noites | Sim |
| **Barras por semáforo contra meta** | AutoSleep (alta) | "Bati a meta?" sem ler o eixo | meta por métrica | Sim; cor faz o trabalho do eixo |
| **Calendário com drill-down** (tap = banner, hold = noite) | AutoSleep (alta) | "Qual foi a noite estranha?" | 12 semanas de resumos | Sim |
| **Gráfico de fases** | Garmin (média), Oura (implícito) | "Quanto de profundo/REM?" | estágios | Sim |
| **Barras empilhadas de estágios em visão semanal/mensal** | **NÃO EVIDENCIADO** | — | — | — |
| **Scatter de correlação** | **NÃO EVIDENCIADO** — Oura usa tags sobre a série | — | — | — |
| **Heatmap de sono** | **NÃO EVIDENCIADO** | — | — | — |

## Pistas

- **CONTRADIÇÃO com a premissa do briefing.** O briefing atribuía o gráfico de horários ao Sleep Cycle e ao Rise. A evidência **não sustenta**: o nome canônico e a descrição mais completa vieram da **Oura**. Do Rise, só que "sleep/wake times" existe como um dos três. Do **Sleep Cycle, nada** — busca dedicada retornou zero. Tratar a **Oura como a referência documentada** desse gráfico.
- **Convergência inesperada: ninguém que foi lido usa seletor dia/semana/mês/ano do jeito óbvio.** AutoSleep **rejeita** o seletor (janela rolante de 12 semanas + swipe). Oura declara os 4 períodos mas descreve dropdown só na web e rolagem horizontal no app. Rise alterna entre **três gráficos** dentro de um período fixo de 14 dias, não entre períodos. **A rolagem horizontal contínua aparece mais que abas de período** — e um produto maduro decidiu que "mês" e "ano" não valem uma aba.
- **Duas gramáticas de baseline.** (a) *Comparar contra a média* — AutoSleep, com três referências simultâneas + semáforo. (b) *Mover a própria meta* — Garmin, necessidade recalculada por HRV e carga. (b) é mais útil para quem treina, mas exige modelo defensável e limites duros (a Garmin trava entre 7 e 9 h — sinal de que o modelo sozinho produzia números indefensáveis).
- **"Sleep regularity" é métrica escalar, não só gráfico** (Oura). Se a tela mostrar o timing chart, existe um número padrão para pôr ao lado.
- **Sinal fraco (Rise): tabela como fallback** para o histórico longo. Um produto mobile-first preferiu tabela a esticar o gráfico.

## O que procurei e não achei

1. **Sleep Cycle — zero evidência.** Query dedicada não retornou nada sobre o produto. A premissa do briefing sobre ele está **não verificada**.
2. **Whoop — nenhuma descrição de tela.** Só que existe Recovery Score 0–100. Nada de gráficos, períodos ou relatório mensal.
3. **App Saúde da Apple — nenhuma evidência da própria UI**, nem do seletor D/W/M/6M/Y.
4. **Bevel e Athlytic — nenhuma fonte tocada.** Orçamento esgotado.
5. **Barras empilhadas de estágios em visão semanal/mensal** — nenhum produto documentado fazendo. Pode ser lacuna de busca ou sinal de que não é padrão. Indeterminado.
6. **Heatmap e scatter** — nenhuma evidência de uso. A única mecânica de correlação evidenciada é **tag anotada sobre a série** (Oura).
7. **Declarações sobre causalidade** — nenhuma frase de fabricante recuperada.
8. **Críticas de design — praticamente vazia.** Nenhuma review em profundidade aberta (The Verge, Wirecutter, DC Rainmaker, Quantified Scientist ficaram fora). Zero crítica documentada sobre densidade, score sem explicação ou hipnograma incompreensível.
9. **Correlação sono × álcool/cafeína/treino como visual concreto** — nada além do mecanismo de tags.
