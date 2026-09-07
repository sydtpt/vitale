-- Orbe — Nome das rotas (ADR 0041)
-- Spec: docs/specs/nome-das-rotas/spec.md · data-model: .../data-model.md
--
-- Uma tabela nova (`places`) e DUAS colunas em `activities`. `activity_name` não
-- é tocado, de propósito: quem escreve nele é o sync, a cada sincronização, pela
-- regra `setName` do dedupe. O nome derivado mora ao lado, nunca por cima.
--
-- Conferido em produção antes desta migration: `sync_upsert_activities` não
-- referencia nenhuma das duas colunas novas — nem na inserção nem no
-- `do update set` —, então re-push do HealthKit não apaga o nome derivado. É a
-- mesma nota que a migration de `cities` (20260722120000) deixou registrada.

-- ─────────────────────────────────────────────────────────────
-- places — lugares do usuário, com vigência.
--
-- Molde idêntico ao `gear` (ADR 0034): `active_from` / `active_to`, janela
-- conferida por check, índice por vigência. Mesma razão, também: a Casa não é
-- constante. O dado provou — o cluster de partida/chegada mudou de
-- `50.852, 4.344` para `50.872, 4.373` em junho de 2026, ~3 km, sem um único
-- mês de sobreposição.
--
-- `kind` nasce com um valor só e um check, como o `gear.kind`: documenta que o
-- próximo tipo (trabalho, casa de férias) é migration, não improviso.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.places (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  kind         text        not null default 'home',
  label        text,                                   -- "Casa"; NULL = ainda sem nome
  lat          numeric     not null,
  lng          numeric     not null,
  radius_m     int         not null default 400,       -- raio de pertencimento
  active_from  date        not null,                   -- primeiro dia de vigência
  active_to    date,                                   -- NULL = vigente hoje
  derived      boolean     not null default true,      -- false = o dono corrigiu à mão
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint places_kind   check (kind in ('home')),
  constraint places_window check (active_to is null or active_to >= active_from),
  constraint places_radius check (radius_m between 50 and 5000),
  constraint places_lat    check (lat between -90 and 90),
  constraint places_lng    check (lng between -180 and 180)
);

comment on table public.places is
  'Lugares do usuário com vigência (ADR 0041). Preenchida por derivação dos extremos das rotas, não por formulário; `derived=false` marca correção manual.';
comment on column public.places.radius_m is
  'Raio de pertencimento. 400 m é folgado de propósito: o GPS do relógio espalha a mesma porta por várias células de 110 m.';

-- A herança percorre os lugares do usuário em ordem de vigência.
create index if not exists places_user_active_from_idx
  on public.places (user_id, kind, active_from);

-- touch updated_at (função criada em migrations anteriores; idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists places_touch on public.places;
create trigger places_touch
  before update on public.places
  for each row execute function public.touch_updated_at();

alter table public.places enable row level security;

drop policy if exists "own places" on public.places;
create policy "own places" on public.places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- activities — o nome derivado, ao lado do nome da fonte.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists route_name      text,
  add column if not exists route_name_meta jsonb;

comment on column public.activities.route_name is
  'Nome derivado da rota (ADR 0041). NULL = ainda não nomeada OU deliberadamente sem nome (rota degenerada, conferência reprovada). Nunca sobrescreve activity_name.';

comment on column public.activities.route_name_meta is
  'Auditoria da derivação: {forma, regiao, artigo, lingua, justificativa[], provedor, modelo, versao_prompt, tokens, em}. Permite rerodar só o que ficou para trás quando a versão do prompt sobe. Meta preenchida com regiao null = recusa registrada.';

-- Cursor do passe: só as linhas que ele ainda tem que visitar entram no índice.
-- Mesmo molde do que o enrich-cities usa. 13 = ciclismo (HealthKit).
create index if not exists activities_route_name_pending_idx
  on public.activities (user_id, start_at desc)
  where route_name is null and has_route and activity_id = 13;
