/**
 * Curva de forma.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-curva-de-forma-shared.md
 *
 * Duas coisas aqui mudam **todo** o resultado sem quebrar nada visivelmente, e
 * por isso ganham teste próprio: o **alpha** (`1 - e^(-1/n)`, e não `2/(n+1)`,
 * que reagiria em metade do tempo) e os **pesos de zona** (que crescem no topo e
 * passam de 1, ao contrário dos da OMS). O resto cobre linha por linha a matriz
 * de casos do spec, mais as guardas de entrada que a revisão pediu.
 */

import assert from 'node:assert/strict';
import {
  FORM_ZONE_WEIGHTS,
  FORM_BASE_DAYS,
  FORM_STALE_AFTER_DAYS,
  FORM_WEEKLY_MINUTES,
  ewmaAlpha,
  activityLoad,
  buildFormCurve,
} from './form-curve';
import { activityWeight, HR_ZONE_WEIGHTS } from '../health/who-activity';
import { HR_ZONES } from '../health/hr-zones';
import { localDateStr } from '../date/local';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

// Quarta-feira 03/06/2026, meio-dia.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

/** `Date` às 08:00 locais de `n` dias atrás (n = 0 é hoje; negativo é futuro). */
function dayAgo(n: number): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 8, 0, 0);
}

let seq = 0;
function act(partial: Partial<Activity> & { startAt: string }): Activity {
  seq += 1;
  return {
    id: `a${seq}`,
    userId: 'u1',
    activityId: 37, // Corrida
    calories: 100,
    durationS: 1800,
    endAt: partial.startAt,
    hasRoute: false,
    ...partial,
  };
}

/** Uma corrida de `durationS` no dia `n` dias atrás. */
function run(n: number, durationS = 1800, hrZones?: Record<string, number>): Activity {
  const d = dayAgo(n);
  return act({
    startAt: `${localDateStr(d)}T08:00:00`,
    durationS,
    ...(hrZones ? { hrZones } : {}),
  });
}

/** Uma corrida por dia, de `from` dias atrás até `to` dias atrás (inclusive). */
function daily(from: number, to: number, durationS: number): Activity[] {
  const out: Activity[] = [];
  for (let n = from; n >= to; n--) out.push(run(n, durationS));
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Carga diária de uma corrida sem zonas: duração × estimativa do tipo.
const RUN_WEIGHT = activityWeight(37);

// ─── Os pesos ────────────────────────────────────────────────────────────────

check('os pesos de zona crescem monotonicamente e passam de 1 no topo', () => {
  const w = HR_ZONES.map((z) => FORM_ZONE_WEIGHTS[z.key]);
  assert.deepEqual(w, [0.2, 0.5, 1, 2, 3.5]);
  for (let i = 1; i < w.length; i++) {
    assert.ok(w[i] > w[i - 1], `z${i + 1} precisa custar mais que z${i}`);
  }
  assert.equal(w[2], 1, 'z3 é a âncora: 1 s de aeróbico = 1 s de carga');
  assert.ok(w[4] > w[3], 'z5 custa mais que z4 — é aí que este modelo difere da OMS');
});

check('contraste com a OMS — lá z4 = z5 e nada passa de 1; aqui o topo separa', () => {
  assert.equal(HR_ZONE_WEIGHTS.z4, HR_ZONE_WEIGHTS.z5, 'para a OMS as duas são "vigoroso"');
  assert.ok(Math.max(...Object.values(HR_ZONE_WEIGHTS)) <= 1, 'a OMS tem teto na duração');
  assert.ok(FORM_ZONE_WEIGHTS.z5 > FORM_ZONE_WEIGHTS.z4);
  assert.ok(FORM_ZONE_WEIGHTS.z5 > 1, 'aqui uma hora pode custar mais que uma hora');
});

// ─── O alpha ─────────────────────────────────────────────────────────────────

check('alpha = 1 - e^(-1/n), não 2/(n+1)', () => {
  assert.ok(Math.abs(ewmaAlpha(42) - (1 - Math.exp(-1 / 42))) < 1e-12);
  assert.ok(Math.abs(ewmaAlpha(42) - 0.023529) < 1e-5);
  assert.ok(Math.abs(ewmaAlpha(7) - 0.133128) < 1e-5);
  // A convenção financeira reagiria no dobro da velocidade.
  assert.ok(ewmaAlpha(42) < 2 / 43, 'o alpha da literatura é metade do 2/(n+1)');
  assert.equal(ewmaAlpha(0), 1, 'janela degenerada não divide por zero');
  assert.ok(!Number.isNaN(ewmaAlpha(-7)) && Number.isFinite(ewmaAlpha(-7)));
  assert.ok(!Number.isNaN(ewmaAlpha(NaN)) && Number.isFinite(ewmaAlpha(NaN)));
});

check('série constante converge para o valor da série em min/semana, e o saldo tende a zero', () => {
  const load = 3600 * RUN_WEIGHT;
  const r = buildFormCurve(daily(399, 0, 3600), {}, NOW);
  const target = load * FORM_WEEKLY_MINUTES;
  assert.ok(
    Math.abs(r.base - target) / target < 1e-3,
    `base ${r.base} deveria convergir para ${target}`,
  );
  assert.ok(Math.abs(r.fatigue - target) / target < 1e-3, 'cansaço converge para o mesmo valor');
  assert.ok(Math.abs(r.form) / target < 1e-3, `saldo ${r.form} deveria tender a zero`);
  assert.equal(r.shortWindow, false);
  assert.equal(r.trusted, true);
  // O típico é a régua do número de hoje: numa série constante, ele é o número.
  assert.ok(Math.abs(r.typical.base - target) / target < 1e-2);
});

check('bloco duro seguido de descanso — o saldo cruza de negativo para positivo', () => {
  const acts = [
    ...daily(180, 31, 1800), // 150 dias de base fácil
    ...daily(30, 15, 5400), // 16 dias de bloco duro
    // …e nada nos últimos 14 dias.
  ];
  const fimDoBloco = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - 15, 20, 0, 0);
  const noBloco = buildFormCurve(acts, {}, fimDoBloco);
  const depois = buildFormCurve(acts, {}, NOW);

  assert.ok(noBloco.fatigue > noBloco.base, 'no fim do bloco o cansaço está acima da base');
  assert.ok(noBloco.form < 0, `saldo no bloco deveria ser negativo, foi ${noBloco.form}`);
  assert.ok(depois.form > 0, `saldo após o descanso deveria ser positivo, foi ${depois.form}`);
  assert.ok(depois.fatigue < noBloco.fatigue, 'o cansaço cai');
  assert.ok(depois.base < noBloco.base, 'a base também cai — só que mais devagar');
});

// ─── A matriz de casos ───────────────────────────────────────────────────────

check('histórico completo — 120 dias com zonas, tudo em min/semana e confiável', () => {
  const acts: Activity[] = [];
  for (let n = 119; n >= 0; n--) acts.push(run(n, 3600, { z2: 1800, z3: 1500, z4: 300 }));
  const r = buildFormCurve(acts, {}, NOW);

  const load = 1800 * 0.5 + 1500 * 1 + 300 * 2;
  const target = load * FORM_WEEKLY_MINUTES;
  assert.ok(r.base > 0 && r.fatigue > 0);
  assert.ok(Math.abs(r.fatigue - target) / target < 1e-3);
  assert.equal(r.trusted, true);
  assert.equal(r.shortWindow, false);
  assert.equal(r.historyDays, 120);
  assert.equal(r.daysSinceLastActivity, 0);
  assert.equal(r.series.length, 90, 'a série devolvida é cortada; a EWMA aqueceu com os 120');
  assert.equal(r.series[89].day, localDateStr(NOW));
  // A carga do dia está em minutos do dia, não em min/semana.
  assert.ok(Math.abs(r.series[89].dailyLoadMin - load / 60) < 1e-9);
});

check('janela curta — 20 dias de histórico levantam shortWindow', () => {
  const r = buildFormCurve(daily(19, 0, 3600), {}, NOW);
  assert.equal(r.historyDays, 20);
  assert.equal(r.shortWindow, true, `20 < ${FORM_BASE_DAYS}`);
  assert.equal(r.trusted, true, 'shortWindow é sobre aquecimento, não sobre idade do dado');
  // A base ainda está subindo do zero, então o saldo aparece inflado.
  assert.ok(r.base < r.fatigue, 'a base ainda não alcançou o cansaço');
  assert.ok(r.form < 0);
});

check('shortWindow na fronteira — 42 dias já não é curto, 41 ainda é', () => {
  const cheio = buildFormCurve(daily(41, 0, 3600), {}, NOW);
  assert.equal(cheio.historyDays, FORM_BASE_DAYS);
  assert.equal(cheio.shortWindow, false);
  const curto = buildFormCurve(daily(40, 0, 3600), {}, NOW);
  assert.equal(curto.historyDays, FORM_BASE_DAYS - 1);
  assert.equal(curto.shortWindow, true);
});

check('sincronização parada — última atividade há 12 dias derruba trusted', () => {
  const r = buildFormCurve(daily(120, 12, 3600), {}, NOW);
  assert.equal(r.daysSinceLastActivity, 12);
  assert.equal(r.trusted, false, `12 > ${FORM_STALE_AFTER_DAYS}`);
  assert.equal(r.historyDays, 121, 'a série continua até hoje — os dias parados existem');
});

check('atraso curto — última atividade há 2 dias continua confiável', () => {
  const r = buildFormCurve(daily(120, 2, 3600), {}, NOW);
  assert.equal(r.daysSinceLastActivity, 2);
  assert.equal(r.trusted, true);
});

check('limiar de trusted — 4 dias ainda vale, 5 não; staleAfterDays é configurável', () => {
  assert.equal(FORM_STALE_AFTER_DAYS, 4, 'a regra do cartão é 4 dias');
  assert.equal(buildFormCurve(daily(120, 4, 3600), {}, NOW).trusted, true);
  assert.equal(buildFormCurve(daily(120, 5, 3600), {}, NOW).trusted, false);
  assert.equal(buildFormCurve(daily(120, 3, 3600), { staleAfterDays: 2 }, NOW).trusted, false);
});

check('sem zonas de FC — carga pela estimativa do tipo, nunca zero', () => {
  const a = run(0, 3600);
  assert.equal(activityLoad(a), 3600 * RUN_WEIGHT);
  assert.ok(activityLoad(a) > 0);

  // Tipo fora da tabela de MET cai no padrão, e continua não sendo zero.
  const desconhecido = act({ startAt: `${localDateStr(dayAgo(0))}T08:00:00`, activityId: 9999, durationS: 3600 });
  assert.ok(activityLoad(desconhecido) > 0);
  assert.equal(activityLoad(desconhecido), 3600 * activityWeight(9999));

  const r = buildFormCurve([a], {}, NOW);
  assert.ok(r.series[r.series.length - 1].dailyLoadMin > 0);
});

check('a zona medida manda no trecho que ela cobre — fácil custa pouco, tiro custa muito', () => {
  // Duas horas do mesmo tipo, mesmo relógio: só a intensidade muda.
  const facil = act({
    startAt: '2026-06-01T08:00:00',
    activityId: 13,
    durationS: 7200,
    hrZones: { z1: 3600, z2: 3600 },
  });
  const tiros = act({
    startAt: '2026-06-01T08:00:00',
    activityId: 13,
    durationS: 7200,
    hrZones: { z2: 3600, z5: 3600 },
  });
  assert.equal(activityLoad(facil), 3600 * 0.2 + 3600 * 0.5);
  assert.equal(activityLoad(tiros), 3600 * 0.5 + 3600 * 3.5);
  assert.ok(activityLoad(tiros) > 5 * activityLoad(facil), 'o topo é onde este modelo separa');
});

check('cobertura parcial de FC — o trecho medido pelas zonas, o resto a z1', () => {
  // Uma hora de corrida com só 20 min de amostras de FC.
  const a = act({ startAt: '2026-06-01T08:00:00', durationS: 3600, hrZones: { z4: 1200 } });
  assert.equal(activityLoad(a), 1200 * 2 + 2400 * FORM_ZONE_WEIGHTS.z1);
});

check('com zonas o resto é z1; sem zonas é o tipo — e o tipo estima mais alto', () => {
  const medida = act({ startAt: '2026-06-01T08:00:00', durationS: 3600, hrZones: { z3: 1800 } });
  const semRelogio = act({ startAt: '2026-06-01T08:00:00', durationS: 3600 });
  assert.equal(activityLoad(medida), 1800 * 1 + 1800 * FORM_ZONE_WEIGHTS.z1);
  assert.equal(activityLoad(semRelogio), 3600 * RUN_WEIGHT);
  assert.ok(activityLoad(semRelogio) > activityLoad(medida), 'a estimativa por tipo é o chute alto');
});

check('zonas que somam mais que a duração são reescaladas, não infladas', () => {
  // Amostras sobrepostas de apps distintos: 7200 s de zona num treino de 3600 s.
  const a = act({ startAt: '2026-06-01T08:00:00', durationS: 3600, hrZones: { z3: 7200 } });
  assert.equal(activityLoad(a), 3600 * 1, 'z3 vale 1: a carga é a duração, não o dobro dela');
});

check('reescala preserva a proporção entre as zonas', () => {
  const a = act({ startAt: '2026-06-01T08:00:00', durationS: 3600, hrZones: { z2: 3600, z5: 3600 } });
  assert.equal(activityLoad(a), 1800 * 0.5 + 1800 * 3.5, 'metade em z2, metade em z5');
  assert.equal(activityLoad(a), 7200);
});

check('chave de zona desconhecida não conta — nem como cobertura nem com peso', () => {
  const a = act({
    startAt: '2026-06-01T08:00:00',
    durationS: 3600,
    hrZones: { z3: 1800, total: 99999, constructor: 500 },
  });
  // Só z3 é zona; o resto da hora é cobrado a z1 porque há zona válida.
  assert.equal(activityLoad(a), 1800 * 1 + 1800 * FORM_ZONE_WEIGHTS.z1);
});

check('duração não finita — carga zero, sem NaN', () => {
  const a = act({ startAt: '2026-06-01T08:00:00', durationS: Infinity });
  assert.equal(activityLoad(a), 0);
  const nan = act({ startAt: '2026-06-01T08:00:00', durationS: NaN });
  assert.equal(activityLoad(nan), 0);
});

check('duas atividades no mesmo dia somam na carga do dia', () => {
  const r = buildFormCurve([run(0, 1800), run(0, 1800)], {}, NOW);
  assert.equal(r.series.length, 1);
  assert.ok(Math.abs(r.series[0].dailyLoadMin - (2 * 1800 * RUN_WEIGHT) / 60) < 1e-9);
});

check('atividade oculta é ignorada na carga', () => {
  const visivel = buildFormCurve([run(0, 3600)], {}, NOW);
  const oculta = buildFormCurve([{ ...run(0, 3600), hidden: true }], {}, NOW);
  assert.ok(visivel.base > 0);
  assert.equal(oculta.base, 0);
  assert.deepEqual(oculta.series, []);
  assert.equal(oculta.daysSinceLastActivity, null);
  assert.equal(oculta.trusted, false);
});

check('lista vazia — série vazia, zeros, sem confiança, sem exceção', () => {
  const r = buildFormCurve([], {}, NOW);
  assert.deepEqual(r.series, []);
  assert.equal(r.base, 0);
  assert.equal(r.fatigue, 0);
  assert.equal(r.form, 0);
  assert.deepEqual(r.typical, { base: 0, fatigue: 0, form: 0 });
  assert.equal(r.historyDays, 0);
  assert.equal(r.daysSinceLastActivity, null);
  assert.equal(r.trusted, false);
});

check('now inválido devolve o mesmo objeto vazio da lista vazia', () => {
  const acts = daily(30, 0, 3600);
  assert.deepEqual(buildFormCurve(acts, {}, new Date(NaN)), buildFormCurve([], {}, NOW));
});

check('startAt inválido é pulado sem derrubar o resto', () => {
  const acts = [...daily(30, 0, 3600), act({ startAt: 'nope' })];
  const r = buildFormCurve(acts, {}, NOW);
  assert.equal(r.historyDays, 31);
  assert.equal(r.series.length, 31);
});

check('startAt nulo é pulado — e a série não começa em 1970', () => {
  const acts = [...daily(30, 0, 3600), act({ startAt: null as unknown as string })];
  const r = buildFormCurve(acts, {}, NOW);
  assert.equal(r.historyDays, 31);
  assert.equal(r.series.length, 31);
  assert.equal(r.series[0].day, localDateStr(dayAgo(30)));
});

check('atividade no futuro não entra — e não força trusted', () => {
  // Última real há 6 dias; uma linha com data de amanhã (fuso torto na origem).
  const acts = [...daily(30, 6, 3600), run(-1, 3600)];
  const r = buildFormCurve(acts, {}, NOW);
  assert.equal(r.historyDays, 31);
  assert.equal(r.series.length, 31);
  assert.equal(r.series[r.series.length - 1].day, localDateStr(NOW), 'a série termina hoje');
  assert.equal(r.daysSinceLastActivity, 6, 'a última atividade é a real, não a de amanhã');
  assert.equal(r.trusted, false, `6 > ${FORM_STALE_AFTER_DAYS}`);
});

check('dia local perto da meia-noite fica no dia local, não no dia UTC', () => {
  const local = new Date(2026, 5, 1, 23, 30);
  const a = act({ startAt: local.toISOString(), durationS: 1800 });
  const r = buildFormCurve([a], {}, NOW);
  assert.equal(r.series[0].day, localDateStr(local));
  assert.ok(r.series[0].dailyLoadMin > 0);
  assert.equal(r.historyDays, 3, '01, 02 e 03/06');
});

check('dias parados contam como carga zero — a série não pula lacuna', () => {
  const r = buildFormCurve([run(10, 3600), run(0, 3600)], {}, NOW);
  assert.equal(r.historyDays, 11);
  assert.equal(r.series.length, 11);
  const zerados = r.series.filter((d) => d.dailyLoadMin === 0);
  assert.equal(zerados.length, 9, 'nove dias parados entre os dois treinos');
  // Dias estritamente consecutivos, do mais antigo ao mais recente.
  const dias = r.series.map((d) => d.day);
  assert.deepEqual([...dias].sort(), dias);
  for (let k = 0; k <= 10; k++) {
    assert.equal(dias[k], localDateStr(dayAgo(10 - k)), `dia ${k} é exatamente o anterior + 1`);
  }
  // O cansaço decai nos dias parados em vez de congelar no último treino.
  assert.ok(r.series[9].fatigue < r.series[0].fatigue);
});

// ─── O típico ────────────────────────────────────────────────────────────────

check('o típico é mediana, não média — a lacuna não vira "normal"', () => {
  // 19 dias parados no meio dos 90 que o típico enxerga.
  const acts = [...daily(120, 40, 3600), ...daily(20, 0, 3600)];
  const r = buildFormCurve(acts, {}, NOW);
  const bases = r.series.slice(-90).map((d) => d.base);
  assert.equal(bases.length, 90);
  const mean = bases.reduce((s, v) => s + v, 0) / bases.length;
  const med = median(bases);
  assert.ok(Math.abs(r.typical.base - med) < 1e-9, 'typical.base é a mediana da fatia');
  assert.ok(Math.abs(med - mean) > 1e-6, 'se mediana e média coincidissem o teste não provaria nada');
  assert.ok(Number.isFinite(r.typical.fatigue) && r.typical.fatigue !== 0);
  assert.ok(Number.isFinite(r.typical.form) && r.typical.form !== 0);
});

check('typicalDays por parâmetro — a mediana é dos últimos N pontos', () => {
  const acts = [...daily(120, 40, 3600), ...daily(20, 0, 3600)];
  const r = buildFormCurve(acts, { typicalDays: 10 }, NOW);
  const dez = r.series.slice(-10);
  assert.ok(Math.abs(r.typical.base - median(dez.map((d) => d.base))) < 1e-9);
  assert.ok(Math.abs(r.typical.fatigue - median(dez.map((d) => d.fatigue))) < 1e-9);
  assert.ok(Math.abs(r.typical.form - median(dez.map((d) => d.form))) < 1e-9);
});

// ─── Parâmetros e determinismo ───────────────────────────────────────────────

check('janelas por parâmetro — trocar baseDays muda a curva e o shortWindow', () => {
  const acts = daily(29, 0, 3600);
  const padrao = buildFormCurve(acts, {}, NOW);
  const curto = buildFormCurve(acts, { baseDays: 7, fatigueDays: 7 }, NOW);
  assert.equal(padrao.shortWindow, true, '30 dias < 42');
  assert.equal(curto.shortWindow, false, '30 dias > 7');
  assert.ok(Math.abs(curto.form) < 1e-6, 'janelas iguais zeram o saldo por construção');
  assert.ok(curto.base > padrao.base, 'janela curta aquece mais rápido');
});

check('opção inválida cai no padrão — sem NaN, sem slice(-0)', () => {
  const acts = daily(119, 0, 3600);
  const padrao = buildFormCurve(acts, {}, NOW);
  const torto = buildFormCurve(
    acts,
    { baseDays: NaN, fatigueDays: Infinity, seriesDays: 0, typicalDays: -5, staleAfterDays: 0 },
    NOW,
  );
  assert.ok(Number.isFinite(torto.base) && Number.isFinite(torto.fatigue) && Number.isFinite(torto.form));
  assert.equal(torto.series.length, padrao.series.length, 'seriesDays: 0 não devolve a série inteira');
  assert.deepEqual(torto, padrao, 'todas as opções inválidas caíram no padrão');
});

check('seriesDays corta o que volta sem mexer no aquecimento da EWMA', () => {
  const acts = daily(119, 0, 3600);
  const cheio = buildFormCurve(acts, { seriesDays: 400 }, NOW);
  const cortado = buildFormCurve(acts, { seriesDays: 10 }, NOW);
  assert.equal(cheio.series.length, 120);
  assert.equal(cortado.series.length, 10);
  assert.equal(cortado.base, cheio.base, 'o corte é só de exibição');
  assert.deepEqual(cortado.series, cheio.series.slice(-10));
});

check('determinístico — mesmo input, mesmo objeto', () => {
  const acts = [...daily(60, 20, 2700), ...daily(10, 0, 3600)];
  assert.deepEqual(buildFormCurve(acts, {}, NOW), buildFormCurve(acts, {}, NOW));
});

console.log(`\n${passed} testes passaram.`);
