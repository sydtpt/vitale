/**
 * Retrospectiva — agrega "o que foi feito" num período (semana | mês | ano) e
 * compara com o período imediatamente anterior. Derivação 100% pura, sem
 * Angular/React: recebe dado já buscado (por intervalo) e devolve seções
 * tipadas + destaques em linguagem natural com insights cruzados.
 *
 * Reusa as primitivas de `../week/recap` (range-based), os recaps de saúde,
 * `detectTrend` e os utilitários de cruzamento (`triggerImpact`, `correlate`,
 * `sportHealthCorrelations`). Ver .claude/specs/retrospectiva/.
 */
import type { Activity } from '../models/index';
import {
  type RecapValue,
  type MetricRecap,
  recapValue,
  totalsInRange,
  countInRange,
  metricRecapRange,
} from '../week/recap';
import type { HighlightIcon, HighlightTone, WeekHighlight } from '../week/highlights';
import { dailyHardLoad } from '../health/aggregate';
import { detectTrend } from '../health/trends';
import { triggerImpact } from '../health/trigger-impact';
import { periodBounds, type PeriodKind } from './bounds';

// ── Entradas ───────────────────────────────────────────────

/** Tarefa concluída (de todo_occurrences done + módulo do template). */
export interface RetroTask {
  doneDay: string;   // 'YYYY-MM-DD' local de done_at
  module: string;    // geral | casa | saude | compras | financas
}

/** Compra concluída (occurrence done do módulo `compras`, com meta). */
export interface RetroPurchase {
  doneDay: string;   // 'YYYY-MM-DD' local
  cat?: string;
  price?: number;
  name: string;
}

/** Hábito (def mínima) + valores diários no período carregado. */
export interface RetroHabit {
  id: string;
  name: string;
  bad: boolean;
  /** dia 'YYYY-MM-DD' → valor acumulado. */
  logsByDay: ReadonlyMap<string, number>;
}

/** Registro avulso + dias marcados. */
export interface RetroRegistro {
  id: string;
  name: string;
  days: Iterable<string>;
}

/** Métrica de saúde a incluir no recap. */
export interface RetroHealthMetric {
  metric: string;
  label: string;
  /** Subir é ruim? (FC repouso = true; sono/VFC = false). */
  higherIsWorse: boolean;
  icon: HighlightIcon;
  decimals?: number;
  unit?: string;
  valuesByDay: ReadonlyMap<string, number>;
}

export interface RetroInput {
  now: Date;
  kind: PeriodKind;
  offset: number;
  activities: Activity[];
  health: RetroHealthMetric[];
  /** Notas subjetivas 1–5 (dia 'YYYY-MM-DD' → valor). */
  ratingsSleep?: ReadonlyMap<string, number>;
  ratingsDay?: ReadonlyMap<string, number>;
  habits: RetroHabit[];
  registros: RetroRegistro[];
  tasks: RetroTask[];
  purchases: RetroPurchase[];
  /** Aderência ao plano de treino no período (opcional). */
  plannedDone?: number;
  plannedTotal?: number;
}

// ── Saídas ─────────────────────────────────────────────────

export interface CountByKey {
  key: string;
  label: string;
  count: number;
  /** Soma associada (ex.: gasto), quando aplicável. */
  sum?: number;
}

export interface RetroFitness {
  count: RecapValue;
  distanceM: RecapValue;
  durationS: RecapValue;
  calories: RecapValue;
  hardMin: RecapValue;
  byType: CountByKey[];
}

export interface RetroHabitRow {
  id: string;
  name: string;
  bad: boolean;
  /** dias com registro no período (× alvo é responsabilidade da UI). */
  recap: RecapValue;
}

export interface RetroHealthRow {
  metric: string;
  label: string;
  higherIsWorse: boolean;
  icon: HighlightIcon;
  decimals: number;
  unit: string;
  recap: MetricRecap;
  trend: 'up' | 'down' | 'flat';
}

export interface RetroSummary {
  kind: PeriodKind;
  offset: number;
  label: string;
  startISO: string;
  endISO: string;
  tasks: { total: RecapValue; byModule: CountByKey[] };
  habits: { good: RetroHabitRow[]; bad: RetroHabitRow[] };
  fitness: RetroFitness;
  health: RetroHealthRow[];
  ratings: { sleep: MetricRecap | null; day: MetricRecap | null };
  purchases: { count: RecapValue; spend: RecapValue; byCat: CountByKey[] };
  adherence: { done: number; total: number } | null;
}

const MODULE_LABELS: Record<string, string> = {
  geral: 'Geral', casa: 'Casa', saude: 'Saúde', compras: 'Compras', financas: 'Finanças',
};

function localDay(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hardMinInRange(activities: Activity[], start: Date, end: Date): number {
  const byDay = dailyHardLoad(activities);
  let total = 0;
  for (const [day, min] of byDay) {
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (ts >= start.getTime() && ts < end.getTime()) total += min;
  }
  return total;
}

function tallyByKey(
  rows: { key: string; label: string; sum?: number }[],
): CountByKey[] {
  const map = new Map<string, CountByKey>();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { key: r.key, label: r.label, count: 0, sum: 0 };
    cur.count += 1;
    cur.sum = (cur.sum ?? 0) + (r.sum ?? 0);
    map.set(r.key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Constrói o resumo completo do período + período anterior para deltas. */
export function buildRetrospective(input: RetroInput): RetroSummary {
  const cur = periodBounds(input.now, input.kind, input.offset);
  const prev = periodBounds(input.now, input.kind, input.offset - 1);

  // ── Fitness ──
  const tCur = totalsInRange(input.activities, cur.start, cur.end);
  const tPrev = totalsInRange(input.activities, prev.start, prev.end);
  const inCur = input.activities.filter((a) => {
    const ts = new Date(a.startAt).getTime();
    return !a.hidden && ts >= cur.start.getTime() && ts < cur.end.getTime();
  });
  const fitness: RetroFitness = {
    count: recapValue(tCur.count, tPrev.count),
    distanceM: recapValue(tCur.distanceM, tPrev.distanceM),
    durationS: recapValue(tCur.durationS, tPrev.durationS),
    calories: recapValue(tCur.calories, tPrev.calories),
    hardMin: recapValue(
      hardMinInRange(input.activities, cur.start, cur.end),
      hardMinInRange(input.activities, prev.start, prev.end),
    ),
    byType: tallyByKey(
      inCur.map((a) => {
        const label = a.activityName?.trim() || 'Atividade';
        return { key: label, label, sum: a.distanceM ?? 0 };
      }),
    ),
  };

  // ── Tarefas ──
  const taskKey = (t: RetroTask, lo: number, hi: number) => {
    const ts = new Date(`${t.doneDay}T00:00:00`).getTime();
    return ts >= lo && ts < hi;
  };
  const tasksCur = input.tasks.filter((t) => taskKey(t, cur.start.getTime(), cur.end.getTime()));
  const tasksPrev = input.tasks.filter((t) => taskKey(t, prev.start.getTime(), prev.end.getTime()));
  const tasks = {
    total: recapValue(tasksCur.length, tasksPrev.length),
    byModule: tallyByKey(
      tasksCur.map((t) => ({ key: t.module, label: MODULE_LABELS[t.module] ?? t.module })),
    ),
  };

  // ── Hábitos ──
  const habitRow = (h: RetroHabit): RetroHabitRow => {
    const days = [...h.logsByDay.entries()].filter(([, v]) => v > 0).map(([d]) => d);
    return {
      id: h.id,
      name: h.name,
      bad: h.bad,
      recap: recapValue(
        countInRange(days, cur.start, cur.end),
        countInRange(days, prev.start, prev.end),
      ),
    };
  };
  const habitRows = input.habits.map(habitRow);
  const habits = {
    good: habitRows.filter((r) => !r.bad),
    bad: habitRows.filter((r) => r.bad),
  };

  // ── Saúde ──
  const health: RetroHealthRow[] = input.health.map((m) => {
    const recap = metricRecapRange(m.valuesByDay, cur, prev);
    // Tendência: valores ordenados por dia dentro do período corrente.
    const series = [...m.valuesByDay.entries()]
      .filter(([d]) => {
        const ts = new Date(`${d}T00:00:00`).getTime();
        return ts >= cur.start.getTime() && ts < cur.end.getTime();
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
    return {
      metric: m.metric,
      label: m.label,
      higherIsWorse: m.higherIsWorse,
      icon: m.icon,
      decimals: m.decimals ?? 0,
      unit: m.unit ?? '',
      recap,
      trend: series.length >= 3 ? detectTrend(series).direction : 'flat',
    };
  });

  // ── Ratings subjetivos ──
  const ratings = {
    sleep: input.ratingsSleep ? metricRecapRange(input.ratingsSleep, cur, prev) : null,
    day: input.ratingsDay ? metricRecapRange(input.ratingsDay, cur, prev) : null,
  };

  // ── Compras ──
  const inRange = (day: string, lo: number, hi: number) => {
    const ts = new Date(`${day}T00:00:00`).getTime();
    return ts >= lo && ts < hi;
  };
  const purchCur = input.purchases.filter((p) => inRange(p.doneDay, cur.start.getTime(), cur.end.getTime()));
  const purchPrev = input.purchases.filter((p) => inRange(p.doneDay, prev.start.getTime(), prev.end.getTime()));
  const spend = (rows: RetroPurchase[]) => rows.reduce((s, p) => s + (p.price ?? 0), 0);
  const purchases = {
    count: recapValue(purchCur.length, purchPrev.length),
    spend: recapValue(spend(purchCur), spend(purchPrev)),
    byCat: tallyByKey(
      purchCur.map((p) => ({ key: p.cat ?? 'Outros', label: p.cat ?? 'Outros', sum: p.price ?? 0 })),
    ),
  };

  const adherence = input.plannedTotal && input.plannedTotal > 0
    ? { done: input.plannedDone ?? 0, total: input.plannedTotal }
    : null;

  return {
    kind: input.kind,
    offset: input.offset,
    label: cur.label,
    startISO: localDay(cur.start),
    endISO: localDay(new Date(cur.end.getTime() - 1)),
    tasks,
    habits,
    fitness,
    health,
    ratings,
    purchases,
    adherence,
  };
}

// ── Destaques (linguagem natural, sensível ao período) ────

const PERIOD_NOUN: Record<PeriodKind, string> = { week: 'semana', month: 'mês', year: 'ano' };
const FLAT_PCT = 2;

function tone(delta: number | null, deltaPct: number | null, higherIsWorse: boolean): HighlightTone {
  if (delta == null || delta === 0) return 'neutral';
  if (deltaPct != null && Math.abs(deltaPct) < FLAT_PCT) return 'neutral';
  const worse = higherIsWorse ? delta > 0 : delta < 0;
  return worse ? 'bad' : 'good';
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function deltaWord(tone: HighlightTone): string {
  return tone === 'good' ? 'melhor' : tone === 'bad' ? 'pior' : 'estável';
}

/**
 * Gera destaques rankeados para a Retrospectiva, incluindo insights cruzados
 * (treino×sono, gatilhos×saúde). Recebe o `RetroSummary` e os mapas brutos
 * necessários para as correlações.
 */
export function buildRetroHighlights(
  summary: RetroSummary,
  input: Pick<RetroInput, 'kind' | 'activities' | 'health' | 'registros' | 'habits'>,
): WeekHighlight[] {
  const out: WeekHighlight[] = [];
  const noun = PERIOD_NOUN[input.kind];
  const vs = `vs. ${noun} anterior`;

  // Treinos
  const c = summary.fitness.count;
  if (c.current > 0) {
    const dt = c.delta === 0 ? `igual ao ${noun} anterior`
      : `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)} ${vs}`;
    out.push({
      id: 'workouts', tone: tone(c.delta, c.deltaPct, false), icon: 'workout',
      text: `${c.current} treino${c.current > 1 ? 's' : ''} neste ${noun} · ${dt}`,
      priority: c.deltaPct != null ? Math.abs(c.deltaPct) : c.current * 10,
    });
    const d = summary.fitness.distanceM;
    if (d.current > 0) {
      const km = (v: number) => `${fmt(v / 1000, 1)} km`;
      out.push({
        id: 'distance', tone: tone(d.delta, d.deltaPct, false), icon: 'distance',
        text: `${km(d.current)} percorridos · ${d.delta >= 0 ? '+' : '−'}${km(Math.abs(d.delta))}`,
        priority: d.deltaPct != null ? Math.abs(d.deltaPct) : 20,
      });
    }
  }

  // Saúde
  for (const h of summary.health) {
    const r = h.recap;
    if (r.current == null || r.delta == null) continue;
    const t = tone(r.delta, r.deltaPct, h.higherIsWorse);
    if (t === 'neutral') continue;
    const sign = r.delta >= 0 ? '+' : '−';
    const pct = r.deltaPct != null ? ` (${r.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(r.deltaPct))}%)` : '';
    out.push({
      id: `health-${h.metric}`, tone: t, icon: h.icon,
      text: `${h.label} ${deltaWord(t)}: ${sign}${fmt(Math.abs(r.delta), h.decimals)}${h.unit}${pct}`,
      priority: r.deltaPct != null ? Math.abs(r.deltaPct) : 5,
    });
  }

  // Gasto
  const spend = summary.purchases.spend;
  if (spend.current > 0 || spend.prior > 0) {
    const t = tone(spend.delta, spend.deltaPct, true);
    const pct = spend.deltaPct != null
      ? `${spend.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(spend.deltaPct))}% ${vs}` : 'sem base de comparação';
    out.push({
      id: 'spend', tone: t, icon: 'money',
      text: `R$ ${fmt(spend.current)} em compras · ${pct}`,
      priority: spend.deltaPct != null ? Math.abs(spend.deltaPct) : 8,
    });
  }

  // Tarefas
  const tk = summary.tasks.total;
  if (tk.current > 0) {
    out.push({
      id: 'tasks', tone: tone(tk.delta, tk.deltaPct, false), icon: 'habit',
      text: `${tk.current} tarefa${tk.current > 1 ? 's' : ''} concluída${tk.current > 1 ? 's' : ''} neste ${noun}`,
      priority: tk.deltaPct != null ? Math.abs(tk.deltaPct) : 6,
    });
  }

  // ── Insight cruzado: gatilho (registro/hábito ruim) × saúde ──
  const sleepMetric = input.health.find((m) => m.metric === 'sono')
    ?? input.health.find((m) => m.metric === 'vfc');
  if (sleepMetric) {
    const triggers: { name: string; days: Set<string> }[] = [
      ...input.registros.map((r) => ({ name: r.name, days: new Set(r.days) })),
      ...input.habits.filter((h) => h.bad).map((h) => ({
        name: h.name,
        days: new Set([...h.logsByDay.entries()].filter(([, v]) => v > 0).map(([d]) => d)),
      })),
    ];
    for (const trig of triggers) {
      const imp = triggerImpact(sleepMetric.metric, trig.days, sleepMetric.valuesByDay);
      if (!imp.enough || imp.delta == null || imp.deltaPct == null || Math.abs(imp.deltaPct) < 5) continue;
      const worse = sleepMetric.higherIsWorse ? imp.delta > 0 : imp.delta < 0;
      out.push({
        id: `trigger-${trig.name}`, tone: worse ? 'bad' : 'good', icon: 'warning',
        text: `Nos dias com "${trig.name}", ${sleepMetric.label.toLowerCase()} ${imp.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(imp.deltaPct))}%`,
        priority: Math.abs(imp.deltaPct) + 3,
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
}

// ── Breakdown mensal (modo anual) ──────────────────────────

export interface MonthBucket {
  /** 0–11. */
  month: number;
  label: string;        // 'Jan' … 'Dez'
  workouts: number;
  distanceKm: number;
  tasks: number;
  spend: number;
  habitDays: number;
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** 12 baldes mensais do ano de `input.now + input.offset` (modo anual). */
export function buildYearByMonth(input: RetroInput): MonthBucket[] {
  const year = input.now.getFullYear() + input.offset;
  const buckets: MonthBucket[] = MONTH_ABBR.map((label, month) => ({
    month, label, workouts: 0, distanceKm: 0, tasks: 0, spend: 0, habitDays: 0,
  }));

  for (const a of input.activities) {
    if (a.hidden) continue;
    const d = new Date(a.startAt);
    if (d.getFullYear() !== year) continue;
    const b = buckets[d.getMonth()];
    b.workouts += 1;
    b.distanceKm += (a.distanceM ?? 0) / 1000;
  }
  for (const t of input.tasks) {
    const [y, m] = t.doneDay.split('-').map(Number);
    if (y === year) buckets[m - 1].tasks += 1;
  }
  for (const p of input.purchases) {
    const [y, m] = p.doneDay.split('-').map(Number);
    if (y === year) buckets[m - 1].spend += p.price ?? 0;
  }
  for (const h of input.habits) {
    for (const [day, v] of h.logsByDay) {
      if (v <= 0) continue;
      const [y, m] = day.split('-').map(Number);
      if (y === year) buckets[m - 1].habitDays += 1;
    }
  }
  return buckets;
}
