# 0021 — O limiar de elevação sai do tipo de sinal, e o cálculo é canônico

**Status:** aceita · supersede a precedência do [0019](0019-elevacao-reportada-vence-a-calculada.md)
**Data:** 2026-08-27

## Contexto

O [ADR 0019](0019-elevacao-reportada-vence-a-calculada.md) adotou o
`total_elevation_gain` de strava/intervals como valor canônico, partindo de que ele era o
ganho integrado pelo altímetro da fonte. A premissa não sobreviveu ao primeiro confronto
com o Garmin Connect:

| Atividade | Garmin | Strava | intervals.icu | Nosso cálculo (15 s / 3 m) |
|---|---|---|---|---|
| Corrida 26/08, 11 km | 58 m | 58 m | **85,5 m** | 46 m |
| Corrida 21/08, 21,5 km | 103 m | — | **189 m** | 76 m |

O intervals.icu **recalcula** o ganho, não repassa o do dispositivo — e infla corrida de
1,5× a 1,8×. Em ciclismo ele acerta (confirmado em duas pedaladas contra o Garmin). A
hipótese para o padrão é a oscilação vertical da passada, que o barômetro no pulso capta a
cada passo e o Garmin filtra; não dá para provar daqui, mas explica por que só corrida.

Que 85,5 não vinha de altímetro nenhum era demonstrável sem sair do banco: varrendo toda a
grade de parâmetros sobre a série de altitude guardada dessa corrida, o **máximo alcançável
é 68,6 m**, e a soma bruta de todas as subidas sem filtro nenhum dá 124 m. O número não é
derivável do dado — só podia ter vindo pronto.

A medição que sustentava o 0019 ("a estimativa fica ~45% abaixo do barômetro") usava o
intervals como referência. Com a referência certa, o buraco era outro problema: **o limiar
único de 3 m**, calibrado num pedal do Apple Watch, aplicado também a séries barométricas
onde ele come subida real.

## Decisão

**O cálculo sobre o track é o valor canônico.** O `total_elevation_gain` da fonte vira
reserva, usado só quando o track não tem altitude.

**O limiar da histerese sai do TIPO DE SINAL da série, não do tipo de atividade nem da
fonte:**

| Sinal | Limiar | Referência | Erro |
|---|---|---|---|
| Altitude de FIT | **0,7 m** | Garmin 58 e 103 | 1% (2/2); mediana 5% em 11 pedaladas |
| Altitude de GNSS (`CLLocation`) | **3 m** | Strava 894 m (pedal de 124 km, 05/07) | −4% |

O discriminador é auto-descritivo: o formato FIT guarda altitude em unidades de **1/5 m**,
então todo valor é múltiplo de 0,2 — o que a altitude de `CLLocation` (float arbitrário)
nunca é. Não depende de saber quem gravou, nem de estado externo, nem da era da atividade.
Séries de amplitude ~0 ficam fora do teste: fonte que grava 0 em vez de omitir a altitude
passaria trivialmente.

Ler o sinal em vez da procedência é o que faz o critério acertar um caso que a procedência
erraria: 20 rotas antigas cujo `activities.source_name` diz "Apple Watch" foram importadas
do export em massa da Strava ([ADR 0007](0007-backfill-de-rotas-e-mapas.md)) — o GPS estava
no ciclocomputador e o Watch só gravou FC. O track delas é barométrico e recebe 0,7 m,
enquanto um pedal gravado de fato pelo Watch, no mesmo `source_name`, recebe 3 m.

## Alternativas rejeitadas

**Manter "reportado vence" e só trocar a fonte reportada** (preferir Strava, que concorda
com o Garmin). Resolveria o número mas manteria a dependência de um terceiro que pode mudar
de algoritmo sem aviso — foi exatamente o que aconteceu com o intervals. E deixaria as
atividades sem provider (a maioria do histórico) com outro critério.

**Limiar único recalibrado.** Não existe: 0,7 m reproduz o Garmin no FIT e infla o track do
Apple Watch em 30% (1.158 m contra os 894 m da Strava); 3 m acerta o Apple Watch e engole
metade da subida no FIT. Duas classes de sinal, dois limiares.

**Discriminar por `source_name` / presença de provider.** Mais simples de ler, e errado nos
20 casos do backfill da Strava acima — a procedência da LINHA não diz qual é a procedência
do TRACK.

**Detectar pelo ruído da série.** Testado: o p90 do |Δaltitude| do track de GNSS (0,60 m) é
até menor que o do FIT (0,80 m). Ruído não separa as classes; quantização separa.

## Consequências

- O backfill (`20260827120000`) recalculou 40 de 192 linhas; soma total 35.366 → 35.799 m
  (+1,2%). As corridas com provider caíram ~45% (saiu a inflação do intervals); as rotas
  vindas do export da Strava subiram 14–29% (entrou o limiar barométrico); o pedal de
  124 km do Apple Watch não mudou.
- A migration passou a usar `double precision` em vez de `numeric`. Com limiar de 0,7 m há
  centenas de eventos de histerese, e a diferença de arredondamento entre o decimal exato do
  Postgres e o IEEE754 do JS movia a âncora e propagava: a mesma rota rendia 379,912 no SQL
  e 384,912 no TypeScript. Os três donos do algoritmo só são espelhos se a aritmética for a
  mesma.
- `resolveElevationM` continua preferindo a coluna ao cálculo local, mas por outro motivo: a
  coluna agora é o MESMO cálculo, feito no ingest ou no sync. A regra existe para a tela não
  discordar da web e da retrospectiva, não porque a coluna venha de um sensor melhor.
- A preservação de `elevation_m` em linhas de provider no `sync_upsert_activities` (do
  0019) fica de pé, com propósito novo: impedir que a cópia da ponte, cujo track é mais
  pobre, sobrescreva o número que o ingest calculou do stream completo.
- **Resíduo conhecido: as 20 rotas vindas do export em massa da Strava leem ~15% abaixo do
  que a Strava mostra.** Medido no pedal de 91 km de 19/07/2025: 807 m aqui contra 947 m
  lá (era 669 m antes desta ADR, então melhorou). Não é erro de calibração — o limiar mal
  move esse número: baixá-lo de 0,7 para 0,3 m recupera só 5 pontos percentuais e, de
  quebra, joga as duas referências do Garmin de 1% para +5% e +10%. O que falta está no
  stream, não no parâmetro: a rota veio do export já reamostrada, enquanto o número da
  Strava sai do dado original do ciclocomputador. Quem quiser fechar esses 15% não deve
  mexer no algoritmo — deve importar o ganho do próprio export, one-off, no formato do
  [ADR 0007](0007-backfill-de-rotas-e-mapas.md).
- O argumento a favor de destravar o `HKElevationAscended` (0019) perde força: ele foi
  dimensionado contra a referência inflada do intervals. Com a referência certa, o cálculo
  já acerta as duas classes de sinal, e o valor de ter o número do altímetro do Apple Watch
  cai para "conferência", não "correção".
