import { create } from 'zustand';
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import type { Ionicons } from '@expo/vector-icons';

export type PermissionStatus = 'unknown' | 'authorized' | 'denied' | 'unavailable';

export interface WorkoutItem {
  id: string;
  activityId: number;
  activityName: string;
  calories: number;
  start: string;
  end: string;
  duration: number; // seconds
  distance?: number; // meters
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  metadata?: Record<string, unknown>;
  workoutEventsCount?: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/** Atividades ao ar livre que costumam ter rota GPS (corrida, caminhada, ciclismo, trilha). */
export const GPS_ACTIVITY_IDS = new Set<number>([13, 24, 37, 52]);

export function hasGpsRoute(activityId: number): boolean {
  return GPS_ACTIVITY_IDS.has(activityId);
}

/** Ganho de elevação acumulado (m), somando só subidas acima de um limiar de ruído. */
export function elevationGain(points: RoutePoint[], threshold = 1): number {
  let gain = 0;
  let prev: number | undefined;
  for (const p of points) {
    if (typeof p.altitude !== 'number') continue;
    if (prev !== undefined) {
      const delta = p.altitude - prev;
      if (delta > threshold) gain += delta;
    }
    prev = p.altitude;
  }
  return gain;
}

export type ActivityMeta = { icon: keyof typeof Ionicons.glyphMap; label: string };

export function getActivityMeta(activityId: number): ActivityMeta {
  switch (activityId) {
    case 11: return { icon: 'fitness-outline', label: 'Cross Training' };
    case 13: return { icon: 'bicycle-outline', label: 'Ciclismo' };
    case 16: return { icon: 'fitness-outline', label: 'Elíptico' };
    case 20: return { icon: 'fitness-outline', label: 'Funcional' };
    case 24: return { icon: 'trail-sign-outline', label: 'Trilha' };
    case 35: return { icon: 'boat-outline', label: 'Remo' };
    case 37: return { icon: 'walk-outline', label: 'Corrida' };
    case 44: return { icon: 'trending-up-outline', label: 'Escadas' };
    case 46: return { icon: 'water-outline', label: 'Natação' };
    case 50: return { icon: 'barbell-outline', label: 'Musculação' };
    case 52: return { icon: 'walk-outline', label: 'Caminhada' };
    case 57: return { icon: 'body-outline', label: 'Yoga' };
    case 59: return { icon: 'body-outline', label: 'Core' };
    case 63: return { icon: 'flash-outline', label: 'HIIT' };
    case 66: return { icon: 'body-outline', label: 'Pilates' };
    case 73: return { icon: 'pulse-outline', label: 'Cardio' };
    case 82: return { icon: 'tennisball-outline', label: 'Pickleball' };
    default: return { icon: 'barbell-outline', label: 'Treino' };
  }
}

const YEARS_BACK = 3;
const PAGE_SIZE = 1000;

function startDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

const PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.WorkoutRoute,
    ],
    write: [] as string[],
  },
};

/** Busca os pontos GPS de um treino. Retorna [] se não houver rota (ex.: indoor). */
export function fetchWorkoutRoute(id: string): Promise<RoutePoint[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getWorkoutRouteSamples({ id }, (err, results) => {
      if (err || !results?.data?.locations) {
        resolve([]);
        return;
      }
      resolve(
        results.data.locations
          .filter((l) => typeof l.latitude === 'number' && typeof l.longitude === 'number')
          .map((l) => ({
            latitude: l.latitude,
            longitude: l.longitude,
            altitude: typeof l.altitude === 'number' ? l.altitude : undefined,
          }))
      );
    });
  });
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
  requestPermission: () => Promise<void>;
  loadWorkouts: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadRoute: (id: string) => Promise<void>;
}

export const useFitnessStore = create<FitnessState>((set, get) => ({
  permissionStatus: Platform.OS !== 'ios' ? 'unavailable' : 'unknown',
  workouts: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  oldestStart: null,
  routes: {},

  requestPermission: async () => {
    await new Promise<void>((resolve) => {
      AppleHealthKit.initHealthKit(PERMISSIONS as any, (err: string) => {
        if (err) {
          set({ permissionStatus: 'denied' });
        } else {
          set({ permissionStatus: 'authorized' });
        }
        resolve();
      });
    });
    if (get().permissionStatus === 'authorized') {
      await get().loadWorkouts();
    }
  },

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
}));

function fetchWorkoutsPage(endDate: string): Promise<WorkoutItem[]> {
  return new Promise((resolve) => {
    AppleHealthKit.getAnchoredWorkouts(
      { startDate: startDateYearsAgo(YEARS_BACK), endDate, limit: PAGE_SIZE, ascending: false } as any,
      (err, results) => {
        if (err || !results?.data) {
          resolve([]);
          return;
        }
        resolve(
          results.data.map((w) => ({
            id: w.id ?? String(Math.random()),
            activityId: w.activityId ?? 0,
            activityName: w.activityName ?? 'Treino',
            calories: Math.round(w.calories ?? 0),
            start: w.start,
            end: w.end,
            duration: w.duration ?? 0,
            distance: w.distance,
            sourceName: w.sourceName,
            sourceId: w.sourceId,
            device: w.device,
            tracked: w.tracked,
            metadata:
              w.metadata && typeof w.metadata === 'object' ? w.metadata : undefined,
            workoutEventsCount: Array.isArray(w.workoutEvents)
              ? w.workoutEvents.length
              : undefined,
          }))
        );
      }
    );
  });
}
