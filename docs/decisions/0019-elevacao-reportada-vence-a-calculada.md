# 0019 — Elevação reportada pela fonte vence a calculada do track

**Status:** aceita · precedência superada por [0021](0021-limiar-de-elevacao-sai-do-tipo-de-sinal.md)
**Data:** 2026-08-26

## Contexto

`activities.elevation_m` tinha duas origens que ninguém tinha comparado:

- **reportada** — `total_elevation_gain` de strava/intervals, que é o ganho integrado pelo
  altímetro barométrico do relógio/ciclocomputador durante a atividade;
- **calculada** — `elevationGainFromPoints` (shared) sobre a altitude do track GPS
  persistido, com suavização e histerese calibradas contra o EU-DEM 25 m (ADR 0006).

O ingest já preferia a reportada (`norm.elevationM ?? elevationGainFromPoints(...)`), mas
duas outras superfícies desfaziam isso:

1. As telas de detalhe do mobile ignoravam a coluna e **recalculavam do track na hora**.
   Para a corrida de 26/08/2026 a web mostrava 86 m e o mobile 46 m — o mesmo treino, o
   mesmo app, quase metade. Web, listas, Retrospectiva e `country-explorer` sempre leram a
   coluna; só o detalhe do mobile divergia.
2. `sync_upsert_activities` fazia `elevation_m = excluded.elevation_m` sem condição, então
   o próximo sync do mobile sobrescrevia com a estimativa um valor que veio do altímetro.

A comparação que faltava, feita sobre as 20 atividades que têm o número do Garmin **e** o
track guardado: **sobre track barométrico** (o que chega pela ponte Strava, ~5 s/ponto) o
cálculo reproduz a fonte dentro de ~5%; **sobre altitude de GNSS** (track do Apple Watch a
1 Hz) fica 25–49% abaixo, e nenhum par de parâmetros fecha essa distância — a altitude de
GNSS tem erro vertical de ±5–10 m e simplesmente não carrega o relevo na mesma forma.
Baixar o limiar para recuperar a subida real passa a somar ruído: no pedal de 124 km em
Bruxelas o mesmo track rende de 567 m a 1.840 m só variando limiar e janela.

Ou seja: ganho de elevação não é grandeza com valor único: depende da régua. O que a
comparação decide não é qual régua é "certa", é qual fonte tem o melhor sensor.

Um segundo defeito apareceu junto: a janela da média móvel era contada em **amostras**
(15), não em tempo. Os tracks vão de 1 Hz a 1 ponto/25 s, então as mesmas "15 amostras"
suavizavam 15 s num caso e 375 s no outro. As rotas esparsas perdiam todo o relevo —
quatro atividades antigas estavam gravadas com 0 m de subida.

## Decisão

**O ganho medido pelo altímetro da fonte é o valor canônico; o cálculo sobre o track é
estimativa de fallback, só usada quando não existe valor reportado.** Vale nas três
superfícies: ingest (já valia), telas do mobile (`resolveElevationM`) e
`sync_upsert_activities`, que agora preserva a elevação de linhas com provider.

`elevation_m` nulo continua significando "desconhecido" e **zero significa "plano
medido"** — por isso `resolveElevationM` não cai no cálculo quando a coluna vale 0.

A janela de suavização passa a ser de **15 segundos de tempo real**
(`ELEVATION_SMOOTH_SECONDS`), com fallback para 15 amostras em rota sem `t`
(`ELEVATION_SMOOTH_WINDOW` — ≈15 s a 1 Hz, o que preserva o valor histórico das rotas
antigas do Apple Watch). O limiar da histerese continua 3 m.

## Alternativas rejeitadas

**Recalibrar os parâmetros para o cálculo bater com o Garmin.** Foi tentado: grid search de
janela × limiar sobre as 20 atividades de referência. O melhor ponto global (sem
suavização, limiar 1,5 m) acerta as bikes dentro de 1–12% e continua errando as corridas em
25–49% — e, aplicado aos tracks de 1 Hz do Apple Watch, joga o pedal de 124 km de 865 m
para ~1.500 m, contra os ~800 m que o EU-DEM mede na mesma rota. Perdeu porque não existe
um par de parâmetros que sirva aos dois tipos de sinal: o problema é o sensor, não a régua.

**Deixar cada superfície com seu número.** É o estado que existia. Perdeu porque produzia
dois valores para o mesmo treino dentro do mesmo produto, sem nada na UI dizendo qual era
qual.

**Corrigir só as telas e não a função de sync.** Metade do defeito: o valor certo na tela
duraria até o próximo sync do mobile sobrescrever a coluna.

**Recalcular também as linhas com provider no backfill.** Perdeu porque destruiria
justamente o dado bom — são as únicas linhas cujo número veio de um barômetro.

## Consequências

- O backfill (migration `20260826140000`) recalculou só as linhas sem provider e mexeu em
  30 de 192 (soma total 35.336 m → 35.366 m). É correção de consistência, não revalorização
  do histórico: 161 das 172 linhas recalculadas são de 1 Hz, onde a janela de tempo é
  equivalente à de amostras.
- Os números agregados (Retrospectiva, `country-explorer`, `running-highlights`, CountryStats)
  já liam a coluna — foram corrigidos por consequência, sem mudança de código.
- **As atividades antigas, só do Apple Watch, seguem subestimadas em relação ao que um
  barômetro mediria.** Não há como recuperar: elas nunca tiveram valor reportado, e o track
  de GNSS não carrega a informação. As atividades novas, com Garmin, não têm esse problema.
- Ficou uma saída conhecida e não implementada: o Apple Watch **grava** o ganho barométrico
  em `HKElevationAscended`, presente em 160 atividades — mas o valor chega como JSON `null`,
  porque a ponte do react-native-health não serializa o `HKQuantity`. Extrair esse valor
  daria número de altímetro às atividades antigas também.
- Ao mudar os parâmetros do algoritmo, os três donos (`streams.ts`, `workout-types.ts` e a
  migration) precisam andar juntos, e o histórico exige migration nova no padrão
  create → backfill → drop do [ADR 0006](0006-backfill-de-elevacao-por-migration-transiente.md).
