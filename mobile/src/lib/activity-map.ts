/**
 * Mapeamento puro `WorkoutItem` (HealthKit) → linhas das tabelas Supabase.
 * Sem dependência nativa — testável isoladamente.
 */
import { getActivityMeta, hasGpsRoute, type WorkoutItem, type RoutePoint } from './workout-types';
import type { ActivityRoutePoint } from '@vitale/shared';

/** Linha da tabela `activities` (snake_case, como no Postgres). */
export interface ActivityRow {
  id: string;
  user_id: string;
  activity_id: number;
  activity_name: string | null;
  calories: number;
  start_at: string;
  end_at: string;
  duration_s: number;
  distance_m: number | null;
  source_name: string | null;
  source_id: string | null;
  device: string | null;
  tracked: boolean | null;
  has_route: boolean;
  metadata: Record<string, unknown> | null;
}

/** Linha da tabela `activity_routes`. */
export interface ActivityRouteRow {
  activity_id: string;
  user_id: string;
  points: ActivityRoutePoint[];
  point_count: number;
}

/** A "chave do tipo" (label) usada para agrupar e inscrever. */
export function activityLabel(activityId: number): string {
  return getActivityMeta(activityId).label;
}

export function toActivityRow(w: WorkoutItem, userId: string): ActivityRow {
  const metadata: Record<string, unknown> = { ...(w.metadata ?? {}) };
  if (w.workoutEventsCount !== undefined) metadata.workoutEventsCount = w.workoutEventsCount;

  return {
    id: w.id,
    user_id: userId,
    activity_id: Math.round(w.activityId),
    activity_name: w.activityName || null,
    calories: Math.round(w.calories), // coluna int — HealthKit pode trazer fração
    start_at: w.start,
    end_at: w.end,
    duration_s: Math.round(w.duration), // coluna int — duração vem com fração de segundo
    distance_m: w.distance ?? null, // coluna numeric — fração OK
    source_name: w.sourceName ?? null,
    source_id: w.sourceId ?? null,
    device: w.device ?? null,
    tracked: w.tracked ?? null,
    has_route: hasGpsRoute(w.activityId),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  };
}

/**
 * Garante inteiros nas colunas `int` do Postgres. Usado ao reprocessar a fila,
 * onde podem existir linhas antigas mapeadas antes do arredondamento.
 */
export function sanitizeActivityRow(row: ActivityRow): ActivityRow {
  return {
    ...row,
    activity_id: Math.round(row.activity_id),
    calories: Math.round(row.calories),
    duration_s: Math.round(row.duration_s),
  };
}

export function toRouteRow(activityId: string, userId: string, points: RoutePoint[]): ActivityRouteRow {
  return {
    activity_id: activityId,
    user_id: userId,
    points: points.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      ...(p.altitude !== undefined ? { alt: p.altitude } : {}),
    })),
    point_count: points.length,
  };
}
