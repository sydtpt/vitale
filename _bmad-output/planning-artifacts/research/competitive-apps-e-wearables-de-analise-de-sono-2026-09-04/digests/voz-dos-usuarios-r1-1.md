# Digest — D4 voz dos usuários (as reclamações) — rodada 1

**Dimensão:** voz dos usuários — reviews 1–3★ e threads de reclamação
**Rodada:** 1 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 10 chamadas, 2 páginas na íntegra + 8 digests de busca

> **Aviso epistêmico que muda como ler tudo abaixo:** o Reddit está **bloqueado ao crawler** (erro 400 duro). Nenhuma thread de r/ouraring, r/whoop ou r/AppleWatch foi lida em primeira mão. Todo sentimento do Reddit aqui chega **de segunda mão**, via a petição da class action da Oura e cobertura de imprensa. Confiança rebaixada item a item.

## Achados

### desconfianca-do-score

**A29 — Uma class action contra a Oura foi construída sobre "acordei destruído e o app me deu nota alta".**
A petição reproduz screenshots de reclamações colhidas em um grupo de proprietários no Facebook **e** no subreddit r/ouraring — duas comunidades independentes. Usuários "describe waking up exhausted and then being handed a high score by the app". A ação alega que estimativas por IA têm "a coin flip's chance of being correct".
`fonte: https://techcrunch.com/2026/08/21/oura-faces-lawsuit-accusing-it-of-misleading-consumers-about-sleep-tracking-accuracy/ | publisher: TechCrunch (petição é o upstream; 9news, Daily Wire, frontpacksports reciclam = UM publisher) | pub: 21/08/2026 | acesso: 04/09/2026 | confiança: alta (quanto ao conteúdo da ação), média (quanto às alegações técnicas — são acusação, não fato provado) | classe: desconfianca-do-score`

**A30 — A Apple recalibrou a própria escala — admissão implícita de que a nota era generosa.**
Um resenhista dormiu 7h16 e recebeu **93 / "Excellent"** enquanto outros rastreadores reprovaram a mesma noite. O watchOS 26.2 **elimina a faixa "Excellent"**, e torna nota muito baixa mais fácil e nota muito alta mais difícil.
`fonte: https://www.tomsguide.com/wellness/sleep-tech/why-your-apple-watch-sleep-score-is-low-even-when-you-sleep-eight-hours-a-night | publisher: Tom's Guide / Yahoo Tech | pub: 2026 | acesso: 04/09/2026 | confiança: média (digest de busca) | volume: 1 resenhista + a mudança de produto | classe: desconfianca-do-score`

**A31 — "Sabemos a nota, mas não dá pra saber se estamos ganhando."**
Verbatim: *"While the app shows the elements of sleep each session, it does not tell you if the amount of time in each phase is acceptable. We know 'the score' but cannot tell from the app if we are winning."*
`fonte: https://www.trustpilot.com/review/www.sleepcycle.com | publisher: Trustpilot (Sleep Cycle) | pub: reviews até 12/05/2026 | acesso: 04/09/2026 | confiança: alta (lido na íntegra), mas volume baixo demais para padrão | volume: n=23 reviews, 2.4★, 52% de 1★ — amostra minúscula e autosselecionada | classe: analise-fraca`

### precisao

**A32 — Noite fragmentada: o Garmin descartou o primeiro bloco de sono inteiro.**
Usuário dormiu 4h30, ficou 2h acordado, dormiu mais 2h30. Oura mostrou a linha do tempo completa com nota 84; Garmin Connect mostrou **só o último segmento** — 2h30 e nota **38**. Mesma noite, 46 pontos de diferença.
`fonte: https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-970/443119/inaccurate-sleep-tracking (+ threads irmãs 965 e Epix Gen 2) | publisher: Garmin Forums | pub: datas não confirmadas | acesso: 04/09/2026 | confiança: média-baixa (digest; thread não aberta) | volume: múltiplas threads em produtos distintos | classe: precisao`

**A33 — O relógio inventou a janela de sono a partir do horário do perfil, não do sono real.** Venu Sq registrou sono de meia-noite às 2h para quem foi deitar às 2h.
`fonte: Garmin Forums / Tom's Guide forums | confiança: baixa (relato único via digest) | volume: 1 | classe: precisao`

**A34 — Sono profundo diverge por fator de 4–7× entre aparelhos no mesmo usuário.** Garmin 10–20 min de deep contra 75–90 min do WHOOP 4.0.
`fonte: Garmin Forums | confiança: baixa-média (percepção de usuário comparando aparelhos, NÃO fato técnico) | volume: 1 relato detalhado + eco | classe: precisao`

**A35 — Detecção de vigília é o elo fraco medido em laboratório.** Validação do Whoop: sensibilidade para detectar tempo acordado de **60%** no modo auto (concordância geral 86%) e **45%** no manual.
`fonte: https://doaj.org/article/55f72883d1734718b989697095a0fb7d | publisher: Biosensors | pub: 2021 (fora da barra de 12 meses — usado como contexto técnico, não sentimento) | confiança: média (digest) | classe: precisao`

**A36 — Vigília silenciosa é lida como sono.** Rastreadores usam movimento e pulso óptico como proxy, não atividade cerebral; "quiet wakefulness can be read as sleep and short awakenings can be missed".
`fonte: https://www.fulcradynamics.com/blog/when-sleep-scores-dont-match-how-you-feel | publisher: Fulcra Dynamics (blog DE FORNECEDOR — enviesado) | confiança: média para o mecanismo, baixa como fonte independente | classe: precisao`

**A37 — AutoSleep superestima sono vs. rastreio nativo da Apple**, e o índice de prontidão contradiz as demais métricas do próprio app. O suporte respondeu a um pedido de reembolso dizendo que o app é feito para clientes *"tech savvy"*.
`fonte: https://forums.macrumors.com/threads/apple-watch-ios16-sleep-app-vs-autosleep-app.2358793/ | publisher: MacRumors Forums | confiança: baixa (digest; sem data nem volume) | classe: precisao + analise-fraca`

### analise-fraca

**A38 — "As métricas inferidas e o conselho que o relógio dá não são úteis."** O problema não é o dado bruto — é a camada de interpretação.
`fonte: Garmin Forums | confiança: média-baixa (digest) | volume: ao menos 3 threads de produtos diferentes | classe: analise-fraca`

**A39 — Dados internamente contraditórios dentro do mesmo app.** Threads da comunidade Samsung intituladas *"Sleep data COMPLETELY wrong and contradictory"*.
`fonte: https://us.community.samsung.com/t5/Galaxy-Watch/Sleep-data-COMPLETELY-wrong-and-contradictory/m-p/2314347 | publisher: Samsung Community | confiança: baixa-média (digest; thread marcada "Solved", resolução não verificada) | volume: threads com múltiplas páginas | classe: analise-fraca`

### ansiedade-de-dados (ortossonia)

**A40 — Ortossonia é entidade clínica nomeada, não folclore.** Cunhada em 2017 por Kelly Glazer Baron e colegas (Rush University Medical Center), publicada no *Journal of Clinical Sleep Medicine*. Pacientes chegavam a clínicas sem transtorno diagnosticável — com a fixação de que o rastreador dizia que o sono era inadequado, e a perseguição de números melhores virou o problema.
`fonte: https://www.sleepfoundation.org/orthosomnia + https://en.wikipedia.org/wiki/Orthosomnia | confiança: alta quanto à existência e origem; média quanto ao detalhe (paper original não lido) | classe: ansiedade-de-dados`

**A41 — Prevalência medida: 3% a 14%, e casos têm insônia pior.** Estudo transversal de 2024 com **523 adultos**: prevalência de 3% a 14% conforme o rigor da definição; **35,8%** usavam wearable de sono regularmente; identificados com ortossonia tiveram escores de insônia consistentemente mais altos.
`fonte: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11592250/ | publisher: PMC (revisado por pares) | pub: 2024 | acesso: 04/09/2026 | confiança: média-alta (digest; paper não aberto — reconferir os números antes de citar publicamente) | classe: ansiedade-de-dados`

**A42 — O efeito é fortemente etário.** ~23% dos usuários de 18–35 anos relataram que apps de sono os deixaram estressados com o próprio sono, contra 2,4% entre os 66+.
`confiança: BAIXA — número apareceu em digest SEM atribuição primária clara. NÃO usar sem rastrear a fonte original. | classe: ansiedade-de-dados`

### pedido-nao-atendido

**A43 — Poder corrigir o dado errado.** *"I wish you could edit your sleep for the day by adding naps or adjusting the wake time."*
`fonte: Trustpilot / Sleep Cycle | confiança: alta (lido), volume 1 → SINAL ISOLADO por si só; ganha força indireta por A32 e A33 | classe: pedido-nao-atendido`

**A44 — Um referencial que diga se o número é bom.** (ver A31) O pedido não é por mais métrica — é por um julgamento sobre a métrica que já existe.

## Padrões de reclamação — ordenados por nº de fontes independentes

| # | Reclamação | Produtos | Fontes indep. | O que implica para quem projeta |
|---|---|---|---|---|
| 1 | **A nota discorda do corpo.** Acordar destruído e receber nota alta (ou o inverso) | Oura, Apple Watch, Samsung, Garmin | **4** | Não faça da nota o herói da tela. Se aparecer, precisa de caminho de contestação: mostrar *por que* deu isso (que sub-métrica puxou) e aceitar que o usuário discorde. **Registrar a percepção subjetiva ao lado da nota transforma o conflito em dado em vez de erro.** |
| 2 | **Estagiamento (REM/deep) não é crível.** Diverge 4–7× entre aparelhos no mesmo usuário | Oura, Garmin, Whoop | **3** | Estágios são a métrica de **menor confiança e maior destaque visual** nas telas atuais — inversão de prioridade. Se exibir, exiba com incerteza explícita e nunca como base de conselho. Duração e regularidade são mais defensáveis. |
| 3 | **Janela de sono detectada errada** — segmento descartado, janela inferida do perfil, vigília parada contada como sono | Garmin, AutoSleep, Whoop | **3** | Assuma que a janela vai errar e projete a **correção manual como caminho de primeira classe**, não configuração escondida. Uma tela que não deixa consertar o input transforma erro de sensor em desconfiança no produto inteiro. |
| 4 | **Número sem veredito.** Mostra fases, não diz se estão boas | Sleep Cycle, Garmin | **2** (volume baixo dos dois lados) | O gráfico bonito não é a entrega. A entrega é a frase que diz o que aquilo significa *para esta pessoa*, contra a linha de base dela — não contra norma populacional. |
| 5 | **Métricas do mesmo app se contradizem** | AutoSleep, Samsung | **2** | Antes de somar uma métrica derivada nova, verifique que ela não pode contradizer visivelmente as vizinhas. Coerência interna vale mais que quantidade de indicadores. |
| 6 | **Rastrear piora o sono** (ortossonia) | transversal | **2 revisadas por pares** | Risco que a tela pode **ativamente causar**. Concretamente: nada de streak de nota, nada de notificação matinal empurrando número ruim, e um modo em que se vê tendência sem ver o placar do dia. 3–14% não é caso de borda. |
| 7 | **Não dá para corrigir o dado** (cochilos, hora de acordar) | Sleep Cycle (+ implícito Garmin) | **1 direta** → sinal isolado | Alta convicção mesmo assim, por ser a solução do padrão 3. Colete mais evidência antes de dimensionar esforço. |

## Pistas

- **CONTRADIÇÃO 1 — a Oura é a mais precisa ou é cara ou coroa?** Petição (ago/2026): "coin flip's chance of being correct"; determinar estágio exigiria "electrodes in the scalp and sensors on the eyes". Do outro lado: estudo de um grande hospital americano concluiu que o Oura foi o rastreador de consumo **mais preciso** em classificação de quatro estágios (https://www.businesswire.com/news/home/20241010549704/) — **mas é press release da própria Oura sobre o estudo**, o que enfraquece a peça sem invalidar o estudo. **Leitura útil: "mais preciso da categoria" e "não confiável o suficiente para exibir com autoridade" podem ser as duas verdadeiras ao mesmo tempo. O teto da categoria é baixo.**
- **CONTRADIÇÃO 2 — a direção do viés é oposta entre produtos.** Apple Watch criticado por **superestimar**; usuários Garmin reclamam de notas **baixas demais**. Não existe um erro de calibração único a evitar. O que é universal não é a direção do viés — é o **descolamento entre nota e sensação**. **Projete para o descolamento, não para uma correção de calibragem.**
- **CONTRADIÇÃO 3 — melhorias de vendor vs medição independente.** Notebookcheck relatou update do Whoop tornando o estagiamento "7% mais preciso" (números do fabricante). A validação independente mostra sensibilidade de vigília de 45–60%. Ganhos percentuais anunciados sobre base fraca não mudam a conclusão de design.
- **CONEXÃO INESPERADA:** a reclamação #1 (nota discorda do corpo) e o padrão #6 (ortossonia) são **o mesmo fenômeno em dois registros**. A literatura clínica descreve como patologia o que os fóruns descrevem como bug. **A tela de sono tem uma responsabilidade que uma tela de treino não tem: mostrar um número contestável para alguém acabando de acordar tem custo clínico documentado.**
- **Entidade nova:** a class action da Oura (ago/2026) é marco de contexto — pela primeira vez o reclame de fórum sobre precisão virou peça jurídica com screenshots de Reddit anexados. O desfecho pode forçar mudanças de rotulagem na categoria.

## O que procurei e não achei

1. **Nenhuma thread do Reddit lida em primeira mão.** Erro 400 duro ao crawler. **Maior lacuna do relatório.** Antes de fechar decisões sobre os padrões 1 e 2, alguém deveria abrir essas threads manualmente.
2. **Corpus de reviews 1–3★ da App Store: não obtido.** justuseapp retornou 403. O único corpus lido — Trustpilot do Sleep Cycle — tem **n=23**, pequeno demais para padrão sozinho e autosselecionado.
3. **Zero evidência sobre Bevel, Athlytic e Rise Science.** Estavam no briefing, não apareceram; orçamento acabou.
4. **Reclamações sobre EXPORTAÇÃO de dados: não encontradas.** Não posso afirmar que não existam — só que não emergiram.
5. **Reclamações sobre HISTÓRICO CURTO: não encontradas.** Idem.
6. **"Correlações prometidas e não entregues": não encontradas.** A hipótese do briefing não se confirmou nem se refutou.
7. **Cochilos contados como noite: só evidência indireta.**
8. **Volume quase sempre ausente.** Trate as frequências da tabela como **contagem de fontes independentes**, não como magnitude.
