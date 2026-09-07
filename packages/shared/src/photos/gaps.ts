/**
 * Os buracos do traçado — os trechos em que o GPS não gravou (ADR 0037).
 *
 * ## Por que isto existe
 *
 * Conferido em 07/09/2026, na travessia Rotterdam→Amsterdam: 12 fotos entre
 * 12:55 e 13:01, todas no mesmo lugar, e o app dizia **"Em movimento · sem
 * parada"**. O traçado tem **12 buracos**, e um deles vai de 12:54:18 a
 * 13:29:52 — 35 minutos e 6,3 km entre dois pontos consecutivos.
 *
 * `detectStops` mede "ficou parado" contando pontos; onde não há pontos, ele
 * não acha nada — e o silêncio virava a afirmação de que não houve parada.
 * São coisas diferentes: **não saber** não é **saber que não**.
 *
 * ## O que os buracos dizem
 *
 * - Buraco com as pontas **próximas** já vira parada pelo caminho normal: os
 *   dois pontos estão dentro do raio e o tempo entre eles conta. Nada a fazer.
 * - Buraco com as pontas **longe** é ignorância pura: houve deslocamento, e
 *   nada entre um ponto e outro é conhecido. A polilinha ali é uma reta que
 *   ninguém pedalou.
 *
 * Uma foto que cai num buraco desses ainda tem lugar — a coordenada dela é
 * própria, não interpolada —, mas o **período** em volta dela não pode ser
 * chamado de movimento.
 */

import type { ActivityRoutePoint } from '../models';
import { haversineM } from '../geo/distance';

/**
 * Intervalo mínimo entre pontos para contar como buraco.
 *
 * Dois minutos: acima do maior intervalo normal de amostragem (o relógio
 * espaça, o túnel engole alguns segundos) e abaixo do menor silêncio que
 * significa alguma coisa.
 */
export const GAP_MIN_S = 120;

export interface TrackGap {
  fromIdx: number;
  toIdx: number;
  fromMs: number;
  toMs: number;
  durationS: number;
  /** Distância entre as duas pontas. Grande ⇒ houve deslocamento não gravado. */
  spanM: number;
}

/**
 * Os buracos do traçado.
 *
 * Devolve **todos**, inclusive os de pontas próximas — quem quiser só a
 * ignorância filtra por `spanM`. Rota sem `t` não tem buraco que se possa
 * afirmar: devolve vazio.
 */
export function trackGaps(
  points: readonly ActivityRoutePoint[],
  opts: { minGapS?: number } = {},
): TrackGap[] {
  if (points.length < 2 || points[0]?.t === undefined) return [];
  const minGapS = opts.minGapS ?? GAP_MIN_S;

  const out: TrackGap[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    if (a.t === undefined || b.t === undefined) continue;
    const durationS = (b.t - a.t) / 1000;
    if (durationS < minGapS) continue;
    out.push({
      fromIdx: i - 1,
      toIdx: i,
      fromMs: a.t,
      toMs: b.t,
      durationS,
      spanM: haversineM(a.lat, a.lng, b.lat, b.lng),
    });
  }
  return out;
}

/**
 * O buraco que engole este instante, se houver.
 *
 * `radiusM` separa o buraco que **já é parada** (pontas próximas, tratado pelo
 * `detectStops`) daquele que é só ignorância. Só o segundo interessa aqui.
 */
export function gapAt(
  gaps: readonly TrackGap[],
  atMs: number,
  radiusM = 60,
): TrackGap | null {
  for (const g of gaps) {
    if (g.spanM <= radiusM) continue;
    if (atMs > g.fromMs && atMs < g.toMs) return g;
  }
  return null;
}
