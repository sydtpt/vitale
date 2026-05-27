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
  moving_time_s: number | null;
  distance_m: number | null;
  source_name: string | null;
  source_id: string | null;
  device: string | null;
  tracked: boolean | null;
  has_route: boolean;
  metadata: Record<string, unknown> | null;
  /** Recordes de corrida (distância→segundos). Null fora de corrida ou sem GPS. */
  best_efforts: Record<string, number> | null;
  /** Tempo em zonas de FC (chave da zona→segundos). Null sem amostras de FC. */
  hr_zones: Record<string, number> | null;
  // Controle de edição manual — preenchidos só na leitura analítica
  // (Histórico de Treinos). O push-sync não os envia; o RPC os ignora.
  locally_edited?: boolean;
  edited_at?: string | null;
  hidden?: boolean;
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

export function toActivityRow(
  w: WorkoutItem,
  userId: string,
  bestEfforts?: Record<string, number>,
  hrZones?: Record<string, number>,
  /** Se fornecido, substitui hasGpsRoute(activityId) — use routes.has(w.id) no sync. */
  hasRoute?: boolean,
): ActivityRow {
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
    moving_time_s: w.movingTimeS != null ? Math.round(w.movingTimeS) : null,
    distance_m: w.distance ?? null, // coluna numeric — fração OK
    source_name: w.sourceName ?? null,
    source_id: w.sourceId ?? null,
    device: w.device ?? null,
    tracked: w.tracked ?? null,
    has_route: hasRoute ?? hasGpsRoute(w.activityId),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    best_efforts: bestEfforts && Object.keys(bestEfforts).length > 0 ? bestEfforts : null,
    hr_zones: hrZones && Object.keys(hrZones).length > 0 ? hrZones : null,
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
    moving_time_s: row.moving_time_s != null ? Math.round(row.moving_time_s) : null,
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
      ...(p.timestamp ? { t: new Date(p.timestamp).getTime() } : {}),
    })),
    point_count: points.length,
  };
}
