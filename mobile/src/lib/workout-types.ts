/**
 * Tipos e helpers puros de treino — sem dependência de react-native / HealthKit.
 * Importável em testes e em código compartilhado sem mocks nativos.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type PermissionStatus = 'unknown' | 'authorized' | 'denied' | 'unavailable';

export interface WorkoutItem {
  id: string;
  activityId: number;
  activityName: string;
  calories: number;
  start: string;
  end: string;
  duration: number; // seconds — duração ativa (HKWorkout.duration, já exclui pausas). Para o "tempo total" use totalTimeS(start, end, duration).
  movingTimeS: number; // seconds — tempo em movimento (total menos pausas)
  distance?: number; // meters
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  metadata?: Record<string, unknown>;
  workoutEventsCount?: number;
}

/** Evento de treino do HealthKit (subconjunto usado para descontar pausas). */
export interface WorkoutEventLike {
  eventType?: string; // 'pause' | 'resume' | 'motion paused' | 'motion resumed' | ...
  startDate?: string;
}

const PAUSE_EVENT_TYPES = new Set(['pause', 'motion paused']);
const RESUME_EVENT_TYPES = new Set(['resume', 'motion resumed']);

/**
 * Soma (s) dos intervalos pausados a partir dos workoutEvents. Pareia cada pausa
 * com a próxima retomada e une intervalos sobrepostos, para que auto-pause e
 * pausa manual não sejam contados em dobro.
 */
export function pausedSecondsFromEvents(events: WorkoutEventLike[] | undefined): number {
  if (!events || events.length === 0) return 0;

  const sorted = events
    .map((e) => ({ type: (e.eventType ?? '').toLowerCase(), t: Date.parse(e.startDate ?? '') }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

  const intervals: Array<[number, number]> = [];
  let pauseStart: number | null = null;
  for (const e of sorted) {
    if (PAUSE_EVENT_TYPES.has(e.type)) {
      if (pauseStart === null) pauseStart = e.t;
    } else if (RESUME_EVENT_TYPES.has(e.type) && pauseStart !== null) {
      intervals.push([pauseStart, e.t]);
      pauseStart = null;
    }
  }

  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, end] of intervals) {
    if (s > curEnd) {
      if (curEnd >= 0) total += curEnd - curStart;
      curStart = s;
      curEnd = end;
    } else {
      curEnd = Math.max(curEnd, end);
    }
  }
  if (curEnd >= 0) total += curEnd - curStart;

  return Math.max(0, Math.round(total / 1000));
}

/**
 * Tempo em movimento (s): tempo decorrido (fim − início) menos as pausas. É
 * limitado por `durationS` (HKWorkout.duration), que já pode excluir pausas —
 * assim o tempo em movimento nunca passa do tempo total exibido.
 */
export function computeMovingTimeS(args: {
  start: string;
  end: string;
  durationS: number;
  events?: WorkoutEventLike[];
}): number {
  const duration = Math.max(0, Math.round(args.durationS));
  const elapsed = Math.round((Date.parse(args.end) - Date.parse(args.start)) / 1000);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return duration;

  const moving = elapsed - pausedSecondsFromEvents(args.events);
  // Conservador: o menor entre (decorrido − pausas) e o tempo total do HealthKit.
  return Math.max(0, duration > 0 ? Math.min(moving, duration) : moving);
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  /** Timestamp do ponto (ISO) vindo do HealthKit. Base do cálculo de best efforts. */
  timestamp?: string;
}

/**
 * Fator milha → metro. O react-native-health devolve a distância dos workouts
 * em milhas (`HKUnit mileUnit` no nativo), então convertemos na leitura para
 * manter `WorkoutItem.distance` em metros, como o resto do código assume.
 */
export const METERS_PER_MILE = 1609.344;

/** Converte a distância de workout do HealthKit (milhas) para metros. */
export function milesToMeters(miles?: number): number | undefined {
  return typeof miles === 'number' ? miles * METERS_PER_MILE : undefined;
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

export type ActivityMeta = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string };

export function getActivityMeta(activityId: number): ActivityMeta {
  switch (activityId) {
    case 11: return { icon: 'dumbbell', label: 'Cross Training' };
    case 13: return { icon: 'bike', label: 'Ciclismo' };
    case 16: return { icon: 'run-fast', label: 'Elíptico' };
    case 20: return { icon: 'kettlebell', label: 'Funcional' };
    case 24: return { icon: 'hiking', label: 'Trilha' };
    case 35: return { icon: 'rowing', label: 'Remo' };
    case 37: return { icon: 'run', label: 'Corrida' };
    case 44: return { icon: 'stairs-up', label: 'Escadas' };
    case 46: return { icon: 'swim', label: 'Natação' };
    case 50: return { icon: 'weight-lifter', label: 'Musculação' };
    case 52: return { icon: 'walk', label: 'Caminhada' };
    case 57: return { icon: 'yoga', label: 'Yoga' };
    case 59: return { icon: 'arm-flex', label: 'Core' };
    case 63: return { icon: 'jump-rope', label: 'HIIT' };
    case 66: return { icon: 'meditation', label: 'Pilates' };
    case 73: return { icon: 'heart-pulse', label: 'Cardio' };
    case 82: return { icon: 'tennis', label: 'Pickleball' };
    default: return { icon: 'dumbbell', label: 'Treino' };
  }
}

/**
 * Tipos de atividade conhecidos (ordem de uso comum) — para seletores de UI,
 * como o vínculo Tarefa × Treino. Cada id resolve label/ícone via getActivityMeta.
 */
export const KNOWN_ACTIVITY_IDS = [
  37, 13, 52, 24, 46, 50, 57, 66, 63, 73, 11, 20, 35, 16, 44, 59, 82,
] as const;

/**
 * Cor por tipo de atividade — espelha web/src/app/core/models/activity-types.ts
 * (valores do design system). Usada nos segmentos do gráfico empilhado.
 * Mantida aqui (hex literais) para a função pura permanecer testável sem tema.
 */
const ACTIVITY_COLORS: Record<number, string> = {
  11: '#D9491B', // Cross Training
  13: '#6E8CC9', // Ciclismo
  16: '#6FA86A', // Elíptico
  20: '#B4825B', // Funcional
  24: '#6FA86A', // Trilha
  35: '#6E8CC9', // Remo
  37: '#F25C2B', // Corrida
  44: '#B4825B', // Escadas
  46: '#6E8CC9', // Natação
  50: '#1F1B16', // Musculação
  52: '#F5B946', // Caminhada
  57: '#6FA86A', // Yoga
  59: '#E26A8A', // Core
  63: '#D9491B', // HIIT
  66: '#E26A8A', // Pilates
  73: '#E26A8A', // Cardio
  82: '#F5B946', // Pickleball
};

const DEFAULT_ACTIVITY_COLOR = '#5C534A';

export function getActivityColor(activityId: number): string {
  return ACTIVITY_COLORS[activityId] ?? DEFAULT_ACTIVITY_COLOR;
}

/**
 * Chave determinística para treinos sem UUID do HealthKit, garantindo dedup
 * estável no sync (FR-014). Mesmos campos → mesma chave entre execuções.
 */
export function deriveWorkoutId(parts: {
  activityId?: number;
  start?: string;
  end?: string;
  sourceId?: string;
}): string {
  return `hk-derived:${parts.activityId ?? 0}:${parts.start ?? ''}:${parts.end ?? ''}:${parts.sourceId ?? ''}`;
}

export const YEARS_BACK = 3;
export const PAGE_SIZE = 1000;

export function startDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}
