/**
 * Agregados por tipo de atividade — de TODO o histórico (independente do filtro
 * de período do topo). Puro/testável. Ver spec §US3/FR-006.
 */
import { buildTypeVolumeTrend, type Activity, type VolumeTrend } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

/** Semanas da sparkline do card. A página do tipo mostra uma janela maior. */
const SPARK_WEEKS = 6;

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
  /**
   * As últimas seis semanas, para a sparkline e a variação do card.
   *
   * Sai do mesmo builder do painel da página do tipo, só que com janela menor —
   * o card e a página têm de concordar sobre o mesmo esporte.
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
    const meta = metaForActivity(a.activityId);
    let s = map.get(meta.label);
    if (!s) {
      s = {
        label: meta.label,
        slug: meta.slug,
        icon: meta.icon,
        color: meta.color,
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

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .map((s) => {
      const hasDistance = s.distanceM > 0;
      return {
        ...s,
        hasDistance,
        trend: buildTypeVolumeTrend(
          activities,
          (id) => metaForActivity(id).label,
          s.label,
          hasDistance ? 'distance' : 'duration',
          SPARK_WEEKS,
          now,
        ),
      };
    });
}
