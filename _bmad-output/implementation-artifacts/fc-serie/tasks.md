# Tasks: FC ao longo do dia — `health_series`

Spec: [docs/specs/fc-serie/spec.md](../../../docs/specs/fc-serie/spec.md) ·
data-model: [data-model.md](../../../docs/specs/fc-serie/data-model.md) ·
ADR: [0033](../../../docs/decisions/0033-serie-intradiaria-em-arrays-por-dia.md)

Branch `feat/fc-serie`, criada da `main` em 05/09/2026 (worktree `.claude/worktrees/fc-serie`).

## Fase 1 — Núcleo e sync (construída em 05/09/2026)

- [x] **T1.1** Migration `20260905120000_health_series.sql`: tabela, constraints, índice, RLS,
      trigger e RPC `sync_upsert_health_series` com `with ordinality`.
- [x] **T1.2** Modelo `HealthSeriesDay` em `packages/shared/src/models/index.ts`.
- [x] **T1.3** Núcleo puro `packages/shared/src/health/series.ts`: `bucketSeriesByMinute`,
      `expandSeriesDay`, `SERIES_METRICS`; teste `series.test.ts` (9 checks: constantes, vazio e
      inválido, média por minuto, fronteira do dia local, ordenação, tzOffset, decimais, ida e volta).
- [x] **T1.4** Leitura `packages/shared/src/data/health-series.ts` — colunas explícitas, paginado.
- [x] **T1.5** Mobile: `health-series-rows.ts`, `kind: 'series'` na fila offline,
      `chunkRange` exportado, `health-sync.ts` com `fetchInChunks`, `pushHealthSeries`,
      `HEAVY_MAX_DAYS` 60 → 200, `AGG_VERSION` 7 → 9 (8 reservado para a PR #1 do sono).
- [x] **T1.6** Teste do mobile `health-series.test.ts`: Sample do HealthKit → linha da RPC; a
      fila deduplica por (usuário, dia, métrica).
- [x] **T1.7** Validação nos três workspaces em 05/09/2026: shared `tsc` limpo + todos os
      `*.test.ts` (inclusive as barreiras de arquitetura); mobile `tsc` limpo + jest 48 suítes,
      620 testes; web build + Vitest. `check-schema-drift.sh` acusa só o esperado:
      `health_series` ainda não existe em produção (mais dois desvios anteriores a esta branch:
      `health_daily_vfc_backup_20260904` e `sleep_periods.stage_segments`, da PR #1 do sono).

## Fase 2 — Produção (pendente; depende do usuário)

- [ ] **T2.1** Aplicar a migration em produção — **manual, com confirmação** (AGENTS.md). Registrar
      em `supabase_migrations.schema_migrations` e rodar `supabase/scripts/check-schema-drift.sh`.
- [ ] **T2.2** Rebuild do iPhone (`pnpm mobile:device`) **depois** da migration. O bump para v9
      dispara o backfill sozinho.
- [ ] **T2.3** Conferir no banco: linhas de `fc` desde ~18/02/2026 (200 dias), 300–720 minutos por
      dia na era Garmin; `health_daily.fc.count` inalterado nos dias já gravados; nenhum item
      `series` preso na fila (Configurações → Dados).

## Fase 3 — Tela (pendente; passa por proposta antes de código)

- [ ] **T3.1** Proposta visual com os dados reais de `health_series`: detalhe de FC na Saúde da
      web (curva do dia, dias sobrepostos, faixa noturna) e a aba Saúde do mobile lendo o
      Supabase em vez do HealthKit na era Garmin. Mockups em tamanho real, seletor dos seis
      temas, decisões para vetar. **Perguntar antes de construir.**
- [ ] **T3.2** Só depois da aprovação: o código de tela.

## Diferido

- Backfill além de 200 dias (a era Watch inteira, desde março de 2025): subir `HEAVY_MAX_DAYS`
  ou expor `syncHealth(dias)` em Configurações → Dados. Não medido no aparelho.
- Stress e body battery intradiários na mesma tabela: dependem de um app Connect IQ no Venu 4.
- Horário de verão: a hora repetida vira média e a metade do dia reexpande deslocada. Sem tela
  que mostre, sem correção agora.
