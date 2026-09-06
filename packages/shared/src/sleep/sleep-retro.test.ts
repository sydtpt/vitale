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
  nightStartDay,
  ratingsSplit,
  signedMin,
  sleepCrossHighlight,
  sleepCrossMetrics,
  sleepHighlights,
  sleepRetro,
  sleepSide,
  weekendShift,
  AWAKE_COUNTED_MIN,
  MEAN_MEDIAN_GAP_MIN,
  SLEEP_BANDS,
  awakeSpread,
  regularityByWeek,
  sleepBands,
} from './retro';
import { triggerImpact } from '../health/trigger-impact';

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

check('sleepCrossMetrics — chave é o dia em que a noite começou, não o de acordar', () => {
  assert.equal(nightStartDay('2026-06-15'), '2026-06-14');
  assert.equal(nightStartDay('2026-03-01'), '2026-02-28');
  const ms = sleepCrossMetrics(WEEK);
  const dormido = ms.find((m) => m.metric === 'dormido')!;
  assert.ok(dormido.valuesByDay.has('2026-06-14'), 'a noite de 15/06 conta para o dia 14');
  assert.ok(!dormido.valuesByDay.has('2026-06-15') || WEEK.some((p) => p.wakeDay === '2026-06-16'));
  assert.equal(dormido.valuesByDay.size, 7);
  const acordado = ms.find((m) => m.metric === 'acordado')!;
  assert.equal(acordado.higherIsWorse, true);
  assert.equal(acordado.valuesByDay.get('2026-06-18'), 30); // noite de 19/06: 30 min
  const rem = ms.find((m) => m.metric === 'rem')!;
  assert.equal(rem.valuesByDay.get('2026-06-14'), 90); // 1,5 h em minutos
  // Fonte que não reporta vigília e noite sem hipnograma ficam de fora dos seus mapas.
  const mudo = sleepCrossMetrics(WEEK.map((p) => ({ ...p, awakenings: null, stages: null })));
  assert.equal(mudo.find((m) => m.metric === 'acordado')!.valuesByDay.size, 0);
  assert.equal(mudo.find((m) => m.metric === 'profundo')!.valuesByDay.size, 0);
  assert.equal(mudo.find((m) => m.metric === 'dormido')!.valuesByDay.size, 7);
});

check('sleepCrossHighlight — valores absolutos, n dos dois lados, tom pelo pior lado', () => {
  const ms = sleepCrossMetrics([...PREV, ...WEEK]);
  const dormido = ms.find((m) => m.metric === 'dormido')!;
  // "Cerveja" nas vésperas de 15, 16 e 17/06 — as três noites mais curtas da semana.
  const dias = new Set(['2026-06-14', '2026-06-15', '2026-06-16']);
  const imp = triggerImpact('dormido', dias, dormido.valuesByDay);
  assert.equal(imp.nWith, 3);
  assert.equal(imp.nWithout, 9);
  const h = sleepCrossHighlight(dormido, 'Cerveja', imp, 5)!;
  assert.ok(h, 'diferença acima do piso');
  assert.equal(h.kind, 'cross');
  assert.equal(h.tone, 'bad');
  assert.ok(h.text.startsWith('Nas noites depois de "Cerveja", dormiu '));
  assert.ok(h.text.includes(' contra '));
  assert.equal(h.support, '3 noites com · 9 sem · associação, não causa');
  // Abaixo do piso: nada.
  assert.equal(sleepCrossHighlight(dormido, 'Cerveja', imp, 99), null);
  // Sem amostra de um lado: nada.
  const pouco = triggerImpact('dormido', new Set(['2026-06-14']), dormido.valuesByDay);
  assert.equal(sleepCrossHighlight(dormido, 'Cerveja', pouco, 5), null);
  // Vigília: subir é pior.
  const acordado = ms.find((m) => m.metric === 'acordado')!;
  const impAw = triggerImpact('acordado', new Set(['2026-06-08', '2026-06-09', '2026-06-10']), acordado.valuesByDay);
  const hAw = sleepCrossHighlight(acordado, 'Cerveja', impAw, 5)!;
  assert.equal(hAw.tone, 'bad');
  assert.ok(hAw.text.includes('ficou ') && hAw.text.includes(' acordado contra '));
});


/* ═══════════ As seis pautas de 06/09/2026 — a página completa ═══════════ */

/** `n` noites seguidas terminando em `lastDay`, com horários constantes. */
function seq(lastDay: string, n: number, onset = '23:30', wake = '07:00'): SleepPeriod[] {
  const out: SleepPeriod[] = [];
  const d = new Date(`${lastDay}T12:00:00Z`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i);
    out.push(night(x.toISOString().slice(0, 10), onset, wake));
  }
  return out;
}

check('média × mediana: uma noite curta desloca a média e o jornal publica as duas', () => {
  // Seis noites de 7h30 e uma de 1h — o caso de 7 de agosto de 2026.
  const ns = [...seq('2026-08-06', 6), night('2026-08-07', '05:00', '06:00')];
  const r = sleepRetro(ns, null)!;
  assert.ok(r.medianH > r.cur.asleepH, 'a mediana resiste ao que a média não resiste');
  assert.equal(r.meanMedianSplit, true);
  // Sem a noite curta, as duas convergem e o jornal publica uma só.
  const limpo = sleepRetro(seq('2026-08-06', 6), null)!;
  assert.equal(limpo.meanMedianSplit, false);
  assert.equal(Math.round(limpo.medianH * 60), Math.round(limpo.cur.asleepH * 60));
});

check('o limiar de publicar as duas é de minutos, não de gosto', () => {
  assert.equal(MEAN_MEDIAN_GAP_MIN, 10);
});

check('faixas de duração: contagem e a nota média de cada, sem inventar nota', () => {
  const ns = [
    night('2026-08-01', '01:00', '06:00'),          // 5 h
    night('2026-08-02', '00:30', '07:00'),          // 6,5 h
    night('2026-08-03', '23:30', '07:00'),          // 7,5 h
    night('2026-08-04', '22:30', '07:00'),          // 8,5 h
  ];
  const notas = new Map([['2026-08-01', 2], ['2026-08-03', 5]]);
  const b = sleepBands(ns, notas);
  assert.deepEqual(b.map((x) => x.nights), [1, 1, 1, 1]);
  assert.deepEqual(b.map((x) => x.label), SLEEP_BANDS.map((x) => x.label));
  assert.equal(b[0].rating, 2);
  assert.equal(b[1].rating, null, 'faixa sem nota não recebe nota média');
  assert.equal(b[1].ratedNights, 0);
  assert.equal(b[2].rating, 5);
});

check('faixas sem mapa de notas: contagem existe, nota é null', () => {
  const b = sleepBands(seq('2026-08-07', 4));
  assert.equal(b.reduce((s, x) => s + x.nights, 0), 4);
  assert.ok(b.every((x) => x.rating === null));
});

check('duração dos despertares: o critério de contagem é acima de 5 min', () => {
  const ns = [
    night('2026-08-01', '23:30', '07:00', { awakenings: [[60, 2], [120, 3], [200, 20]] }),
    night('2026-08-02', '23:30', '07:00', { awakenings: [[90, 45]] }),
  ];
  const sp = awakeSpread(ns)!;
  assert.equal(sp.total, 4);
  assert.equal(sp.counted, 2, 'só os de 20 e 45 min passam do critério do consenso');
  assert.equal(AWAKE_COUNTED_MIN, 5);
});

check('fonte que não reporta: espalhamento é null, não um zero', () => {
  assert.equal(awakeSpread([night('2026-08-01', '23:30', '07:00', { awakenings: null })]), null);
});

check('regularidade por semana: buraco não vira constância', () => {
  // Semana cheia de 7 noites idênticas → índice alto.
  const cheia = seq('2026-08-09', 7);
  const [w] = regularityByWeek(cheia);
  assert.equal(w.nights, 7);
  assert.ok(w.sri !== null && w.sri > 90, 'sete noites iguais são muito regulares');

  // A mesma semana com dois buracos: o maior trecho seguido tem 3 noites.
  const furada = [...cheia.slice(0, 3), ...cheia.slice(5)];
  const [f] = regularityByWeek(furada);
  assert.equal(f.nights, 5);
  assert.equal(f.sri, null, 'sem 5 noites seguidas o índice não sai');
});

check('regularidade por semana devolve uma linha por semana, em ordem', () => {
  const duas = [...seq('2026-08-09', 7), ...seq('2026-08-16', 7)];
  const ws = regularityByWeek(duas);
  assert.equal(ws.length, 2);
  assert.ok(ws[0].key < ws[1].key);
  assert.ok(ws.every((w) => w.sri !== null));
});

check('o selo só existe quando o chamador diz de quantas noites o período é', () => {
  const ns = seq('2026-08-28', 20);
  assert.equal(sleepRetro(ns, null)!.score, null, 'sem expectedNights não há selo');

  const comSelo = sleepRetro(ns, null, undefined, [], { expectedNights: 31, history: seq('2026-07-31', 30) })!;
  assert.ok(comSelo.score);
  assert.equal(comSelo.score!.coverage!.nights, 20);
  assert.equal(comSelo.score!.coverage!.expected, 31);
  assert.equal(comSelo.score!.scored, false, '20 de 31 é 65%, abaixo do piso');
});

check('cobertura suficiente: o selo pontua e traz as cinco dimensões', () => {
  const s = sleepRetro(seq('2026-08-28', 25), null, undefined, [], {
    expectedNights: 31, history: seq('2026-07-31', 30),
  })!.score!;
  assert.equal(s.scored, true);
  assert.equal(s.dimensions.length, 5);
  assert.ok(s.dimensions.some((d) => d.key === 'regularidade' && d.points !== null));
});

check('extremos: as duas datas saem sempre; a contagem só com histórico', () => {
  const ns = [...seq('2026-08-06', 6), night('2026-08-07', '05:00', '06:00')];
  const semHist = sleepRetro(ns, null)!;
  assert.equal(semHist.extremes.shortest.day, '2026-08-07');
  assert.equal(semHist.extremes.best, null, 'sem linha de base não há contagem por noite');

  const comHist = sleepRetro(ns, null, new Map([['2026-08-07', 2], ['2026-08-05', 5]]), [], {
    history: seq('2026-07-31', 30),
  })!;
  assert.equal(comHist.extremes.shortest.day, '2026-08-07');
  assert.equal(comHist.extremes.worst!.day, '2026-08-07', 'a noite de 1 h é a de menor contagem');
  assert.ok(comHist.extremes.best !== null && comHist.extremes.best.max >= 6);
});

check('a peça de 05/09 continua inteira quando ninguém passa as opções novas', () => {
  const r = sleepRetro(seq('2026-08-09', 7), seq('2026-08-02', 7))!;
  assert.ok(r.cur && r.delta && r.weeks.length > 0, 'o que existia continua');
  assert.equal(r.score, null);
  assert.equal(r.extremes.best, null);
  // E o que é fato do período sai mesmo sem opções.
  assert.equal(r.bands.length, 4);
  assert.ok(r.regularityWeeks.length > 0);
  assert.ok(typeof r.medianH === 'number');
});

console.log(`\n${passed} checks passaram`);
