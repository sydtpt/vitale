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
