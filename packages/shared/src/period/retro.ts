/**
 * Retrospectiva — agrega "o que foi feito" num período (semana | mês | ano) e
 * compara com o período imediatamente anterior. Derivação 100% pura, sem
 * Angular/React: recebe dado já buscado (por intervalo) e devolve seções
 * tipadas + destaques em linguagem natural com insights cruzados.
 *
 * Reusa as primitivas de `../week/recap` (range-based), os recaps de saúde,
 * `detectTrend` e os utilitários de cruzamento (`triggerImpact`, `correlate`,
 * `sportHealthCorrelations`). Ver docs/specs/retrospectiva/.
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
import {
  type HighlightIcon,
  type HighlightKind,
  type HighlightTone,
  type WeekHighlight,
  compareHighlights,
  DEFAULT_HIGHLIGHT_KIND,
} from '../week/highlights';
import { activityTypeLabel } from '../fitness/activity-types';
import { dailyHardLoad } from '../health/aggregate';
import { detectTrend } from '../health/trends';
import { triggerImpact } from '../health/trigger-impact';
import { MOD } from '../constants/tokens';
import type { SleepPeriod } from '../models/index';
import {
  NIGHT_REFERENCE_H,
  sleepCrossHighlight,
  sleepCrossMetrics,
  sleepHighlights,
  sleepRetro,
  type SleepRetro,
} from '../sleep/retro';
import { SONO_MARKERS } from '../sleep/markers';
import { formatHm } from '../sleep/facts';
import { periodBounds, retroSince, type PeriodKind } from './bounds';

/**
 * Piso de relevância do insight cruzado (%). Abaixo disso a diferença entre os
 * dias com e sem o gatilho é ruído com aparência de achado, e um jornal não
 * publica isso. Ver docs/specs/retrospectiva/v2-jornal.md §2.5.
 */
export const MIN_CROSS_DELTA_PCT = 5;

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
  /** Unidade do contador ('L', 'un', 'cig'…); '' quando desconhecida. */
  unit?: string;
  /** dia 'YYYY-MM-DD' → valor acumulado. */
  logsByDay: ReadonlyMap<string, number>;
  /**
   * Dia de criação ('YYYY-MM-DD'), quando conhecido. Usado como `sinceDate` do
   * `triggerImpact`: sem ele, um hábito criado há 20 dias seria comparado contra
   * dias em que nem existia. Ausente ⇒ cai no início da janela de análise.
   */
  createdOn?: string;
}

/**
 * Série **diária** (`isDailyRecurrence`) + os dias em que foi concluída.
 *
 * Uma tarefa comum entra na retrospectiva só como contagem por módulo — o nome
 * se perde. Para o que se faz todo santo dia isso não serve: a pergunta é
 * *"quantos dias eu lembrei, e quantos esqueci"*, e ela precisa do nome, dos
 * dias e da janela em que a série esteve viva.
 *
 * A eleição é automática e a regra é uma só: **a série vale todos os dias da
 * semana**. Criar "comer uma fruta" como diária basta para ela aparecer aqui.
 *
 * Consumida por `buildTaskGrid`. Não alimenta o cruzamento de saúde — ver a nota
 * na montagem de `triggers`.
 */
export interface RetroDailyTask {
  id: string;
  name: string;
  /** Dias 'YYYY-MM-DD' com ocorrência concluída. */
  days: Iterable<string>;
  /** Dia de criação ('YYYY-MM-DD'): antes disso não havia o que esquecer. */
  createdOn?: string;
}

/** Registro avulso + dias marcados. */
export interface RetroRegistro {
  id: string;
  name: string;
  days: Iterable<string>;
  /** Dia de criação ('YYYY-MM-DD'), quando conhecido. Ver `RetroHabit.createdOn`. */
  createdOn?: string;
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
  /** Andares subidos por dia ('YYYY-MM-DD' → lances) — somado por período. */
  floorsByDay?: ReadonlyMap<string, number>;
  /** Passos por dia ('YYYY-MM-DD' → passos) — somado por período. */
  stepsByDay?: ReadonlyMap<string, number>;
  /** Notas subjetivas 1–5 (dia 'YYYY-MM-DD' → valor). */
  ratingsSleep?: ReadonlyMap<string, number>;
  ratingsDay?: ReadonlyMap<string, number>;
  habits: RetroHabit[];
  registros: RetroRegistro[];
  tasks: RetroTask[];
  /** Séries diárias + os dias em que foram concluídas — gatilhos do cruzamento. */
  dailyTasks?: RetroDailyTask[];
  purchases: RetroPurchase[];
  /** Aderência ao plano de treino no período (opcional). */
  plannedDone?: number;
  plannedTotal?: number;
  /**
   * As noites (`sleep_periods`) da janela buscada — o bloco Sono e as frases de
   * sono da manchete saem daqui, não de `health.sono`, que é uma soma por dia.
   * Ausente ⇒ `summary.sleep` é `null` e a retro segue como antes.
   */
  sleepPeriods?: readonly SleepPeriod[];
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
  /** Total de andares (lances de escada) subidos no período. */
  floors: RecapValue;
  /**
   * Total de passos no período. Vem de `health_daily`, não das atividades —
   * mede o movimento do dia inteiro, não só o que foi registrado como treino.
   */
  steps: RecapValue;
  byType: CountByKey[];
}

// ── Esportes (Ciclismo / Corrida) ──────────────────────────

/** Códigos HealthKit — espelham `running-highlights` (web) e `workout-types` (mobile). */
export const CYCLING_ACTIVITY_ID = 13;
export const RUNNING_ACTIVITY_ID = 37;

/** Chaves/labels dos recordes — DEVEM casar com `mobile/src/lib/best-efforts.ts`. */
const BEST_EFFORT_LABELS: { key: string; label: string }[] = [
  { key: '1000', label: '1 km' },
  { key: '5000', label: '5 km' },
  { key: '10000', label: '10 km' },
  { key: '20000', label: '20 km' },
  { key: 'half', label: 'Meia maratona' },
  { key: '30000', label: '30 km' },
  { key: '40000', label: '40 km' },
  { key: 'marathon', label: 'Maratona' },
];

/** Maior atividade do período (por distância). */
export interface SportLongest {
  /** id da atividade — permite linkar para o detalhe. */
  activityRef: string;
  distanceM: number;
  /** startAt ISO da atividade. */
  date: string;
}

/** Melhor tempo do período numa distância padrão (corrida). */
export interface SportBestEffort {
  key: string;                  // '1000' | '5000' | … | 'half' | 'marathon'
  label: string;                // '1 km' … 'Maratona'
  seconds: number;              // melhor do período (mín entre atividades)
  /** Melhor do período anterior; null sem base (ou kind 'all'). */
  priorSeconds: number | null;
  date: string;                 // startAt da atividade recordista
  activityRef: string;          // id da atividade recordista
}

/** Estatísticas de um esporte no período, com comparação vs anterior. */
export interface SportStats {
  activityId: number;           // 13 (Ciclismo) | 37 (Corrida)
  sessions: RecapValue;
  distanceM: RecapValue;
  /** Tempo em movimento (s); cai para durationS em linhas sem movingTimeS. */
  movingS: RecapValue;
  /** Ganho de elevação (m) somado no período. */
  elevationM: RecapValue;
  calories: RecapValue;
  /** Velocidade média (m/s) = distância ÷ tempo em movimento; null sem dado. */
  speedMps: { current: number | null; prior: number | null };
  longest: SportLongest | null;
  /** Só corrida; `[]` no ciclismo. */
  bestEfforts: SportBestEffort[];
}

/** Cards de esporte da Retrospectiva; null quando não há atividades no período. */
export interface RetroSports {
  cycling: SportStats | null;
  running: SportStats | null;
}

export interface RetroHabitRow {
  id: string;
  name: string;
  bad: boolean;
  /** Unidade do contador para exibição ('L', 'cig'…); '' quando desconhecida. */
  unit: string;
  /** dias com registro no período (× alvo é responsabilidade da UI). */
  recap: RecapValue;
  /** Soma dos valores registrados no período (ex.: litros de água). */
  total: RecapValue;
  /** Média diária do período — `total.current / perDayDays`. */
  perDay: number;
  /** Dias que entraram na média (ver `avgDays`); 0 quando não houve registro. */
  perDayDays: number;
}

/** Registro avulso agregado no período. Marca binária ⇒ quantidade = dias marcados. */
export interface RetroRegistroRow {
  id: string;
  name: string;
  /** dias marcados no período vs anterior. */
  recap: RecapValue;
  /** Intervalo médio entre marcações, em dias; 0 quando não houve marcação. */
  everyDays: number;
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
  registros: RetroRegistroRow[];
  fitness: RetroFitness;
  sports: RetroSports;
  health: RetroHealthRow[];
  ratings: { sleep: MetricRecap | null; day: MetricRecap | null };
  purchases: { count: RecapValue; spend: RecapValue; byCat: CountByKey[] };
  adherence: { done: number; total: number } | null;
  /** A noite típica do período contra a do anterior. `null` sem noites ou sem `sleepPeriods`. */
  sleep: SleepRetro | null;
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

/** Soma dos valores diários de uma métrica dentro de [start, end). */
function sumInRange(valuesByDay: ReadonlyMap<string, number>, start: Date, end: Date): number {
  let total = 0;
  for (const [day, v] of valuesByDay) {
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (ts >= start.getTime() && ts < end.getTime()) total += v;
  }
  return total;
}

const DAY_MS = 86_400_000;

/**
 * Dias que servem de divisor para a média diária de um hábito: do primeiro dia
 * com registro dentro do período até o fim do período (ou hoje, se o período
 * ainda está em curso).
 *
 * Ancorar no primeiro registro — em vez de usar o período inteiro — evita duas
 * distorções: 'Total' começa num epoch fixo (ano 2000) e hábitos criados no
 * meio de um ano/trimestre seriam divididos por dias em que nem existiam.
 */
function avgDays(logDays: string[], range: { start: Date; end: Date }, now: Date): number {
  const startTs = range.start.getTime();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const endTs = Math.min(range.end.getTime(), todayEnd);
  if (endTs <= startTs) return 0;

  let first = Infinity;
  for (const day of logDays) {
    const ts = new Date(`${day}T00:00:00`).getTime();
    if (ts >= startTs && ts < endTs && ts < first) first = ts;
  }
  if (!Number.isFinite(first)) return 0;
  // round absorve o ±1h do horário de verão.
  return Math.max(1, Math.round((endTs - first) / DAY_MS));
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

/**
 * Estatísticas de um esporte (por `activityId`) no período vs anterior.
 * Retorna null sem atividades no período corrente (o card some na UI).
 */
function sportStats(
  activities: Activity[],
  activityId: number,
  cur: { start: Date; end: Date },
  prev: { start: Date; end: Date },
  withBests: boolean,
): SportStats | null {
  const inRange = (a: Activity, r: { start: Date; end: Date }) => {
    const ts = new Date(a.startAt).getTime();
    return !a.hidden && a.activityId === activityId
      && ts >= r.start.getTime() && ts < r.end.getTime();
  };
  const curActs = activities.filter((a) => inRange(a, cur));
  if (curActs.length === 0) return null;
  const prevActs = activities.filter((a) => inRange(a, prev)); // vazio p/ 'all'

  const sum = (list: Activity[], sel: (a: Activity) => number | undefined) =>
    list.reduce((s, a) => s + (sel(a) ?? 0), 0);
  const moving = (a: Activity) => a.movingTimeS ?? a.durationS;

  const dCur = sum(curActs, (a) => a.distanceM);
  const dPrev = sum(prevActs, (a) => a.distanceM);
  const mCur = sum(curActs, moving);
  const mPrev = sum(prevActs, moving);
  const speed = (d: number, t: number) => (t > 0 && d > 0 ? d / t : null);

  let longest: SportLongest | null = null;
  for (const a of curActs) {
    if ((a.distanceM ?? 0) > (longest?.distanceM ?? 0)) {
      longest = { activityRef: a.id, distanceM: a.distanceM ?? 0, date: a.startAt };
    }
  }

  const bestEfforts: SportBestEffort[] = [];
  if (withBests) {
    for (const { key, label } of BEST_EFFORT_LABELS) {
      let best: { a: Activity; secs: number } | undefined;
      for (const a of curActs) {
        const secs = a.bestEfforts?.[key];
        if (typeof secs === 'number' && (!best || secs < best.secs)) best = { a, secs };
      }
      if (!best) continue;
      let prior: number | null = null;
      for (const a of prevActs) {
        const secs = a.bestEfforts?.[key];
        if (typeof secs === 'number' && (prior == null || secs < prior)) prior = secs;
      }
      bestEfforts.push({
        key, label,
        seconds: best.secs,
        priorSeconds: prior,
        date: best.a.startAt,
        activityRef: best.a.id,
      });
    }
  }

  return {
    activityId,
    sessions: recapValue(curActs.length, prevActs.length),
    distanceM: recapValue(dCur, dPrev),
    movingS: recapValue(mCur, mPrev),
    elevationM: recapValue(sum(curActs, (a) => a.elevationM), sum(prevActs, (a) => a.elevationM)),
    calories: recapValue(sum(curActs, (a) => a.calories), sum(prevActs, (a) => a.calories)),
    speedMps: { current: speed(dCur, mCur), prior: speed(dPrev, mPrev) },
    longest,
    bestEfforts,
  };
}

/** Constrói o resumo completo do período + período anterior para deltas. */
export function buildRetrospective(input: RetroInput): RetroSummary {
  const cur = periodBounds(input.now, input.kind, input.offset);
  // 'all' não tem período anterior: range degenerado (start === end) zera os
  // totais anteriores e anula os MetricRecap — a UI suprime os badges de delta.
  const prev = input.kind === 'all'
    ? { start: cur.start, end: cur.start, label: '' }
    : periodBounds(input.now, input.kind, input.offset - 1);

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
    floors: recapValue(
      input.floorsByDay ? sumInRange(input.floorsByDay, cur.start, cur.end) : 0,
      input.floorsByDay ? sumInRange(input.floorsByDay, prev.start, prev.end) : 0,
    ),
    steps: recapValue(
      input.stepsByDay ? sumInRange(input.stepsByDay, cur.start, cur.end) : 0,
      input.stepsByDay ? sumInRange(input.stepsByDay, prev.start, prev.end) : 0,
    ),
    // Agrupa por TIPO (activityId), não pelo nome livre da atividade — nomes
    // vindos do Strava/HealthKit ("Morning Ride", "Tour de la Meuse-Rhin") são
    // únicos por treino e fragmentariam a lista.
    byType: tallyByKey(
      inCur.map((a) => ({
        key: String(a.activityId),
        label: activityTypeLabel(a.activityId),
        sum: a.distanceM ?? 0,
      })),
    ),
  };

  // ── Esportes (Ciclismo / Corrida) ──
  const sports: RetroSports = {
    cycling: sportStats(input.activities, CYCLING_ACTIVITY_ID, cur, prev, false),
    running: sportStats(input.activities, RUNNING_ACTIVITY_ID, cur, prev, true),
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
    const total = sumInRange(h.logsByDay, cur.start, cur.end);
    const denom = avgDays(days, cur, input.now);
    return {
      id: h.id,
      name: h.name,
      bad: h.bad,
      unit: h.unit ?? '',
      recap: recapValue(
        countInRange(days, cur.start, cur.end),
        countInRange(days, prev.start, prev.end),
      ),
      total: recapValue(total, sumInRange(h.logsByDay, prev.start, prev.end)),
      perDay: denom > 0 ? total / denom : 0,
      perDayDays: denom,
    };
  };
  const habitRows = input.habits.map(habitRow);
  const habits = {
    good: habitRows.filter((r) => !r.bad),
    bad: habitRows.filter((r) => r.bad),
  };

  // ── Registros (marca binária: quantidade = dias marcados) ──
  // Só os que tiveram marcação no período ou no anterior — registros antigos ou
  // arquivados não devem encher a lista com zeros.
  const registros: RetroRegistroRow[] = input.registros
    .map((r) => {
      const days = [...new Set(r.days)];
      const count = countInRange(days, cur.start, cur.end);
      const denom = avgDays(days, cur, input.now);
      return {
        id: r.id,
        name: r.name,
        recap: recapValue(count, countInRange(days, prev.start, prev.end)),
        everyDays: count > 0 && denom > 0 ? denom / count : 0,
      };
    })
    .filter((r) => r.recap.current > 0 || r.recap.prior > 0)
    .sort((a, b) => b.recap.current - a.recap.current);

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

  // ── Sono ──
  // A noite pertence ao dia em que se acorda (`wakeDay`), a mesma ponte que
  // `health_daily` usa. Em 'all' não há anterior — `prev` é degenerado.
  const nightsIn = (start: Date, end: Date): SleepPeriod[] => {
    const lo = localDay(start);
    const hi = localDay(end);
    return (input.sleepPeriods ?? []).filter((p) => p.wakeDay >= lo && p.wakeDay < hi);
  };
  const sleep = input.sleepPeriods
    ? sleepRetro(
        nightsIn(cur.start, cur.end),
        input.kind === 'all' ? null : nightsIn(prev.start, prev.end),
        input.ratingsSleep,
        SONO_MARKERS,
      )
    : null;

  return {
    kind: input.kind,
    offset: input.offset,
    label: cur.label,
    startISO: localDay(cur.start),
    endISO: localDay(new Date(cur.end.getTime() - 1)),
    tasks,
    habits,
    registros,
    fitness,
    sports,
    health,
    ratings,
    purchases,
    adherence,
    sleep,
  };
}

// ── Destaques (linguagem natural, sensível ao período) ────

// 'season' vira 'trimestre' na prosa (templates masculinos: "neste ${noun}");
// o toggle da UI segue exibindo "Estação".
const PERIOD_NOUN: Record<PeriodKind, string> = {
  week: 'semana', month: 'mês', year: 'ano', season: 'trimestre', all: 'período',
};
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
  input: Pick<RetroInput, 'now' | 'kind' | 'activities' | 'health' | 'registros' | 'habits' | 'sleepPeriods'>,
): WeekHighlight[] {
  const out: WeekHighlight[] = [];
  const noun = PERIOD_NOUN[input.kind];
  const vs = `vs. ${noun} anterior`;
  // 'all' não tem período anterior: prev degenerado faz delta === current, então
  // as comparações seriam espúrias — texto sem delta e tom neutro.
  const noPrior = input.kind === 'all';

  // Treinos
  const c = summary.fitness.count;
  if (c.current > 0) {
    const dt = c.delta === 0 ? `igual ao ${noun} anterior`
      : `${c.delta > 0 ? '+' : '−'}${Math.abs(c.delta)} ${vs}`;
    out.push({
      id: 'workouts',
      kind: 'volume',
      tone: noPrior ? 'neutral' : tone(c.delta, c.deltaPct, false),
      icon: 'workout',
      text: noPrior
        ? `${c.current} treino${c.current > 1 ? 's' : ''} no total`
        : `${c.current} treino${c.current > 1 ? 's' : ''} neste ${noun} · ${dt}`,
      priority: c.deltaPct != null ? Math.abs(c.deltaPct) : c.current * 10,
    });
    const d = summary.fitness.distanceM;
    if (d.current > 0) {
      const km = (v: number) => `${fmt(v / 1000, 1)} km`;
      out.push({
        id: 'distance',
        kind: 'volume',
        tone: noPrior ? 'neutral' : tone(d.delta, d.deltaPct, false),
        icon: 'distance',
        text: noPrior
          ? `${km(d.current)} percorridos`
          : `${km(d.current)} percorridos · ${d.delta >= 0 ? '+' : '−'}${km(Math.abs(d.delta))}`,
        priority: d.deltaPct != null ? Math.abs(d.deltaPct) : 20,
      });
    }
  }

  // Saúde
  for (const h of summary.health) {
    // Com as noites gravadas, o sono fala por `sleepHighlights` — em minutos e
    // com vigília; a soma por dia de `health_daily` repetiria a mesma coisa em %.
    if (h.metric === 'sono' && summary.sleep) continue;
    const r = h.recap;
    if (r.current == null || r.delta == null) continue;
    const t = tone(r.delta, r.deltaPct, h.higherIsWorse);
    if (t === 'neutral') continue;
    const sign = r.delta >= 0 ? '+' : '−';
    const pct = r.deltaPct != null ? ` (${r.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(r.deltaPct))}%)` : '';
    out.push({
      id: `health-${h.metric}`, kind: 'health', tone: t, icon: h.icon,
      text: `${h.label} ${deltaWord(t)}: ${sign}${fmt(Math.abs(r.delta), h.decimals)}${h.unit}${pct}`,
      priority: r.deltaPct != null ? Math.abs(r.deltaPct) : 5,
    });
  }

  // Sono — horas e vigília como `health`; nota × medição como `cross`, que pode
  // ser a manchete do mês (decisão do usuário, 05/09/2026). Ver sleep/retro.ts.
  if (summary.sleep) out.push(...sleepHighlights(summary.sleep, noun, noPrior));

  // Gasto
  const spend = summary.purchases.spend;
  if (spend.current > 0 || spend.prior > 0) {
    const t = tone(spend.delta, spend.deltaPct, true);
    const pct = spend.deltaPct != null
      ? `${spend.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(spend.deltaPct))}% ${vs}` : 'sem base de comparação';
    out.push({
      id: 'spend',
      kind: 'volume',
      tone: noPrior ? 'neutral' : t,
      icon: 'money',
      text: noPrior
        ? `R$ ${fmt(spend.current)} em compras no total`
        : `R$ ${fmt(spend.current)} em compras · ${pct}`,
      priority: spend.deltaPct != null ? Math.abs(spend.deltaPct) : 8,
    });
  }

  // Tarefas
  const tk = summary.tasks.total;
  if (tk.current > 0) {
    out.push({
      id: 'tasks',
      kind: 'volume',
      tone: noPrior ? 'neutral' : tone(tk.delta, tk.deltaPct, false),
      icon: 'habit',
      text: noPrior
        ? `${tk.current} tarefa${tk.current > 1 ? 's' : ''} concluída${tk.current > 1 ? 's' : ''} no total`
        : `${tk.current} tarefa${tk.current > 1 ? 's' : ''} concluída${tk.current > 1 ? 's' : ''} neste ${noun}`,
      priority: tk.deltaPct != null ? Math.abs(tk.deltaPct) : 6,
    });
  }

  // ── Insight cruzado: gatilho (registro/hábito ruim) × saúde ──
  //
  // Duas mudanças em relação à v1, ambas do spec v2 §2:
  //  · a amostra vem da **janela de análise** (90d), não do período exibido — numa
  //    semana de 7 dias `MIN_DAYS_PER_SIDE = 3` de cada lado nunca fechava (D1);
  //  · o universo é **todas** as métricas de saúde, não só `sono ?? vfc`.
  const windowStart = localDay(retroSince(input.now, input.kind, 0));

  const triggers: { name: string; days: Set<string>; since: string }[] = [
    ...input.registros.map((r) => ({
      name: r.name,
      days: new Set(r.days),
      since: r.createdOn && r.createdOn > windowStart ? r.createdOn : windowStart,
    })),
    ...input.habits.filter((h) => h.bad).map((h) => ({
      name: h.name,
      days: new Set([...h.logsByDay.entries()].filter(([, v]) => v > 0).map(([d]) => d)),
      since: h.createdOn && h.createdOn > windowStart ? h.createdOn : windowStart,
    })),
  ];
  // Séries diárias (`input.dailyTasks`) NÃO entram aqui de propósito. Elas existem
  // para a faixa de adesão (`buildTaskGrid`): a pergunta é "lembrei ou esqueci",
  // não "que efeito teve". Como `cross` pesa 1000 na ordenação, promovê-las a
  // gatilho colocaria "nos dias com ZMA, sono +9%" no topo de todo domingo.

  for (const metric of input.health) {
    // Com as noites gravadas, o sono cruza pelo bloco abaixo — chaveado pelo dia em
    // que a noite começou. A soma diária (chave = dia de acordar) comparava a noite
    // ANTERIOR ao gatilho, então sai do universo assim que houver noite.
    if (metric.metric === 'sono' && summary.sleep) continue;
    for (const trig of triggers) {
      const imp = triggerImpact(metric.metric, trig.days, metric.valuesByDay, trig.since);
      if (!imp.enough || imp.delta == null || imp.deltaPct == null) continue;
      // Piso de relevância: abaixo disso é ruído com aparência de achado.
      if (Math.abs(imp.deltaPct) < MIN_CROSS_DELTA_PCT) continue;
      const worse = metric.higherIsWorse ? imp.delta > 0 : imp.delta < 0;
      out.push({
        id: `trigger-${trig.name}-${metric.metric}`,
        kind: 'cross',
        tone: worse ? 'bad' : 'good',
        icon: 'warning',
        text: `Nos dias com "${trig.name}", ${metric.label.toLowerCase()} ${imp.deltaPct >= 0 ? '+' : '−'}${fmt(Math.abs(imp.deltaPct))}%`,
        // A amostra é parte do destaque, não tooltip — no celular não há hover.
        support: `${imp.nWith} dias com · ${imp.nWithout} sem · associação, não causa`,
        priority: Math.abs(imp.deltaPct),
      });
    }
  }

  // ── Gatilho × noite: horas, vigília e fases, em valores absolutos ──
  // A mesma janela e os mesmos gatilhos; as grandezas vêm de `sleep_periods`,
  // chaveadas pelo dia em que a noite começou (sleep/retro.ts). É o cruzamento
  // que a proposta de 05/09 mediu como o mais forte dos dados — a cerveja.
  if (summary.sleep && input.sleepPeriods) {
    for (const m of sleepCrossMetrics(input.sleepPeriods)) {
      for (const trig of triggers) {
        const imp = triggerImpact(m.metric, trig.days, m.valuesByDay, trig.since);
        const h = sleepCrossHighlight(m, trig.name, imp, MIN_CROSS_DELTA_PCT);
        if (h) out.push(h);
      }
    }
  }

  // Classe primeiro, |deltaPct| depois. Ordenar por `priority` cru era o defeito D2:
  // "+1 treino" (=+50%) enterrava "sono −8% nos dias com cerveja".
  return out.sort(compareHighlights);
}

// ── A manchete (spec v2 §3) ────────────────────────────────

/**
 * O parágrafo de abertura da Retrospectiva — o que aconteceu com você no período,
 * em duas ou três frases.
 *
 * **Não é um gerador novo:** é `buildRetroHighlights` promovido. Os destaques já
 * são frases prontas em PT-BR e já vêm ordenados por classe; aqui escolhemos no
 * máximo um de cada classe e os colocamos em **ordem narrativa** — o fato, depois
 * a variação, depois o insight — que é o inverso da ordem de relevância.
 */
export interface RetroLede {
  /** Frases prontas, na ordem de leitura. Vazio = não houve material. */
  sentences: string[];
  /** Amostra/ressalva do insight cruzado, quando há um. */
  support?: string;
  /** true quando não houve material suficiente para uma manchete honesta. */
  thin: boolean;
}

/** Ordem **narrativa** — fato, variação, insight. Não é a ordem de relevância. */
const LEDE_ORDER: readonly HighlightKind[] = ['volume', 'anomaly', 'health', 'cross'];

function asSentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const head = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(head) ? head : `${head}.`;
}

/**
 * Monta a manchete a partir dos destaques **já ordenados** por
 * `buildRetroHighlights`. No máximo uma frase por classe e no máximo três frases:
 * um jornal tem uma manchete, não um índice.
 */
export function buildRetroLede(highlights: readonly WeekHighlight[]): RetroLede {
  const best = new Map<HighlightKind, WeekHighlight>();
  for (const h of highlights) {
    const k = h.kind ?? DEFAULT_HIGHLIGHT_KIND;
    // A lista já chega ordenada, então o primeiro de cada classe é o melhor dela.
    if (!best.has(k)) best.set(k, h);
  }

  const picked: WeekHighlight[] = [];
  for (const k of LEDE_ORDER) {
    const h = best.get(k);
    if (h) picked.push(h);
  }
  // 'volume' e 'anomaly' contam a mesma coisa (o fato do período) — fica só o melhor.
  const trimmed = picked.filter(
    (h, i) => !(i === 1 && (h.kind ?? DEFAULT_HIGHLIGHT_KIND) === 'anomaly'),
  ).slice(0, 3);

  const cross = best.get('cross');
  return {
    sentences: trimmed.map((h) => asSentence(h.text)),
    support: cross?.support,
    thin: trimmed.length === 0,
  };
}

// ── Heatmap genérico em N (spec v2 §4) ─────────────────────

/**
 * Metas por métrica de saúde. **Constante, não preferência** — descobre-se se o
 * número está certo usando, num domingo real; se estiver errado, aí vira campo.
 * Quando virar, seguir o padrão `DEFAULT_/MIN_/MAX_/resolve*` de
 * `health/who-activity.ts`. Mora aqui e só aqui. Ver v2-jornal.md §4.1.
 */
export const HEALTH_TARGETS: Readonly<Record<string, number>> = {
  // A mesma constante que o bloco Sono conta ("noites com 7 h ou mais"): um lugar só.
  sono: NIGHT_REFERENCE_H,
};

/** Meta da métrica, ou `null` quando não há uma — aí não cabe escala divergente. */
export function healthTarget(metric: string): number | null {
  return HEALTH_TARGETS[metric] ?? null;
}

/**
 * Passo da escala divergente. Negativo = pior que a meta, 0 = em cima dela,
 * positivo = melhor. **Sequencial não serve aqui:** deixaria a noite ruim pálida,
 * apagando exatamente o que importa.
 */
export type HeatStep = -3 | -2 | -1 | 0 | 1 | 2;


export interface HeatCell {
  day: string;                 // 'YYYY-MM-DD'
  /** Valor medido, ou null. **Não medido ≠ neutro** — um jornal não finge que mediu. */
  value: number | null;
  step: HeatStep | null;
  /** 0 = segunda … 6 = domingo. */
  weekday: number;
}

export interface Heatmap {
  metric: string;
  label: string;
  unit: string;
  decimals: number;
  higherIsWorse: boolean;
  target: number;
  cells: HeatCell[];
  /** Células vazias antes da primeira, p/ alinhar a grade que começa na segunda. */
  pad: number;
  /** Quantos dias do período têm valor. 0 ⇒ nada a mostrar. */
  measured: number;
}

/**
 * Cortes em **desvio relativo à meta** — assim a mesma escala serve métricas de
 * grandezas diferentes (horas de sono, bpm, ms de VFC).
 */
function heatStep(value: number, target: number, higherIsWorse: boolean): HeatStep {
  const raw = target === 0 ? 0 : (value - target) / target;
  // Onde subir é ruim (FC de repouso), inverter põe "pior" sempre do mesmo lado.
  const d = higherIsWorse ? -raw : raw;
  if (d <= -0.25) return -3;
  if (d <= -0.16) return -2;
  if (d <= -0.07) return -1;
  if (d < 0.035) return 0;
  if (d < 0.085) return 1;
  return 2;
}

/**
 * Uma célula por dia do período **exibido**, na ordem do calendário.
 *
 * **Genérico em `N` de propósito:** o número de células sai do período, não de um
 * "mês" codificado. Semana ⇒ 7 células, mês ⇒ 28–31, estação ⇒ ~90. É o que faz a
 * faixa semanal ser um parâmetro em vez de um componente novo.
 *
 * Devolve `null` quando a métrica não existe, não tem meta, ou não tem nenhum dia
 * medido no período.
 */
export function buildHeatmap(
  input: Pick<RetroInput, 'now' | 'kind' | 'offset' | 'health'>,
  metric: string,
): Heatmap | null {
  const m = input.health.find((h) => h.metric === metric);
  if (!m) return null;
  const target = healthTarget(metric);
  if (target == null) return null;

  const { start, end } = periodBounds(input.now, input.kind, input.offset);

  // Período ao vivo (estação, ano, total) inclui dias que **ainda não aconteceram**.
  // Renderizá-los como "sem dado" é mentira e, na prática, enche a tela de vazio:
  // uma estação em agosto traria setembro inteiro em branco. A grade para hoje.
  const tomorrow = new Date(input.now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const stop = end < tomorrow ? end : tomorrow;

  const cells: HeatCell[] = [];
  let measured = 0;

  for (const d = new Date(start); d < stop; d.setDate(d.getDate() + 1)) {
    const day = localDay(d);
    const raw = m.valuesByDay.get(day);
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    if (value != null) measured++;
    cells.push({
      day,
      value,
      step: value == null ? null : heatStep(value, target, m.higherIsWorse),
      // getDay(): 0 = domingo. Normalizado para 0 = segunda.
      weekday: (d.getDay() + 6) % 7,
    });
  }

  if (measured === 0) return null;

  return {
    metric,
    label: m.label,
    unit: m.unit ?? '',
    decimals: m.decimals ?? 1,
    higherIsWorse: m.higherIsWorse,
    target,
    cells,
    pad: cells[0]?.weekday ?? 0,
    measured,
  };
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
  /** Total de andares subidos no mês. */
  floors: number;
  /** Horas dormidas por noite, média do mês (de `sleep_periods`). 0 sem noite. */
  sleepH: number;
  /** Minutos acordado por noite, média sobre as noites que reportam. 0 sem noite. */
  awakeMin: number;
}

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Nome cheio do mês — para a leitura por toque do gráfico anual. */
export const MONTH_FULL_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export type YearSerieKey = keyof Pick<
  MonthBucket, 'workouts' | 'distanceKm' | 'tasks' | 'spend' | 'habitDays' | 'floors' | 'sleepH' | 'awakeMin'
>;

export interface YearSerie {
  key: YearSerieKey;
  label: string;
  /** Accent do módulo correspondente — cada série uma identidade só. */
  color: string;
  pick: (b: MonthBucket) => number;
  fmt: (v: number) => string;
}

/**
 * As seis séries que `buildYearByMonth` já calcula.
 *
 * **Mora no shared de propósito.** Até a v2 só `workouts` era desenhada e a
 * definição de "o que existe" vivia implícita em cada plataforma — foi assim que
 * web e mobile divergiram antes. Uma lista, dois renderizadores.
 * Ver docs/specs/retrospectiva/v2-jornal.md §5.
 */
export const YEAR_SERIES: readonly YearSerie[] = [
  { key: 'workouts', label: 'Treinos', color: MOD.treino.accent,
    pick: (b) => b.workouts,
    fmt: (v) => (v ? `${v} ${v > 1 ? 'sessões' : 'sessão'}` : 'sem dado') },
  { key: 'distanceKm', label: 'Distância', color: MOD.tarefa.accent,
    pick: (b) => b.distanceKm,
    fmt: (v) => (v ? `${v.toFixed(1).replace('.', ',')} km` : 'sem dado') },
  { key: 'tasks', label: 'Tarefas', color: MOD.cultura.accent,
    pick: (b) => b.tasks,
    fmt: (v) => (v ? `${v} feitas` : 'sem dado') },
  { key: 'spend', label: 'Gasto', color: MOD.compras.accent,
    pick: (b) => b.spend,
    fmt: (v) => (v ? `R$ ${v.toFixed(0)}` : 'sem dado') },
  { key: 'habitDays', label: 'Hábitos', color: MOD.habito.accent,
    pick: (b) => b.habitDays,
    fmt: (v) => (v ? `${v} ${v > 1 ? 'dias' : 'dia'}` : 'sem dado') },
  { key: 'floors', label: 'Andares', color: MOD.casa.accent,
    pick: (b) => b.floors,
    fmt: (v) => (v ? `${v} andares` : 'sem dado') },
  // Sono empresta a cor da água (ADR 0031); a vigília é amarela, como em toda tela
  // de sono. Duas séries sobre agregação que `sleep_periods` já permite.
  { key: 'sleepH', label: 'Sono', color: MOD.agua.accent,
    pick: (b) => b.sleepH,
    fmt: (v) => (v ? `${formatHm(v)} por noite` : 'sem noite') },
  { key: 'awakeMin', label: 'Acordado', color: MOD.food.accent,
    pick: (b) => b.awakeMin,
    fmt: (v) => (v ? `${Math.round(v)} min acordado por noite` : 'sem noite') },
];

/** 12 baldes mensais do ano de `input.now + input.offset` (modo anual). */
export function buildYearByMonth(input: RetroInput): MonthBucket[] {
  const year = input.now.getFullYear() + input.offset;
  const buckets: MonthBucket[] = MONTH_ABBR.map((label, month) => ({
    month, label, workouts: 0, distanceKm: 0, tasks: 0, spend: 0, habitDays: 0, floors: 0, sleepH: 0, awakeMin: 0,
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
  if (input.floorsByDay) {
    for (const [day, v] of input.floorsByDay) {
      const [y, m] = day.split('-').map(Number);
      if (y === year) buckets[m - 1].floors += v;
    }
  }
  if (input.sleepPeriods) {
    // A noite pertence ao mês em que se acorda, como no resto da retro. Médias, não
    // somas: "quanto dormi por noite" é a pergunta, e os meses têm n diferentes.
    const sleepSum = new Array<number>(12).fill(0);
    const sleepN = new Array<number>(12).fill(0);
    const awakeSum = new Array<number>(12).fill(0);
    const awakeN = new Array<number>(12).fill(0);
    for (const p of input.sleepPeriods) {
      const [y, m] = p.wakeDay.split('-').map(Number);
      if (y !== year) continue;
      sleepSum[m - 1] += p.asleepH;
      sleepN[m - 1] += 1;
      const aw = p.awakenings === null
        ? null
        : (p.awakenings ?? []).reduce((s, a) => s + (new Date(a.to).getTime() - new Date(a.from).getTime()) / 60_000, 0);
      if (aw !== null) { awakeSum[m - 1] += aw; awakeN[m - 1] += 1; }
    }
    for (let i = 0; i < 12; i++) {
      if (sleepN[i] > 0) buckets[i].sleepH = sleepSum[i] / sleepN[i];
      if (awakeN[i] > 0) buckets[i].awakeMin = awakeSum[i] / awakeN[i];
    }
  }
  return buckets;
}
