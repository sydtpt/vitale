/**
 * Agregação semanal de volume de uma atividade (mobile). Derivação pura.
 * ⚠️ Espelho de `web/src/app/features/treinos/data/weekly-volume.ts` — manter
 * as duas em sincronia.
 *
 * Soma por semana (seg–dom, hora local) numa janela móvel de N semanas, na
 * métrica do tipo: `distance` → km (corrida, bicicleta); `duration` → min
 * (yoga). Saída no formato `Bucket` (date = ms da segunda) para reusar o
 * `BarChart`.
 */
import type { Activity } from '@vitale/shared';
import type { Bucket } from './health-format';

/** Códigos HealthKit dos tipos exibidos. */
export const ACTIVITY_RUNNING = 37;
export const ACTIVITY_CYCLING = 13;
export const ACTIVITY_YOGA = 57;

export type VolumeMetric = 'distance' | 'duration';

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Segunda-feira (00:00 local) da semana que contém `d`. */
function mondayOf(d: Date): Date {
  const day = d.getDay();                  // 0=domingo … 6=sábado
  const diff = day === 0 ? 6 : day - 1;    // dias desde a segunda
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function labelOf(monday: Date): string {
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
}

function metricRaw(a: Activity, metric: VolumeMetric): number {
  return metric === 'distance' ? a.distanceM ?? 0 : a.durationS ?? 0;
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
): Bucket[] {
  const currentMonday = mondayOf(now);

  // ms da segunda → { valor bruto, sessões }
  const perWeek = new Map<number, { raw: number; count: number }>();
  for (const a of activities) {
    if (a.hidden || a.activityId !== activityId) continue;
    const raw = metricRaw(a, metric);
    if (raw <= 0) continue;
    const key = mondayOf(new Date(a.startAt)).getTime();
    const agg = perWeek.get(key) ?? { raw: 0, count: 0 };
    agg.raw += raw;
    agg.count += 1;
    perWeek.set(key, agg);
  }

  // janela móvel: `weeks` semanas terminando na atual (antiga → atual)
  const buckets: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday.getTime() - i * 7 * DAY_MS);
    const agg = perWeek.get(monday.getTime());
    buckets.push({
      label: labelOf(monday),
      date: monday.getTime(),
      value: agg ? round(agg.raw, metric) : 0,
      count: agg?.count ?? 0,
      empty: !agg,
    });
  }
  return buckets;
}
