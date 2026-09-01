/**
 * Testes de `spawnedByCompletion` — o que sai junto quando se desfaz uma
 * conclusão. Puros, sem framework. Rodar:
 *   cd packages/shared && npx tsx src/todo/reopen.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import { EVERY_WEEKDAY, spawnedByCompletion } from './logic';
import type { TodoOccurrence, TodoTemplate } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Instante local — mês 1-based, para leitura. */
const at = (y: number, m: number, d: number, h: number, min = 0): string =>
  new Date(y, m - 1, d, h, min, 0, 0).toISOString();

const DONE_AT = at(2026, 9, 1, 10, 0); // terça 01/09, 10h — dia lógico = 2026-09-01
const ANTES = at(2026, 9, 1, 9, 0);
const DEPOIS = at(2026, 9, 1, 10, 1);

type Tpl = Pick<TodoTemplate, 'id' | 'recurrence' | 'onComplete'>;
type Occ = Pick<TodoOccurrence, 'id' | 'templateId' | 'dueDate' | 'status' | 'createdAt'>;

const diaria: Tpl = { id: 't1', recurrence: { kind: 'weekly', weekdays: [...EVERY_WEEKDAY] } };

/** A concluída que se quer reabrir. */
const feita: Pick<TodoOccurrence, 'id' | 'dueDate' | 'doneAt'> = {
  id: 'o1',
  dueDate: '2026-09-01',
  doneAt: DONE_AT,
};

const occ = (o: Partial<Occ> & Pick<Occ, 'id'>): Occ => ({
  templateId: 't1',
  dueDate: '2026-09-02',
  status: 'pending',
  createdAt: DEPOIS,
  ...o,
});

console.log('spawnedByCompletion');

check('apaga a próxima da série, criada pela conclusão', () => {
  const all = [occ({ id: 'o2' })];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), ['o2']);
});

check('não apaga a própria ocorrência reaberta', () => {
  const all = [occ({ id: 'o1', dueDate: '2026-09-02' })];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), []);
});

check('não apaga ocorrência anterior à conclusão', () => {
  const all = [occ({ id: 'o2', createdAt: ANTES })];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), []);
});

check('não apaga ocorrência em outra data que não a gerada', () => {
  const all = [occ({ id: 'o2', dueDate: '2026-09-05' })];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), []);
});

check('não apaga o que já foi resolvido', () => {
  const all = [
    occ({ id: 'o2', status: 'skipped' }),
    occ({ id: 'o3', dueDate: '2026-09-02', status: 'done' }),
  ];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), []);
});

check('avulsa (kind none) não gera próxima — nada a apagar', () => {
  const avulsa: Tpl = { id: 't1', recurrence: { kind: 'none' } };
  const all = [occ({ id: 'o2', dueDate: null })];
  assert.deepEqual(spawnedByCompletion(avulsa, feita, all), []);
});

check('after_completion ancora no dia da conclusão', () => {
  const t: Tpl = { id: 't1', recurrence: { kind: 'after_completion', intervalDays: 10 } };
  const all = [occ({ id: 'o2', dueDate: '2026-09-11' }), occ({ id: 'o3', dueDate: '2026-09-02' })];
  assert.deepEqual(spawnedByCompletion(t, feita, all), ['o2']);
});

check('encadeamento: apaga a filha nascida no dia, não a de série alheia', () => {
  const pai: Tpl = {
    id: 't1',
    recurrence: { kind: 'none' },
    onComplete: [{ templateId: 't2', ifPending: 'ignore' }],
  };
  const all = [
    occ({ id: 'o2', templateId: 't2', dueDate: '2026-09-01' }), // filha do encadeamento
    occ({ id: 'o3', templateId: 't3', dueDate: '2026-09-01' }), // outra série qualquer
    occ({ id: 'o4', templateId: 't2', dueDate: '2026-09-04' }), // filha de outro dia
  ];
  assert.deepEqual(spawnedByCompletion(pai, feita, all), ['o2']);
});

check('sem doneAt não há conclusão a desfazer', () => {
  const all = [occ({ id: 'o2' })];
  assert.deepEqual(spawnedByCompletion(diaria, { id: 'o1', dueDate: '2026-09-01' }, all), []);
});

check('ocorrência sem data (avulsa pendente) da mesma série fica de pé', () => {
  const all = [occ({ id: 'o2', dueDate: null })];
  assert.deepEqual(spawnedByCompletion(diaria, feita, all), []);
});

console.log(`\n${passed} testes ok`);
