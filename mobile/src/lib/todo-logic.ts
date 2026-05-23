/**
 * Derivações puras de tarefas (sem persistência).
 * Espelha a regra de [data-model](.claude/specs/tarefas/data-model.md).
 * Mantido fora de `@vitale/shared` (que é só modelos/tokens, sem lógica);
 * a web espelha estas funções em `web/.../tarefas/data/todo-logic.ts`.
 */
import type { TodoRecurrence, TodoTemplate, TodoOccurrence } from '@vitale/shared';

/** Data local 'YYYY-MM-DD' (não UTC). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parse(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

/** 'YYYY-MM-DD' + n dias. */
export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** Dias de `from` até `to` (to - from), pode ser negativo. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);
}

function daysInMonth(year: number, monthIdx: number): number {
  return new Date(year, monthIdx + 1, 0).getDate();
}

/** Recorrências ancoradas no calendário (geram datas previsíveis). */
export function isCalendarRecurrence(rec: TodoRecurrence): boolean {
  return rec.kind === 'monthly' || rec.kind === 'weekly' || rec.kind === 'yearly';
}

function monthlyDue(day: number, from: string, inclusive: boolean): string {
  const f = parse(from);
  let y = f.getFullYear();
  let m = f.getMonth();
  for (let i = 0; i < 13; i++) {
    const d = new Date(y, m, Math.min(day, daysInMonth(y, m)));
    const cmp = d.getTime() - f.getTime();
    if (inclusive ? cmp >= 0 : cmp > 0) return localDateStr(d);
    if (++m > 11) { m = 0; y++; }
  }
  return from;
}

function weeklyDue(weekdays: number[], from: string, inclusive: boolean): string {
  if (weekdays.length === 0) return from;
  const set = new Set(weekdays);
  const f = parse(from);
  for (let i = inclusive ? 0 : 1; i <= 7; i++) {
    const cand = new Date(f);
    cand.setDate(f.getDate() + i);
    if (set.has(cand.getDay())) return localDateStr(cand);
  }
  return from;
}

function yearlyDue(month: number, day: number, from: string, inclusive: boolean): string {
  const f = parse(from);
  const y = f.getFullYear();
  const mIdx = month - 1;
  for (let i = 0; i < 3; i++) {
    const d = new Date(y + i, mIdx, Math.min(day, daysInMonth(y + i, mIdx)));
    const cmp = d.getTime() - f.getTime();
    if (inclusive ? cmp >= 0 : cmp > 0) return localDateStr(d);
  }
  return from;
}

/**
 * Primeira data de uma série, a partir de `today` (inclusivo).
 * after_completion começa hoje. none/usage/event/stock não têm data (null).
 */
export function firstDueDate(rec: TodoRecurrence, today: string = localDateStr()): string | null {
  switch (rec.kind) {
    case 'monthly': return monthlyDue(rec.day, today, true);
    case 'weekly':  return weeklyDue(rec.weekdays, today, true);
    case 'yearly':  return yearlyDue(rec.month, rec.day, today, true);
    case 'after_completion': return today;
    default: return null;
  }
}

/**
 * Próxima data após uma ocorrência resolvida.
 * Calendário ancora em `occDueDate`; after_completion ancora em `completedAt`.
 * none/usage/event/stock não geram próxima por data (null).
 */
export function nextDueDate(
  rec: TodoRecurrence,
  occDueDate: string | null,
  completedAt: string = localDateStr(),
): string | null {
  const anchor = occDueDate ?? completedAt;
  switch (rec.kind) {
    case 'monthly': return monthlyDue(rec.day, anchor, false);
    case 'weekly':  return weeklyDue(rec.weekdays, anchor, false);
    case 'yearly':  return yearlyDue(rec.month, rec.day, anchor, false);
    case 'after_completion': return addDays(completedAt, rec.intervalDays);
    default: return null;
  }
}

/**
 * Prazo de uma ocorrência criada por gatilho (on_workout/on_task), a partir do
 * dia do gatilho. `dueInDays`: undefined → sem prazo (null); 0 → no dia; N → +N dias.
 */
export function triggeredDueDate(
  rec: TodoRecurrence,
  triggerDay: string = localDateStr(),
): string | null {
  const days = rec.kind === 'on_workout' || rec.kind === 'on_task' ? rec.dueInDays : undefined;
  if (days == null) return null;
  return addDays(triggerDay, days);
}

/** Pendente com data já passada. */
export function isOverdue(
  occ: Pick<TodoOccurrence, 'dueDate' | 'status'>,
  today: string = localDateStr(),
): boolean {
  return occ.status === 'pending' && occ.dueDate != null && occ.dueDate < today;
}

/** Dias de atraso (0 se não atrasada). */
export function daysLate(
  occ: Pick<TodoOccurrence, 'dueDate' | 'status'>,
  today: string = localDateStr(),
): number {
  if (!isOverdue(occ, today)) return 0;
  return daysBetween(occ.dueDate as string, today);
}

/** Gatilho por uso/contador atingido (meter - última conclusão ≥ every). */
export function dueUsage(
  t: Pick<TodoTemplate, 'recurrence' | 'meter' | 'meterAtLastDone'>,
): boolean {
  if (t.recurrence.kind !== 'usage') return false;
  return (t.meter ?? 0) - (t.meterAtLastDone ?? 0) >= t.recurrence.every;
}

/** Ação derivada de reconciliação (a executada pela store). */
export type TodoAction =
  | { type: 'create'; templateId: string; dueDate: string | null }
  | { type: 'expire'; occId: string };

/**
 * Reconcilia UMA série com suas ocorrências, dado o dia de hoje. Idempotente:
 *  - overdue='expire': ocorrências pendentes vencidas viram `expired`;
 *  - recorrência de calendário sem ocorrência corrente/futura: cria a próxima a partir de hoje;
 *  - overdue='carry': a vencida permanece pendente (some como "atrasada"), sem duplicar.
 */
export function reconcileTemplate(
  t: Pick<TodoTemplate, 'id' | 'active' | 'recurrence' | 'overdue'>,
  occ: Pick<TodoOccurrence, 'id' | 'dueDate' | 'status'>[],
  today: string = localDateStr(),
): TodoAction[] {
  const actions: TodoAction[] = [];
  if (!t.active) return actions;

  const pending = occ.filter((o) => o.status === 'pending');
  const isPast = (o: { dueDate: string | null }) => o.dueDate != null && o.dueDate < today;

  if (t.overdue === 'expire') {
    for (const o of pending) {
      if (isPast(o)) actions.push({ type: 'expire', occId: o.id });
    }
  }

  if (isCalendarRecurrence(t.recurrence)) {
    // o que continua vivo após as expirações acima
    const alive = pending.filter((o) => !(t.overdue === 'expire' && isPast(o)));
    const hasCurrentOrFuture = alive.some((o) => o.dueDate != null);
    if (!hasCurrentOrFuture) {
      const next = firstDueDate(t.recurrence, today);
      if (next) actions.push({ type: 'create', templateId: t.id, dueDate: next });
    }
  }

  return actions;
}
