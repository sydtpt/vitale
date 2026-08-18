# 0006 — Backfill de elevação por função transiente na migration

**Status:** aceita
**Data:** 2026-07-15

## Contexto

`activities.elevation_m` é derivado no pipeline TypeScript (`packages/shared/src/fitness/streams.ts`, providers strava e intervals). Quando o algoritmo muda, o histórico já gravado precisa ser recalculado — e recalcular em TS exigiria baixar todas as rotas para o cliente.

## Decisão

Cada ajuste de algoritmo em produção vira uma migration one-off no padrão **create → backfill → drop**: `create or replace function public._elevation_gain(...)`, `UPDATE activities.elevation_m`, e `drop function` no fim. Três já foram aplicadas: `20260708120000`, `20260715120000` (hysteresis) e `20260715150000` (smoothing).

O drop é intencional. A função não é API do banco; é ferramenta de uma migração específica.

## Alternativas rejeitadas

**Deixar a função no banco.** Viraria superfície permanente que ninguém mantém, e um segundo dono do algoritmo além do TypeScript.

**Recalcular pelo cliente.** Baixar todas as rotas para recomputar é exatamente o padrão de payload que já custou caro neste projeto.

## Consequências

Consequência que confunde e precisa ser dita: as três migrations estão **registradas** em `schema_migrations` **e** `_elevation_gain` **não existe** no banco. Isso não é drift.

**Não recriar `_elevation_gain` de cabeça nem rodar UPDATE de recálculo avulso.** Um `update ... set elevation_m = public._elevation_gain(points)` falha com `function does not exist`, e reimplementar o algoritmo de memória erra os valores.

Para reprocessar com algoritmo novo: nova migration no mesmo padrão, com `set statement_timeout` alto — o UPDATE sobre ~155 rotas passa dos 8 s do role `authenticated`. Um "timeout 57014" nesse UPDATE é o teto de 8 s, não bug do algoritmo.
