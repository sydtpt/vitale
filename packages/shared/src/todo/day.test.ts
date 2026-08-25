/**
 * Testes do dia lógico das tarefas (virada às 02h) — puros, sem framework. Rodar:
 *   cd packages/shared && npx tsx src/todo/day.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import {
  TODO_ROLLOVER_HOUR,
  isOverdue,
  isPastEnd,
  isVisibleNow,
  msUntilTodoRollover,
  reconcileTemplate,
  todoDayStr,
  todoTimeStr,
} from './logic';
import { dueLabel } from './format';
import type { TodoOccurrence, TodoTemplate } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Instante local — mês 1-based, para leitura. */
const at = (y: number, m: number, d: number, h: number, min = 0): Date =>
  new Date(y, m - 1, d, h, min, 0, 0);

console.log('todoDayStr');
check('antes das 02h ainda é o dia anterior', () => {
  assert.equal(todoDayStr(at(2026, 8, 26, 0, 5)), '2026-08-25');
  assert.equal(todoDayStr(at(2026, 8, 26, 1, 59)), '2026-08-25');
});
check('a partir das 02h vira o dia novo', () => {
  assert.equal(todoDayStr(at(2026, 8, 26, 2, 0)), '2026-08-26');
  assert.equal(todoDayStr(at(2026, 8, 26, 9, 0)), '2026-08-26');
  assert.equal(todoDayStr(at(2026, 8, 26, 23, 59)), '2026-08-26');
});
check('atravessa mês e ano', () => {
  assert.equal(todoDayStr(at(2026, 9, 1, 0, 30)), '2026-08-31');
  assert.equal(todoDayStr(at(2027, 1, 1, 1, 0)), '2026-12-31');
});

console.log('todoTimeStr');
check('madrugada continua o relógio do dia anterior', () => {
  assert.equal(todoTimeStr(at(2026, 8, 26, 0, 30)), '24:30');
  assert.equal(todoTimeStr(at(2026, 8, 26, 1, 45)), '25:45');
});
check('resto do dia é a hora local', () => {
  assert.equal(todoTimeStr(at(2026, 8, 26, 2, 0)), '02:00');
  assert.equal(todoTimeStr(at(2026, 8, 26, 23, 5)), '23:05');
});
check('ordena por string depois da meia-noite', () => {
  assert.ok(todoTimeStr(at(2026, 8, 26, 0, 30)) > '23:59');
  assert.ok(todoTimeStr(at(2026, 8, 25, 22, 0)) < todoTimeStr(at(2026, 8, 26, 0, 30)));
});

console.log('listas na madrugada');
const occ = (over: Partial<TodoOccurrence> = {}): Pick<TodoOccurrence, 'id' | 'templateId' | 'dueDate' | 'status'> => ({
  id: 'o1',
  templateId: 't1',
  dueDate: '2026-08-25',
  status: 'pending',
  ...over,
});

check('tarefa do dia não fica atrasada à 01h', () => {
  const today = todoDayStr(at(2026, 8, 26, 1, 0));
  assert.equal(isOverdue(occ(), today), false);
  assert.equal(dueLabel('2026-08-25', today), 'Hoje');
});
check('mesma tarefa vira atrasada às 02h', () => {
  const today = todoDayStr(at(2026, 8, 26, 2, 0));
  assert.equal(isOverdue(occ(), today), true);
});
check('startTime já cumprido segue visível na madrugada', () => {
  const now = at(2026, 8, 26, 0, 30);
  assert.equal(isVisibleNow({ startTime: '07:00' }, occ(), todoDayStr(now), todoTimeStr(now)), true);
});

console.log('endTime na madrugada');
check('endTime do dia lógico fecha a janela depois da meia-noite', () => {
  const now = at(2026, 8, 26, 0, 30);
  assert.equal(isPastEnd({ endTime: '22:00' }, occ(), todoDayStr(now), todoTimeStr(now)), true);
});
check('endTime ainda por vir não cancela', () => {
  const now = at(2026, 8, 25, 21, 0);
  assert.equal(isPastEnd({ endTime: '22:00' }, occ(), todoDayStr(now), todoTimeStr(now)), false);
});

console.log('reconcileTemplate');
const tpl: Pick<TodoTemplate, 'id' | 'active' | 'recurrence' | 'overdue' | 'triggerOnly' | 'endTime' | 'startDate'> = {
  id: 't1',
  active: true,
  recurrence: { kind: 'weekly', weekdays: [2] }, // terça
  overdue: 'expire',
  triggerOnly: false,
  endTime: undefined,
  startDate: undefined,
};

check('não expira a tarefa do dia à 01h', () => {
  const now = at(2026, 8, 26, 1, 0); // quarta de madrugada, dia lógico = terça 25
  const actions = reconcileTemplate(tpl, [occ()], todoDayStr(now), todoTimeStr(now));
  assert.deepEqual(actions, []);
});
check('expira e gera a próxima às 02h', () => {
  const now = at(2026, 8, 26, 2, 0);
  const actions = reconcileTemplate(tpl, [occ()], todoDayStr(now), todoTimeStr(now));
  assert.deepEqual(actions, [
    { type: 'expire', occId: 'o1' },
    { type: 'create', templateId: 't1', dueDate: '2026-09-01' },
  ]);
});

console.log('msUntilTodoRollover');
check('conta até as 02h de hoje quando ainda é madrugada', () => {
  assert.equal(msUntilTodoRollover(at(2026, 8, 26, 0, 30)), 90 * 60000);
});
check('conta até as 02h de amanhã depois da virada', () => {
  assert.equal(msUntilTodoRollover(at(2026, 8, 26, 3, 0)), 23 * 3600000);
  assert.equal(msUntilTodoRollover(at(2026, 8, 26, 2, 0)), 24 * 3600000);
});
check('a hora da virada é a mesma usada pelas derivações', () => {
  assert.equal(TODO_ROLLOVER_HOUR, 2);
});

console.log(`\n${passed} testes ok`);
