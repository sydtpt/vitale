/**
 * Testes de buildTaskReminders — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/todo/reminders.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import { buildTaskReminders, TASK_REMINDER_LIMIT } from './reminders';
import type { TodoOccurrence, TodoTemplate } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

type Tpl = Pick<TodoTemplate, 'id' | 'name' | 'active' | 'startTime'>;
type Occ = Pick<TodoOccurrence, 'id' | 'templateId' | 'dueDate' | 'status'>;

const tpl = (over: Partial<Tpl> = {}): Tpl => ({
  id: 't1',
  name: 'Tomar remédio',
  active: true,
  startTime: '08:00',
  ...over,
});

const occ = (over: Partial<Occ> = {}): Occ => ({
  id: 'o1',
  templateId: 't1',
  dueDate: '2026-08-24',
  status: 'pending',
  ...over,
});

/** 24/08/2026 07:00 local — antes do startTime padrão dos fixtures. */
const NOW = new Date('2026-08-24T07:00:00');

check('agenda a ocorrência do dia cujo horário ainda não chegou', () => {
  const out = buildTaskReminders([tpl()], [occ()], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].occId, 'o1');
  assert.equal(out[0].name, 'Tomar remédio');
  assert.equal(out[0].at.getTime(), new Date('2026-08-24T08:00:00').getTime());
});

check('horário local, não UTC', () => {
  const out = buildTaskReminders([tpl()], [occ()], NOW);
  assert.equal(out[0].at.getHours(), 8);
  assert.equal(out[0].at.getMinutes(), 0);
});

check('horário já passado no dia não é reagendado (nada dispara no foreground)', () => {
  const out = buildTaskReminders([tpl()], [occ()], new Date('2026-08-24T08:00:01'));
  assert.equal(out.length, 0);
});

check('data anterior (atrasada) não gera lembrete', () => {
  const out = buildTaskReminders([tpl()], [occ({ dueDate: '2026-08-23' })], NOW);
  assert.equal(out.length, 0);
});

check('data futura gera lembrete', () => {
  const out = buildTaskReminders([tpl()], [occ({ dueDate: '2026-09-01' })], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].at.getTime(), new Date('2026-09-01T08:00:00').getTime());
});

check('série sem startTime não gera lembrete', () => {
  const out = buildTaskReminders([tpl({ startTime: undefined })], [occ()], NOW);
  assert.equal(out.length, 0);
});

check('startTime inválido é ignorado (não vira Invalid Date agendada)', () => {
  for (const bad of ['25:00', '8h', '08:60', '']) {
    const out = buildTaskReminders([tpl({ startTime: bad })], [occ()], NOW);
    assert.equal(out.length, 0, `startTime "${bad}" deveria ser ignorado`);
  }
});

check('série arquivada não gera lembrete', () => {
  const out = buildTaskReminders([tpl({ active: false })], [occ()], NOW);
  assert.equal(out.length, 0);
});

check('ocorrência sem data não gera lembrete', () => {
  const out = buildTaskReminders([tpl()], [occ({ dueDate: null })], NOW);
  assert.equal(out.length, 0);
});

check('só pendentes — resolvida/pulada/cancelada/expirada ficam de fora', () => {
  for (const status of ['done', 'skipped', 'canceled', 'expired'] as const) {
    const out = buildTaskReminders([tpl()], [occ({ status })], NOW);
    assert.equal(out.length, 0, `status ${status} deveria ser ignorado`);
  }
});

check('ocorrência órfã (série não carregada) não quebra', () => {
  const out = buildTaskReminders([], [occ()], NOW);
  assert.equal(out.length, 0);
});

check('ordena do mais próximo ao mais distante', () => {
  const templates = [
    tpl({ id: 'a', name: 'Almoço', startTime: '12:00' }),
    tpl({ id: 'b', name: 'Café', startTime: '08:00' }),
    tpl({ id: 'c', name: 'Janta', startTime: '20:00' }),
  ];
  const occs = [
    occ({ id: 'oa', templateId: 'a' }),
    occ({ id: 'oc', templateId: 'c' }),
    occ({ id: 'ob', templateId: 'b' }),
  ];
  const out = buildTaskReminders(templates, occs, NOW);
  assert.deepEqual(out.map((r) => r.name), ['Café', 'Almoço', 'Janta']);
});

check('corta no teto, mantendo as mais próximas', () => {
  const templates: Tpl[] = [];
  const occs: Occ[] = [];
  for (let i = 0; i < TASK_REMINDER_LIMIT + 10; i++) {
    // horários distintos no mesmo dia: quanto maior o i, mais distante o lembrete
    const startTime = `08:${String(i).padStart(2, '0')}`;
    templates.push(tpl({ id: `t${i}`, name: `Tarefa ${i}`, startTime }));
    occs.push(occ({ id: `o${i}`, templateId: `t${i}` }));
  }
  const out = buildTaskReminders(templates, occs, NOW);
  assert.equal(out.length, TASK_REMINDER_LIMIT);
  assert.equal(out[0].name, 'Tarefa 0');
  assert.equal(out[out.length - 1].name, `Tarefa ${TASK_REMINDER_LIMIT - 1}`);
});

check('uma notificação por ocorrência (sem duplicar em ids repetidos)', () => {
  const out = buildTaskReminders([tpl()], [occ(), occ()], NOW);
  assert.equal(out.length, 1);
});

console.log(`\n${passed} checks passaram`);
