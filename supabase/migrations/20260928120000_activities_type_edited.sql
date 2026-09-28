-- Orbe — O tipo da atividade também é um campo que o dono pode corrigir
--
-- O Apple Watch gravou 90 saídas a pé como "Caminhada ao ar livre" (id 52).
-- Sete delas são trilha (Bohan/Semois, Namur, Charleroi, Andenne, Dinant,
-- l'Eau d'Heure) e o Garmin, desde 27/09/2026, sabe disso sozinho — a primeira
-- atividade com id 24 do acervo chegou pela intervals.icu naquele dia.
-- Corrigir as sete no banco é uma linha de SQL. O problema é que ela não dura.
--
-- POR QUE ESTA MIGRATION EXISTE. A `sync_upsert_activities` gravava
-- `activity_id = excluded.activity_id` SEM CONDIÇÃO — o único campo do bloco
-- que não tinha guarda nenhuma. `activity_name` e `duration_s` já a tinham
-- desde 20260525120000 (edições por campo), e o motivo é idêntico: são coisas
-- que a fonte erra e o dono acerta. Sem a guarda, um toque em "sincronizar" na
-- tela Fitness dispara `syncType('Caminhada')`, que reempurra TODO o histórico
-- do tipo e desfaz a correção — sem erro, sem aviso, sem marca. A correção
-- sobreviveria só enquanto ninguém tocasse no botão.
--
-- A flag segue exatamente a forma das outras duas: default false, acesa pela
-- escrita do usuário (`updateActivityFields`), lida só no `on conflict`. Não
-- acende sozinha em linha nova do sync, e não bloqueia os demais campos —
-- distância, zonas de FC, best efforts e elevação continuam chegando na linha
-- corrigida, que é a lição da própria 20260525120000.
--
-- FORA DE ESCOPO, de propósito: o ingest (`insertNew` / `applyMerge` em
-- supabase/functions/_shared/ingest.ts) não precisa da guarda. O `applyMerge`
-- nunca escreve `activity_id` — conferido linha a linha — e o `insertNew` só
-- cria linha com id próprio (`<provider>:<externalId>`), que nunca colide com
-- o UUID do HealthKit. O único caminho que sobrescrevia o tipo é o daqui.
--
-- O backfill das sete NÃO está aqui. Estas são as sete atividades de UM
-- usuário, escolhidas por ele lendo as cidades gravadas em `cities` — não é
-- verdade de schema, é juízo sobre o acervo dele. Vive em
-- _bmad-output/implementation-artifacts/trilha-separada/backfill.sql.

-- ─────────────────────────────────────────────────────────────
-- A flag, no molde de name_edited / duration_edited
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists type_edited boolean not null default false;

comment on column public.activities.type_edited is
  'Tipo corrigido manualmente — o sync preserva activity_id nesta linha.';

-- ─────────────────────────────────────────────────────────────
-- sync_upsert_activities — só o `activity_id` muda; o resto do corpo é o
-- de 20260826160000_sync_nao_apaga_derivados.sql, copiado sem alteração.
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
    -- Campos editáveis: preserva o valor manual quando o campo foi editado.
    -- `activity_id` entrou nesta lista em 28/09/2026; era o único sem guarda.
    activity_id   = case when activities.type_edited then activities.activity_id else excluded.activity_id end,
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
