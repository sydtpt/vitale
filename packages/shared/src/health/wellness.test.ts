/**
 * Bem-estar do intervals.icu — normalização, janela, query e precedência.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-vfc-intervals.md
 *
 * A edge function que consome isto não é typechecada nem testada por comando
 * nenhum do CI, então tudo o que decide o que vai para o banco foi trazido para
 * cá — e é aqui que essas decisões são cobradas.
 */

import assert from 'node:assert/strict';
import {
  WELLNESS_HRV_MAX_MS,
  WELLNESS_HRV_MIN_MS,
  WELLNESS_INITIAL_DAYS,
  WELLNESS_SOURCE,
  WELLNESS_WINDOW_DAYS,
  normalizeIntervalsWellness,
  planWellnessRows,
  wellnessQuery,
  wellnessWindow,
} from './wellness';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

console.log('wellness');

// ─── Normalização ────────────────────────────────────────────────────────────

check('registro Garmin: `hrv` vira RMSSD', () => {
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: 52 }]), [
    { day: '2026-09-03', value: 52, kind: 'rmssd' },
  ]);
});

check('com SDNN: `hrvSDNN` vence o `hrv`', () => {
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: 52, hrvSDNN: 61 }]), [
    { day: '2026-09-03', value: 61, kind: 'sdnn' },
  ]);
});

check('inválidos são descartados sem lançar', () => {
  const out = normalizeIntervalsWellness([
    null,
    42,
    'x',
    { id: '2026-09-01' }, // sem VFC
    { id: '2026-09-01', hrv: null },
    { id: '2026-09-01', hrv: 0 },
    { id: '2026-09-01', hrv: -5 },
    { id: '2026-09-01', hrv: Number.NaN },
    { id: 'x', hrv: 50 }, // id fora do formato
    { hrv: 50 }, // sem id
  ]);
  assert.deepEqual(out, []);
});

check('data que casa com o formato mas não existe no calendário é descartada', () => {
  // Passariam por um regex de formato e explodiriam no Postgres (22008),
  // abortando o run inteiro e levando junto os dias válidos do lote.
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-13-45', hrv: 50 }]), []);
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-02-30', hrv: 50 }]), []);
  assert.equal(normalizeIntervalsWellness([{ id: '2028-02-29', hrv: 50 }]).length, 1, 'bissexto vale');
});

check('valor fora da faixa plausível é descartado', () => {
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: 5000 }]), []);
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: 1 }]), []);
  // Um absurdo gravado contamina a baseline de 7 dias, ou seja, a prontidão de
  // uma semana. As bordas entram.
  assert.equal(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: WELLNESS_HRV_MIN_MS }]).length, 1);
  assert.equal(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: WELLNESS_HRV_MAX_MS }]).length, 1);
  // SDNN implausível cai para o `hrv`, em vez de derrubar o dia inteiro.
  assert.deepEqual(normalizeIntervalsWellness([{ id: '2026-09-03', hrv: 52, hrvSDNN: 9999 }]), [
    { day: '2026-09-03', value: 52, kind: 'rmssd' },
  ]);
});

check('entrada que não é lista → vazio', () => {
  assert.deepEqual(normalizeIntervalsWellness(null), []);
  assert.deepEqual(normalizeIntervalsWellness({ error: 'nope' }), []);
  assert.deepEqual(normalizeIntervalsWellness(undefined), []);
});

check('dia repetido: o último válido vence; saída ordenada por dia', () => {
  const out = normalizeIntervalsWellness([
    { id: '2026-09-03', hrv: 40 },
    { id: '2026-09-01', hrv: 44 },
    { id: '2026-09-03', hrv: 55 },
  ]);
  assert.deepEqual(out.map((h) => [h.day, h.value]), [
    ['2026-09-01', 44],
    ['2026-09-03', 55],
  ]);
});

// ─── Janela e query ──────────────────────────────────────────────────────────

const NOW = new Date(2026, 8, 4, 10, 0, 0); // 04/09/2026

check('janela de run: 14 dias, `newest` é amanhã, `today` é hoje', () => {
  const w = wellnessWindow(true, NOW);
  assert.equal(w.days, WELLNESS_WINDOW_DAYS);
  assert.deepEqual([w.oldest, w.newest, w.today], ['2026-08-21', '2026-09-05', '2026-09-04']);
});

check('primeira vez: 120 dias', () => {
  const w = wellnessWindow(false, NOW);
  assert.equal(w.days, WELLNESS_INITIAL_DAYS);
  assert.deepEqual([w.oldest, w.newest], ['2026-05-07', '2026-09-05']);
});

check('a janela atravessa a virada de ano sem quebrar o formato', () => {
  const w = wellnessWindow(true, new Date(2027, 0, 3, 8, 0, 0));
  assert.deepEqual([w.oldest, w.newest], ['2026-12-20', '2027-01-04']);
});

check('a query leva a janela na ordem certa', () => {
  // Trocar os dois parâmetros devolveria lista vazia sem erro nenhum, e a
  // feature ficaria no ar sem fazer nada. É por isso que a query é testada.
  assert.equal(wellnessQuery(wellnessWindow(true, NOW)), 'oldest=2026-08-21&newest=2026-09-05');
  const q = wellnessQuery(wellnessWindow(false, NOW));
  assert.ok(q.startsWith('oldest=2026-05-07&'), q);
  assert.ok(q.endsWith('&newest=2026-09-05'), q);
});

// ─── Precedência, idempotência e futuro ──────────────────────────────────────

const hrv = (day: string, value = 50) => ({ day, value, kind: 'rmssd' as const });
const appleRow = (day: string, value = 60) => ({ day, value, extra: null });
const intervalsRow = (day: string, value = 50) => ({
  day,
  value,
  extra: { source: WELLNESS_SOURCE, kind: 'rmssd' },
});

check('dia sem linha nenhuma é gravado', () => {
  const plan = planWellnessRows([hrv('2026-09-03')], []);
  assert.deepEqual(plan.write.map((h) => h.day), ['2026-09-03']);
  assert.deepEqual([plan.skipped, plan.unchanged, plan.future], [0, 0, 0]);
});

check('dia medido pelo Apple Health é pulado — `extra` nulo, vazio ou de outra fonte', () => {
  // A linha do Apple não tem `source` algum: é a EXISTÊNCIA dela que manda.
  // Tratar "sem source" como "sem linha" faria o Garmin sobrescrever o relógio.
  for (const row of [
    appleRow('2026-09-03'),
    { day: '2026-09-03', value: 60, extra: {} },
    { day: '2026-09-03', value: 60, extra: { source: 'healthkit' } },
    { day: '2026-09-03', value: 60 },
  ]) {
    const plan = planWellnessRows([hrv('2026-09-03')], [row]);
    assert.deepEqual(plan.write, [], JSON.stringify(row));
    assert.equal(plan.skipped, 1, JSON.stringify(row));
  }
});

check('dia desta fonte com valor diferente é atualizado', () => {
  const plan = planWellnessRows([hrv('2026-09-03', 61)], [intervalsRow('2026-09-03', 50)]);
  assert.deepEqual(plan.write, [{ day: '2026-09-03', value: 61, kind: 'rmssd' }]);
  assert.deepEqual([plan.skipped, plan.unchanged], [0, 0]);
});

check('dia desta fonte com o mesmo valor não volta ao banco', () => {
  // O run roda a cada 15 min sobre 14 dias: sem isto seriam ~1300 atualizações
  // inúteis por dia, cada uma disparando o gatilho de `updated_at`.
  const plan = planWellnessRows([hrv('2026-09-03', 50)], [intervalsRow('2026-09-03', 50)]);
  assert.deepEqual(plan.write, []);
  assert.equal(plan.unchanged, 1);
  // O PostgREST devolve `numeric` como string — comparar sem converter faria
  // toda linha parecer diferente e o passo nunca seria idempotente.
  const comoTexto = planWellnessRows([hrv('2026-09-03', 50)], [{ ...intervalsRow('2026-09-03'), value: '50' }]);
  assert.deepEqual(comoTexto.write, []);
  assert.equal(comoTexto.unchanged, 1);
});

check('dia no futuro é descartado', () => {
  // A janela pede até amanhã por causa do fuso do atleta; gravar isso faria o
  // consumidor ler amanhã como "a VFC de hoje".
  const plan = planWellnessRows([hrv('2026-09-04'), hrv('2026-09-05')], [], '2026-09-04');
  assert.deepEqual(plan.write.map((h) => h.day), ['2026-09-04']);
  assert.equal(plan.future, 1);
});

check('lote misto: grava o que é seu, pula o do relógio, ignora o repetido', () => {
  const plan = planWellnessRows(
    [hrv('2026-09-01', 48), hrv('2026-09-02', 51), hrv('2026-09-03', 50), hrv('2026-09-04', 47)],
    [appleRow('2026-09-02'), intervalsRow('2026-09-03', 50)],
    '2026-09-04',
  );
  assert.deepEqual(plan.write.map((h) => h.day), ['2026-09-01', '2026-09-04']);
  assert.deepEqual([plan.skipped, plan.unchanged, plan.future], [1, 1, 0]);
});

check('lista vazia não gera escrita', () => {
  assert.deepEqual(planWellnessRows([], []), { write: [], skipped: 0, unchanged: 0, future: 0 });
});

console.log(`\n${passed} checks passed`);
