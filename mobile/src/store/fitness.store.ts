import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Activity } from '@vitale/shared';
import { healthSource } from '../lib/health-source/active';
import {
  WORKOUT_PERMISSIONS,
  PAGE_SIZE,
  fetchWorkoutsPage,
  fetchWorkoutRoute,
  type WorkoutItem,
  type RoutePoint,
  type PermissionStatus,
} from '../lib/healthkit-workouts';
import { syncType as runSyncType, syncDelta as runSyncDelta, type SyncResult } from '../services/activity-sync';
import { loadSyncedTypes, unsubscribeType as removeSyncedType } from '../lib/synced-types';
import { notifyActivitySync, notifyAutoTasks } from '../services/notifications';
import { useActivitiesStore } from './activities.store';

// Re-export para manter os imports existentes das telas (`from '../store/fitness.store'`).
export {
  GPS_ACTIVITY_IDS,
  hasGpsRoute,
  elevationGain,
  resolveElevationM,
  getActivityMeta,
  fetchWorkoutRoute,
} from '../lib/healthkit-workouts';
export type {
  WorkoutItem,
  RoutePoint,
  PermissionStatus,
  ActivityMeta,
} from '../lib/healthkit-workouts';

/** Estado de sincronização de um tipo de treino (label), refletido no card. */
export type TypeSyncStatus = 'unsubscribed' | 'syncing' | 'synced' | 'pending' | 'error';

/**
 * Recarrega a lista analítica depois de um push que subiu algo.
 *
 * `activities.store.load()` é cacheado por `loaded`, e as telas de tab ficam
 * montadas: a atividade recém-sincronizada só apareceria no Histórico depois de
 * fechar e reabrir o app (o único momento em que a store nasce de novo), ou numa
 * volta ao primeiro plano. Nada disso acontece quando o sync roda com o app já
 * aberto — que é justamente quando a notificação chega e o usuário vai olhar.
 * `force` é obrigatório: sem ele o load é no-op.
 */
function refreshActivityList(result: SyncResult): void {
  if (result.pushed > 0) void useActivitiesStore.getState().load(true);
}

function workoutDedupeKey(workout: Pick<WorkoutItem, 'activityId' | 'start' | 'end'>): string {
  return `${workout.activityId}|${new Date(workout.start).getTime()}|${new Date(workout.end).getTime()}`;
}

export function activityToWorkoutItem(activity: Activity): WorkoutItem {
  const duration = Number.isFinite(activity.durationS) ? Math.max(0, Math.round(activity.durationS)) : 0;
  return {
    id: activity.id,
    activityId: activity.activityId,
    activityName: activity.activityName ?? 'Treino',
    calories: Math.round(activity.calories ?? 0),
    start: activity.startAt,
    end: activity.endAt,
    duration,
    movingTimeS: activity.movingTimeS ?? duration,
    distance: typeof activity.distanceM === 'number' ? activity.distanceM : undefined,
    sourceName: activity.sourceName,
    sourceId: activity.sourceId,
    device: activity.device,
    tracked: activity.tracked,
    metadata: activity.metadata,
  };
}

export function mergeWorkoutSources(
  workouts: WorkoutItem[],
  activities: Activity[],
): WorkoutItem[] {
  const byKey = new Map<string, WorkoutItem>();

  for (const workout of workouts) {
    byKey.set(workoutDedupeKey(workout), workout);
  }

  for (const activity of activities) {
    const next = activityToWorkoutItem(activity);
    const key = workoutDedupeKey(next);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, next);
      continue;
    }

    byKey.set(key, {
      ...existing,
      ...next,
      calories: existing.calories > 0 ? existing.calories : next.calories,
      distance: existing.distance ?? next.distance,
      movingTimeS: existing.movingTimeS > 0 ? existing.movingTimeS : next.movingTimeS,
      metadata: { ...(existing.metadata ?? {}), ...(next.metadata ?? {}) },
      sourceName: existing.sourceName ?? next.sourceName,
      sourceId: existing.sourceId ?? next.sourceId,
      device: existing.device ?? next.device,
      tracked: existing.tracked ?? next.tracked,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
  );
}

interface FitnessState {
  permissionStatus: PermissionStatus;
  workouts: WorkoutItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  oldestStart: string | null;
  /** Cache de rotas por treino. undefined = não carregada, [] = sem rota. */
  routes: Record<string, RoutePoint[]>;

  // ── Sincronização opt-in por tipo ────────────────────────────
  /** Labels de tipos inscritos (fonte: Supabase, cache em memória). */
  syncedTypes: Set<string>;
  /** Estado de sync por tipo (label → status), alimenta a UI do card. */
  typeStatus: Record<string, TypeSyncStatus>;
  /** Progresso 0–1 do sync em andamento por tipo (barra do card). */
  syncProgress: Record<string, number>;
  /** ISO do último sync bem-sucedido por tipo. */
  lastSyncedAt: Record<string, string>;
  /** Erro por tipo (recuperável). */
  syncError: Record<string, string | null>;

  requestPermission: () => Promise<void>;
  loadWorkouts: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadRoute: (id: string) => Promise<void>;

  /** Hidrata os tipos inscritos a partir do Supabase. */
  hydrateSyncedTypes: () => Promise<void>;
  /** Inscreve um tipo e envia todo o histórico daquele tipo (backfill). */
  syncType: (label: string) => Promise<void>;
  /** Delta incremental para um tipo já inscrito (envia apenas atividades novas). */
  syncDeltaForLabel: (label: string) => Promise<void>;
  /** Para de rastrear um tipo (não apaga dados já enviados). */
  unsubscribeType: (label: string) => Promise<void>;
  /** Delta incremental dos tipos inscritos (chamado pelo observer/foreground). */
  runDelta: () => Promise<void>;
}

export const useFitnessStore = create<FitnessState>((set, get) => ({
  permissionStatus: Platform.OS !== 'ios' ? 'unavailable' : 'unknown',
  workouts: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  oldestStart: null,
  routes: {},

  syncedTypes: new Set<string>(),
  typeStatus: {},
  syncProgress: {},
  lastSyncedAt: {},
  syncError: {},

  requestPermission: async () => {
    const granted = await healthSource.requestReadAuthorization(WORKOUT_PERMISSIONS);
    set({ permissionStatus: granted ? 'authorized' : 'denied' });
    if (get().permissionStatus === 'authorized') {
      // Fire-and-forget: o loading:true já exibe o spinner; não bloquear aqui
      // evita que a Promise da autorização fique presa se o callback do HealthKit
      // demorar a disparar logo após a concessão de permissão.
      void get().loadWorkouts();
      void get().hydrateSyncedTypes();
    }
  },

  // Apenas leitura local para exibição — NUNCA dispara sync (FR-003).
  loadWorkouts: async () => {
    set({ loading: true, workouts: [], oldestStart: null, hasMore: true });
    const results = await fetchWorkoutsPage(new Date().toISOString());
    const oldestStart = results.length > 0 ? results[results.length - 1].start : null;
    set({ workouts: results, loading: false, oldestStart, hasMore: results.length === PAGE_SIZE });
  },

  loadMore: async () => {
    const { loadingMore, hasMore, oldestStart } = get();
    if (loadingMore || !hasMore || !oldestStart) return;

    set({ loadingMore: true });
    const endDate = new Date(new Date(oldestStart).getTime() - 1000).toISOString();
    const results = await fetchWorkoutsPage(endDate);
    const newOldest = results.length > 0 ? results[results.length - 1].start : oldestStart;

    set((state) => ({
      workouts: [...state.workouts, ...results],
      loadingMore: false,
      oldestStart: newOldest,
      hasMore: results.length === PAGE_SIZE,
    }));
  },

  loadRoute: async (id: string) => {
    if (get().routes[id] !== undefined) return;
    const points = await fetchWorkoutRoute(id);
    set((state) => ({ routes: { ...state.routes, [id]: points } }));
  },

  hydrateSyncedTypes: async () => {
    const labels = await loadSyncedTypes();
    set((state) => {
      const typeStatus = { ...state.typeStatus };
      for (const label of labels) {
        if (!typeStatus[label]) typeStatus[label] = 'synced';
      }
      return { syncedTypes: labels, typeStatus };
    });
  },

  syncType: async (label: string) => {
    set((state) => ({
      typeStatus: { ...state.typeStatus, [label]: 'syncing' },
      syncProgress: { ...state.syncProgress, [label]: 0 },
      syncError: { ...state.syncError, [label]: null },
    }));

    // O progresso pode ser emitido de forma SÍNCRONA e em rajada (treinos sem
    // rota GPS não têm await no loop de coleta). Como o zustand re-renderiza
    // sincronamente a cada `set`, emitir todas as frações estoura o limite de
    // re-renders do React. Limita a ~10 atualizações/seg; o 1.0 final sempre passa.
    let lastEmit = 0;
    const result = await runSyncType(label, (fraction) => {
      const now = Date.now();
      if (fraction < 1 && now - lastEmit < 100) return;
      lastEmit = now;
      set((state) => ({
        syncProgress: { ...state.syncProgress, [label]: fraction },
      }));
    });

    set((state) => {
      const syncedTypes = new Set(state.syncedTypes);
      syncedTypes.add(label);
      const hadError = !result.ok || !!result.error;
      const status: TypeSyncStatus = hadError
        ? 'error'
        : result.queued > 0
        ? 'pending'
        : 'synced';
      const syncProgress = { ...state.syncProgress };
      delete syncProgress[label];
      return {
        syncedTypes,
        typeStatus: { ...state.typeStatus, [label]: status },
        syncProgress,
        lastSyncedAt:
          result.ok && !result.error
            ? { ...state.lastSyncedAt, [label]: new Date().toISOString() }
            : state.lastSyncedAt,
        syncError: { ...state.syncError, [label]: hadError ? result.error ?? 'Falha no sync' : null },
      };
    });
    refreshActivityList(result);
  },

  syncDeltaForLabel: async (label: string) => {
    set((state) => ({
      typeStatus: { ...state.typeStatus, [label]: 'syncing' },
      syncError: { ...state.syncError, [label]: null },
    }));
    const result = await runSyncDelta();
    const now = new Date().toISOString();
    set((state) => {
      const hadError = !result.ok || !!result.error;
      const status: TypeSyncStatus = hadError
        ? 'error'
        : result.queued > 0
        ? 'pending'
        : 'synced';
      const typeStatus = { ...state.typeStatus };
      const lastSyncedAt = { ...state.lastSyncedAt };
      // Atualiza todos os labels tocados pelo delta + garante que o label pedido sai de 'syncing'
      const touched = new Set([label, ...(result.labels ?? [])]);
      for (const l of touched) {
        typeStatus[l] = hadError ? 'error' : result.queued > 0 ? 'pending' : 'synced';
        if (!hadError) lastSyncedAt[l] = now;
      }
      return {
        typeStatus,
        lastSyncedAt,
        syncError: { ...state.syncError, [label]: hadError ? result.error ?? 'Falha no sync' : null },
      };
    });
    refreshActivityList(result);
  },

  unsubscribeType: async (label: string) => {
    await removeSyncedType(label);
    set((state) => {
      const syncedTypes = new Set(state.syncedTypes);
      syncedTypes.delete(label);
      const typeStatus = { ...state.typeStatus };
      delete typeStatus[label];
      return { syncedTypes, typeStatus };
    });
  },

  runDelta: async () => {
    const result = await runSyncDelta();
    const labels = result.labels ?? [];
    if (!result.ok || labels.length === 0) return;
    const now = new Date().toISOString();
    set((state) => {
      const typeStatus = { ...state.typeStatus };
      const lastSyncedAt = { ...state.lastSyncedAt };
      for (const label of labels) {
        typeStatus[label] = result.queued > 0 ? 'pending' : 'synced';
        lastSyncedAt[label] = now;
      }
      return { typeStatus, lastSyncedAt };
    });
    refreshActivityList(result);
    // Notificações de evento (separadas por tipo; cada uma respeita seu toggle).
    void notifyActivitySync(result.syncedActivities ?? []);
    if ((result.tasksCreated ?? 0) > 0) void notifyAutoTasks(result.tasksCreated ?? 0);
  },
}));
