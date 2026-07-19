/**
 * Ingestão de treinos de provedores externos (Strava, intervals.icu) com
 * dedupe/merge cross-source — o mesmo treino físico chegando por HealthKit,
 * Strava e intervals.icu vira UMA linha canônica em `activities`.
 *
 * Fluxo por (usuário, provedor):
 *   1. janela = [cursor − 24h, agora] (primeira vez: últimos 90 dias)
 *   2. lista atividades ascendentes, cap de 30 por run (backfill espalha
 *      entre ticks do cron; rate limit da Strava fica com folga)
 *   3. para cada treino: dedupe (passos 0–4 do kernel) → insert ou merge
 *   4. varredura de reconciliação dos últimos 7 dias (pares que escaparam,
 *      ex.: treino do Apple Watch que também subiu para a Strava)
 *   5. cursor avança só com o run inteiro OK
 *
 * Todas as queries filtram `user_id` explicitamente — o client é service role
 * (ignora RLS).
 */
import type { Admin } from './admin.ts';
import {
  findMatch,
  planMerge,
  isSameWorkout,
  MATCH_CANDIDATE_WINDOW_HOURS,
  type MergeIncoming,
  type MergeTarget,
} from '../../../packages/shared/src/fitness/dedupe.ts';
import {
  movingTimeFromPoints,
  elevationGainFromPoints,
  computeBestEffortsFromPoints,
  computeHrZonesFromSamples,
  type FitnessHrZoneParams,
} from '../../../packages/shared/src/fitness/streams.ts';
import type { NormalizedActivity } from './normalize.ts';
import { AuthError } from './providers/errors.ts';
import {
  fetchIntervalsActivities,
  intervalsStartMs,
  normalizeIntervalsActivity,
} from './providers/intervals.ts';
import {
  fetchStravaActivities,
  normalizeStravaActivity,
  refreshStravaToken,
  stravaStartMs,
} from './providers/strava.ts';

/** Máximo de treinos processados por run — o backfill continua no próximo tick. */
export const MAX_ACTIVITIES_PER_RUN = 30;
/** Janela do primeiro import (o histórico antigo já está no HealthKit). */
export const INITIAL_IMPORT_DAYS = 90;
/** Releitura sobreposta a partir do cursor (uploads atrasados da fonte). */
const CURSOR_REWIND_H = 24;
/** Janela da varredura de reconciliação. */
const SWEEP_DAYS = 7;

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;

export interface IngestSummary {
  userId: string;
  provider: string;
  inserted: number;
  merged: number;
  skipped: number;
  swept: number;
  error?: string;
}

/* ───────────────────── Linhas do banco ───────────────────── */

const ACTIVITY_SELECT =
  'id,activity_id,activity_name,calories,start_at,end_at,duration_s,moving_time_s,' +
  'distance_m,elevation_m,source_id,source_name,device,has_route,best_efforts,hr_zones,' +
  'metadata,provider,external_id,external_ids,name_edited,duration_edited,hidden,created_at';

interface ActivityRow {
  id: string;
  activity_id: number;
  activity_name: string | null;
  calories: number | null;
  start_at: string;
  end_at: string;
  duration_s: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  source_id: string | null;
  source_name: string | null;
  device: string | null;
  has_route: boolean | null;
  best_efforts: Record<string, number> | null;
  hr_zones: Record<string, number> | null;
  metadata: Record<string, unknown> | null;
  provider: string | null;
  external_id: string | null;
  external_ids: Record<string, string> | null;
  name_edited: boolean | null;
  duration_edited: boolean | null;
  hidden: boolean | null;
  created_at: string;
}

function rowToTarget(row: ActivityRow, routePointCount: number): MergeTarget {
  return {
    id: row.id,
    activityId: row.activity_id,
    startAt: row.start_at,
    endAt: row.end_at,
    provider: row.provider,
    sourceId: row.source_id,
    sourceName: row.source_name,
    routePointCount,
    hasHrData: row.hr_zones != null && Object.keys(row.hr_zones).length > 0,
    distanceM: row.distance_m,
    nameEdited: row.name_edited ?? false,
    durationEdited: row.duration_edited ?? false,
  };
}

function normToIncoming(norm: NormalizedActivity): MergeIncoming {
  return {
    provider: norm.provider,
    externalId: norm.externalId,
    activityId: norm.activityId,
    activityName: norm.activityName,
    startAt: norm.startAt,
    endAt: norm.endAt,
    routePointCount: norm.points.length,
    hasHrData: norm.hrSamples.length > 1,
    distanceM: norm.distanceM,
  };
}

/** point_count das rotas persistidas dos ids dados (0 quando sem rota). */
async function fetchRoutePointCounts(
  admin: Admin,
  userId: string,
  ids: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const { data } = await admin
    .from('activity_routes')
    .select('activity_id,point_count')
    .eq('user_id', userId)
    .in('activity_id', ids);
  for (const r of data ?? []) counts.set(r.activity_id as string, (r.point_count as number) ?? 0);
  return counts;
}

/* ───────────────────── Métricas derivadas ───────────────────── */

interface DerivedMetrics {
  movingTimeS?: number;
  elevationM?: number;
  bestEfforts?: Record<string, number>;
  hrZones?: Record<string, number>;
}

function deriveMetrics(norm: NormalizedActivity, hrParams: FitnessHrZoneParams): DerivedMetrics {
  // moving_time da fonte (Garmin calcula bem) > derivado do track > nada.
  const movingTimeS = norm.movingTimeS ?? movingTimeFromPoints(norm.points);
  // Elevação: valor da fonte (bate com o que Strava/intervals mostram) > derivado do track.
  const elevationM = norm.elevationM ?? elevationGainFromPoints(norm.points);
  const bestEfforts =
    norm.activityId === 37 && norm.points.length > 1
      ? computeBestEffortsFromPoints(norm.points)
      : {};
  const hrZones = computeHrZonesFromSamples(norm.hrSamples, hrParams);
  return {
    movingTimeS,
    elevationM,
    bestEfforts: Object.keys(bestEfforts).length > 0 ? bestEfforts : undefined,
    hrZones: Object.keys(hrZones).length > 0 ? hrZones : undefined,
  };
}

/** FCmáx do vínculo (athlete_meta) e FCrep da última medição em health_daily. */
async function loadHrParams(
  admin: Admin,
  userId: string,
  athleteMeta: Record<string, unknown> | null,
): Promise<FitnessHrZoneParams> {
  const metaMax = athleteMeta?.['max_hr'];
  const maxHr = typeof metaMax === 'number' && metaMax > 100 && metaMax < 230 ? metaMax : 190;
  const metaRest = athleteMeta?.['resting_hr'];
  let restHr = typeof metaRest === 'number' && metaRest > 20 && metaRest < 120 ? metaRest : undefined;
  if (restHr === undefined) {
    const { data } = await admin
      .from('health_daily')
      .select('value')
      .eq('user_id', userId)
      .eq('metric', 'fcRepouso')
      .order('day', { ascending: false })
      .limit(1);
    const v = data?.[0]?.value;
    if (typeof v === 'number' && v > 20 && v < 120) restHr = v;
  }
  return { maxHr, restHr };
}

/* ───────────────────── Insert / merge de um treino ───────────────────── */

async function upsertRoute(
  admin: Admin,
  userId: string,
  activityId: string,
  points: NormalizedActivity['points'],
): Promise<void> {
  const { error } = await admin.from('activity_routes').upsert(
    { activity_id: activityId, user_id: userId, points, point_count: points.length },
    { onConflict: 'activity_id' },
  );
  if (error) throw new Error(`activity_routes upsert falhou: ${error.message}`);
}

async function insertNew(
  admin: Admin,
  userId: string,
  norm: NormalizedActivity,
  hrParams: FitnessHrZoneParams,
): Promise<void> {
  const m = deriveMetrics(norm, hrParams);
  const id = `${norm.provider}:${norm.externalId}`;
  const { error } = await admin.from('activities').upsert(
    {
      id,
      user_id: userId,
      activity_id: norm.activityId,
      activity_name: norm.activityName ?? null,
      calories: norm.calories ?? 0,
      start_at: norm.startAt,
      end_at: norm.endAt,
      duration_s: norm.durationS,
      moving_time_s: m.movingTimeS ?? null,
      distance_m: norm.distanceM ?? null,
      elevation_m: m.elevationM ?? null,
      source_name: norm.provider === 'strava' ? 'Strava' : 'intervals.icu',
      source_id: norm.provider,
      device: norm.device ?? null,
      tracked: true,
      has_route: norm.points.length > 0,
      metadata: { providers: { [norm.provider]: { id: norm.externalId } } },
      best_efforts: m.bestEfforts ?? null,
      hr_zones: m.hrZones ?? null,
      provider: norm.provider,
      external_id: norm.externalId,
      external_ids: { [norm.provider]: norm.externalId },
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`activities insert falhou: ${error.message}`);
  if (norm.points.length > 0) await upsertRoute(admin, userId, id, norm.points);
}

async function applyMerge(
  admin: Admin,
  userId: string,
  norm: NormalizedActivity,
  target: ActivityRow,
  targetRoutePoints: number,
  hrParams: FitnessHrZoneParams,
): Promise<void> {
  const plan = planMerge(normToIncoming(norm), rowToTarget(target, targetRoutePoints));
  const patch: Record<string, unknown> = {
    external_ids: { ...(target.external_ids ?? {}), [norm.provider]: norm.externalId },
  };

  if (plan.incomingRicher) {
    const m = deriveMetrics(norm, hrParams);
    if (norm.distanceM != null) patch.distance_m = norm.distanceM;
    if (m.movingTimeS != null) patch.moving_time_s = m.movingTimeS;
    if (m.elevationM != null) patch.elevation_m = m.elevationM;
    if (m.bestEfforts) patch.best_efforts = m.bestEfforts;
    if (m.hrZones) patch.hr_zones = m.hrZones;
    if (norm.calories && norm.calories > 0) patch.calories = norm.calories;
    if (norm.device) patch.device = norm.device;
    const providers = {
      ...((target.metadata?.['providers'] as Record<string, unknown>) ?? {}),
      [norm.provider]: { id: norm.externalId },
    };
    patch.metadata = { ...(target.metadata ?? {}), providers };
  }
  if (plan.setName) patch.activity_name = norm.activityName;
  if (plan.setDuration) patch.duration_s = norm.durationS;
  if (plan.overwriteTimes) {
    patch.start_at = norm.startAt;
    patch.end_at = norm.endAt;
  }
  if (plan.attachRoute && norm.points.length > 0) {
    await upsertRoute(admin, userId, target.id, norm.points);
    patch.has_route = true;
  }

  const { error } = await admin
    .from('activities')
    .update(patch)
    .eq('id', target.id)
    .eq('user_id', userId);
  if (error) throw new Error(`activities merge falhou: ${error.message}`);
}

/**
 * Passos 0–4 do dedupe para um treino normalizado.
 * Retorna o que aconteceu (métrica do run).
 */
async function ingestOne(
  admin: Admin,
  userId: string,
  norm: NormalizedActivity,
  hrParams: FitnessHrZoneParams,
): Promise<'inserted' | 'merged' | 'refreshed'> {
  // Passo 0 — idempotência: esta fonte já foi persistida/mesclada?
  const { data: bySource } = await admin
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('user_id', userId)
    .eq('provider', norm.provider)
    .eq('external_id', norm.externalId)
    .maybeSingle();
  let linked = bySource as ActivityRow | null;
  if (!linked) {
    const { data: byMerged } = await admin
      .from('activities')
      .select(ACTIVITY_SELECT)
      .eq('user_id', userId)
      .contains('external_ids', { [norm.provider]: norm.externalId })
      .limit(1);
    linked = (byMerged?.[0] as ActivityRow) ?? null;
  }
  if (linked) {
    const counts = await fetchRoutePointCounts(admin, userId, linked.has_route ? [linked.id] : []);
    await applyMerge(admin, userId, norm, linked, counts.get(linked.id) ?? 0, hrParams);
    return 'refreshed';
  }

  // Passo 1 — candidatos na janela ±6h.
  const startMs = Date.parse(norm.startAt);
  const windowMs = MATCH_CANDIDATE_WINDOW_HOURS * HOUR_MS;
  const { data: cands } = await admin
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('user_id', userId)
    .gte('start_at', new Date(startMs - windowMs).toISOString())
    .lte('start_at', new Date(startMs + windowMs).toISOString());
  const rows = ((cands ?? []) as ActivityRow[]).filter((r) => !r.hidden);
  const counts = await fetchRoutePointCounts(
    admin,
    userId,
    rows.filter((r) => r.has_route).map((r) => r.id),
  );

  // Passos 2–4 — match e merge (ou insert).
  const targets = rows.map((r) => rowToTarget(r, counts.get(r.id) ?? 0));
  const match = findMatch(normToIncoming(norm), targets);
  if (!match) {
    await insertNew(admin, userId, norm, hrParams);
    return 'inserted';
  }
  const matchRow = rows.find((r) => r.id === match.id)!;
  await applyMerge(admin, userId, norm, matchRow, counts.get(match.id) ?? 0, hrParams);
  return 'merged';
}

/* ───────────────────── Varredura de reconciliação ───────────────────── */

/**
 * Rede de segurança: pares sobrepostos que escaparam (ex.: treino do Apple
 * Watch que também subiu para a Strava antes do vínculo; stub do Garmin que
 * sincronizou antes da ponte). Mescla e apaga a linha redundante.
 *
 * Sementes = linhas CRIADAS nos últimos SWEEP_DAYS (não a data do treino!):
 * um push do HealthKit atrasado — celular offline, re-sync de histórico — cria
 * hoje uma linha de treino antigo, e ela precisa reconciliar com a linha do
 * provedor mesmo que o treino tenha semanas. Candidatos vêm da janela de
 * start_at que cobre as sementes; só pares com pelo menos uma semente mesclam.
 *
 * Canônica do par: a linha do HealthKit quando há uma — um re-sync completo do
 * mobile faz `insert on conflict(id)` com o UUID do HK e ressuscitaria a
 * duplicata se a linha apagada fosse a dele. Sem lado HK, a mais antiga.
 */
export async function reconcileRecent(admin: Admin, userId: string): Promise<number> {
  const createdSince = new Date(Date.now() - SWEEP_DAYS * DAY_MS).toISOString();
  const { data: seedData } = await admin
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('user_id', userId)
    .gte('created_at', createdSince)
    .order('start_at', { ascending: true })
    .limit(500);
  const seeds = ((seedData ?? []) as ActivityRow[]).filter((r) => !r.hidden);
  if (seeds.length === 0) return 0;
  const seedIds = new Set(seeds.map((s) => s.id));

  // Candidatos: tudo na janela de start_at que envolve as sementes (±6h).
  const windowMs = MATCH_CANDIDATE_WINDOW_HOURS * HOUR_MS;
  const starts = seeds.map((s) => Date.parse(s.start_at));
  const { data: candData } = await admin
    .from('activities')
    .select(ACTIVITY_SELECT)
    .eq('user_id', userId)
    .gte('start_at', new Date(Math.min(...starts) - windowMs).toISOString())
    .lte('start_at', new Date(Math.max(...starts) + windowMs).toISOString())
    .order('start_at', { ascending: true })
    .limit(1000);
  const byId = new Map<string, ActivityRow>();
  for (const r of [...seeds, ...((candData ?? []) as ActivityRow[])]) {
    if (!r.hidden) byId.set(r.id, r);
  }
  const rows = [...byId.values()].sort((x, y) => x.start_at.localeCompare(y.start_at));
  if (rows.length < 2) return 0;

  const counts = await fetchRoutePointCounts(
    admin,
    userId,
    rows.filter((r) => r.has_route).map((r) => r.id),
  );
  const windows = (r: ActivityRow) => ({
    activityId: r.activity_id,
    startAt: r.start_at,
    endAt: r.end_at,
  });

  let swept = 0;
  const gone = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    if (gone.has(rows[i].id)) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (gone.has(b.id)) continue;
      if (Date.parse(b.start_at) - Date.parse(a.start_at) > windowMs) break;
      // Só pares que envolvem uma linha recém-criada — o resto já foi varrido antes.
      if (!seedIds.has(a.id) && !seedIds.has(b.id)) continue;
      if (!isSameWorkout(windows(a), windows(b))) continue;

      const aIsHk = (a.provider ?? 'healthkit') === 'healthkit';
      const bIsHk = (b.provider ?? 'healthkit') === 'healthkit';
      let canonical = a;
      let other = b;
      if (bIsHk && !aIsHk) {
        canonical = b;
        other = a;
      } else if (aIsHk === bIsHk && Date.parse(b.created_at) < Date.parse(a.created_at)) {
        canonical = b;
        other = a;
      }
      await mergeRows(admin, userId, canonical, other, counts);
      gone.add(other.id);
      swept++;
      // `a` (linha externa do loop) foi apagada no merge: parar de pareá-la.
      if (other.id === a.id) break;
    }
  }
  return swept;
}

/** Mescla a linha `other` na `canonical` e apaga `other` (rota migra se for a melhor). */
async function mergeRows(
  admin: Admin,
  userId: string,
  canonical: ActivityRow,
  other: ActivityRow,
  routeCounts: Map<string, number>,
): Promise<void> {
  const otherAsIncoming: MergeIncoming = {
    provider: other.provider ?? 'healthkit',
    externalId: other.external_id ?? other.id,
    activityId: other.activity_id,
    activityName: other.activity_name,
    startAt: other.start_at,
    endAt: other.end_at,
    sourceId: other.source_id,
    sourceName: other.source_name,
    routePointCount: routeCounts.get(other.id) ?? 0,
    hasHrData: other.hr_zones != null && Object.keys(other.hr_zones).length > 0,
    distanceM: other.distance_m,
  };
  const target = rowToTarget(canonical, routeCounts.get(canonical.id) ?? 0);
  const plan = planMerge(otherAsIncoming, target);

  const patch: Record<string, unknown> = {
    external_ids: {
      ...(canonical.external_ids ?? {}),
      ...(other.external_ids ?? {}),
      [otherAsIncoming.provider]: otherAsIncoming.externalId,
    },
  };
  if (plan.incomingRicher) {
    if (other.distance_m != null) patch.distance_m = other.distance_m;
    if (other.moving_time_s != null) patch.moving_time_s = other.moving_time_s;
    if (other.elevation_m != null) patch.elevation_m = other.elevation_m;
    if (other.best_efforts) patch.best_efforts = other.best_efforts;
    if (other.hr_zones) patch.hr_zones = other.hr_zones;
    if (other.calories && other.calories > 0) patch.calories = other.calories;
    if (other.device) patch.device = other.device;
  }
  if (plan.setName) patch.activity_name = other.activity_name;
  if (plan.setDuration && other.duration_s != null) patch.duration_s = other.duration_s;
  if (plan.overwriteTimes) {
    patch.start_at = other.start_at;
    patch.end_at = other.end_at;
  }

  if (plan.attachRoute) {
    // A rota de `other` é a melhor: re-chaveia para o id canônico.
    await admin.from('activity_routes').delete().eq('user_id', userId).eq('activity_id', canonical.id);
    const { error } = await admin
      .from('activity_routes')
      .update({ activity_id: canonical.id })
      .eq('user_id', userId)
      .eq('activity_id', other.id);
    if (error) throw new Error(`re-chavear rota falhou: ${error.message}`);
    patch.has_route = true;
  }

  const { error: upErr } = await admin
    .from('activities')
    .update(patch)
    .eq('id', canonical.id)
    .eq('user_id', userId);
  if (upErr) throw new Error(`merge da varredura falhou: ${upErr.message}`);

  const { error: delErr } = await admin
    .from('activities')
    .delete()
    .eq('id', other.id)
    .eq('user_id', userId);
  if (delErr) throw new Error(`delete da duplicata falhou: ${delErr.message}`);
}

/* ───────────────────── Run por (usuário, provedor) ───────────────────── */

interface LinkedAccountRow {
  user_id: string;
  provider: 'strava' | 'intervals';
  status: string;
  athlete_id: string | null;
  athlete_meta: Record<string, unknown> | null;
  cursor: string | null;
  backfill_done: boolean;
}

interface SecretRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  api_key: string | null;
}

/** Garante access token válido da Strava, persistindo a rotação do refresh. */
async function freshStravaToken(admin: Admin, userId: string, secret: SecretRow): Promise<string> {
  const expMs = secret.expires_at ? Date.parse(secret.expires_at) : 0;
  if (secret.access_token && expMs > Date.now() + 5 * 60_000) return secret.access_token;
  if (!secret.refresh_token) throw new AuthError('Strava: sem refresh token');
  const tokens = await refreshStravaToken(secret.refresh_token);
  const { error } = await admin
    .from('linked_account_secrets')
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'strava');
  if (error) throw new Error(`persistir tokens falhou: ${error.message}`);
  return tokens.accessToken;
}

/** Ingestão completa de um (usuário, provedor). Nunca lança — retorna o erro no summary. */
export async function runIngest(
  admin: Admin,
  userId: string,
  provider: 'strava' | 'intervals',
): Promise<IngestSummary> {
  const summary: IngestSummary = { userId, provider, inserted: 0, merged: 0, skipped: 0, swept: 0 };
  try {
    const { data: accountData } = await admin
      .from('linked_accounts')
      .select('user_id,provider,status,athlete_id,athlete_meta,cursor,backfill_done')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();
    const account = accountData as LinkedAccountRow | null;
    if (!account || account.status === 'revoked') {
      summary.error = 'conta não vinculada';
      return summary;
    }
    const { data: secretData } = await admin
      .from('linked_account_secrets')
      .select('access_token,refresh_token,expires_at,api_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();
    const secret = secretData as SecretRow | null;
    if (!secret) {
      summary.error = 'credenciais ausentes';
      return summary;
    }

    const nowMs = Date.now();
    const fromMs = account.cursor
      ? Date.parse(account.cursor) - CURSOR_REWIND_H * HOUR_MS
      : nowMs - INITIAL_IMPORT_DAYS * DAY_MS;

    // Lista bruta ascendente + normalização preguiçosa (streams só até o cap
    // e só para atividades ainda não ingeridas).
    interface PendingRef {
      externalId: string;
      startMs: number;
      normalize: () => Promise<NormalizedActivity | null>;
    }
    let refs: PendingRef[];
    if (provider === 'intervals') {
      if (!secret.api_key || !account.athlete_id) throw new AuthError('intervals.icu: vínculo incompleto');
      const raws = await fetchIntervalsActivities(
        secret.api_key,
        account.athlete_id,
        new Date(fromMs).toISOString(),
        new Date(nowMs + DAY_MS).toISOString(),
      );
      refs = raws.map((r) => ({
        externalId: String(r.id),
        startMs: intervalsStartMs(r),
        normalize: () => normalizeIntervalsActivity(secret.api_key!, r),
      }));
    } else {
      const access = await freshStravaToken(admin, userId, secret);
      const raws = await fetchStravaActivities(access, fromMs / 1000);
      refs = raws.map((r) => ({
        externalId: String(r.id),
        startMs: stravaStartMs(r),
        normalize: () => normalizeStravaActivity(access, r),
      }));
    }
    const total = refs.length;
    const capped = refs.slice(0, MAX_ACTIVITIES_PER_RUN);

    // Idempotência barata ANTES dos streams: a releitura sobreposta do cursor
    // (24h) relista atividades já ingeridas a cada tick — sem este check, cada
    // uma rebaixaria GPS+FC completos só para o passo 0 responder "refreshed"
    // (desperdício direto contra o rate limit da Strava). Cobre linhas criadas
    // por esta fonte; casos mesclados em linha de outra fonte (raros, janela de
    // 24h) ainda passam pelo passo 0 do ingestOne.
    const { data: knownData } = await admin
      .from('activities')
      .select('external_id')
      .eq('user_id', userId)
      .eq('provider', provider)
      .in('external_id', capped.map((r) => r.externalId));
    const known = new Set((knownData ?? []).map((r) => r.external_id as string));

    const hrParams = await loadHrParams(admin, userId, account.athlete_meta);
    let lastStartMs = account.cursor ? Date.parse(account.cursor) : 0;
    for (const ref of capped) {
      // Avança o cursor por TODA atividade consumida — inclusive as que
      // normalizam para null (ex.: stubs source=STRAVA sem duração/streams no
      // intervals.icu). Sem isso, uma leva de stubs vazios no começo da janela
      // trava o backfill: o cursor nunca passa deles e cada tick reprocessa os
      // mesmos 30. `ref.startMs` = mesmo instante de `norm.startAt`.
      if (Number.isFinite(ref.startMs)) lastStartMs = Math.max(lastStartMs, ref.startMs);
      if (known.has(ref.externalId)) {
        summary.skipped++;
        continue;
      }
      const norm = await ref.normalize();
      if (!norm) {
        summary.skipped++;
        continue;
      }
      const outcome = await ingestOne(admin, userId, norm, hrParams);
      if (outcome === 'inserted') summary.inserted++;
      else if (outcome === 'merged') summary.merged++;
      else summary.skipped++;
    }

    summary.swept = await reconcileRecent(admin, userId);

    await admin
      .from('linked_accounts')
      .update({
        cursor: lastStartMs > 0 ? new Date(lastStartMs).toISOString() : account.cursor,
        backfill_done: total <= MAX_ACTIVITIES_PER_RUN,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        status: 'connected',
      })
      .eq('user_id', userId)
      .eq('provider', provider);
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.error = message;
    await admin
      .from('linked_accounts')
      .update({
        last_error: message,
        ...(err instanceof AuthError ? { status: 'error' } : {}),
      })
      .eq('user_id', userId)
      .eq('provider', provider);
    return summary;
  }
}

/** Ingestão de todos os vínculos conectados (modo cron). */
export async function runIngestAll(admin: Admin): Promise<IngestSummary[]> {
  const { data } = await admin
    .from('linked_accounts')
    .select('user_id,provider')
    .eq('status', 'connected');
  const out: IngestSummary[] = [];
  for (const row of data ?? []) {
    out.push(await runIngest(admin, row.user_id as string, row.provider as 'strava' | 'intervals'));
  }
  return out;
}
