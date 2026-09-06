# Digest — D2 instrumentação (que dado bruto cada análise exige) — rodada 1

**Dimensão:** instrumentação — dado bruto exigido por cada métrica derivada
**Rodada:** 1 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 11 chamadas (estourou o teto de 10), ~6 fontes efetivamente lidas

## Achados

**A22 — HealthKit expõe sono como INTERVALOS, não como agregado diário**
`HKCategoryValueSleepAnalysis` tem 6 casos — `inBed(0)`, `asleepUnspecified(1)`, `asleepCore(2)`, `asleepDeep(3)`, `asleepREM(4)`, `awake(5)` — e **cada amostra é um intervalo com start/end date**, não um total diário.
`fonte: https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis | publisher: Apple Developer Documentation | pub: n/d (docs vivas) | acesso: 04/09/2026 | confiança: alta | classe: superficie-de-api`
→ **O timestamp já está na fonte.** Um app que só persiste durações descarta informação que a API entrega de graça.

**A23 — WHOOP publica os campos brutos por noite, com nomes verbatim**
A API retorna por atividade de sono: `start`, `end`, `timezone_offset`, `nap` (booleano) e, no score: `total_in_bed_time_milli`, `total_awake_time_milli`, `total_no_data_time_milli`, `total_light_sleep_time_milli`, `total_slow_wave_sleep_time_milli`, `total_rem_sleep_time_milli`, `sleep_cycle_count`, `disturbance_count`, `sleep_needed{baseline_milli, need_from_sleep_debt_milli, need_from_recent_strain_milli, need_from_recent_nap_milli}`, `respiratory_rate`, `sleep_performance_percentage`, `sleep_consistency_percentage`, `sleep_efficiency_percentage`.
`fonte: https://developer.whoop.com/docs/developing/user-data/sleep/ | publisher: WHOOP Developer Platform | pub: n/d (docs vivas) | acesso: 04/09/2026 | confiança: alta | classe: superficie-de-api + sinal-bruto`
→ Quatro pontos: `nap` é **booleano no registro**, não inferência posterior; `timezone_offset` é campo de primeira classe (sem ele hora-do-dia é ambígua em viagem — e viagem é exatamente onde jetlag social importa); `total_in_bed_time_milli` existe ao lado dos estágios e **é o denominador da eficiência**; `need_from_sleep_debt_milli` mostra débito modelado como acumulador com histórico.

**A24 — Oura separa registro por período de sono e rolagem diária**
`GET /v2/usercollection/sleep` traz registros por período (estágios, latency, efficiency, timing); `GET /v2/usercollection/daily_sleep` traz o score diário e contributors.
`fonte: https://cloud.ouraring.com/v2/docs (via resultados de busca) | publisher: Oura | acesso: 04/09/2026 | confiança: média (página oficial não lida — 404/SPA) | classe: superficie-de-api`

**A25 — Conteúdo de um registro de sono Oura**
Sleep score, tempo total na cama, tempo total dormindo, efficiency, latency, nº de disturbances, tempo por estágio, frequência respiratória, FC média e **leituras de HRV em intervalos de 5 minutos ao longo de todo o período**.
`fonte: https://openwearables.io/blog/oura-api-accessing-ring-data-sleep-hrv-readiness | publisher: Open Wearables (terceiro) | pub: n/d | acesso: 04/09/2026 | confiança: média (secundária; nomes de campo não confirmados) | classe: sinal-bruto`
→ **VFC noturna não é escalar, é série temporal de 5 em 5 min.** Persistir só a média já é perda: a forma da curva some.

**A26 — Estagiamento de relógio é fraco, e a fraqueza é assimétrica**
Contra polissonografia: Fitbit Charge 4 — sensibilidade 91,2% / especificidade 61,3%, viés TST +5,7 min, deep −19,2 min. Garmin Vivosmart 4 — sensibilidade 98% / especificidade 30%, concordância de estágios 48% (κ=0,20), TST +46,9 min, REM −12,5 min. WHOOP — sensibilidade 91,7% / especificidade 55,7%, concordância 62% (κ=0,46), TST −1,4 min, REM +21,0 min.
`fonte: https://pmc.ncbi.nlm.nih.gov/articles/PMC11004611/ (também em https://mhealth.jmir.org/2024/1/e52192) | publisher: JMIR mHealth and uHealth | pub: 2024 | acesso: 04/09/2026 | confiança: alta | classe: validade-cientifica`
→ **Especificidade baixa em todos (30–61%):** os aparelhos são bons em dizer "dormiu" e ruins em detectar vigília. Isso ataca diretamente WASO, contagem de despertares e eficiência.

**A27 — Meta-análise: erro sistemático em direção conhecida**
24 estudos / 798 participantes: TST −16,9 min, sleep efficiency −4,7%, sleep latency +2,6 min; dispositivos de consumo **subestimam REM em 50–70%**.
`fonte: https://pmc.ncbi.nlm.nih.gov/articles/PMC11874098/ | publisher: PMC | pub: ~2025 | acesso: 04/09/2026 | confiança: média (snippet, artigo completo não lido) | classe: validade-cientifica`
→ **Contradiz A26** — ver Pistas.

**A28 — A modalidade do sensor limita o que é fisicamente estimável**
Revisão de 90 artigos: EEG e PPG são as modalidades mais comuns; EEG é o mais acurado e capaz de identificar todos os estágios, **PPG é mais simples mas incapaz de identificar todos os estágios**.
`fonte: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7956647/ | publisher: PMC | pub: 2021 | acesso: 04/09/2026 | confiança: média (snippet) | classe: validade-cientifica`

## Tabela de dependência — a mais importante do run

Onde marcado **inferência**, a exigência é definicional/aritmética, não citada de fonte nesta execução.

| Métrica derivada | Dado bruto que exige | Calculável só com durações agregadas? | Reconstruível se não gravado? |
|---|---|---|---|
| **Sleep efficiency** | dormindo ÷ **tempo na cama** → exige `inBed` como grandeza separada da soma dos estágios (A22, A23) | **Não** — sem denominador | Não¹ |
| **Sleep onset latency** | timestamp de entrada na cama **e** do primeiro sono | Não | Não¹ |
| **WASO / nº e duração de despertares** | cada intervalo `awake` com start/end (A22) | Não — a soma perde quantos e quão longos | Não¹ |
| **Regularidade / consistência de horário** | timestamps de deitar e acordar **como hora do dia**, vários dias (WHOOP: `sleep_consistency_percentage`) | **Não** — impossível sem hora do dia | Não¹ |
| **Social jetlag** | midpoint em dias livres vs dias de trabalho → timestamps + tipo de dia; inferência | **Não** | Não¹ |
| **Sleep debt** | necessidade menos sono real, acumulado em janela móvel (`need_from_sleep_debt_milli`) | **Sim, parcialmente** — durações bastam para o acúmulo bruto; a versão dos produtos desconta cochilos e carga | **Sim**, se as durações históricas existirem |
| **Midpoint de sono / cronotipo** | timestamps de início e fim | **Não** | Não¹ |
| **Cochilo separado da noite** | flag na captura (`nap`) ou tipo de período + timestamps | Não — durações somadas fundem os dois | Não¹ |
| **VFC noturna (tendência e forma)** | série de HRV de 5 em 5 min durante o sono (A25) | Não | Não¹ |
| **FC de repouso / mínima noturna** | série de FC durante o sono | Não | Não¹ |
| **Desvio de temperatura vs baseline** | leitura noturna + série histórica para a baseline | Não | Não — a baseline exige histórico |
| **Frequência respiratória** | `respiratory_rate` por noite | Não | Não¹ |
| **Inquietação / movimento** | `disturbance_count` ou série de movimento | Não | Não¹ |
| **Fuso / viagem** | `timezone_offset` junto do timestamp (A23) | Não | Não — sem ele os timestamps ficam ambíguos |

¹ **Ressalva crítica:** "não reconstruível" vale para o *banco do app*. Se a fonte (HealthKit) retiver as amostras brutas, o backfill é possível — ver a hipótese em Pistas, que ficou **não verificada** e é a lacuna nº 1.

**Regra que sai da tabela:** quase tudo que não é "quantas horas" exige **hora do dia**. Regularidade, jetlag social, midpoint, latência, eficiência e separação de cochilos são todos irrecuperáveis a partir de durações. Débito de sono é a única exceção parcial.

## Pistas

- **CONTRADIÇÃO (prioridade máxima) — direção do viés de REM.** A27 diz que aparelhos de consumo **subestimam** REM em 50–70%; A26 mede, para o WHOOP, **+21,0 min (superestimação)** e, para o Fitbit, +4,0 min, com só o Garmin subestimando (−12,5 min). Provável explicação: A27 agrega gerações mais antigas e aparelhos sem estagiamento; A26 isola três recentes. Não verificado. **A implicação prática é a mesma nos dois: não trate REM/deep do relógio como grandeza física — trate como índice do próprio aparelho, comparável consigo mesmo ao longo do tempo, nunca com literatura clínica.**
- **Especificidade é o calcanhar.** 30–61% significa vigília noturna sistematicamente perdida. Argumento forte para persistir os **intervalos brutos**: se o algoritmo da fonte melhorar, ou se você quiser recalcular com outra regra, precisa dos fragmentos, não do total.
- **`timezone_offset` como campo de primeira classe.** A pista mais fácil de perder. Um timestamp UTC sem offset não responde "que horas eram para o usuário" — que é exatamente a pergunta de regularidade e jetlag social.
- **Estrutura de dois níveis.** Oura e WHOOP separam **período de sono** (evento com timestamps, pode haver vários por dia) de **rolagem diária** (score). Um esquema com "uma linha por noite" já é uma decisão que impede cochilos e sonos fragmentados.
- **HIPÓTESE NÃO VERIFICADA, DE ALTO VALOR:** amostras do HealthKit ficam no dispositivo/iCloud com histórico próprio. Se for verdade, parte do dado "irrecuperável" é **backfillável do HealthKit depois**, o que muda a urgência da decisão. Retenção não confirmada nesta execução. **Verificar antes de assumir que a janela está fechando.**

## O que procurei e não achei

- **Documentação oficial da Oura não foi lida** (SPA/Redoc; espelho deu 404). Tudo sobre Oura é de segunda mão. **Nomes de campo, unidades e quais endpoints trazem `temperature_deviation` e SpO2 permanecem não verificados** — e ambos eram itens explícitos do briefing.
- **HealthKit além do sono: ZERO evidência recuperada.** A página de `HKQuantityTypeIdentifier` voltou sem conteúdo. **Não afirmo nada** sobre `heartRateVariabilitySDNN`, `respiratoryRate`, `appleSleepingWristTemperature`, `oxygenSaturation`, `restingHeartRate` ou `appleSleepingBreathingDisturbances` — nem existência, nem granularidade. **É uma classe de dupla fonte do briefing que ficou com zero fontes. Lacuna nº 1.**
- **Nota de deprecação no enum:** o extrator devolveu frase vaga sobre `inBed`/`asleepUnspecified` que não convenceu como citação literal. Não reportada. Vale reler atento ao caso legado `asleep`.
- **AutoSleep, Sleep Cycle, Rise, Athlytic, Bevel e Garmin (páginas de produto): nenhuma fonte lida.** Garmin aparece só como objeto de validação. **Nenhuma evidência sobre captura de áudio/ronco** (competência conhecida do Sleep Cycle).
- **Pergunta 5 (dado de contexto: cafeína, álcool, refeição tardia, tela, treino tardio, estresse, humor, medicação): ZERO fontes.** A classe `dado-de-contexto` está vazia.
- **Definições formais de Sleep Regularity Index e social jetlag** (Roenneberg et al.) não recuperadas; a linha correspondente é inferência definicional, não citação.
