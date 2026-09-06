# Digest — D2 instrumentação — rodada 2 (retenção do HealthKit, tipos e definições formais)

**Rodada:** 2 · **Assistente:** 1 · **Acesso:** 04/09/2026
**Orçamento gasto:** 12/12 chamadas, 4 fontes lidas em profundidade + 6 rodadas de busca

## VEREDITO SOBRE RETENÇÃO

**SIM — provavelmente recuperável — MAS um elo crítico ficou NÃO DETERMINADO.**

| Elo | Veredito | Confiança |
|---|---|---|
| O iPhone **guarda** as amostras brutas de sono por anos, sem expiração automática | SIM | Média-alta |
| A autorização de leitura concedida hoje **alcança** amostras gravadas antes da concessão | **NÃO DETERMINADO** | — |

O segundo elo é exatamente o ponto que o briefing marcou como "crítico e frequentemente mal-entendido", e **não foi verificado contra a documentação da Apple**. **A cláusula de dupla fonte NÃO foi satisfeita no sentido forte:** duas fontes independentes, de pesos desiguais — uma resposta de engenheiro DTS que fala **só do Apple Watch**, e relatos de usuários sobre o iPhone. Nenhuma é especificação.

**Como fechar isso barato:** um `HKSampleQuery` com `HKQuery.predicateForSamples(withStart: <data bem antiga>, end: Date())` sobre `HKCategoryTypeIdentifier.sleepAnalysis` num device real com histórico longo responde em minutos, de forma decisiva. Vale mais que outra rodada de pesquisa.

## Achados

### retencao

**A45 — O Apple Watch retém dados do HealthKit por cerca de 1 semana; a Apple não publica a tabela por tipo.**
Verbatim de engenheiro DTS (Ziqiao Chen, Worldwide Developer Relations): *"In general, Apple Watch keeps HealthKit data for about a week. For some data types, the retention time can be longer... We don't have a complete list about the retention time of those data types to share. You might consider doing your own testing on the data types you are interested in."*
`fonte: https://developer.apple.com/forums/thread/732468 | publisher: Apple Developer Forums (funcionário Apple — quase-oficial, não spec) | pub: não datada; thread referida como válida até watchOS 11 | acesso: 04/09/2026 | confiança: alta para o Watch | classe: retencao`
⚠️ **Isso é sobre o relógio, não o iPhone.** O Watch sincroniza para o iPhone e o iPhone é o repositório de longo prazo. Não confundir.

**A46 — O iPhone aparentemente retém dados de saúde indefinidamente, sem purga automática.**
Evidência circunstancial mas convergente: usuários reclamam de dados do Health consumindo **mais de 5 GB** e de **7+ anos** acumulados, pedindo uma forma de apagar dados antigos que **não existe**. O acúmulo é a prova: se houvesse expiração, não haveria a reclamação.
`fonte: https://discussions.apple.com/thread/254669061 + https://discussions.apple.com/thread/256115347 + https://support.apple.com/en-us/108779 | publisher: Apple Community (relato) + Apple Support (oficial, só sobre deleção manual) | acesso: 04/09/2026 | confiança: média-alta (raciocínio indireto, não spec) | classe: retencao`

**A47 — Não existe política de expiração documentada. (Achado por silêncio.)**
Busca por retenção retorna apenas material de **privacidade** — criptografia, classe `Protected Unless Open`, exigências de privacy policy. Nada sobre prazo de vida das amostras.
`fonte: https://support.apple.com/guide/security/protecting-access-to-users-health-data-sec88be9900f/web | publisher: Apple (Platform Security Guide) | acesso: 04/09/2026 | confiança: alta de que o silêncio é real | classe: retencao`
→ **O silêncio não é promessa de retenção eterna.**

**A48 — Deleção é manual e sob controle do usuário; iCloud sincroniza — inclusive as deleções.**
Dá para apagar cirurgicamente uma categoria mantendo o resto. Com Health no iCloud, o dado é criptografado, backupeado e sincronizado — **apagar no iPhone apaga nos outros devices**.
`fonte: https://support.apple.com/en-us/108779 | publisher: Apple Support | acesso: 04/09/2026 | confiança: média-alta | classe: retencao`

### superficie-de-api

**A49 — `appleSleepingBreathingDisturbances` é um `HKQuantityTypeIdentifier`, NÃO um `HKCategoryTypeIdentifier`. (Correção ao briefing.)**
Introduzido no **iOS 18.0** (watchOS 11.0, macOS 15.0, visionOS 2.0), unidade **count**, agregação **discrete arithmetic**. Existe também `HKAppleSleepingBreathingDisturbancesClassification` e a função `...ClassificationForQuantity`.
`fonte: https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingbreathingdisturbances | publisher: Apple Developer Documentation | pub: doc viva, sem data | acesso: 04/09/2026 | confiança: alta quanto ao tipo; média quanto aos metadados (via busca, página não lida) | classe: superficie-de-api`

**A50 — Os outros cinco identificadores NÃO foram verificados.** `HeartRateVariabilitySDNN`, `RespiratoryRate`, `AppleSleepingWristTemperature`, `OxygenSaturation`, `RestingHeartRate` — nem identificador exato, nem granularidade, nem cadência noturna. Não afirmados de memória, conforme a regra epistêmica.

### definicao-formal

**A51 — Sleep Regularity Index (SRI) — Phillips et al., Scientific Reports, 12/06/2017.**
**A probabilidade percentual de a pessoa estar no mesmo estado (dormindo ou acordada) em dois instantes separados por exatamente 24 horas**, promediada sobre todo o registro. Escala **−100 a +100**: 100 = regularidade perfeita, 0 = aleatório, −100 = inversão perfeita. Amostra original: 61 universitários de Harvard, 30 dias. Regularidade é fator **independente da duração**.
`fonte: https://www.nature.com/articles/s41598-017-03171-4 (paywall/redirect IdP — NÃO lido); definição via https://wadpac.github.io/GGIR/articles/SleepRegularityIndex.html e https://www.nature.com/articles/s41598-018-32402-5 (validação, 2018) | acesso: 04/09/2026 | confiança: média — definição consistente entre fontes, mas artigo original não lido | classe: definicao-formal`
→ **Dado que exige:** série **binária sono/vigília por época** (tipicamente 1 min), contínua, cobrindo múltiplos dias consecutivos. **O SRI é indiferente à duração** — compara estado em *t* contra estado em *t+24h*. **Com apenas durações agregadas por noite, é matematicamente impossível de calcular. Não é precisão degradada: a entrada não existe.**

**A52 — Social jetlag (Roenneberg et al.) — MSF, MSFsc e SJL.**
- **MSF** = midpoint de sono em dias livres = ponto médio entre início e fim do sono.
- **MSFsc** = MSF − (SD_f − SD_week)/2, onde SD_f = duração em dias livres e SD_week = duração média semanal. A correção existe porque a privação na semana infla o sono nos dias livres, atrasando o MSF artificialmente.
- **SJL** = |MSF − MSW| (diferença entre midpoints de dias livres e de trabalho).
Termo cunhado em 2006 por Till Roenneberg: "the discrepancy of work and free days, between social and biological time".
`fonte: https://www.cell.com/current-biology/fulltext/S0960-9822(12)00325-9 + https://cran.r-project.org/web/packages/mctq/vignettes/sjl-computation.html | acesso: 04/09/2026 | confiança: média (fórmula consistente; originais não lidos integralmente) | classe: definicao-formal`
→ **Dado que exige:** timestamps de início e fim por noite + classificação dia-de-trabalho vs. dia-livre. **Duração sozinha não basta — o midpoint é posição no eixo do tempo, e duração não carrega posição.** MSFsc precisa das duas coisas.

### evidencia-de-desfecho

**A53 — Regularidade do sono prediz mortalidade MELHOR que duração — UK Biobank, n=88.975.**
Cribb L, Sha R, Yiallourou S, et al. (2023), *Sleep regularity and mortality: a prospective analysis in the UK Biobank*, **eLife** 12:RP88359. Seguimento mediano de 7,1 anos, 3.010 óbitos. Relação **não-linear**: percentil 5 de SRI tem **HR 1,53 (IC95% 1,41–1,66)** para mortalidade por todas as causas contra a mediana. Os autores concluem que **"the SRI contains information about mortality risk beyond that contained"** nas métricas de desvio-padrão da duração — **e a recíproca não é verdadeira**. Prediz independentemente, mesmo ajustando por duração média e fragmentação.
`fonte: https://elifesciences.org/articles/88359 · DOI 10.7554/eLife.88359.3 | publisher: eLife (peer-reviewed) | pub: 23/11/2023 | acesso: 04/09/2026 | confiança: ALTA (lido diretamente) | classe: evidencia-de-desfecho`
→ **É a justificativa de fundo para se importar com a resposta: a métrica com maior poder preditivo demonstrado é justamente a que o esquema de durações torna incalculável.**

## Pistas e CONTRADIÇÕES

**⚠️ CONTRADIÇÃO NÃO RESOLVIDA — a que mais importa.**
Um resultado de busca afirmou: *"You cannot query samples before the earliest date that you can query samples for, which is determined by when authorization is granted."* Se fosse verdade literalmente, o veredito viraria NÃO.

Razões para desconfiar, e razões para não descartar:
- **Não veio de doc da Apple** — veio de sumário agregando tutoriais de terceiros (Medium, createwithswift), que a classificação do briefing trata como relato de desenvolvedor.
- Parece **confundir `earliestPermittedSampleDate()` com um limite de leitura**. Pelo nome e contexto, esse método trata do limite para **gravar**, não para ler. **Mas não foi confirmado** — o fetch da página retornou apenas o título (a doc da Apple é SPA em JS e resiste a fetch).
- **Não afirmo nem nego.** Item aberto nº 1.

**Distinção que precisa ficar clara:** "o HealthKit **guarda** o dado" e "a **sua app** consegue **ler** o dado guardado" são perguntas separadas. A evidência é boa para a primeira e ausente para a segunda.

**Pista relevante — armadilha do teste empírico:** existe uma barreira de privacidade bem documentada — a app **não consegue distinguir** "sem permissão de leitura" de "não há dados". Sem permissão, a query retorna vazio, **sem erro**. **Um teste mal construído produz um falso NÃO.** Quem rodar o teste precisa confirmar a autorização primeiro. Este é provavelmente o mecanismo por trás de boa parte da confusão que circula sobre o tema.

**Assimetria de risco a favor de agir já:** independentemente de como o item aberto se resolva, gravar timestamps a partir de agora é barato e remove risco futuro; o resgate do passado é a aposta. **As duas coisas são independentes e a primeira não deveria esperar a segunda.**

## O que procurei e não achei

1. **Documentação da Apple sobre expiração/retenção.** Não existe até onde busquei. Silêncio registrado como achado — mas silêncio de doc não é garantia contratual.
2. **Confirmação de que autorização de leitura alcança amostras anteriores à concessão.** Item aberto nº 1. Fetch da doc falhou (SPA em JS).
3. **Os cinco identificadores restantes.** Orçamento consumido antes.
4. **Comportamento do histórico na troca de iPhone.** iCloud sincroniza e deleções propagam; **não** confirmei se migração para aparelho novo preserva o histórico completo, nem se backup-e-restauração difere de sync via iCloud.
5. **Os artigos originais de Phillips 2017 e Roenneberg.** Paywall/redirect. Definições vieram de secundárias peer-reviewed ou implementação de referência (GGIR) — contrariando a preferência por fonte primária. Confiança rebaixada para média.
6. **Limite documentado de alcance temporal de uma query.** Nada encontrado nos dois sentidos.
