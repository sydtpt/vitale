# ADR 0034 — O piso das rotas vem do OpenStreetMap, no ingest, com procedência e "não sei" visível

**Data:** 2026-09-06 · **Status:** aceita

## Contexto

Em 05/09/2026 o dono do app quis trocar de pneu "com base em todas as pedaladas".
O banco guarda o track GPS de cada rota mas não sabe o chão: nenhuma fonte
(HealthKit, Strava, intervals.icu) manda piso. Cruzar as 137 rotas com o
OpenStreetMap à mão respondeu a pergunta (87% pavimentado, 12,5% cascalho leve,
8% pavé e blocos) e decidiu o pneu. A pesquisa competitiva do mesmo dia mostrou
que só o Garmin faz isso por pedalada (no aparelho, contra o mapa instalado),
que ninguém agrega por período, bicicleta ou pneu, e que "piso errado" é a
queixa nº 1 dos usuários — com a causa às vezes no mapa, não no OSM.

## Decisão

1. **O piso é calculado no ingest**, num passe best-effort ao lado do de
   cidades (`enrichSurface`, uma pedalada por tick), a partir do
   `route_overview` amostrado a cada ~400 m e de UMA chamada ao Overpass por
   rota (vias `highway` a até 25 m da polilinha das amostras). O passado entra
   por backfill, o futuro pelo cron.
2. **A regra é pura e vive no núcleo**, em `packages/shared/src/surface/classify.ts`,
   sem imports, porque a edge function a importa por caminho relativo. Tags do
   OSM viram seis classes — liso, blocos, pavé, cascalho, terra, desconhecido —
   e todo trecho carrega se foi **inferido** (sem tag `surface`, classe vinda de
   `tracktype` ou `highway`). Ciclovia a até 12 m vence a rua paralela; reta
   maior que 500 m entre pontos é GPS perdido e vira "desconhecido", não
   crédito.
3. **Duas colunas na rota, uma na atividade.** `activity_routes.surface_segments`
   é o detalhe por trecho (metros ao longo do overview); `surface_meta` é a
   procedência — fonte, data da consulta, espaçamento, raio, mediana da
   distância à via, e o erro quando falha; `activities.surface_mix` é a soma em
   metros por classe, desnormalizada de propósito: é a tabela que as telas
   agregadas já carregam.
4. **"Desconhecido" e "inferido" nunca são redistribuídos.** Aparecem como
   classe em toda soma e toda tela. A Strava somou 61% quando escondeu o "não
   especificado".

## Alternativas descartadas

- **Medir piso pelo sensor** (vibração, velocidade). Existe literatura
  (arXiv:1809.09745), mas o histórico não tem acelerômetro e o OSM já responde
  87% com tag explícita. Fica como validação futura do golden set.
- **Coluna gerada a partir de `points`.** O cálculo depende de uma API externa e
  de uma data; não é função do track.
- **Percentuais só, sem segmentos.** Perde a rota pintada e a possibilidade de
  editar um trecho à mão quando o golden set falhar — que é como o Wandrer
  resolve GPS ruim, depois de desistir do algoritmo.
- **Perseguir a tolerância "certa" do casamento.** Não é pública em nenhum
  concorrente; a referência do nicho resolveu com editor manual. Heurística
  simples + golden set + edição manual é o desenho honesto.

## Consequências

- O backfill das 137 rotas vem do cruzamento já feito em 05/09 (mesmas regras),
  gravado por SQL; o passe do cron só cuida do que chegar depois.
- Uma versão nova do OSM ou uma regra nova é um `version` novo em `surface_meta`
  e um recálculo seletivo, não uma reescrita cega.
- A visão global por período e por bicicleta (Fase 2) soma `surface_mix` sem
  carregar rota; o detalhe (Fase 3) lê `surface_segments` de uma rota só.
- Quando o pneu virar filho de `gear`, "km por piso por pneu" é uma soma sobre o
  que já está gravado.
