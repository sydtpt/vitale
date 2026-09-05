/**
 * Série intradiária — o balde por minuto e a reexpansão em instantes.
 *
 * Spec: docs/specs/fc-serie/spec.md
 *
 * Os instantes são construídos com `new Date(ano, mês, dia, h, min, s)` — hora
 * LOCAL da máquina que roda o teste — para que o resultado não dependa do fuso:
 * é a mesma convenção do aparelho, onde `health_daily.day` é o dia local.
 */

import assert from 'node:assert/strict';
import {
  MINUTES_PER_DAY,
  SERIES_METRICS,
  bucketSeriesByMinute,
  expandSeriesDay,
  type SeriesSample,
} from './series';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const local = (y: number, mo: number, d: number, h: number, mi: number, s = 0): string =>
  new Date(y, mo - 1, d, h, mi, s).toISOString();

const at = (iso: string, value: number): SeriesSample => ({ start: iso, value });
const OPTS = { userId: 'u1', metric: 'fc' };

check('constantes: 1440 minutos e a FC como única métrica com série', () => {
  assert.equal(MINUTES_PER_DAY, 1440);
  assert.ok(SERIES_METRICS.has('fc'));
  assert.equal(SERIES_METRICS.size, 1);
});

check('vazio → nenhuma linha; amostra inválida é descartada, não lançada', () => {
  assert.deepEqual(bucketSeriesByMinute([], OPTS), []);
  assert.deepEqual(
    bucketSeriesByMinute([at('não é data', 60), at(local(2026, 9, 4, 10, 2), NaN)], OPTS),
    [],
  );
});

check('mesmo minuto vira média inteira; minutos distintos ficam separados e crescentes', () => {
  const rows = bucketSeriesByMinute(
    [
      at(local(2026, 9, 4, 10, 2, 5), 60),
      at(local(2026, 9, 4, 10, 2, 50), 63), // mesmo minuto → média 61,5 → 62
      at(local(2026, 9, 4, 8, 0), 48),
      at(local(2026, 9, 4, 23, 59), 52),
    ],
    OPTS,
  );
  assert.equal(rows.length, 1);
  const [r] = rows;
  assert.equal(r.userId, 'u1');
  assert.equal(r.metric, 'fc');
  assert.equal(r.day, '2026-09-04');
  assert.deepEqual(r.minutes, [8 * 60, 10 * 60 + 2, 23 * 60 + 59]);
  assert.deepEqual(r.readings, [48, 62, 52]);
  assert.equal(r.minutes.length, r.readings.length);
});

check('dias diferentes viram linhas diferentes, ordenadas por dia, mesmo com entrada embaralhada', () => {
  const rows = bucketSeriesByMinute(
    [at(local(2026, 9, 5, 0, 0), 50), at(local(2026, 9, 3, 12, 0), 70), at(local(2026, 9, 4, 6, 30), 55)],
    OPTS,
  );
  assert.deepEqual(
    rows.map((r) => r.day),
    ['2026-09-03', '2026-09-04', '2026-09-05'],
  );
  assert.deepEqual(rows[2].minutes, [0]); // meia-noite é minuto 0 do dia, não 1440 do anterior
});

check('a fronteira do dia é a meia-noite LOCAL', () => {
  const rows = bucketSeriesByMinute(
    [at(local(2026, 9, 4, 23, 59, 59), 50), at(local(2026, 9, 5, 0, 0, 0), 51)],
    OPTS,
  );
  assert.deepEqual(rows.map((r) => r.day), ['2026-09-04', '2026-09-05']);
});

check('tzOffset é o deslocamento à meia-noite local do dia', () => {
  const [r] = bucketSeriesByMinute([at(local(2026, 9, 4, 15, 0), 60)], OPTS);
  assert.equal(r.tzOffset, -new Date(2026, 8, 4, 0, 0, 0).getTimezoneOffset());
  assert.ok(r.tzOffset >= -840 && r.tzOffset <= 840);
});

check('decimals preserva casas quando pedido', () => {
  const [r] = bucketSeriesByMinute(
    [at(local(2026, 9, 4, 10, 0, 0), 97.2), at(local(2026, 9, 4, 10, 0, 30), 97.7)],
    { ...OPTS, metric: 'spo2', decimals: 1 },
  );
  assert.deepEqual(r.readings, [97.5]);
});

check('expandSeriesDay devolve o instante UTC de cada minuto — ida e volta exata', () => {
  const origin = new Date(2026, 8, 4, 10, 2, 0); // 10:02 local, segundos zerados
  const [r] = bucketSeriesByMinute([at(origin.toISOString(), 60)], OPTS);
  const [p] = expandSeriesDay(r);
  assert.equal(p.atMs, origin.getTime());
  assert.equal(p.value, 60);
});

check('expandSeriesDay respeita o tzOffset gravado, não o da máquina', () => {
  // Dia gravado em UTC+2: minuto 600 (10:00) local = 08:00Z.
  const points = expandSeriesDay({
    userId: 'u1',
    day: '2026-09-04',
    metric: 'fc',
    tzOffset: 120,
    minutes: [600, 601],
    readings: [55, 56],
  });
  assert.equal(points[0].atMs, Date.UTC(2026, 8, 4, 8, 0));
  assert.equal(points[1].atMs, Date.UTC(2026, 8, 4, 8, 1));
  assert.deepEqual(points.map((p) => p.value), [55, 56]);
});

console.log(`series: ${passed} checks ok`);
