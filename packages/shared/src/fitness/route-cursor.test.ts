/**
 * A régua que liga o gráfico ao mapa.
 *
 * O que estes testes protegem é o **alinhamento**: que a distância onde o dedo
 * parou vire o ponto certo do mapa mesmo quando os três arrays têm comprimentos
 * diferentes. Um perfil de elevação só enxerga os pontos com `alt`, e o jeito
 * fácil de escrever isto — usar o índice do perfil para indexar `points` —
 * funciona no track sintético em que todo ponto tem altitude e erra calado no
 * track real, cada vez mais para o fim do percurso.
 */

import assert from 'node:assert/strict';
import { elevationProfile, speedSeries } from './route-profile';
import { indexAtDistance, routeCursorAt, routeDistances } from './route-cursor';
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

/** Track de `n+1` pontos, um por segundo, andando `stepM` ao norte a cada um. */
function track(
  n: number,
  opts: { stepM?: number; alt?: (i: number) => number | undefined } = {},
): ActivityRoutePoint[] {
  const { stepM = 10, alt } = opts;
  const pts: ActivityRoutePoint[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push({
      lat: i * stepM * DEG_PER_M,
      lng: 0,
      alt: alt ? alt(i) : undefined,
      t: T0 + i * 1000,
    });
  }
  return pts;
}

/* ─────────────── indexAtDistance ─────────────── */

check('encaixa no vizinho mais próximo, não no da esquerda', () => {
  const xs = [0, 10, 20, 30];
  assert.equal(indexAtDistance(xs, 14), 1, '14 está mais perto de 10');
  assert.equal(indexAtDistance(xs, 16), 2, '16 está mais perto de 20');
  assert.equal(indexAtDistance(xs, 15), 1, 'empate fica com o de trás');
});

check('fora das pontas encaixa na ponta, sem estourar', () => {
  const xs = [0, 10, 20];
  assert.equal(indexAtDistance(xs, -500), 0);
  assert.equal(indexAtDistance(xs, 99_999), 2);
});

check('array vazio devolve -1 em vez de fingir um índice', () => {
  assert.equal(indexAtDistance([], 10), -1);
});

check('acha o mesmo que a varredura linear, ponto a ponto', () => {
  // A busca binária é a única parte com aritmética de índice; conferir contra a
  // versão óbvia é o que garante que ela não erra por um.
  const xs = routeDistances(track(500));
  for (let x = 0; x < 5100; x += 37) {
    let want = 0;
    for (let i = 1; i < xs.length; i++) {
      if (Math.abs(xs[i] - x) < Math.abs(xs[want] - x)) want = i;
    }
    assert.equal(indexAtDistance(xs, x), want, `x=${x}`);
  }
});

/* ─────────────── routeDistances ─────────────── */

check('a distância acumulada começa em zero e cresce', () => {
  const d = routeDistances(track(10));
  assert.equal(d[0], 0);
  assert.ok(Math.abs(d[10] - 100) < 1, `100 m esperados, ${d[10].toFixed(1)}`);
  for (let i = 1; i < d.length; i++) assert.ok(d[i] > d[i - 1], `caiu em ${i}`);
});

check('rota vazia não quebra', () => {
  assert.deepEqual(routeDistances([]), []);
});

/* ─────────────── routeCursorAt ─────────────── */

check('o cursor cai no ponto do mapa correspondente à distância', () => {
  const pts = track(100, { alt: (i) => 100 + i });
  const d = routeDistances(pts);
  const cur = routeCursorAt(pts, d, 500, elevationProfile(pts), speedSeries(pts));
  assert.ok(cur, 'devia haver cursor');
  assert.equal(cur.index, 50, '500 m com passo de 10 m é o ponto 50');
  assert.equal(cur.lat, pts[50].lat);
  assert.ok(Math.abs(cur.distanceM - 500) < 1);
});

/**
 * O caso que o índice ingênuo erra. Metade dos pontos vem sem `alt`, então o
 * perfil tem ~metade do comprimento de `points`: usar o índice de um no outro
 * apontaria para o meio do percurso quando o dedo está no fim.
 */
check('acerta o ponto mesmo com metade da rota sem altitude', () => {
  const pts = track(200, { alt: (i) => (i % 2 === 0 ? 100 + i : undefined) });
  const d = routeDistances(pts);
  const prof = elevationProfile(pts);
  assert.ok(prof, 'o perfil devia existir');
  assert.ok(prof.ys.length < pts.length / 2 + 2, 'o perfil é mesmo mais curto');

  const cur = routeCursorAt(pts, d, 1900, prof, speedSeries(pts));
  assert.ok(cur);
  assert.equal(cur.index, 190, 'o índice é o de `points`, não o do perfil');
  assert.equal(cur.lat, pts[190].lat);
  assert.ok(cur.altM !== null && cur.altM > 200, `altitude do fim, veio ${cur.altM}`);
});

check('percurso plano devolve cursor sem altitude, e o mapa segue funcionando', () => {
  const pts = track(100, { alt: () => 42 });
  const d = routeDistances(pts);
  const cur = routeCursorAt(pts, d, 300, elevationProfile(pts), speedSeries(pts));
  assert.ok(cur);
  assert.equal(cur.altM, null, 'sem perfil, sem altitude');
  assert.ok(cur.mps !== null, 'mas a velocidade continua lá');
  assert.equal(cur.index, 30);
});

check('rota sem horário devolve cursor sem velocidade', () => {
  const pts = track(100, { alt: (i) => 100 + i }).map((p) => ({ ...p, t: undefined }));
  const d = routeDistances(pts);
  const cur = routeCursorAt(pts, d, 300, elevationProfile(pts), speedSeries(pts));
  assert.ok(cur);
  assert.equal(cur.mps, null);
  assert.ok(cur.altM !== null);
});

check('rota vazia devolve null em vez de um cursor inventado', () => {
  assert.equal(routeCursorAt([], [], 0, null, null), null);
});

check('as pontas do arrasto não estouram o array', () => {
  const pts = track(50, { alt: (i) => 100 + i });
  const d = routeDistances(pts);
  const prof = elevationProfile(pts);
  const spd = speedSeries(pts);
  for (const x of [-1000, 0, d[d.length - 1], 1e9]) {
    const cur = routeCursorAt(pts, d, x, prof, spd);
    assert.ok(cur, `x=${x}`);
    assert.ok(cur.index >= 0 && cur.index < pts.length, `índice fora em x=${x}`);
    assert.equal(typeof cur.lat, 'number');
  }
});

console.log(`\n${passed} testes passaram.`);
