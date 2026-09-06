/**
 * Derivações da série intradiária — linha em trechos, faixa por hora, noite,
 * mapa dia × hora e as projeções no minuto local.
 *
 * Spec: docs/specs/fc-serie/spec.md
 */

import assert from 'node:assert/strict';
import type { HealthSeriesDay, SleepPeriod } from '../models';
import {
  HEART_DAY_MAX_BPM,
  HEART_DAY_MIN_BPM,
  NIGHT_MIN_POINTS,
  activityMarkLabel,
  activitySpansOnDay,
  dayHourCells,
  heartLineRuns,
  hourlyProfile,
  localMinuteOf,
  nightHeartRates,
  parseInstant,
  sleepSpansOnDay,
} from './series-derive';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Um dia da tabela: leituras a cada 2 min entre `fromMin` e `toMin`, valor por função. */
function day(key: string, fromMin: number, toMin: number, value: (m: number) => number, tzOffset = 120): HealthSeriesDay {
  const minutes: number[] = [];
  const readings: number[] = [];
  for (let m = fromMin; m <= toMin; m += 2) {
    minutes.push(m);
    readings.push(value(m));
  }
  return { userId: 'u1', day: key, metric: 'fc', tzOffset, minutes, readings };
}

const period = (onsetAt: string, wakeAt: string, wakeDay: string): SleepPeriod => ({
  userId: 'u1', onsetAt, wakeAt, inBedAt: null, inBedEnd: null, tzOffset: 120, wakeDay,
  asleepH: 7, awakenings: null, stages: null, stageSegments: null,
});

check('escala fixa 40–170 e piso de 30 pontos por noite', () => {
  assert.equal(HEART_DAY_MIN_BPM, 40);
  assert.equal(HEART_DAY_MAX_BPM, 170);
  assert.equal(NIGHT_MIN_POINTS, 30);
});

check('heartLineRuns: buraco maior que 10 min recomeça o traço; menor liga', () => {
  const runs = heartLineRuns([0, 2, 4, 14, 16, 40, 42], [50, 51, 52, 53, 54, 55, 56]);
  assert.deepEqual(runs.map((r) => r.map((p) => p.minute)), [[0, 2, 4, 14, 16], [40, 42]]);
  assert.deepEqual(heartLineRuns([], []), []);
});

check('hourlyProfile: p25/p50/p75 por hora, só horas com amostra', () => {
  // Hora 10 com 60, 62, 64, 66 e 68 nos dois dias (10 valores); hora 11 vazia.
  const d1 = day('2026-09-03', 600, 608, (m) => 60 + (m - 600));
  const d2 = day('2026-09-04', 600, 608, (m) => 60 + (m - 600));
  const prof = hourlyProfile([d1, d2]);
  assert.equal(prof.length, 1);
  assert.deepEqual(prof[0], { hour: 10, p25: 62, p50: 64, p75: 66, n: 10 });
  assert.deepEqual(hourlyProfile([]), []);
});

check('dayHourCells: média inteira por (dia, hora), em ordem', () => {
  const d = day('2026-09-04', 0, 120, (m) => (m < 60 ? 50 : 70));
  const cells = dayHourCells([d]);
  assert.deepEqual(cells.map((c) => [c.hour, c.value]), [[0, 50], [1, 70], [2, 70]]);
  assert.equal(cells[0].n, 30);
});

check('parseInstant aceita ISO com T e o formato do editor SQL', () => {
  assert.equal(parseInstant('2026-09-04T04:00:00+00:00'), Date.UTC(2026, 8, 4, 4));
  assert.equal(parseInstant('2026-09-04 04:00:00+00'), Date.UTC(2026, 8, 4, 4));
});

check('localMinuteOf projeta o instante no minuto local do dia, com tzOffset', () => {
  // 04:00Z em UTC+2 = 06:00 local do dia 04/09 → minuto 360.
  assert.equal(localMinuteOf('2026-09-04T04:00:00+00:00', '2026-09-04', 120), 360);
  // 21:00Z do dia 3 é 23:00 local do dia 3 → no eixo do dia 4, −60.
  assert.equal(localMinuteOf('2026-09-03T21:00:00+00:00', '2026-09-04', 120), -60);
});

check('nightHeartRates: a noite atravessa dois dias da tabela e dá média, mínima e hora da mínima', () => {
  // Dormiu 23:00 local (21:00Z) do dia 3, acordou 06:00 local (04:00Z) do dia 4.
  const p = period('2026-09-03T21:00:00+00:00', '2026-09-04T04:00:00+00:00', '2026-09-04');
  // Dia 3: 22:00–23:58 local (acordado até 23:00, depois dormindo a 55)
  const d3 = day('2026-09-03', 1320, 1438, (m) => (m < 1380 ? 70 : 55));
  // Dia 4: 00:00–08:00 local; mínima 44 às 03:30 (minuto 210); depois de acordar, 80.
  const d4 = day('2026-09-04', 0, 480, (m) => (m === 210 ? 44 : m <= 360 ? 52 : 80));
  const nights = nightHeartRates([d4, d3], [p]);
  assert.equal(nights.length, 1);
  const n = nights[0];
  assert.equal(n.wakeDay, '2026-09-04');
  assert.equal(n.min, 44);
  assert.equal(n.minAtMs, Date.UTC(2026, 8, 4, 1, 30)); // 03:30 local = 01:30Z
  // 30 pontos a 55 (23:00–23:58) + 181 pontos do dia 4 até 06:00 (180 a 52, um a 44)
  assert.equal(n.n, 30 + 181);
  const expectedMean = Math.round((30 * 55 + 180 * 52 + 44) / 211);
  assert.equal(n.mean, expectedMean);
});

check('nightHeartRates: noite com poucos pontos fica de fora; janela invertida também', () => {
  const p = period('2026-09-03T21:00:00+00:00', '2026-09-04T04:00:00+00:00', '2026-09-04');
  const sparse = day('2026-09-04', 0, 20, () => 50); // 11 pontos
  assert.deepEqual(nightHeartRates([sparse], [p]), []);
  const inverted = period('2026-09-04T04:00:00+00:00', '2026-09-03T21:00:00+00:00', '2026-09-04');
  const full = day('2026-09-04', 0, 480, () => 50);
  assert.deepEqual(nightHeartRates([full], [inverted]), []);
});

check('sleepSpansOnDay: a mesma noite vira duas sombras, uma em cada dia', () => {
  const p = period('2026-09-03T21:00:00+00:00', '2026-09-04T04:00:00+00:00', '2026-09-04');
  assert.deepEqual(sleepSpansOnDay('2026-09-03', 120, [p]), [{ from: 1380, to: 1440 }]);
  assert.deepEqual(sleepSpansOnDay('2026-09-04', 120, [p]), [{ from: 0, to: 360 }]);
  assert.deepEqual(sleepSpansOnDay('2026-09-05', 120, [p]), []);
});

check('activitySpansOnDay: recorta ao dia e leva o nome; sem nome é Treino', () => {
  const spans = activitySpansOnDay('2026-09-04', 120, [
    { startAt: '2026-09-04T08:35:00+00:00', endAt: '2026-09-04T09:39:00+00:00', name: 'Brussels · Corrida' },
    { startAt: '2026-09-04T21:30:00+00:00', endAt: '2026-09-04T23:30:00+00:00' }, // 23:30–01:30 local: atravessa a meia-noite
    { startAt: '2026-09-05T10:00:00+00:00', endAt: '2026-09-05T11:00:00+00:00', name: 'outro dia' },
  ]);
  assert.deepEqual(spans, [
    { from: 635, to: 699, name: 'Brussels · Corrida' },
    { from: 1410, to: 1440, name: 'Treino' },
  ]);
});

check('activityMarkLabel: lugar sem o sufixo do esporte, tipo quando o nome é genérico', () => {
  assert.equal(activityMarkLabel('Schaarbeek Cycling', 'Ciclismo'), 'Schaarbeek · Ciclismo');
  assert.equal(activityMarkLabel('Brussels Running'), 'Brussels');
  assert.equal(activityMarkLabel('Treino', 'Musculação'), 'Musculação');
  assert.equal(activityMarkLabel(undefined), 'Treino');
  assert.equal(activityMarkLabel('Intervalados na pista', 'Corrida'), 'Intervalados na pista');
});

console.log(`series-derive: ${passed} checks ok`);
