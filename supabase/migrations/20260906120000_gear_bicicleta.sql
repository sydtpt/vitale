-- Orbe — Bicicleta como ENTIDADE (gear), com herança por janela de datas.
-- ADR 0033 · tasks: _bmad-output/implementation-artifacts/piso-das-rotas/tasks.md
--
-- Por que existe: o histórico de ciclismo tem duas bicicletas e o banco não
-- sabia. Toda média "de todas as pedaladas" misturava uma bike aposentada com a
-- atual (87% pavimentado era a média das duas; a Nuroad sozinha é 81,5% liso e
-- 10,5% fora do asfalto). Decisão de pneu, comparação de velocidade e qualquer
-- corte "por bicicleta" precisam de uma entidade, não de um nome no metadata.
--
-- Por que janela de datas e não só `gear_id` por atividade: 148 pedaladas já
-- existem sem a informação, e cada pedalada nova precisaria de alguém que
-- escrevesse o vínculo (o HealthKit não tem essa noção; Strava/intervals têm,
-- mas o ingest ainda não lê). A regra "pedalada sem `gear_id` herda a bike
-- vigente na data" resolve o passado inteiro com duas linhas e o futuro sem
-- código novo. `activities.gear_id` fica como OVERRIDE explícito — para quando
-- o provider ou o usuário disserem outra coisa. A regra vive no cliente
-- (packages/shared/src/gear/assign.ts), única, e não numa view.
--
-- `kind` nasce com um valor só: o usuário pediu "só a bicicleta". O CHECK
-- documenta que o próximo (tênis, pneu como filho) é migration, não improviso.

-- ─────────────────────────────────────────────────────────────
-- gear
-- ─────────────────────────────────────────────────────────────
create table if not exists public.gear (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  kind           text        not null default 'bike',
  name           text        not null,
  active_from    date        not null,               -- primeiro dia em uso
  active_to      date,                               -- NULL = em uso hoje
  activity_types int[]       not null default '{13}', -- ids HealthKit que herdam este gear (13 = ciclismo)
  external_ids   jsonb,                              -- {strava: 'b123', intervals: '…'} — reservado; hoje ninguém escreve
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint gear_kind          check (kind in ('bike')),
  constraint gear_name_nonempty check (length(btrim(name)) > 0),
  constraint gear_window        check (active_to is null or active_to >= active_from),
  constraint gear_types_nonempty check (cardinality(activity_types) > 0),
  constraint gear_external_ids_shape check (external_ids is null or jsonb_typeof(external_ids) = 'object')
);

-- A herança percorre as bikes do usuário em ordem de vigência.
create index if not exists gear_user_active_from_idx
  on public.gear (user_id, active_from);

-- touch updated_at (função criada em migrations anteriores; idempotente)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists gear_touch on public.gear;
create trigger gear_touch
  before update on public.gear
  for each row execute function public.touch_updated_at();

alter table public.gear enable row level security;

drop policy if exists "own gear" on public.gear;
create policy "own gear" on public.gear
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- activities.gear_id — override explícito (NULL = herda pela data)
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists gear_id uuid references public.gear(id) on delete set null;

create index if not exists activities_user_gear_idx
  on public.activities (user_id, gear_id)
  where gear_id is not null;
