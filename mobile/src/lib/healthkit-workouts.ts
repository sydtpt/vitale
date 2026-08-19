/**
 * Acesso ao HealthKit para treinos (workouts) e rotas GPS.
 * Camada de I/O — sem estado. Consumida pela store e pelo serviço de sync.
 * Helpers/tipos puros vivem em `workout-types.ts` (sem dependência nativa).
 */
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
import { HK, healthSource, type HealthTypeId, type RawWorkout } from './health-source/active';

// Re-export dos tipos/helpers puros para um único ponto de import.
export * from './workout-types';

/** Tipos do HealthKit que a aba de treinos precisa ler. */
export const WORKOUT_PERMISSIONS: readonly HealthTypeId[] = [
  HK.workout,
  HK.workoutRoute,
  // Necessárias para derivar o tempo em zonas de FC de cada treino.
  HK.heartRate,
  HK.restingHeartRate,
  HK.dateOfBirth,
];

/** Busca os pontos GPS de um treino. Retorna [] se não houver rota (ex.: indoor). */
export function fetchWorkoutRoute(id: string): Promise<RoutePoint[]> {
  const inner = healthSource.queryWorkoutRoute(id).then((locations) =>
    locations
      .filter((l) => typeof l.latitude === 'number' && typeof l.longitude === 'number')
      .map((l) => ({
        latitude: l.latitude,
        longitude: l.longitude,
        altitude: typeof l.altitude === 'number' ? l.altitude : undefined,
        timestamp: typeof l.timestamp === 'string' ? l.timestamp : undefined,
      })),
  );
  return withTimeout(inner, []);
}

/**
 * Amostras de FC (bpm) dentro da janela do treino [start, end]. Base do cálculo
 * de tempo em zonas. Retorna [] fora do iOS ou quando não há amostras.
 */
export function fetchWorkoutHeartRate(start: string, end: string): Promise<HrSample[]> {
  return healthSource
    .queryQuantitySamples(HK.heartRate, {
      startDate: start,
      endDate: end,
      unit: 'bpm',
      ascending: true,
    })
    .then((results) =>
      results
        .map((s) => ({ bpm: s.value, t: Date.parse(s.startDate) }))
        .filter((s) => Number.isFinite(s.bpm) && s.bpm > 0 && Number.isFinite(s.t)),
    );
}

/** Idade (anos) do perfil do Health. undefined se indisponível. */
function fetchAge(): Promise<number | undefined> {
  return healthSource.queryCharacteristics().then((c) => c.age);
}

/**
 * Parâmetros de zona do usuário para o sync. Zonas por **% da FC máxima** (padrão
 * Garmin), então FCrep não entra. `maxHrOverride` = FCmáx configurada pelo usuário
 * (`user_preferences.max_hr`); ausente, estima pela idade do Health (220 − idade).
 */
export async function fetchHrZoneParams(maxHrOverride?: number): Promise<HrZoneParams> {
  if (typeof maxHrOverride === 'number' && maxHrOverride > 0) return { maxHr: maxHrOverride };
  const age = await fetchAge();
  return { maxHr: maxHrFromAge(age) };
}

function mapRawWorkout(w: RawWorkout): WorkoutItem {
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
  const inner = healthSource
    .queryWorkouts({
      startDate: startDateYearsAgo(YEARS_BACK),
      endDate,
      limit: PAGE_SIZE,
      ascending: false,
    })
    .then((r) => r.workouts.map(mapRawWorkout));
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
  const fallback: WorkoutsDelta = { workouts: [], anchor: anchor ?? '' };
  const inner = healthSource
    .queryWorkouts({
      startDate: startDateYearsAgo(YEARS_BACK),
      limit: PAGE_SIZE,
      ascending: true,
      ...(anchor ? { anchor } : {}),
    })
    .then((r) => ({ workouts: r.workouts.map(mapRawWorkout), anchor: r.anchor || anchor || '' }));
  return withTimeout(inner, fallback);
}

/**
 * Varre todo o histórico de treinos (até YEARS_BACK), paginando até esgotar.
 * Usado pelo backfill por tipo, que precisa de TODOS os treinos do período.
 */
export async function fetchAllWorkouts(): Promise<WorkoutItem[]> {
  if (!healthSource.isAvailable()) return [];
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
