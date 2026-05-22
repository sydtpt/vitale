/**
 * Cálculo de "best efforts" de corrida a partir do track GPS.
 *
 * Para cada distância padrão, encontra o menor tempo em que o atleta cobriu
 * (pelo menos) aquela distância em qualquer trecho contínuo da corrida — usando
 * uma janela deslizante (dois ponteiros) sobre a série distância×tempo derivada
 * dos pontos da rota, com interpolação na borda para precisão.
 *
 * Módulo puro (sem dependência nativa) — testável isoladamente. Consumido pelo
 * sync, que tem o track com timestamps em mãos.
 */
import type { RoutePoint } from './workout-types';

export interface BestEffortDistance {
  /** Chave estável usada no jsonb `best_efforts` e nas leituras (web/mobile). */
  key: string;
  /** Distância-alvo em metros. */
  meters: number;
  /** Rótulo de exibição. */
  label: string;
}

/**
 * Distâncias padrão dos recordes, na ordem de exibição do card. As chaves DEVEM
 * casar com as lidas em `running-highlights` (web e mobile).
 */
export const BEST_EFFORT_DISTANCES: BestEffortDistance[] = [
  { key: '1000', meters: 1000, label: '1 km' },
  { key: '5000', meters: 5000, label: '5 km' },
  { key: '10000', meters: 10000, label: '10 km' },
  { key: '20000', meters: 20000, label: '20 km' },
  { key: 'half', meters: 21097.5, label: 'Meia maratona' },
  { key: '30000', meters: 30000, label: '30 km' },
  { key: '40000', meters: 40000, label: '40 km' },
  { key: 'marathon', meters: 42195, label: 'Maratona' },
];

const EARTH_RADIUS_M = 6371000;

/** Distância em metros entre dois pontos (Haversine). */
function haversine(a: RoutePoint, b: RoutePoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Menor tempo (s) para cobrir `target` metros num trecho contínuo, dado:
 *  - `cum[i]`: distância acumulada até o ponto i (metros)
 *  - `time[i]`: tempo do ponto i em segundos (relativo)
 * Retorna `undefined` se o track não cobre a distância. Interpola a borda
 * inicial para que o trecho meça exatamente `target`.
 */
function bestWindow(cum: number[], time: number[], target: number): number | undefined {
  const n = cum.length;
  if (n < 2 || cum[n - 1] < target) return undefined;

  let best = Infinity;
  let i = 0;
  for (let j = 1; j < n; j++) {
    // Avança `i` enquanto o trecho [i+1, j] ainda cobre a distância — mantém `i`
    // como o início mais "apertado" cujo trecho [i, j] >= target.
    while (i + 1 < j && cum[j] - cum[i + 1] >= target) i++;
    if (cum[j] - cum[i] < target) continue;

    // Interpola o início ao longo do segmento i→i+1 para medir exatamente target.
    const segDist = cum[i + 1] - cum[i];
    const excess = cum[j] - cum[i] - target;
    let startTime = time[i];
    if (segDist > 0 && excess > 0) {
      startTime += (excess / segDist) * (time[i + 1] - time[i]);
    }
    const dur = time[j] - startTime;
    if (dur > 0 && dur < best) best = dur;
  }
  return best === Infinity ? undefined : Math.round(best);
}

/**
 * Recordes de corrida a partir do track GPS. Mapa chave→segundos para cada
 * distância padrão que o track cobre. Vazio se não houver timestamps suficientes.
 */
export function computeBestEfforts(points: RoutePoint[]): Record<string, number> {
  const pts = points.filter(
    (p) =>
      typeof p.timestamp === 'string' &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude),
  );
  if (pts.length < 2) return {};

  const t0 = new Date(pts[0].timestamp as string).getTime();
  const cum: number[] = [0];
  const time: number[] = [0];
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    const sec = (new Date(pts[i].timestamp as string).getTime() - t0) / 1000;
    // Ignora pontos com tempo não-crescente (clock skew / duplicatas), medindo
    // sempre a partir do último ponto aceito para não perder distância.
    if (!Number.isFinite(sec) || sec <= time[time.length - 1]) continue;
    cum.push(cum[cum.length - 1] + haversine(prev, pts[i]));
    time.push(sec);
    prev = pts[i];
  }

  const out: Record<string, number> = {};
  for (const { key, meters } of BEST_EFFORT_DISTANCES) {
    const secs = bestWindow(cum, time, meters);
    if (secs !== undefined) out[key] = secs;
  }
  return out;
}
