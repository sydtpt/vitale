/**
 * Agregações puras da visão geral do Histórico de Treinos (mobile).
 * Portado de web/.../data/overview.ts. Sem dependência de react-native —
 * testável isoladamente. Períodos = janelas móveis (ver spec §FR-003).
 */
import type { Activity } from '@vitale/shared';
import { getActivityMeta, getActivityColor } from './workout-types';

export type Period = 'semana' | 'ano' | 'sempre';
export type Metric = 'distance' | 'duration' | 'calories' | 'count';

export interface TypeSegment {
  label: string;
  color: string;
  value: number;
}
export interface OverviewBucket {
  key: string;
  label: string;
  total: number;
  segments: TypeSegment[];
  /** Barra de comparação (ex.: mesmo mês há um ano) — não entra nos totais. */
  comparison?: boolean;
  /** Barra em destaque (ex.: mês atual no período "Ano") — ganha mais espaço. */
  emphasis?: boolean;
}
export interface OverviewTotals {
  count: number;
  distanceM: number;
  durationS: number;
  calories: number;
}
export interface LegendItem {
  label: string;
  color: string;
}
export interface Overview {
  buckets: OverviewBucket[];
  totals: OverviewTotals;
  legend: LegendItem[];
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function metricValue(a: Activity, metric: Metric): number {
  switch (metric) {
    case 'distance':
      return a.distanceM ?? 0;
    case 'duration':
      return a.durationS;
    case 'calories':
      return a.calories;
    case 'count':
      return 1;
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

interface PlanBucket {
  key: string;
  label: string;
  comparison?: boolean;
  emphasis?: boolean;
}
interface BucketPlan {
  buckets: PlanBucket[];
  keyOf: (d: Date) => string;
}

function bucketPlan(activities: Activity[], period: Period, now: Date): BucketPlan {
  if (period === 'semana') {
    const buckets: PlanBucket[] = [];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
      buckets.push({ key: ymd(d), label: WEEKDAYS[d.getDay()] });
    }
    return { buckets, keyOf: (d) => ymd(d) };
  }

  if (period === 'ano') {
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const buckets: PlanBucket[] = [];
    // 11 meses anteriores + mês atual (em destaque, i === 0).
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: MONTHS[d.getMonth()], emphasis: i === 0 });
    }
    // Comparação: mesmo mês do ano anterior, DEPOIS do mês atual (à direita) —
    // fora da sequência cronológica p/ não se confundir com os meses passados.
    // Marcada como `comparison`: NÃO soma nos totais.
    const cmp = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    buckets.push({
      key: monthKey(cmp),
      label: `${MONTHS[cmp.getMonth()]} '${String(cmp.getFullYear()).slice(-2)}`,
      comparison: true,
    });
    return { buckets, keyOf: monthKey };
  }

  // sempre — um bucket por ano com dados
  const years = activities.map((a) => new Date(a.startAt).getFullYear());
  const buckets: PlanBucket[] = [];
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
): Overview {
  const plan = bucketPlan(activities, period, now);
  const bucketKeys = new Set(plan.buckets.map((b) => b.key));
  // chaves de comparação: aparecem no gráfico, mas ficam fora dos totais.
  const comparisonKeys = new Set(plan.buckets.filter((b) => b.comparison).map((b) => b.key));

  // só atividades cuja chave cai nos buckets do período (janela móvel)
  const within = activities.filter((a) => bucketKeys.has(plan.keyOf(new Date(a.startAt))));

  const totals: OverviewTotals = { count: 0, distanceM: 0, durationS: 0, calories: 0 };
  // chave do bucket → (label do tipo → valor acumulado)
  const perBucket = new Map<string, Map<string, number>>();
  // label do tipo → cor + total (para legenda/ordenação)
  const typeAgg = new Map<string, { color: string; total: number }>();

  for (const a of within) {
    const bk = plan.keyOf(new Date(a.startAt));

    // Barras de comparação alimentam o gráfico/legenda, mas não os totais.
    if (!comparisonKeys.has(bk)) {
      totals.count += 1;
      totals.distanceM += a.distanceM ?? 0;
      totals.durationS += a.durationS;
      totals.calories += a.calories;
    }

    const label = getActivityMeta(a.activityId).label;
    const color = getActivityColor(a.activityId);
    const value = metricValue(a, metric);

    const bucket = perBucket.get(bk) ?? new Map<string, number>();
    bucket.set(label, (bucket.get(label) ?? 0) + value);
    perBucket.set(bk, bucket);

    const t = typeAgg.get(label) ?? { color, total: 0 };
    t.total += value;
    typeAgg.set(label, t);
  }

  const legend: LegendItem[] = [...typeAgg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { color }]) => ({ label, color }));

  const buckets: OverviewBucket[] = plan.buckets.map(({ key, label, comparison, emphasis }) => {
    const agg = perBucket.get(key);
    const segments: TypeSegment[] = legend
      .map((li) => ({ label: li.label, color: li.color, value: agg?.get(li.label) ?? 0 }))
      .filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    return { key, label, total, segments, comparison, emphasis };
  });

  return { buckets, totals, legend };
}
