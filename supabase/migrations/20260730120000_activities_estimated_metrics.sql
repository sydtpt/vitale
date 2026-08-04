-- Orbe — Calorias e zonas de FC estimadas em treinos sem sensor
--
-- Problema: treinos logados direto na Strava (ex.: yoga sem o relógio) chegam
-- ao app via HealthKit com `calories = 0` e `hr_zones` vazio. Eles ficam de
-- fora de tudo que soma kcal (visão geral, resumo por tipo, retrospectiva) e de
-- tudo que soma tempo em zona (carga semanal, recuperação/readiness).
--
-- Solução: quando a linha não tem NADA medido, preencher com o padrão do
-- próprio usuário para aquele tipo de treino:
--   • calorias  = mediana de kcal/min do tipo × duração da linha
--   • hr_zones  = forma média da distribuição de zonas do tipo × duração
-- Flags `calories_estimated` / `hr_zones_estimated` marcam o que é estimativa —
-- elas ficam FORA do cálculo do padrão (a estimativa nunca alimenta a si mesma)
-- e permitem à UI mostrar o valor como aproximado.
--
-- Onde roda: trigger na própria tabela, não no cliente. É o único ponto que
-- cobre os dois caminhos de escrita (RPC sync_upsert_activities do mobile e o
-- ingest das Conexões) e, principalmente, sobrevive ao re-sync: o upsert do
-- mobile reescreve `calories = 0` / `hr_zones = null` a cada tick e apagaria a
-- estimativa se ela fosse gravada só uma vez.
--
-- Quando NÃO estima (de propósito):
--   • linha com calorias medidas mas sem hr_zones → ambíguo: quase sempre é
--     linha antiga do relógio, anterior ao recurso de zonas, que recebe as
--     zonas REAIS ao re-sincronizar o tipo. Inventar zonas aí apagaria o dado
--     de verdade. Estimar zonas só quando a linha também não tem calorias
--     (= nada mediu esse treino).
--   • menos de 3 amostras reais do tipo → sem base, deixa vazio.
--   • duração 0 → nada para escalar.

-- ─────────────────────────────────────────────────────────────
-- Flags
-- ─────────────────────────────────────────────────────────────
alter table public.activities
  add column if not exists calories_estimated boolean not null default false,
  add column if not exists hr_zones_estimated boolean not null default false;

comment on column public.activities.calories_estimated is
  'true quando `calories` é estimativa (mediana de kcal/min do tipo × duração), não medida. Excluída do cálculo do padrão.';
comment on column public.activities.hr_zones_estimated is
  'true quando `hr_zones` é estimativa (forma média das zonas do tipo × duração), não derivada de amostras de FC. Excluída do cálculo do padrão.';

-- ─────────────────────────────────────────────────────────────
-- activity_metric_baseline — o "padrão" do usuário para um tipo de treino.
--
-- kcal_per_min: MEDIANA (não média) — uma leitura absurda do relógio (yoga de
-- 1 h com 1051 kcal, 27 kcal/min) puxaria a média e contaminaria todas as
-- estimativas; a mediana ignora.
-- zone_shape: fração média do tempo em cada zona. Normaliza cada treino pelo
-- SEU total antes de somar, então a forma não depende do total absoluto — que
-- em algumas linhas está inflado (amostras de FC duplicadas de vários apps).
-- Divide por `n` (todos os treinos), não pelos que têm aquela zona: uma z2 que
-- aparece em 1 de 40 treinos vale 1/40, não a média dela mesma.
-- Janela: 40 treinos mais recentes do tipo — acompanha a condição física atual
-- em vez de diluir com 2023.
-- ─────────────────────────────────────────────────────────────
create or replace function public.activity_metric_baseline(p_user uuid, p_activity_id int)
returns table (kcal_per_min numeric, cal_samples int, zone_shape jsonb, hr_samples int)
language sql stable security invoker as $$
  with cal as (
    select calories::numeric / (duration_s::numeric / 60) as kpm
    from public.activities
    where user_id = p_user
      and activity_id = p_activity_id
      and not coalesce(hidden, false)
      and not calories_estimated
      and calories > 0
      and duration_s >= 60
    order by start_at desc
    limit 40
  ),
  hr as (
    select hr_zones as z,
           (select sum(e.v::numeric) from jsonb_each_text(hr_zones) as e(k, v)) as tot
    from public.activities
    where user_id = p_user
      and activity_id = p_activity_id
      and not coalesce(hidden, false)
      and not hr_zones_estimated
      and jsonb_typeof(hr_zones) = 'object'
      and hr_zones <> '{}'::jsonb
    order by start_at desc
    limit 40
  ),
  hr_ok as (select z, tot from hr where tot > 0),
  shape as (
    select e.k as zone, sum(e.v::numeric / h.tot) / (select count(*) from hr_ok) as f
    from hr_ok h, jsonb_each_text(h.z) as e(k, v)
    group by e.k
  )
  select
    (select percentile_cont(0.5) within group (order by kpm) from cal),
    (select count(*)::int from cal),
    (select jsonb_object_agg(zone, f) from shape),
    (select count(*)::int from hr_ok);
$$;

comment on function public.activity_metric_baseline(uuid, int) is
  'Padrão do usuário por tipo de treino: mediana de kcal/min e forma média das zonas de FC, dos 40 treinos mais recentes com dado real (estimativas excluídas).';

-- ─────────────────────────────────────────────────────────────
-- Trigger: preenche o que chegou vazio.
--
-- Primeiro passo, sutil e essencial: DESCARTAR a estimativa que a própria linha
-- já carregava. Um merge do ingest (ou um update parcial) devolve no NEW o
-- valor estimado que estava gravado; sem descartá-lo, ele seria lido como
-- "medido", a flag cairia para false e a estimativa entraria no cálculo do
-- padrão como se fosse dado do relógio. Depois desse passo, o NEW só tem dado
-- medido ou vazio — e a decisão fica trivial.
-- ─────────────────────────────────────────────────────────────
create or replace function public.activities_estimate_missing()
returns trigger language plpgsql as $$
declare
  v_cal_measured boolean;
  v_hr_measured  boolean;
  v_kcal_min     numeric;
  v_cal_n        int;
  v_shape        jsonb;
  v_hr_n         int;
  v_zones        jsonb;
begin
  -- Descarta estimativa carregada do valor antigo (ver comentário acima).
  if tg_op = 'UPDATE' then
    if old.calories_estimated and new.calories = old.calories then
      new.calories := 0;
    end if;
    if old.hr_zones_estimated and new.hr_zones is not distinct from old.hr_zones then
      new.hr_zones := null;
    end if;
  end if;

  v_cal_measured := coalesce(new.calories, 0) > 0;
  v_hr_measured  := jsonb_typeof(new.hr_zones) = 'object' and new.hr_zones <> '{}'::jsonb;

  -- Nada a fazer quando os dois vieram medidos (caminho comum: treino com relógio).
  if v_cal_measured and v_hr_measured then
    new.calories_estimated := false;
    new.hr_zones_estimated := false;
    return new;
  end if;

  select b.kcal_per_min, b.cal_samples, b.zone_shape, b.hr_samples
    into v_kcal_min, v_cal_n, v_shape, v_hr_n
  from public.activity_metric_baseline(new.user_id, new.activity_id) b;

  -- Calorias: estima sempre que faltarem (ausência de kcal é sinal inequívoco
  -- de que nenhum sensor mediu este treino).
  if v_cal_measured then
    new.calories_estimated := false;
  elsif v_cal_n >= 3 and v_kcal_min is not null and coalesce(new.duration_s, 0) > 0 then
    new.calories := round(v_kcal_min * new.duration_s / 60.0)::int;
    new.calories_estimated := true;
  else
    new.calories := 0;
    new.calories_estimated := false;
  end if;

  -- Zonas: só em linha sem sensor nenhum (`not v_cal_measured`) — ver cabeçalho.
  if v_hr_measured then
    new.hr_zones_estimated := false;
  elsif not v_cal_measured and v_hr_n >= 3 and v_shape is not null and coalesce(new.duration_s, 0) > 0 then
    select jsonb_object_agg(t.k, t.s) into v_zones
    from (
      select e.k, round(e.v::numeric * new.duration_s)::int as s
      from jsonb_each_text(v_shape) as e(k, v)
    ) t
    where t.s > 0;
    new.hr_zones := v_zones;
    new.hr_zones_estimated := v_zones is not null;
  else
    new.hr_zones := null;
    new.hr_zones_estimated := false;
  end if;

  return new;
end $$;

drop trigger if exists activities_estimate on public.activities;
create trigger activities_estimate
  before insert or update on public.activities
  for each row execute function public.activities_estimate_missing();

-- ─────────────────────────────────────────────────────────────
-- Backfill do histórico (requisito 2).
-- O update é aparentemente nulo de propósito: quem preenche é o trigger, que
-- roda em qualquer UPDATE da linha. Toca só as linhas sem calorias — as demais
-- ou já têm tudo, ou são linhas do relógio aguardando as zonas reais do
-- re-sync (que o trigger não deve inventar).
-- ─────────────────────────────────────────────────────────────
update public.activities
  set calories = calories
  where coalesce(calories, 0) = 0;
