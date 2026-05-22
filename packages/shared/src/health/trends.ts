/**
 * Tendências, baselines e correlações de séries de saúde — derivações puras.
 * Operam sobre valores diários de `health_daily`. Sem I/O; usadas no client web.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[], m = mean(values)): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Média móvel trailing: cada ponto = média da janela terminando nele. */
export function movingAverage(values: number[], window: number): number[] {
  if (window <= 1) return [...values];
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    return mean(values.slice(start, i + 1));
  });
}

/** Regressão linear simples (mínimos quadrados) sobre x = 0..n-1. */
export function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: yMean - slope * xMean };
}

export type TrendDirection = 'up' | 'down' | 'flat';

export interface TrendResult {
  /** Inclinação por dia (unidades da métrica). */
  slope: number;
  /** Variação relativa por dia (slope / |média|). */
  relSlope: number;
  direction: TrendDirection;
}

/**
 * Classifica a tendência. `flatThreshold` é a variação relativa diária mínima
 * (ex.: 0.005 = 0,5%/dia) para considerar subida/queda; abaixo disso é estável.
 */
export function detectTrend(values: number[], flatThreshold = 0.005): TrendResult {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return { slope: 0, relSlope: 0, direction: 'flat' };
  const { slope } = linearRegression(clean);
  const m = Math.abs(mean(clean)) || 1;
  const relSlope = slope / m;
  const direction: TrendDirection =
    relSlope > flatThreshold ? 'up' : relSlope < -flatThreshold ? 'down' : 'flat';
  return { slope, relSlope, direction };
}

export interface AnomalyResult {
  z: number;
  anomaly: boolean;
}

/** Anomalia por z-score do valor frente à baseline (|z| > threshold). */
export function detectAnomaly(value: number, baseline: number, sd: number, threshold = 2): AnomalyResult {
  if (!Number.isFinite(value) || sd <= 0) return { z: 0, anomaly: false };
  const z = (value - baseline) / sd;
  return { z, anomaly: Math.abs(z) > threshold };
}

/** Coeficiente de Pearson sobre vetores pareados (0 se insuficiente/sem variância). */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

export interface PairedSeries {
  a: number[];
  b: number[];
  days: string[];
}

/** Pareia dois mapas dia→valor pela interseção de datas (ordenado por dia). */
export function pairByDay(a: Map<string, number>, b: Map<string, number>): PairedSeries {
  const days = [...a.keys()].filter((d) => b.has(d)).sort();
  return { days, a: days.map((d) => a.get(d) as number), b: days.map((d) => b.get(d) as number) };
}

export interface Correlation {
  coefficient: number;
  n: number;
}

/** Correlação de Pearson entre duas séries dia→valor (interseção de datas). */
export function correlate(a: Map<string, number>, b: Map<string, number>): Correlation {
  const paired = pairByDay(a, b);
  return { coefficient: pearson(paired.a, paired.b), n: paired.days.length };
}
