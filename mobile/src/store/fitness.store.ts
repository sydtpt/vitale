import { create } from 'zustand';
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import {
  PERMISSIONS,
  PAGE_SIZE,
  fetchWorkoutsPage,
  fetchWorkoutRoute,
  type WorkoutItem,
  type RoutePoint,
  type PermissionStatus,
} from '../lib/healthkit-workouts';
import { syncType as runSyncType, syncDelta as runSyncDelta } from '../services/activity-sync';
import { loadSyncedTypes, unsubscribeType as removeSyncedType } from '../lib/synced-types';
import { notifyActivitySync, notifyAutoTasks } from '../services/notifications';

// Re-export para manter os imports existentes das telas (`from '../store/fitness.store'`).
export {
  GPS_ACTIVITY_IDS,
  hasGpsRoute,
  elevationGain,
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
    await new Promise<void>((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS as any, (err: string) => {
        set({ permissionStatus: err ? 'denied' : 'authorized' });
        resolve();
      });
    });
    if (get().permissionStatus === 'authorized') {
      // Fire-and-forget: o loading:true já exibe o spinner; não bloquear aqui
      // evita que a Promise do initHealthKit fique presa se o callback do HealthKit
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
    // Notificações de evento (separadas por tipo; cada uma respeita seu toggle).
    if (result.pushed > 0) void notifyActivitySync(result.pushed);
    if ((result.tasksCreated ?? 0) > 0) void notifyAutoTasks(result.tasksCreated ?? 0);
  },
}));
