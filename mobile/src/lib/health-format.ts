/**
 * Helpers de agregação e formatação para a tab Saúde.
 * Normaliza amostras do Apple Health em buckets por Dia/Semana/Mês e calcula stats.
 */

export type Period = 'day' | 'week' | 'month';

/** Amostra normalizada vinda do HealthKit. */
export interface Sample {
  value: number;
  start: string; // ISO
  end: string; // ISO
  /** Rótulo para métricas categóricas (ex.: macro do nutriente). */
  label?: string;
  /** Valor secundário (ex.: diastólica na pressão arterial). */
  extra?: number;
}

/** Como agregar valores dentro de um bucket. */
export type MetricKind = 'cumulative' | 'discrete';

export interface Bucket {
  label: string;
  date: number; // ms — início do bucket
  value: number;
  count: number;
  empty: boolean;
}

export interface Stats {
  avg: number;
  min: number;
  max: number;
  total: number;
  latest: number;
  count: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Intervalo ISO coberto pelo período selecionado. */
export function periodRange(period: Period, now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now);
  const start = startOfDay(now);
  if (period === 'week') start.setDate(start.getDate() - 6);
  else if (period === 'month') start.setDate(start.getDate() - 29);
  // 'day' = só hoje (00:00 → agora)
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Quantos dias o período cobre (1 para 'day'). */
export function periodDays(period: Period): number {
  return period === 'day' ? 1 : period === 'week' ? 7 : 30;
}

/** Cria buckets vazios cobrindo todo o período (eixo X consistente). */
function emptyBuckets(period: Period, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  if (period === 'day') {
    const base = startOfDay(now).getTime();
    for (let h = 0; h < 24; h++) {
      buckets.push({
        label: `${String(h).padStart(2, '0')}h`,
        date: base + h * HOUR,
        value: 0,
        count: 0,
        empty: true,
      });
    }
  } else {
    const days = periodDays(period);
    const base = startOfDay(now);
    base.setDate(base.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const label = period === 'week' ? WEEKDAYS[d.getDay()] : String(d.getDate());
      buckets.push({ label, date: d.getTime(), value: 0, count: 0, empty: true });
    }
  }
  return buckets;
}

/** Distribui amostras nos buckets e agrega (soma para cumulative, média para discrete). */
export function bucketize(
  samples: Sample[],
  period: Period,
  kind: MetricKind,
  now = new Date()
): Bucket[] {
  const buckets = emptyBuckets(period, now);
  if (buckets.length === 0) return buckets;
  const origin = buckets[0].date;
  const step = period === 'day' ? HOUR : DAY;

  for (const s of samples) {
    const t = new Date(s.start).getTime();
    const idx = Math.floor((t - origin) / step);
    if (idx < 0 || idx >= buckets.length) continue;
    const b = buckets[idx];
    b.value += s.value;
    b.count += 1;
    b.empty = false;
  }

  if (kind === 'discrete') {
    for (const b of buckets) if (b.count > 0) b.value = b.value / b.count;
  }
  return buckets;
}

/** Estatísticas do período. Cumulative usa buckets diários; discrete usa amostras brutas. */
export function computeStats(samples: Sample[], buckets: Bucket[], kind: MetricKind): Stats {
  const values = samples.map((s) => s.value);
  const total = values.reduce((a, b) => a + b, 0);

  let avg = 0;
  let min = 0;
  let max = 0;

  if (kind === 'cumulative') {
    const filled = buckets.filter((b) => !b.empty).map((b) => b.value);
    if (filled.length > 0) {
      avg = filled.reduce((a, b) => a + b, 0) / filled.length;
      min = Math.min(...filled);
      max = Math.max(...filled);
    }
  } else if (values.length > 0) {
    avg = total / values.length;
    min = Math.min(...values);
    max = Math.max(...values);
  }

  // samples chegam ordenadas ascendentes → última é a mais recente
  const latest = samples.length > 0 ? samples[samples.length - 1].value : 0;
  return { avg, min, max, total, latest, count: values.length };
}

/** Formata número com separador de milhar pt-BR. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatHoursMin(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  const today = startOfDay(new Date()).getTime();
  const diff = Math.round((today - startOfDay(d).getTime()) / DAY);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
