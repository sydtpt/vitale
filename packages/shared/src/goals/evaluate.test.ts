/**
 * Testes de evaluateGoal — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/goals/evaluate.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import type { Activity, CounterHabit, Goal, HabitLog, TodoOccurrence } from '../models/index';
import { evaluateGoal, type GoalContext } from './evaluate';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const YEAR = 2026;

function activity(over: Partial<Activity>): Activity {
  return {
    id: Math.random().toString(36).slice(2),
    userId: 'u',
    activityId: 37,
    calories: 300,
    startAt: `${YEAR}-01-15T08:00:00`,
    endAt: `${YEAR}-01-15T09:00:00`,
    durationS: 3600,
    hasRoute: true,
    ...over,
  };
}

function occ(over: Partial<TodoOccurrence> & { templateId: string; doneAt: string }): TodoOccurrence {
  return {
    id: Math.random().toString(36).slice(2),
    dueDate: over.doneAt.slice(0, 10),
    status: 'done',
    createdAt: over.doneAt,
    ...over,
  };
}

function emptyCtx(now: Date): GoalContext {
  return { activities: [], doneOccurrences: [], habitLogs: [], habits: [], now };
}

const baseGoal: Omit<Goal, 'family' | 'source' | 'target'> = {
  id: 'g',
  year: YEAR,
  title: 't',
  cat: 'treino',
  active: true,
  sort: 0,
  createdAt: `${YEAR}-01-01T00:00:00`,
};

// ── Cadence: correr ao menos 1x/mês ──────────────────────────────
check('cadence: 3 meses com corrida no fim de março → 3/12', () => {
  const ctx = emptyCtx(new Date(YEAR, 2, 31, 12)); // 31 mar
  ctx.activities = [
    activity({ startAt: `${YEAR}-01-10T08:00:00` }),
    activity({ startAt: `${YEAR}-02-10T08:00:00` }),
    activity({ startAt: `${YEAR}-03-05T08:00:00` }),
    activity({ startAt: `${YEAR}-03-20T08:00:00` }), // 2ª de março não conta a mais
  ];
  const goal: Goal = {
    ...baseGoal,
    family: 'cadence',
    period: 'month',
    perPeriodTarget: 1,
    target: 12,
    source: { kind: 'activity', activityId: 37, activityMetric: 'count' },
  };
  const p = evaluateGoal(goal, ctx);
  assert.equal(p.periodsMet, 3);
  assert.equal(p.periodsTotal, 12);
  assert.equal(p.current, 3);
  assert.equal(p.target, 12);
  assert.equal(p.currentPeriodMet, true); // março cumprido
  assert.equal(p.achieved, false);
});

check('cadence: mês corrente sem corrida → currentPeriodMet false, não conta futuro', () => {
  const ctx = emptyCtx(new Date(YEAR, 5, 15, 12)); // 15 jun
  ctx.activities = [activity({ startAt: `${YEAR}-01-10T08:00:00` })];
  const goal: Goal = {
    ...baseGoal,
    family: 'cadence',
    period: 'month',
    perPeriodTarget: 1,
    target: 12,
    source: { kind: 'activity', activityMetric: 'count' },
  };
  const p = evaluateGoal(goal, ctx);
  assert.equal(p.periodsMet, 1);
  assert.equal(p.currentPeriodMet, false);
});

// ── Cadence via tarefa: banana 1x/semana ─────────────────────────
check('cadence: tarefa concluída conta por semana', () => {
  const ctx = emptyCtx(new Date(YEAR, 0, 20, 12));
  ctx.doneOccurrences = [
    occ({ templateId: 'banana', doneAt: `${YEAR}-01-05T10:00:00` }),
    occ({ templateId: 'banana', doneAt: `${YEAR}-01-12T10:00:00` }),
    occ({ templateId: 'outra', doneAt: `${YEAR}-01-13T10:00:00` }), // outra série não conta
  ];
  const goal: Goal = {
    ...baseGoal,
    family: 'cadence',
    period: 'week',
    perPeriodTarget: 1,
    target: 52,
    source: { kind: 'task', templateId: 'banana' },
  };
  const p = evaluateGoal(goal, ctx);
  assert.equal(p.periodsMet, 2);
  assert.ok((p.periodsTotal ?? 0) >= 52);
});

// ── Milestone: meia-maratona via bestEffort ──────────────────────
check('milestone: meia-maratona atingida via bestEffort.half', () => {
  const ctx = emptyCtx(new Date(YEAR, 6, 1, 12));
  ctx.activities = [
    activity({ startAt: `${YEAR}-05-01T08:00:00`, distanceM: 10000 }),
    activity({ startAt: `${YEAR}-06-01T08:00:00`, distanceM: 21100, bestEfforts: { half: 6900 } }),
  ];
  const goal: Goal = {
    ...baseGoal,
    family: 'milestone',
    target: 1,
    source: { kind: 'activity', activityId: 37, activityMetric: 'bestEffort', bestEffortKey: 'half' },
  };
  const p = evaluateGoal(goal, ctx);
  assert.equal(p.achieved, true);
  assert.equal(p.pct, 100);
});

check('milestone: sem best-effort half → não atingida', () => {
  const ctx = emptyCtx(new Date(YEAR, 6, 1, 12));
  ctx.activities = [activity({ distanceM: 10000, bestEfforts: { '5000': 1500 } })];
  const goal: Goal = {
    ...baseGoal,
    family: 'milestone',
    target: 1,
    source: { kind: 'activity', activityMetric: 'bestEffort', bestEffortKey: 'half' },
  };
  assert.equal(evaluateGoal(goal, ctx).achieved, false);
});

// ── Cumulative manual: ler 12 livros ─────────────────────────────
check('cumulative manual: 5/12 livros → ~42%', () => {
  const goal: Goal = {
    ...baseGoal,
    family: 'cumulative',
    target: 12,
    manualCurrent: 5,
    unit: 'livros',
    source: { kind: 'manual' },
  };
  const p = evaluateGoal(goal, emptyCtx(new Date(YEAR, 5, 1)));
  assert.equal(p.current, 5);
  assert.equal(Math.round(p.pct), 42);
  assert.equal(p.achieved, false);
});

// ── Cumulative distância via atividade ───────────────────────────
check('cumulative: soma de distância no ano', () => {
  const ctx = emptyCtx(new Date(YEAR, 11, 1));
  ctx.activities = [
    activity({ startAt: `${YEAR}-01-10T08:00:00`, distanceM: 5000 }),
    activity({ startAt: `${YEAR}-02-10T08:00:00`, distanceM: 8000 }),
    activity({ startAt: `${YEAR - 1}-12-31T08:00:00`, distanceM: 9999 }), // ano anterior fora
  ];
  const goal: Goal = {
    ...baseGoal,
    family: 'cumulative',
    target: 100000,
    source: { kind: 'activity', activityMetric: 'distance' },
  };
  assert.equal(evaluateGoal(goal, ctx).current, 13000);
});

// ── Cadence via hábito: conta dias que bateram a meta ────────────
check('cadence via hábito: dias cumpridos contam', () => {
  const habit: CounterHabit = {
    id: 'agua', name: 'Água', icon: 'water', color: 'agua', unit: 'L', step: 1,
    target: 2, direction: 'at_least', bad: false, showOnHome: true, active: true, sort: 0,
    createdAt: `${YEAR}-01-01T00:00:00`,
  };
  const logs: HabitLog[] = [
    { id: '1', habitId: 'agua', logDate: `${YEAR}-01-05`, value: 3 }, // met
    { id: '2', habitId: 'agua', logDate: `${YEAR}-01-06`, value: 1 }, // não met
    { id: '3', habitId: 'agua', logDate: `${YEAR}-02-10`, value: 2 }, // met
  ];
  const ctx: GoalContext = { activities: [], doneOccurrences: [], habitLogs: logs, habits: [habit], now: new Date(YEAR, 2, 1) };
  const goal: Goal = {
    ...baseGoal,
    family: 'cadence',
    period: 'month',
    perPeriodTarget: 1,
    target: 12,
    source: { kind: 'habit', habitId: 'agua' },
  };
  const p = evaluateGoal(goal, ctx);
  assert.equal(p.periodsMet, 2); // jan e fev tiveram ≥1 dia cumprido
});

console.log(`\n${passed} testes passaram.`);
