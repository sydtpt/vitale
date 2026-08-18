/**
 * Agregação semanal de volume de uma atividade — fonte única, sem I/O.
 *
 * Soma por semana (seg–dom, hora local) numa janela móvel de N semanas, na
 * métrica do tipo: `distance` → km (corrida, bicicleta); `duration` → min
 * (yoga e demais sem distância).
 *
 * O bucket carrega a semana em duas formas — `key` como 'YYYY-MM-DD' e `date`
 * em ms — porque os dois gráficos que consomem isto plotam de jeitos
 * diferentes. Derivar as duas aqui custa nada e evita que cada app converta
 * a sua, que foi como as duas cópias começaram a divergir.
 */
import type { Activity } from '../models';
import { mondayOf } from '../week/recap';
import { localDateStr } from '../date/local';

/** Códigos HealthKit dos tipos exibidos hoje. */
export const ACTIVITY_RUNNING = 37;
export const ACTIVITY_CYCLING = 13;
export const ACTIVITY_YOGA = 57;

/** Como medir o volume da semana. */
export type VolumeMetric = 'distance' | 'duration';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Uma semana da janela, pronta para o gráfico de barras. */
export interface VolumeWeekBucket {
  /** 'YYYY-MM-DD' da segunda-feira. */
  key: string;
  /** ms da segunda — para quem plota no eixo de tempo. */
  date: number;
  /** 'dd/mm' da segunda. */
  label: string;
  /** km (distance, 1 casa) ou min (duration, inteiro). */
  value: number;
  /** Nº de sessões na semana. */
  count: number;
  /** `true` quando a semana não teve sessão. */
  empty: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function labelOf(monday: Date): string {
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
}

/** Valor (na métrica) de uma atividade; 0 quando não conta. */
function metricValue(a: Activity, metric: VolumeMetric): number {
  return metric === 'distance' ? (a.distanceM ?? 0) : (a.durationS ?? 0);
}

function round(value: number, metric: VolumeMetric): number {
  return metric === 'distance'
    ? Math.round((value / 1000) * 10) / 10 // metros → km, 1 casa
    : Math.round(value / 60); //             segundos → min
}

export function buildWeeklyVolume(
  activities: Activity[],
  activityId: number,
  metric: VolumeMetric,
  weeks = 6,
  now: Date = new Date(),
): VolumeWeekBucket[] {
  const currentMonday = mondayOf(now);

  // ms da segunda → { valor bruto, sessões }
  const perWeek = new Map<number, { raw: number; count: number }>();
  for (const a of activities) {
    if (a.hidden || a.activityId !== activityId) continue;
    const raw = metricValue(a, metric);
    if (raw <= 0) continue;
    const key = mondayOf(new Date(a.startAt)).getTime();
    const agg = perWeek.get(key) ?? { raw: 0, count: 0 };
    agg.raw += raw;
    agg.count += 1;
    perWeek.set(key, agg);
  }

  // janela móvel: `weeks` semanas terminando na atual (antiga → atual)
  const buckets: VolumeWeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday.getTime() - i * 7 * DAY_MS);
    const agg = perWeek.get(monday.getTime());
    buckets.push({
      key: localDateStr(monday),
      date: monday.getTime(),
      label: labelOf(monday),
      value: agg ? round(agg.raw, metric) : 0,
      count: agg?.count ?? 0,
      empty: !agg,
    });
  }
  return buckets;
}
