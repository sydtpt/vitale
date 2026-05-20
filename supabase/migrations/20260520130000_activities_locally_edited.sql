-- Vitale — Histórico de Treinos (web): edição manual + ocultar
-- Spec: .claude/specs/historico-treinos/
-- Permite editar atividades no web sem que o sync push-only as sobrescreva,
-- e preservar (ocultando) atividades editadas que foram apagadas no HealthKit.

-- ─────────────────────────────────────────────────────────────
-- Colunas de controle de edição manual
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists locally_edited boolean not null default false,
  add column if not exists edited_at      timestamptz,
  add column if not exists hidden         boolean not null default false;

comment on column public.activities.locally_edited is
  'true quando a web editou a linha; o sync deixa de sobrescrevê-la';
comment on column public.activities.hidden is
  'true quando uma linha editada foi apagada no HealthKit — preservada, mas fora de métricas/listas';

-- listar/filtrar rapidamente as travadas (no sync e na UI)
create index if not exists activities_user_edited_idx
  on public.activities (user_id, locally_edited);

-- leitura analítica exclui ocultas; índice parcial mantém o scan barato
create index if not exists activities_user_visible_idx
  on public.activities (user_id, start_at desc) where not hidden;

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — upsert do sync que NÃO sobrescreve linhas editadas
-- O mobile chama via supabase.rpc('sync_upsert_activities', { rows }).
-- security invoker → mantém o RLS do chamador (cada usuário só toca o que é seu).
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata'
  from jsonb_array_elements(rows) as r
  on conflict (id) do update set
    activity_id   = excluded.activity_id,
    activity_name = excluded.activity_name,
    calories      = excluded.calories,
    start_at      = excluded.start_at,
    end_at        = excluded.end_at,
    duration_s    = excluded.duration_s,
    distance_m    = excluded.distance_m,
    source_name   = excluded.source_name,
    source_id     = excluded.source_id,
    device        = excluded.device,
    tracked       = excluded.tracked,
    has_route     = excluded.has_route,
    metadata      = excluded.metadata
  where not activities.locally_edited;   -- não toca linhas editadas na web
$$;
