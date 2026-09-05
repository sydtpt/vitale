# Tarefas: Sono

> Spec: [docs/specs/sono/spec.md](../../../docs/specs/sono/spec.md) ·
> [data-model](../../../docs/specs/sono/data-model.md) ·
> [plan](../../../docs/specs/sono/plan.md)
>
> **Fases 0–4 entregues em 04/09/2026** — núcleo no shared, `sleep_periods` + `CHECK` em
> produção, sync com backfill v7 verificado contra snapshot, e a tela `/sono` conferida no
> iPhone, e a **Fase 5 (web)** conferida no navegador. **Fase 6 (CAP-7) em andamento desde
> 05/09** — o usuário a levantou; Tempos, Despertares e **Estágios conferidos no iPhone**;
> web entregue (T7.4). **T7.6 (CAP-8, a noite ao lado da nota na Hoje) escrita em 05/09,
> falta o iPhone.** **Aberto também:** T0.2
> (Foco de Sono — responde 05/09). Origem: party mode de 04/09/2026 + pesquisa
> competitiva do mesmo dia. Os mockups aprovados pelo usuário estão no artifact
> `claude.ai/code/artifact/b9afbb6a-9c59-40d5-a9f2-85ceded2ed90`.

## Fase 0 — Antes de escrever código

- [x] T0.1a — **Instrumentação pronta** (04/09). A tela só listava noites com veredito ≠ `ok`,
  e as da era Garmin são todas `ok` — ela não respondia a pergunta. Agora `auditAwake`
  (`health-buckets.ts`) compara a vigília que **existe** nas amostras com a que a agregação
  **credita**, usando a construção idêntica à do agregador, e a seção "Despertares" em
  `Configurações › Dados` mostra as duas.
- [x] T0.1b — **Rodado no iPhone em 04/09/2026. Veredito: 38 noites com `AWAKE`, 36
  descartadas.** O dado existe e nós o jogamos fora — perda nossa, corrigível, e a **CAP-5
  nasce viva** no dado de hoje. Confirmado por aritmética independente: no Garmin
  `inbed − dormido` bate ao minuto com o `AWAKE` do HealthKit em 5 de 5 noites conferidas.
  Gera T3.2b.
- [ ] T0.2 — Verificar o resultado do **Foco de Sono agendado** (ligado em 04/09): se o
  iPhone passou a escrever `INBED` começando antes do sono, `extra.onset` volta a aparecer
  nas noites novas. **Decide se CAP-1 tem dois ou três relógios.** Consulta:
  `select day, extra ? 'onset' from health_daily where metric='sono' and day >= '2026-09-05'`.

## Fase 1 — Núcleo (sem dependência de banco)

- [x] T1.1 — `SleepPeriod` e `Awakening` em `packages/shared/src/models/index.ts`. Somente
  leitura, sem lógica.
- [x] T1.2 — `packages/shared/src/sleep/timing.ts`: midpoint, projeção de período no eixo de
  hora do dia, buracos de vigília em coordenada relativa. Testes com noites reais.
- [x] T1.3 — `packages/shared/src/sleep/derive.ts`: períodos → linha `health_daily.sono`
  (`value`, `count`, `extra` no formato **idêntico** ao de hoje). Teste que trava o formato,
  porque prontidão e retro dependem dele.
- [x] T1.4 — `packages/shared/src/sleep/awakenings.ts`: histograma de densidade em bins de
  15 min. Teste dedicado para os três estados — `null` (fonte não reporta) ≠ `[]` (não houve)
  ≠ `[…]`.
- [x] T1.5 — `packages/shared/src/sleep/regularity.ts`: SRI, MSF/MSFsc/SJL com `tz_offset`.
  Não exibido no V1; existe para dar sentido ao campo. **Conferir a fórmula do SRI em
  Phillips et al. 2017 antes de qualquer exibição.**

> **Fase 1 fechada em 04/09/2026.** 4 módulos + `sleep.test.ts` com **29 testes**, todos os
> quatro exportados no `index.ts` do shared. Validação: `shared lint` (tsc) exit 0 · `shared
> test` 548 asserts, 0 falhas · `architecture.test.ts` 13/13 · `web build` exit 0 (só os dois
> avisos de budget pré-existentes) · `web test` 141/141 · mobile `tsc --noEmit` exit 0 ·
> mobile `jest` 601/601.
>
> Dois achados do caminho, para quem pegar a Fase 3: (1) o `web build` roda com
> `noPropertyAccessFromIndexSignature`, então `Record<string, number>` exige `extra['inbed']`
> — o `tsc` do shared não pega isso e o build da web pega; (2) a classificação de dia livre
> sai do `wakeAt`, não do `onsetAt` — quem deita na sexta acorda no sábado, e é o sábado que
> conta.

## Fase 2 — Banco

- [x] T2.1 — Migration `sleep_periods`: tabela, índice `(user_id, wake_day desc)`, trigger
  `touch_updated_at`, RLS `own sleep_periods`, e seis `check` — inclusive a **forma** de
  `awakenings` (NULL ou array) e de `stages`. — [migration](../../../supabase/migrations/20260904120000_sleep_periods.sql)
- [x] T2.2 — RPC `sync_upsert_sleep_periods(rows jsonb)`, `security invoker`, `on conflict
  (user_id, onset_at) do update`. `onset_at` truncado ao minuto **no servidor**;
  `nullif(r->'awakenings', 'null'::jsonb)` porque JSON null vira `'null'::jsonb`, não SQL NULL.
- [x] T2.3 — **Aplicada em produção em 04/09/2026**, com confirmação explícita, numa transação
  única (migration + `insert` em `schema_migrations` + commit) via Management API. Verificado:
  `to_regclass`, `to_regprocedure`, RLS ativa, 1 policy, 6 checks, versão `20260904120000`
  registrada. Antes disso a migration inteira + teste funcional rodaram em `begin…rollback`.

> **Drift encontrado no caminho, não relacionado:** `health_daily_vfc_backup_20260904` existe
> em produção e nenhuma migration a cria. É backup da frente de VFC/intervals.icu, datado de
> hoje. Não tocada — quem a criou decide se ela fica, vira migration ou some.

## Fase 3 — Sync

- [x] T3.1 — `aggregateSleepPeriods(samples, userId): SleepPeriod[]` em `health-buckets.ts`
  — a construção única. `aggregateSleepNights` virou **projeção** dela (mesma saída de
  antes, para a aba Saúde e o diagnóstico). `onset`/`wake` como instantes, `wakeDay`,
  `tzOffset` = `−getTimezoneOffset()` no instante do onset (cobre horário de verão; **não
  cobre viagem** — o provider não expõe o fuso da amostra do HealthKit).
- [x] T3.2 — Janela `INBED` **crua** em `inBedAt`/`inBedEnd`, sempre que existir. A projeção
  antiga re-deriva `inbed`/`onset` em horas com o mesmo `MIN_ONSET_MS`.
- [x] T3.2b — **`AWAKE` creditado uma vez por noite, pelo vão `[onset, wake]`.** O caso
  encostado do `sleep-diagnostics.test.ts` passou de 0 para 60 min creditados; `value`
  não muda (teste: 6,25 h antes e depois). `awakenings` individuais com `null` ≠ `[]`
  decidido pela **janela inteira** (alguma amostra `AWAKE` → a fonte reporta → noite sem
  despertar recebe `[]`). `AWAKE` antes do onset fica fora — é latência, não despertar.
  `auditAwake` passou a medir o que o agregador credita **hoje**, pelo próprio agregador.
- [x] T3.2c — Eram **14 noites em todo o histórico**, não 4 (a consulta anterior só olhava a
  era Garmin); o extremo é 17/07/2025, 33 min de cama para 5h44 dormindo, e o 30/08/2026 do
  mockup é uma delas. Causa no código: o agregador pegava **uma** amostra `INBED` (a que
  cobre o onset) e ignorava as outras da noite, ou a fonte fechava o `INBED` antes do sono
  acabar. Correção: a janela é a **união** das amostras `INBED` que tocam a noite,
  **alargada** para cobrir `[onset, wake]` — `inbed ≥ dormido` vira invariante e a
  eficiência para de passar de 100%. Só alarga para fora: a latência não muda. 3 testes.
  *(Candidato a `CHECK` no banco depois do backfill: `in_bed_at ≤ onset_at` e
  `in_bed_end ≥ wake_at` quando não nulos.)*
- [x] T3.3 — `sleep-rows.ts` (novo): `toSleepPeriodRows` (snake_case para a RPC) e
  `toSleepDailyRows` via `deriveSleepDays` do shared. `health-sync.ts` tira `sono` do loop
  genérico e faz as **duas escritas no mesmo ciclo** (`pushSleepPeriods` + a diária);
  cursor só avança se as duas subiram; fila offline ganhou `kind: 'sleep'`.
  **Teste de paridade** em `health-sleep.test.ts`: a linha diária derivada dos períodos ==
  a do caminho antigo, noite a noite (`value`, `count`, `extra`), numa fixture com as três
  formas reais — Apple em camadas, Garmin encostado, genérico.
- [x] T3.4 — `AGG_VERSION` 5 → 6. *(Eu tinha segurado "até o veredito do Foco de Sono, para
  um backfill só" — errado: o backfill reescreve o passado e a noite nova entra pelo
  incremental de 14 dias sem bump. Os dois não se tocam. Desamarrado pela pergunta do
  usuário em 04/09.)* Snapshot local de `health_daily.sono` tirado antes — 312 linhas, 233
  com `awake`, 14 com sono > cama — para a paridade ser conferida no dado real.
- [x] T3.5 — **Backfill v6 rodado no iPhone em 04/09/2026**, conferido contra o snapshot local:
  · `sleep_periods`: **286 linhas** (a janela de 500 dias começa em 23/04/2025; as 26 noites
    mais antigas de `health_daily` ficaram fora, como esperado), `awakenings` sem nenhum
    `'null'` textual (275 com despertar, 11 `[]`), **2 fusos** (120 e 60 — horário de verão
    saiu certo), 9 noites sem `INBED`.
  · **Paridade: 311 de 312 noites com `value` idêntico.** A exceção, 16/08/2026, não é código:
    `inbed` idêntico (8,3 h), `core` cresceu exatamente 10 min, a latência de 10 min sumiu e
    surgiu `awake` de 15 min — o Garmin reprocessou a noite entre o v5 e agora. Nenhuma
    mudança nossa altera `core`.
  · `awake` **ganhou em 45 noites, perdeu em 0**; era Garmin de 0/42 → **35/42**, média 23 min.
  · Sono > cama: **14 → 0**.
  · 03/09 em `sleep_periods`: apagou 01:45 · acordou 08:20 · **5 despertares** — os mesmos
    `AWAKE×5` da tela do diagnóstico.
  · **Achado:** 57 noites com `in_bed_at` 1–57 s DEPOIS de `onset_at`. Causa: a RPC truncava
    o onset ao minuto e o `in_bed_at` não. Corrigido no cliente (`floorMin` antes de derivar
    a janela), 2 testes; `AGG_VERSION` 6 → **7** para o próximo backfill reescrever só o
    `in_bed_at` dessas linhas (mesma chave). Funcionalmente inofensivo até lá —
    `bedtimeMeasured` já as lê como "--:--".
- [x] T3.6 — **Backfill v7 rodado em 04/09/2026: `viola_invariante = 0`.** Tudo o mais idêntico
  ao v6 (286 linhas, paridade 311/312, awake +45/−0, sono > cama 0, 2 fusos). Efeito
  colateral registrado: `onset_perdeu` foi de 1 para **3** — além do 16/08 (Garmin, 600 s),
  duas noites com latência real na faixa 60–119 s caíram abaixo do piso de 1 min quando o
  onset foi arredondado para baixo: **26/09/2025 (68 s)** e **21/03/2026 (72 s)**, `inbed`
  e `value` intocados nas duas. É o lado **conservador** da quantização ao minuto: nunca
  fabrica latência, ocasionalmente deixa de registrar uma de ~1 min — que é ruído pela
  própria definição de `MIN_ONSET_MS`, e latência é "gravada, nunca exibida" (spec §5).
  Aceito; não há mais mudança de código aqui.
- [x] T3.7 — **`CHECK` aplicado em produção em 04/09/2026** (`20260905000000_sleep_periods_janela_check`),
  com confirmação explícita, depois de dry-run em `begin…rollback` que já validava sobre as
  286 noites reais. `not valid` + `validate` em separado; `convalidated: true`; 7 checks na
  tabela; registrada em `schema_migrations`. A ordem que valeu: regra no código → dado
  conformado pelo backfill → trava no banco.

## Fase 4 — Tela mobile

- [x] T4.1 — `mobile/src/store/sono.store.ts` (Zustand, padrão de `registros.store.ts`).
- [x] T4.2 — **CAP-1** — os relógios: deitou · apagou · acordou, sem a subtração e sem
  rotular latência. `in_bed_at` nulo mostra o vazio com a explicação, nunca o horário de
  apagar, nunca oculto.
- [x] T4.3 — **CAP-2** — `components/charts/SleepTimingChart.tsx`: ~14 noites, eixo Y de hora
  do dia invertido, buracos de vigília, contorno tracejado do tempo na cama, célula hachurada
  para noite sem dado. **Sem seletor de período.** `react-native-svg`.
- [x] T4.4 — **CAP-5.2** — `components/charts/AwakeningsClock.tsx`: despertares da janela
  sobrepostos num eixo de 24 h, por densidade. Estado próprio para "a fonte não reporta".
- [x] T4.5 — **CAP-5.3** — série de tempo acordado por noite, sem meta e sem faixa de
  referência.
- [x] T4.6 — **CAP-3** — nota × medição: intervalo mín–máx, média e **o n** por nota. Sem
  seta, sem "melhorou", sem correlação declarada.
- [x] T4.7 — **CAP-4** — `app/sono/[day].tsx`. Implementado como **duas faixas**, não uma: a
  linha do tempo (sono do apagar ao acordar, despertares cortando nas posições reais) e,
  separada, a composição por estágio em proporção — porque o que se grava são horas por
  estágio, não intervalos. Spec CAP-4 ajustada para dizer isso. Rótulo de incerteza presente.
- [x] T4.8 — **CAP-6** — cartão da categoria Sono na aba Saúde navega para `/sono`;
  `/saude/sono` sai. Conferir que `metricById('sono')` continua servindo prontidão e retro.
- [x] T4.9 — Cor: tudo via `moduleOf('agua')`. **Zero hex em tela.** Ver
  [ADR 0031](../../../docs/decisions/0031-sono-e-categoria-nao-modulo.md).

> **Fase 4 escrita e tipada em 04/09/2026** (`data/sleep.ts` no shared, `sono.store.ts`,
> `SleepTimingChart`, `AwakeningsClock`, `app/sono/index.tsx`, `app/sono/[day].tsx`, rotas no
> `_layout.tsx`, `saude.tsx` roteando sono para `/sono`). Validação: shared lint 0 · shared
> test 549 asserts + arquitetura 13/13 · web build 0 · mobile tsc 0 · mobile jest 621/621.
>
> **05/09/2026:** `app/sono/index.tsx` virou `app/(tabs)/sono.tsx` — Sono é aba da barra, no
> lugar de Compras (que passou ao Mais como aba oculta), e saiu da lista da Saúde.
> **Conferência no aparelho pendente — é o Done (T6.3).**
>
> Dois tropeços que valem para a próxima tela: (1) as **rotas tipadas** do expo-router só
> regeneram com `expo start`/`export` — os três builds de device da noite não tocaram o
> `.expo/types/router.d.ts` (datado de 03/09); a saída foi subir o Metro por 6 s e derrubar.
> (2) A catraca de hex pegou **meu próprio** `dados.tsx` da tarde (203 > 200): segui o padrão
> local do arquivo em vez do tema e não rodei o `shared test` depois daquele commit.

## Fase 5 — Web (segunda rodada, não bloqueia o merge do mobile)

- [x] T5.1 — `web/src/app/features/sono/` (store por signals, 2 gráficos SVG, 2 páginas),
  rotas `/sono` e `/sono/:day` com `profileGuard`, item 🌙 na sidebar, CLAUDE.md. Escrito em
  04/09/2026 ~00:15.
- [x] T5.2 — As quatro peças + detalhe da noite, **mesma composição do mobile** (coluna única,
  720 px) — a web recompõe, não redesenha; duas colunas seria decisão visual nova, com
  mockup antes. Todo cálculo vem de `@vitale/shared/sleep`; a web só desenha. `sono.store.ts`
  entrou na `STORE_ALLOWLIST` do teste de arquitetura (signals ≠ Zustand, AD-12).
  Validação: `ng build` 0 · Vitest 141/141 · arquitetura 13/13. **Conferida no navegador em
  05/09/2026 ~00:30** — o usuário abriu `/sono` no `ng serve` dele e disse *"está ok"*.

## Fase 6 — Seção "Tempos e estágios" (CAP-7) — **adiada por pedido do usuário**

> Pedida em 04/09/2026 às 23:30, com a instrução explícita: *"não precisa ser feito agora,
> mas incluir a feature e faremos quando for a melhor momento. Me avisar."* Referência
> visual: a tela de Sono do app Saúde da Apple (M · Amounts). **Quem pegar o repo depois
> de 05/09 e vir a Fase 4 conferida no aparelho: é hora de levantar esta.**

- [x] T7.0 — Decidido em 05/09/2026, com dados reais e mockup antes de código. **(a) decidida pelo usuário em
  05/09:** nem absorve nem convive — a peça ② fica no `/sono` e **tocar nela abre
  `/sono/tempos`**; Despertares (③) abre **`/sono/despertares`**. **(b) decidida:** semanas
  (mediana + p25–p75) para 12m e ano; **"sempre" retirado** pelo usuário em 05/09, e **todo
  período navegável** — ◀ ▶ anda um período do próprio tamanho, só onde há noite; troca de
  relógio (18/07) marcada. **(c) decidida:** média
  "na cama" só quando ≥ 80% das noites medem a cama (em última/7d/4s é **0%** no Garmin),
  senão o segundo número vira "acordado". **(d) decidida:** contagens de despertar saem por
  era quando o período cruza a troca — Apple 11,8/noite vs Garmin 2,6–3,4 não se somam.
  Ordem: **Opção 1 (Tempos) + Despertares primeiro**, com o dado de hoje; Estágios depois. Paleta do
  destaque validada: azul + amarelo, CVD ΔE 27; amarelo no claro pede contorno
  (`roleColors('yellow').text`).
- [x] T7.1 — **Opção 1 — Tempos + subview Despertares**, escritas em 05/09/2026. Núcleo no
  shared: `ranges.ts` (5 períodos, `offset` de navegação, `hasNights`, `rangeLabel`),
  `summary.ts` (regra dos 80%), `buckets.ts` (semanas: mediana + p25–p75, `quantile` =
  `percentile_cont`), `facts.ts` (`nightFacts`, `bucketFacts` por era, `awakeFacts`),
  `awakenings.ts` (+`awakeningsByHour` contando NOITES, `awakeningDurations`,
  `awakeByWeekday`) — 19 testes. Mobile: `PeriodNav` (o `Segmented` do Histórico + ◀ ▶),
  `PeriodAverages`, `FactsList`, `SleepBucketsChart`, `SleepTimingChart` com
  `emphasis="awake"` (cama sem destaque, despertar amarelo com contorno `roleColors('yellow').text`),
  `app/sono/tempos.tsx`, `app/sono/despertares.tsx`, cards ② e ③ do `/sono` viraram links,
  marcador da troca de relógio em `config/sono-markers.ts` (dado do usuário, não lógica).
  Store carrega o histórico inteiro. Validação: shared 569 asserts · mobile tsc 0 · jest 621 ·
  web build 0. **Conferida no iPhone em 05/09/2026 (~01:45): "está ótimo".**
- [x] T7.2 — **Opção 2 — Estágios**, escrita em 05/09/2026 (~02:00). `stage_segments` no
  modelo, na RPC e no agregador (que já fatiava por estágio e passou a emitir; `unspecified`
  é o sono sem hipnograma; o despertar é o vão). **Migration aplicada em produção em 05/09**
  (dry-run em `begin…rollback` antes; 8 checks; registrada). `AGG_VERSION` 8. Na tela: toggle
  Tempos ⇄ Estágios em `/sono/tempos` — noites com os segmentos na posição real, semanas em
  composição (horas médias por estágio, `stagesH`); rótulo de incerteza sempre; o detalhe da
  noite ganha `StageTimeline`. Testes: agregador emite segmentos em ordem sem o AWAKE, horas
  batem com segmentos; `stagesH`; `stageFacts`. **Backfill v8 rodado em 05/09 (~02:20):**
  285 de 287 linhas com segmentos (as 2 sem estão fora da janela de 500 dias de hoje), 0
  vazias, 31,6 segmentos/noite em média, **paridade deep horas × segmentos com diferença
  máxima 0,0 min** em 277 noites. A noite de 04/09, segmento a segmento, mostra o vão
  02:47–03:10 — exatamente o despertar de 23 min que a tela de diagnóstico tinha contado.
  **Conferida no iPhone em 05/09/2026 (~02:30): "está ok".**
- [x] T7.3 — Spec reconciliada em 05/09: a peça ② fica sem seletor na visão geral; o seletor
  mora nas subviews. Nem absorção nem duplicação.
- [x] T7.4 — **Web:** `/sono/tempos` e `/sono/despertares` em Angular, pelo mesmo núcleo —
  mesma composição do mobile (coluna única), como a Fase 5. Escritas em 05/09/2026:
  `SonoPeriodNavComponent` (o segmentado do Histórico + ◀ ▶), `PeriodAveragesComponent`,
  `FactsListComponent`, `SleepLegendComponent`, `SleepTimingChartComponent` com as três
  ênfases (vão + marca ao lado, hachura, cama em `wash`), `SleepBucketsChartComponent` e
  `SleepStagesStackComponent` (por noite ou semana), sub-seletor na hora · total; as peças ②
  e ③ da visão geral viraram links. O `SonoStore` passou a carregar o histórico inteiro
  (as notas continuam na janela de 90 dias). `SONO_MARKERS` subiu para o shared
  (`sleep/markers.ts`) — a barreira de nomes duplicados não deixa duas cópias. Rotas antes
  de `sono/:day`. Validação: web build 0 (só avisos pré-existentes) · 141 testes ·
  architecture 13/13. **Falta a conferência no navegador.**
- [x] T7.5 — **Gramática de cor (review de UX, 05/09/2026).** Medido nas 36 combinações: o Leve
  era o tint (1,14–1,43), REM = Profundo em 22/36, o azul dizia três coisas. Feito: `graphic`,
  `wash` e `ramp` por papel em `derive.ts` (+ barreira no `theme.test.ts`), `sleep/colors.ts`
  com a gramática (+ `colors.test.ts`), `bucketPeriods(…, 'night')`, `stageFacts` com a vigília.
  Mobile: `sleepColors()`, `SleepLegend`, `SleepTimingChart` (vão + marca amarela ao lado,
  hachura, cama em `wash`), `SleepStagesStackChart` (por noite ou semana, ordem = legenda, gap
  2 px, vigília no topo), sub-seletor **na hora · total** em `tempos.tsx`, Despertares em
  amarelo com fim de semana por rótulo, detalhe da noite em Svg. Web: `--sleep-*` pelo
  `ThemeService`, as páginas existentes trocadas. Docs: spec §4 e CAP-7, [ADR 0032](../../../docs/decisions/0032-cor-de-sono-e-gramatica-derivada.md).
  Mockup aprovado: `claude.ai/code/artifact/b6db5657-2531-42c2-a91d-7c532ab10601`.
  **Conferida no iPhone em 05/09/2026** (build por cabo, paleta Acessível, tema Clean): "está
  ótimo". No caminho ele escolheu a forma do despertar (vão + marca ao lado, entre três) e o
  REM rosa também na Acessível — a exceção que voltava à rampa azul saiu. Falta a web no
  navegador.
- [x] T7.6 — **CAP-8 — a noite ao lado da nota, na Hoje.** Pedida e decidida em 05/09/2026:
  proposta com mockup em 402 pt, seletor dos 144 eixos e sete noites reais
  (`claude.ai/code/artifact/5d2b47a9-70e1-4e67-9b44-d5d3a63dc816`); o usuário escolheu a
  **opção A** (duas linhas de texto) **sem veto** às decisões D1–D8. Shared: `nightLine()` e
  `lineText()` em `facts.ts` — partes `num`/`sym`/`word`, os três estados de vigília —, 4
  checks em `sleep-ranges.test.ts` com as noites da proposta (a do screenshot, o fuso, o
  singular/zero/nulo, a pior com 21). Mobile: `loadToday()` na `sono.store` (uma consulta por
  `wake_day`, mesclada por `onset_at`, sem marcar `loaded`), `SleepRatingCard` com o bloco à
  direita do chip (12/16 pt, `ink`/`ink2`, `marginLeft: auto`, toque → `/sono/[day]`),
  `(tabs)/index.tsx` carrega no boot e no foreground. Specs: ratings-diarios FR-009 e tabela
  de decisões, sono CAP-8 e §5, mobile-hoje. **Falta conferir no iPhone** — é lá que os 12 pt
  se confirmam ou viram 12,5 (D7).
- [x] T7.7 — **CAP-9 — Sono na Retrospectiva.** Pedida em 05/09/2026 ("média de quanto estou
  acordando por noite, tempos de sono por fase, e outras ideias"); proposta com 63 noites
  reais de prod no artifact `claude.ai/code/artifact/73f0edb9-ae85-42d5-9216-0d51b39c2d0c`
  ("Sono no Jornal"), aprovada com os quatro "sim": a linha Sono sai do card Saúde, B1 + B4
  entram no Tempos, saldo contra 7 h fica fora, nota × medição pode ser manchete. Shared:
  `sleep/retro.ts` (`sleepSide`, `sleepRetro`, `ratingsSplit`, `weekendShift`,
  `sleepHighlights`, `NIGHT_REFERENCE_H` — a constante que `HEALTH_TARGETS.sono` passa a
  apontar), 13 checks em `sleep-retro.test.ts`; `period/retro.ts` ganha
  `RetroInput.sleepPeriods` e `RetroSummary.sleep`, pula a linha `sono` dos destaques de
  saúde quando o bloco existe; `retro-blocks.ts` ganha o id `sleep`. Mobile: `retro.store`
  busca `sleep_periods` na mesma janela; `SleepRetroCard.tsx` (número grande com Δ em min,
  apagou · acordou com miolo, acordado por noite, composição por fase, semana a semana e fim
  de semana × semana no mês, nota × medição, caixa de correções com o `n` anterior e o
  marcador Garmin); `retrospectiva/index.tsx` renderiza o bloco e esconde "Sono" e "Sono
  percebido" do card Saúde. Docs: v2-jornal §9, spec CAP-9, CLAUDE.md. Validação: shared
  lint 0 · shared test ok · mobile tsc 0 · jest 626/626. **Falta conferir no iPhone.**
- [x] T7.8 — **CAP-10 — Dispersão e antes × agora no Tempos.** `SleepDispersion.tsx` (quatro
  réguas com mediana e miolo, fim de semana vazado, semanas como pontos nos períodos longos)
  como terceiro modo; `BeforeAfter.tsx` (duas noites típicas com bigode, composição dos dois
  lados, diferenças em minutos) abaixo dos fatos em todos os modos, com ≥ 3 noites de cada
  lado; `SleepLegend` ganha `SwDot`/`SwRing`/`SwBar`. Mesmo núcleo `sleepRetro` do T7.7.
  **Falta conferir no iPhone.** B2 (grade semana × dia), séries do ano e gatilho × fases
  ficam na fila (v2-jornal §9).

## Fechamento

- [x] T6.1 — Link dos specs no `CLAUDE.md`.
- [x] T6.2 — Validação nos três workspaces em 04/09 (após a Fase 4): `shared lint` 0 · `shared
  test` 549 asserts + `architecture.test.ts` 13/13 · `web build` 0 · `web test` 141 · mobile
  `tsc` 0 · `jest` 621/621. *(`expo-doctor` não rodado: nenhuma mudança nativa ou de pacote.)*
- [x] T6.3 — **Conferida no iPhone em 04/09/2026** (build Release por cabo, `pnpm mobile:device`):
  o usuário abriu Saúde › Sono e disse *"está ok no telefone"*. É o Done da Fase 4.

## Fora do escopo (registrado para não voltar como ideia nova)

| Item | Motivo |
|---|---|
| Score / nota de sono | Princípio da spec §2 |
| Índice de fragmentação a partir dos despertares | O dado do usuário mostra vigília × nota correndo ao contrário (spec §6) |
| Hipnograma com scrub | O card de estágio entrega o que o dado sustenta |
| Tendência com seletor Semana/Ano/Sempre | Segunda tela; reusa o componente do Histórico |
| Latência como número rotulado | Gravada, nunca exibida |
| `is_nap` | Zero cochilos em 312 dias |
| Botão "deitei" / correção manual | Recusado pelo usuário em 04/09/2026 |
