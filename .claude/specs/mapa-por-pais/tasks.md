# Tasks: Visão detalhada por país

> Legenda: [x] feito · [~] feito, pendente de passo operacional (deploy/dados reais) · [ ] a fazer.

## Shared

- [x] **T1 — `CityMark.countryCode`** em [`models/index.ts`](../../../packages/shared/src/models/index.ts#L359-L371) (campo opcional, ver [data-model §1](./data-model.md#1-citymarkcountrycode)).
- [x] **T2 — `constants/country-bboxes.ts`** — `COUNTRY_BBOXES` (42 países comuns), `flagEmoji(code)`, `countryName(code)`. Exportado em `packages/shared/src/index.ts`.
- [x] **T3 — `geo/country-explorer.ts`** — `countryForCity`, `ridesByCountry`, `activitiesInCountry`, `citiesInCountry`, `countryViewport` + `cityBelongsToCountry` (interno). Exportado no `index.ts`.
- [x] **T4 — Testes** [`country-explorer.spec.ts`](../../../web/src/app/features/workout-history/data/country-explorer.spec.ts) (Jasmine). **Lógica verificada por harness `tsx`: 13/13 casos passam** (o runner Jasmine do repo não roda — `tsconfig.spec.json` ausente, mesma limitação dos demais specs).

## Backend

- [x] **T5 — `geocode.ts`** — `reverseGeocode` preenche `countryCode` (`a.country_code` → uppercase); interface local `CityMark` espelha o campo.
- [x] **T6 — Deploy + backfill** ✅ (2026-07-22). `supabase functions deploy connections-ingest` feito. Backfill foi **no-op**: prod tinha 0 atividades enriquecidas (a função nunca rodara com `enrichCities` em prod), então não havia nada a resetar — as 177 bikes já estavam com `cities=NULL`. Cron `connections-ingest` (pg_cron, a cada 15 min → `runIngestAll` → `enrichCities`, usuário tem intervals conectado) drena 3/run automaticamente. **Verificado end-to-end**: disparei o cron uma vez, 2 atividades enriquecidas na hora, `countryCode` gravado correto (ex.: rota cross-border Meuse com cidades BE **e** FR).

## Web

- [x] **T7 — `ActivitiesStore.loadRoutes(ids)`** — busca em lote via `.in('activity_id', ids)`, mesmo cache `_routes` de `loadRoute`, cacheia `[]` para ids sem rota.
- [x] **T8 — Rota nova** em [main.ts](../../../web/src/main.ts) — `workout-history/:slug/mapa` → `ActivityCountryPageComponent`, **inserida antes** de `:slug/:id` (armadilha de roteamento resolvida).
- [x] **T9 — Botão "Visão detalhada"** no header de [`activity-type-page`](../../../web/src/app/features/workout-history/pages/activity-type-page.component.html), visível só quando `ridesByCountry(...)` do tipo não é vazio.
- [x] **T10 — `country-picker.component`** — grade de países (bandeira, nome, nº de pedaladas), ordenada por `rideCount` desc.
- [x] **T11 — `country-map.component`** — 1 polyline por atividade (peso 3, opacity 0.7, sem casing dupla), downsample a 150 pontos, `fitBounds` ao `viewport` (não ao conteúdo).
- [x] **T12 — `country-city-list.component`** — lista alfabética com contador de visitas.
- [x] **T13 — `ActivityCountryPageComponent`** — orquestra 0/1/N países, carregamento de rotas em lote, cabeçalho com stats + seletor de país (US5), lista de treinos reusando `rt-activity-item`.
- [~] **T14 — Validação** — `ng build` AOT limpo ✅; `tsc --noEmit` do shared limpo ✅. **Falta**: abrir o app com dados reais e conferir (a) `.../ciclismo/mapa` não cai no detalhe, (b) enquadramento e lista de cidades de um país real batem. Depende do app rodando + backfill (T6) para o caso ideal.

## Perf — overview reduzido de rota (evita timeout no mapa de país)

- [x] **T15 — Coluna gerada `route_overview`** — migration [`20260723120000_activity_routes_overview.sql`](../../../supabase/migrations/20260723120000_activity_routes_overview.sql): função IMMUTABLE `_route_overview(points, every=40)` (1 passada, WHERE só aritmético — a 1ª versão reparava o blob por elemento e levava >60s numa rota grande) + coluna `generated always as (...) stored` em `activity_routes`. Aplicada + registrada em `schema_migrations`. **Motivo:** puxar `points` cheio de dezenas de rotas num `in(...)` = 89 MB/17.7s → estoura o `statement_timeout=8s` do role `authenticated` quando o país tiver muitas rotas.
- [x] **T16 — Web lê o overview** — `ActivitiesStore.loadRouteOverviews(ids)` (cache próprio `_overviews`, **separado** de `loadRoute` do detalhe que precisa de pontos cheios) lê `route_overview` e mapeia `[[lat,lng]]`→`{lat,lng}`; a página de país usa esse método. **Verificado**: pull das 155 rotas caiu de **89 MB/17.7s → 875 KB/0.9s**. `ng build` limpo.

## Pendências operacionais (não-código)

1. ~~**T6** — deploy da edge function + UPDATE de backfill.~~ ✅ Feito 2026-07-22; drain rodando via cron (3/run a cada 15 min).
2. **T14** — abrir o app no browser e conferir a tela `.../ciclismo/mapa` com os dados que forem drenando (o `countryCode` já está verificado no banco). O drain completo das 177 leva ~algumas horas.
