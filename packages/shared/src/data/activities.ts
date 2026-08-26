/**
 * Acesso às tabelas `activities` e `activity_routes` — dono único (AD-4).
 *
 * **Nunca leia `activity_routes` com `select('*')`.** A coluna `points` guarda o
 * track GPS inteiro; uma leitura assim chegou a 89 MB e 17,7 s, estourando o
 * `statement_timeout` de 8 s do role `authenticated`. Existe `route_overview`,
 * coluna gerada com 1 ponto a cada 40, justamente para as telas que só desenham
 * o traçado. Por isso as leituras aqui são todas por coluna nomeada, e não há
 * função que devolva a rota inteira em lote.
 *
 * O `SELECT` de `activities` inclui `source_id` e `device` — a web os omitia, e
 * a tela de detalhe tem uma linha "Dispositivo" que por isso nunca aparecia.
 * Uma coluna a menos no SELECT é uma feature morta sem aviso.
 *
 * Escrever atividade **não** passa por aqui: quem grava é a RPC
 * `sync_upsert_activities` do mobile e o ingest server-side, os dois caminhos
 * que o trigger de métricas estimadas cobre (ADR 0005). Daqui saem só as
 * edições do usuário e a manutenção de `has_route`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity, ActivityRoutePoint } from '../models';
import { fetchAllPages } from './paginate';

const ACTIVITY_COLUMNS =
  'id,user_id,activity_id,activity_name,calories,start_at,end_at,duration_s,moving_time_s,' +
  'distance_m,elevation_m,source_name,source_id,device,tracked,has_route,best_efforts,hr_zones,' +
  'calories_estimated,hr_zones_estimated,cities,locally_edited,edited_at,hidden';

export interface ActivityRow {
  id: string;
  user_id: string;
  activity_id: number;
  activity_name: string | null;
  calories: number | string | null;
  start_at: string;
  end_at: string | null;
  duration_s: number | string | null;
  moving_time_s: number | string | null;
  distance_m: number | string | null;
  elevation_m: number | string | null;
  source_name: string | null;
  source_id: string | null;
  device: string | null;
  tracked: boolean | null;
  has_route: boolean | null;
  best_efforts: Record<string, unknown> | null;
  hr_zones: Record<string, unknown> | null;
  calories_estimated: boolean | null;
  hr_zones_estimated: boolean | null;
  cities: unknown[] | null;
  locally_edited: boolean | null;
  edited_at: string | null;
  hidden: boolean | null;
}

const num = (v: number | string | null | undefined): number | undefined =>
  v == null ? undefined : Number(v);

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toActivity(r: ActivityRow): Activity {
  return {
    id: r.id,
    userId: r.user_id,
    activityId: r.activity_id,
    activityName: r.activity_name ?? '',
    calories: num(r.calories) ?? 0,
    startAt: r.start_at,
    endAt: r.end_at ?? '',
    durationS: num(r.duration_s) ?? 0,
    movingTimeS: num(r.moving_time_s) ?? 0,
    distanceM: num(r.distance_m),
    elevationM: num(r.elevation_m),
    sourceName: r.source_name ?? undefined,
    sourceId: r.source_id ?? undefined,
    device: r.device ?? undefined,
    tracked: r.tracked ?? undefined,
    hasRoute: r.has_route ?? false,
    bestEfforts: (r.best_efforts as Activity['bestEfforts']) ?? undefined,
    hrZones: (r.hr_zones as Activity['hrZones']) ?? undefined,
    caloriesEstimated: r.calories_estimated ?? undefined,
    hrZonesEstimated: r.hr_zones_estimated ?? undefined,
    cities: (r.cities as Activity['cities']) ?? undefined,
    locallyEdited: r.locally_edited ?? undefined,
    editedAt: r.edited_at ?? undefined,
    hidden: r.hidden ?? false,
  };
}

/**
 * Histórico completo do usuário, da mais recente para a mais antiga.
 *
 * Paginado: é o dataset que alimenta o Histórico inteiro (gráficos, totais,
 * listas por tipo), então o teto implícito de 1000 linhas do PostgREST cortaria
 * o histórico antigo em silêncio conforme ele cresce — ver `paginate.ts`. Como a
 * ordem é decrescente, o corte pouparia justamente o que se olha todo dia e
 * comeria os anos antigos: uma falha que só aparece anos depois, com sintoma
 * ("sumiu treino de 2023") apontando para a captura em vez da leitura.
 *
 * O desempate por `id` não é enfeite: a paginação exige ordenação ESTÁVEL, e
 * `start_at` empata de verdade aqui — o mesmo treino gravado no HealthKit por
 * mais de um app gera linhas com início idêntico (ADR 0004). Sem o desempate,
 * duas páginas podem repetir ou pular linhas.
 */
export async function fetchActivities(
  db: SupabaseClient,
  userId: string,
): Promise<Activity[]> {
  const data = await fetchAllPages<ActivityRow>((lo, hi) =>
    db
      .from('activities')
      .select(ACTIVITY_COLUMNS)
      .eq('user_id', userId)
      .order('start_at', { ascending: false })
      .order('id', { ascending: false })
      .range(lo, hi),
  );
  return data.map(toActivity);
}

/**
 * Edição do usuário. Cada campo editado marca a sua flag `*_edited`, que é o
 * que impede o sync de sobrescrever a correção no próximo tick.
 */
export async function updateActivityFields(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: { activityName?: string; durationS?: number },
): Promise<void> {
  const row: Record<string, unknown> = { locally_edited: true, edited_at: new Date().toISOString() };
  if (patch.activityName !== undefined) {
    row['activity_name'] = patch.activityName;
    row['name_edited'] = true;
  }
  if (patch.durationS !== undefined) {
    row['duration_s'] = patch.durationS;
    row['duration_edited'] = true;
  }
  const { error } = await db.from('activities').update(row).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Oculta ou reexibe uma atividade. Não apaga: o sync a traria de volta. */
export async function setActivityHidden(
  db: SupabaseClient,
  userId: string,
  id: string,
  hidden: boolean,
): Promise<void> {
  const { error } = await db.from('activities').update({ hidden }).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/** Ajusta `has_route` para refletir a existência real da rota. */
export async function setActivityHasRoute(
  db: SupabaseClient,
  userId: string,
  id: string,
  hasRoute: boolean,
): Promise<void> {
  const { error } = await db
    .from('activities')
    .update({ has_route: hasRoute })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Candidatas a backfill de rota: tipos com GPS, só do HealthKit, e ou com
 * `has_route` ligado (push que falhou — sem janela, drena o histórico) ou
 * recentes. Ver ADR 0007.
 *
 * O corte "só do HealthKit" é por `external_ids`, NÃO por `provider`: a linha
 * canônica que o ingest mergeou continua com `provider = 'healthkit'` e só
 * ganha `intervals`/`strava` em `external_ids` (ADR 0020). Filtrar por
 * `provider` deixava passar exatamente as atividades multi-fonte, cuja rota
 * vem do FIT e não deve ser trocada pela cópia da ponte.
 */
export async function fetchRouteBackfillCandidates(
  db: SupabaseClient,
  userId: string,
  gpsActivityIds: number[],
  cutoff: string,
): Promise<Array<{ id: string; hasRoute: boolean }>> {
  const { data, error } = await db
    .from('activities')
    .select('id, has_route, external_ids')
    .eq('user_id', userId)
    .in('activity_id', gpsActivityIds)
    .or('provider.is.null,provider.eq.healthkit')
    .or(`has_route.eq.true,start_at.gte.${cutoff}`);
  if (error) throw error;
  type Row = { id: string; has_route: boolean | null; external_ids: Record<string, unknown> | null };
  return ((data ?? []) as Row[])
    .filter((r) => !hasProviderLink(r.external_ids))
    .map((r) => ({ id: r.id, hasRoute: r.has_route ?? false }));
}

/** Provedores cujo dado vem do FIT e vence a cópia que a ponte deixa no HealthKit. */
const ROUTE_OWNING_PROVIDERS = ['strava', 'intervals'] as const;

/** A atividade está vinculada a um provider server-side? (ADR 0020) */
export function hasProviderLink(externalIds: Record<string, unknown> | null | undefined): boolean {
  if (!externalIds) return false;
  return ROUTE_OWNING_PROVIDERS.some((p) => externalIds[p] != null);
}

/** Pontos de UMA rota. A única leitura que traz `points` — nunca em lote. */
export async function fetchRoutePoints(
  db: SupabaseClient,
  userId: string,
  activityId: string,
): Promise<ActivityRoutePoint[] | null> {
  const { data, error } = await db
    .from('activity_routes')
    .select('points')
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .maybeSingle();
  if (error) throw error;
  const points = (data as { points?: ActivityRoutePoint[] } | null)?.points;
  return points ?? null;
}

/**
 * Traçados reduzidos de várias atividades. Usa `route_overview` (1 ponto a cada
 * 40), não `points` — é a diferença entre um mapa que carrega e um timeout.
 *
 * A coluna guarda pares `[lat, lng]`, não objetos: metade dos bytes, e a
 * conversão para `{lat,lng}` acontece aqui, uma vez, em vez de em cada tela.
 */
export async function fetchRouteOverviews(
  db: SupabaseClient,
  userId: string,
  activityIds: string[],
): Promise<Array<{ activityId: string; overview: ActivityRoutePoint[] }>> {
  const { data, error } = await db
    .from('activity_routes')
    .select('activity_id, route_overview')
    .eq('user_id', userId)
    .in('activity_id', activityIds);
  if (error) throw error;
  return ((data ?? []) as Array<{
    activity_id: string;
    route_overview: [number, number][] | null;
  }>).map((r) => ({
    activityId: r.activity_id,
    overview: (r.route_overview ?? [])
      .filter((pair) => Array.isArray(pair) && pair.length >= 2)
      .map(([lat, lng]) => ({ lat, lng })),
  }));
}

/** Quais destes ids já têm linha em `activity_routes`. Só a chave, nunca o track. */
export async function fetchExistingRouteIds(
  db: SupabaseClient,
  userId: string,
  activityIds: string[],
): Promise<Set<string>> {
  const CHUNK = 200; // limite conservador de itens por `in(...)`
  const found = new Set<string>();
  for (let i = 0; i < activityIds.length; i += CHUNK) {
    const { data, error } = await db
      .from('activity_routes')
      .select('activity_id')
      .eq('user_id', userId)
      .in('activity_id', activityIds.slice(i, i + CHUNK));
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ activity_id: string }>) found.add(r.activity_id);
  }
  return found;
}

/** Grava (ou substitui) a rota de uma atividade. */
export async function upsertActivityRoute(
  db: SupabaseClient,
  row: object,
): Promise<void> {
  const { error } = await db.from('activity_routes').upsert(row, { onConflict: 'activity_id' });
  if (error) throw error;
}
