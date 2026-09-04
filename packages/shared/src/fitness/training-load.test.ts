/**
 * ACWR, monotonia e strain.
 *
 * Spec: _bmad-output/implementation-artifacts/spec-carga-acwr.md
 *
 * Três decisões aqui mudam **todo** o número sem quebrar nada visivelmente, e por
 * isso ganham teste próprio: o **desacoplamento** (a crônica exclui os dias da
 * aguda — a diferença entre 6,0 e 2,7 na mesma semana), o **desvio populacional**
 * na monotonia (o amostral derrubaria a razão em ~8%, mudando faixa) e a regra de
 * que **denominador zero devolve `null`**, nunca `Infinity`. O resto cobre linha
 * por linha a matriz de casos do spec.
 */

import assert from 'node:assert/strict';
import {
  ACWR_ACUTE_DAYS,
  ACWR_CHRONIC_DAYS,
  ACWR_BANDS,
  MONOTONY_ALERT,
  acwrBandOf,
  monotonyBandOf,
  buildTrainingLoad,
  type TrainingLoad,
} from './training-load';
import { FORM_FATIGUE_DAYS, buildFormCurve, type FormCurveDay } from './form-curve';
import { localDateStr } from '../date/local';
import type { Activity } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/**
 * Um dia da série. `base`/`fatigue`/`form` ficam em zero de propósito: este
 * módulo lê só `dailyLoadMin`, e um fixture que preenchesse os três esconderia
 * uma dependência acidental se ela aparecesse.
 *
 * As datas são **consecutivas de verdade**, geradas por aritmética de calendário.
 * A primeira versão usava `(i % 28) + 1`, que repete o dia e anda para trás na
 * virada — ou seja, os testes exercitavam o módulo contra séries que violam o
 * contrato de ordem que o próprio módulo documenta.
 */
function seriesOf(loads: readonly number[]): FormCurveDay[] {
  const fim = new Date(2026, 5, 3);
  return loads.map((dailyLoadMin, i) => {
    const d = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() - (loads.length - 1 - i));
    return { day: localDateStr(d), dailyLoadMin, base: 0, fatigue: 0, form: 0 };
  });
}

function flat(days: number, load: number): number[] {
  return Array.from({ length: days }, () => load);
}

/** `pattern` repetido até `days`, alinhado pelo **fim** (é de lá que as janelas saem). */
function repeatTo(pattern: readonly number[], days: number): number[] {
  const out: number[] = [];
  while (out.length < days + pattern.length) out.push(...pattern);
  return out.slice(-days);
}

/** 53 dias de base seguidos de uma semana — o ACWR desacoplado vira `week / base`. */
function ramp(base: number, week: number): FormCurveDay[] {
  return seriesOf([...flat(53, base), ...flat(7, week)]);
}

/** Todo campo numérico é finito ou `null` — nunca `Infinity`, nunca `NaN`. */
function assertNoInfinities(r: TrainingLoad, label: string): void {
  for (const [key, value] of Object.entries(r)) {
    if (typeof value !== 'number') continue;
    assert.ok(Number.isFinite(value), `${label}: ${key} veio ${value}`);
  }
}

// ─── As janelas ──────────────────────────────────────────────────────────────

check('a janela aguda é a mesma do cansaço da curva de forma, não um 7 redeclarado', () => {
  assert.equal(ACWR_ACUTE_DAYS, FORM_FATIGUE_DAYS);
  assert.equal(ACWR_ACUTE_DAYS, 7);
  assert.equal(ACWR_CHRONIC_DAYS, 28, 'quatro semanas, o padrão da literatura');
});

// ─── O desacoplamento ────────────────────────────────────────────────────────

check('semana pesada sobre base leve — o desacoplado acusa mais que o acoplado', () => {
  const r = buildTrainingLoad(ramp(10, 60));

  // Desacoplado: 60 contra os 10 dos dias 8–28. Acoplado: 60 contra a média dos
  // 28 dias, que já contém a própria semana pesada — (7×60 + 21×10)/28 = 22,5.
  assert.ok(Math.abs(r.acwr! - 6) < 1e-12, `acwr desacoplado ${r.acwr}`);
  assert.ok(Math.abs(r.acwrCoupled! - 60 / 22.5) < 1e-12, `acwr acoplado ${r.acwrCoupled}`);
  // As duas bases, afirmadas em separado: sem isto o campo `chronicLoadCoupled`
  // podia carregar a base desacoplada e nada acusaria.
  assert.equal(r.chronicLoad, 10, 'base desacoplada: só os dias 8–28');
  assert.equal(r.chronicLoadCoupled, 22.5, 'base acoplada: já contém a semana pesada');
  assert.ok(
    r.acwr! > r.acwrCoupled!,
    'o acoplamento dilui o pico no próprio denominador — é a crítica que motiva o padrão',
  );
  assert.ok(r.acwr! > ACWR_BANDS.cautionMax);
  assert.equal(r.band, 'risk');
});

check('carga constante por mais de 28 dias — as duas formas ficam em 1', () => {
  const r = buildTrainingLoad(seriesOf(flat(60, 30)));
  assert.equal(r.acwr, 1);
  assert.equal(r.acwrCoupled, 1);
  assert.equal(r.band, 'optimal');
  assert.equal(r.shortWindow, false);
  // Série perfeitamente constante: o desvio é zero e a razão fica indefinida —
  // mas o significado não. É o extremo da monotonia, e a faixa diz isso.
  assert.equal(r.monotony, null, 'desvio 0 não vira Infinity');
  assert.equal(r.strain, null);
  assert.equal(r.monotonyReason, 'constant');
  assert.equal(r.monotonyBand, 'monotonous', 'semana idêntica é o máximo da monotonia, não ausência dela');
});

check('série estável mas não idêntica — acwr em 1 e monotonia lá em cima', () => {
  // A linha "carga estável" da matriz é o desvio **pequeno**, não o desvio zero
  // (esse é a linha "semana constante", logo abaixo). O padrão tem período 7,
  // então aguda e crônica têm exatamente a mesma média.
  const r = buildTrainingLoad(seriesOf(repeatTo([40, 41, 40, 41, 40, 41, 40], 60)));
  assert.ok(Math.abs(r.acwr! - 1) < 1e-12, `acwr ${r.acwr}`);
  assert.equal(r.band, 'optimal');
  assert.ok(r.monotony! > MONOTONY_ALERT, `monotonia ${r.monotony} deveria estourar o alerta`);
  assert.equal(r.monotonyBand, 'monotonous');
  assert.ok(r.strain! > 0);
});

// ─── Monotonia e strain ──────────────────────────────────────────────────────

check('monotonia é média/desvio com desvio POPULACIONAL, e strain é carga × monotonia', () => {
  // Semana 10..70: média 40, variância populacional 2800/7 = 400, desvio 20.
  const r = buildTrainingLoad(seriesOf([...flat(53, 40), 10, 20, 30, 40, 50, 60, 70]));
  assert.equal(r.weeklyLoad, 280);
  assert.equal(r.acuteLoad, 40);
  assert.equal(r.monotony, 2, 'média 40 / desvio 20');
  assert.equal(r.monotonyBand, 'varied', 'exatamente 2 ainda não é alerta — o alerta é acima');
  assert.equal(r.strain, 560, 'carga da semana × monotonia');

  // O desvio amostral (n−1) daria 21,602 e a monotonia cairia para 1,85.
  const amostral = Math.sqrt(2800 / 6);
  assert.ok(Math.abs(r.monotony! - 40 / amostral) > 0.1, 'não é o desvio amostral');
});

check('semana constante — desvio 0 deixa monotonia e strain sem número, mas não o ACWR', () => {
  const r = buildTrainingLoad(seriesOf([...repeatTo([20, 0, 45, 30, 0, 60, 25], 53), ...flat(7, 30)]));
  assert.equal(r.monotony, null, 'desvio 0 → null, não Infinity');
  assert.equal(r.monotonyReason, 'constant');
  assert.equal(r.monotonyBand, 'monotonous');
  assert.equal(r.strain, null);
  assert.equal(r.weeklyLoad, 210, 'a carga da semana continua existindo');
  assert.ok(r.acwr !== null && Number.isFinite(r.acwr), 'o ACWR não depende do desvio');
  assertNoInfinities(r, 'semana constante');
});

check('semana toda zero — carga 0, monotonia e strain null (0/0 não é 0)', () => {
  const r = buildTrainingLoad(seriesOf([...flat(53, 30), ...flat(7, 0)]));
  assert.equal(r.weeklyLoad, 0);
  assert.equal(r.acuteLoad, 0);
  assert.equal(r.monotony, null);
  assert.equal(r.strain, null);
  assert.equal(r.acwr, 0, 'parar a semana inteira é ACWR zero, não indefinido');
  assert.equal(r.band, 'undertraining');
  // Parada e constante chegam as duas como `monotony: null` — o motivo é o que
  // as separa, e sem ele o cartão não saberia qual texto escrever.
  assert.equal(r.monotonyReason, 'idle');
  assert.equal(r.monotonyBand, null, 'semana parada não tem textura a classificar');
  assertNoInfinities(r, 'semana zero');

  // E a semana zero sozinha, sem base nenhuma atrás dela.
  const so = buildTrainingLoad(seriesOf(flat(7, 0)));
  assert.equal(so.weeklyLoad, 0);
  assert.equal(so.monotony, null);
  assert.equal(so.monotonyReason, 'idle');
  assert.equal(so.strain, null);
});

// ─── Divisão por zero ────────────────────────────────────────────────────────

check('crônica zerada — 28 dias parados e uma semana com carga devolvem null', () => {
  const r = buildTrainingLoad(seriesOf([...flat(28, 0), ...flat(7, 50)]));
  assert.equal(r.chronicLoad, 0);
  assert.equal(r.acwr, null, 'não Infinity');
  assert.equal(r.band, null);
  assert.equal(r.acuteLoad, 50);
  assertNoInfinities(r, 'crônica zerada');
});

check('nenhuma entrada patológica produz Infinity ou NaN', () => {
  const casos: [string, FormCurveDay[]][] = [
    ['vazia', seriesOf([])],
    ['um dia', seriesOf([42])],
    ['tudo zero', seriesOf(flat(60, 0))],
    ['NaN na carga', seriesOf([...flat(53, 10), NaN, 10, 10, 10, 10, 10, 10])],
    ['Infinity na carga', seriesOf([...flat(53, 10), Infinity, 10, 10, 10, 10, 10, 10])],
    ['carga negativa', seriesOf([...flat(53, 10), -500, 10, 10, 10, 10, 10, 10])],
    ['carga gigante', seriesOf([...flat(53, 1e-12), ...flat(7, 1e12)])],
  ];
  for (const [label, series] of casos) assertNoInfinities(buildTrainingLoad(series), label);
});

check('carga não finita ou negativa é saneada para zero, não propagada', () => {
  const limpo = buildTrainingLoad(seriesOf([...flat(53, 10), 0, 10, 10, 10, 10, 10, 10]));
  for (const sujo of [NaN, Infinity, -Infinity, -10]) {
    const r = buildTrainingLoad(seriesOf([...flat(53, 10), sujo, 10, 10, 10, 10, 10, 10]));
    assert.deepEqual(r, limpo, `${sujo} deveria virar 0`);
  }
});

// ─── Confiança ───────────────────────────────────────────────────────────────

check('histórico completo — 60 dias com carga dão tudo finito e janela madura', () => {
  const r = buildTrainingLoad(seriesOf(repeatTo([45, 0, 60, 30, 0, 75, 20], 60)));
  assert.equal(r.seriesDays, 60);
  assert.equal(r.acuteDays, 7);
  assert.equal(r.chronicDays, 21, 'a crônica desacoplada são os dias 8 a 28');
  assert.equal(r.shortWindow, false);
  assert.ok(Number.isFinite(r.acwr!) && Number.isFinite(r.monotony!) && Number.isFinite(r.strain!));
  assert.notEqual(r.band, null);
  assert.notEqual(r.monotonyBand, null);
});

check('janela crônica incompleta — 20 dias calculam, mas declaram imaturidade', () => {
  const r = buildTrainingLoad(seriesOf(repeatTo([45, 0, 60, 30, 0, 75, 20], 20)));
  assert.equal(r.seriesDays, 20);
  assert.equal(r.acuteDays, 7);
  assert.equal(r.chronicDays, 13, '20 − 7: a crônica roda com o que há');
  assert.equal(r.shortWindow, true, `20 < ${ACWR_CHRONIC_DAYS}`);
  assert.ok(r.acwr !== null, 'imaturo não é ausente — o número existe e é declarado imaturo');
  assert.ok(r.monotony !== null, 'a semana está cheia, então a monotonia vale');
});

check('shortWindow na fronteira — 28 dias já não é curto, 27 ainda é', () => {
  assert.equal(buildTrainingLoad(seriesOf(flat(28, 30))).shortWindow, false);
  assert.equal(buildTrainingLoad(seriesOf(flat(27, 30))).shortWindow, true);
});

check('série curta — menos de 7 dias não lança e não finge ter semana', () => {
  const r = buildTrainingLoad(seriesOf([10, 20, 30, 40, 50]));
  assert.equal(r.seriesDays, 5);
  assert.equal(r.acuteDays, 5);
  assert.equal(r.chronicDays, 0, 'não sobra dia nenhum fora da aguda');
  assert.equal(r.monotony, null, 'a janela aguda não está cheia');
  assert.equal(r.monotonyReason, 'shortWeek');
  assert.equal(r.monotonyBand, null);
  assert.equal(r.strain, null);
  assert.equal(r.acwr, null, 'sem crônica desacoplada não há razão a calcular');
  assert.equal(r.band, null);
  // O acoplado aqui daria 1 por construção — as duas fatias são a mesma. Publicar
  // esse 1 seria vender o artefato do acoplamento como medida.
  assert.equal(r.acwrCoupled, null);
  assert.equal(r.weeklyLoad, 150, 'a soma dos dias que existem');
  assert.equal(r.shortWindow, true);

  // Na fronteira exata da janela aguda o acoplado ainda é a mesma fatia.
  assert.equal(buildTrainingLoad(seriesOf(flat(7, 30))).acwrCoupled, null);
  assert.notEqual(buildTrainingLoad(seriesOf(flat(8, 30))).acwrCoupled, null, 'com 8 dias já há base');
});

check('série vazia — tudo null, sem exceção', () => {
  const r = buildTrainingLoad([]);
  assert.equal(r.acwr, null);
  assert.equal(r.acwrCoupled, null);
  assert.equal(r.band, null);
  assert.equal(r.weeklyLoad, null);
  assert.equal(r.acuteLoad, null);
  assert.equal(r.chronicLoad, null);
  assert.equal(r.chronicLoadCoupled, null);
  assert.equal(r.monotony, null);
  assert.equal(r.monotonyReason, 'shortWeek');
  assert.equal(r.monotonyBand, null);
  assert.equal(r.strain, null);
  assert.equal(r.seriesDays, 0);
  assert.equal(r.acuteDays, 0);
  assert.equal(r.chronicDays, 0);
  assert.equal(r.shortWindow, true);
});

check('entrada ausente ou torta não lança — o contrato vale para quem chama sem tipos', () => {
  const vazio = buildTrainingLoad([]);
  // O núcleo é consumido por JavaScript sem tipos (edge function, `JSON.parse`).
  assert.deepEqual(buildTrainingLoad(undefined as unknown as FormCurveDay[]), vazio);
  assert.deepEqual(buildTrainingLoad(null as unknown as FormCurveDay[]), vazio);
  assert.deepEqual(buildTrainingLoad([], null as unknown as undefined), vazio);

  // Furo no array: `map` preservaria o buraco e ele escaparia como `undefined`.
  const furado = seriesOf(flat(60, 30));
  // eslint-disable-next-line @typescript-eslint/no-array-delete
  delete (furado as unknown as FormCurveDay[])[10];
  const r = buildTrainingLoad(furado);
  assertNoInfinities(r, 'série com furo');
  assert.equal(r.seriesDays, 60, 'o furo conta como dia parado, não some da série');
});

// ─── As faixas ───────────────────────────────────────────────────────────────

check('as faixas saem das constantes exportadas, com o limite de baixo inclusivo', () => {
  assert.deepEqual(
    [ACWR_BANDS.undertrainingBelow, ACWR_BANDS.optimalMax, ACWR_BANDS.cautionMax],
    [0.8, 1.3, 1.5],
  );
  assert.equal(acwrBandOf(ACWR_BANDS.undertrainingBelow - 0.01), 'undertraining');
  assert.equal(acwrBandOf(ACWR_BANDS.undertrainingBelow), 'optimal', 'o limite pertence à faixa de baixo');
  assert.equal(acwrBandOf(ACWR_BANDS.optimalMax), 'optimal');
  assert.equal(acwrBandOf(ACWR_BANDS.optimalMax + 0.01), 'caution');
  assert.equal(acwrBandOf(ACWR_BANDS.cautionMax), 'caution');
  assert.equal(acwrBandOf(ACWR_BANDS.cautionMax + 0.01), 'risk');
  assert.equal(acwrBandOf(0), 'undertraining');
  assert.equal(acwrBandOf(null), null);
  assert.equal(acwrBandOf(NaN), null, 'NaN não classifica');

  assert.equal(MONOTONY_ALERT, 2);
  assert.equal(monotonyBandOf(MONOTONY_ALERT), 'varied');
  assert.equal(monotonyBandOf(MONOTONY_ALERT + 0.01), 'monotonous');
  assert.equal(monotonyBandOf(null), null);
  assert.equal(monotonyBandOf(NaN), null);
});

check('cada faixa tem uma série que a produz, e o campo bate com o classificador', () => {
  const esperado: [number, string][] = [
    [5, 'undertraining'],
    [10, 'optimal'],
    [14, 'caution'],
    [60, 'risk'],
  ];
  for (const [semana, band] of esperado) {
    const r = buildTrainingLoad(ramp(10, semana));
    assert.equal(r.band, band, `semana ${semana} contra base 10 → ${r.acwr}`);
    assert.equal(r.band, acwrBandOf(r.acwr), 'o campo é o classificador, não uma segunda regra');
  }
});

// ─── Parâmetros, pureza e determinismo ───────────────────────────────────────

check('janelas por parâmetro — a fatia acompanha, e com base plana a razão não muda', () => {
  const series = ramp(10, 60);
  const padrao = buildTrainingLoad(series);
  const curto = buildTrainingLoad(series, { chronicDays: 14 });
  assert.equal(curto.chronicDays, 7, '14 − 7');
  assert.equal(curto.shortWindow, false);
  assert.equal(padrao.acwr, curto.acwr, 'a base é plana nos dois recortes, então a razão coincide');

  // Com base em degrau a crônica curta pega outro pedaço e o número muda.
  const degrau = seriesOf([...flat(39, 5), ...flat(14, 20), ...flat(7, 60)]);
  assert.notEqual(
    buildTrainingLoad(degrau).acwr,
    buildTrainingLoad(degrau, { chronicDays: 14 }).acwr,
    'aí sim a janela escolhe uma base diferente',
  );

  const agudaLonga = buildTrainingLoad(series, { acuteDays: 14 });
  assert.equal(agudaLonga.acuteDays, 14);
  assert.ok(agudaLonga.acwr! < padrao.acwr!, 'aguda de 14 dias dilui a semana pesada');
  assert.equal(agudaLonga.weeklyLoad, 7 * 60 + 7 * 10, 'a soma acompanha a janela');
});

check('fora das janelas padrão o número sai, mas a faixa não', () => {
  // As fronteiras foram calibradas para 7 contra 28. Classificar uma janela de
  // 14 dias com elas seria emprestar autoridade que o número não tem.
  const r = buildTrainingLoad(ramp(10, 60), { acuteDays: 14 });
  assert.ok(r.acwr !== null, 'o número continua existindo');
  assert.equal(r.band, null);
  assert.equal(r.monotonyBand, null);
  assert.notEqual(buildTrainingLoad(ramp(10, 60)).band, null, 'com o padrão, classifica');
});

check('crônica menor ou igual à aguda não inventa fatia — devolve null nas duas formas', () => {
  const r = buildTrainingLoad(ramp(10, 60), { chronicDays: 5 });
  assert.equal(r.chronicDays, 0);
  assert.equal(r.acwr, null);
  assert.equal(r.acwrCoupled, null, 'a fatia acoplada seria a própria aguda');
  assertNoInfinities(r, 'crônica menor que a aguda');
});

check('opção inválida cai no padrão — sem NaN, sem slice(-0)', () => {
  const series = ramp(10, 60);
  const padrao = buildTrainingLoad(series);
  for (const torto of [
    { acuteDays: NaN },
    { acuteDays: 0 },
    { acuteDays: 0.5 },
    { chronicDays: 0.99 },
    { chronicDays: Infinity },
    { chronicDays: -5 },
    { acuteDays: undefined, chronicDays: undefined },
  ]) {
    assert.deepEqual(buildTrainingLoad(series, torto), padrao, JSON.stringify(torto));
  }

  // Fração entre 0 e 1 é a armadilha: passa por "positivo", vira 0 no
  // truncamento, e `slice(-0)` devolve a SÉRIE INTEIRA como se fosse a semana.
  const meia = buildTrainingLoad(series, { acuteDays: 0.5 });
  assert.equal(meia.acuteDays, ACWR_ACUTE_DAYS, 'não são 60 dias de "semana"');
  assert.equal(meia.weeklyLoad, 7 * 60);
});

check('janela fracionária é truncada, não descartada', () => {
  // Semana variada de propósito: com a semana plana do `ramp` a monotonia seria
  // null por construção e o teste não veria a diferença que quer ver.
  const series = seriesOf([...flat(53, 40), 10, 20, 30, 40, 50, 60, 70]);
  assert.deepEqual(
    buildTrainingLoad(series, { acuteDays: 7.9 }),
    buildTrainingLoad(series, { acuteDays: 7 }),
    '7,9 é 7',
  );
  assert.notEqual(
    buildTrainingLoad(series, { acuteDays: 7.9 }).monotony,
    null,
    'truncar não pode matar a monotonia — a janela cheia continua cheia',
  );
});

check('as fronteiras de faixa são imutáveis em runtime', () => {
  // `as const` é só do compilador; sem congelar, uma linha reclassifica todo o
  // histórico em silêncio. Fora de modo estrito a atribuição falha calada, então
  // o que se afirma é o valor, não a exceção.
  assert.ok(Object.isFrozen(ACWR_BANDS));
  try {
    (ACWR_BANDS as unknown as Record<string, number>).cautionMax = 99;
  } catch {
    // Em modo estrito lança; nos dois casos o valor não pode mudar.
  }
  assert.equal(ACWR_BANDS.cautionMax, 1.5);
});

check('puro — não muta a série e devolve resultado igual para a mesma entrada', () => {
  const series = ramp(10, 60);
  const antes = JSON.stringify(series);
  const a = buildTrainingLoad(series);
  const b = buildTrainingLoad(series);
  assert.deepEqual(a, b, 'mesmo valor; nada é memoizado, então não é a mesma referência');
  assert.equal(JSON.stringify(series), antes, 'a entrada saiu intacta');
});

// ─── O contrato com quem produz a série ──────────────────────────────────────

check('a série real de buildFormCurve entra sem adaptador', () => {
  const NOW = new Date(2026, 5, 3, 12, 0, 0);
  const activities: Activity[] = [];
  for (let n = 59; n >= 0; n--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - n, 8, 0, 0);
    // Uma semana leve e uma pesada alternando, para o desvio não zerar.
    activities.push({
      id: `a${n}`,
      userId: 'u1',
      activityId: 37,
      calories: 300,
      durationS: n % 2 === 0 ? 3600 : 1800,
      startAt: `${localDateStr(d)}T08:00:00`,
      endAt: `${localDateStr(d)}T09:00:00`,
      hasRoute: false,
    });
  }
  const curva = buildFormCurve(activities, {}, NOW);
  const r = buildTrainingLoad(curva.series);

  assert.equal(curva.series.length, 60);
  assert.equal(r.seriesDays, 60);
  assert.equal(r.acuteDays, ACWR_ACUTE_DAYS);
  assert.equal(r.chronicDays, ACWR_CHRONIC_DAYS - ACWR_ACUTE_DAYS);
  assert.equal(r.shortWindow, false);
  assert.ok(Number.isFinite(r.acwr!) && Number.isFinite(r.monotony!) && Number.isFinite(r.strain!));
  // A carga da semana é a soma dos `dailyLoadMin` dos últimos 7 dias, sem recontar nada.
  const soma = curva.series.slice(-7).reduce((s, d) => s + d.dailyLoadMin, 0);
  assert.ok(Math.abs(r.weeklyLoad! - soma) < 1e-9);
  assertNoInfinities(r, 'série real');
});

console.log(`\n${passed} testes passaram.`);
