/**
 * A atividade no eixo do **tempo** — movimento e parada, em frações.
 *
 * Existe porque o eixo natural para pendurar coisas numa pedalada nem sempre é
 * a elevação. Na travessia Rotterdam→Amsterdam de 29/08/2026 a amplitude
 * inteira do perfil é de 20,4 m em 67 km de traçado, quase toda jitter de GPS:
 * ali o relevo não distingue nada, e o scrub por elevação não tem o que dizer.
 * As 5h42 de relógio contra 2h40 de movimento, sim.
 *
 * O vão entre um trecho e outro **é** o dado: é o tempo em que a bicicleta não
 * andou. Nenhum dos apps pesquisados em 06/09/2026 desenha isso.
 *
 * Puro e sem estado — mora em `fitness/` e não em `photos/` porque descreve a
 * atividade, não a foto. As fotos só foram o motivo de alguém precisar dele.
 */

import type { ActivityRoutePoint } from '../models';
import type { RouteStop } from '../photos/stops';

export interface RailSpan {
  /** Fração do tempo total em que o trecho começa, 0–1. */
  from: number;
  /** Fração em que termina, 0–1. */
  to: number;
}

export interface TimeRail {
  startMs: number;
  endMs: number;
  /** Trechos em movimento. O que sobra entre eles é parada. */
  moving: RailSpan[];
  /** Trechos parados — os vãos, já calculados para quem quiser desenhá-los. */
  stopped: RailSpan[];
}

/**
 * O trilho de uma atividade.
 *
 * Devolve `null` quando não há tempo com que trabalhar: rota vazia, sem `t`, ou
 * início e fim no mesmo instante.
 */
export function timeRail(
  points: readonly ActivityRoutePoint[],
  stops: readonly RouteStop[],
): TimeRail | null {
  if (points.length < 2) return null;
  const startMs = points[0].t;
  const endMs = points[points.length - 1].t;
  if (startMs === undefined || endMs === undefined) return null;
  const total = endMs - startMs;
  if (total <= 0) return null;

  const frac = (ms: number) => Math.min(1, Math.max(0, (ms - startMs) / total));

  const stopped: RailSpan[] = stops
    .map((s) => ({ from: frac(s.startMs), to: frac(s.endMs) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);

  const moving: RailSpan[] = [];
  let cursor = 0;
  for (const s of stopped) {
    if (s.from > cursor) moving.push({ from: cursor, to: s.from });
    cursor = Math.max(cursor, s.to);
  }
  if (cursor < 1) moving.push({ from: cursor, to: 1 });

  return { startMs, endMs, moving, stopped };
}

/**
 * O índice do ponto na fração `f` do **tempo** (não da distância).
 *
 * É a ponte entre o trilho e o cursor do mapa: o dedo anda em tempo, e o mapa
 * precisa de um ponto. Presume `t` crescente, como toda rota gravada.
 */
export function indexAtTimeFraction(points: readonly ActivityRoutePoint[], f: number): number {
  if (points.length === 0) return 0;
  const startMs = points[0].t;
  const endMs = points[points.length - 1].t;
  if (startMs === undefined || endMs === undefined) return 0;
  const target = startMs + (endMs - startMs) * Math.min(1, Math.max(0, f));

  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid].t as number) < target) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const prev = points[lo - 1].t as number;
    const here = points[lo].t as number;
    if (Math.abs(target - prev) <= Math.abs(here - target)) return lo - 1;
  }
  return lo;
}
