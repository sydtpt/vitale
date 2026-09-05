/**
 * Sono na Retrospectiva — a noite típica e o que ela autoriza a manchete a dizer.
 *
 * O que estes testes protegem:
 *
 * 1. **Diferença em minutos, com sinal.** `atual − anterior`, arredondado; sem
 *    anterior, `delta` é `null` e o texto sai sem variação.
 * 2. **`null` ≠ zero.** Fonte que não reporta despertares dá `awake: null`; a
 *    troca de relógio entre os períodos anula só `delta.awakeMin`.
 * 3. **Amostra mínima.** Fim de semana exige 2 noites de cada tipo; a manchete
 *    nota × medição exige 3 de cada lado.
 * 4. **Ordem das classes.** O cruzamento é `cross`, as horas são `health` — é o
 *    que faz a nota × medição poder abrir a edição do mês (decisão de 05/09).
 */

import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import {
  FLAT_SLEEP_MIN,
  MIN_RATING_NIGHTS,
  NIGHT_REFERENCE_H,
  ratingsSplit,
  signedMin,
  sleepHighlights,
  sleepRetro,
  sleepSide,
  weekendShift,
} from './retro';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const TZ = 120; // Bélgica, verão
const MS_MIN = 60_000;

function prevDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Uma noite sintética: `onset` "HH:MM" (à noite = dia anterior), `wake` "HH:MM"
 * no dia de acordar. `awakenings`: `[minutos após apagar, duração]`; `null` =
 * fonte não reporta.
 */
function night(
  wakeDay: string,
  onset: string,
  wake: string,
  opts: { awakenings?: Array<[number, number]> | null; stages?: { rem: number; core: number; deep: number } } = {},
): SleepPeriod {
  const onsetDay = Number(onset.slice(0, 2)) >= 18 ? prevDay(wakeDay) : wakeDay;
  const onsetAt = `${onsetDay}T${onset}:00+02:00`;
  const wakeAt = `${wakeDay}T${wake}:00+02:00`;
  const on = new Date(onsetAt).getTime();
  const aw = opts.awakenings === undefined ? [] : opts.awakenings;
  const awakenings = aw === null
    ? null
    : aw.map(([after, dur]) => ({ from: new Date(on + after * MS_MIN).toISOString(), to: new Date(on + (after + dur) * MS_MIN).toISOString() }));
  const awakeMin = (aw ?? []).reduce((s, [, d]) => s + d, 0);
  const asleepH = (new Date(wakeAt).getTime() - on) / 3_600_000 - awakeMin / 60;
  return {
    userId: 'u', onsetAt, wakeAt, inBedAt: onsetAt, inBedEnd: wakeAt, tzOffset: TZ, wakeDay, asleepH,
    awakenings,
    stages: opts.stages ? { ...opts.stages, unspecified: 0 } : null,
    stageSegments: null,
  };
}

// Semana de 15/06/2026 (segunda) a 21/06 (domingo).
const WEEK = [
  night('2026-06-15', '23:00', '07:00', { awakenings: [[120, 10]], stages: { rem: 1.5, core: 4, deep: 2 } }),
  night('2026-06-16', '00:00', '08:00', { awakenings: [[60, 5], [200, 15]], stages: { rem: 1.6, core: 4.2, deep: 1.9 } }),
  night('2026-06-17', '01:00', '07:00', { awakenings: [], stages: { rem: 1.2, core: 3.5, deep: 1.3 } }),
  night('2026-06-18', '23:30', '07:30', { awakenings: [[300, 20]], stages: { rem: 1.4, core: 4.3, deep: 2 } }),
  night('2026-06-19', '00:30', '07:00', { awakenings: [[90, 30]], stages: { rem: 1.0, core: 3.8, deep: 1.2 } }),
  night('2026-06-20', '01:30', '09:30', { awakenings: [[400, 10]], stages: { rem: 1.9, core: 4.5, deep: 1.6 } }), // sábado
  night('2026-06-21', '02:00', '10:00', { awakenings: [], stages: { rem: 2.0, core: 4.4, deep: 1.6 } }), // domingo
];
// A semana anterior: mais cedo, mais longa, mais vigília.
const PREV = [
  night('2026-06-08', '22:30', '07:00', { awakenings: [[100, 20]], stages: { rem: 1.3, core: 4.5, deep: 2.2 } }),
  night('2026-06-09', '23:00', '07:30', { awakenings: [[120, 30]], stages: { rem: 1.3, core: 4.6, deep: 2.1 } }),
  night('2026-06-10', '23:00', '07:00', { awakenings: [[60, 25]], stages: { rem: 1.2, core: 4.4, deep: 2.0 } }),
  night('2026-06-11', '23:30', '07:30', { awakenings: [[200, 40]], stages: { rem: 1.4, core: 4.3, deep: 1.9 } }),
  night('2026-06-12', '23:00', '07:00', { awakenings: [[90, 35]], stages: { rem: 1.1, core: 4.5, deep: 2.0 } }),
];

console.log('sleep/retro');

check('sleepSide — média de horas, mediana de horário e a contagem na referência', () => {
  const s = sleepSide(WEEK)!;
  assert.equal(s.nights, 7);
  // horas líquidas: 7.83, 7.67, 6, 7.67, 6, 7.83, 8 → média 7.286
  assert.ok(Math.abs(s.asleepH - 7.286) < 0.01, `asleepH ${s.asleepH}`);
  assert.equal(s.nightsAtReference, WEEK.filter((p) => p.asleepH >= NIGHT_REFERENCE_H).length);
  assert.equal(s.nightsAtReference, 5);
  // apagar: 23:00, 00:00, 01:00, 23:30, 00:30, 01:30, 02:00 → mediana 00:30 = eixo 6,5
  assert.equal(s.onset.median, 6.5);
  assert.equal(s.wake.median, 13.5); // 07:30
  assert.equal(s.longest.day, '2026-06-21');
  assert.equal(s.shortest.h, 6);
});

check('sleepSide — vigília e estágios como médias sobre quem reporta', () => {
  const s = sleepSide(WEEK)!;
  assert.ok(s.awake);
  assert.equal(s.awake!.reporting, 7);
  assert.equal(s.awake!.nightsWith, 5);
  // 10 + 20 + 0 + 20 + 30 + 10 + 0 = 90 → 12,86 min/noite
  assert.ok(Math.abs(s.awake!.minMean - 90 / 7) < 0.01);
  assert.equal(s.awake!.longest!.min, 30);
  assert.equal(s.awake!.longest!.day, '2026-06-19');
  assert.ok(s.stages);
  assert.equal(s.stages!.staged, 7);
  assert.ok(Math.abs(s.stages!.rem - 1.514) < 0.01);
});

check('sleepSide — fonte sem despertares dá awake null, não zero', () => {
  const s = sleepSide(WEEK.map((p) => ({ ...p, awakenings: null })))!;
  assert.equal(s.awake, null);
  assert.equal(sleepSide([]), null);
});

check('sleepRetro — delta em minutos, com sinal, atual − anterior', () => {
  const r = sleepRetro(WEEK, PREV)!;
  assert.ok(r.prev && r.delta);
  const prevH = sleepSide(PREV)!.asleepH; // 8.17, 8, 7.58, 7.33, 7.42 → 7.7
  assert.equal(r.delta!.asleepMin, Math.round((r.cur.asleepH - prevH) * 60));
  assert.ok(r.delta!.asleepMin < 0, 'dormiu menos');
  assert.ok(r.delta!.onsetMin > 0, 'apagou mais tarde');
  assert.equal(r.delta!.onsetMin, Math.round((6.5 - 5) * 60)); // 00:30 vs 23:00
  assert.ok(r.delta!.awakeMin! < 0, 'menos vigília que antes');
  assert.equal(typeof r.delta!.remMin, 'number');
  assert.equal(r.weeks.length, 1);
});

check('sleepRetro — sem período anterior não há delta, e o atual fica inteiro', () => {
  const r = sleepRetro(WEEK, null)!;
  assert.equal(r.prev, null);
  assert.equal(r.delta, null);
  assert.equal(r.cur.nights, 7);
  const vazio = sleepRetro(WEEK, [])!;
  assert.equal(vazio.prev, null);
  assert.equal(sleepRetro([], PREV), null);
});

check('sleepRetro — troca de relógio entre os períodos anula só a vigília', () => {
  const r = sleepRetro(WEEK, PREV, undefined, [{ day: '2026-06-14', label: 'Garmin' }])!;
  assert.ok(r.sourceChange);
  assert.equal(r.sourceChange!.label, 'Garmin');
  assert.equal(r.delta!.awakeMin, null);
  assert.equal(typeof r.delta!.asleepMin, 'number');
  // Marcador fora do intervalo não conta.
  const fora = sleepRetro(WEEK, PREV, undefined, [{ day: '2026-05-01', label: 'X' }])!;
  assert.equal(fora.sourceChange, null);
});

check('ratingsSplit — nota alta e baixa, cada lado com o seu n', () => {
  const ratings = new Map<string, number>([
    ['2026-06-15', 4], ['2026-06-16', 5], ['2026-06-17', 3], ['2026-06-18', 4], ['2026-06-19', 2], ['2026-06-20', 4],
  ]);
  const r = ratingsSplit(WEEK, ratings)!;
  assert.equal(r.n, 6);
  assert.equal(r.hi!.n, 4);
  assert.equal(r.lo!.n, 2);
  assert.ok(r.hi!.asleepH > r.lo!.asleepH, 'nas noites boas dormiu mais');
  assert.equal(r.lo!.awakeMin, 15); // 0 e 30 → 15
  assert.equal(ratingsSplit(WEEK, undefined), null);
  assert.equal(ratingsSplit(WEEK, new Map()), null);
  assert.equal(ratingsSplit(WEEK, new Map([['2026-06-15', 5]]))!.lo, null);
});

check('weekendShift — exige duas noites de cada tipo, e o sinal é "mais tarde"', () => {
  const w = weekendShift(WEEK)!;
  assert.ok(w);
  assert.equal(w.freeNights, 2);
  assert.equal(w.workNights, 5);
  assert.ok(w.midpointLaterMin > 0, 'meio do sono mais tarde no fim de semana');
  assert.ok(w.onsetLaterMin > 0);
  assert.ok(w.wakeLaterMin > 0);
  assert.equal(weekendShift(WEEK.slice(0, 6)), null); // um sábado só
});

check('signedMin — sinal tipográfico e zero sem sinal', () => {
  assert.equal(signedMin(12.4), '+12 min');
  assert.equal(signedMin(-25), '−25 min');
  assert.equal(signedMin(0.3), '0 min');
});

check('sleepHighlights — horas são health; sem anterior, tom neutro e sem variação', () => {
  const r = sleepRetro(WEEK, null)!;
  const hs = sleepHighlights(r, 'semana', false);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].kind, 'health');
  assert.equal(hs[0].tone, 'neutral');
  assert.ok(hs[0].text.startsWith('Dormiu 7h17 por noite em 7 noites'));
});

check('sleepHighlights — com anterior: tom pelo sinal, e vigília só quando muda', () => {
  const r = sleepRetro(WEEK, PREV)!;
  const hs = sleepHighlights(r, 'semana', false);
  const asleep = hs.find((h) => h.id === 'sleep-asleep')!;
  assert.equal(asleep.tone, 'bad'); // dormiu menos que na anterior
  assert.ok(asleep.text.includes('vs. semana anterior'));
  const awake = hs.find((h) => h.id === 'sleep-awake')!;
  assert.ok(awake, 'vigília caiu bem mais de 3 min');
  assert.equal(awake.tone, 'good');
  // "o mesmo" quando a diferença é menor que o piso
  const same = sleepRetro(WEEK, WEEK)!;
  const h2 = sleepHighlights(same, 'semana', false);
  assert.equal(h2[0].tone, 'neutral');
  assert.ok(h2[0].text.includes('o mesmo que'));
  assert.equal(h2.find((h) => h.id === 'sleep-awake'), undefined);
  assert.ok(FLAT_SLEEP_MIN > 0);
});

check('sleepHighlights — nota × medição é cross, neutra, e só com 3 noites de cada lado', () => {
  const poucas = new Map<string, number>([['2026-06-15', 4], ['2026-06-16', 5], ['2026-06-17', 3], ['2026-06-18', 4]]);
  assert.equal(sleepHighlights(sleepRetro(WEEK, PREV, poucas)!, 'semana', false).find((h) => h.kind === 'cross'), undefined);

  const bastantes = new Map<string, number>([
    ['2026-06-15', 4], ['2026-06-16', 5], ['2026-06-18', 4],
    ['2026-06-17', 3], ['2026-06-19', 2], ['2026-06-20', 3],
  ]);
  const cross = sleepHighlights(sleepRetro(WEEK, PREV, bastantes)!, 'semana', false).find((h) => h.kind === 'cross')!;
  assert.ok(cross);
  assert.equal(cross.tone, 'neutral');
  assert.ok(cross.support!.includes(`${MIN_RATING_NIGHTS} noites · 3 noites`));
  assert.ok(cross.text.includes('nota 4 ou mais'));
});

check('sleepHighlights — em Total (noPrior) a variação some mesmo com anterior', () => {
  const r = sleepRetro(WEEK, PREV)!;
  const hs = sleepHighlights(r, 'período', true);
  assert.equal(hs.length, 1);
  assert.equal(hs[0].tone, 'neutral');
  assert.ok(!hs[0].text.includes('vs.'));
});

console.log(`\n${passed} checks passaram`);
