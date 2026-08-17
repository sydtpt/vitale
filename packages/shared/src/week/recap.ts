/**
 * Resumo da semana ("recap") — agregados desta semana vs a anterior.
 * Derivação pura, sem Angular/DOM nem React — testável isoladamente e
 * compartilhada por web e mobile. Ver docs/specs/recap-semanal/.
 *
 * Roda apenas sobre dado REAL: atividades (HealthKit) e séries de `health_daily`.
 * Hábitos/registros são opcionais e entram via `countRecap` genérico, para o
 * card incluir só as seções que têm dado. Semana = segunda 00:00 a domingo 23:59
 * local; comparação sempre contra a semana imediatamente anterior.
 */
import type { Activity } from '../models/index';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Variação de uma métrica entre a semana atual e a anterior. */
export interface RecapValue {
  current: number;
  prior: number;
  delta: number;             // current − prior
  deltaPct: number | null;   // delta / prior * 100; null se prior = 0
}

/** Totais de atividade somados numa semana. */
export interface ActivityTotals {
  count: number;
  distanceM: number;
  durationS: number;
  calories: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Segunda-feira (00:00 local) da semana que contém `d`. */
export function mondayOf(d: Date): Date {
  const day = d.getDay();                  // 0=domingo … 6=sábado
  const diff = day === 0 ? 6 : day - 1;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** Intervalo [início, fim) da semana, `weeksAgo` semanas atrás (0 = atual). */
export function weekBounds(now: Date, weeksAgo = 0): { start: Date; end: Date } {
  const start = new Date(mondayOf(now).getTime() - weeksAgo * 7 * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  return { start, end };
}

/** Rótulo "dd/mm – dd/mm" da semana (segunda a domingo). */
export function weekLabel(now: Date): string {
  const { start, end } = weekBounds(now, 0);
  const sun = new Date(end.getTime() - DAY_MS);
  return `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} – ${pad2(sun.getDate())}/${pad2(sun.getMonth() + 1)}`;
}

/** Variação `current` vs `prior` em `RecapValue`. Exportada para reuso. */
export function recapValue(current: number, prior: number): RecapValue {
  const delta = current - prior;
  return { current, prior, delta, deltaPct: prior !== 0 ? (delta / prior) * 100 : null };
}

/** Totais de atividade num intervalo [start, end) — primitiva genérica. */
export function totalsInRange(activities: Activity[], start: Date, end: Date): ActivityTotals {
  const lo = start.getTime();
  const hi = end.getTime();
  const t: ActivityTotals = { count: 0, distanceM: 0, durationS: 0, calories: 0 };
  for (const a of activities) {
    const ts = new Date(a.startAt).getTime();
    if (ts < lo || ts >= hi) continue;
    t.count += 1;
    t.distanceM += a.distanceM ?? 0;
    t.durationS += a.durationS;
    t.calories += a.calories;
  }
  return t;
}

function totalsForWeek(activities: Activity[], now: Date, weeksAgo: number): ActivityTotals {
  const { start, end } = weekBounds(now, weeksAgo);
  return totalsInRange(activities, start, end);
}

/** Recap de atividades: cada total como variação atual vs anterior. */
export interface ActivityRecap {
  count: RecapValue;
  distanceM: RecapValue;
  durationS: RecapValue;
  calories: RecapValue;
}

export function activityRecap(activities: Activity[], now: Date = new Date()): ActivityRecap {
  const cur = totalsForWeek(activities, now, 0);
  const prev = totalsForWeek(activities, now, 1);
  return {
    count: recapValue(cur.count, prev.count),
    distanceM: recapValue(cur.distanceM, prev.distanceM),
    durationS: recapValue(cur.durationS, prev.durationS),
    calories: recapValue(cur.calories, prev.calories),
  };
}

/** Média de uma métrica diária na semana + nº de dias com valor. */
export interface MetricWeekAvg {
  avg: number | null;
  n: number;
}

/** Média + nº de dias com valor de uma métrica diária num intervalo [start, end). */
export function metricAvgInRange(
  valuesByDay: ReadonlyMap<string, number>,
  start: Date,
  end: Date,
): MetricWeekAvg {
  const vals: number[] = [];
  for (const [day, v] of valuesByDay) {
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (ts >= start.getTime() && ts < end.getTime()) vals.push(v);
  }
  if (vals.length === 0) return { avg: null, n: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
}

function metricAvg(valuesByDay: ReadonlyMap<string, number>, now: Date, weeksAgo: number): MetricWeekAvg {
  const { start, end } = weekBounds(now, weeksAgo);
  return metricAvgInRange(valuesByDay, start, end);
}

/** Nº de eventos (datas 'YYYY-MM-DD') que caem em [start, end). */
export function countInRange(eventDays: Iterable<string>, start: Date, end: Date): number {
  const lo = start.getTime();
  const hi = end.getTime();
  let c = 0;
  for (const day of eventDays) {
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (ts >= lo && ts < hi) c += 1;
  }
  return c;
}

/** Recap de uma métrica de saúde para dois intervalos arbitrários. */
export function metricRecapRange(
  valuesByDay: ReadonlyMap<string, number>,
  cur: { start: Date; end: Date },
  prev: { start: Date; end: Date },
): MetricRecap {
  const c = metricAvgInRange(valuesByDay, cur.start, cur.end);
  const p = metricAvgInRange(valuesByDay, prev.start, prev.end);
  if (c.avg == null) return { current: null, prior: p.avg, delta: null, deltaPct: null, n: c.n };
  if (p.avg == null) return { current: c.avg, prior: null, delta: null, deltaPct: null, n: c.n };
  const delta = c.avg - p.avg;
  return { current: c.avg, prior: p.avg, delta, deltaPct: p.avg !== 0 ? (delta / p.avg) * 100 : null, n: c.n };
}

/** Recap de uma métrica de saúde: média da semana vs anterior. */
export interface MetricRecap {
  current: number | null;
  prior: number | null;
  delta: number | null;
  deltaPct: number | null;
  n: number;
}

export function metricRecap(
  valuesByDay: ReadonlyMap<string, number>,
  now: Date = new Date(),
): MetricRecap {
  const cur = metricAvg(valuesByDay, now, 0);
  const prev = metricAvg(valuesByDay, now, 1);
  if (cur.avg == null) return { current: null, prior: prev.avg, delta: null, deltaPct: null, n: cur.n };
  if (prev.avg == null) return { current: cur.avg, prior: null, delta: null, deltaPct: null, n: cur.n };
  const delta = cur.avg - prev.avg;
  return {
    current: cur.avg,
    prior: prev.avg,
    delta,
    deltaPct: prev.avg !== 0 ? (delta / prev.avg) * 100 : null,
    n: cur.n,
  };
}

/** Contagem de eventos (hábito/registro) por semana — datas 'YYYY-MM-DD'. */
export function countRecap(eventDays: Iterable<string>, now: Date = new Date()): RecapValue {
  const cur = weekBounds(now, 0);
  const prev = weekBounds(now, 1);
  const days = Array.from(eventDays);
  return recapValue(
    countInRange(days, cur.start, cur.end),
    countInRange(days, prev.start, prev.end),
  );
}
