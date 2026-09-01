/**
 * Recordes por distância.
 *
 * O que estes testes protegem é o **significado da medalha**: ela aparece em
 * duas telas e tem de querer dizer a mesma coisa nas duas. Empate é ouro duplo,
 * não ouro e prata; disputa de dois não tem prata; e um pedal nunca concorre
 * com uma corrida.
 */

import assert from 'node:assert/strict';
import {
  BEST_EFFORT_DISTANCES,
  MIN_CONTEST_SIZE,
  bestEffortRank,
  rankBestEfforts,
  segmentsInside,
} from './best-efforts';
import { BEST_EFFORT_TARGETS } from './streams';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const RUN = 37;
const RIDE = 13;

function act(
  id: string,
  efforts: Record<string, number> | undefined,
  opts: { sport?: number; day?: number; hidden?: boolean } = {},
): Activity {
  const { sport = RUN, day = 1, hidden } = opts;
  const d = new Date(2026, 5, day, 9, 0, 0);
  return {
    id,
    userId: 'u',
    activityId: sport,
    calories: 300,
    startAt: d.toISOString(),
    endAt: new Date(d.getTime() + 3600_000).toISOString(),
    durationS: 3600,
    distanceM: 21_000,
    hasRoute: true,
    bestEfforts: efforts,
    hidden,
  };
}

check('a tabela cobre toda chave que o sync escreve, com rótulo de verdade', () => {
  assert.equal(BEST_EFFORT_DISTANCES.length, BEST_EFFORT_TARGETS.length);
  for (const t of BEST_EFFORT_TARGETS) {
    const d = BEST_EFFORT_DISTANCES.find((x) => x.key === t.key);
    assert.ok(d, `chave ${t.key} do sync não tem entrada`);
    assert.equal(d!.meters, t.meters);
    assert.notEqual(d!.label, t.key, `chave ${t.key} caiu no rótulo de fallback — falta nomear`);
  }
});

check('a tabela vem em ordem crescente de distância', () => {
  for (let i = 1; i < BEST_EFFORT_DISTANCES.length; i++) {
    assert.ok(BEST_EFFORT_DISTANCES[i].meters > BEST_EFFORT_DISTANCES[i - 1].meters);
  }
});

check('ranking — da mais rápida à mais lenta, com a posição', () => {
  const r = rankBestEfforts(
    [act('a', { '5000': 1400 }), act('b', { '5000': 1300 }), act('c', { '5000': 1500 })],
    RUN,
    '5000',
  );
  assert.deepEqual(
    r.map((x) => [x.id, x.rank]),
    [['b', 1], ['a', 2], ['c', 3]],
  );
});

check('ranking — empate divide a posição e pula a seguinte (1224)', () => {
  const r = rankBestEfforts(
    [act('a', { '5000': 1300 }), act('b', { '5000': 1300 }), act('c', { '5000': 1400 }), act('d', { '5000': 1500 })],
    RUN,
    '5000',
  );
  assert.deepEqual(
    r.map((x) => x.rank),
    [1, 1, 3, 4],
    'dois 21:40 são dois ouros; o próximo é 3º, não 2º',
  );
});

check('ranking — sem a distância, sem bestEfforts, ou oculta: fora', () => {
  const r = rankBestEfforts(
    [
      act('semDist', { '1000': 240 }),
      act('semNada', undefined),
      act('oculta', { '5000': 1000 }, { hidden: true }),
      act('ok', { '5000': 1400 }),
      act('zero', { '5000': 0 }),
    ],
    RUN,
    '5000',
  );
  assert.deepEqual(r.map((x) => x.id), ['ok']);
});

check('ranking — cada esporte compete consigo mesmo', () => {
  const pop = [act('corrida', { '5000': 1400 }), act('pedal', { '5000': 500, '20000': 2000 }, { sport: RIDE })];
  assert.deepEqual(rankBestEfforts(pop, RUN, '5000').map((x) => x.id), ['corrida']);
  assert.deepEqual(rankBestEfforts(pop, RIDE, '5000').map((x) => x.id), ['pedal']);
  assert.equal(
    bestEffortRank(pop, pop[0], '5000'),
    null,
    'a corrida não vira "2º" por existir um pedal mais rápido no mesmo 5 km',
  );
});

check('medalha — precisa de disputa: abaixo de três participantes é null', () => {
  const um = [act('a', { '5000': 1400 })];
  assert.equal(bestEffortRank(um, um[0], '5000'), null, 'ouro de um só não é ouro');
  const dois = [act('a', { '5000': 1400 }), act('b', { '5000': 1500 })];
  assert.equal(bestEffortRank(dois, dois[0], '5000'), null, 'prata numa disputa de dois é a pior das duas');
  assert.equal(MIN_CONTEST_SIZE, 3);
});

check('medalha — 1, 2, 3 com três ou mais; do 4º em diante, null', () => {
  const pop = [
    act('ouro', { '5000': 1300 }),
    act('prata', { '5000': 1350 }),
    act('bronze', { '5000': 1400 }),
    act('quarto', { '5000': 1450 }),
  ];
  assert.equal(bestEffortRank(pop, pop[0], '5000'), 1);
  assert.equal(bestEffortRank(pop, pop[1], '5000'), 2);
  assert.equal(bestEffortRank(pop, pop[2], '5000'), 3);
  assert.equal(bestEffortRank(pop, pop[3], '5000'), null, 'não existe "4º lugar" no pódio');
});

check('medalha — a mesma corrida pode ser ouro em duas distâncias', () => {
  const longa = act('longa', { '5000': 1300, '10000': 2700 });
  const pop = [
    longa,
    act('b', { '5000': 1350, '10000': 2800 }),
    act('c', { '5000': 1400, '10000': 2900 }),
  ];
  assert.equal(bestEffortRank(pop, longa, '5000'), 1);
  assert.equal(bestEffortRank(pop, longa, '10000'), 1);
});

check('segmentos — só as distâncias que couberam, crescente, com ritmo e medalha', () => {
  const hoje = act('hoje', { '1000': 250, '5000': 1350, '10000': 2800 });
  const pop = [
    hoje,
    act('b', { '1000': 240, '5000': 1300, '10000': 2700 }),
    act('c', { '1000': 260, '5000': 1400, '10000': 2900 }),
  ];
  const s = segmentsInside(pop, hoje);
  assert.deepEqual(s.map((x) => x.key), ['1000', '5000', '10000'], 'meia e maratona não couberam');
  assert.deepEqual(s.map((x) => x.rank), [2, 2, 2]);
  assert.equal(s[0].label, '1 km');
  assert.equal(s[1].secPerKm, 270, '1350 s em 5 km = 4:30 /km');
});

check('segmentos — sem disputa o número fica e a medalha não', () => {
  const so = act('so', { '5000': 1350 });
  const s = segmentsInside([so], so);
  assert.equal(s.length, 1);
  assert.equal(s[0].secs, 1350, 'o tempo daquela corrida é real e aparece');
  assert.equal(s[0].rank, null, 'mas "ouro de um só" não');
});

check('segmentos — corrida sem bestEfforts devolve lista vazia, não erro', () => {
  const semGps = act('x', undefined);
  assert.deepEqual(segmentsInside([semGps], semGps), []);
});

console.log(`\n${passed} testes passaram.`);
