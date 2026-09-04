/**
 * Subidas.
 *
 * O que se protege aqui: a tolerância à queda curta (subida de verdade tem
 * respiro), os três pisos, a retomada no pico (que impede a mesma rampa virar
 * duas subidas encavaladas) e a distinção entre ganho acumulado e ganho em
 * subida — a razão de ser do módulo.
 */

import assert from 'node:assert/strict';
import { CLIMB_MIN_GAIN_M, CLIMB_TOLERATED_DROP_M, findClimbs } from './climbs';
import type { ElevationProfile } from './route-profile';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** Perfil a partir das altitudes, com passo constante de `stepM` metros. */
function profile(ys: number[], stepM = 100): ElevationProfile {
  const xs = ys.map((_, i) => i * stepM);
  let peakIdx = 0;
  let minAlt = ys[0];
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] > ys[peakIdx]) peakIdx = i;
    if (ys[i] < minAlt) minAlt = ys[i];
  }
  return { xs, ys, peakIdx, maxAlt: ys[peakIdx], minAlt };
}

/** Rampa de `n` passos ganhando `perStep` metros cada, a partir de `from`. */
function ramp(from: number, n: number, perStep: number): number[] {
  return Array.from({ length: n }, (_, i) => from + (i + 1) * perStep);
}

check('perfil nulo devolve resumo vazio, sem lançar', () => {
  const r = findClimbs(null);
  assert.deepEqual(r.climbs, []);
  assert.equal(r.climbGainM, 0);
  assert.equal(r.profileGainM, 0);
});

check('perfil de um ponto só não tem subida', () => {
  assert.deepEqual(findClimbs(profile([100])).climbs, []);
});

check('uma rampa contínua vira uma subida', () => {
  // 10 passos de 100 m ganhando 5 m cada: 1000 m, +50 m, 5%.
  const r = findClimbs(profile([100, ...ramp(100, 10, 5)]));
  assert.equal(r.climbs.length, 1);
  const c = r.climbs[0];
  assert.equal(Math.round(c.gainM), 50);
  assert.equal(Math.round(c.lengthM), 1000);
  assert.equal(Math.round(c.gradePct * 10) / 10, 5);
  assert.equal(Math.round(c.score), 250);
});

check('terreno plano não produz subida', () => {
  assert.deepEqual(findClimbs(profile([100, 100, 100, 100, 100])).climbs, []);
});

check('ganho abaixo do piso é ignorado', () => {
  // +20 m, abaixo dos 25 do padrão.
  const r = findClimbs(profile([100, ...ramp(100, 10, 2)]));
  assert.deepEqual(r.climbs, []);
  assert.ok(r.profileGainM > 0, 'o ganho do perfil continua contado');
});

check('inclinação abaixo do piso é ignorada, mesmo com ganho alto', () => {
  // +40 m em 20 km = 0,2%: sobe bastante, mas não é subida.
  const r = findClimbs(profile([100, ...ramp(100, 20, 2)], 1000));
  assert.deepEqual(r.climbs, []);
});

check('queda curta no meio não encerra a subida', () => {
  // Sobe 30, cai 5 (dentro da tolerância de 8), sobe mais 30.
  const ys = [100, ...ramp(100, 6, 5), 125, ...ramp(125, 6, 5)];
  const r = findClimbs(profile(ys));
  assert.equal(r.climbs.length, 1, 'uma subida só, não duas');
  assert.ok(r.climbs[0].gainM > 50, `ganho ${r.climbs[0].gainM} atravessa o respiro`);
});

check('queda maior que a tolerância separa duas subidas', () => {
  const drop = CLIMB_TOLERATED_DROP_M + 20;
  const ys = [100, ...ramp(100, 8, 5), 140 - drop, ...ramp(140 - drop, 8, 5)];
  const r = findClimbs(profile(ys));
  assert.equal(r.climbs.length, 2);
});

check('a lista sai ordenada por score', () => {
  // Uma subida curta e íngreme, outra longa e suave.
  const ys = [100, ...ramp(100, 4, 15), 160, 130, ...ramp(130, 20, 4)];
  const r = findClimbs(profile(ys));
  assert.ok(r.climbs.length >= 2);
  for (let i = 1; i < r.climbs.length; i++) {
    assert.ok(r.climbs[i - 1].score >= r.climbs[i].score, 'score decrescente');
  }
});

check('os índices apontam para o próprio perfil', () => {
  const p = profile([100, ...ramp(100, 10, 5)]);
  const c = findClimbs(p).climbs[0];
  assert.equal(p.xs[c.startIdx], c.startM);
  assert.equal(p.xs[c.endIdx], c.endM);
  assert.equal(Math.round(p.ys[c.endIdx] - p.ys[c.startIdx]), Math.round(c.gainM));
});

check('subidas não se sobrepõem', () => {
  const ys = [100, ...ramp(100, 8, 5), 110, ...ramp(110, 8, 5), 120, ...ramp(120, 8, 5)];
  const r = findClimbs(profile(ys));
  const ordered = [...r.climbs].sort((a, b) => a.startIdx - b.startIdx);
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(ordered[i].startIdx >= ordered[i - 1].endIdx, 'a próxima começa no pico da anterior ou depois');
  }
});

check('ganho em subida é menor que o ganho do perfil em terreno ondulado', () => {
  // O achado que motiva o módulo: sobe-e-desce acumula ganho sem escalar nada.
  const ys: number[] = [100];
  for (let i = 0; i < 30; i++) ys.push(ys[ys.length - 1] + (i % 2 === 0 ? 6 : -5));
  const r = findClimbs(profile(ys));
  assert.deepEqual(r.climbs, [], 'nenhum trecho passa nos pisos');
  assert.ok(r.profileGainM > 80, `ganho acumulado ${r.profileGainM} é alto`);
  assert.equal(r.climbGainM, 0, 'e nada disso é subida');
});

check('climbGainM soma o ganho das subidas encontradas', () => {
  const ys = [100, ...ramp(100, 10, 5), 120, ...ramp(120, 10, 5)];
  const r = findClimbs(profile(ys));
  const soma = r.climbs.reduce((s, c) => s + c.gainM, 0);
  assert.equal(Math.round(r.climbGainM), Math.round(soma));
  assert.ok(r.climbGainM <= r.profileGainM, 'nunca passa do ganho do perfil');
});

check('opções afrouxam e apertam os pisos', () => {
  const p = profile([100, ...ramp(100, 10, 2)]); // +20 m, abaixo do padrão
  assert.deepEqual(findClimbs(p).climbs, []);
  assert.equal(findClimbs(p, { minGainM: 15, minGradePct: 1 }).climbs.length, 1);
});

check('opção inválida cai no padrão em vez de zerar o piso', () => {
  const p = profile([100, ...ramp(100, 10, 2)]);
  for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      findClimbs(p, { minGainM: bad }).climbs,
      [],
      `minGainM ${bad} não pode virar piso zero`,
    );
  }
  assert.equal(CLIMB_MIN_GAIN_M, 25, 'o padrão continua declarado');
});

console.log(`\n${passed} testes passaram.`);
