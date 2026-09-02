/**
 * Testes de buildRegistroDetail/yearHeatmap — puros, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/registros/detail.test.ts
 *
 * Cobrem a matriz de edge cases do spec (janela vazia, histórico curto,
 * sazonalidade ausente, delta null, ano navegado) mais um caso plurianual
 * conferido à mão, data a data — é o portão de CAP-6: "conferem com cálculo
 * manual sobre registro_logs num caso plurianual".
 */
import assert from 'node:assert/strict';
import { buildRegistroDetail, yearHeatmap } from './detail';

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    // Sem isto o nome do teste que falhou some — só o stack do assert sai.
    console.log(`  not ok ${name}`);
    throw e;
  }
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Âncora fixa: quinta-feira, 20/08/2026, 14h30 local. */
const NOW = new Date(2026, 7, 20, 14, 30);

/**
 * "Pizza" plurianual, conferida à mão. 15 marcas: 3 em 2024, 5 em 2025,
 * 7 em 2026. Fora de ordem de propósito — a função deve ordenar.
 */
const PIZZA = [
  '2024-05-10', '2024-08-15', '2024-12-31',
  '2025-01-01', '2025-03-10', '2025-07-04', '2025-11-20', '2025-09-05',
  '2026-01-15', '2026-02-14', '2026-03-14', '2026-05-01',
  '2026-08-01', '2026-08-10', '2026-08-18',
];

// ── caso feliz: 12m sobre histórico plurianual ──────────────────────────────

check('12m: 12 barras mensais, de set/25 a ago/26', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  assert.equal(d.buckets.length, 12);
  assert.equal(d.buckets[0].key, '2025-09');
  assert.equal(d.buckets[0].label, 'set');
  assert.equal(d.buckets[11].key, '2026-08');
  assert.equal(d.buckets[11].label, 'ago');
  const byKey = Object.fromEntries(d.buckets.map((b) => [b.key, b.value]));
  assert.equal(byKey['2025-09'], 1);
  assert.equal(byKey['2025-10'], 0);
  assert.equal(byKey['2025-11'], 1);
  assert.equal(byKey['2026-08'], 3);
  assert.ok(d.buckets.every((b) => Number.isInteger(b.value)));
  assert.ok(d.buckets.every((b) => b.empty === (b.value === 0)));
});

check('12m: total 9 e delta absoluto +5 vs os 12 meses anteriores', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  assert.equal(d.total, 9);
  // set/24–ago/25 tem 4 marcas (31/12, 01/01, 10/03, 04/07) → 9 − 4 = +5.
  assert.equal(d.delta, 5);
});

check('12m: última vez, primeira vez e total histórico independem da janela', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  assert.equal(d.lastDate, '2026-08-18');
  assert.equal(d.daysSinceLast, 2);
  assert.equal(d.firstDate, '2024-05-10');
  assert.equal(d.allTimeTotal, 15);
});

check('12m: frequência divide por meses decorridos (11 + fração de agosto)', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  assert.equal(d.freq.per, 'mes');
  // 11 meses fechados + 20 dos 31 dias de agosto — dividir por 12 cheios
  // subestimaria enquanto o mês corrente está em curso.
  assert.equal(d.freq.value, 9 / (11 + 20 / 31));
});

check('12m: intervalo médio e maior jejum conferidos à mão', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  // gaps na janela: 76, 56, 30, 28, 48, 92, 9, 8 → soma 347 ÷ 8.
  assert.equal(d.avgGapDays, 347 / 8);
  assert.equal(d.maxGapDays, 92);
});

check('12m: dia da semana segunda-first e sazonalidade por mês civil', () => {
  const d = buildRegistroDetail(PIZZA, 'meses12', { now: NOW });
  // seg=1 (10/08), ter=1 (18/08), qui=2 (20/11, 15/01), sex=2 (05/09, 01/05),
  // sáb=3 (14/02, 14/03, 01/08).
  assert.deepEqual(d.weekdayCounts, [1, 1, 0, 2, 2, 3, 0]);
  assert.deepEqual(d.monthCounts, [1, 1, 1, 0, 1, 0, 0, 3, 1, 0, 1, 0]);
});

// ── períodos curtos: 7d e 4s ────────────────────────────────────────────────

check('7d: 7 barras diárias; histórico curto na janela ⇒ intervalos null', () => {
  const d = buildRegistroDetail(PIZZA, 'semana', { now: NOW });
  assert.equal(d.buckets.length, 7);
  assert.equal(d.buckets[0].key, '2026-08-14');
  assert.equal(d.buckets[0].label, 'sex');
  assert.equal(d.buckets[6].key, '2026-08-20');
  assert.equal(d.total, 1); // só 18/08 cai em 14–20/08
  assert.equal(d.delta, 0); // 07–13/08 também tem 1 (10/08)
  // <2 marcas na janela: métricas de intervalo mostram "—", não somem.
  assert.equal(d.avgGapDays, null);
  assert.equal(d.maxGapDays, null);
});

check('7d e 4s: sem seção de sazonalidade', () => {
  assert.equal(buildRegistroDetail(PIZZA, 'semana', { now: NOW }).monthCounts, null);
  assert.equal(buildRegistroDetail(PIZZA, 'mes', { now: NOW }).monthCounts, null);
});

check('4s: 4 semanas seg–dom, rótulo na segunda-feira', () => {
  const d = buildRegistroDetail(PIZZA, 'mes', { now: NOW });
  assert.deepEqual(
    d.buckets.map((b) => b.key),
    ['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17'],
  );
  assert.deepEqual(d.buckets.map((b) => b.label), ['27/07', '03/08', '10/08', '17/08']);
  assert.deepEqual(d.buckets.map((b) => b.value), [1, 0, 1, 1]); // 01, —, 10, 18/08
  assert.equal(d.total, 3);
  assert.equal(d.delta, 3); // 29/06–26/07 vazio ⇒ +3, não null
  assert.equal(d.freq.per, 'semana');
  // A janela abriu na segunda 27/07 e hoje é quinta 20/08: 25 dias decorridos
  // ÷ 7, não 4 semanas cheias — a corrente ainda está em curso.
  assert.equal(d.freq.value, 3 / (25 / 7));
});

// ── janela vazia ────────────────────────────────────────────────────────────

check('janela vazia: barras zeradas, total 0, delta ainda calcula', () => {
  const d = buildRegistroDetail(['2026-08-10', '2026-08-12'], 'semana', { now: NOW });
  assert.equal(d.total, 0);
  assert.ok(d.buckets.every((b) => b.value === 0 && b.empty));
  assert.equal(d.delta, -2); // as duas marcas caem nos 7 dias anteriores
  assert.equal(d.lastDate, '2026-08-12');
  assert.equal(d.daysSinceLast, 8);
});

// ── ano: navegação e delta null no 1º ano ───────────────────────────────────

check('ano corrente: só meses decorridos, delta vs o ano anterior', () => {
  const d = buildRegistroDetail(PIZZA, 'ano', { now: NOW });
  assert.equal(d.buckets.length, 8); // jan–ago de 2026
  assert.equal(d.buckets[0].key, '2026-01');
  assert.equal(d.buckets[7].key, '2026-08');
  assert.equal(d.total, 7);
  assert.equal(d.delta, 2); // 7 em 2026 vs 5 em 2025
  assert.equal(d.freq.value, 7 / 8); // ÷ meses decorridos
  assert.equal(d.canPrevYear, true);
  assert.equal(d.canNextYear, false);
});

check('ano navegado (−1): 12 barras do ano fechado', () => {
  const d = buildRegistroDetail(PIZZA, 'ano', { now: NOW, yearOffset: -1 });
  assert.equal(d.buckets.length, 12);
  assert.equal(d.buckets[0].key, '2025-01');
  assert.equal(d.buckets[11].key, '2025-12');
  assert.equal(d.total, 5);
  assert.equal(d.delta, 2); // 5 em 2025 vs 3 em 2024
  assert.equal(d.freq.value, 5 / 12);
  assert.equal(d.canPrevYear, true);
  assert.equal(d.canNextYear, true);
});

check('1º ano com marca: delta null e sem ano anterior para visitar', () => {
  const d = buildRegistroDetail(PIZZA, 'ano', { now: NOW, yearOffset: -2 });
  assert.equal(d.total, 3);
  assert.equal(d.delta, null); // não renderiza comparação
  assert.equal(d.canPrevYear, false);
});

// ── sempre ──────────────────────────────────────────────────────────────────

check('sempre: um bucket por ano, do primeiro ao corrente, delta null', () => {
  const d = buildRegistroDetail(PIZZA, 'sempre', { now: NOW });
  assert.deepEqual(d.buckets.map((b) => b.key), ['2024', '2025', '2026']);
  assert.deepEqual(d.buckets.map((b) => b.value), [3, 5, 7]);
  assert.equal(d.total, 15);
  assert.equal(d.delta, null); // não existe um antes de todo o histórico
  assert.equal(d.freq.per, 'mes');
  assert.equal(d.freq.value, 15 / 28); // mai/24–ago/26 = 28 meses
  assert.ok(d.monthCounts !== null);
});

check('sempre: ano vazio no MEIO vira bucket zerado, não buraco', () => {
  const d = buildRegistroDetail(['2024-06-01', '2026-02-01'], 'sempre', { now: NOW });
  assert.deepEqual(d.buckets.map((b) => b.key), ['2024', '2025', '2026']);
  assert.deepEqual(d.buckets.map((b) => b.value), [1, 0, 1]);
  assert.equal(d.buckets[1].empty, true);
});

check('sem nenhuma marca: tudo estável, nada explode', () => {
  const d = buildRegistroDetail([], 'sempre', { now: NOW });
  assert.deepEqual(d.buckets.map((b) => b.key), ['2026']);
  assert.equal(d.total, 0);
  assert.equal(d.delta, null);
  assert.equal(d.lastDate, null);
  assert.equal(d.daysSinceLast, null);
  assert.equal(d.freq.value, 0);
  assert.equal(d.avgGapDays, null);
  assert.equal(d.firstDate, null);
  assert.equal(d.allTimeTotal, 0);
  assert.equal(d.canPrevYear, false);
});

// ── higiene de entrada ──────────────────────────────────────────────────────

check('entrada desordenada e com duplicata é ordenada e deduplicada', () => {
  const d = buildRegistroDetail(
    ['2026-08-18', '2026-08-01', '2026-08-18', '2026-08-10'],
    'meses12',
    { now: NOW },
  );
  assert.equal(d.allTimeTotal, 3);
  assert.equal(d.total, 3);
  assert.equal(d.maxGapDays, 9); // 01→10; a duplicata não vira gap 0
});

check('marca de hoje: última vez há 0 dias', () => {
  const d = buildRegistroDetail(['2026-08-20'], 'semana', { now: NOW });
  assert.equal(d.daysSinceLast, 0);
});

check('marca "de amanhã" (fuso): daysSinceLast grampeia em 0, não −1', () => {
  // Marcou hoje no Japão, abriu o app na Bélgica: a data existe de verdade.
  const d = buildRegistroDetail(['2026-08-21'], 'semana', { now: NOW });
  assert.equal(d.daysSinceLast, 0);
});

// ── heatmap anual ───────────────────────────────────────────────────────────

check('heatmap 2026: 53 semanas segunda-first, pontas fora do ano', () => {
  const weeks = yearHeatmap(['2026-01-01', '2026-08-18'], 2026);
  assert.equal(weeks.length, 53);
  assert.ok(weeks.every((w) => w.length === 7));
  // 1º/jan/2026 é quinta: a 1ª coluna começa na segunda 29/12/2025.
  assert.equal(weeks[0][0].date, '2025-12-29');
  assert.equal(weeks[0][0].inYear, false);
  assert.equal(weeks[0][3].date, '2026-01-01');
  assert.equal(weeks[0][3].inYear, true);
  assert.equal(weeks[0][3].marked, true);
  // última coluna: 28/12/2026 a 03/01/2027.
  assert.equal(weeks[52][0].date, '2026-12-28');
  assert.equal(weeks[52][3].date, '2026-12-31');
  assert.equal(weeks[52][3].inYear, true);
  assert.equal(weeks[52][6].date, '2027-01-03');
  assert.equal(weeks[52][6].inYear, false);
});

check('heatmap 2012: ano bissexto que abre num domingo tem 54 colunas', () => {
  // O caso máximo do "53–54" prometido no doc: 1º/jan/2012 foi domingo (a 1ª
  // coluna começa em 26/12/2011) e 31/12/2012, segunda — coluna só dele.
  const weeks = yearHeatmap([], 2012);
  assert.equal(weeks.length, 54);
  assert.equal(weeks[0][0].date, '2011-12-26');
  assert.equal(weeks[0][0].inYear, false);
  assert.equal(weeks[53][0].date, '2012-12-31');
  assert.equal(weeks[53][0].inYear, true);
  assert.equal(weeks[53][1].date, '2013-01-01');
  assert.equal(weeks[53][1].inYear, false);
});

check('heatmap: marca cai na célula certa (terça 18/08 na coluna de 17/08)', () => {
  const weeks = yearHeatmap(['2026-08-18'], 2026);
  assert.equal(weeks[33][1].date, '2026-08-18');
  assert.equal(weeks[33][1].marked, true);
  assert.equal(weeks[33][0].marked, false);
  assert.equal(weeks.flat().filter((c) => c.marked).length, 1);
});

console.log(`\n${passed} testes ok`);
