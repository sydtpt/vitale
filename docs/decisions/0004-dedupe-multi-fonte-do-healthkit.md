# 0004 — Dedupe por fonte nas métricas cumulativas do HealthKit

**Status:** aceita
**Data:** 2026-08-05

## Contexto

`react-native-health` monta as queries de `getDaily*Samples` / `getActiveEnergyBurned` com `HKStatisticsOptionCumulativeSum` e lê `result.sumQuantity` — o total de **todas as fontes somadas**, mesmo passando `SeparateBySource` nas options. O breakdown estaria em `sumQuantity(for:)`, que a lib ignora.

O app Saúde da Apple faz o oposto: deduplica por prioridade de fonte.

Detectado em 04/08/2026: Garmin marcava ~14.000 passos, Apple Health ~9.000, e `health_daily` gravava 14.574. O bug **precede** o Garmin — iPhone e Apple Watch já somavam em dobro.

## Decisão

As quatro cumulativas com mais de um escritor — passos, distância, andares e energia ativa — passam por `multiSourceFetch`: amostras cruas via `getSamples` (que trazem `sourceId`), fatiadas em blocos de 30 dias, e depois `dedupeBySource` em `health-format.ts`. Por dia local, elege a fonte de maior total e descarta as demais, preservando as amostras cruas para os buckets por hora.

Correções retroativas de agregação se propagam bumpando `AGG_VERSION` em `health-sync.ts` — v2 é este fix. O bump dispara re-backfill de `BACKFILL_DAYS` e sobrescreve o histórico via upsert.

## Alternativas rejeitadas

**Migration para corrigir o histórico.** Desnecessária: o `AGG_VERSION` já é o mecanismo de recorreção, e ele não toca schema. Toda correção futura de agregação segue esse caminho.

**Corrigir na lib.** Exigiria fork de `react-native-health` para expor `sumQuantity(for:)`. Buscar amostras cruas resolve com código próprio e ainda entrega o breakdown horário.

## Consequências

`exercicio` e os anéis são tipos exclusivos da Apple — fonte única, sem o problema. As métricas discretas usam `discreteFetch`, outro caminho, também não afetado.

Qualquer correção futura de agregação retroativa é um bump de `AGG_VERSION`, nunca uma migration.
