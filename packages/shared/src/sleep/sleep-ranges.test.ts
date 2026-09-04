/**
 * O núcleo das subviews de sono (CAP-7): períodos, resumo do topo, colunas por
 * semana, fatos e as três leituras de despertar.
 *
 * O que estes testes protegem:
 *
 * 1. **A regra dos 80%.** "Na cama" só aparece quando a cama foi medida em pelo
 *    menos 80% das noites; senão o segundo número é "acordado". Em última/7d/4s a
 *    fonte atual mede 0% — mostrar cama ali seria repetir "dormindo".
 * 2. **Quantis iguais aos do Postgres.** `quantile` interpola como o
 *    `percentile_cont`; é o que deixa conferir a tela contra uma consulta.
 * 3. **Contar noites, não eventos.** No "quando", uma noite com cinco
 *    micro-despertares às 3h vale uma — senão o gráfico mede o relógio.
 * 4. **Eras separadas.** Quando o período cruza a troca de fonte, o tempo
 *    acordado sai antes · depois, nunca numa média única.
 */

import assert from 'node:assert/strict';
import type { SleepPeriod } from '../models';
import { SONO_RANGES, filterByRange, hasNights, rangeBounds, rangeForm, rangeLabel } from './ranges';
import { BED_AVG_MIN_SHARE, periodSummary } from './summary';
import { bucketPeriods, median, monthKey, quantile, weekKey } from './buckets';
import { awakeFacts, bucketFacts, clockOfAxis, formatHm, isFreeWakeDay, nightFacts, stageFacts } from './facts';
import { awakeByWeekday, awakeningDurations, awakeningsByHour } from './awakenings';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const BXL = 120;
/** Noite que acorda em `wakeDay`, apagando `onsetH` (local) e dormindo `durH`. */
function night(wakeDay: string, onsetH = 23.5, durH = 7.5, over: Partial<SleepPeriod> = {}): SleepPeriod {
  const wake = new Date(`${wakeDay}T12:00:00Z`);
  // onset na noite anterior, em UTC = local − 2h
  const onsetLocal = new Date(wake);
  onsetLocal.setUTCDate(onsetLocal.getUTCDate() - 1);
  onsetLocal.setUTCHours(0, 0, 0, 0);
  const onsetMs = onsetLocal.getTime() + onsetH * 3_600_000 - BXL * 60_000;
  return {
    userId: 'u',
    onsetAt: new Date(onsetMs).toISOString(),
    wakeAt: new Date(onsetMs + durH * 3_600_000).toISOString(),
    inBedAt: null,
    inBedEnd: null,
    tzOffset: BXL,
    wakeDay,
    asleepH: durH,
    awakenings: [],
    stages: null,
    stageSegments: null,
    ...over,
  };
}
const TODAY = new Date(2026, 8, 5, 10, 0, 0); // 05/09/2026 (sábado)

/* ───────────── períodos ───────────── */

check('cinco períodos, sem "sempre"; ano e 12m em semanas', () => {
  assert.deepEqual(SONO_RANGES.map((r) => r.id), ['ultima', '7d', '4s', '12m', 'ano']);
  assert.equal(rangeForm('4s'), 'nights');
  assert.equal(rangeForm('12m'), 'weeks');
  assert.equal(rangeForm('ano'), 'weeks');
});

check('limites por calendário: a janela corrente fica aberta; a navegada tem fim', () => {
  assert.deepEqual(rangeBounds('7d', TODAY), { since: '2026-08-30', until: null });
  assert.deepEqual(rangeBounds('4s', TODAY), { since: '2026-08-09', until: null });
  assert.deepEqual(rangeBounds('12m', TODAY), { since: '2025-09-06', until: null });
  assert.deepEqual(rangeBounds('ano', TODAY), { since: '2026-01-01', until: '2026-12-31' });
});

check('navegar recua um período do próprio tamanho', () => {
  assert.deepEqual(rangeBounds('7d', TODAY, 1), { since: '2026-08-23', until: '2026-08-29' });
  assert.deepEqual(rangeBounds('4s', TODAY, 1), { since: '2026-07-12', until: '2026-08-08' });
  assert.deepEqual(rangeBounds('12m', TODAY, 1), { since: '2024-09-06', until: '2025-09-05' });
  assert.deepEqual(rangeBounds('ano', TODAY, 1), { since: '2025-01-01', until: '2025-12-31' });
  assert.deepEqual(rangeBounds('ano', TODAY, 2), { since: '2024-01-01', until: '2024-12-31' });
});

check('"última" é a noite mais recente que existe, não a de hoje — e navega noite a noite', () => {
  const ps = [night('2026-09-02'), night('2026-08-30'), night('2026-09-01')];
  assert.deepEqual(filterByRange(ps, 'ultima', TODAY).map((p) => p.wakeDay), ['2026-09-02']);
  assert.deepEqual(filterByRange(ps, 'ultima', TODAY, 1).map((p) => p.wakeDay), ['2026-09-01']);
  assert.deepEqual(filterByRange(ps, 'ultima', TODAY, 3), [], 'além do histórico: vazio, não erro');
});

check('ano navegado filtra o ano inteiro e só ele; hasNights liga o ◀ só onde há noite', () => {
  const ps = [night('2025-12-31'), night('2026-01-01'), night('2026-09-01'), night('2024-06-10')];
  assert.deepEqual(filterByRange(ps, 'ano', TODAY, 1).map((p) => p.wakeDay), ['2025-12-31']);
  assert.deepEqual(filterByRange(ps, 'ano', TODAY).map((p) => p.wakeDay), ['2026-01-01', '2026-09-01']);
  assert.equal(hasNights(ps, 'ano', TODAY, 2), true, '2024 tem noite');
  assert.equal(hasNights(ps, 'ano', TODAY, 3), false, '2023 não');
  assert.equal(hasNights(ps, '7d', TODAY, 1), false, '23–29/08 sem noite nesta fixture');
});

check('rangeLabel escreve a janela igual nos dois apps', () => {
  assert.equal(rangeLabel('7d', [], TODAY), '30 ago → 5 set');
  assert.equal(rangeLabel('7d', [], TODAY, 1), '23 ago → 29 ago');
  assert.equal(rangeLabel('12m', [], TODAY), 'set 2025 → set 2026');
  assert.equal(rangeLabel('ano', [], TODAY, 1), '2025');
  assert.equal(rangeLabel('ultima', [night('2026-09-04')], TODAY), '4 set');
});

/* ───────────── resumo do topo ───────────── */

check('regra dos 80%: cama medida em 4 de 5 → "na cama"; em 3 de 5 → "acordado"', () => {
  const measured = (d: string) =>
    night(d, 23.5, 7.5, { inBedAt: night(d).onsetAt.replace('T21:30', 'T20:30'), inBedEnd: night(d).wakeAt });
  const bad = (d: string) => night(d, 23.5, 7.5, { awakenings: [{ from: night(d).wakeAt, to: night(d).wakeAt }] });
  // 21:30Z = 23:30 BXL; inBedAt uma hora antes → 60 min de latência: medida.
  const four = [measured('2026-09-01'), measured('2026-09-02'), measured('2026-09-03'), measured('2026-09-04'), bad('2026-08-31')];
  const s4 = periodSummary(four)!;
  assert.equal(s4.secondary?.kind, 'bed');
  assert.ok(s4.bedMeasuredShare >= BED_AVG_MIN_SHARE);
  const three = [measured('2026-09-01'), measured('2026-09-02'), measured('2026-09-03'), bad('2026-09-04'), bad('2026-08-31')];
  const s3 = periodSummary(three)!;
  assert.equal(s3.secondary?.kind, 'awake', '60% medido — o segundo número vira acordado');
});

check('sem cama e sem vigília reportada, não há segundo número', () => {
  const s = periodSummary([night('2026-09-01', 23.5, 7.5, { awakenings: null })])!;
  assert.equal(s.secondary, null);
  assert.equal(s.awakeMin, null);
  assert.equal(formatHm(s.asleepH), '7h30');
});

/* ───────────── colunas ───────────── */

check('weekKey é a segunda-feira; monthKey é o dia 1', () => {
  assert.equal(weekKey('2026-09-04'), '2026-08-31', 'sexta → segunda da mesma semana');
  assert.equal(weekKey('2026-08-30'), '2026-08-24', 'domingo → segunda anterior');
  assert.equal(weekKey('2026-08-31'), '2026-08-31', 'segunda → ela mesma');
  assert.equal(monthKey('2026-09-04'), '2026-09-01');
});

check('quantile interpola como o percentile_cont do Postgres', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(median([3, 1, 2]), 2);
  assert.ok(Number.isNaN(quantile([], 0.5)));
});

check('bucketPeriods por semana: mediana de apagar/acordar em eixo, e a semana certa', () => {
  const ps = [night('2026-09-01', 23), night('2026-09-02', 24), night('2026-09-03', 25)]; // ter, qua, qui
  const [b] = bucketPeriods(ps, 'week');
  assert.equal(b.key, '2026-08-31');
  assert.equal(b.nights, 3);
  // 23h, 00h, 01h locais → eixo 5, 6, 7 → mediana 6 (= 00:00)
  assert.ok(Math.abs(b.onset.median - 6) < 1e-9);
  assert.equal(clockOfAxis(b.onset.median), '00:00');
  assert.ok(Math.abs(b.asleepH - 7.5) < 1e-9);
});

/* ───────────── fatos ───────────── */

check('clockOfAxis escreve a hora do eixo e arredonda 59,6 min para a hora seguinte', () => {
  assert.equal(clockOfAxis(5 + 40 / 60), '23:40');
  assert.equal(clockOfAxis(13), '07:00');
  assert.equal(clockOfAxis(5.9999), '00:00');
});

check('fim de semana apaga mais tarde → diferença positiva em minutos', () => {
  // 05/09/2026 é sábado; 06/09 domingo. Semana: 01–04/09.
  const ps = [
    night('2026-09-01', 23), night('2026-09-02', 23), night('2026-09-03', 23), night('2026-09-04', 23),
    night('2026-09-05', 25), night('2026-09-06', 25), // deitou 01h nos dias livres
  ];
  assert.equal(isFreeWakeDay('2026-09-05'), true);
  const f = nightFacts(ps).find((x) => x.label.startsWith('Fim de semana'))!;
  assert.equal(f.value, '+120 min');
});

check('uma noite só: apagou → acordou e despertares; fonte que não reporta diz isso', () => {
  const [a, b] = nightFacts([night('2026-09-04', 23.5, 7.5, { awakenings: null })]);
  assert.equal(a.value, '23:30 → 07:00');
  assert.equal(b.value, 'a fonte não reporta');
});

check('bucketFacts separa as eras quando o período cruza a troca de relógio', () => {
  const aw = (d: string, min: number) =>
    night(d, 23.5, 7.5, {
      awakenings: [{ from: night(d).onsetAt, to: new Date(new Date(night(d).onsetAt).getTime() + min * 60_000).toISOString() }],
    });
  const ps = [aw('2026-07-01', 60), aw('2026-07-08', 60), aw('2026-07-22', 10), aw('2026-07-29', 10)];
  const facts = bucketFacts(bucketPeriods(ps, 'week'), [{ day: '2026-07-18', label: 'Garmin' }]);
  const era = facts.find((f) => f.label.includes('antes · depois'))!;
  assert.equal(era.value, '60 · 10 min');
  const semMarcador = bucketFacts(bucketPeriods(ps, 'week'));
  assert.ok(semMarcador.some((f) => f.label === 'Acordado por noite (mediana)'));
});

/* ───────────── as três leituras de despertar ───────────── */

check('"quando" conta noites por faixa, não eventos', () => {
  const at = (d: string, hLocal: number, min = 5) => {
    const base = night(d);
    const onset = new Date(base.onsetAt).getTime();
    const from = onset + (hLocal - 23.5) * 3_600_000; // relativo ao apagar às 23:30
    return { from: new Date(from).toISOString(), to: new Date(from + min * 60_000).toISOString() };
  };
  const ps = [
    night('2026-09-02', 23.5, 7.5, { awakenings: [at('2026-09-02', 27), at('2026-09-02', 27.2), at('2026-09-02', 27.4)] }), // 3× às 3h
    night('2026-09-03', 23.5, 7.5, { awakenings: [at('2026-09-03', 27)] }),
  ];
  const bins = awakeningsByHour(ps);
  const three = bins.find((b) => b.from === 9)!; // 03h local = eixo 9
  assert.equal(three.nights, 2, 'duas noites, não quatro eventos');
  assert.equal(three.awakenings, 4);
});

check('"quanto" põe cada despertar na faixa de duração certa', () => {
  const mk = (d: string, mins: number[]) =>
    night(d, 23.5, 7.5, {
      awakenings: mins.map((m, i) => {
        const from = new Date(night(d).onsetAt).getTime() + (i + 1) * 3_600_000;
        return { from: new Date(from).toISOString(), to: new Date(from + m * 60_000).toISOString() };
      }),
    });
  const d = awakeningDurations([mk('2026-09-02', [2, 10, 20, 45, 90])]);
  assert.deepEqual(d.map((x) => x.count), [1, 1, 1, 1, 1]);
});

check('por dia da semana: média de minutos e n, sem inventar zero onde a fonte não reporta', () => {
  const ps = [
    night('2026-09-05', 23.5, 7.5, { awakenings: [{ from: night('2026-09-05').onsetAt, to: new Date(new Date(night('2026-09-05').onsetAt).getTime() + 30 * 60_000).toISOString() }] }), // sáb
    night('2026-09-04', 23.5, 7.5, { awakenings: null }), // sex — não reporta
  ];
  const w = awakeByWeekday(ps);
  assert.equal(w[6].nights, 1);
  assert.equal(Math.round(w[6].avgMin!), 30);
  assert.equal(w[5].nights, 0);
  assert.equal(w[5].avgMin, null, 'sexta não reporta: null, não zero');
});

check('awakeFacts: hora mais comum só com repetição, e com o n ao lado', () => {
  const at = (d: string, hLocal: number, min = 5) => {
    const base = night(d);
    const from = new Date(base.onsetAt).getTime() + (hLocal - 23.5) * 3_600_000;
    return { from: new Date(from).toISOString(), to: new Date(from + min * 60_000).toISOString() };
  };
  const one = awakeFacts([night('2026-09-02', 23.5, 7.5, { awakenings: [at('2026-09-02', 27, 12)] })]);
  assert.ok(!one.some((f) => f.label === 'Hora mais comum'), 'uma noite não é padrão');
  const two = awakeFacts([
    night('2026-09-02', 23.5, 7.5, { awakenings: [at('2026-09-02', 27, 12)] }),
    night('2026-09-03', 23.5, 7.5, { awakenings: [at('2026-09-03', 27.3, 40)] }),
  ]);
  assert.equal(two.find((f) => f.label === 'Hora mais comum')!.value, '03:00–04:00 · 2 de 2 noites');
  assert.equal(two.find((f) => f.label === 'Mais longo')!.value, '40 min · 3/09 às 03:18');
  assert.equal(awakeFacts([night('2026-09-02', 23.5, 7.5, { awakenings: null })])[0].value, 'a fonte não reporta');
});

check('buckets: horas médias por estágio só sobre as noites com hipnograma', () => {
  const ps = [
    night('2026-09-01', 23.5, 7.5, { stages: { deep: 1.5, rem: 1.5, core: 4.5 } }),
    night('2026-09-02', 23.5, 7.5, { stages: { deep: 0.5, rem: 1.5, core: 5.5 } }),
    night('2026-09-03', 23.5, 7.5, { stages: { unspecified: 7.5 } }), // sem hipnograma
  ];
  const [b] = bucketPeriods(ps, 'week');
  assert.equal(b.stagedNights, 2);
  assert.equal(b.stagesH['deep'], 1);
  assert.equal(b.stagesH['core'], 5);
  assert.equal(b.stagesH['unspecified'], undefined, 'a noite sem hipnograma não entra na composição');
});

check('stageFacts: medianas por estágio com o n, e "não reporta" sem hipnograma', () => {
  const ps = [
    night('2026-09-01', 23.5, 7.5, { stages: { deep: 1.5, rem: 1, core: 5 } }),
    night('2026-09-02', 23.5, 7.5, { stages: { deep: 2.5, rem: 1, core: 4 } }),
    night('2026-09-03', 23.5, 7.5, { stages: null }),
  ];
  const f = stageFacts(ps);
  assert.equal(f[0].value, '2 de 3');
  assert.equal(f.find((x) => x.label.startsWith('Profundo'))!.value, '2h00');
  assert.equal(stageFacts([night('2026-09-03', 23.5, 7.5, { stages: null })])[0].value, 'a fonte não reporta');
});

console.log(`\n${passed} testes passaram.`);
