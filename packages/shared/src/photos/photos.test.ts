/**
 * Fotos na pedalada — janela, paradas, casamento e agrupamento (ADR 0037).
 *
 * O que se protege aqui:
 *
 * - a folga assimétrica da janela (30 min antes, 1 h depois) — se alguém a
 *   tornar simétrica "por simetria", o café depois do stop some;
 * - a fusão de paradas contíguas, que existe por causa de um caso real: o café
 *   de 48 min do km 38,2 chegava partido em duas janelas;
 * - **a ausência de parada em saída urbana**, que é a regressão mais valiosa do
 *   arquivo. Os limiares foram calibrados em 06/09/2026 contra 8 saídas curtas
 *   de Bruxelas, Amsterdam e Zaventem (incluindo uma meia-maratona) e não
 *   produziram nenhum falso positivo — semáforo dura 1–2 min, não 4. Quem
 *   baixar o limiar quebra este teste antes de quebrar o mapa do usuário;
 * - o corredor de 40 m como fronteira dura entre "estava lá" e "caiu na janela";
 * - o caminho pelo instante, para a foto sem coordenada.
 */

import assert from 'node:assert/strict';
import type { ActivityRoutePoint } from '../models';
import { PHOTO_WINDOW_AFTER_MIN, PHOTO_WINDOW_BEFORE_MIN, photoWindow } from './window';
import {
  STOP_MIN_PAUSED_S,
  STOP_RADIUS_M,
  cumulativeDistances,
  detectStops,
  distanceScale,
} from './stops';
import { PHOTO_CORRIDOR_M, classifyCandidate, matchToRoute } from './match';
import { groupByStop } from './group';
import { indexAtTimeFraction, timeRail } from '../fitness/time-rail';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const T0 = Date.UTC(2026, 7, 29, 9, 8, 3); // 11:08 local, a largada real
/** ~1 m em latitude. */
const M = 1 / 111_320;
/**
 * ~1 m em longitude na latitude 51,9 (cos ≈ 0,617). Os traçados sintéticos
 * sobem em latitude, então deslocar a foto **para o lado** exige longitude —
 * empurrá-la em latitude só a moveria ao longo da própria rota.
 */
const MLNG = 1 / (111_320 * 0.617);

/** Traçado reto que anda `stepM` a cada `stepS`, a partir de `lat0`. */
function leg(
  from: { lat: number; ms: number },
  count: number,
  stepM: number,
  stepS: number,
): ActivityRoutePoint[] {
  const out: ActivityRoutePoint[] = [];
  for (let i = 1; i <= count; i += 1) {
    out.push({
      lat: from.lat + stepM * M * i,
      lng: 4.5,
      t: from.ms + stepS * 1000 * i,
    });
  }
  return out;
}

/** Pontos no mesmo lugar (jitter de 1 m), durante `seconds`. */
function idle(
  from: { lat: number; ms: number },
  seconds: number,
  stepS = 10,
): ActivityRoutePoint[] {
  const out: ActivityRoutePoint[] = [];
  const n = Math.floor(seconds / stepS);
  for (let i = 1; i <= n; i += 1) {
    out.push({
      lat: from.lat + (i % 2 === 0 ? M : -M),
      lng: 4.5,
      t: from.ms + stepS * 1000 * i,
    });
  }
  return out;
}

function tail(pts: ActivityRoutePoint[]): { lat: number; ms: number } {
  const last = pts[pts.length - 1];
  return { lat: last.lat, ms: last.t as number };
}

// ── Janela ──────────────────────────────────────────────

check('a janela tem folga assimétrica: 30 min antes, 1 h depois', () => {
  const start = T0;
  const end = T0 + 5.7 * 3600_000;
  const w = photoWindow(start, end);
  assert.ok(w);
  assert.equal(start - w.fromMs, 30 * 60_000, 'meia hora antes da largada');
  assert.equal(w.toMs - end, 60 * 60_000, 'uma hora depois da chegada');
  assert.equal(PHOTO_WINDOW_BEFORE_MIN, 30);
  assert.equal(PHOTO_WINDOW_AFTER_MIN, 60);
});

check('janela inválida devolve null em vez de intervalo invertido', () => {
  assert.equal(photoWindow(T0, T0 - 1000), null, 'fim antes do início');
  assert.equal(photoWindow(Number.NaN, T0), null, 'instante não numérico');
});

// ── Paradas ─────────────────────────────────────────────

check('acha as duas paradas de uma travessia com café longo', () => {
  // Espelha a forma da pedalada real: rola, para 7 min, rola, para 48 min
  // (partido em dois trechos, como o GPS entregou), rola até o fim.
  const p1 = leg({ lat: 51.947, ms: T0 }, 120, 25, 5);
  const s1 = idle(tail(p1), 7 * 60);
  const p2 = leg(tail(s1), 120, 25, 5);
  const s2a = idle(tail(p2), 13 * 60);
  const s2b = idle(tail(s2a), 34 * 60);
  const p3 = leg(tail(s2b), 120, 25, 5);
  const points = [{ lat: 51.947, lng: 4.5, t: T0 }, ...p1, ...s1, ...p2, ...s2a, ...s2b, ...p3];

  const stops = detectStops(points);
  assert.equal(stops.length, 2, 'duas paradas, não três — as contíguas fundiram');
  assert.ok(stops[0].durationS >= 6 * 60, `primeira parada curta: ${stops[0].durationS}s`);
  assert.ok(
    stops[1].durationS >= 45 * 60,
    `a segunda soma os dois trechos: ${stops[1].durationS}s`,
  );
  assert.ok(stops[0].distanceM < stops[1].distanceM, 'saem na ordem do percurso');
  assert.ok(stops[0].startMs < stops[0].endMs);
});

check('REGRESSÃO: saída urbana com semáforos não produz parada', () => {
  // Oito paradas de 90 s (semáforo) numa saída de ~11 km. Foi exatamente este
  // caso que rodou contra 8 saídas reais em 06/09/2026, com zero detecções.
  let points: ActivityRoutePoint[] = [{ lat: 50.85, lng: 4.5, t: T0 }];
  for (let i = 0; i < 8; i += 1) {
    const rolling = leg(tail(points), 60, 25, 5);
    points = [...points, ...rolling, ...idle(tail(rolling), 90)];
  }
  assert.equal(detectStops(points).length, 0, 'semáforo de 90 s não é parada');
});

check('rota sem tempo por ponto não inventa parada', () => {
  const points: ActivityRoutePoint[] = [
    { lat: 51.9, lng: 4.5 },
    { lat: 51.9, lng: 4.5 },
    { lat: 51.9, lng: 4.5 },
  ];
  assert.deepEqual(detectStops(points), [], 'sem `t` não há "quanto tempo parado"');
  assert.deepEqual(detectStops([]), []);
});

check('os limiares calibrados continuam declarados', () => {
  assert.equal(STOP_MIN_PAUSED_S, 240, '4 minutos');
  assert.equal(STOP_RADIUS_M, 60);
  assert.equal(PHOTO_CORRIDOR_M, 40);
});

// ── Casamento ───────────────────────────────────────────

/** Traçado reto de 1 km subindo em latitude, um ponto a cada 25 m. */
const straight: ActivityRoutePoint[] = Array.from({ length: 41 }, (_, i) => ({
  lat: 51.9 + i * 25 * M,
  lng: 4.5,
  t: T0 + i * 5000,
}));

/** Um traçado com exatamente uma parada — base do teste de escala. */
const withStop: ActivityRoutePoint[] = (() => {
  const head = leg({ lat: 51.9, ms: T0 }, 40, 25, 5);
  const rest = idle(tail(head), 8 * 60);
  const back = leg(tail(rest), 40, 25, 5);
  return [{ lat: 51.9, lng: 4.5, t: T0 }, ...head, ...rest, ...back];
})();

check('foto com coordenada cai no ponto certo do traçado', () => {
  // Sobre o vigésimo ponto, deslocada 10 m para o lado.
  const target = straight[20];
  const m = matchToRoute({ takenAtMs: T0, lat: target.lat, lng: target.lng + 10 * MLNG }, straight);
  assert.ok(m);
  assert.equal(m.by, 'coord');
  assert.ok(Math.abs(m.routeIndex - 20) <= 1, `índice perto de 20: ${m.routeIndex}`);
  assert.ok(m.onRoute, 'a 10 m do traçado está dentro do corredor');
  assert.ok((m.offsetM as number) < PHOTO_CORRIDOR_M);
  assert.ok(
    Math.abs(m.routeDistanceM - 500) < 30,
    `metade do quilômetro: ${m.routeDistanceM.toFixed(0)} m`,
  );
});

check('o corredor de 40 m é fronteira dura', () => {
  const anchor = straight[10];
  // 200 m **ao lado** do traçado. Deslocar em latitude apenas a moveria ao
  // longo da rota, que sobe em latitude — e ela continuaria "na rota".
  const far = matchToRoute(
    { takenAtMs: T0, lat: anchor.lat, lng: anchor.lng + 200 * MLNG },
    straight,
  );
  assert.ok(far);
  assert.equal(far.onRoute, false, 'a 200 m não estava na rota');
  assert.ok((far.offsetM as number) > PHOTO_CORRIDOR_M);
});

check('foto sem coordenada casa pelo instante, e é exato', () => {
  const m = matchToRoute({ takenAtMs: T0 + 100_000 }, straight);
  assert.ok(m);
  assert.equal(m.by, 'time');
  assert.equal(m.routeIndex, 20, '100 s a 5 s por ponto é o ponto 20');
  assert.equal(m.offsetM, null);
  assert.equal(m.onRoute, false, 'sem coordenada nunca se afirma "na rota"');
});

check('instante fora da rota prende nas pontas', () => {
  const before = matchToRoute({ takenAtMs: T0 - 3600_000 }, straight);
  const after = matchToRoute({ takenAtMs: T0 + 3600_000 }, straight);
  assert.equal(before?.routeIndex, 0);
  assert.equal(after?.routeIndex, straight.length - 1);
});

check('sem coordenada e sem tempo não há como posicionar', () => {
  const noTime: ActivityRoutePoint[] = [
    { lat: 51.9, lng: 4.5 },
    { lat: 51.91, lng: 4.5 },
  ];
  assert.equal(matchToRoute({ takenAtMs: T0 }, noTime), null);
  assert.equal(matchToRoute({ takenAtMs: T0 }, []), null);
});

check('a distância acumulada bate com a geometria', () => {
  const cum = cumulativeDistances(straight);
  assert.equal(cum[0], 0);
  assert.ok(Math.abs(cum[cum.length - 1] - 1000) < 10, `~1 km: ${cum[cum.length - 1].toFixed(0)}`);
});

check('o km é reescalado para a distância oficial da atividade', () => {
  // O track cru mede ~1 000 m; a atividade diz 850 m (jitter de GPS). O caso
  // real: Rotterdam→Amsterdam soma 67,3 km ponto a ponto contra 57,05 km
  // gravados. Sem isto, o cartão de fotos e o cabeçalho não conversam.
  assert.equal(distanceScale(1000, 850), 0.85);
  assert.equal(distanceScale(1000, undefined), 1, 'sem referência não se inventa escala');
  assert.equal(distanceScale(0, 850), 1, 'track vazio não divide por zero');

  const target = straight[20];
  const raw = matchToRoute({ takenAtMs: T0, lat: target.lat, lng: target.lng }, straight);
  const scaled = matchToRoute(
    { takenAtMs: T0, lat: target.lat, lng: target.lng },
    straight,
    { totalDistanceM: 850 },
  );
  assert.ok(raw && scaled);
  // O ponto 20 é o meio exato dos 40 segmentos, então na escala de 850 m ele
  // tem de cair em 425 — independente de quanto o track cru mediu.
  assert.ok(
    Math.abs(scaled.routeDistanceM - 425) < 0.01,
    `meio do percurso reescalado: ${scaled.routeDistanceM.toFixed(3)}`,
  );
  assert.ok(scaled.routeDistanceM < raw.routeDistanceM, 'a escala encolheu o km cru');
  assert.equal(scaled.routeIndex, raw.routeIndex, 'o índice no traçado não muda');

  const stopsRaw = detectStops(withStop);
  const stopsScaled = detectStops(withStop, { totalDistanceM: 850 });
  const rawTotal = cumulativeDistances(withStop).at(-1) as number;
  assert.ok(
    Math.abs(stopsScaled[0].distanceM - stopsRaw[0].distanceM * (850 / rawTotal)) < 0.001,
    'a parada usa exatamente a mesma escala da foto',
  );
});

// ── Grupos da folha ─────────────────────────────────────

check('os quatro grupos da folha de confirmação', () => {
  const activity = { startAtMs: T0, endAtMs: T0 + 3600_000 };
  const onRoute = { routeIndex: 1, routeDistanceM: 10, offsetM: 5, onRoute: true, by: 'coord' as const };
  const offRoute = { routeIndex: 1, routeDistanceM: 10, offsetM: 500, onRoute: false, by: 'coord' as const };

  assert.equal(classifyCandidate(T0 - 60_000, onRoute, activity), 'before');
  assert.equal(classifyCandidate(T0 + 3660_000, onRoute, activity), 'after');
  assert.equal(classifyCandidate(T0 + 60_000, onRoute, activity), 'on-route');
  assert.equal(
    classifyCandidate(T0 + 60_000, offRoute, activity),
    'off-route',
    'no meio da pedalada mas longe do traçado não é "depois da chegada"',
  );
  assert.equal(
    classifyCandidate(T0 + 60_000, null, activity),
    'off-route',
    'sem casamento não se afirma que estava na rota',
  );
});

// ── Agrupamento ─────────────────────────────────────────

check('as fotos caem na parada que estava acontecendo', () => {
  const stops = [
    { startIdx: 0, endIdx: 1, startMs: T0 + 1000, endMs: T0 + 5000, durationS: 4, lat: 51.9, lng: 4.5, distanceM: 100 },
    { startIdx: 2, endIdx: 3, startMs: T0 + 9000, endMs: T0 + 12_000, durationS: 3, lat: 51.95, lng: 4.5, distanceM: 900 },
  ];
  const photos = [
    { takenAtMs: T0 + 11_000, id: 'd' },
    { takenAtMs: T0 + 2000, id: 'a' },
    { takenAtMs: T0 + 7000, id: 'c' },
    { takenAtMs: T0 + 3000, id: 'b' },
  ];
  const g = groupByStop(photos, stops);

  assert.equal(g.stops.length, 2);
  assert.deepEqual(g.stops[0].photos.map((p) => p.id), ['a', 'b'], 'em ordem cronológica');
  assert.deepEqual(g.stops[1].photos.map((p) => p.id), ['d']);
  assert.deepEqual(g.moving.map((p) => p.id), ['c'], 'a de fora ficou em movimento');
  assert.equal(g.stops[0].stop.distanceM, 100, 'a parada viaja junto com suas fotos');
});

check('parada sem foto não aparece, e pedalada sem foto não quebra', () => {
  const stops = [
    { startIdx: 0, endIdx: 1, startMs: T0, endMs: T0 + 1000, durationS: 1, lat: 51.9, lng: 4.5, distanceM: 0 },
  ];
  const empty = groupByStop([], stops);
  assert.deepEqual(empty.stops, [], 'o cartão lista lugares com foto, não paradas');
  assert.deepEqual(empty.moving, []);

  const noStops = groupByStop([{ takenAtMs: T0 }], []);
  assert.equal(noStops.moving.length, 1, 'sem parada, tudo é movimento');
});

// ── Trilho do tempo ─────────────────────────────────────

check('o trilho separa movimento de parada, e o vão é o dado', () => {
  const rail = timeRail(withStop, detectStops(withStop));
  assert.ok(rail);
  assert.equal(rail.stopped.length, 1, 'uma parada');
  assert.equal(rail.moving.length, 2, 'ela parte o movimento em dois');
  assert.ok(rail.moving[0].to === rail.stopped[0].from, 'o vão começa onde o movimento para');
  assert.ok(rail.stopped[0].to === rail.moving[1].from, 'e termina onde ele volta');
  assert.equal(rail.moving[0].from, 0);
  assert.equal(rail.moving[1].to, 1);
});

check('pedalada sem parada é um trecho só', () => {
  const rail = timeRail(straight, []);
  assert.ok(rail);
  assert.deepEqual(rail.moving, [{ from: 0, to: 1 }]);
  assert.deepEqual(rail.stopped, []);
});

check('sem tempo não há trilho', () => {
  assert.equal(timeRail([{ lat: 51.9, lng: 4.5 }, { lat: 51.91, lng: 4.5 }], []), null);
  assert.equal(timeRail([], []), null);
});

check('a fração de tempo vira índice no traçado', () => {
  assert.equal(indexAtTimeFraction(straight, 0), 0);
  assert.equal(indexAtTimeFraction(straight, 1), straight.length - 1);
  assert.equal(indexAtTimeFraction(straight, 0.5), 20, 'meio do tempo, ponto do meio');
});

console.log(`\n${passed} testes passaram.`);
