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
  elevationGain,
  GPS_ACTIVITY_IDS,
  type WorkoutItem,
  type RoutePoint,
} from '../lib/healthkit-workouts';
import { computeBestEfforts } from '../lib/best-efforts';
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
import { useSettingsStore } from '../store/settings.store';
import { bridgeStubKeepFilter } from '../lib/connections';
import { readAnchor, writeAnchor } from '../lib/sync-anchor';
import { enqueue, drainQueue, type QueueItem } from '../lib/sync-queue';
import { linkWorkoutsToTodos } from './activity-todo-link';
import { movingTimeFromTrack } from '@vitale/shared';
import {
  fetchExistingRouteIds,
  fetchRouteBackfillCandidates,
  setActivityHasRoute,
  upsertActivityRoute,
} from '@vitale/shared';

export interface SyncResult {
  pushed: number;
  deleted: number;
  routes: number;
  queued: number;
  ok: boolean;
  error?: string;
  /** Labels efetivamente tocados (para a store refletir status). */
  labels?: string[];
  /** Ocorrências de tarefa PENDENTES novas geradas pelo vínculo (para notificar). */
  tasksCreated?: number;
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
    // (`name_edited`/`duration_edited`). Ver docs/specs/historico-treinos/data-model.md §2.
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

/** Mínimo entre varreduras server-side pós-push. */
const RECONCILE_THROTTLE_MS = 60_000;
let lastReconcileAt = 0;

/**
 * Fire-and-forget: pede ao servidor para mesclar duplicatas recém-criadas pelo
 * push (mesmo treino gravado no HealthKit por mais de um app). Sem await — o
 * resultado aparece na próxima leitura; falha (offline) é silenciosa, o cron
 * do connections-ingest cobre.
 */
function requestServerReconcile(pushed: number): void {
  if (pushed <= 0) return;
  const now = Date.now();
  if (now - lastReconcileAt < RECONCILE_THROTTLE_MS) return;
  lastReconcileAt = now;
  void supabase.functions
    .invoke('connections-ingest', { body: { mode: 'reconcile' } })
    .then(({ error }) => {
      if (error) console.warn('[sync] reconcile server-side falhou:', error.message ?? error);
    })
    .catch(() => undefined);
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

/** Ganho de elevação do track já coletado; undefined sem rota ou sem altitude. */
function elevationFor(
  w: WorkoutItem,
  routes: Map<string, RoutePoint[]>,
): number | undefined {
  const points = routes.get(w.id);
  if (!points || !points.some((p) => typeof p.altitude === 'number')) return undefined;
  return elevationGain(points);
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
    const res = await upsertActivityRoute(supabase, row).then(() => ({ error: null })).catch((e) => ({ error: e }));
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
    try {
      await upsertActivityRoute(supabase, item.row as ActivityRouteRow);
    } catch {
      failed.push(item);
    }
  }
  return failed;
}

/** Janela de retry para o caso "HealthKit ainda processando" (has_route=false). */
const ROUTE_RETRY_DAYS = 30;
/** Máx. de rotas re-buscadas do HealthKit por sync — drena o backlog histórico
 *  ao longo de alguns syncs sem alongar demais um único sync. */
const ROUTE_BACKFILL_PER_SYNC = 25;

/** Dado um conjunto de ids, retorna os que JÁ têm linha em `activity_routes`. */
async function existingRouteIds(userId: string, ids: string[]): Promise<Set<string>> {
  return fetchExistingRouteIds(supabase, userId, ids);
}

/**
 * Re-busca no HealthKit a rota de atividades GPS que estão SEM linha em
 * `activity_routes` e a envia. O sinal é a AUSÊNCIA da linha de rota — NÃO a flag
 * `has_route`, que podia ficar `true` sem os pontos (um push de rota que falhou
 * num sync anterior comita a atividade com has_route=true e a rota fica pendente;
 * o filtro antigo por `has_route=false` nunca a alcançava). Cobre dois casos:
 *  - **push falhou** (has_route=true, sem pontos): a rota existe no HealthKit →
 *    re-tenta SEM janela de tempo, drenando o histórico inteiro;
 *  - **HealthKit tardou** (has_route=false): a rota pode ter aparecido depois →
 *    re-tenta só na janela recente e então desiste.
 * Ajusta `has_route` ao resultado (true se achou pontos; false se o HealthKit não
 * tem rota — estado honesto que impede re-tentar em loop os realmente sem-rota).
 * Processa até `ROUTE_BACKFILL_PER_SYNC` por sync.
 */
async function retryMissingRoutes(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - ROUTE_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Só linhas de origem HealthKit (provider healthkit ou ausente): a rota vem do
  // HealthKit por aqui. Linhas de provider (strava/intervals) recebem rota pelo
  // ingest server-side e seu `id` nem é um id do HealthKit — não tocar.
  // has_route=true-sem-pontos (falha de push) SEM janela; has_route=false só recente.
  let candidates;
  try {
    candidates = await fetchRouteBackfillCandidates(supabase, userId, [...GPS_ACTIVITY_IDS], cutoff);
  } catch {
    return 0;
  }

  if (!candidates?.length) return 0;

  // Mantém só as que realmente não têm rota persistida.
  const withRoute = await existingRouteIds(userId, candidates.map((c) => c.id));
  const missing = candidates
    .filter((c) => !withRoute.has(c.id))
    .slice(0, ROUTE_BACKFILL_PER_SYNC);

  let count = 0;
  for (const activity of missing) {
    const points = await fetchWorkoutRoute(activity.id);
    if (points.length === 0) {
      // HealthKit não tem a rota: torna has_route honesto p/ não re-tentar à toa.
      if (activity.hasRoute) {
        await setActivityHasRoute(supabase, userId, activity.id, false);
      }
      continue;
    }
    const row = toRouteRow(activity.id, userId, points);
    try {
      await upsertActivityRoute(supabase, row);
    } catch {
      continue;
    }
    if (!activity.hasRoute) {
      await setActivityHasRoute(supabase, userId, activity.id, true);
    }
    count++;
  }
  return count;
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

    // 2. Backfill: todos os treinos do tipo no período. Com ponte conectada,
    // descarta os stubs de ponte (Garmin Connect / app da Strava) DENTRO da
    // cobertura do ingest (a versão rica chega por lá); stubs mais antigos
    // continuam sincronizando.
    const all = await fetchAllWorkouts();
    const keepWorkout = await bridgeStubKeepFilter();
    const ofType = all.filter(
      (w) => getActivityMeta(w.activityId).label === label && keepWorkout(w),
    );
    onProgress?.(0);

    // 3. Coleta as rotas uma vez; deriva best efforts (corrida) do mesmo track.
    const routes = await collectRoutes(ofType, (done, total) =>
      onProgress?.(phaseFrac(done, total) * PROGRESS.routes),
    );
    // 3b. Tempo em zonas de FC (todos os tipos), com os parâmetros do usuário.
    const hrParams = await fetchHrZoneParams(useSettingsStore.getState().preferences?.maxHr);
    const hrZones = await collectHrZones(ofType, hrParams, (done, total) =>
      onProgress?.(PROGRESS.routes + phaseFrac(done, total) * PROGRESS.hr),
    );
    const rows = ofType.map((w) =>
      toActivityRow(withMovingTime(w, routes), userId, bestEffortsFor(w, routes), hrZones.get(w.id), routes.has(w.id), elevationFor(w, routes)),
    );

    // 4. Upsert (idempotente) + rotas GPS.
    onProgress?.(PROGRESS.routes + PROGRESS.hr);
    const a = await pushActivities(rows);
    const r = await pushRoutes(routes, userId);
    onProgress?.(1);
    requestServerReconcile(a.pushed);

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
    const drained = await drainQueue(flushItems);

    const subscribed = await loadSyncedTypes();
    if (subscribed.size === 0) return { ...base, ok: true };

    // 1. Delta incremental por âncora.
    const anchor = await readAnchor(userId);
    const { workouts, anchor: newAnchor } = await fetchWorkoutsDelta(anchor);

    // 2. Filtra aos tipos inscritos. `ofType` (completo) alimenta o vínculo de
    // tarefas — um treino do Garmin conta como treino feito mesmo quando o stub
    // não sobe. `pushable` exclui stubs cobertos pelo ingest server-side (a
    // versão rica chega por lá; empurrar o stub só criaria duplicata).
    const ofType = workouts.filter((w) => subscribed.has(getActivityMeta(w.activityId).label));
    const keepWorkout = await bridgeStubKeepFilter();
    const pushable = ofType.filter(keepWorkout);

    // 3. Coleta as rotas uma vez; deriva best efforts (corrida) do mesmo track.
    const routes = await collectRoutes(pushable);
    // 3b. Tempo em zonas de FC (todos os tipos), com os parâmetros do usuário.
    const hrParams = await fetchHrZoneParams(useSettingsStore.getState().preferences?.maxHr);
    const hrZones = await collectHrZones(pushable, hrParams);
    const rows = pushable.map((w) =>
      toActivityRow(withMovingTime(w, routes), userId, bestEffortsFor(w, routes), hrZones.get(w.id), routes.has(w.id), elevationFor(w, routes)),
    );

    const a = await pushActivities(rows);
    const r = await pushRoutes(routes, userId);
    requestServerReconcile(a.pushed + drained);

    // Liga os treinos NOVOS às tarefas (conclui/gera a ocorrência do dia). Só no
    // delta — nunca no backfill por tipo (syncType), p/ não gerar tarefas de 3 anos.
    // Também pula quando anchor=null (cold start): fetchWorkoutsDelta sem âncora
    // devolve 3 anos de histórico; processar tudo criaria tasks para cada treino passado.
    // Falha aqui não derruba o sync de atividades.
    let tasksCreated = 0;
    if (anchor !== null) {
      try {
        tasksCreated = await linkWorkoutsToTodos(ofType, userId);
      } catch (e) {
        console.warn('[sync] link de tarefas falhou:', e instanceof Error ? e.message : e);
      }
    }

    const failed = [...a.failed, ...r.failed];
    if (failed.length) await enqueue(failed);

    // 3. Só avança a âncora se tudo subiu (senão re-tenta no próximo ciclo).
    if (failed.length === 0 && newAnchor) await writeAnchor(userId, newAnchor);

    // 4. Recupera rotas GPS ausentes: falhas de push de syncs anteriores (histórico
    //    inteiro) e o HealthKit que só processou a rota depois do sync (recente).
    //    Drena até N por sync (ver retryMissingRoutes).
    let retriedRoutes = 0;
    try {
      retriedRoutes = await retryMissingRoutes(userId);
    } catch (e) {
      console.warn('[sync] retry de rotas falhou:', e instanceof Error ? e.message : e);
    }

    const labels = [...new Set(ofType.map((w) => getActivityMeta(w.activityId).label))];
    return {
      pushed: a.pushed,
      deleted: 0,
      routes: r.routes + retriedRoutes,
      queued: failed.length,
      ok: true,
      error: a.error ?? r.error,
      labels,
      tasksCreated,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[sync] syncDelta falhou:', message);
    return { ...base, error: message };
  }
}
