/**
 * A régua que liga o gráfico ao mapa.
 *
 * O dedo (ou o mouse) para numa distância do percurso e três coisas precisam
 * responder ao mesmo tempo: onde isso fica no mapa, qual era a altitude e qual
 * era a velocidade. Os três vivem em arrays diferentes — `points` tem a
 * geografia, `ElevationProfile` só as amostras **com altitude**, `SpeedSeries`
 * os segmentos — e o que eles têm em comum é o eixo x: distância acumulada
 * desde a largada, em metros.
 *
 * Por isso a busca é por distância e não por índice. Um índice de `profile.ys`
 * não é um índice de `points` sempre que algum ponto vier sem `alt`, e usar um
 * no lugar do outro erra silenciosamente — devagar no começo do percurso e cada
 * vez mais para o fim.
 *
 * **Encaixa no ponto gravado, não interpola.** Com um ponto a cada poucos
 * segundos a granularidade fica em dezenas de metros, invisível no mapa, e o
 * marcador cai sempre em cima da rota desenhada em vez de flutuar ao lado dela
 * nas curvas.
 */
import type { ActivityRoutePoint } from '../models';
import { haversineM } from '../geo/distance';
import type { ElevationProfile, SpeedSeries } from './route-profile';

/** Onde o cursor está, com o que se lê naquele ponto. */
export interface RouteCursor {
  /** Índice em `points` — o mesmo array que o mapa desenhou. */
  index: number;
  lat: number;
  lng: number;
  /** Distância acumulada (m) até aqui. */
  distanceM: number;
  /** Altitude suavizada (m), ou `null` quando a rota não tem perfil. */
  altM: number | null;
  /** Velocidade suavizada (m/s), ou `null` quando a rota não tem horário. */
  mps: number | null;
}

/**
 * Distância acumulada (m) em cada ponto — o primeiro é sempre 0.
 *
 * Vale calcular uma vez e guardar: são milhares de haversines, e o scrub
 * chama a busca a cada quadro do arrasto.
 */
export function routeDistances(points: readonly ActivityRoutePoint[]): number[] {
  const out = new Array<number>(points.length);
  if (points.length === 0) return out;
  out[0] = 0;
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1] + haversineM(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  return out;
}

/**
 * Índice da amostra mais próxima de `x` num array **crescente** de distâncias.
 *
 * Busca binária: o arrasto consulta isto a cada quadro, em três arrays, e uma
 * varredura linear sobre milhares de pontos apareceria como travada no dedo.
 * Devolve `-1` para array vazio; fora das pontas, encaixa na ponta.
 */
export function indexAtDistance(xs: readonly number[], x: number): number {
  if (xs.length === 0) return -1;
  if (x <= xs[0]) return 0;
  if (x >= xs[xs.length - 1]) return xs.length - 1;

  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  // Entre dois vizinhos, o mais próximo — e não sempre o da esquerda, senão o
  // marcador fica meio ponto atrás do dedo o percurso inteiro.
  return x - xs[lo] <= xs[hi] - x ? lo : hi;
}

/**
 * O cursor na distância `xM`, pronto para o mapa e para os rótulos.
 *
 * `null` só quando não há por onde começar (rota vazia). Um percurso plano
 * devolve cursor com `altM: null`, uma rota antiga sem horário devolve
 * `mps: null` — quem desenha some com o painel correspondente, e o mapa
 * continua funcionando com o outro.
 */
export function routeCursorAt(
  points: readonly ActivityRoutePoint[],
  distances: readonly number[],
  xM: number,
  profile: ElevationProfile | null,
  speed: SpeedSeries | null,
): RouteCursor | null {
  const i = indexAtDistance(distances, xM);
  if (i < 0) return null;

  const altIdx = profile ? indexAtDistance(profile.xs, xM) : -1;
  const spdIdx = speed ? indexAtDistance(speed.xs, xM) : -1;

  return {
    index: i,
    lat: points[i].lat,
    lng: points[i].lng,
    distanceM: distances[i],
    altM: profile && altIdx >= 0 ? profile.ys[altIdx] : null,
    mps: speed && spdIdx >= 0 ? speed.mps[spdIdx] : null,
  };
}
