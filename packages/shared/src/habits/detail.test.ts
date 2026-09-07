/**
 * Testes de buildHabitDetail/habitYearHeat e do gasto estimado. Puros, sem
 * framework. Rodar com:
 *   cd packages/shared && npx tsx src/habits/detail.test.ts
 *
 * A fixture **não é inventada**: são os 26 dias de Cerveja que estavam em
 * produção em 07/09/2026 (60,0 L, de 23/05 a 06/09), lidos do Postgres e
 * conferidos à mão, período a período — o mesmo portão que o detalhe de
 * Registros pagou. Números redondos escondem erro de janela; 0,5 L num sábado
 * de agosto, não.
 */
import assert from 'node:assert/strict';
import { buildHabitDetail, habitHeatMax, habitYearHeat } from './detail';
import { habitCost } from './cost';
import { fmtMoney, fmtMoneyAuto } from '../format/money';

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

/** Âncora fixa: segunda-feira, 07/09/2026, 10h. */
const NOW = new Date(2026, 8, 7, 10, 0);

const log = (logDate: string, value: number) => ({ logDate, value });

/** Cerveja em produção — fora de ordem de propósito: a função ordena. */
const CERVEJA = [
  log('2026-08-27', 3.5), log('2026-05-23', 1.5), log('2026-05-24', 2),
  log('2026-05-25', 1.5), log('2026-05-28', 3), log('2026-06-05', 3.5),
  log('2026-06-13', 3.5), log('2026-07-04', 2.5), log('2026-07-10', 4),
  log('2026-07-12', 1), log('2026-07-13', 1), log('2026-07-18', 1),
  log('2026-07-24', 2.5), log('2026-07-31', 3.5), log('2026-08-01', 3.5),
  log('2026-08-02', 2.5), log('2026-08-06', 2.5), log('2026-08-07', 3.5),
  log('2026-08-08', 2), log('2026-08-16', 0.5), log('2026-08-22', 3),
  log('2026-08-28', 1), log('2026-08-29', 1.5), log('2026-08-30', 3),
  log('2026-09-05', 2), log('2026-09-06', 1),
];

/** Arredonda para comparar float somado sem depender da ordem da soma. */
const r2 = (n: number) => Math.round(n * 100) / 100;

// ── janelas móveis ──────────────────────────────────────────────────────────

check('7d: soma o que caiu na semana e compara com a anterior', () => {
  const d = buildHabitDetail(CERVEJA, 'semana', { now: NOW });
  assert.equal(d.buckets.length, 7);
  assert.equal(r2(d.total), 3); // 05/09 (2,0) + 06/09 (1,0)
  assert.equal(d.days, 2);
  // Anterior: 27–30/08 = 3,5 + 1 + 1,5 + 3 = 9,0 em 4 dias.
  assert.equal(r2(d.delta!), -6);
  assert.equal(d.daysDelta, -2);
  assert.equal(r2(d.perLoggedDay), 1.5);
});

check('4s: as 4 semanas seg–dom, não os últimos 28 dias', () => {
  const d = buildHabitDetail(CERVEJA, 'mes', { now: NOW });
  assert.equal(d.buckets.length, 4);
  // Janela abre na segunda 17/08 (hoje é segunda: a 4ª semana tem 1 dia).
  assert.equal(r2(d.total), 15);
  assert.equal(d.days, 7);
  assert.equal(r2(d.delta!), -5.5); // anterior: 20,5 em 8 dias
  assert.equal(d.daysDelta, -1);
});

check('12m: 12 barras, e a soma bate com os 60 L de produção', () => {
  const d = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  assert.equal(d.buckets.length, 12);
  assert.equal(d.buckets[0].key, '2025-10');
  assert.equal(d.buckets[11].key, '2026-09');
  assert.equal(r2(d.total), 60);
  assert.equal(d.days, 26);
  assert.equal(r2(d.perLoggedDay), 2.31);
  // Sem nada nos 12 meses anteriores, o delta é o próprio total — informação,
  // não ausência dela.
  assert.equal(r2(d.delta!), 60);
  assert.equal(d.daysDelta, 26);
});

check('12m: agosto é o maior mês, com 11 dias por trás dos 26,5 L', () => {
  const d = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  const ago = d.buckets.find((b) => b.key === '2026-08')!;
  assert.equal(r2(ago.value), 26.5);
  assert.equal(ago.count, 11);
  assert.equal(ago.empty, false);
  const maior = [...d.buckets].sort((a, b) => b.value - a.value)[0];
  assert.equal(maior.key, '2026-08');
  // Meses antes do hábito existir são barra vazia, não buraco no eixo.
  assert.equal(d.buckets[0].value, 0);
  assert.equal(d.buckets[0].empty, true);
});

// ── as leituras que só um hábito quantitativo tem ───────────────────────────

check('o maior dia é 10/07 com 4,0 L — não o dia com mais registros', () => {
  const d = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  assert.deepEqual(d.best, { date: '2026-07-10', value: 4 });
});

check('sexta e sábado carregam 64% do total; terça e quarta, nada', () => {
  const d = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  // seg, ter, qua, qui, sex, sáb, dom
  assert.deepEqual(d.weekdayTotals.map(r2), [2.5, 0, 0, 9, 18, 20.5, 10]);
  const fds = d.weekdayTotals[4] + d.weekdayTotals[5];
  assert.equal(Math.round((fds / d.total) * 100), 64);
});

check('sazonalidade existe em 12m e não existe em 7d/4s', () => {
  const doze = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  assert.equal(doze.monthTotals![4], 8);    // mai
  assert.equal(doze.monthTotals![7], 26.5); // ago
  assert.equal(buildHabitDetail(CERVEJA, 'semana', { now: NOW }).monthTotals, null);
  assert.equal(buildHabitDetail(CERVEJA, 'mes', { now: NOW }).monthTotals, null);
});

check('o histórico não se move com o período', () => {
  for (const p of ['semana', 'mes', 'meses12', 'ano', 'sempre'] as const) {
    const d = buildHabitDetail(CERVEJA, p, { now: NOW });
    assert.equal(d.firstDate, '2026-05-23');
    assert.equal(d.lastDate, '2026-09-06');
    assert.equal(d.daysSinceLast, 1); // ontem
    assert.equal(r2(d.allTimeTotal), 60);
  }
});

// ── bordas ──────────────────────────────────────────────────────────────────

check('dia zerado não é dia com registro', () => {
  // `habit_log_add` deixa linha com 0 quando o usuário incrementa e desfaz.
  const d = buildHabitDetail([...CERVEJA, log('2026-09-04', 0)], 'meses12', { now: NOW });
  assert.equal(d.days, 26);
  assert.equal(r2(d.total), 60);
  assert.equal(d.lastDate, '2026-09-06');
});

check('hábito sem nenhum registro não quebra nem inventa média', () => {
  const d = buildHabitDetail([], 'meses12', { now: NOW });
  assert.equal(d.total, 0);
  assert.equal(d.days, 0);
  assert.equal(d.perLoggedDay, 0);
  assert.equal(d.best, null);
  assert.equal(d.firstDate, null);
  assert.equal(d.daysSinceLast, null);
  assert.equal(d.canPrevYear, false);
  assert.equal(d.buckets.length, 12);
});

check('1º ano: não há ano anterior, então não há delta', () => {
  const d = buildHabitDetail(CERVEJA, 'ano', { now: NOW });
  assert.equal(d.buckets.length, 9); // jan–set do ano corrente
  assert.equal(d.delta, null);
  assert.equal(d.daysDelta, null);
  assert.equal(d.canPrevYear, false);
  assert.equal(d.canNextYear, false);
});

check("'sempre' abre um balde por ano e não compara", () => {
  const d = buildHabitDetail(CERVEJA, 'sempre', { now: NOW });
  assert.deepEqual(d.buckets.map((b) => b.key), ['2026']);
  assert.equal(r2(d.buckets[0].value), 60);
  assert.equal(d.delta, null);
});

check('ano navegado para trás fica vazio, mas com o eixo inteiro', () => {
  const d = buildHabitDetail(CERVEJA, 'ano', { now: NOW, yearOffset: -1 });
  assert.equal(d.buckets.length, 12); // ano fechado: jan–dez
  assert.equal(d.total, 0);
  assert.equal(d.canNextYear, true);
  // Ainda mostra o histórico real, que é de 2026.
  assert.equal(d.firstDate, '2026-05-23');
});

check('offset positivo é grampeado — não existe ano futuro', () => {
  const a = buildHabitDetail(CERVEJA, 'ano', { now: NOW, yearOffset: 3 });
  const b = buildHabitDetail(CERVEJA, 'ano', { now: NOW });
  assert.deepEqual(a.buckets.map((x) => x.key), b.buckets.map((x) => x.key));
});

check('a mesma data duas vezes soma, em vez de uma sumir', () => {
  const d = buildHabitDetail([log('2026-09-06', 1), log('2026-09-06', 2)], 'semana', { now: NOW });
  assert.equal(d.total, 3);
  assert.equal(d.days, 1);
});

// ── heatmap anual ───────────────────────────────────────────────────────────

check('a grade do ano carrega quantidade, e a escala sai dela', () => {
  const weeks = habitYearHeat(CERVEJA, 2026);
  assert.ok(weeks.length >= 53);
  const dias = weeks.flat().filter((c) => c.inYear && c.value > 0);
  assert.equal(dias.length, 26);
  assert.equal(habitHeatMax(weeks), 4); // 10/07
  // 2025 não tem nada: a grade existe, a escala é zero (a tela não divide).
  assert.equal(habitHeatMax(habitYearHeat(CERVEJA, 2025)), 0);
});

// ── gasto estimado ──────────────────────────────────────────────────────────

check('11 €/L sobre os 60 L gravados dá €660, e o período é proporcional', () => {
  const doze = buildHabitDetail(CERVEJA, 'meses12', { now: NOW });
  assert.equal(habitCost(11, doze.allTimeTotal), 660);
  assert.equal(habitCost(11, doze.buckets.find((b) => b.key === '2026-08')!.value), 291.5);
  assert.equal(habitCost(11, buildHabitDetail(CERVEJA, 'semana', { now: NOW }).total), 33);
});

check('sem preço não há gasto — e zero não vira €0', () => {
  assert.equal(habitCost(undefined, 60), null);
  assert.equal(habitCost(null, 60), null);
  assert.equal(habitCost(0, 60), null);
  assert.equal(habitCost(11, 0), null);
});

check('o símbolo é o euro, e o centavo só aparece quando é a informação', () => {
  assert.equal(fmtMoney(291.5), '€292');
  assert.equal(fmtMoney(11, 2), '€11,00');
  assert.equal(fmtMoney(-8.5, 2), '−€8,50');
  assert.equal(fmtMoneyAuto(660), '€660');
  assert.equal(fmtMoneyAuto(0.9), '€0,90');
  assert.equal(fmtMoneyAuto(1234.5), '€1.235');
});

console.log(`\n${passed} testes passaram.`);
