# Tarefas: Sono

> Spec: [docs/specs/sono/spec.md](../../../docs/specs/sono/spec.md) ·
> [data-model](../../../docs/specs/sono/data-model.md) ·
> [plan](../../../docs/specs/sono/plan.md)
>
> **Fase 1 entregue** (04/09/2026) — o núcleo em `packages/shared/src/sleep/` está escrito e
> testado; nada de banco, sync ou tela. Origem: party mode de 04/09/2026 + pesquisa
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

- [ ] T2.1 — Migration `sleep_periods`: tabela, índice `(user_id, wake_day desc)`, trigger
  `touch_updated_at`, RLS `own sleep_periods`. Ver data-model §2.
- [ ] T2.2 — RPC `sync_upsert_sleep_periods(rows jsonb)`, `security invoker`,
  `on conflict (user_id, onset_at) do update` — espelha `sync_upsert_health_daily`.
- [ ] T2.3 — Aplicar em produção **com confirmação explícita**, registrar em
  `supabase_migrations.schema_migrations` ([ADR 0011](../../../docs/decisions/0011-schema-mora-em-migrations.md))
  e conferir com `supabase/scripts/check-schema-drift.sh`.

## Fase 3 — Sync

- [ ] T3.1 — `mobile/src/lib/health-buckets.ts`: `aggregateSleepNights` para de descartar o
  `onset` (hoje `:356-362` grava o instante de acordar em `start` **e** `end`). Passa a
  devolver `onset`, `wake`, `inBedStart`/`inBedEnd`, vigílias individuais e `tz_offset`.
- [ ] T3.2 — `in_bed_at`/`in_bed_end`: gravar a janela `INBED` **crua** sempre que existir
  (a duração é o `extra.inbed` de hoje, 42/42 na era Garmin — não pode sumir). A decisão de
  mostrar ou não o instante como "hora que deitou" é de `bedtimeMeasured()` no núcleo, já
  escrita e testada; a tela **obedece**, nunca reimplementa. *(Regra anterior — gravar
  `NULL` no caso degenerado — corrigida em 04/09: apagaria dado real para resolver problema
  de exibição.)*
- [ ] T3.2b — **Creditar o `AWAKE` que cai no vão da noite.** Hoje `stages.awake` só é setado
  quando `overlapMs(iv, awake) > 0`, e fonte que escreve `CORE·AWAKE·CORE` encostados perde
  tudo — 36 de 38 noites (T0.1b). Passar a creditar, **uma vez por noite**, a vigília dentro
  de `[onset, wake]`. A correção é **aditiva**: `value` não muda (cada intervalo dormindo já
  é sono puro) e a era Apple dá o mesmo resultado de hoje. Teste: o caso encostado do
  `sleep-diagnostics.test.ts` tem de passar a creditar 60 min.
- [ ] T3.2c — Investigar as **4 noites com `inbed − dormido` negativo** na era Garmin
  (mín −39 min): sono maior que a janela na cama não deveria existir.
- [ ] T3.3 — `health-aggregate.ts`: monta linhas de período; a linha diária passa a vir de
  `sleep/derive.ts`. As duas escritas no mesmo ciclo.
- [ ] T3.4 — `AGG_VERSION` 5 → 6 em `services/health-sync.ts`. Dispara `BACKFILL_DAYS = 500`.
- [ ] T3.5 — Rodar o backfill no aparelho e conferir: `sleep_periods` com ~500 linhas,
  `health_daily.sono` inalterado no `value` (a derivação tem que reproduzir o que já estava lá).

## Fase 4 — Tela mobile

- [ ] T4.1 — `mobile/src/store/sono.store.ts` (Zustand, padrão de `registros.store.ts`).
- [ ] T4.2 — **CAP-1** — os relógios: deitou · apagou · acordou, sem a subtração e sem
  rotular latência. `in_bed_at` nulo mostra o vazio com a explicação, nunca o horário de
  apagar, nunca oculto.
- [ ] T4.3 — **CAP-2** — `components/charts/SleepTimingChart.tsx`: ~14 noites, eixo Y de hora
  do dia invertido, buracos de vigília, contorno tracejado do tempo na cama, célula hachurada
  para noite sem dado. **Sem seletor de período.** `react-native-svg`.
- [ ] T4.4 — **CAP-5.2** — `components/charts/AwakeningsClock.tsx`: despertares da janela
  sobrepostos num eixo de 24 h, por densidade. Estado próprio para "a fonte não reporta".
- [ ] T4.5 — **CAP-5.3** — série de tempo acordado por noite, sem meta e sem faixa de
  referência.
- [ ] T4.6 — **CAP-3** — nota × medição: intervalo mín–máx, média e **o n** por nota. Sem
  seta, sem "melhorou", sem correlação declarada.
- [ ] T4.7 — **CAP-4** — `app/sono/[day].tsx`: faixa de estágio **cortada pelos despertares
  nas posições reais**, durações absolutas, rótulo de incerteza obrigatório e legível.
- [ ] T4.8 — **CAP-6** — cartão da categoria Sono na aba Saúde navega para `/sono`;
  `/saude/sono` sai. Conferir que `metricById('sono')` continua servindo prontidão e retro.
- [ ] T4.9 — Cor: tudo via `moduleOf('agua')`. **Zero hex em tela.** Ver
  [ADR 0031](../../../docs/decisions/0031-sono-e-categoria-nao-modulo.md).

## Fase 5 — Web (segunda rodada, não bloqueia o merge do mobile)

- [ ] T5.1 — `web/src/app/features/sono/`, rota `/sono` com `profileGuard` em
  `web/src/main.ts` + item na sidebar.
- [ ] T5.2 — Portar as quatro peças consumindo **o mesmo núcleo**. Nenhum cálculo de sono
  nasce em `web/`.

## Fechamento

- [ ] T6.1 — Link dos specs no `CLAUDE.md`.
- [ ] T6.2 — Validação nos três workspaces: `shared lint`+`test`, `web build`+`test`, mobile
  `tsc --noEmit`+`jest`, `expo-doctor` 21/21.
- [ ] T6.3 — **Conferência visual em escala real e build Release no iPhone.** Mergeado sem
  rodar no aparelho não conta como entregue.

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
