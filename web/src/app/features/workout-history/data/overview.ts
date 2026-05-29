/**
 * Agregações puras da visão geral do Histórico de Treinos.
 * Sem dependência de Angular/DOM — testável isoladamente.
 * Períodos = janelas móveis (ver .claude/specs/historico-treinos/spec.md §9).
 */
import type { Activity } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

export type Period = 'semana' | 'ano' | 'sempre';
export type Metric = 'distance' | 'duration' | 'calories' | 'count';

export interface TypeSegment { label: string; color: string; value: number; }
export interface OverviewBucket { key: string; label: string; total: number; segments: TypeSegment[]; }
export interface OverviewTotals { count: number; distanceM: number; durationS: number; calories: number; }
export interface LegendItem { label: string; color: string; }
export interface Overview { buckets: OverviewBucket[]; totals: OverviewTotals; legend: LegendItem[]; }

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function metricValue(a: Activity, metric: Metric): number {
  switch (metric) {
    case 'distance': return a.distanceM ?? 0;
    case 'duration': return a.durationS;
    case 'calories': return a.calories;
    case 'count': return 1;
  }
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

interface BucketPlan {
  buckets: { key: string; label: string }[];
  keyOf: (d: Date) => string;
}

function bucketPlan(activities: Activity[], period: Period, now: Date): BucketPlan {
  if (period === 'semana') {
    const buckets: { key: string; label: string }[] = [];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
      buckets.push({ key: ymd(d), label: WEEKDAYS[d.getDay()] });
    }
    return { buckets, keyOf: (d) => ymd(d) };
  }

  if (period === 'ano') {
    const buckets: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS[d.getMonth()] });
    }
    return { buckets, keyOf: (d) => `${d.getFullYear()}-${d.getMonth()}` };
  }

  // sempre — um bucket por ano com dados
  const years = activities.map((a) => new Date(a.startAt).getFullYear());
  const buckets: { key: string; label: string }[] = [];
  if (years.length) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    for (let y = min; y <= max; y++) buckets.push({ key: `${y}`, label: `${y}` });
  }
  return { buckets, keyOf: (d) => `${d.getFullYear()}` };
}

export function buildOverview(
  activities: Activity[],
  period: Period,
  metric: Metric,
  now: Date = new Date(),
  hidden: ReadonlySet<string> = new Set(),
): Overview {
  const plan = bucketPlan(activities, period, now);
  const bucketKeys = new Set(plan.buckets.map((b) => b.key));

  // só atividades cuja chave cai nos buckets do período (janela móvel)
  const within = activities.filter((a) => bucketKeys.has(plan.keyOf(new Date(a.startAt))));

  const totals: OverviewTotals = { count: 0, distanceM: 0, durationS: 0, calories: 0 };
  // chave do bucket → (label do tipo → valor acumulado)
  const perBucket = new Map<string, Map<string, number>>();
  // label do tipo → cor + total (para legenda/ordenação)
  const typeAgg = new Map<string, { color: string; total: number }>();

  for (const a of within) {
    const meta = metaForActivity(a.activityId);
    const value = metricValue(a, metric);

    // legenda sempre lista todos os tipos do período (ordem estável p/ reexibir)
    const t = typeAgg.get(meta.label) ?? { color: meta.color, total: 0 };
    t.total += value;
    typeAgg.set(meta.label, t);

    // totais e barras refletem apenas os tipos habilitados
    if (hidden.has(meta.label)) continue;

    totals.count += 1;
    totals.distanceM += a.distanceM ?? 0;
    totals.durationS += a.durationS;
    totals.calories += a.calories;

    const bk = plan.keyOf(new Date(a.startAt));
    const bucket = perBucket.get(bk) ?? new Map<string, number>();
    bucket.set(meta.label, (bucket.get(meta.label) ?? 0) + value);
    perBucket.set(bk, bucket);
  }

  const legend: LegendItem[] = [...typeAgg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { color }]) => ({ label, color }));

  const buckets: OverviewBucket[] = plan.buckets.map(({ key, label }) => {
    const agg = perBucket.get(key);
    const segments: TypeSegment[] = legend
      .map((li) => ({ label: li.label, color: li.color, value: agg?.get(li.label) ?? 0 }))
      .filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    return { key, label, total, segments };
  });

  return { buckets, totals, legend };
}
