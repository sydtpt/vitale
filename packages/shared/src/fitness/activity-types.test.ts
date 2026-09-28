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
  KNOWN_ACTIVITY_IDS,
  STRENGTH_IDS,
  activitySiblings,
  kindForActivity,
} from './activity-types';
import { activityFamily } from './dedupe';

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

/* ─────────────────── irmãos de família (seletor de tipo) ─────────────────── */

check('os irmãos de um tipo são a MESMA família do dedupe', () => {
  // Sem isto, a vizinhança do seletor e a do match podem divergir em silêncio e
  // o dono passa a ver chips de uma família que o dedupe não reconhece.
  for (const id of KNOWN_ACTIVITY_IDS) {
    const meu = activityFamily(id);
    for (const irmao of activitySiblings(id)) {
      assert.equal(
        activityFamily(irmao),
        meu,
        `${ACTIVITY_TYPE_LABELS[id]} (${id}) oferece ${ACTIVITY_TYPE_LABELS[irmao]} (${irmao}), de outra família`,
      );
    }
  }
});

check('o tipo atual está sempre entre os seus irmãos', () => {
  // O chip do tipo vigente é o que mostra de onde a correção parte. Faltando
  // ele, a tela abriria com nenhum chip aceso e a escolha viraria adivinhação.
  for (const id of [...KNOWN_ACTIVITY_IDS, 3000, 9999]) {
    assert.ok(activitySiblings(id).includes(id), `${id} não se oferece`);
  }
});

check('a família de pé é corrida, trilha e caminhada — nessa ordem', () => {
  // A ordem é contrato: o chip não pode trocar de lugar quando a escolha muda.
  for (const id of [37, 24, 52]) {
    assert.deepEqual(activitySiblings(id), [37, 24, 52], `a partir de ${id}`);
  }
});

check('a família genérica oferece só o próprio tipo', () => {
  // Onze chips não são um atalho. Para esses, o caminho é a folha.
  for (const id of [11, 16, 20, 44, 50, 57, 59, 63, 66, 73, 82]) {
    assert.equal(activityFamily(id), 'generic', `${id} deixou de ser genérico`);
    assert.deepEqual(activitySiblings(id), [id]);
  }
});

check('tipo sem label devolve a si mesmo, e não lista vazia', () => {
  assert.deepEqual(activitySiblings(3000), [3000]);
  assert.deepEqual(activitySiblings(9999), [9999]);
});

check('a lista da folha tem todos os tipos com label, em ordem alfabética', () => {
  assert.equal(KNOWN_ACTIVITY_IDS.length, Object.keys(ACTIVITY_TYPE_LABELS).length);
  const labels = KNOWN_ACTIVITY_IDS.map((id) => ACTIVITY_TYPE_LABELS[id]);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  // Cobre o caso que motivou tudo: os dois tipos a pé estão na lista.
  assert.ok(KNOWN_ACTIVITY_IDS.includes(24) && KNOWN_ACTIVITY_IDS.includes(52));
});

console.log(`\n${passed} testes passaram.`);
