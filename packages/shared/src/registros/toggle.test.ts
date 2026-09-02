/**
 * Testes de toggleDateIn/applyMarkToWindow — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/registros/toggle.test.ts
 *
 * Cobrem o contrato do toggle do heatmap web (CAP-7): dia dentro/fora da
 * janela, dedupe no add, remoção exata por (registro, dia), e o revert do
 * otimista devolvendo o estado original.
 */
import assert from 'node:assert/strict';
import type { RegistroLog } from '../models';
import { applyMarkToWindow, toggleDateIn } from './toggle';

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    // Sem isto o nome do teste que falhou some — só o stack do assert sai.
    console.log(`  not ok ${name}`);
    throw e;
  }
  passed += 1;
  console.log(`  ok ${name}`);
}

// ── toggleDateIn — o histórico da página de detalhe ─────────────────────────

const DATES = ['2026-08-01', '2026-08-10'];

check('toggleDateIn: marcar acrescenta o dia', () => {
  assert.deepEqual(toggleDateIn(DATES, '2026-08-20', true), [...DATES, '2026-08-20']);
});

check('toggleDateIn: marcar dia já presente não duplica', () => {
  assert.deepEqual(toggleDateIn(DATES, '2026-08-10', true), DATES);
});

check('toggleDateIn: desmarcar remove só aquele dia', () => {
  assert.deepEqual(toggleDateIn(DATES, '2026-08-10', false), ['2026-08-01']);
});

check('toggleDateIn: desmarcar dia ausente é no-op', () => {
  assert.deepEqual(toggleDateIn(DATES, '2026-08-20', false), DATES);
});

check('toggleDateIn: revert (!marked) devolve o estado original', () => {
  // Os dois sentidos do otimista → erro de rede → revert.
  for (const marked of [true, false]) {
    const date = marked ? '2026-08-20' : '2026-08-10';
    const next = toggleDateIn(DATES, date, marked);
    assert.deepEqual(toggleDateIn(next, date, !marked).sort(), [...DATES].sort());
  }
});

check('toggleDateIn: não muta a entrada', () => {
  const input = [...DATES];
  toggleDateIn(input, '2026-08-20', true);
  toggleDateIn(input, '2026-08-10', false);
  assert.deepEqual(input, DATES);
});

// ── applyMarkToWindow — a janela em cache do store da lista ─────────────────

const SINCE = '2026-06-10';
const log = (id: string, registroId: string, logDate: string): RegistroLog => ({
  id,
  registroId,
  logDate,
});

const WINDOW = [
  log('a', 'pizza', '2026-06-15'),
  log('b', 'dentista', '2026-07-01'),
  log('c', 'pizza', '2026-07-01'),
];

check('window: marcar dia dentro da janela acrescenta o log', () => {
  const novo = log('d', 'pizza', '2026-08-20');
  const next = applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-08-20', true, novo);
  assert.deepEqual(next, [...WINDOW, novo]);
});

check('window: dia < since é no-op nos dois sentidos', () => {
  const antigo = log('x', 'pizza', '2026-01-05');
  assert.equal(applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-01-05', true, antigo), WINDOW);
  assert.equal(applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-01-05', false), WINDOW);
});

check('window: marcar dia já presente não duplica', () => {
  const dup = log('d2', 'pizza', '2026-07-01');
  assert.equal(applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-07-01', true, dup), WINDOW);
});

check('window: marcar sem o log do upsert é no-op', () => {
  assert.equal(applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-08-20', true), WINDOW);
});

check('window: desmarcar remove exatamente o par (registro, dia)', () => {
  const next = applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-07-01', false);
  // O log 'b' (dentista, mesmo dia) fica; só o 'c' (pizza) sai.
  assert.deepEqual(
    next.map((l) => l.id),
    ['a', 'b'],
  );
});

check('window: revert devolve a janela original', () => {
  const novo = log('d', 'pizza', '2026-08-20');
  const marcado = applyMarkToWindow(WINDOW, SINCE, 'pizza', '2026-08-20', true, novo);
  const revertido = applyMarkToWindow(marcado, SINCE, 'pizza', '2026-08-20', false);
  assert.deepEqual(revertido, WINDOW);
});

console.log(`\n${passed} testes ok`);
