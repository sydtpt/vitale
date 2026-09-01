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
import { BEST_EFFORT_DISTANCES, MOVING_SPEED_THRESHOLD_MPS, type BestEffortDistance } from '@vitale/shared';

/**
 * A tabela de distâncias mora no núcleo (`fitness/best-efforts.ts`), derivada
 * da mesma `BEST_EFFORT_TARGETS` que o sync usa para escrever o jsonb. Antes
 * era uma cópia aqui e outra na web, com um comentário pedindo que "DEVEM
 * casar" na mão. Re-exportada para os imports existentes não mudarem.
 */
export { BEST_EFFORT_DISTANCES, type BestEffortDistance };

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
 *
 * O eixo de tempo é o tempo EM MOVIMENTO: intervalos abaixo de
 * `MOVING_SPEED_THRESHOLD_MPS` (parada em semáforo, pausa, lacuna de gravação)
 * não contam — assim o recorde reflete o ritmo real, não o tempo total decorrido.
 */
export function computeBestEfforts(points: RoutePoint[]): Record<string, number> {
  const pts = points.filter(
    (p) =>
      typeof p.timestamp === 'string' &&
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude),
  );
  if (pts.length < 2) return {};

  const cum: number[] = [0];
  const time: number[] = [0]; // tempo em movimento acumulado (s)
  let prev = pts[0];
  let prevMs = new Date(pts[0].timestamp as string).getTime();
  let moving = 0;
  for (let i = 1; i < pts.length; i++) {
    const ms = new Date(pts[i].timestamp as string).getTime();
    const dt = (ms - prevMs) / 1000;
    // Ignora pontos com tempo não-crescente (clock skew / duplicatas), medindo
    // sempre a partir do último ponto aceito para não perder distância.
    if (!Number.isFinite(dt) || dt <= 0) continue;
    const dist = haversine(prev, pts[i]);
    // Só soma o intervalo ao relógio quando o atleta estava se movendo; paradas
    // não inflam o recorde.
    if (dist / dt >= MOVING_SPEED_THRESHOLD_MPS) moving += dt;
    cum.push(cum[cum.length - 1] + dist);
    time.push(moving);
    prev = pts[i];
    prevMs = ms;
  }

  const out: Record<string, number> = {};
  for (const { key, meters } of BEST_EFFORT_DISTANCES) {
    const secs = bestWindow(cum, time, meters);
    if (secs !== undefined) out[key] = secs;
  }
  return out;
}
