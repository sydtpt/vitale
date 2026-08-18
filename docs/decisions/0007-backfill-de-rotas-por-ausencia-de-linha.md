# 0007 — Backfill de rotas chaveado por ausência de linha, não pela flag

**Status:** aceita
**Data:** 2026-07-23

## Contexto

Em 23/07/2026, ~80 atividades tinham `has_route = true` e nenhuma linha em `activity_routes` — apareciam sem mapa no histórico. A causa: um push de rota que falha num sync anterior comita a atividade com a flag ligada e deixa a rota pendente.

O `retryMissingRoutes` original olhava `has_route = false` **e** só os últimos 7 dias. Por construção, nunca alcançaria essas linhas: elas têm a flag ligada e são antigas.

## Decisão

`retryMissingRoutes` (em `mobile/src/services/activity-sync.ts`) passa a chavear na **ausência de `route_row`**, via diff contra `existingRouteIds`, não na flag.

- `has_route = true` sem pontos — falha de push — re-tenta **sem janela**, drenando o histórico.
- `has_route = false` re-tenta só na janela recente de 30 dias.
- Escopo restrito a provider `healthkit` ou nulo: rota de strava e intervals chega pelo ingest server-side, e o `id` nem é do HealthKit.
- Ajusta `has_route` honestamente: true se achou pontos, false se o HealthKit não tem — assim não re-tenta em loop.
- Cap de 25 por sync, rodando ao fim de todo `syncDelta`.

## Alternativas rejeitadas

**Manter a flag como chave.** É justamente a flag que mente quando o push falha. Derivar do estado real (existe linha?) é auto-curativo; derivar da flag propaga o erro.

**Backfill manual único.** Resolveria o passivo e não as falhas futuras. O cap por sync drena o backlog em alguns syncs e cura o que vier depois.

## Consequências

Rides de ciclocomputador não são recuperáveis por aqui: o GPS ficou no iGPSPORT e o Apple Watch só gravou FC, então o HealthKit não tem o track. Para essas, 20 de 24 foram recuperadas por importação do export em massa do Strava, direto em `activity_routes`.

Um "Reenviar histórico completo" futuro de Ciclismo devolve `has_route = false` nessas 20 — o HealthKit segue sem a rota. O mapa por país continua funcionando, porque usa `route_overview` e `cities`; só o mapa do detalhe some. Se acontecer, re-setar `has_route`.
