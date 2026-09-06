# Digest — D3 apresentação — rodada 2 (telas não cobertas na rodada 1)

**Rodada:** 2 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 12 chamadas (teto), 5 páginas lidas + 4 rodadas de busca. Q2 e Q1 priorizadas conforme instruído; Q3 e Q5 ficaram rasas.

## Achados

### Q2 — App Saúde da Apple (o achado mais forte da rodada)

**A54 — A tela de Sono usa seletor de abas explícito: `D` · `W` · `M` · `6M`. Não há aba de ano.**
Texto literal: *"The bar graph defaults to D for daily. Tap W at the top of the chart to view your sleep history for the past week. You can also tap M or 6M to view your history for the past month or 6 months."*
`fonte: https://support.apple.com/en-us/108906 | publisher: Apple (suporte oficial) | pub: atualizado 14/04/2026 | acesso: 04/09/2026 | confiança: alta | classe: navegacao-temporal`

**A55 — O gráfico é de barras e decompõe estágios NO CONTEXTO DA NOITE.**
Mostra *"the total time spent asleep for a previous night, as well as the time spent in each sleep stage"*. A página **não afirma** que os estágios aparecem nas visões W/M/6M — ao explicar as abas, fala só em *"sleep history"*.
`fonte: https://support.apple.com/en-us/108906 | publisher: Apple | pub: 14/04/2026 | acesso: 04/09/2026 | confiança: alta (para o que diz) / média (para o silêncio sobre o agregado) | classe: tipo-de-grafico`

**A56 — Abaixo do gráfico, "Show More Sleep Data" com três seções.**
**Stages** (duração e % de Awake/REM/Core/Deep), **Amounts** (Sleep Goal, Time Asleep), **Comparisons** (Heart Rate e Respiratory Rate em relação ao tempo dormindo).
`fonte: https://support.apple.com/en-us/108906 | publisher: Apple | pub: 14/04/2026 | acesso: 04/09/2026 | confiança: alta | classe: navegacao-temporal`

**A57 — Sleep Score da Apple, confirmado em fonte oficial DENTRO da barra de frescor.**
Nota 0–100 entregue toda manhã, composta por **duração (50 pts) + consistência do horário de dormir (30 pts) + interrupções (20 pts)**; faixas rotuladas de "Very Low" a "Very High".
`fonte: https://support.apple.com/en-us/108906 | publisher: Apple | pub: 14/04/2026 | acesso: 04/09/2026 | confiança: alta | classe: composicao-de-score`
→ **Terceira corroboração independente do 50/30/20, e a primeira dentro do ≤3 meses.** Sobe para verificada com folga.

**A58 — Descrição independente do Sleep Score.** *"a simplified summary of how well you slept, based on factors such as duration, consistency and restfulness"*.
`fonte: https://engadget.com/mobile/smartphones/how-to-track-your-sleep-and-view-your-sleep-data-in-apple-health-130000023.html | publisher: Engadget | pub: 07/02/2026 | acesso: 04/09/2026 | confiança: média | classe: composicao-de-score`

**A59 — Abas Stages / Amount / Comparisons alternam métricas dentro da mesma janela.** Cores dos estágios: Awake = vermelho, REM = azul-esverdeado, Core = azul cobalto, Deep = roxo.
`fonte: https://myhealthyapple.com/how-to-track-your-sleep-stages-with-apple-watch/ | publisher: MyHealthyApple | pub: 30/08/2023 | acesso: 04/09/2026 | confiança: média — FORA da barra de frescor (3 anos), a UI pode ter mudado | classe: tipo-de-grafico`

**Não recuperado para Q2:** se o Health desenha horário de dormir/acordar ao longo do tempo (nenhuma das três fontes menciona); e a forma exata do gráfico nas abas W/M/6M.

### Q1 — Sleep Cycle

**A60 — Features nomeadas na página de produto:** Sleep Stages (um "journal" de transições), Sleep Quality, Sleep Duration (com "sleep efficiency"), **Regularity** (consistência da janela de sono), Sleep and Snore Recordings, **Sleep Notes** (entrada manual de fatores: exercício, cafeína).
`fonte: https://sleepcycle.com/features/sleep-tracking/ | publisher: Sleep Cycle (MARKETING) | pub: s/ data | acesso: 04/09/2026 | confiança: média — página de marketing, sem contra-verificação | classe: tipo-de-grafico`

**A61 — "Who's Snoring?" distingue quem ronca (usuário vs. parceiro).** O app grava o ronco, diz quando e por quanto tempo, e **guarda amostras de áudio para ouvir**.
`fonte: https://sleepcycle.com/features/sleep-tracking/ + sleepcycle.com/sleep-talk/who-is-snoring + snippet sobre /the-app/sounds | publisher: Sleep Cycle | confiança: média / média-baixa (a parte de áudio via snippet) | classe: tipo-de-grafico`

**A62 — Existe uma seção de Trends** com "long-term trends" e **comparação com benchmarks globais**; roadmap declarado de "delve deeper into each metric within Trends".
`fonte: apps.apple.com (ficha do app) / sleepcycle.com/the-app | confiança: BAIXA — snippet, sem leitura direta | classe: navegacao-temporal`

**Lacuna dura em Q1:** **quais períodos** o Trends oferece, se há seletor de aba, e se existe gráfico de horários. A página de marketing não descreve layout; não sobrou orçamento para help.sleepcycle.com.

### Q3 — Whoop (raso, e com problema de frescor)

**A63 — A seção de sono exibe horas dormidas por noite, o quanto o Whoop recomendou, e tempo na cama** — realizado × necessidade lado a lado.
`fonte: snippet sobre dcrainmaker.com/2021/11/whoop-platform-review.html e fellrnr.com/wiki/WHOOP | pub: 2021 (DCR) | confiança: BAIXA — 5 anos, fora de qualquer barra de frescor; usar só como hipótese | classe: tipo-de-grafico`

**Q3 continua essencialmente sem resposta.** Períodos, relatório semanal/mensal, e o desenho de sleep consistency e sleep debt: sem evidência visual alguma.

### Q4 — Garmin Sleep Score

**A64 — O Sleep Score (0–100) é composto por três fatores:**
1. **Sleep Duration** contra padrões por faixa etária (7–9h para adultos saudáveis);
2. **Sleep Quality** — *"how many times you woke up during the night, when awakenings occurred, and how much time you spent awake after going to bed"* (nº de despertares, **quando** ocorreram, e WASO);
3. **Overnight Recovery** — VFC medindo a razão parassimpático/simpático do SNA.
`fonte: https://www.garmin.com/en-US/blog/health/garmin-sleep-score-and-sleep-insights/ | publisher: Garmin (blog oficial) | pub: 23/06/2021, atualizado 09/2021 | acesso: 04/09/2026 | confiança: média-alta para a composição; PÁGINA DE 5 ANOS, o modelo pode ter evoluído | classe: composicao-de-score`

**A65 — Pulse Ox noturno aparece separado e NÃO entra no Sleep Score.**
`fonte: snippet (Garmin support / the5krunner) | confiança: média-baixa | classe: composicao-de-score`

**A66 — Overlays opcionais nos gráficos: body movement, respiration rate, oxygen saturation.**
`fonte: https://www.garmin.com/en-US/blog/health/garmin-sleep-score-and-sleep-insights/ | publisher: Garmin | pub: 2021 | confiança: média | classe: tipo-de-grafico`

**Não recuperado:** as faixas numéricas rotuladas (Excellent/Good/Fair/Poor) — a página oficial não as define; e os períodos dos gráficos do Garmin Connect.

### Q5 — Crítica de design (fraco; nenhuma review em profundidade lida)

**A67 — Regressão de visualização no Sleep Cycle:** uma atualização recente substituiu o gráfico noturno por um *"more processed and much more highly smoothed"* para destacar estágios, o que *"substantially cuts the ability to view more raw information about body activity during sleep"*.
`fonte: resumo de busca, proveniência NÃO fixada | confiança: BAIXA — não consegui fixar URL/publisher; tratar como pista, não fonte | classe: critica-de-design`

**A68 — Crítica ao score do Whoop:** a métrica de recovery parece basear-se sobretudo na VFC da noite anterior, em vez de modelar strain e performance — score que não explica sua própria composição.
`fonte: snippet sobre fellrnr.com/wiki/WHOOP ("WHOOP Review: a good idea fatally flawed") | confiança: baixa-média — página não lida | classe: critica-de-design`

**Q5 continua praticamente com zero**, como na rodada 1.

## Resposta direta às duas perguntas em aberto

**1. Algum produto usa barra empilhada de estágios em visão semanal/mensal?**
**NÃO CONFIRMADO** — e agora com indício negativo. A página oficial da Apple (14/04/2026) afirma a decomposição por estágio **no contexto da noite**, e ao explicar W/M/6M fala apenas em *"sleep history"*, sem repetir a decomposição. Uma secundária (MyHealthyApple, 08/2023) descreve a visão semanal com as cores dos quatro estágios, o que **sugere** empilhamento no agregado, mas é de 2023 e não faz dupla fonte com nada. **Pela regra de dupla fonte, isto não sustenta decisão de design.** Caminho barato: abrir o Health num iPhone e olhar a aba W.

**2. Qual é o padrão dominante de navegação por período?**
Evidência desta rodada: **seletor de abas de período, curto e explícito, no topo do gráfico** — a Apple usa `D · W · M · 6M`, **sem ano**, com `D` como padrão, e com um **segundo eixo ortogonal de abas por métrica** (Stages / Amount / Comparisons) mais abaixo. Ou seja: **duas dimensões de aba** — período no topo, faceta de métrica no meio.
Confrontado com a rodada 1 (AutoSleep: janela rolante de 12 semanas, *sem* seletor): **apps de plataforma/primeira-parte usam seletor de abas; apps de terceiros especializados tendem à rolagem contínua.** Não recuperei Whoop, Garmin Connect nem Sleep Cycle com detalhe suficiente para chamar isso de "dominante" com honestidade — é leitura de duas amostras. **Confiança: média-baixa.** O único fato duro é o da Apple.
**Sinal secundário relevante: a Apple não oferece visão "ano". Para no 6M.** É um voto contrário à aba de ano.

## Pistas e CONTRADIÇÕES

- **CONTRADIÇÃO sobre o Garmin Sleep Score.** O blog oficial (2021) diz que o segundo componente é **Sleep Quality = despertares, quando ocorreram, e WASO**. Um resumo de busca (the5krunner/agregadores) descreve o segundo componente como **"stage balance across deep, light, and REM"**. Não são a mesma coisa. Prefira a oficial, mas note que ela tem 5 anos — **nenhuma das duas descreve o Sleep Score de 2026**.
- **A composição do Sleep Score da Apple é um presente para a decisão.** 50/30/20 entre duração, consistência e interrupções é repartição **explicitamente publicada** — raro. E a escala não é numérica na apresentação: é **rotulada** ("Very Low" a "Very High"), escolha deliberada contra o número cru.
- **A Apple separa "quando" de "quanto".** Stages / Amount / Comparisons são facetas *da mesma janela temporal*. Alternativa concreta a empilhar tudo num gráfico só, e resolve parte do problema de densidade.
- **A pista mais interessante do Sleep Cycle não é um gráfico:** são as **Sleep Notes** (tags manuais de cafeína/exercício) somadas à **Regularity**. Ecoa o achado da rodada 1 sobre tags da Oura — **dois produtos independentes anotando fatores sobre a série temporal**.
- **Alerta de qualidade de fonte:** vários "achados" desta rodada vieram de resumos gerados sobre resultados de busca, não de páginas lidas. Todos marcados. Nada com confiança "Baixa" deve embasar decisão.

## O que procurei e não achei

- **help.sleepcycle.com** — não alcançado. A doc que responderia os períodos do Trends ficou intocada. **Lacuna mais barata de fechar numa próxima rodada.**
- **Whoop:** nenhuma descrição de tela recente. Só reviews de 2021 e reviews de acurácia (que discutem PSG, não UI). Sleep consistency e sleep debt continuam **sem evidência visual alguma**.
- **Faixas numéricas do Garmin Sleep Score:** a página oficial não as publica; os números que circulam vêm de blogs não verificados.
- **Gráfico de horário de dormir/acordar no Health da Apple:** nenhuma das três fontes menciona. Não é evidência de ausência, mas é **silêncio consistente**.
- **Reviews em profundidade criticando UI de sono:** zero recuperado em duas tentativas. A busca é abafada por reviews de acurácia de hardware — **uma próxima rodada precisa de queries que evitem a palavra "review"**, algo como "sleep app too much data" ou "hypnogram confusing".
