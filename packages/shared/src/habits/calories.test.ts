/**
 * Testes de habitCalories — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/habits/calories.test.ts
 */
import assert from 'node:assert/strict';
import {
  habitCalories,
  habitCaloriesRange,
  BEERS,
  BEER_KCAL_PER_L,
  BEER_ML_PER_UNIT,
} from './calories';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check('mistura padrão fica entre a lager mais leve e a IPA', () => {
  const kcals = BEERS.map((b) => b.kcalPerL);
  assert.ok(BEER_KCAL_PER_L > Math.min(...kcals));
  assert.ok(BEER_KCAL_PER_L < Math.max(...kcals));
  assert.equal(BEER_KCAL_PER_L, 472); // 0,4×450 + 0,4×430 + 0,2×600
  assert.equal(BEER_ML_PER_UNIT, 266); // 0,4×250 + 0,4×250 + 0,2×330
});

check('litros de cerveja usam a densidade da mistura', () => {
  assert.equal(habitCalories('Cerveja', 'L', 1), BEER_KCAL_PER_L);
  assert.equal(habitCalories('Cerveja', 'L', 17.5), 8260);
});

check('ml e unidades convertem para litros', () => {
  assert.equal(habitCalories('Cerveja', 'ml', 500), 236);
  assert.equal(habitCalories('Cerveja', 'un', 2), 251); // 2 copos de ~266 ml
  assert.equal(habitCalories('Cerveja', '', 1), 126);   // sem unidade ⇒ 1 copo
});

check('nome tolera caixa, acento e complemento', () => {
  assert.equal(habitCalories('CERVEJA', 'L', 1), BEER_KCAL_PER_L);
  assert.equal(habitCalories('Cerveja artesanal', 'L', 1), BEER_KCAL_PER_L);
});

check('sem densidade conhecida ou unidade estranha ⇒ null', () => {
  assert.equal(habitCalories('Água', 'L', 3), null);
  assert.equal(habitCalories('Smoke', 'un', 5), null);
  assert.equal(habitCalories('Cerveja', 'kg', 2), null);
});

check('total zero ou negativo ⇒ null (nada a exibir)', () => {
  assert.equal(habitCalories('Cerveja', 'L', 0), null);
  assert.equal(habitCalories('Cerveja', 'L', -1), null);
});

check('faixa min–max envolve a estimativa pontual', () => {
  const [lo, hi] = habitCaloriesRange('Cerveja', 'L', 17.5)!;
  const mid = habitCalories('Cerveja', 'L', 17.5)!;
  assert.equal(lo, 7525);  // 17,5 × 430 (só Jupiler)
  assert.equal(hi, 10500); // 17,5 × 600 (só IPA)
  assert.ok(lo < mid && mid < hi);
  assert.equal(habitCaloriesRange('Água', 'L', 3), null);
});

console.log(`\n${passed} testes ok`);
