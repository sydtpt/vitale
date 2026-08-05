/**
 * Testes de niceAxisMax / compactNumber — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/chart/axis.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import { niceAxisMax, compactNumber } from './axis';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const TICKS = 4;
/** Rótulos que a grade de 5 linhas geraria para um dado topo. */
function gridValues(max: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);
}

check('topo fica acima do máximo (a maior barra não encosta)', () => {
  for (const raw of [1, 7, 123, 4357, 17426, 999999]) {
    const max = niceAxisMax(raw, { ticks: TICKS });
    assert.ok(max > raw, `max ${max} não é maior que ${raw}`);
  }
});

check('máximo exatamente redondo também ganha folga', () => {
  // 20000 é um topo "bonito": sem a folga o eixo pararia nele e a barra encostaria.
  assert.ok(niceAxisMax(20000, { ticks: TICKS }) > 20000);
  assert.ok(niceAxisMax(8 * 3600, { unit: 3600, ticks: TICKS }) > 8 * 3600);
});

check('kcal: 17.426 vira eixo de 20k com passos de 5k', () => {
  const max = niceAxisMax(17426, { ticks: TICKS, integer: true });
  assert.equal(max, 20000);
  assert.deepEqual(gridValues(max), [0, 5000, 10000, 15000, 20000]);
});

check('duração: passo redondo em horas, não em segundos', () => {
  const max = niceAxisMax(7.36 * 3600, { unit: 3600, ticks: TICKS });
  assert.equal(max / 3600, 8);
  assert.deepEqual(gridValues(max).map((v) => v / 3600), [0, 2, 4, 6, 8]);
});

check('distância: passo redondo em km', () => {
  const max = niceAxisMax(125_000, { unit: 1000, ticks: TICKS });
  assert.equal(max % 1000, 0);
  for (const v of gridValues(max)) assert.equal((v / 1000) % 1, 0, `${v / 1000}km não é redondo`);
});

check('métrica inteira nunca gera rótulo fracionário', () => {
  for (const raw of [1, 2, 3, 5, 7, 11, 26]) {
    const max = niceAxisMax(raw, { ticks: TICKS, integer: true });
    for (const v of gridValues(max)) assert.equal(v % 1, 0, `${v} não é inteiro (max ${max}, raw ${raw})`);
  }
});

check('zero e negativo não quebram a escala', () => {
  assert.ok(niceAxisMax(0, { ticks: TICKS, integer: true }) >= TICKS);
  assert.ok(Number.isFinite(niceAxisMax(-5, { ticks: TICKS })));
});

check('folga não é exagerada (topo < 2x o máximo)', () => {
  for (const raw of [17426, 7.36 * 3600, 125_000, 42, 998]) {
    assert.ok(niceAxisMax(raw, { ticks: TICKS }) < raw * 2, `folga demais em ${raw}`);
  }
});

check('compactNumber encurta a partir de mil', () => {
  assert.equal(compactNumber(17426), '17k');
  assert.equal(compactNumber(20000), '20k');
  assert.equal(compactNumber(5000), '5k');
  assert.equal(compactNumber(2500), '2,5k');
  assert.equal(compactNumber(1000), '1k');
  assert.equal(compactNumber(999), '999');
  assert.equal(compactNumber(0), '0');
  assert.equal(compactNumber(42.4), '42');
});

check('compactNumber vira milhão em vez de "1200k"', () => {
  assert.equal(compactNumber(1_200_000), '1,2M');
  assert.equal(compactNumber(1_000_000), '1M');
  assert.equal(compactNumber(12_000_000), '12M');
  assert.equal(compactNumber(900_000), '900k');
});

console.log(`\n${passed} testes passaram.`);
