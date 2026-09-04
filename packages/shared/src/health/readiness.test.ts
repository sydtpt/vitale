/**
 * Prontidão — o portão de frescor, o piso de cobertura e a curva do sono.
 *
 * Três regras aqui mudam a nota **sem quebrar nada visivelmente**, e por isso
 * cada uma tem teste próprio:
 *
 * 1. **Dado velho sai do peso.** É o defeito que motivou a mudança: em 04/09/2026
 *    a prontidão marcava 80 apoiada em sono e FC de domingo e em anéis de dezoito
 *    dias, enquanto o único sinal do dia marcava 52. O cenário está reproduzido
 *    aqui, com os números reais, para que voltar a pontuar dado velho quebre.
 * 2. **Abaixo de metade do peso não há nota.** `total` vira `null`, e `null` não
 *    é 0 — um teste garante que ninguém troque um pelo outro.
 * 3. **A curva do sono tem joelho na meta.** A rampa linear até 8 h saturava; o
 *    teste fixa os dois trechos e o fato de que 7 h não é mais 100.
 */

import assert from 'node:assert/strict';
import {
  READINESS_BANDS,
  READINESS_MIN_COVERAGE,
  READINESS_STALE_DAYS,
  SLEEP_TARGET_H,
  computeReadiness,
  readinessBandOf,
  rollingBaseline,
  sleepScore,
  type ReadinessInput,
  type ReadinessKey,
} from './readiness';
import { ACWR_BANDS } from '../fitness/training-load';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Entrada completa e fresca: os cinco sinais presentes, todos do dia. */
function full(over: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    sleepHours: 7,
    restingHr: 50,
    restingHrBaseline: 50,
    hrv: 40,
    hrvBaseline: 40,
    ringsPct: [1, 1, 1],
    acwr: 1,
    ...over,
  };
}

function scoreOf(input: ReadinessInput, key: ReadinessKey): number | undefined {
  return computeReadiness(input).components.find((c) => c.key === key)?.score;
}

// ─────────────────────────────────────────────────────────────
// 1. A curva do sono
// ─────────────────────────────────────────────────────────────

check('sono — a meta é 7 h e vale 85, não 100', () => {
  assert.equal(SLEEP_TARGET_H, 7);
  assert.equal(sleepScore(7), 85);
});

check('sono — o primeiro trecho é linear até a meta', () => {
  assert.equal(sleepScore(3.5), 42.5);
  assert.ok(Math.abs(sleepScore(5) - (5 / 7) * 85) < 1e-9);
});

check('sono — o segundo trecho é mais raso e fecha em 100 às 9 h', () => {
  assert.equal(sleepScore(8), 92.5);
  assert.equal(sleepScore(9), 100);
  assert.equal(sleepScore(12), 100);
  // O joelho existe: a inclinação depois da meta é menor que antes dela.
  const antes = sleepScore(7) - sleepScore(6);
  const depois = sleepScore(8) - sleepScore(7);
  assert.ok(depois < antes, `esperava joelho, veio ${antes} → ${depois}`);
});

check('sono — a curva separa a faixa que a rampa antiga achatava', () => {
  // Sete noites reais do dono. Com a rampa linear até 8 h, quatro delas
  // marcavam 100 e o componente parava de distinguir noite boa de ótima.
  const noites = [3.2, 6.6, 6.9, 7.0, 7.3, 8.3, 8.5];
  const notas = noites.map(sleepScore);
  assert.equal(new Set(notas.map((n) => Math.round(n))).size, noites.length);
  assert.equal(notas.filter((n) => n === 100).length, 0);
});

check('sono — zero e negativo não pontuam, e nem entram como componente', () => {
  assert.equal(sleepScore(0), 0);
  assert.equal(sleepScore(-1), 0);
  assert.equal(sleepScore(Number.NaN), 0);
  // Zero é buraco de agregação, não noite em branco: o componente some.
  assert.equal(scoreOf(full({ sleepHours: 0 }), 'sono'), undefined);
  assert.ok(computeReadiness(full({ sleepHours: 0 })).missing.includes('sono'));
});

// ─────────────────────────────────────────────────────────────
// 2. O portão de frescor
// ─────────────────────────────────────────────────────────────

check('frescor — sem idade informada tudo conta como fresco', () => {
  const r = computeReadiness(full());
  assert.equal(r.coverage, 1);
  assert.deepEqual(r.stale, []);
  assert.ok(r.components.every((c) => c.ageDays === null && !c.stale));
});

check(`frescor — ${READINESS_STALE_DAYS} dias ainda pontua, o dia seguinte não`, () => {
  const noLimite = computeReadiness(full({ ageDays: { sono: READINESS_STALE_DAYS } }));
  assert.equal(noLimite.coverage, 1);
  assert.deepEqual(noLimite.stale, []);

  const passou = computeReadiness(full({ ageDays: { sono: READINESS_STALE_DAYS + 1 } }));
  assert.deepEqual(passou.stale, ['sono']);
  assert.ok(passou.coverage < 1);
});

check('frescor — o componente velho continua na lista, com a idade, para a tela apagar', () => {
  const r = computeReadiness(full({ ageDays: { aneis: 18 } }));
  const aneis = r.components.find((c) => c.key === 'aneis');
  assert.ok(aneis, 'o componente velho não pode sumir da lista');
  assert.equal(aneis.ageDays, 18);
  assert.equal(aneis.stale, true);
  assert.ok(aneis.score > 0, 'o sub-score continua calculado — quem apaga é a tela');
  // Velho não é ausente: `missing` é só para quem não tem leitura nenhuma.
  assert.ok(!r.missing.includes('aneis'));
});

check('frescor — idade negativa e não finita contam como fresco', () => {
  const r = computeReadiness(full({ ageDays: { sono: -3, vfc: Number.NaN, aneis: null } }));
  assert.deepEqual(r.stale, []);
  assert.equal(r.components.find((c) => c.key === 'sono')?.ageDays, 0);
  assert.equal(r.components.find((c) => c.key === 'vfc')?.ageDays, null);
});

check('frescor — meio dia de idade ainda é hoje', () => {
  const r = computeReadiness(full({ ageDays: { sono: 0.9 } }));
  assert.equal(r.components.find((c) => c.key === 'sono')?.ageDays, 0);
});

check('REGRESSÃO — 04/09/2026: a nota de 80 sustentada por dado velho vira null', () => {
  // O estado real do dia: VFC do dia marcando 52, sono e FC de quatro dias
  // antes marcando quase cheio, anéis de dezoito dias.
  const r = computeReadiness({
    sleepHours: 8.3,
    restingHr: 46,
    restingHrBaseline: 50,
    hrv: 34,
    hrvBaseline: 40,
    ringsPct: [1, 1, 1],
    ageDays: { sono: 4, fcRepouso: 4, vfc: 0, aneis: 18 },
  });

  assert.deepEqual(r.stale.sort(), ['aneis', 'fcRepouso', 'sono']);
  // Só a VFC sobrou: 0,20 de 1,00 de peso, abaixo do piso.
  assert.ok(Math.abs(r.coverage - 0.2) < 1e-9, `cobertura ${r.coverage}`);
  assert.equal(r.total, null, 'com um sinal só não pode haver nota');
  assert.equal(r.band, null);
  // E o sinal fresco continua legível na lista, com a sua nota baixa.
  assert.ok(r.components.find((c) => c.key === 'vfc')!.score < 50);
});

// ─────────────────────────────────────────────────────────────
// 3. O piso de cobertura
// ─────────────────────────────────────────────────────────────

check('cobertura — exatamente no piso ainda dá nota', () => {
  // sono (0,24) + vfc (0,20) + aneis (0,16) = 0,60; tirar os anéis desce a 0,44.
  const passa = computeReadiness({
    sleepHours: 7,
    hrv: 40,
    hrvBaseline: 40,
    ringsPct: [1, 1, 1],
  });
  assert.ok(passa.coverage >= READINESS_MIN_COVERAGE);
  assert.equal(typeof passa.total, 'number');

  const naoPassa = computeReadiness({ sleepHours: 7, hrv: 40, hrvBaseline: 40 });
  assert.ok(naoPassa.coverage < READINESS_MIN_COVERAGE);
  assert.equal(naoPassa.total, null);
});

check('cobertura — sem sinal nenhum a nota é null, e null não é zero', () => {
  const r = computeReadiness({});
  assert.equal(r.total, null);
  assert.notEqual(r.total, 0);
  assert.equal(r.coverage, 0);
  assert.deepEqual(r.components, []);
  assert.deepEqual(r.missing.sort(), ['aneis', 'carga', 'fcRepouso', 'sono', 'vfc']);
});

check('cobertura — entrada ausente não lança (o núcleo roda sem tipos na edge)', () => {
  const semNada = computeReadiness(undefined as unknown as ReadinessInput);
  assert.equal(semNada.total, null);
  assert.equal(semNada.coverage, 0);
});

check('cobertura — a média renormaliza só sobre o que é fresco', () => {
  // Sono 100 velho + os outros quatro frescos em 50: a média tem de dar 50,
  // não puxar para cima por causa da noite de domingo.
  const r = computeReadiness({
    sleepHours: 9,
    restingHr: 62.5, // 50 pontos de penalidade sobre a baseline
    restingHrBaseline: 50,
    hrv: 40,
    hrvBaseline: 40, // rel 0 → 50
    ringsPct: [0.5, 0.5, 0.5],
    acwr: 1.5, // o teto da atenção → 50
    ageDays: { sono: 30 },
  });
  assert.equal(r.total, 50);
  assert.deepEqual(r.stale, ['sono']);
});

// ─────────────────────────────────────────────────────────────
// 4. O componente de carga
// ─────────────────────────────────────────────────────────────

check('carga — no costume vale 100, e abaixo dele não vale mais que isso', () => {
  assert.equal(scoreOf(full({ acwr: 1 }), 'carga'), 100);
  assert.equal(scoreOf(full({ acwr: 0.4 }), 'carga'), 100);
  assert.equal(scoreOf(full({ acwr: 0 }), 'carga'), 100);
});

check('carga — o teto da atenção do ACWR cai na fronteira de prontidão baixa', () => {
  assert.equal(scoreOf(full({ acwr: ACWR_BANDS.cautionMax }), 'carga'), READINESS_BANDS.lowBelow);
  assert.equal(scoreOf(full({ acwr: 2 }), 'carga'), 0);
  assert.equal(scoreOf(full({ acwr: 6 }), 'carga'), 0, 'o desconto satura em zero');
});

check('carga — sem base o componente não existe, e a cobertura cai', () => {
  const r = computeReadiness(full({ acwr: null }));
  assert.deepEqual(r.missing, ['carga']);
  assert.ok(Math.abs(r.coverage - 0.8) < 1e-9);
  assert.equal(typeof r.total, 'number', '0,8 ainda passa do piso');
});

// ─────────────────────────────────────────────────────────────
// 5. Faixas, baselines e o resto do contrato
// ─────────────────────────────────────────────────────────────

check('faixa — as fronteiras de baixo são inclusivas', () => {
  assert.equal(readinessBandOf(READINESS_BANDS.lowBelow - 1), 'low');
  assert.equal(readinessBandOf(READINESS_BANDS.lowBelow), 'moderate');
  assert.equal(readinessBandOf(READINESS_BANDS.highFrom - 1), 'moderate');
  assert.equal(readinessBandOf(READINESS_BANDS.highFrom), 'high');
  assert.equal(readinessBandOf(null), null);
  assert.equal(readinessBandOf(Number.NaN), null);
});

check('faixa — a do score acompanha o total, e some junto com ele', () => {
  const alto = computeReadiness(full());
  assert.equal(alto.band, readinessBandOf(alto.total));
  assert.equal(computeReadiness({}).band, null);
});

check('baseline — a curta viaja no componente e não pontua', () => {
  const comCurta = computeReadiness(
    full({ restingHr: 50, restingHrBaseline: 50, restingHrBaselineShort: 46 }),
  );
  const semCurta = computeReadiness(full({ restingHr: 50, restingHrBaseline: 50 }));
  const fc = comCurta.components.find((c) => c.key === 'fcRepouso')!;

  assert.equal(fc.baseline, 50);
  assert.equal(fc.baselineShort, 46);
  assert.equal(comCurta.total, semCurta.total, 'a baseline curta não pode mover a nota');
  assert.equal(semCurta.components.find((c) => c.key === 'fcRepouso')!.baselineShort, null);
});

check('baseline — sem baseline o sinal não vira componente', () => {
  // Um valor sozinho não é comparação: entrar com peso cheio marcando 50 seria
  // afirmar "está na média" sem ter média.
  const r = computeReadiness({ sleepHours: 7, restingHr: 50, hrv: 40, ringsPct: [1, 1, 1] });
  assert.deepEqual(r.missing.sort(), ['carga', 'fcRepouso', 'vfc']);
});

check('baseline — baseline zero ou negativa não divide', () => {
  const r = computeReadiness({ hrv: 40, hrvBaseline: 0, restingHr: 50, restingHrBaseline: -1 });
  assert.deepEqual(r.components, []);
  assert.equal(r.total, null);
});

check('rollingBaseline — janela, buracos e série vazia', () => {
  assert.equal(rollingBaseline([]), null);
  assert.equal(rollingBaseline([null, undefined]), null);
  assert.equal(rollingBaseline([1, 2, 3]), 2);
  // Só as últimas `window` leituras válidas entram.
  assert.equal(rollingBaseline([100, 1, 1], 2), 1);
  assert.equal(rollingBaseline([Number.NaN, 4, 6]), 5);
});

check('contrato — todo sub-score fica em 0–100, mesmo com entrada absurda', () => {
  const r = computeReadiness({
    sleepHours: 40,
    restingHr: 900,
    restingHrBaseline: 50,
    hrv: 9000,
    hrvBaseline: 40,
    ringsPct: [12, -4],
    acwr: 40,
  });
  for (const c of r.components) {
    assert.ok(c.score >= 0 && c.score <= 100, `${c.key} saiu da escala: ${c.score}`);
  }
  assert.ok(r.total !== null && r.total >= 0 && r.total <= 100);
});

check('contrato — a soma dos pesos é 1 e a proporção histórica dos quatro sobreviveu', () => {
  const r = computeReadiness(full());
  const peso = Object.fromEntries(r.components.map((c) => [c.key, c.weight]));
  assert.ok(Math.abs(Object.values(peso).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  // 30/25/25/20 multiplicados por 0,8 — as razões entre eles não mudaram.
  assert.ok(Math.abs(peso['sono']! / peso['aneis']! - 30 / 20) < 1e-9);
  assert.ok(Math.abs(peso['fcRepouso']! / peso['vfc']! - 1) < 1e-9);
});

console.log(`\n${passed} testes passaram.`);
