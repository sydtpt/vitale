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
- [ ] T3.7 — Migration com o `CHECK` de janela agora que o backfill provou o invariante em
  286 noites: `in_bed_at is null or (in_bed_at <= onset_at and in_bed_end >= wake_at)`.
  Aplicar em prod **com confirmação explícita** (dry-run em `begin…rollback` antes, como
  a 20260904120000).

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
