-- Orbe — Nome de rota em português, e o nome para toda atividade com GPS
-- Plano: _bmad-output/implementation-artifacts/nome-de-rota-em-portugues/plano.md
--
-- Duas mudanças que chegam juntas porque partilham os mesmos índices.
--
-- 1. DUAS COLUNAS para o nome em português, ao lado das de 07/09
--    (20260907170000_nome_das_rotas.sql). Não é tradução: as cidades chegam do
--    Nominatim com o nome LOCAL (Brugge, Mechelen, Gent) e é o modelo que traduz
--    o topônimo para a língua do nome — e as pontas nunca foram guardadas em
--    `route_name_meta`. Derivar o português do que está no banco devolveria
--    "De Brugge a Bredene". Por isso o pt é leitura própria, com motor próprio
--    (o quarto `RecursoId`), e não uma projeção do francês.
--
-- 2. OS ÍNDICES DE PENDENTES PERDEM O CRIVO DE BICICLETA. Medido em produção
--    hoje: 279 atividades com GPS — 141 de ciclismo (135 já nomeadas), 80
--    caminhadas e 58 corridas, ambas com zero. O `activity_id = 13` era o que
--    mantinha as 138 fora.
--
-- Conferido em produção ANTES desta migration, pela armadilha que a de 07/09
-- registrou: `sync_upsert_activities` tem 3.010 caracteres, ZERO ocorrências de
-- `route_name`, `route_name_meta` ou `route_name_pt`, e nenhum `*` — ela lista
-- coluna por coluna. Re-push do HealthKit não apaga nome derivado, nem o local
-- nem o português.

-- ─────────────────────────────────────────────────────────────
-- activities — o nome em português, ao lado do nome local.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists route_name_pt      text,
  add column if not exists route_name_pt_meta jsonb;

comment on column public.activities.route_name_pt is
  'Nome da rota em português, escrito por leitura PRÓPRIA (recurso `nome-de-rota-pt`), com motor que pode ser diferente do que escreve `route_name`. NULL = ainda não escrito OU deliberadamente sem nome. Legenda: quem manda na exibição é `route_name`.';

comment on column public.activities.route_name_pt_meta is
  'Auditoria da derivação em pt, mesmo molde de `route_name_meta`. É também a marca de "já tentei" desta língua: `precisaDeNome` olha uma meta por língua, então quem tem o nome local e não tem o português paga só a segunda chamada.';

-- ─────────────────────────────────────────────────────────────
-- Os cursores do passe, agora sobre TODA atividade com GPS.
--
-- O índice de 07/09 nasceu com `activity_id = 13`. Recriá-lo sem o crivo é o que
-- leva a decisão "toda atividade com GPS" até o banco — e `drop` + `create` em
-- vez de `create if not exists`, porque o Postgres pula o `if not exists` inteiro
-- quando o nome já existe e a definição antiga sobreviveria calada. É a mesma
-- lição que o `architecture.test.ts` cobra dos CHECKs de `user_preferences`.
-- ─────────────────────────────────────────────────────────────
drop index if exists public.activities_route_name_pending_idx;
create index activities_route_name_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name is null and has_route;

create index if not exists activities_route_name_pt_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name_pt is null and has_route;
