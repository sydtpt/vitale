-- Orbe — `visits.lon` vira `visits.lng`, para o schema ter um nome só de longitude.
--
-- A `20261002120000_presenca_fase1` criou `visits.lon`, herdando o nome do rascunho do
-- data-model. O resto do schema e do núcleo usa **`lng`**: `places.lng`,
-- `activities.points` (`{t, lat, lng, alt}`), e a assinatura de `haversineM(aLat, aLng,
-- bLat, bLng)` em `geo/distance.ts`.
--
-- Duas grafias para a mesma grandeza, na mesma feature, é o tipo de pedra que ninguém
-- vê até tropeçar — e o custo de tirá-la agora é zero: a tabela tem **zero linhas** e
-- nenhum código lê a coluna ainda. Em um mês custaria um backfill e um bug.

alter table public.visits rename column lon to lng;

comment on column public.visits.lng is
  'Longitude do centroide, para o CLVisit da fase 3. Grafia `lng` como no resto do schema.';
