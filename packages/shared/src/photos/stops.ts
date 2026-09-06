/**
 * As paradas de uma rota — a unidade de agrupamento das fotos (ADR 0037 §3).
 *
 * A tese vem da pesquisa competitiva de 06/09/2026: o Relive começou colocando
 * cada foto no ponto exato em que foi tirada e teve de recuar, porque o vídeo
 * "parava a cada 2–3 segundos"; hoje agrupa de propósito. O dono do app quase
 * sempre PARA para fotografar, então doze fotos numa pedalada não são doze
 * lugares — são duas ou três paradas e alguns cliques em movimento.
 *
 * Agrupar resolve os dois extremos com um desenho só: 34 fotos viram quatro
 * marcadores legíveis, e 2 fotos continuam dois pontos. Sem modo especial.
 *
 * **A parada não é persistida.** É derivada de `points`, determinística e
 * barata; gravá-la seria cache com risco de divergir quando a rota for
 * reprocessada. Mudar os limiares aqui não pede migration.
 *
 * ## Calibração (06/09/2026)
 *
 * Os limiares foram medidos contra produção, não escolhidos no olho:
 *
 * - Na travessia Rotterdam→Amsterdam de 29/08 (5h42 de relógio para 2h40 de
 *   movimento), 4 min dentro de 60 m encontrou exatamente as duas paradas
 *   reais — 13:33–13:40 no km 24,6 e 14:20–15:08 no km 38,2.
 * - Contra falso positivo, o mesmo limiar rodou em 8 saídas urbanas curtas
 *   (Bruxelas, Amsterdam, Zaventem, incluindo uma meia-maratona de 21,5 km) e
 *   não encontrou **nenhuma** parada. Semáforo dura 1–2 minutos, não 4.
 */

import type { ActivityRoutePoint } from '../models';
import { haversineM } from '../geo/distance';

/** Tempo mínimo parado para a janela virar parada. */
export const STOP_MIN_PAUSED_S = 240;
/** Raio dentro do qual o traçado é considerado "no mesmo lugar". */
export const STOP_RADIUS_M = 60;
/**
 * Duas paradas separadas por menos que isto são a mesma parada.
 *
 * Existe porque o caso real pediu: o café de 48 minutos do km 38,2 chegava
 * partido em duas janelas (13 min + 34 min), separadas por um passo de GPS de
 * poucos metros. Sem a fusão, o mapa mostraria dois marcadores em cima um do
 * outro.
 */
export const STOP_MERGE_GAP_S = 300;
export const STOP_MERGE_DIST_M = 120;

export interface StopOptions {
  minPausedS?: number;
  radiusM?: number;
  mergeGapS?: number;
  mergeDistM?: number;
  /**
   * `activities.distance_m` — a distância que a tela mostra no cabeçalho.
   *
   * Quando dada, os quilômetros devolvidos são reescalados para ela. Existe
   * porque somar o track cru **superestima**: na travessia Rotterdam→Amsterdam
   * de 29/08/2026 a soma ponto a ponto dá 67,3 km contra os 57,05 km gravados
   * na atividade — 18% de jitter de GPS. Sem o reescalonamento, o cartão de
   * fotos diria "km 45,1" numa pedalada cujo cabeçalho diz 57,05 km, e o
   * usuário veria dois números que não conversam.
   */
  totalDistanceM?: number;
}

/**
 * Fator que leva a distância geométrica do track para a distância oficial da
 * atividade. `1` quando não há com o que comparar — nunca inventa escala.
 */
export function distanceScale(rawTotalM: number, totalDistanceM?: number): number {
  if (!totalDistanceM || !Number.isFinite(totalDistanceM) || rawTotalM <= 0) return 1;
  return totalDistanceM / rawTotalM;
}

export interface RouteStop {
  /** Índice do primeiro ponto da parada em `points`. */
  startIdx: number;
  /** Índice do último ponto da parada em `points`. */
  endIdx: number;
  startMs: number;
  endMs: number;
  durationS: number;
  /** Coordenada do primeiro ponto — é onde o marcador é desenhado. */
  lat: number;
  lng: number;
  /** Distância acumulada até `startIdx`, em metros. É o "km 38,2" da tela. */
  distanceM: number;
}

/**
 * Distância acumulada por ponto, em metros. Exportada porque o casamento de
 * foto com a rota (`match.ts`) precisa exatamente da mesma escala — calcular
 * duas vezes com regras diferentes produziria km discordantes entre o cartão
 * de fotos e o marcador do mapa.
 */
export function cumulativeDistances(points: readonly ActivityRoutePoint[]): number[] {
  const cum = new Array<number>(points.length);
  cum[0] = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    cum[i] = cum[i - 1] + haversineM(a.lat, a.lng, b.lat, b.lng);
  }
  return cum;
}

/**
 * As paradas de um traçado.
 *
 * Exige `t` nos pontos: sem timestamp não há "quanto tempo parado", e uma rota
 * sem tempo devolve lista vazia em vez de inventar. Isso é seguro na prática —
 * a conferência de 06/09/2026 achou `t` em **275 de 275** rotas em produção,
 * desde julho de 2023 — mas o tipo mantém `t` opcional e o código respeita.
 *
 * Custo: O(n·k), com k o tamanho da corrida parada. Em 2 620 pontos com paradas
 * de ~100 pontos, é instantâneo.
 */
export function detectStops(
  points: readonly ActivityRoutePoint[],
  opts: StopOptions = {},
): RouteStop[] {
  if (points.length < 2) return [];
  if (points[0]?.t === undefined) return [];

  const minPausedS = opts.minPausedS ?? STOP_MIN_PAUSED_S;
  const radiusM = opts.radiusM ?? STOP_RADIUS_M;
  const mergeGapS = opts.mergeGapS ?? STOP_MERGE_GAP_S;
  const mergeDistM = opts.mergeDistM ?? STOP_MERGE_DIST_M;

  const cum = cumulativeDistances(points);
  const raw: Array<[number, number]> = [];

  let i = 0;
  while (i < points.length) {
    const anchor = points[i];
    let j = i;
    while (
      j + 1 < points.length &&
      haversineM(anchor.lat, anchor.lng, points[j + 1].lat, points[j + 1].lng) < radiusM
    ) {
      j += 1;
    }
    const tStart = points[i].t;
    const tEnd = points[j].t;
    if (tStart !== undefined && tEnd !== undefined && (tEnd - tStart) / 1000 >= minPausedS) {
      raw.push([i, j]);
      i = j + 1;
    } else {
      i += 1;
    }
  }

  // Fusão das janelas contíguas — ver STOP_MERGE_GAP_S.
  const merged: Array<[number, number]> = [];
  for (const span of raw) {
    const prev = merged[merged.length - 1];
    if (prev) {
      const gapS = ((points[span[0]].t ?? 0) - (points[prev[1]].t ?? 0)) / 1000;
      const gapM = haversineM(
        points[span[0]].lat,
        points[span[0]].lng,
        points[prev[1]].lat,
        points[prev[1]].lng,
      );
      if (gapS < mergeGapS && gapM < mergeDistM) {
        prev[1] = span[1];
        continue;
      }
    }
    merged.push([span[0], span[1]]);
  }

  const scale = distanceScale(cum[cum.length - 1], opts.totalDistanceM);

  return merged.map(([startIdx, endIdx]) => {
    const startMs = points[startIdx].t as number;
    const endMs = points[endIdx].t as number;
    return {
      startIdx,
      endIdx,
      startMs,
      endMs,
      durationS: (endMs - startMs) / 1000,
      lat: points[startIdx].lat,
      lng: points[startIdx].lng,
      distanceM: cum[startIdx] * scale,
    };
  });
}
