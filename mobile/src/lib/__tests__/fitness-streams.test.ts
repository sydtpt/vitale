/**
 * Paridade do kernel shared (`fitness/streams.ts`) com as implementações
 * originais do mobile: mesmo track sintético ⇒ mesmos resultados. Se estes
 * testes quebrarem, o kernel (usado pelas edge functions) divergiu do app.
 */
import { describe, it, expect } from '@jest/globals';
import {
  movingTimeFromPoints,
  computeBestEffortsFromPoints,
  elevationGainFromPoints,
  computeHrZonesFromSamples,
  fitnessMaxHrFromAge,
  HR_ZONES,
  type FitnessPoint,
} from '@vitale/shared';
import { movingTimeFromTrack } from '../moving-time';
import { computeBestEfforts } from '../best-efforts';
import { computeHrZones, maxHrFromAge, type HrSample } from '../heart-rate-zones';
import { elevationGain, type RoutePoint } from '../workout-types';

const BASE_MS = Date.UTC(2026, 6, 1, 8, 0, 0);

/**
 * Track sintético indo para o norte: `stepM` metros a cada `stepS` segundos
 * (1e-5 grau de latitude ≈ 1.11 m). Inclui uma pausa de 120 s no meio.
 */
function makeTrack(count: number, stepM: number, stepS: number): {
  shared: FitnessPoint[];
  mobile: RoutePoint[];
} {
  const shared: FitnessPoint[] = [];
  const mobile: RoutePoint[] = [];
  let tMs = BASE_MS;
  for (let i = 0; i < count; i++) {
    const lat = -23.55 + (i * stepM) / 111320; // metros → graus de latitude
    const lng = -46.63;
    const alt = 700 + Math.sin(i / 10) * 30;
    if (i === Math.floor(count / 2)) tMs += 120_000; // pausa (parado no lugar)
    shared.push({ lat, lng, alt, t: tMs });
    mobile.push({ latitude: lat, longitude: lng, altitude: alt, timestamp: new Date(tMs).toISOString() });
    tMs += stepS * 1000;
  }
  return { shared, mobile };
}

describe('fitness/streams — paridade com o mobile', () => {
  // Corrida ~10.8 km: 3600 pontos, 3 m por segundo.
  const track = makeTrack(3600, 3, 1);

  it('movingTimeFromPoints ≡ movingTimeFromTrack', () => {
    expect(movingTimeFromPoints(track.shared)).toBe(movingTimeFromTrack(track.mobile));
    expect(movingTimeFromPoints(undefined)).toBeUndefined();
    expect(movingTimeFromPoints([])).toBeUndefined();
  });

  it('computeBestEffortsFromPoints ≡ computeBestEfforts', () => {
    const fromShared = computeBestEffortsFromPoints(track.shared);
    const fromMobile = computeBestEfforts(track.mobile);
    expect(fromShared).toEqual(fromMobile);
    expect(fromShared['1000']).toBeGreaterThan(0);
    expect(fromShared['10000']).toBeGreaterThan(0);
    expect(fromShared['20000']).toBeUndefined(); // track não cobre 20 km
  });

  it('elevationGainFromPoints ≡ elevationGain (e undefined sem altitude)', () => {
    expect(elevationGainFromPoints(track.shared)).toBeCloseTo(elevationGain(track.mobile), 6);
    const flat = track.shared.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t }));
    expect(elevationGainFromPoints(flat)).toBeUndefined();
  });

  it('computeHrZonesFromSamples ≡ computeHrZones (fronteiras pinadas em HR_ZONES)', () => {
    // Série varrendo todas as zonas: 100→180 bpm com FCmáx 190 / FCrep 50.
    const samples: HrSample[] = Array.from({ length: 600 }, (_, i) => ({
      bpm: 100 + Math.floor(i / 60) * 8,
      t: BASE_MS + i * 5000,
    }));
    const params = { maxHr: 190, restHr: 50 };
    const fromShared = computeHrZonesFromSamples(samples, params);
    const fromMobile = computeHrZones(samples, params);
    expect(fromShared).toEqual(fromMobile);
    expect(Object.keys(fromShared).length).toBeGreaterThan(1);
    // Toda chave produzida existe na definição compartilhada de zonas.
    for (const key of Object.keys(fromShared)) {
      expect(HR_ZONES.some((z) => z.key === key)).toBe(true);
    }
  });

  it('fitnessMaxHrFromAge ≡ maxHrFromAge', () => {
    for (const age of [undefined, 0, 25, 34, 119, 130]) {
      expect(fitnessMaxHrFromAge(age)).toBe(maxHrFromAge(age));
    }
  });
});
