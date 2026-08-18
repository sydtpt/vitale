# 0001 — Zonas de FC por percentual da FC máxima

**Status:** aceita
**Data:** 2026-07-25

## Contexto

As zonas de FC (`activities.hr_zones`) alimentam o cálculo de esforço ([0002](0002-minutos-de-esforco-ancorados-no-vigoroso.md)) e a Carga Semanal. Duas formulações competiam: percentual da FC máxima (padrão Garmin) e reserva de FC (Karvonen), que exige também a FC de repouso.

O `loadHrParams` original lia `linked_accounts.athlete_meta.max_hr` vindo do intervals.icu. Esse campo trazia **210** — default da plataforma que nunca foi corrigido — enquanto a FC máxima real do usuário é **184**, conferida no Garmin. Com Karvonen sobre 210, treinos leves caíam 100% na Z1: o pico em pedais longos é ~149, que sobre 210 nem sai do chão.

## Decisão

Zonas são percentual da FC máxima, sem FC de repouso. A fonte única é `user_preferences.max_hr` (coluna criada em `20260725120000`), lida tanto pelo ingest (`supabase/functions/_shared/ingest.ts`, `loadHrParams`) quanto pelo mobile (`healthkit-workouts.ts`, `fetchHrZoneParams`).

`athlete_meta.max_hr` segue sendo gravado por `validateIntervals`, mas não participa mais do cálculo.

## Alternativas rejeitadas

**Karvonen (reserva de FC).** Mais sensível individualmente, mas exige FC de repouso confiável e não é o que o relógio do usuário mostra — divergir do Garmin faria o app discordar da fonte que ele confere.

**Manter `athlete_meta` como fonte.** É dado de terceiro que ninguém validou. O bug não foi de parsing: as amostras de FC sempre estiveram corretas. Era parâmetro errado alimentando modelo errado.

## Consequências

O edge function **precisa** ser re-deployado após qualquer mudança aqui. A versão intervals tem richness 7,3 contra 7 da linha HealthKit, então re-sobrescreve `hr_zones` a cada tick dentro da janela de 24h do cursor — sem o deploy, treino recente reverte para o valor antigo.

Trocar de relógio ou reavaliar a FC máxima é editar uma linha em `user_preferences`, não migrar dado.
