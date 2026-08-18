/**
 * Testes da taxonomia de tipos de treino — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/fitness/activity-types.test.ts
 * Sai com código !=0 no primeiro assert que falhar.
 */
import assert from 'node:assert/strict';
import {
  ACTIVITY_TYPE_LABELS,
  EASY_IDS,
  ENDURANCE_IDS,
  GPS_ACTIVITY_IDS,
  STRENGTH_IDS,
  kindForActivity,
} from './activity-types';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const SETS: Array<[string, Set<number>]> = [
  ['GPS_ACTIVITY_IDS', GPS_ACTIVITY_IDS],
  ['ENDURANCE_IDS', ENDURANCE_IDS],
  ['STRENGTH_IDS', STRENGTH_IDS],
  ['EASY_IDS', EASY_IDS],
];

check('os quatro conjuntos são disjuntos', () => {
  for (let i = 0; i < SETS.length; i++) {
    for (let j = i + 1; j < SETS.length; j++) {
      const [nameA, a] = SETS[i];
      const [nameB, b] = SETS[j];
      const shared = [...a].filter((id) => b.has(id));
      assert.deepEqual(
        shared,
        [],
        `${nameA} e ${nameB} compartilham ${shared.join(', ')} — a ordem de checagem em ` +
          `kindForActivity decidiria em silêncio qual vence, e o id ficaria inalcançável no segundo`,
      );
    }
  }
});

check('todo id classificado tem label — nada classifica um tipo que a UI não sabe nomear', () => {
  for (const [name, set] of SETS) {
    for (const id of set) {
      assert.ok(ACTIVITY_TYPE_LABELS[id], `${name} tem ${id}, que não está em ACTIVITY_TYPE_LABELS`);
    }
  }
});

check('remo é endurance, não força', () => {
  assert.equal(ACTIVITY_TYPE_LABELS[35], 'Remo');
  assert.equal(kindForActivity(35), 'endurance');
});

check('os aeróbicos sem GPS classificam', () => {
  for (const id of [46, 73, 63, 16, 44, 82]) {
    assert.equal(kindForActivity(id), 'endurance', `${ACTIVITY_TYPE_LABELS[id]} (${id})`);
  }
});

check('outdoor com GPS é endurance', () => {
  for (const id of [13, 24, 37, 52]) {
    assert.equal(kindForActivity(id), 'endurance', `${ACTIVITY_TYPE_LABELS[id]} (${id})`);
  }
});

check('força e baixa intensidade classificam', () => {
  for (const id of [11, 20, 50, 59]) assert.equal(kindForActivity(id), 'strength');
  for (const id of [57, 66]) assert.equal(kindForActivity(id), 'easy');
});

check('tipo desconhecido devolve none', () => {
  assert.equal(kindForActivity(9999), 'none');
});

console.log(`\n${passed} testes passaram.`);
