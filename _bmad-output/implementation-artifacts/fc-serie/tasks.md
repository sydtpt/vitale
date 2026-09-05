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

## Fase 2 — Produção (feita em 05/09/2026, com autorização do usuário)

- [x] **T2.1** Migration aplicada pela Management API e registrada em `schema_migrations`
      (`20260905120000 · health_series`). `check-schema-drift.sh` passou a acusar só os dois
      desvios anteriores a esta branch.
- [x] **T2.2** Build Release por cabo a partir do diretório principal (branch do sono + este
      commit aplicado como patch, `AGG_VERSION` resolvido em 9). Instalou; o launch falhou porque
      o iPhone estava bloqueado — aberto pelo ícone.
- [x] **T2.3** Backfill verificado no banco minutos depois da abertura:

      | Medida | Valor |
      |---|---|
      | Dias com série | 177, de 20/02 a 05/09/2026 (o teto de 200 dias alcança 18/02) |
      | Era Garmin (≥ 18/07) | 48 dias, 45 deles com 300–720 minutos; média 628 |
      | Era Watch | média de 245 minutos por dia |
      | Integridade | 0 linhas com minutos fora de ordem, 0 com minuto repetido; 2 fusos (verão/inverno) |
      | Paridade com `health_daily.fc` | em 04/09, 02/09, 30/08 e 26/08: mesmo `count`, mesma média, mín e máx |
      | Linha diária | ganhou 20/02 como primeiro dia (era 26/02); nenhuma linha perdida |
      | Sono | `stage_segments` em 286 de 288 noites — o backfill v9 não os zerou |
      | Tamanho | 432 kB para 177 dias (~2,4 kB/dia, abaixo da estimativa) |

## Fase 3 — Tela (pendente; passa por proposta antes de código)

- [ ] **T3.1** Proposta visual com os dados reais de `health_series`: detalhe de FC na Saúde da
      web (curva do dia, dias sobrepostos, faixa noturna) e a aba Saúde do mobile lendo o
      Supabase em vez do HealthKit na era Garmin. Mockups em tamanho real, seletor dos seis
      temas, decisões para vetar. **Perguntar antes de construir.**
      Publicada em 05/09/2026: `claude.ai/code/artifact/40958370-db73-4342-ad26-e74838b4ef2a`.
      Três painéis na web (curva do dia, Noites, dia × hora) e o detalhe de FC no iPhone com o card
      Dormindo; oito decisões listadas com a alternativa rejeitada. Aguardando vetos.
- [ ] **T3.2** Só depois da aprovação: o código de tela.

## Diferido

- Backfill além de 200 dias (a era Watch inteira, desde março de 2025): subir `HEAVY_MAX_DAYS`
  ou expor `syncHealth(dias)` em Configurações → Dados. Não medido no aparelho.
- Stress e body battery intradiários na mesma tabela: dependem de um app Connect IQ no Venu 4.
- Horário de verão: a hora repetida vira média e a metade do dia reexpande deslocada. Sem tela
  que mostre, sem correção agora.
