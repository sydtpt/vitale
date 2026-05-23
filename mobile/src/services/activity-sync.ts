/**
 * Orquestração do sync push-only (HealthKit → Supabase), opt-in por tipo.
 *
 * - `syncType(label)`: inscreve o tipo e envia todo o histórico daquele tipo
 *   (backfill por range de data). Ver plan.md §4.1.
 * - `syncDelta()`: incremental por âncora, filtrado aos tipos inscritos (§4.2).
 * - Falhas de rede caem na fila offline (sync-queue) e são reprocessadas.
 *
 * Limitação: o react-native-health não expõe deleções no fluxo anchored, então
 * remoções (FR-008) ainda não são propagadas — ver plan.md.
 */
import { supabase } from '../lib/supabase';
import {
  fetchAllWorkouts,
  fetchWorkoutsDelta,
  fetchWorkoutRoute,
  fetchWorkoutHeartRate,
  fetchHrZoneParams,
  getActivityMeta,
  hasGpsRoute,
  type WorkoutItem,
  type RoutePoint,
} from '../lib/healthkit-workouts';
import { computeBestEfforts } from '../lib/best-efforts';
import { movingTimeFromTrack } from '../lib/moving-time';
import { computeHrZones, type HrZoneParams } from '../lib/heart-rate-zones';
import {
  toActivityRow,
  toRouteRow,
  sanitizeActivityRow,
  type ActivityRow,
  type ActivityRouteRow,
} from '../lib/activity-map';

/** Código HealthKit da corrida — único tipo que recebe best efforts. */
const RUNNING_ACTIVITY_ID = 37;
import { subscribeType, loadSyncedTypes } from '../lib/synced-types';
import { readAnchor, writeAnchor } from '../lib/sync-anchor';
import { enqueue, drainQueue, type QueueItem } from '../lib/sync-queue';
import { linkWorkoutsToTodos } from './activity-todo-link';

export interface SyncResult {
  pushed: number;
  deleted: number;
  routes: number;
  queued: number;
  ok: boolean;
  error?: string;
  /** Labels efetivamente tocados (para a store refletir status). */
  labels?: string[];
}

/** Tamanho do lote de upsert (primeiro sync cobre 3 anos de histórico). */
const BATCH = 200;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Upsert de atividades em lotes. Devolve os lotes que falharam (para a fila). */
async function pushActivities(
  rows: ActivityRow[]
): Promise<{ pushed: number; failed: QueueItem[]; error?: string }> {
  let pushed = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    // RPC upsert: atualiza a linha, mas PRESERVA os campos editados manualmente
    // (`name_edited`/`duration_edited`). Ver .claude/specs/historico-treinos/data-model.md §2.
    const res = await supabase.rpc('sync_upsert_activities', { rows: chunk });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[sync] upsert activities falhou:', res.error.message);
      failed.push(...chunk.map((row) => ({ kind: 'activity' as const, row })));
    } else {
      pushed += chunk.length;
    }
  }
  return { pushed, failed, error };
}

/** Callback de progresso de uma fase (treino-a-treino). */
type StepCb = (done: number, total: number) => void;

/**
 * Busca uma única vez a rota GPS de cada treino outdoor. O resultado alimenta
 * tanto o cálculo de best efforts (corrida) quanto o upsert das rotas, evitando
 * baixar o track duas vezes.
 */
async function collectRoutes(
  workouts: WorkoutItem[],
  onStep?: StepCb,
): Promise<Map<string, RoutePoint[]>> {
  const map = new Map<string, RoutePoint[]>();
  const total = workouts.length;
  let done = 0;
  for (const w of workouts) {
    if (hasGpsRoute(w.activityId)) {
      const points = await fetchWorkoutRoute(w.id);
      if (points.length > 0) map.set(w.id, points);
    }
    onStep?.(++done, total);
  }
  return map;
}

/** Best efforts de uma corrida a partir do track já coletado. */
function bestEffortsFor(
  w: WorkoutItem,
  routes: Map<string, RoutePoint[]>,
): Record<string, number> | undefined {
  if (w.activityId !== RUNNING_ACTIVITY_ID) return undefined;
  const points = routes.get(w.id);
  if (!points) return undefined;
  const efforts = computeBestEfforts(points);
  return Object.keys(efforts).length > 0 ? efforts : undefined;
}

/**
 * Treino com o tempo em movimento derivado do track GPS quando disponível —
 * `HKWorkout.duration` muitas vezes já é o tempo decorrido (sem pausas), então
 * o track é a fonte confiável. Mantém o valor original quando não há track.
 */
function withMovingTime(w: WorkoutItem, routes: Map<string, RoutePoint[]>): WorkoutItem {
  if (!hasGpsRoute(w.activityId)) return w;
  const fromTrack = movingTimeFromTrack(routes.get(w.id));
  return fromTrack != null ? { ...w, movingTimeS: fromTrack } : w;
}

/**
 * Tempo em zonas de FC de cada treino (qualquer tipo), a partir das amostras de
 * frequência cardíaca da janela do treino. Lê o HR de cada treino uma vez.
 */
async function collectHrZones(
  workouts: WorkoutItem[],
  params: HrZoneParams,
  onStep?: StepCb,
): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  const total = workouts.length;
  if (!(params.maxHr > 0)) {
    onStep?.(total, total); // fase pulada, mas conta como concluída
    return map;
  }
  let done = 0;
  for (const w of workouts) {
    const samples = await fetchWorkoutHeartRate(w.start, w.end);
    if (samples.length >= 2) {
      const zones = computeHrZones(samples, params);
      if (Object.keys(zones).length > 0) map.set(w.id, zones);
    }
    onStep?.(++done, total);
  }
  return map;
}

/** Envia as rotas GPS já coletadas. Falhas viram itens de fila. */
async function pushRoutes(
  routes: Map<string, RoutePoint[]>,
  userId: string
): Promise<{ routes: number; failed: QueueItem[]; error?: string }> {
  let count = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (const [activityId, points] of routes) {
    const row = toRouteRow(activityId, userId, points);
    const res = await supabase.from('activity_routes').upsert(row, { onConflict: 'activity_id' });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[sync] upsert activity_routes falhou:', res.error.message);
      failed.push({ kind: 'route', row });
    } else {
      count += 1;
    }
  }
  return { routes: count, failed, error };
}

/** Reprocessa itens da fila; devolve os que ainda falharam (a manter na fila). */
async function flushItems(items: QueueItem[]): Promise<QueueItem[]> {
  const failed: QueueItem[] = [];
  const activities = items.filter((i): i is Extract<QueueItem, { kind: 'activity' }> => i.kind === 'activity');
  const routes = items.filter((i): i is Extract<QueueItem, { kind: 'route' }> => i.kind === 'route');
  // A fila é compartilhada com a saúde; preserva itens de outro tipo (o health-sync os drena).
  failed.push(...items.filter((i) => i.kind !== 'activity' && i.kind !== 'route'));

  const res = await pushActivities(activities.map((i) => sanitizeActivityRow(i.row)));
  failed.push(...res.failed);

  for (const item of routes) {
    const { error } = await supabase
      .from('activity_routes')
      .upsert(item.row as ActivityRouteRow, { onConflict: 'activity_id' });
    if (error) failed.push(item);
  }
  return failed;
}

/**
 * Pesos das fases para a barra de progresso (somam 1). As duas coletas
 * treino-a-treino dominam o tempo (uma leitura do HealthKit por treino); o
 * upload em lote é a fatia final.
 */
const PROGRESS = { routes: 0.45, hr: 0.45, upload: 0.1 } as const;

/** Fração concluída de uma fase, segura contra total = 0. */
const phaseFrac = (done: number, total: number) => (total > 0 ? done / total : 1);

export async function syncType(
  label: string,
  onProgress?: (fraction: number) => void,
): Promise<SyncResult> {
  const base: SyncResult = { pushed: 0, deleted: 0, routes: 0, queued: 0, ok: false, labels: [label] };

  const userId = await currentUserId();
  if (!userId) return { ...base, error: 'Sem sessão.' };

  try {
    // 1. Inscreve o tipo (idempotente) — passa a rastrear os futuros.
    await subscribeType(label);

    // 2. Backfill: todos os treinos do tipo no período.
    const all = await fetchAllWorkouts();
    const ofType = all.filter((w) => getActivityMeta(w.activityId).label === label);
    onProgress?.(0);

    // 3. Coleta as rotas uma vez; deriva best efforts (corrida) do mesmo track.
    const routes = await collectRoutes(ofType, (done, total) =>
      onProgress?.(phaseFrac(done, total) * PROGRESS.routes),
    );
    // 3b. Tempo em zonas de FC (todos os tipos), com os parâmetros do usuário.
    const hrParams = await fetchHrZoneParams();
    const hrZones = await collectHrZones(ofType, hrParams, (done, total) =>
      onProgress?.(PROGRESS.routes + phaseFrac(done, total) * PROGRESS.hr),
    );
    const rows = ofType.map((w) =>
      toActivityRow(withMovingTime(w, routes), userId, bestEffortsFor(w, routes), hrZones.get(w.id)),
    );

    // 4. Upsert (idempotente) + rotas GPS.
    onProgress?.(PROGRESS.routes + PROGRESS.hr);
    const a = await pushActivities(rows);
    const r = await pushRoutes(routes, userId);
    onProgress?.(1);

    const failed = [...a.failed, ...r.failed];
    if (failed.length) await enqueue(failed);

    return {
      pushed: a.pushed,
      deleted: 0,
      routes: r.routes,
      queued: failed.length,
      ok: true,
      error: a.error ?? r.error,
      labels: [label],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[sync] syncType falhou:', message);
    return { ...base, error: message };
  }
}

export async function syncDelta(): Promise<SyncResult> {
  const base: SyncResult = { pushed: 0, deleted: 0, routes: 0, queued: 0, ok: false };

  const userId = await currentUserId();
  if (!userId) return { ...base, error: 'Sem sessão.' };

  try {
    // 0. Drena pendências antes de buscar o novo delta.
    await drainQueue(flushItems);

    const subscribed = await loadSyncedTypes();
    if (subscribed.size === 0) return { ...base, ok: true };

    // 1. Delta incremental por âncora.
    const anchor = await readAnchor(userId);
    const { workouts, anchor: newAnchor } = await fetchWorkoutsDelta(anchor);

    // 2. Filtra aos tipos inscritos.
    const ofType = workouts.filter((w) => subscribed.has(getActivityMeta(w.activityId).label));

    // 3. Coleta as rotas uma vez; deriva best efforts (corrida) do mesmo track.
    const routes = await collectRoutes(ofType);
    // 3b. Tempo em zonas de FC (todos os tipos), com os parâmetros do usuário.
    const hrParams = await fetchHrZoneParams();
    const hrZones = await collectHrZones(ofType, hrParams);
    const rows = ofType.map((w) =>
      toActivityRow(withMovingTime(w, routes), userId, bestEffortsFor(w, routes), hrZones.get(w.id)),
    );

    const a = await pushActivities(rows);
    const r = await pushRoutes(routes, userId);

    // Liga os treinos NOVOS às tarefas (conclui/gera a ocorrência do dia). Só no
    // delta — nunca no backfill por tipo (syncType), p/ não gerar tarefas de 3 anos.
    // Falha aqui não derruba o sync de atividades.
    try {
      await linkWorkoutsToTodos(ofType, userId);
    } catch (e) {
      console.warn('[sync] link de tarefas falhou:', e instanceof Error ? e.message : e);
    }

    const failed = [...a.failed, ...r.failed];
    if (failed.length) await enqueue(failed);

    // 3. Só avança a âncora se tudo subiu (senão re-tenta no próximo ciclo).
    if (failed.length === 0 && newAnchor) await writeAnchor(userId, newAnchor);

    const labels = [...new Set(ofType.map((w) => getActivityMeta(w.activityId).label))];
    return {
      pushed: a.pushed,
      deleted: 0,
      routes: r.routes,
      queued: failed.length,
      ok: true,
      error: a.error ?? r.error,
      labels,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[sync] syncDelta falhou:', message);
    return { ...base, error: message };
  }
}
