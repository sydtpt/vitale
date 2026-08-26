-- Vitale — O re-sync não apaga métrica derivada quando a leitura falha
--
-- `elevation_m` e `best_efforts` são derivados do track. O track vem de
-- `fetchWorkoutRoute`, que tem timeout de 12 s e devolve LISTA VAZIA em vez de
-- erro (mobile/src/lib/healthkit-workouts.ts). Nesse caso o mobile empurra
-- `elevation_m: null` / `best_efforts: null`, e o upsert gravava os dois por
-- cima — um treino de 26 mil pontos que demorou a responder perdia a elevação
-- e os recordes, calado. Nada os reconstruía depois: o reparo de rota
-- (`retryMissingRoutes`) só age em linha SEM pontos persistidos.
--
-- Correção: null entrante significa "não consegui derivar", não "não existe".
-- Valor entrante não-nulo continua vencendo — é assim que o re-sync corrige um
-- número velho. Mesmo espírito do `has_route` no ADR 0020.
--
-- `hr_zones` e `calories` ficam FORA desta regra de propósito: quem cuida do
-- null deles é o trigger de métricas estimadas (20260730120000 / ADR 0005), que
-- foi desenhado justamente para sobreviver ao re-sync. Coalescer aqui brigaria
-- com ele.

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
    -- has_route só sobe (ADR 0020): fetch de rota que deu timeout devolve lista
    -- vazia, e isso não é prova de que a atividade não tem rota.
    has_route     = activities.has_route or excluded.has_route,
    metadata      = excluded.metadata,
    -- Derivados do track: null entrante = "não consegui derivar", preserva.
    best_efforts  = coalesce(excluded.best_efforts, activities.best_efforts),
    hr_zones      = excluded.hr_zones,
    -- Elevação medida pelo altímetro da fonte vence a estimativa do track
    -- (ADR 0019); e estimativa ausente não apaga a que já existe.
    elevation_m   = case
                      when coalesce(activities.external_ids ?| array['strava', 'intervals'], false)
                       and activities.elevation_m is not null
                      then activities.elevation_m
                      else coalesce(excluded.elevation_m, activities.elevation_m)
                    end;
  -- Sem WHERE: linhas editadas são atualizadas, exceto seus campos preservados.
  -- provider/external_id/external_ids ficam como estão (merge é do ingest).
$$;
