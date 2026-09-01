/**
 * A tendência do melhor por distância.
 *
 * O que estes testes protegem: o buraco é buraco (mês sem corrida é `null`, não
 * o vizinho repetido), o ponto do mês é o **melhor** daquele mês e não o último,
 * e o recorde da linha de referência é o mesmo número que o pódio chama de ouro.
 */

import assert from 'node:assert/strict';
import { bestEffortTrend, distancesWithData } from './best-effort-trend';
import { rankBestEfforts } from './best-efforts';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const NOW = new Date(2026, 7, 20, 14, 0, 0); // 20/08/2026
const RUN = 37;

/** `monthsAgo` conta a partir de agosto/2026; `day` fixa o dia dentro do mês. */
function act(id: string, monthsAgo: number, efforts: Record<string, number>, day = 10, sport = RUN): Activity {
  const d = new Date(2026, 7 - monthsAgo, day, 9, 0, 0);
  return {
    id,
    userId: 'u',
    activityId: sport,
    calories: 300,
    startAt: d.toISOString(),
    endAt: new Date(d.getTime() + 3600_000).toISOString(),
    durationS: 3600,
    distanceM: 10_000,
    hasRoute: true,
    bestEfforts: efforts,
  };
}

check('a janela tem N meses, da mais antiga à atual, terminando no mês corrente', () => {
  const t = bestEffortTrend([], RUN, '5000', 12, NOW);
  assert.equal(t.buckets.length, 12);
  assert.equal(t.buckets[11].key, '2026-08', 'termina em agosto');
  assert.equal(t.buckets[0].key, '2025-09', 'doze meses para trás');
  assert.equal(t.buckets[11].label, 'ago');
  assert.ok(t.buckets.every((b) => b.secs === null), 'sem corrida, tudo buraco');
  assert.equal(t.measured, 0);
  assert.equal(t.record, null);
});

check('o ponto do mês é o MELHOR do mês, não o último', () => {
  const t = bestEffortTrend(
    [act('cedo', 0, { '5000': 1350 }, 3), act('tarde', 0, { '5000': 1400 }, 15)],
    RUN, '5000', 3, NOW,
  );
  const ago = t.buckets[2];
  assert.equal(ago.secs, 1350, 'o de dia 3 foi mais rápido que o de dia 15');
  assert.equal(ago.id, 'cedo', 'e é ele que a tela abre ao tocar');
});

check('mês sem corrida é null — não repete o vizinho', () => {
  const t = bestEffortTrend([act('a', 2, { '5000': 1400 }), act('b', 0, { '5000': 1300 })], RUN, '5000', 3, NOW);
  assert.deepEqual(
    t.buckets.map((b) => b.secs),
    [1400, null, 1300],
    'julho fica vazio; ligar junho a agosto inventaria uma progressão',
  );
  assert.equal(t.measured, 2);
});

check('corrida que não cobriu a distância não põe ponto', () => {
  const t = bestEffortTrend([act('curta', 0, { '1000': 250 })], RUN, '5000', 2, NOW);
  assert.ok(t.buckets.every((b) => b.secs === null), 'um 1 km não é um ponto na série de 5 km');
});

check('a linha de referência é o mesmo recorde que o pódio chama de ouro', () => {
  const pop = [act('a', 5, { '5000': 1400 }), act('b', 2, { '5000': 1300 }), act('c', 0, { '5000': 1350 })];
  const t = bestEffortTrend(pop, RUN, '5000', 12, NOW);
  const ouro = rankBestEfforts(pop, RUN, '5000')[0];
  assert.equal(t.record!.secs, 1300);
  assert.equal(t.record!.id, ouro.id, 'dois números certos sobre a mesma coisa seria o pior bug');
});

check('o recorde pode estar fora da janela e ainda ser a referência', () => {
  const t = bestEffortTrend([act('velho', 20, { '5000': 1200 }), act('novo', 0, { '5000': 1350 })], RUN, '5000', 12, NOW);
  assert.equal(t.record!.secs, 1200, 'de 2024, fora dos 12 meses, mas é o chão de sempre');
  assert.equal(t.measured, 1, 'e não vira ponto — está fora da janela desenhada');
});

check('cada esporte tem a própria série', () => {
  const pop = [act('corrida', 0, { '5000': 1400 }), act('pedal', 0, { '5000': 500 }, 10, 13)];
  assert.equal(bestEffortTrend(pop, RUN, '5000', 1, NOW).buckets[0].secs, 1400);
  assert.equal(bestEffortTrend(pop, 13, '5000', 1, NOW).buckets[0].secs, 500);
});

check('o seletor só oferece as distâncias que têm marca', () => {
  const pop = [act('a', 0, { '1000': 250, '5000': 1350 }), act('b', 1, { '5000': 1400 })];
  assert.deepEqual(
    distancesWithData(pop, RUN).map((d) => d.key),
    ['1000', '5000'],
    'nada de "Maratona" para quem nunca correu uma',
  );
  assert.deepEqual(distancesWithData(pop, 13), [], 'o pedal não tem nenhuma');
});

console.log(`\n${passed} testes passaram.`);
