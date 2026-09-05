---
id: SPEC-sono
companions:
  - data-model.md
  - plan.md
sources:
  - _bmad-output/planning-artifacts/research/competitive-apps-e-wearables-de-analise-de-sono-2026-09-04/research.md
---

> **Contrato canônico.** Este SPEC e os arquivos em `companions:` são o contrato completo
> do que construir, testar e validar.
>
> **Origem:** pesquisa competitiva de 04/09/2026 (49 fontes, verificação de citações
> aplicada) + party mode de 04/09/2026, que consultou as **308 noites reais** em produção e
> derrubou duas premissas da pesquisa. Onde os dois divergem, **o dado do banco vale** — as
> divergências estão registradas em §7.

# Sono — a tela do fato, não do placar

## 1. Why

O Orbe **não tem uma feature de sono**. Tem um número que alimenta outras features: a
prontidão em `/recuperacao`, o cruzamento da retrospectiva e o chip de nota 1–5 no Hoje.
A única superfície de leitura é `Saúde › Sono`, que usa o **template genérico de métrica**
(`mobile/src/app/saude/[metric].tsx`) e por isso erra de três formas:

| Defeito | Causa |
|---|---|
| No modo "Dia", a noite inteira vira uma barra na hora em que o usuário **acordou** | `bucketize` posiciona pelo `s.start`, e o `start` do sono é o instante de acordar |
| O número grande é a **soma do mês** ("217 h · total no período") | `kind: 'cumulative'` no catálogo de métricas |
| A legenda diz **"média/hora"** | herdada de passos/calorias |

O usuário confirmou o sintoma: *"não abro, a view está confusa"*.

E o app **sabe coisas que nunca contou**. Desde o bump de `AGG_VERSION` 3 e 4, com 500 dias
de backfill já rodados, cada noite grava no `extra` de `health_daily`: `deep`, `rem`,
`core`, `unspecified`, `awake`, `inbed` e `onset`. **Nenhuma tela do Orbe lê qualquer um
deles.** O usuário não sabia que estavam lá.

O que ele quer ver de manhã, nas palavras dele: **"que horas eu dormi de fato — e também a
hora que deitei"**. É hora do relógio, e é exatamente o que
`mobile/src/lib/health-buckets.ts:356-362` calcula (`n.onset`) e **descarta**, gravando o
horário de acordar duas vezes em `start` e `end`.

## 2. Princípio

**A tela entrega o fato e para de falar.**

Não existe nota de sono, score, streak, seta de tendência ou meta. A regularidade — a
métrica com maior poder preditivo demonstrado na literatura — **não aparece como índice**:
ela aparece como *forma*, porque barras alinhadas parecem alinhadas. O usuário lê o gráfico,
não um número sobre o gráfico.

Isso não é preferência estética. É a resposta a três achados convergentes da pesquisa: o
padrão nº 1 de reclamação da categoria inteira é "a nota discorda do corpo" (4 fontes
independentes, + class action contra a Oura em 08/2026); ortossonia é entidade clínica com
prevalência de ~3–5%; e a especificidade sono/vigília destes aparelhos contra polissonografia
tem médias de 30% a 61%. **Um placar que a categoria mede mal, e que documentadamente causa
dano, não é o que falta ao Orbe.**

## 3. Capabilities

- **CAP-1** — Ver a que horas dormi
  - **intent:** Ao acordar, o usuário abre a tela e lê, em texto, os instantes da noite:
    deitou · apagou · acordou.
  - **success:** Os três horários vêm de `sleep_periods` (não de duração reconstruída). A
    tela **nunca faz a subtração** entre deitar e apagar, nem rotula "latência" — o buraco
    entre dois relógios é lido pelo usuário. Quando `in_bed_at` não existe, o campo aparece
    vazio com a explicação ("seu relógio não registra a hora de deitar"), **nunca** preenchido
    com o horário de apagar e nunca oculto.

- **CAP-2** — Ver a forma das minhas noites
  - **intent:** O usuário vê as últimas ~14 noites posicionadas na hora do dia e percebe
    regularidade ou desordem sem ler número nenhum.
  - **success:** Eixo Y é hora do dia invertido (deitar em cima, acordar embaixo); eixo X são
    as noites; cada noite é uma barra vertical; os despertares são **buracos dentro da barra**;
    o tempo na cama é o contorno tracejado ao redor; noite sem dado é célula hachurada, não
    barra de altura zero. Cabe na largura de um telefone sem rolagem horizontal. **Sem seletor
    de período** — a janela rolante é a forma do gráfico, não um controle.

- **CAP-3** — Cruzar minha percepção com a medição
  - **intent:** O usuário vê a nota 1–5 que deu ao acordar contra o que foi medido naquelas
    noites, e o app admite quando os dois discordam.
  - **success:** Agrupa as noites que têm nota **e** medição, mostrando por nota o intervalo
    mín–máx, a média e **o n**. Sem seta, sem "melhorou", sem correlação declarada. Um
    agrupamento com n < 5 é exibido com o n visível para que o usuário saiba que é curiosidade,
    não conclusão.

- **CAP-4** — Ver o detalhe de uma noite
  - **intent:** O usuário abre uma noite e vê a composição por estágio que o app já grava.
  - **success:** Duas faixas, e a diferença entre elas é o que o dado sustenta. A **linha do
    tempo** da noite — sono do apagar ao acordar, com os despertares **cortando nas posições
    em que ocorreram** — e, separada, a **composição por estágio em proporção** (profundo ·
    REM · leve · sem estágio) com as durações absolutas. Não se cruzam: o que se grava são
    horas por estágio, não os intervalos, e fingir posição para o estágio seria inventar. Ao
    lado, o par bruto: *n despertares · tempo total acordado*. **Rótulo de incerteza obrigatório e legível** — "estimativa do seu
    relógio; vale para comparar você com você mesmo, não é medida clínica". Nunca percentual
    contra norma clínica, nunca base de conselho, nunca texto interpretativo gerado pelo app.

- **CAP-5** — Ver o padrão dos meus despertares
  - **intent:** O usuário quer saber **quando** a noite dele quebra — não quantas vezes na
    média, mas em que ponto da noite, e se isso se repete.
  - **success:** Três leituras da mesma matéria-prima, em três altitudes:
    1. **Dentro da noite** — os buracos na barra de CAP-2 e o corte na faixa de CAP-4.
    2. **Relógio de vigília** — os despertares de todas as noites da janela sobrepostos num
       **único eixo de hora do dia**, revelando se eles se concentram num horário. Responde
       "eu acordo sempre às 3h?", que nenhum score da categoria responde. Densidade, não
       contagem: bandas mais escuras onde mais noites coincidem.
    3. **Duração acordado por noite** — série simples ao lado do timing chart, para o usuário
       ver se a vigília está crescendo, **sem meta e sem faixa de referência**.
  - **success (negativo):** O app **não** deriva score, índice de fragmentação, nem qualquer
    número composto a partir dos despertares. Ver o quadro em §6.
  - **dependência dura:** exige `awakenings` individuais. A fonte atual **reporta** —
    medido em 04/09/2026 — mas a agregação descarta 36 de 38 noites; a correção é
    pré-requisito desta capability e mora na Fase 3. Ver §6.

- **CAP-6** — Substituir `Saúde › Sono`
  - **intent:** Existe **uma** superfície de leitura de sono no app.
  - **success:** O cartão da categoria Sono na aba Saúde navega para `/sono`; `/saude/sono`
    deixa de ser alcançável. O id `'sono'` **permanece** em `metric-catalog.ts` — a prontidão
    (`health-readiness.ts`) e a retrospectiva leem `seriesFor('sono')` e não podem quebrar.
  - **05/09/2026 — a entrada mudou:** `/sono` é **aba da barra** (`(tabs)/sono.tsx`), no lugar
    de Compras, que passou ao Mais como aba oculta. A categoria Sono **some da lista da
    Saúde** — a tela deixa de ser "parte de Saúde" na navegação, sem mexer na cor nem na
    taxonomia da ADR 0031. As subviews (`/sono/tempos`, `/sono/despertares`, `/sono/[day]`)
    seguem na pilha raiz, empilhadas sobre a aba.

- **CAP-7** — Seção "Tempos e estágios" com seletor de período *(pedida em 04/09/2026 —
  **não construir agora**; entra quando for o melhor momento, e o usuário pediu para ser
  **avisado**)*
  - **intent:** Dentro de `/sono`, uma seção no molde da tela de Sono do app Saúde da Apple
    (aba *Amounts*): **médias no topo** — tempo na cama · tempo dormindo — para o período
    escolhido, e abaixo o gráfico de barras por noite na hora do dia, em **duas leituras
    alternáveis**.
  - **Opção 1 — Tempos:** a barra é a **janela na cama** (hora que deitou → hora que saiu da
    cama), **sem muito destaque**; os **despertares no meio da noite** marcados **com
    destaque** — o usuário quer saber *quando* tem acordado e *por quanto tempo*.
  - **Opção 2 — Estágios:** em **duas leituras**, trocadas por um sub-seletor *na hora · total*
    (pedido em 05/09/2026). **Na hora:** cada barra mostra os períodos de cada estágio nas horas
    em que ocorreram — posição real, não proporção. **Total:** uma coluna por noite em horas por
    estágio, empilhada na ordem do hipnograma (profundo na base, leve, REM, sem estágio em
    hachura, a vigília amarela no topo) — a altura é a noite inteira. Nos períodos longos só
    existe o total.
  - **Seletor (decidido em 05/09/2026):** última noite · 7d · 4s · 12 meses · ano. **Sem
    "sempre"** — retirado pelo usuário. **Todo período é navegável:** ◀ ▶ recua ou avança *um
    período do próprio tamanho* (7d anda sete dias, 4s anda 28, 12m anda doze meses, ano anda
    um ano, última anda uma noite), e o ◀ só acende onde há noite. Navegar substitui acumular.
    Em *última noite*, *7d* e *4s* **todos os dias aparecem**.
    Em *12 meses* e *ano* a forma é **coluna por semana**: mediana de apagar e acordar como
    barra, o miolo p25–p75 como faixa — a regularidade continua sendo forma. A **troca de
    relógio (18/07/2026) fica marcada** no gráfico, e nas contagens de despertar as eras saem
    separadas (Apple contava 11,8 por noite; Garmin, 2,6–3,4 — não são comparáveis).
  - **Médias do topo (decidido):** *dormindo* sempre; o segundo número é *na cama* quando ≥ 80%
    das noites do período medem a cama (`bedtimeMeasured`), senão vira *acordado*. Nas
    curtas, hoje, a cama é medida em 0% — o topo diz "acordado".
  - **success:** trocar o período recalcula as médias e redesenha o gráfico; trocar a opção
    mantém o período; as duas opções distinguem "não sei" de "não houve" (§6).
  - **dependência dura (Opção 2):** intervalos de estágio **não são gravados** — só horas por
    estágio. Exige coluna nova em `sleep_periods`, o agregador emitindo os intervalos, bump de
    `AGG_VERSION` e backfill. Ver data-model §7. **A Opção 1 roda com o dado de hoje.**
  - **navegação (decidida pelo usuário em 05/09/2026):** a peça ② **fica como está** no `/sono`
    — 14 noites, sem seletor, a decisão da mesa sobrevive na visão geral. **Tocar nela abre
    `/sono/tempos`**, a subview com o seletor, as duas leituras e as análises. **Tocar em
    Despertares (③) abre `/sono/despertares`**, uma subview com mais dado e análises — quando,
    quanto, com que frequência, por dia da semana. Nem absorção nem duplicação: a visão geral
    é o cartão; a subview é a tela.
  - **análises:** as linhas sob os gráficos são **fatos** — medianas com faixa p25–p75,
    contagens, a diferença fim de semana × semana, a hora mais comum com o *n* ao lado. Nenhuma
    vira índice ou nota. Se alguma parecer placar disfarçado, sai.
  - **detalhe a decidir:** a média "tempo na cama" só é honesta quando `bedtimeMeasured`; no
    Garmin a janela abre com o sono (≈ dormindo + acordado). Rotular, ou omitir, quando a
    fonte não mede.
  - **referência visual:** screenshot do app Saúde (M · Amounts) de 04/09/2026 23:30 — eixo
    22:00 → 14:00, barras segmentadas, despertares marcados, "Sleep Schedule 00:30–07:15".

- **CAP-8** — Ver a noite ao lado da nota, na Hoje *(pedida e decidida em 05/09/2026, com
  mockup em tamanho real e dados reais antes do código — artifact
  `claude.ai/code/artifact/5d2b47a9-70e1-4e67-9b44-d5d3a63dc816`, opção A, sem veto)*
  - **intent:** Ao dar a nota de manhã, o usuário vê na mesma linha o que foi medido:
    **percepção à esquerda** (o chip `Sono 3/5`), **medição à direita**.
  - **success:** Duas linhas de texto à direita do chip, alinhadas à direita e centradas na
    altura dele (36 pt): `01:26 → 08:39` e `3 despertares · 8 min`, 12/16 pt. **Só tinta** —
    número em mono `ink`, palavra em `ink2`; nenhuma cor de sono, porque o bloco é legenda,
    não gráfico. O texto nasce em `nightLine()` (`sleep/facts.ts`), a tela não formata hora.
    Toque no bloco abre `/sono/[day]`; o lápis do chip segue abrindo a nota.
  - **success (negativo):** **nunca antes da nota** — o card "Como foi seu sono?" não mostra
    medição, para o relógio não puxar a resposta; o par nota × medição de CAP-3 só vale se a
    nota for do usuário. Sem noite medida, o espaço fica **em branco**: nem "sem dado", nem
    spinner — a aba Sono é o lugar de explicar ausência. `awakenings: []` escreve
    "sem despertar"; `null` omite a segunda linha.
  - **dado:** uma consulta por `wake_day = hoje` (`loadToday()` na store), não o histórico —
    os 288 períodos com segmentos de estágio pesam ~380 kB e são da aba Sono. Recarrega ao
    voltar do background, como os demais stores da Hoje.
  - **medido (05/09/2026, 63 noites desde 01/06):** 7 sem despertar, 9 com ≥ 10 despertares,
    pior caso 21 despertares e 127 min. Em texto, a pior noite ocupa 173 dos 221 pt
    disponíveis; a forma "mais dois chips" quebraria a linha em 9 das 63 noites, e a faixa em
    miniatura poria o amarelo da vigília sobre o `bg` do Orbe claro a 2,83 — por isso texto.

- **CAP-9** — Sono na Retrospectiva *(pedida em 05/09/2026 — "média de quanto estou
  acordando por noite, tempos de sono por fase, e outras ideias"; proposta com dados reais no
  artifact `claude.ai/code/artifact/73f0edb9-ae85-42d5-9216-0d51b39c2d0c`, aprovada com as
  quatro decisões em "sim")*
  - **intent:** No jornal de domingo, a noite típica do período em cinco linhas de fato:
    quanto dormi, quando, quanto fiquei acordado, de que o sono foi feito, como acordei.
  - **success:** Bloco `sleep` na Retrospectiva, lido de `sleep_periods` (não da soma diária).
    Média de horas com a diferença **em minutos** vs o período anterior; apagou · acordou como
    medianas com o miolo p25–p75; **acordado por noite** (minutos, despertares por noite,
    noites com despertar, o mais longo); **por fase** como uma barra só (REM · Leve · Profundo
    · acordado) e os minutos de cada com Δ; nota × medição por lado (≥ 4 · ≤ 3) com o `n`. Em
    Mês e Estação: a faixa semana a semana e o fim de semana × semana em minutos (≥ 2 noites
    de cada tipo). A linha "Sono" e "Sono percebido" **saem do card Saúde** enquanto o bloco
    existir. A manchete ganha frases de sono: horas e vigília como `health`, **nota × medição
    como `cross`** (≥ 3 noites de cada lado), que pode abrir a edição do mês.
  - **success (negativo):** sem saldo contra meta, sem índice de regularidade, sem nota
    composta. `awake: null` quando a fonte não reporta; a diferença de vigília é `null` quando
    a comparação cruza a troca de relógio (`SONO_MARKERS`), e a caixa de correções o diz.
  - **onde:** `packages/shared/src/sleep/retro.ts` (`sleepRetro`, `sleepHighlights`),
    `period/retro.ts` (`RetroInput.sleepPeriods`, `RetroSummary.sleep`), `retro-blocks.ts`,
    `mobile/src/components/SleepRetroCard.tsx`. Ver `docs/specs/retrospectiva/v2-jornal.md §9`.

- **CAP-10** — Três leituras novas no Tempos: **Dispersão**, **antes × agora** e a **grade
  semana × dia** *(05/09/2026, mesma proposta; B1, B4 e B2 das cinco opções)*
  - **intent:** Ver a regularidade como **largura**, o período contra o anterior, e a mesma
    noite da semana ao longo do mês — sem índice.
  - **success (grade):** Quarto modo **Grade**, só nos períodos por noite: as semanas em
    linhas, os dias em colunas, cada célula a noite em miniatura (apagar → acordar) no mesmo
    eixo de horas; marca amarela ao lado com ≥ 30 min acordado; tracejado onde não há noite;
    toque abre o detalhe. Em 12m e ano o modo não existe e a tela volta a Tempos.
  - **success:** Terceiro modo **Dispersão** no Tempos: cada noite é um ponto numa régua, a
    mediana é a linha, o miolo p25–p75 é a faixa (a lavagem do azul), o fim de semana é ponto
    vazado — quatro réguas: apagou, acordou, dormido, acordado. Nos períodos longos os pontos
    são as semanas. Em todos os modos, abaixo dos fatos, o **antes × agora**: a noite típica
    deste período ao lado da do anterior (barra = mediana apagar → acordar, bigode = p25–p75),
    a composição por fase dos dois, e as diferenças em minutos — sem cor de bom ou ruim. Só
    com ≥ 3 noites de cada lado; "última" não compara.
  - **onde:** `mobile/src/components/sono/SleepDispersion.tsx`, `BeforeAfter.tsx`,
    `SleepWeekGrid.tsx`, `sono/tempos.tsx`. A web recebe depois, se fizer falta.
  - **também na retro (05/09):** o cruzamento gatilho × saúde passa a comparar **dormido,
    acordado, REM e profundo** das noites, chaveadas pelo dia em que a noite começou
    (`sleepCrossMetrics`), em valores absolutos e com o `n` dos dois lados; e o bloco "Por
    mês" do Ano ganha as séries **Sono** e **Acordado** (`MonthBucket.sleepH`/`awakeMin`).

## 4. Constraints

- **Mobile primeiro.** A web não pauta nenhuma decisão desta entrega e entra numa segunda
  rodada, no mesmo contrato de núcleo.
- **Núcleo puro no `packages/shared`.** SRI, midpoint, jetlag social e a derivação de
  `health_daily.sono` a partir dos períodos são funções puras testadas; os apps só renderizam.
  Padrão de `fitness/overview` e `period/retro`.
- **Sem Reanimated** ([ADR 0010](../../decisions/0010-sem-reanimated-no-mobile.md)). Animação
  é o `Animated` do React Native.
- **Cor vem do tema — e é uma gramática só.** Sono empresta o papel `blue` (**Sono não é
  módulo**; ver [ADR 0031](../../decisions/0031-sono-e-categoria-nao-modulo.md)) e, para o REM,
  o `rose`. Os dois apps leem `sleepColorsOf()` (`packages/shared/src/sleep/colors.ts`):
  **azul é sono** (barra, mediana, série de horas), a **rampa do azul é profundidade** (Leve = o
  traço, Profundo = o degrau escuro), **REM é rosa** em todas as paletas (outro estado, não um
  degrau), **amarelo é vigília** em toda tela, **hachura é
  "sem estágio"**, tracejado é "sem noite". O despertar é o vão da barra; nas subviews o vão
  ganha a marca amarela ao lado. Nenhum hex em tela, e nenhum token de UI (`soft`, `text`) como
  marca de dado — ver [ADR 0032](../../decisions/0032-cor-de-sono-e-gramatica-derivada.md).
- **Sem captura manual noturna.** Decisão explícita do usuário (04/09/2026): o app já cobra
  a nota de manhã, e um segundo ritual à noite cobra caro por um campo. **Custo assumido:**
  quando a janela do sensor errar, não há conserto — é o padrão nº 3 de reclamação da
  pesquisa (3 fontes), aceito conscientemente.
- **Sem notificação matinal com número**, sem streak, sem meta de horas. Guarda-corpo de
  ortossonia (R6 da pesquisa).
- PostgREST corta em 1000 linhas sem erro: todo fetch de série longa usa `range`+`order`
  (`packages/shared/src/data/paginate.ts`).
- RLS por usuário em toda tabela nova.
- **Done inclui conferência visual em escala real e build Release no iPhone.** Mergeado sem
  rodar no aparelho não conta como entregue.

## 5. Recorte do V1

**Entra:** CAP-1 a CAP-6. CAP-5 depende da correção do agregador na Fase 3 (§6) — sem ela
nasce vazia na fonte atual; com ela, viva em todo o histórico. **CAP-8** entrou em 05/09/2026,
a pedido do usuário, já com a tela pronta.

**Fica para depois:**

| Fora do V1 | Por quê |
|---|---|
| Score / nota de sono de qualquer tipo | §2 — é o princípio, não um corte de escopo |
| Hipnograma com scrub | O card de estágio (CAP-4) já entrega o que o dado sustenta |
| Seção "Tempos e estágios" com seletor (última noite · 7d · 4s · 12m · ano · sempre) | **CAP-7** — pedida em 04/09; construir quando for o momento, e avisar o usuário. Reusa o componente de período do Histórico, não um primo |
| Latência como número rotulado | CAP-1 mostra dois relógios; a latência fica gravada para cruzamento futuro |
| `is_nap` | **Zero cochilos em 308 dias** — infraestrutura especulativa |
| Web | Segunda rodada |
| Correção manual da janela | Recusado pelo usuário (§4) |

## 6. Estado dos dados (medido em 04/09/2026)

Consulta só-leitura em produção, 312 noites de 24/03/2025 a 04/09/2026.

| Fato | Valor | Consequência |
|---|---|---|
| Noites com `inbed` | 259/308 (84,1%) | O denominador de eficiência existe |
| Noites com `onset` (latência) | 220/308 (71,4%) | Mediana 24 min · p90 81 min · **41% acima de 30 min** |
| **Era Garmin (18/07→), `inbed`** | **42/42 (100%)** | — |
| **Era Garmin, `onset`** | **1/42** | Ver abaixo |
| Folga mediana `inbed − dormido` | Apple **100 min** · Garmin **9,5 min** | — |
| Dias com mais de um período | 12/312, todos mar–mai, todos com 0–2h20 no total | Não são cochilos |
| Noites com nota **e** medição | 51 | Matéria-prima de CAP-3 |

### Interrupções — a matéria-prima de CAP-5

| Fato | Valor |
|---|---|
| Noites com vigília **gravada no banco**, era Apple | **233/270** |
| Tempo acordado médio nessas noites | **60,2 min** · máximo **3h19** |
| Noites com mais de 1h acordado | **101 de 233 (43%)** |
| Noites com vigília **gravada no banco**, era Garmin | **0/42** |
| Noites em que o **HealthKit tem** `AWAKE` (últimos 60 dias) | **38** |
| Dessas, quantas a agregação **descarta** | **36** |
| Noites que são **um único período** | 258/270 na era Apple |

Três leituras saem daí, e as três são estruturais:

**A vigília mora *dentro* do período, não entre períodos.** 258 de 270 noites da era Apple
são um único bloco de sono contínuo — e ainda assim 43% delas têm mais de uma hora acordado.
Interrupção **não** é fragmentação em vários períodos: é buraco dentro de um. Por isso
`awakenings` é um `jsonb` de intervalos dentro da linha, e não linhas separadas em
`sleep_periods`.

**O zero da era Garmin é bug nosso, não silêncio da fonte.** Medido no aparelho em
04/09/2026: das 38 noites com amostra `AWAKE` no HealthKit, **36 são creditadas como zero**.
`aggregateSleepNights` só conta vigília que se **sobrepõe** a um intervalo dormindo
(`overlapMs(iv, awake)`), e o Garmin escreve segmentos **encostados** — `CORE·AWAKE·CORE`.
O `AWAKE` preenche o buraco *entre* os intervalos em vez de cair *dentro* deles, a
sobreposição dá zero, e a noite passa como registrada com sucesso enquanto a vigília some.

**Consequência: CAP-5 nasce viva, não histórica.** As interrupções do Garmin existem, e a
correção é aditiva — o `value` da linha diária não muda, porque cada intervalo dormindo já
é sono puro; o que falta é creditar o `AWAKE` que cai no vão da noite. A correção entra na
Fase 3, junto do bump de `AGG_VERSION` que o backfill já exige, para não gastar duas
releituras de 500 dias.

> **Correção registrada.** Uma versão anterior desta seção afirmava que "a fonte atual não
> reporta interrupção nenhuma" e que a folga entre cama e sono no Garmin ficava "quase toda
> depois de acordar". As duas estavam erradas: a folga **é** a vigília. Cinco noites
> conferidas ao minuto (04/09: 23 · 03/09: 27 · 02/09: 1 · 01/09: 33 · 31/08: 12), com o
> `AWAKE` do HealthKit batendo exatamente com `inbed − dormido` do banco. Na era Apple os
> dois **não** batem (diferença média de 67 min), porque lá o `INBED` começa antes do sono e
> a folga inclui a latência.
>
> **Recuperável pelo backfill, sem depender do aparelho:** 42 noites da era Garmin, vigília
> mediana de **12 min**, média 16,1, máximo **1h43**, 9 noites acima de meia hora. *(14 noites
> do histórico tinham mais sono do que cama — o agregador pegava uma só amostra `INBED`;
> corrigido na Fase 3 com a união alargada ao sono, `inbed ≥ dormido` como invariante.)*

### O achado que justifica o princípio da §2

Cruzando o tempo acordado com a nota que o usuário deu ao acordar, nas noites que têm os
dois:

| Nota ao acordar | n | Tempo acordado médio |
|---|---|---|
| 3 | 5 | **36,8 min** |
| 4 | 6 | **69,3 min** |
| 5 | 2 | **83,3 min** |

**A relação corre ao contrário.** Nas noites em que ele ficou *mais* tempo acordado, ele
acordou se sentindo *melhor*.

Com n = 13 no total, isso é ruído — e é exatamente esse o ponto. Qualquer produto da
categoria transformaria WASO em penalidade no score e diria a ele que a noite foi ruim,
contra a percepção dele, com esse lastro. **É o padrão nº 1 de reclamação da categoria
reproduzido no dado dele, medido.** A tela mostra os despertares; nunca os pontua.

**O achado que governa CAP-1.** `MIN_ONSET_MS = 60_000` (`health-buckets.ts:261`). Em 37 das
38 noites da era Garmin a janela `INBED` abre **dentro de um minuto** do instante em que o
sono começa, e a folga sobra quase toda *depois* de acordar. O Garmin não mede quando o
usuário deitou: ele renomeia a janela de sono. **A hora de deitar deixou de ser medida em
18/07/2026, com a troca de relógio.**

Por isso CAP-1 é especificado para funcionar com **dois** relógios e exibir o terceiro
quando ele existir — o V1 não depende de ele voltar.

> **Aberto (04/09/2026):** se o **Foco de Sono agendado** no iPhone faz o iOS escrever
> `inBed` mesmo com o Garmin no pulso. Era o que produzia os 100 min de folga na era Apple.
> Custo zero, decide se CAP-1 tem dois ou três relógios. Teste ligado em 04/09; resultado
> pendente.
>
> **Resolvido em 04/09:** a lacuna de 01 a 04/09 era atraso de sync, não perda. As quatro
> noites entraram (7,33 h · 8,47 h · 6,13 h · 6,53 h), todas com `inbed`, nenhuma com `onset`
> ou `awake` — o padrão Garmin confirmado em dado novo, não só em histórico.

## 7. Onde este spec diverge da pesquisa

A pesquisa é a fonte de direção; o banco é a fonte de fato. Três correções:

1. **Eficiência e latência não são incalculáveis.** A tabela D2 do relatório as lista como
   impossíveis por falta de denominador. `extra.inbed` e `extra.onset` estão gravados desde
   o `AGG_VERSION` 4. O buraco real é **um só: hora do dia**.
2. **`is_nap` não tem caso de uso.** A R1 pede um booleano de cochilo decidido na captura.
   Zero cochilos em 308 dias. Fora do V1.
3. **`inBed` precisa ser instante, não grandeza.** A R1 pede "`inBed` como grandeza separada
   da soma dos estágios" — horas. O usuário pediu **que horas**. São campos diferentes, e a
   pesquisa não pediu o que ele quer.

A R7 (correção manual como caminho de primeira classe) foi **rejeitada** pelo usuário — ver
§4. As demais recomendações (R2 a R6, R8) estão absorvidas acima.
