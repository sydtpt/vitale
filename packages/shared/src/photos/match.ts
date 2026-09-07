/**
 * Onde a foto cai no traçado (ADR 0037).
 *
 * Há dois caminhos, e o app usa o melhor disponível para cada foto:
 *
 * 1. **Pela coordenada** — projeção no segmento mais próximo da polilinha.
 *    É o caminho robusto: sobrevive a pausa, desvio e volta pelo mesmo lugar.
 *    Depende do "Local" estar ligado na câmera (está, conferido em 06/09/2026).
 * 2. **Pelo instante** — busca binária em `points[].t`. É **exato**, não
 *    proporcional: a conferência de 06/09/2026 encontrou `t` em 275 de 275
 *    rotas de produção, então não existe a regra de três frágil que o pedido
 *    original supunha, nem a necessidade do "Timeshift" que o Garmin BaseCamp
 *    teve de inventar — a foto e a rota vêm do mesmo relógio, o do iPhone.
 *
 * O corredor de 40 m é o que separa "estava lá" de "só caiu na janela": a foto
 * de um documento tirada em casa quase nunca está a 40 m da rota. Para
 * comparação, o passe de piso casa contra o OSM com raio de 25 m e obtém
 * mediana de 1,6 m (ADR 0035) — 40 m dá folga ao GPS urbano sem deixar entrar
 * o que não estava na pedalada.
 */

import type { ActivityRoutePoint } from '../models';
import { haversineM } from '../geo/distance';
import { cumulativeDistances, distanceScale } from './stops';

/** Distância máxima ao traçado para a foto contar como "na rota". */
export const PHOTO_CORRIDOR_M = 40;

export interface PhotoCandidate {
  takenAtMs: number;
  lat?: number | null;
  lng?: number | null;
}

export interface PhotoMatch {
  /** Índice do ponto de `points` que representa a foto. */
  routeIndex: number;
  /** Distância acumulada até a foto, em metros — o "km 38,2" da tela. */
  routeDistanceM: number;
  /** Distância da foto ao traçado. `null` quando casou pelo instante. */
  offsetM: number | null;
  /** `offsetM <= corridorM`. Sempre `false` quando não houve coordenada. */
  onRoute: boolean;
  by: 'coord' | 'time';
}

export interface MatchOptions {
  corridorM?: number;
  /**
   * `activities.distance_m`. Reescala o `routeDistanceM` devolvido para a
   * distância oficial da atividade — ver `StopOptions.totalDistanceM`, que
   * existe pelo mesmo motivo e precisa da mesma escala, ou o mapa e o cartão
   * de fotos passam a discordar entre si.
   */
  totalDistanceM?: number;
}

/** Metros por grau de longitude na latitude dada — a escala do plano local. */
function lngScale(lat: number): number {
  return Math.cos((lat * Math.PI) / 180);
}

/**
 * Projeção do ponto no segmento, em graus escalados para metros.
 * Devolve a fração ao longo do segmento, presa em [0, 1].
 */
function projectionT(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
  k: number,
): number {
  const vx = (bLng - aLng) * k;
  const vy = bLat - aLat;
  const wx = (pLng - aLng) * k;
  const wy = pLat - aLat;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return 0;
  const t = (wx * vx + wy * vy) / len2;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Índice do ponto cujo `t` é o mais próximo de `atMs`. Presume `t` crescente. */
function indexAtTime(points: readonly ActivityRoutePoint[], atMs: number): number {
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((points[mid].t as number) < atMs) lo = mid + 1;
    else hi = mid;
  }
  // `lo` é o primeiro ponto >= atMs; o vizinho anterior pode estar mais perto.
  if (lo > 0) {
    const prev = points[lo - 1].t as number;
    const here = points[lo].t as number;
    if (Math.abs(atMs - prev) <= Math.abs(here - atMs)) return lo - 1;
  }
  return lo;
}

/**
 * Casa uma foto com o traçado.
 *
 * Devolve `null` quando não há como posicionar: rota vazia, ou foto sem
 * coordenada numa rota sem `t`. Nesse caso a foto continua ligada à atividade —
 * ela só não ganha lugar no mapa nem no trilho.
 */
export function matchToRoute(
  photo: PhotoCandidate,
  points: readonly ActivityRoutePoint[],
  opts: MatchOptions = {},
): PhotoMatch | null {
  if (points.length === 0) return null;
  const corridorM = opts.corridorM ?? PHOTO_CORRIDOR_M;

  const hasCoord =
    typeof photo.lat === 'number' &&
    typeof photo.lng === 'number' &&
    Number.isFinite(photo.lat) &&
    Number.isFinite(photo.lng);

  if (hasCoord) {
    const cum = cumulativeDistances(points);
    const pLat = photo.lat as number;
    const pLng = photo.lng as number;
    const k = lngScale(pLat);

    const scale = distanceScale(cum[cum.length - 1], opts.totalDistanceM);

    if (points.length === 1) {
      const offsetM = haversineM(pLat, pLng, points[0].lat, points[0].lng);
      return {
        routeIndex: 0,
        routeDistanceM: 0,
        offsetM,
        onRoute: offsetM <= corridorM,
        by: 'coord',
      };
    }

    let bestDist = Infinity;
    let bestIdx = 0;
    let bestAlong = 0;

    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const t = projectionT(pLat, pLng, a.lat, a.lng, b.lat, b.lng, k);
      const projLat = a.lat + (b.lat - a.lat) * t;
      const projLng = a.lng + (b.lng - a.lng) * t;
      const d = haversineM(pLat, pLng, projLat, projLng);
      if (d < bestDist) {
        bestDist = d;
        // O índice é o vértice ao qual a projeção está mais perto: é ele que o
        // mapa e o trilho desenham, e meio segmento de erro no ponteiro seria
        // visível num traçado de 25 m entre pontos.
        bestIdx = t > 0.5 ? i + 1 : i;
        bestAlong = cum[i] + (cum[i + 1] - cum[i]) * t;
      }
    }

    return {
      routeIndex: bestIdx,
      routeDistanceM: bestAlong * scale,
      offsetM: bestDist,
      onRoute: bestDist <= corridorM,
      by: 'coord',
    };
  }

  if (points[0]?.t === undefined) return null;

  const cum = cumulativeDistances(points);
  const idx = indexAtTime(points, photo.takenAtMs);
  return {
    routeIndex: idx,
    routeDistanceM: cum[idx] * distanceScale(cum[cum.length - 1], opts.totalDistanceM),
    offsetM: null,
    onRoute: false,
    by: 'time',
  };
}

/**
 * O grupo em que a foto aparece na folha de confirmação.
 *
 * São quatro, e não os três do mockup, por honestidade: uma foto tirada no meio
 * da pedalada mas a 500 m do traçado (a tela de um computador, um documento)
 * não é "depois da chegada". A folha junta `after` e `off-route` sob o mesmo
 * rótulo quando a foto é de fato posterior, e mostra `off-route` como linha
 * própria quando ela cai no meio — o mockup já dizia "fora da rota" na legenda.
 *
 * Só `on-route` vem ligado por padrão.
 */
export type CandidateGroup = 'on-route' | 'off-route' | 'before' | 'after';

export function classifyCandidate(
  takenAtMs: number,
  match: PhotoMatch | null,
  activity: { startAtMs: number; endAtMs: number },
): CandidateGroup {
  if (takenAtMs < activity.startAtMs) return 'before';
  if (takenAtMs > activity.endAtMs) return 'after';
  return match?.onRoute ? 'on-route' : 'off-route';
}
