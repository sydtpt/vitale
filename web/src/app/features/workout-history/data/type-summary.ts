/**
 * Agregados por tipo de atividade — de TODO o histórico (independente do filtro
 * de período do topo). Puro/testável. Ver spec §US3/FR-006.
 */
import type { Activity } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

export interface TypeSummary {
  label: string;
  slug: string;
  icon: string;
  color: string;
  hasDistance: boolean;
  count: number;
  distanceM: number;
  durationS: number;
  calories: number;
}

export function buildTypeSummaries(activities: Activity[]): TypeSummary[] {
  const map = new Map<string, TypeSummary>();

  for (const a of activities) {
    const meta = metaForActivity(a.activityId);
    let s = map.get(meta.label);
    if (!s) {
      s = {
        label: meta.label,
        slug: meta.slug,
        icon: meta.icon,
        color: meta.color,
        hasDistance: false,
        count: 0,
        distanceM: 0,
        durationS: 0,
        calories: 0,
      };
      map.set(meta.label, s);
    }
    s.count += 1;
    s.distanceM += a.distanceM ?? 0;
    s.durationS += a.durationS;
    s.calories += a.calories;
  }

  for (const s of map.values()) s.hasDistance = s.distanceM > 0;

  return [...map.values()].sort((a, b) => b.count - a.count);
}
