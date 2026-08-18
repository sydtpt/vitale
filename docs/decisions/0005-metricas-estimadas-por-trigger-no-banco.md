# 0005 — Métricas estimadas por trigger no banco

**Status:** aceita
**Data:** 2026-07-30

## Contexto

Treino logado direto na Strava — yoga sem relógio, por exemplo — chega via HealthKit com `calories = 0` e `hr_zones` vazio. Sem estimativa, esses treinos somem dos agregados de esforço e do histórico.

Existem dois caminhos de escrita para `activities`: a RPC `sync_upsert_activities` do mobile e o ingest server-side das Conexões.

## Decisão

Um trigger `activities_estimate` (BEFORE INSERT OR UPDATE), na migration `20260730120000_activities_estimated_metrics.sql`, preenche kcal pela mediana de kcal/min do tipo × duração, e as zonas pela forma média × duração.

A elegibilidade é `calories = 0` — nada mediu o treino. Linha **com** calorias e **sem** `hr_zones` é ambígua (linha antiga do relógio esperando o re-sync trazer zonas reais) e não recebe zonas inventadas.

`calories_estimated` e `hr_zones_estimated` marcam a estimativa, ficam fora do cálculo do padrão (`activity_metric_baseline`, 40 amostras mais recentes) e a UI mostra "≈".

## Alternativas rejeitadas

**Estimar no cliente.** É o único ponto que **não** cobre os dois caminhos de escrita. Pior: o upsert reescreve `calories = 0` a cada tick, então uma estimativa gravada uma única vez seria apagada no re-sync seguinte. O trigger sobrevive por definição — ele roda em toda escrita.

**Média em vez de mediana.** Uma yoga de 1 h com 1051 kcal (27 kcal/min) contaminaria a média do tipo. Padrões atuais: yoga 5,3 kcal/min, ciclismo 5,8, corrida 10,6.

## Consequências

Esta é uma das exceções previstas para lógica no banco: o ganho é cobrir dois caminhos de escrita a partir de um ponto só, não performance.

Valor estimado nunca é tratado como medido: o trigger descarta a estimativa carregada no NEW antes de decidir, e o ingest (`hasRealHrZones`) ignora zonas estimadas no dedupe e no merge.

Backfill é `update activities set calories = calories where coalesce(calories,0) = 0` — quem preenche é o trigger.

As telas de `/fitness/*` leem HealthKit ao vivo e seguem mostrando "—"; Histórico e web leem Supabase e mostram a estimativa.
