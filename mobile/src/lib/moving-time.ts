/**
 * Tempo em movimento a partir do track GPS.
 *
 * Muitas fontes (apps de terceiro, ou o próprio HealthKit) entregam
 * `HKWorkout.duration` igual ao tempo decorrido e SEM eventos de pausa — então
 * não dá para derivar o tempo em movimento descontando pausas. A fonte confiável
 * é o próprio track: somamos os intervalos entre pontos consecutivos em que a
 * velocidade ficou acima de um limiar, descartando paradas (semáforo, pausa) e
 * lacunas de gravação. Módulo puro (sem dependência nativa) — testável isolado.
 */
import type { ActivityRoutePoint } from '@vitale/shared';
import type { RoutePoint } from './workout-types';

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

interface Sample {
  lat: number;
  lng: number;
  tMs: number;
}

/**
 * Tempo em movimento (s) a partir de amostras GPS com timestamp (ms). Soma os
 * intervalos entre pontos consecutivos cuja velocidade ficou ≥ `minSpeedMps`.
 * Retorna undefined se não há amostras suficientes com tempo válido.
 */
function movingTimeFromSamples(samples: Sample[], minSpeedMps = MOVING_SPEED_THRESHOLD_MPS): number | undefined {
  const pts = samples.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && Number.isFinite(s.tMs));
  if (pts.length < 2) return undefined;
  let moving = 0;
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i].tMs - pts[i - 1].tMs) / 1000;
    if (!Number.isFinite(dt) || dt <= 0) continue; // clock skew / duplicatas
    const dd = haversineM(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    if (dd / dt >= minSpeedMps) moving += dt;
  }
  return moving > 0 ? Math.round(moving) : undefined;
}

/** Tempo em movimento (s) a partir de pontos persistidos (`ActivityRoutePoint`, `t` em ms). */
export function movingTimeFromRoutePoints(
  points: ActivityRoutePoint[] | undefined,
  minSpeedMps?: number,
): number | undefined {
  if (!points) return undefined;
  return movingTimeFromSamples(
    points.map((p) => ({ lat: p.lat, lng: p.lng, tMs: typeof p.t === 'number' ? p.t : NaN })),
    minSpeedMps,
  );
}

/** Tempo em movimento (s) a partir do track do HealthKit (`RoutePoint`, timestamp ISO). */
export function movingTimeFromTrack(
  points: RoutePoint[] | undefined,
  minSpeedMps?: number,
): number | undefined {
  if (!points) return undefined;
  return movingTimeFromSamples(
    points.map((p) => ({ lat: p.latitude, lng: p.longitude, tMs: p.timestamp ? Date.parse(p.timestamp) : NaN })),
    minSpeedMps,
  );
}
