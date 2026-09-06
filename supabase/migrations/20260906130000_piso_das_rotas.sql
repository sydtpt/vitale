-- Orbe — Piso das rotas: o chão de cada pedalada, medido contra o OpenStreetMap.
-- ADR 0034 · tasks: _bmad-output/implementation-artifacts/piso-das-rotas/tasks.md
-- Pesquisa: _bmad-output/planning-artifacts/research/competitive-terreno-e-contexto-de-rota-no-ciclismo-2026-09-05
--
-- Três colunas, mesmo padrão de `activities.cities` (preenchidas por um passe
-- best-effort do ingest, NULL até serem calculadas):
--
--   activity_routes.surface_segments  [[início m, fim m, categoria, inferido], ...]
--                                     — o detalhe: pinta a rota e a barra da pedalada.
--   activity_routes.surface_meta      {version, source, sampledAt, spacingM, radiusM, ...}
--                                     — a PROCEDÊNCIA. A pesquisa mostrou que "piso errado"
--                                     é a queixa nº 1 e que a causa pode ser a versão do
--                                     mapa, não o OSM: sem saber de onde saiu cada trecho
--                                     não dá para recalcular quando a fonte mudar.
--   activities.surface_mix            {liso, blocos, pave, cascalho, terra, desconhecido,
--                                      inferido, total} em metros — o agregado que a
--                                     visão global soma sem carregar rota nenhuma.
--
-- "desconhecido" e "inferido" são classes de primeira ordem, nunca redistribuídas:
-- a Strava somou 61% quando escondeu o "não especificado" (Known Issue, nov/2024).
--
-- Por que não coluna gerada: o cálculo depende de uma API externa (Overpass) e
-- de uma data de consulta; não é função do `points`. O que É derivável do
-- `surface_segments` (o mix) fica desnormalizado em `activities` de propósito —
-- é a tabela que as telas agregadas já carregam, e a rota não.

alter table public.activity_routes
  add column if not exists surface_segments jsonb,
  add column if not exists surface_meta jsonb;

alter table public.activity_routes
  drop constraint if exists activity_routes_surface_segments_shape,
  add constraint activity_routes_surface_segments_shape
    check (surface_segments is null or jsonb_typeof(surface_segments) = 'array'),
  drop constraint if exists activity_routes_surface_meta_shape,
  add constraint activity_routes_surface_meta_shape
    check (surface_meta is null or jsonb_typeof(surface_meta) = 'object');

alter table public.activities
  add column if not exists surface_mix jsonb;

alter table public.activities
  drop constraint if exists activities_surface_mix_shape,
  add constraint activities_surface_mix_shape
    check (surface_mix is null or jsonb_typeof(surface_mix) = 'object');

comment on column public.activity_routes.surface_segments is
  'Piso por trecho [[startM,endM,cat,inferido],…] ao longo do route_overview; cat ∈ liso|blocos|pave|cascalho|terra|desconhecido. NULL = ainda não calculado.';
comment on column public.activity_routes.surface_meta is
  'Procedência do piso: {version,source,sampledAt,spacingM,radiusM,samples,lengthM,matchMedianM,status,error}. status=failed guarda o erro e adia a nova tentativa.';
comment on column public.activities.surface_mix is
  'Metros por categoria de piso {liso,blocos,pave,cascalho,terra,desconhecido,inferido,total}, desnormalizado de activity_routes.surface_segments para as somas por período/bike.';

-- O passe procura o que falta; sem o índice ele varre a tabela toda a cada tick.
create index if not exists activity_routes_surface_pending_idx
  on public.activity_routes (user_id)
  where surface_segments is null;
