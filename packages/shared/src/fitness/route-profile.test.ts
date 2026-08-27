/**
 * Perfil de elevação e velocidade ao longo do percurso.
 *
 * O que estes testes protegem são as **recusas**. As duas séries devolvem `null`
 * em vez de um desenho ruim — rota sem horário por ponto não tem curva de ritmo,
 * percurso plano não tem perfil — e é essa recusa que faz a seção sumir da tela
 * em vez de mostrar uma montanha de um metro e meio esticada na altura do card.
 */

import assert from 'node:assert/strict';
import { elevationProfile, smoothSeries, speedFractions, speedSeries } from './route-profile';
import type { ActivityRoutePoint } from '../models';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

/** ~111 m por 0,001° de latitude — perto o bastante para conferir a olho. */
const DEG_PER_M = 1 / 111_320;
const T0 = Date.parse('2026-08-01T09:00:00.000Z');

/**
 * Um track sintético: um ponto por segundo, cada um `mps[i]` metros ao norte do
 * anterior. Assim a velocidade de cada segmento é exatamente `mps[i]`.
 */
function track(
  mps: number[],
  opts: { withTime?: boolean; alt?: (i: number) => number } = {},
): ActivityRoutePoint[] {
  const { withTime = true, alt } = opts;
  const pts: ActivityRoutePoint[] = [];
  let lat = 0;
  for (let i = 0; i <= mps.length; i++) {
    pts.push({
      lat,
      lng: 0,
      alt: alt ? alt(i) : undefined,
      t: withTime ? T0 + i * 1000 : undefined,
    });
    lat += (mps[i] ?? 0) * DEG_PER_M;
  }
  return pts;
}

check('smoothSeries — janela 1 ou vazio devolve a série intacta', () => {
  assert.deepEqual(smoothSeries([1, 2, 3], 1), [1, 2, 3]);
  assert.deepEqual(smoothSeries([], 5), []);
});

check('smoothSeries — a janela encolhe nas bordas em vez de inventar dado', () => {
  const out = smoothSeries([0, 0, 9, 0, 0], 3);
  assert.equal(out[0], 0, 'a primeira média usa só duas amostras, não três');
  assert.equal(out[2], 3, '(0 + 9 + 0) / 3');
  assert.equal(out.length, 5, 'suavizar não muda o comprimento');
});

check('speedSeries — devolve m/s de verdade, um por segmento', () => {
  const s = speedSeries(track(new Array(60).fill(3)))!;
  assert.equal(s.mps.length, 60, 'um valor por segmento, não por ponto');
  assert.ok(Math.abs(s.mps[30] - 3) < 0.05, `esperava ~3 m/s, veio ${s.mps[30]}`);
});

check('speedSeries — o x é a distância acumulada, crescente', () => {
  const s = speedSeries(track(new Array(60).fill(3)))!;
  assert.ok(s.xs[0] > 0, 'o primeiro segmento já andou');
  assert.ok(
    s.xs.every((x, i) => i === 0 || x > s.xs[i - 1]),
    'distância acumulada não anda para trás',
  );
  assert.ok(Math.abs(s.xs[s.xs.length - 1] - 180) < 3, '60 segmentos de 3 m ≈ 180 m');
});

check('speedSeries — sem horário por ponto não há curva, e isso é null', () => {
  assert.equal(
    speedSeries(track(new Array(60).fill(3), { withTime: false })),
    null,
    'rota antiga não ganha uma reta inventada',
  );
});

check('speedSeries — poucos pontos não viram série', () => {
  assert.equal(speedSeries(track(new Array(5).fill(3))), null);
});

check('speedFractions — é a normalização da mesma série, não uma segunda conta', () => {
  // O invariante que interessa: a ordem dos segmentos tem de sobreviver. Se as
  // duas divergirem, a arte do cartão e o gráfico do detalhe contam histórias
  // diferentes sobre o mesmo treino.
  const t = track([...new Array(30).fill(2), ...new Array(30).fill(6)]);
  const s = speedSeries(t)!;
  const fr = speedFractions(t)!;
  assert.equal(fr.length, s.mps.length);
  for (let i = 1; i < fr.length; i++) {
    const cresceu = s.mps[i] - s.mps[i - 1] > 1e-9;
    if (cresceu) assert.ok(fr[i] >= fr[i - 1], `segmento ${i} inverteu a ordem`);
  }
  assert.ok(fr.every((v) => v >= 0 && v <= 1), 'a fração vive entre 0 e 1');
});

check('speedFractions — ritmo constante cai tudo no meio da escala', () => {
  const fr = speedFractions(track(new Array(60).fill(3)))!;
  assert.ok(fr.every((v) => Math.abs(v - 0.5) < 1e-9), 'sem variação, nada a destacar');
});

check('elevationProfile — pico no meio, com xs em distância acumulada', () => {
  const prof = elevationProfile(
    track(new Array(60).fill(3), { alt: (i) => 100 + Math.min(i, 60 - i) * 2 }),
  )!;
  assert.equal(prof.ys.length, prof.xs.length, 'um y por x');
  assert.ok(prof.peakIdx > 15 && prof.peakIdx < 45, `pico fora do meio: ${prof.peakIdx}`);
  assert.ok(prof.maxAlt > prof.minAlt);
  assert.equal(prof.xs[0], 0, 'o perfil começa na largada');
});

check('elevationProfile — sem altitude não há perfil', () => {
  assert.equal(elevationProfile(track(new Array(60).fill(3))), null);
});

check('elevationProfile — percurso plano recusa em vez de esticar 1 m de desnível', () => {
  assert.equal(
    elevationProfile(track(new Array(60).fill(3), { alt: () => 12 })),
    null,
    'é esta recusa que faz a seção sumir em vez de desenhar uma montanha falsa',
  );
});

console.log(`\n${passed} testes passaram.`);
