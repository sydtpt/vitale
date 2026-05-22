/**
 * Acesso ao HealthKit para treinos (workouts) e rotas GPS.
 * Camada de I/O — sem estado. Consumida pela store e pelo serviço de sync.
 * Helpers/tipos puros vivem em `workout-types.ts` (sem dependência nativa).
 */
import { Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import {
  PAGE_SIZE,
  YEARS_BACK,
  startDateYearsAgo,
  deriveWorkoutId,
  milesToMeters,
  computeMovingTimeS,
  type WorkoutItem,
  type RoutePoint,
} from './workout-types';

// Re-export dos tipos/helpers puros para um único ponto de import.
export * from './workout-types';

export const PERMISSIONS = {
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

function mapRawWorkout(w: any): WorkoutItem {
  const duration = w.duration ?? 0;
  const events = Array.isArray(w.workoutEvents) ? w.workoutEvents : undefined;
  return {
    id: w.id ?? deriveWorkoutId(w),
    activityId: w.activityId ?? 0,
    activityName: w.activityName ?? 'Treino',
    calories: Math.round(w.calories ?? 0),
    start: w.start,
    end: w.end,
    duration,
    movingTimeS: computeMovingTimeS({ start: w.start, end: w.end, durationS: duration, events }),
    distance: milesToMeters(w.distance), // nativo entrega milhas → metros
    sourceName: w.sourceName,
    sourceId: w.sourceId,
    device: w.device,
    tracked: w.tracked,
    metadata: w.metadata && typeof w.metadata === 'object' ? w.metadata : undefined,
    workoutEventsCount: events ? events.length : undefined,
  };
}

/**
 * Timeout de segurança para chamadas ao HealthKit: se o callback nativo não
 * disparar dentro de `ms` ms (ex.: logo após initHealthKit), resolve com o
 * fallback em vez de pendurar a Promise para sempre.
 */
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 12_000): Promise<T> {
  return new Promise((resolve) => {
    let done = false;
    const settle = (v: T) => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => settle(fallback), ms);
    promise.then(settle);
  });
}

/** Uma página de treinos terminando em `endDate`, do mais recente ao mais antigo. */
export function fetchWorkoutsPage(endDate: string): Promise<WorkoutItem[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  const inner = new Promise<WorkoutItem[]>((resolve) => {
    AppleHealthKit.getAnchoredWorkouts(
      { startDate: startDateYearsAgo(YEARS_BACK), endDate, limit: PAGE_SIZE, ascending: false } as any,
      (err, results) => {
        if (err || !results?.data) { resolve([]); return; }
        resolve(results.data.map(mapRawWorkout));
      }
    );
  });
  return withTimeout(inner, []);
}

export interface WorkoutsDelta {
  workouts: WorkoutItem[];
  /** Novo token de âncora para o próximo delta (vazio se indisponível). */
  anchor: string;
}

/**
 * Treinos novos/alterados desde `anchor` (incremental). Sem âncora, retorna o
 * período inteiro + uma âncora inicial. Nota: o react-native-health não expõe
 * deleções neste fluxo — ver limitação em plan.md.
 */
export function fetchWorkoutsDelta(anchor: string | null): Promise<WorkoutsDelta> {
  if (Platform.OS !== 'ios') return Promise.resolve({ workouts: [], anchor: anchor ?? '' });
  const fallback: WorkoutsDelta = { workouts: [], anchor: anchor ?? '' };
  const inner = new Promise<WorkoutsDelta>((resolve) => {
    AppleHealthKit.getAnchoredWorkouts(
      {
        startDate: startDateYearsAgo(YEARS_BACK),
        limit: PAGE_SIZE,
        ascending: true,
        ...(anchor ? { anchor } : {}),
      } as any,
      (err, results) => {
        if (err || !results?.data) { resolve(fallback); return; }
        resolve({ workouts: results.data.map(mapRawWorkout), anchor: results.anchor ?? anchor ?? '' });
      }
    );
  });
  return withTimeout(inner, fallback);
}

/**
 * Varre todo o histórico de treinos (até YEARS_BACK), paginando até esgotar.
 * Usado pelo backfill por tipo, que precisa de TODOS os treinos do período.
 */
export async function fetchAllWorkouts(): Promise<WorkoutItem[]> {
  if (Platform.OS !== 'ios') return [];
  const all: WorkoutItem[] = [];
  let endDate = new Date().toISOString();
  // Guarda contra loop infinito caso o HealthKit devolva páginas cheias indefinidamente.
  for (let guard = 0; guard < 200; guard++) {
    const page = await fetchWorkoutsPage(endDate);
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    const oldest = page[page.length - 1].start;
    endDate = new Date(new Date(oldest).getTime() - 1000).toISOString();
  }
  return all;
}
