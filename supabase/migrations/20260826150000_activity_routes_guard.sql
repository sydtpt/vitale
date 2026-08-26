-- Vitale — A rota do provider não é sobreposta pela cópia do HealthKit
--
-- Cenário real (ADR 0020): a pedalada sai do Garmin, sobe para a Strava, e o app
-- da Strava a escreve no Apple Health. Em paralelo o MESMO treino chega ao
-- intervals.icu direto do Garmin, com o FIT inteiro. O ingest cria a linha
-- canônica a partir do intervals; o re-sync do mobile empurra a cópia do
-- HealthKit. Duas coisas podiam então derrubar o dado bom:
--
-- 1) `upsertActivityRoute` é um upsert sem condição em `activity_routes`
--    (onConflict activity_id): a rota pobre da ponte sobrescrevia a do FIT.
--    O filtro que devia evitar isso (`retryMissingRoutes`) testava
--    `provider = 'healthkit'` — e a linha canônica mergeada TEM
--    `provider = 'healthkit'`, com o intervals só em `external_ids`. Nunca pegou.
--
-- 2) `sync_upsert_activities` gravava `has_route = excluded.has_route`. Um
--    timeout de 12 s no `fetchWorkoutRoute` devolve `[]` (não erro), o sync
--    empurrava `has_route = false` e o mapa sumia da tela — com os pontos ainda
--    guardados, e sem nada que os reencontrasse: o reparo automático descarta
--    justamente as linhas que já têm rota persistida.
--
-- As duas guardas moram no banco de propósito: valem para qualquer cliente,
-- inclusive um build antigo do app que ainda esteja instalado no celular.

-- ─────────────────────────────────────────────────────────────
-- 1. Guarda de substituição de rota.
--
-- SECURITY INVOKER de propósito: a decisão depende de QUEM escreve. O ingest
-- usa a service role; o app usa `authenticated`. Numa SECURITY DEFINER,
-- `current_user` viraria o dono da função e a distinção se perderia.
--
-- Ignora silenciosamente (return null) em vez de erro: o app não tem o que
-- fazer com a falha, e transformá-la em exceção encheria a fila de sync de
-- itens que nunca vão passar.
-- ─────────────────────────────────────────────────────────────
create or replace function public.activity_routes_guard()
returns trigger language plpgsql as $$
declare
  privileged boolean := current_user in ('postgres', 'service_role', 'supabase_admin');
  has_provider boolean;
begin
  if not privileged then
    -- Sob RLS o usuário enxerga a própria linha; linha invisível ⇒ null ⇒
    -- falha aberta, que é o lado seguro para o dono do dado.
    select coalesce(a.external_ids ?| array['strava', 'intervals'], false)
      into has_provider
    from public.activities a
    where a.id = new.activity_id;

    -- Rota de atividade com provider é do ingest. A cópia que a ponte
    -- (app da Strava/Garmin Connect) deixa no HealthKit não a substitui.
    if coalesce(has_provider, false) then
      return null;
    end if;
  end if;

  -- Para todo o resto: rota mais pobre não substitui a mais rica. Mesma
  -- heurística que `planMerge` já usa (`attachRoute` exige mais pontos).
  -- Contagem igual passa — é o re-push idempotente do mesmo track.
  if new.point_count < old.point_count then
    return null;
  end if;

  return new;
end $$;

comment on function public.activity_routes_guard() is
  'Impede que uma rota mais pobre substitua uma mais rica, e que um cliente não-privilegiado substitua a rota de atividade com provider (ADR 0020). Só UPDATE: preencher rota ausente segue livre para qualquer um.';

drop trigger if exists activity_routes_no_downgrade on public.activity_routes;
create trigger activity_routes_no_downgrade
  before update on public.activity_routes
  for each row execute function public.activity_routes_guard();

-- ─────────────────────────────────────────────────────────────
-- 2. sync_upsert_activities — `has_route` não regride.
-- Base: a definição vigente (20260826140000, que preserva elevation_m).
-- Única diferença: o OR em has_route.
--
-- Seguro porque o único caminho que legitimamente marca false é
-- `setActivityHasRoute(..., false)` no `retryMissingRoutes`, e ele só faz isso
-- DEPOIS de confirmar que o HealthKit não tem a rota.
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_upsert_activities(rows jsonb)
returns void language sql security invoker as $$
  insert into public.activities (
    id, user_id, activity_id, activity_name, calories,
    start_at, end_at, duration_s, moving_time_s, distance_m, source_name,
    source_id, device, tracked, has_route, metadata, best_efforts, hr_zones,
    elevation_m, provider, external_id, external_ids
  )
  select
    r->>'id', (r->>'user_id')::uuid, (r->>'activity_id')::int, r->>'activity_name',
    coalesce((r->>'calories')::int, 0), (r->>'start_at')::timestamptz, (r->>'end_at')::timestamptz,
    coalesce((r->>'duration_s')::int, 0), nullif(r->>'moving_time_s', '')::int,
    nullif(r->>'distance_m', '')::numeric, r->>'source_name',
    r->>'source_id', r->>'device', (r->>'tracked')::boolean,
    coalesce((r->>'has_route')::boolean, false), r->'metadata', r->'best_efforts', r->'hr_zones',
    nullif(r->>'elevation_m', '')::numeric,
    coalesce(r->>'provider', 'healthkit'),
    coalesce(r->>'external_id', r->>'id'),
    jsonb_build_object(coalesce(r->>'provider', 'healthkit'), coalesce(r->>'external_id', r->>'id'))
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
    -- has_route só sobe (ADR 0020): um fetch de rota que deu timeout devolve
    -- lista vazia, e isso não é prova de que a atividade não tem rota.
    has_route     = activities.has_route or excluded.has_route,
    metadata      = excluded.metadata,
    best_efforts  = excluded.best_efforts,
    hr_zones      = excluded.hr_zones,
    -- Elevação medida pelo altímetro da fonte vence a estimativa do track
    -- (ADR 0019). Sem valor guardado, o cálculo do mobile entra normalmente.
    elevation_m   = case
                      when coalesce(activities.external_ids ?| array['strava', 'intervals'], false)
                       and activities.elevation_m is not null
                      then activities.elevation_m
                      else excluded.elevation_m
                    end;
  -- Sem WHERE: linhas editadas são atualizadas, exceto seus campos preservados.
  -- provider/external_id/external_ids ficam como estão (merge é do ingest).
$$;
