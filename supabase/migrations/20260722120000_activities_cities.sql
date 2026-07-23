-- Orbe — Cidades atravessadas pela rota (bike)
-- Spec: .claude/specs/geo-enrichment / share (cartão de exportação)
-- Persiste a lista ordenada de cidades por onde a rota passou, derivada por
-- reverse-geocoding do track GPS no ingest (hoje só ciclismo, activity_id=13).
-- Reusada no cartão de compartilhamento e em reports futuros.

-- ─────────────────────────────────────────────────────────────
-- Coluna de cidades (jsonb). Array ordenado ao longo do percurso, ex.:
--   [{ "name": "São Paulo", "state": "SP", "country": "Brasil",
--      "lat": -23.55, "lng": -46.63 }, ...]
-- Null = ainda não enriquecida (o passe enrich-cities do ingest preenche ao
-- longo dos ticks); [] = enriquecida mas nenhuma cidade resolvida.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists cities jsonb;

comment on column public.activities.cities is
  'Cidades atravessadas pela rota, ordenadas: [{name,state,country,lat,lng}]. Preenchido pelo enrich-cities no ingest (bike). Null=pendente, []=nenhuma.';

-- Nota: a RPC sync_upsert_activities (push do HealthKit) NÃO referencia esta
-- coluna, então re-pushes não sobrescrevem `cities` — ela é escrita apenas pelo
-- UPDATE server-side do passe de enriquecimento. Nada a recriar aqui.
