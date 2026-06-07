/**
 * Agregação semanal de volume de uma atividade a partir dos treinos
 * sincronizados. Derivação pura, sem Angular/DOM — testável.
 *
 * Soma por semana (seg–dom, hora local) numa janela móvel de N semanas, na
 * métrica do tipo: `distance` → km (corrida, bicicleta); `duration` → min
 * (yoga e demais sem distância). Substitui os mocks `RUNS`/`LIFTS` do /treinos.
 */
import type { Activity } from '@vitale/shared';
import { mondayOf } from '../../workout-history/data/weekly-load';

/** Códigos HealthKit dos tipos exibidos hoje. */
export const ACTIVITY_RUNNING = 37;
export const ACTIVITY_CYCLING = 13;
export const ACTIVITY_YOGA = 57;

/** Como medir o volume da semana. */
export type VolumeMetric = 'distance' | 'duration';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uma semana da janela, pronta para o gráfico de barras. */
export interface VolumeWeekBucket {
  key: string;   // 'YYYY-MM-DD' da segunda-feira
  label: string; // 'dd/mm' da segunda
  value: number; // km (distance, 1 casa) ou min (duration, inteiro)
  count: number; // nº de sessões na semana
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function keyOf(monday: Date): string {
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
}

function labelOf(monday: Date): string {
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
}

/** Valor (na métrica) de uma atividade; 0 quando não conta. */
function metricValue(a: Activity, metric: VolumeMetric): number {
  if (metric === 'distance') return a.distanceM ?? 0;
  return a.durationS ?? 0;
}

function round(value: number, metric: VolumeMetric): number {
  return metric === 'distance'
    ? Math.round((value / 1000) * 10) / 10 // metros → km, 1 casa
    : Math.round(value / 60);              // segundos → min
}

export function buildWeeklyVolume(
  activities: Activity[],
  activityId: number,
  metric: VolumeMetric,
  weeks = 6,
  now: Date = new Date(),
): VolumeWeekBucket[] {
  const currentMonday = mondayOf(now);

  // chave da segunda → { valor bruto, sessões }
  const perWeek = new Map<string, { raw: number; count: number }>();
  for (const a of activities) {
    if (a.hidden || a.activityId !== activityId) continue;
    const raw = metricValue(a, metric);
    if (raw <= 0) continue;
    const wk = keyOf(mondayOf(new Date(a.startAt)));
    const agg = perWeek.get(wk) ?? { raw: 0, count: 0 };
    agg.raw += raw;
    agg.count += 1;
    perWeek.set(wk, agg);
  }

  // janela móvel: `weeks` semanas terminando na atual (antiga → atual)
  const buckets: VolumeWeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday.getTime() - i * 7 * DAY_MS);
    const agg = perWeek.get(keyOf(monday));
    buckets.push({
      key: keyOf(monday),
      label: labelOf(monday),
      value: agg ? round(agg.raw, metric) : 0,
      count: agg?.count ?? 0,
    });
  }
  return buckets;
}
