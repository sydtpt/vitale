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
import { maxHrFromAge, type HrSample, type HrZoneParams } from './heart-rate-zones';

// Re-export dos tipos/helpers puros para um único ponto de import.
export * from './workout-types';

export const PERMISSIONS = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.WorkoutRoute,
      // Necessárias para derivar o tempo em zonas de FC de cada treino (Karvonen).
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.RestingHeartRate,
      AppleHealthKit.Constants.Permissions.DateOfBirth,
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
            timestamp: typeof l.timestamp === 'string' ? l.timestamp : undefined,
          }))
      );
    });
  });
}

/**
 * Amostras de FC (bpm) dentro da janela do treino [start, end]. Base do cálculo
 * de tempo em zonas. Retorna [] fora do iOS ou quando não há amostras.
 */
export function fetchWorkoutHeartRate(start: string, end: string): Promise<HrSample[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(
      { startDate: start, endDate: end, unit: 'bpm' as any, ascending: true } as any,
      (err, results) => {
        if (err || !Array.isArray(results)) {
          resolve([]);
          return;
        }
        resolve(
          results
            .map((s: any) => ({ bpm: s.value, t: Date.parse(s.startDate) }))
            .filter((s) => Number.isFinite(s.bpm) && s.bpm > 0 && Number.isFinite(s.t)),
        );
      },
    );
  });
}

/** Idade (anos) do perfil do Health. undefined se indisponível. */
function fetchAge(): Promise<number | undefined> {
  if (Platform.OS !== 'ios') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    AppleHealthKit.getDateOfBirth({} as any, (err, r: any) =>
      resolve(err || typeof r?.age !== 'number' ? undefined : r.age),
    );
  });
}

/** FC de repouso mais recente (bpm) dos últimos 180 dias. undefined se nenhuma. */
function fetchRestingHeartRate(): Promise<number | undefined> {
  if (Platform.OS !== 'ios') return Promise.resolve(undefined);
  const startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  return new Promise((resolve) => {
    AppleHealthKit.getRestingHeartRateSamples(
      { startDate, endDate: new Date().toISOString(), unit: 'bpm' as any, ascending: false, limit: 1 } as any,
      (err, results) => {
        const v = Array.isArray(results) && results.length > 0 ? (results[0] as any).value : undefined;
        resolve(err || typeof v !== 'number' || v <= 0 ? undefined : v);
      },
    );
  });
}

/**
 * Parâmetros de zona do usuário (FCmáx e FCrep), lidos uma vez por sync. FCmáx
 * vem da idade (220 − idade, com fallback); FCrep da amostra mais recente. Sem
 * FCrep o cálculo de zonas cai para % da FCmáx.
 */
export async function fetchHrZoneParams(): Promise<HrZoneParams> {
  const [age, restHr] = await Promise.all([fetchAge(), fetchRestingHeartRate()]);
  return { maxHr: maxHrFromAge(age), restHr };
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
