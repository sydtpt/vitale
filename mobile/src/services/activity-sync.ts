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
  getActivityMeta,
  hasGpsRoute,
  type WorkoutItem,
} from '../lib/healthkit-workouts';
import {
  toActivityRow,
  toRouteRow,
  sanitizeActivityRow,
  type ActivityRow,
  type ActivityRouteRow,
} from '../lib/activity-map';
import { subscribeType, loadSyncedTypes } from '../lib/synced-types';
import { readAnchor, writeAnchor } from '../lib/sync-anchor';
import { enqueue, drainQueue, type QueueItem } from '../lib/sync-queue';

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
    const res = await supabase.from('activities').upsert(chunk, { onConflict: 'id' });
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

/** Busca e envia as rotas GPS dos treinos outdoor. Falhas viram itens de fila. */
async function pushRoutes(
  workouts: WorkoutItem[],
  userId: string
): Promise<{ routes: number; failed: QueueItem[]; error?: string }> {
  let routes = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (const w of workouts) {
    if (!hasGpsRoute(w.activityId)) continue;
    const points = await fetchWorkoutRoute(w.id);
    if (points.length === 0) continue;
    const row = toRouteRow(w.id, userId, points);
    const res = await supabase.from('activity_routes').upsert(row, { onConflict: 'activity_id' });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[sync] upsert activity_routes falhou:', res.error.message);
      failed.push({ kind: 'route', row });
    } else {
      routes += 1;
    }
  }
  return { routes, failed, error };
}

/** Reprocessa itens da fila; devolve os que ainda falharam (a manter na fila). */
async function flushItems(items: QueueItem[]): Promise<QueueItem[]> {
  const failed: QueueItem[] = [];
  const activities = items.filter((i): i is Extract<QueueItem, { kind: 'activity' }> => i.kind === 'activity');
  const routes = items.filter((i): i is Extract<QueueItem, { kind: 'route' }> => i.kind === 'route');

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

export async function syncType(label: string): Promise<SyncResult> {
  const base: SyncResult = { pushed: 0, deleted: 0, routes: 0, queued: 0, ok: false, labels: [label] };

  const userId = await currentUserId();
  if (!userId) return { ...base, error: 'Sem sessão.' };

  try {
    // 1. Inscreve o tipo (idempotente) — passa a rastrear os futuros.
    await subscribeType(label);

    // 2. Backfill: todos os treinos do tipo no período.
    const all = await fetchAllWorkouts();
    const ofType = all.filter((w) => getActivityMeta(w.activityId).label === label);
    const rows = ofType.map((w) => toActivityRow(w, userId));

    // 3. Upsert (idempotente) + rotas GPS.
    const a = await pushActivities(rows);
    const r = await pushRoutes(ofType, userId);

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
    const rows = ofType.map((w) => toActivityRow(w, userId));

    const a = await pushActivities(rows);
    const r = await pushRoutes(ofType, userId);

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
