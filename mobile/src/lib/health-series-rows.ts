/**
 * Série intradiária → a linha que a RPC `sync_upsert_health_series` lê.
 *
 * Uma fonte, duas formas, no mesmo ciclo: as amostras cruas de FC que
 * `health-aggregate.ts` resume na linha diária são as mesmas que
 * `bucketSeriesByMinute` (núcleo) transforma na série do dia. Este módulo só
 * veste o resultado para o Postgres — puro, sem dependência nativa.
 */
import type { HealthSeriesDay } from '@vitale/shared';

/** Linha de `health_series` (snake_case, como a RPC lê). */
export interface HealthSeriesRow {
  user_id: string;
  day: string;
  metric: string;
  tz_offset: number;
  minutes: number[];
  readings: number[];
}

export function toHealthSeriesRows(days: readonly HealthSeriesDay[]): HealthSeriesRow[] {
  return days.map((d) => ({
    user_id: d.userId,
    day: d.day,
    metric: d.metric,
    tz_offset: d.tzOffset,
    minutes: d.minutes,
    readings: d.readings,
  }));
}
