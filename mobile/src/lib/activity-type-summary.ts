/**
 * Agregados por tipo de atividade — de TODO o histórico (independente do filtro
 * de período do topo). Puro/testável. Ver spec §US3/FR-006.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Activity } from '@vitale/shared';
import { getActivityMeta, getActivityColor } from './workout-types';

export interface TypeSummary {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  count: number;
  totalDistanceM: number;
  totalDurationS: number;
  totalCalories: number;
  hasDistance: boolean;
}

export function buildTypeSummaries(activities: Activity[]): TypeSummary[] {
  const map = new Map<string, TypeSummary>();

  for (const a of activities) {
    const meta = getActivityMeta(a.activityId);
    let s = map.get(meta.label);
    if (!s) {
      s = {
        label: meta.label,
        icon: meta.icon,
        color: getActivityColor(a.activityId),
        count: 0,
        totalDistanceM: 0,
        totalDurationS: 0,
        totalCalories: 0,
        hasDistance: false,
      };
      map.set(meta.label, s);
    }
    s.count += 1;
    s.totalDistanceM += a.distanceM ?? 0;
    s.totalDurationS += a.durationS;
    s.totalCalories += a.calories;
  }

  for (const s of map.values()) s.hasDistance = s.totalDistanceM > 0;

  return [...map.values()].sort((a, b) => b.count - a.count);
}
