/**
 * Carga semanal por zona de FC.
 *
 * Os mesmos nove casos do `weekly-load.spec.ts` da web, que continua rodando
 * contra o adaptador — dois harnesses, uma regra. O que se protege aqui é o
 * alerta de carga: ele só pode ligar com base (≥ 2 semanas), e liga em 1,5× a
 * média das anteriores, não da atual.
 */

import assert from 'node:assert/strict';
import { buildWeeklyLoad } from './weekly-load';
import { mondayOf } from '../week/recap';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: Math.random().toString(36),
    userId: 'u1',
    activityId: 37,
    calories: 100,
    durationS: 1800,
    distanceM: 5000,
    endAt: partial.startAt,
    hasRoute: false,
    ...partial,
  };
}

// Quarta-feira 03/06/2026 → semana de seg 01/06 a dom 07/06.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

check('mondayOf do núcleo — domingo cai na semana anterior', () => {
  assert.deepEqual(mondayOf(new Date(2026, 5, 3)), new Date(2026, 5, 1));
  assert.deepEqual(mondayOf(new Date(2026, 5, 1)), new Date(2026, 5, 1));
  assert.deepEqual(mondayOf(new Date(2026, 5, 7)), new Date(2026, 5, 1));
  assert.deepEqual(mondayOf(new Date(2026, 5, 8)), new Date(2026, 5, 8));
});

check('N buckets em ordem cronológica, terminando na semana atual', () => {
  const r = buildWeeklyLoad([], 8, NOW);
  assert.equal(r.buckets.length, 8);
  assert.equal(r.buckets[7].key, '2026-06-01');
  assert.equal(r.buckets[7].label, '01/06');
  assert.equal(r.buckets[0].key, '2026-04-13');
  const keys = r.buckets.map((b) => b.key);
  assert.deepEqual([...keys].sort(), keys, 'chaves estritamente crescentes');
});

check('soma segundos por zona na semana e ordena Z1..Z5', () => {
  const r = buildWeeklyLoad(
    [
      act({ startAt: '2026-06-01T08:00:00', hrZones: { z1: 600, z3: 300 } }),
      act({ startAt: '2026-06-04T08:00:00', hrZones: { z1: 400, z5: 120 } }),
    ],
    8,
    NOW,
  );
  const cur = r.buckets[7];
  assert.equal(cur.total, 600 + 300 + 400 + 120);
  assert.deepEqual(cur.segments.map((s) => s.value), [1000, 300, 120], 'z1, z3, z5 — z2/z4 omitidos');
});

check('semana sem dado de FC vira barra vazia, mantendo o eixo', () => {
  const r = buildWeeklyLoad([act({ startAt: '2026-06-01T08:00:00', hrZones: { z2: 500 } })], 8, NOW);
  assert.equal(r.buckets[0].total, 0);
  assert.deepEqual(r.buckets[0].segments, []);
});

check('treino sem hrZones não contribui', () => {
  const r = buildWeeklyLoad([act({ startAt: '2026-06-02T08:00:00' })], 8, NOW);
  assert.equal(r.buckets[7].total, 0);
});

check('polarização — leve/forte e easyPct da semana atual', () => {
  const r = buildWeeklyLoad(
    [act({ startAt: '2026-06-02T08:00:00', hrZones: { z1: 300, z2: 300, z3: 100, z4: 100, z5: 100 } })],
    8,
    NOW,
  );
  assert.equal(r.polarization.easyS, 600);
  assert.equal(r.polarization.hardS, 200);
  assert.equal(r.polarization.totalS, 900);
  assert.ok(Math.abs(r.polarization.easyPct - (600 / 900) * 100) < 1e-5);
});

check('polarização — easyPct é 0 sem tempo em zona, sem dividir por zero', () => {
  const r = buildWeeklyLoad([], 8, NOW);
  assert.equal(r.polarization.totalS, 0);
  assert.equal(r.polarization.easyPct, 0);
});

check('alerta — liga quando Z4+Z5 atual > 1,5× a média das anteriores (≥ 2 com dado)', () => {
  const r = buildWeeklyLoad(
    [
      act({ startAt: '2026-05-18T08:00:00', hrZones: { z4: 100 } }),
      act({ startAt: '2026-05-25T08:00:00', hrZones: { z4: 100 } }),
      act({ startAt: '2026-06-02T08:00:00', hrZones: { z4: 200 } }),
    ],
    8,
    NOW,
  );
  assert.equal(r.highLoadAlert, true, '200 > 150');
});

check('alerta — não liga com menos de 2 semanas de baseline', () => {
  const r = buildWeeklyLoad(
    [
      act({ startAt: '2026-05-25T08:00:00', hrZones: { z4: 100 } }),
      act({ startAt: '2026-06-02T08:00:00', hrZones: { z4: 999 } }),
    ],
    8,
    NOW,
  );
  assert.equal(r.highLoadAlert, false, 'uma semana de base não é base');
});

check('alerta — não liga quando a carga atual está dentro do habitual', () => {
  const r = buildWeeklyLoad(
    [
      act({ startAt: '2026-05-18T08:00:00', hrZones: { z5: 200 } }),
      act({ startAt: '2026-05-25T08:00:00', hrZones: { z5: 200 } }),
      act({ startAt: '2026-06-02T08:00:00', hrZones: { z5: 220 } }),
    ],
    8,
    NOW,
  );
  assert.equal(r.highLoadAlert, false, '220 < 300');
});

console.log(`\n${passed} testes passaram.`);
