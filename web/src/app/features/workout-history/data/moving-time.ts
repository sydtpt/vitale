/**
 * Tempo em movimento a partir do track GPS.
 *
 * Muitas fontes (apps de terceiro, ou o próprio HealthKit) entregam o tempo
 * decorrido SEM eventos de pausa, então não dá para derivar o tempo em
 * movimento descontando pausas. A fonte confiável é o próprio track: somamos os
 * intervalos entre pontos consecutivos em que a velocidade ficou acima de um
 * limiar, descartando paradas (semáforo, pausa) e lacunas de gravação.
 */
import type { ActivityRoutePoint } from '@vitale/shared';

const EARTH_RADIUS_M = 6371000;

/** Distância em metros entre dois pares lat/lng (Haversine). */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const la1 = toRad(aLat);
  const la2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Limiar de velocidade (m/s) abaixo do qual o atleta é considerado parado.
 * ~0.8 m/s (≈2.9 km/h) descarta o ruído de GPS de quem está parado sem cortar
 * caminhada/corrida reais (que ficam bem acima disso).
 */
export const MOVING_SPEED_THRESHOLD_MPS = 0.8;

/**
 * Tempo em movimento (s) a partir de pontos persistidos (`ActivityRoutePoint`,
 * `t` em ms). Soma os intervalos cuja velocidade ficou ≥ `minSpeedMps`. Retorna
 * undefined se não há pontos suficientes com timestamp.
 */
export function movingTimeFromRoutePoints(
  points: ActivityRoutePoint[] | undefined,
  minSpeedMps = MOVING_SPEED_THRESHOLD_MPS,
): number | undefined {
  if (!points) return undefined;
  const pts = points.filter(
    (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && typeof p?.t === 'number',
  );
  if (pts.length < 2) return undefined;
  let moving = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = ((pts[i].t as number) - (pts[i - 1].t as number)) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) continue; // clock skew / duplicatas
    const dd = haversineM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    if (dd / dt >= minSpeedMps) moving += dt;
  }
  return moving > 0 ? Math.round(moving) : undefined;
}
