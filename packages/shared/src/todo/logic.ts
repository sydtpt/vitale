/**
 * Derivações puras de tarefas (sem persistência) — fonte única para web e mobile.
 * Regra em [data-model](../../../../docs/specs/tarefas/data-model.md).
 *
 * "Hoje" aqui é o **dia lógico** (`todoDayStr`), que só vira às 02h — nunca a data
 * do calendário. Quem chama passa esse dia (e `todoTimeStr` como hora) em vez de
 * `localDateStr`/`localTimeStr`; os defaults destas funções já usam os dois.
 */
import type { TodoRecurrence, TodoTemplate, TodoOccurrence } from '../models';
import { localDateStr } from '../date/local';

export { localDateStr };

/** Hora local 'HH:MM' (24h, zero-padded) — comparável por string. */
export function localTimeStr(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Hora em que o dia das tarefas vira. A madrugada pertence ao dia que acabou:
 * quem lava a louça à 01h ainda está fechando terça, então a tarefa de terça não
 * pode sumir da lista (nem virar "atrasada") na virada do relógio.
 */
export const TODO_ROLLOVER_HOUR = 2;

/** Dia lógico das tarefas ('YYYY-MM-DD'): antes das 02h locais, ainda é ontem. */
export function todoDayStr(d: Date = new Date()): string {
  const shifted = new Date(d.getTime());
  shifted.setHours(shifted.getHours() - TODO_ROLLOVER_HOUR);
  return localDateStr(shifted);
}

/**
 * Hora no mesmo relógio de `todoDayStr` — a madrugada continua contando do dia
 * anterior: 00:30 vira '24:30' e 01:45 vira '25:45'. Mantém a comparação por
 * string com `startTime`/`endTime` (no máximo '23:59') válida após a meia-noite.
 */
export function todoTimeStr(d: Date = new Date()): string {
  const h = d.getHours();
  const hh = h < TODO_ROLLOVER_HOUR ? h + 24 : h;
  return `${String(hh).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ms até a próxima virada do dia de tarefas (02h locais) — para reagendar a lista. */
export function msUntilTodoRollover(now: Date = new Date()): number {
  const t = new Date(now.getTime());
  t.setHours(TODO_ROLLOVER_HOUR, 0, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

/** Valida 'HH:MM' (00:00–23:59). */
export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Valida 'YYYY-MM-DD' (calendário real, não só formato). */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parse(s);
  return !Number.isNaN(d.getTime()) && localDateStr(d) === s;
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
 * Primeira data de uma série, a partir de `today` (inclusivo). Se a série tem
 * `startDate` ("a partir de") no futuro, a âncora é `startDate` — evita gerar uma
 * ocorrência retroativa (que viraria atrasada) ao chegar o dia. after_completion
 * começa na âncora. none/usage/event/stock não têm data (null).
 */
export function firstDueDate(
  rec: TodoRecurrence,
  today: string = todoDayStr(),
  startDate?: string | null,
): string | null {
  const from = startDate && startDate > today ? startDate : today;
  switch (rec.kind) {
    case 'monthly': return monthlyDue(rec.day, from, true);
    case 'weekly':  return weeklyDue(rec.weekdays, from, true);
    case 'yearly':  return yearlyDue(rec.month, rec.day, from, true);
    case 'after_completion': return from;
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
  completedAt: string = todoDayStr(),
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
 * Prazo de uma ocorrência criada por gatilho on_workout, a partir do dia do
 * gatilho. `dueInDays`: undefined → sem prazo (null); 0 → no dia; N → +N dias.
 */
export function triggeredDueDate(
  rec: TodoRecurrence,
  triggerDay: string = todoDayStr(),
): string | null {
  const days = rec.kind === 'on_workout' ? rec.dueInDays : undefined;
  if (days == null) return null;
  return addDays(triggerDay, days);
}

/** Pendente com data já passada. */
export function isOverdue(
  occ: Pick<TodoOccurrence, 'dueDate' | 'status'>,
  today: string = todoDayStr(),
): boolean {
  return occ.status === 'pending' && occ.dueDate != null && occ.dueDate < today;
}

/** Dias de atraso (0 se não atrasada). */
export function daysLate(
  occ: Pick<TodoOccurrence, 'dueDate' | 'status'>,
  today: string = todoDayStr(),
): number {
  if (!isOverdue(occ, today)) return 0;
  return daysBetween(occ.dueDate as string, today);
}

/**
 * "A partir de" (`startDate`): antes desse dia a série inteira fica oculta — não
 * aparece em nenhum balde (atrasada/hoje/em breve). Sem `startDate` → sempre ativa.
 * Aplicado no filtro-base das listas; complementa a âncora de `firstDueDate`.
 */
export function isStarted(
  t: Pick<TodoTemplate, 'startDate'>,
  today: string = todoDayStr(),
): boolean {
  return !t.startDate || today >= t.startDate;
}

/**
 * Visibilidade por `startTime`: a ocorrência do dia só vira acionável a partir do
 * horário. Sem `startTime`, sem data, ou dia ≠ hoje → sempre visível (o dia em si
 * já passou ou é futuro e cai em "Em breve"). Só esconde a do dia antes da hora.
 */
export function isVisibleNow(
  t: Pick<TodoTemplate, 'startTime'>,
  occ: Pick<TodoOccurrence, 'dueDate'>,
  today: string = todoDayStr(),
  now: string = todoTimeStr(),
): boolean {
  if (!t.startTime || occ.dueDate == null || occ.dueDate !== today) return true;
  return now >= t.startTime;
}

/**
 * Passou da `endTime`: pendente com data cujo dia (e horário, se hoje) já passou.
 * Dispara o cancelamento automático na reconciliação. Sem `endTime` → false.
 * Na madrugada `now` vem como '24:mm'/'25:mm' (`todoTimeStr`), então qualquer
 * `endTime` do dia lógico já conta como vencido — é isso que fecha a janela.
 */
export function isPastEnd(
  t: Pick<TodoTemplate, 'endTime'>,
  occ: Pick<TodoOccurrence, 'dueDate' | 'status'>,
  today: string = todoDayStr(),
  now: string = todoTimeStr(),
): boolean {
  if (!t.endTime || occ.status !== 'pending' || occ.dueDate == null) return false;
  if (occ.dueDate < today) return true;
  return occ.dueDate === today && now >= t.endTime;
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
  | { type: 'expire'; occId: string }
  | { type: 'cancel'; occId: string; templateId: string; dueDate: string | null };

/**
 * Reconcilia UMA série com suas ocorrências, dado o dia/hora de hoje. Idempotente:
 *  - endTime definido: pendentes que passaram do horário viram `cancel` (sobrepõe carry/expire);
 *  - overdue='expire': demais pendentes vencidas viram `expired`;
 *  - recorrência de calendário sem ocorrência corrente/futura: cria a próxima a partir de hoje;
 *  - overdue='carry': a vencida permanece pendente (some como "atrasada"), sem duplicar.
 * O `cancel` é avançado pela store (gera a próxima via nextDueDate), então não emitimos
 * `create` de calendário no mesmo passe em que houve cancelamento.
 */
export function reconcileTemplate(
  t: Pick<TodoTemplate, 'id' | 'active' | 'recurrence' | 'overdue' | 'triggerOnly' | 'endTime' | 'startDate'>,
  occ: Pick<TodoOccurrence, 'id' | 'dueDate' | 'status'>[],
  today: string = todoDayStr(),
  now: string = todoTimeStr(),
): TodoAction[] {
  const actions: TodoAction[] = [];
  if (!t.active) return actions;

  const pending = occ.filter((o) => o.status === 'pending');
  const isPast = (o: { dueDate: string | null }) => o.dueDate != null && o.dueDate < today;

  // endTime: cancelamento automático após o horário — precede expire/carry.
  const canceled = new Set<string>();
  for (const o of pending) {
    if (isPastEnd(t, o, today, now)) {
      actions.push({ type: 'cancel', occId: o.id, templateId: t.id, dueDate: o.dueDate });
      canceled.add(o.id);
    }
  }

  if (t.overdue === 'expire') {
    for (const o of pending) {
      if (!canceled.has(o.id) && isPast(o)) actions.push({ type: 'expire', occId: o.id });
    }
  }

  // triggerOnly: a série não gera ocorrência por calendário (só nasce por gatilho).
  // Pula o create quando houve cancelamento: o avanço do cancel já gera a próxima.
  if (!t.triggerOnly && canceled.size === 0 && isCalendarRecurrence(t.recurrence)) {
    // o que continua vivo após as expirações acima
    const alive = pending.filter((o) => !(t.overdue === 'expire' && isPast(o)));
    const hasCurrentOrFuture = alive.some((o) => o.dueDate != null);
    if (!hasCurrentOrFuture) {
      const next = firstDueDate(t.recurrence, today, t.startDate);
      if (next) actions.push({ type: 'create', templateId: t.id, dueDate: next });
    }
  }

  return actions;
}
