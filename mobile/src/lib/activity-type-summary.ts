/**
 * Agregados por tipo de atividade — de TODO o histórico (independente do filtro
 * de período do topo). Puro/testável. Ver spec §US3/FR-006.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { buildTypeVolumeTrend, type Activity, type VolumeTrend } from '@vitale/shared';
import { getActivityMeta, getActivityColor } from './workout-types';

/** Semanas da sparkline do card. A tela do tipo mostra uma janela maior. */
const SPARK_WEEKS = 6;

export interface TypeSummary {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  count: number;
  totalDistanceM: number;
  totalDurationS: number;
  totalCalories: number;
  hasDistance: boolean;
  /**
   * As últimas seis semanas, para a sparkline e a variação do card.
   *
   * Sai do mesmo builder do painel da tela do tipo, só que com janela menor — o
   * card e a tela têm de concordar sobre o mesmo esporte.
   */
  trend: VolumeTrend;
}

export function buildTypeSummaries(
  activities: Activity[],
  /** Parâmetro para o teste: a tendência é uma janela móvel presa ao relógio. */
  now: Date = new Date(),
): TypeSummary[] {
  const map = new Map<string, Omit<TypeSummary, 'hasDistance' | 'trend'>>();

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
      };
      map.set(meta.label, s);
    }
    s.count += 1;
    s.totalDistanceM += a.distanceM ?? 0;
    s.totalDurationS += a.durationS;
    s.totalCalories += a.calories;
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .map((s) => {
      const hasDistance = s.totalDistanceM > 0;
      return {
        ...s,
        hasDistance,
        trend: buildTypeVolumeTrend(
          activities,
          (id) => getActivityMeta(id).label,
          s.label,
          hasDistance ? 'distance' : 'duration',
          SPARK_WEEKS,
          now,
        ),
      };
    });
}
