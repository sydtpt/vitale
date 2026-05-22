-- Vitale — Edições manuais por campo (em vez de congelar a linha inteira)
-- Spec: .claude/specs/sync-atividades/ · historico-treinos/
--
-- Antes: qualquer edição marcava `locally_edited` e o sync PULAVA a linha por
-- completo — renomear uma corrida impedia o sync de atualizar tempo em
-- movimento, distância, best efforts, zonas de FC, etc.
--
-- Agora: rastreamos QUAL campo foi editado (`name_edited`, `duration_edited`).
-- O sync volta a atualizar a linha, apenas PRESERVANDO os campos que o usuário
-- editou. `locally_edited` segue existindo só para o selo "editado" na UI.

-- ─────────────────────────────────────────────────────────────
-- Flags por campo. Default false; em novas linhas do sync ficam false.
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists name_edited boolean not null default false,
  add column if not exists duration_edited boolean not null default false;

comment on column public.activities.name_edited is
  'Nome editado manualmente — o sync preserva activity_name nesta linha.';
comment on column public.activities.duration_edited is
  'Duração editada manualmente — o sync preserva duration_s nesta linha.';

-- Backfill: linhas já editadas não dizem QUAL campo foi alterado, então
-- preservamos ambos (conservador). A partir daqui o rastreio é por campo, e
-- estas linhas voltam a receber os demais campos do sync (ex.: moving_time_s).
update public.activities
  set name_edited = true, duration_edited = true
  where locally_edited;

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — recriada: sem o filtro que pulava a linha inteira.
-- Atualiza tudo, mas preserva os campos com flag de edição manual.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts, hr_zones
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts', r->'hr_zones'
  from jsonb_array_elements(rows) as r
  on conflict (id) do update set
    activity_id   = excluded.activity_id,
    -- Campos editáveis: preserva o valor manual quando o campo foi editado.
    activity_name = case when activities.name_edited then activities.activity_name else excluded.activity_name end,
    duration_s    = case when activities.duration_edited then activities.duration_s else excluded.duration_s end,
    calories      = excluded.calories,
    start_at      = excluded.start_at,
    end_at        = excluded.end_at,
    moving_time_s = excluded.moving_time_s,
    distance_m    = excluded.distance_m,
    source_name   = excluded.source_name,
    source_id     = excluded.source_id,
    device        = excluded.device,
    tracked       = excluded.tracked,
    has_route     = excluded.has_route,
    metadata      = excluded.metadata,
    best_efforts  = excluded.best_efforts,
    hr_zones      = excluded.hr_zones;
  -- Sem WHERE: linhas editadas são atualizadas, exceto seus campos preservados.
$$;
