/**
 * Distância geodésica entre pares lat/lng. Extraído para `geo/` porque o rateio
 * por país (`country-explorer`) precisa medir trechos de rota, e cópias privadas
 * idênticas já viviam em `fitness/moving-time.ts` e `fitness/streams.ts` — as
 * duas seguem como estão; convergir é limpeza, não comportamento.
 */

const EARTH_RADIUS_M = 6371000;

/** Distância em metros entre dois pares lat/lng (Haversine). */
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const la1 = toRad(aLat);
  const la2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
