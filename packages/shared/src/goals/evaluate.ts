/**
 * Avaliação de progresso de Metas — derivação 100% pura (sem Angular/React),
 * compartilhada por web e mobile. Datas em horário local. Ver .claude/specs/web-metas.md.
 *
 * Uma Meta pertence a um ano e mede progresso conforme a `family`:
 *  - cadence    → nº de sub-períodos (semana|mês) que cumpriram "≥N por período";
 *  - milestone  → atingiu um marco único no ano (limiar/best-effort/contagem);
 *  - cumulative → soma no ano até um alvo.
 *
 * A `source` diz de ONDE vem o sinal: atividades HealthKit, tarefas concluídas,
 * hábitos contadores ou valor manual. A função filtra os dados brutos recebidos
 * pela `source` de cada meta — o chamador pode passar TODAS as atividades/ocorrências.
 */
import type {
  Activity,
  CounterHabit,
  Goal,
  HabitLog,
  TodoOccurrence,
} from '../models/index';
import { mondayOf } from '../week/recap';

/** Dados brutos para avaliar uma (ou várias) metas. */
export interface GoalContext {
  activities: Activity[];
  /** Ocorrências de tarefa concluídas (status 'done', com doneAt). */
  doneOccurrences: TodoOccurrence[];
  /** Logs de hábitos contadores (de qualquer hábito; filtrados por source.habitId). */
  habitLogs: HabitLog[];
  /** Definições de hábito contador (para direção/meta ao contar dias cumpridos). */
  habits: Pick<CounterHabit, 'id' | 'direction' | 'target'>[];
  now: Date;
}

/** Estado de um sub-período de uma meta de cadência (um mês ou uma semana). */
export interface GoalPeriodStatus {
  /** Índice no ano (0-based). Mês: 0=jan … 11=dez. Semana: 0=1ª semana ISO. */
  index: number;
  /** Início do sub-período (epoch ms, 00:00 local) — a UI deriva o rótulo. */
  start: number;
  /** Eventos contados no sub-período (contagem/distância conforme a fonte). */
  count: number;
  /** Cumpriu a meta do período (count ≥ perPeriodTarget)? */
  met: boolean;
  /** Já começou (start ≤ now)? Sub-períodos futuros ficam `false`. */
  started: boolean;
  /** É o sub-período que contém `now`? */
  current: boolean;
}

/** Resultado da avaliação de uma meta. */
export interface GoalProgress {
  current: number;
  target: number;
  /** 0..100, saturado. */
  pct: number;
  achieved: boolean;
  // Só em cadence:
  periodsTotal?: number;    // sub-períodos do ano (12 meses; ~52 semanas)
  periodsMet?: number;      // sub-períodos já iniciados que cumpriram
  currentPeriodMet?: boolean; // o sub-período que contém `now` já cumpriu?
  periods?: GoalPeriodStatus[]; // detalhamento por sub-período (meses/semanas)
}

interface GoalEvent {
  time: number;   // epoch ms (dia local do evento)
  value: number;  // 1 p/ contagem; metros p/ distância
}

/** Bateu a meta do hábito? Espelha isMet de habit-logic (mantido fora do shared). */
function habitMet(habit: Pick<CounterHabit, 'direction' | 'target'>, value: number): boolean {
  if (habit.target == null) return false;
  return habit.direction === 'at_least' ? value >= habit.target : value <= habit.target;
}

function yearBounds(year: number): { start: number; end: number } {
  return {
    start: new Date(year, 0, 1).getTime(),
    end: new Date(year + 1, 0, 1).getTime(),
  };
}

/** Epoch ms (00:00 local) de uma data 'YYYY-MM-DD'. */
function dayTime(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}

/**
 * Eventos da meta dentro do ano, segundo a `source`. Para 'bestEffort' o valor é
 * tratado à parte no milestone (não gera evento aqui).
 */
function collectEvents(goal: Goal, ctx: GoalContext): GoalEvent[] {
  const { start, end } = yearBounds(goal.year);
  const src = goal.source;
  const events: GoalEvent[] = [];

  if (src.kind === 'activity') {
    const metric = src.activityMetric ?? 'count';
    for (const a of ctx.activities) {
      if (a.hidden) continue;
      if (src.activityId != null && a.activityId !== src.activityId) continue;
      const t = new Date(a.startAt).getTime();
      if (t < start || t >= end) continue;
      const value = metric === 'distance' ? a.distanceM ?? 0 : 1;
      events.push({ time: t, value });
    }
  } else if (src.kind === 'task') {
    for (const o of ctx.doneOccurrences) {
      if (o.templateId !== src.templateId || o.status !== 'done' || !o.doneAt) continue;
      const t = new Date(o.doneAt).getTime();
      if (t < start || t >= end) continue;
      events.push({ time: t, value: 1 });
    }
  } else if (src.kind === 'habit') {
    const habit = ctx.habits.find((h) => h.id === src.habitId);
    if (habit) {
      for (const log of ctx.habitLogs) {
        if (log.habitId !== src.habitId) continue;
        const t = dayTime(log.logDate);
        if (t < start || t >= end) continue;
        if (habitMet(habit, log.value)) events.push({ time: t, value: 1 });
      }
    }
  }
  // 'manual' não gera eventos — usa goal.manualCurrent.
  return events;
}

/** Enumera os sub-períodos [start,end) do ano para cadência. */
function subPeriods(year: number, kind: 'week' | 'month'): { start: number; end: number }[] {
  const { end: yearEnd } = yearBounds(year);
  const out: { start: number; end: number }[] = [];
  if (kind === 'month') {
    for (let m = 0; m < 12; m++) {
      out.push({ start: new Date(year, m, 1).getTime(), end: new Date(year, m + 1, 1).getTime() });
    }
  } else {
    let s = mondayOf(new Date(year, 0, 1)).getTime();
    while (s < yearEnd) {
      const e = s + 7 * 24 * 60 * 60 * 1000;
      out.push({ start: s, end: e });
      s = e;
    }
  }
  return out;
}

function clampPct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function evalCadence(goal: Goal, ctx: GoalContext): GoalProgress {
  const kind = goal.period ?? 'month';
  const perTarget = goal.perPeriodTarget ?? 1;
  const events = collectEvents(goal, ctx);
  const periods = subPeriods(goal.year, kind);
  const nowMs = ctx.now.getTime();

  let periodsMet = 0;
  let currentPeriodMet: boolean | undefined;
  const breakdown: GoalPeriodStatus[] = periods.map((p, index) => {
    const count = events.reduce((n, e) => (e.time >= p.start && e.time < p.end ? n + e.value : n), 0);
    const met = count >= perTarget;
    const started = p.start <= nowMs;
    const current = nowMs >= p.start && nowMs < p.end;
    if (started && met) periodsMet += 1; // só sub-períodos já iniciados
    if (current) currentPeriodMet = met;
    return { index, start: p.start, count, met, started, current };
  });

  const target = goal.target > 0 ? goal.target : periods.length;
  return {
    current: periodsMet,
    target,
    pct: clampPct(periodsMet, target),
    achieved: periodsMet >= target,
    periodsTotal: periods.length,
    periodsMet,
    currentPeriodMet,
    periods: breakdown,
  };
}

function evalMilestone(goal: Goal, ctx: GoalContext): GoalProgress {
  const src = goal.source;
  let current = 0;

  if (src.kind === 'manual') {
    current = goal.manualCurrent ?? 0;
  } else if (src.kind === 'activity' && (src.activityMetric ?? 'count') === 'bestEffort') {
    // marco por best-effort (ex.: meia-maratona): atingido se alguma atividade do
    // ano registrou o esforço-padrão pedido.
    const { start, end } = yearBounds(goal.year);
    const key = src.bestEffortKey ?? 'half';
    const hit = ctx.activities.some((a) => {
      if (a.hidden) return false;
      if (src.activityId != null && a.activityId !== src.activityId) return false;
      const t = new Date(a.startAt).getTime();
      return t >= start && t < end && a.bestEfforts?.[key] != null;
    });
    return { current: hit ? goal.target : 0, target: goal.target, pct: hit ? 100 : 0, achieved: hit };
  } else if (src.kind === 'activity' && (src.activityMetric ?? 'count') === 'distance') {
    // marco por distância única (ex.: correr X metros numa só atividade).
    const { start, end } = yearBounds(goal.year);
    for (const a of ctx.activities) {
      if (a.hidden) continue;
      if (src.activityId != null && a.activityId !== src.activityId) continue;
      const t = new Date(a.startAt).getTime();
      if (t < start || t >= end) continue;
      current = Math.max(current, a.distanceM ?? 0);
    }
  } else {
    // contagem acumulada (atividade count / tarefa / hábito): atingiu ao chegar em `target`.
    current = collectEvents(goal, ctx).reduce((n, e) => n + e.value, 0);
  }

  return {
    current,
    target: goal.target,
    pct: clampPct(current, goal.target),
    achieved: current >= goal.target,
  };
}

function evalCumulative(goal: Goal, ctx: GoalContext): GoalProgress {
  const current =
    goal.source.kind === 'manual'
      ? goal.manualCurrent ?? 0
      : collectEvents(goal, ctx).reduce((n, e) => n + e.value, 0);
  return {
    current,
    target: goal.target,
    pct: clampPct(current, goal.target),
    achieved: current >= goal.target,
  };
}

/** Avalia o progresso de uma meta contra os dados brutos do contexto. */
export function evaluateGoal(goal: Goal, ctx: GoalContext): GoalProgress {
  switch (goal.family) {
    case 'cadence':
      return evalCadence(goal, ctx);
    case 'milestone':
      return evalMilestone(goal, ctx);
    case 'cumulative':
      return evalCumulative(goal, ctx);
  }
}
