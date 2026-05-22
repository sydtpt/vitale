import { describe, it, expect } from '@jest/globals';
import type { ActivityRoutePoint } from '@vitale/shared';
import { movingTimeFromRoutePoints, movingTimeFromTrack } from '../moving-time';

// ~0.00009° de latitude ≈ 10 m. Usado para montar trechos com velocidade conhecida.
const LAT_STEP_10M = 0.00009;

/** Gera pontos andando para o norte: `n` passos de `stepM` metros a cada `dtS` segundos. */
function movingPoints(n: number, stepM: number, dtS: number, t0 = 0): ActivityRoutePoint[] {
  const latStep = (stepM / 10) * LAT_STEP_10M;
  const pts: ActivityRoutePoint[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ lat: -23.5 + i * latStep, lng: -46.6, t: t0 + i * dtS * 1000 });
  }
  return pts;
}

describe('movingTimeFromRoutePoints', () => {
  it('soma só os trechos em que houve deslocamento real', () => {
    // 10 trechos de 3 m/s (1s, 3 m cada) = 10 s em movimento.
    const moving = movingPoints(11, 3, 1, 0);
    const last = moving[moving.length - 1].t as number;
    // Parado: 30 pontos no MESMO lugar, 1 s cada (≈30 s de parada com ruído zero).
    const stopped: ActivityRoutePoint[] = Array.from({ length: 30 }, (_, i) => ({
      lat: moving[moving.length - 1].lat,
      lng: -46.6,
      t: last + (i + 1) * 1000,
    }));
    expect(movingTimeFromRoutePoints([...moving, ...stopped])).toBe(10);
  });

  it('descarta a lacuna de uma pausa (tempo grande, deslocamento desprezível)', () => {
    const before = movingPoints(6, 3, 1, 0); // 5 s em movimento
    const lastT = before[before.length - 1].t as number;
    // Retoma 600 s depois (gravação parou na pausa); a lacuna tem velocidade ~0
    // (poucos metros em 600 s) e não conta. Mais 5 s em movimento depois.
    const after = movingPoints(6, 3, 1, lastT + 600_000);
    expect(movingTimeFromRoutePoints([...before, ...after])).toBe(10);
  });

  it('sem pontos suficientes → undefined', () => {
    expect(movingTimeFromRoutePoints([])).toBeUndefined();
    expect(movingTimeFromRoutePoints([{ lat: -23.5, lng: -46.6, t: 0 }])).toBeUndefined();
  });

  it('pontos sem timestamp → undefined', () => {
    expect(
      movingTimeFromRoutePoints([
        { lat: -23.5, lng: -46.6 },
        { lat: -23.4, lng: -46.6 },
      ]),
    ).toBeUndefined();
  });
});

describe('movingTimeFromTrack', () => {
  it('aceita o track do HealthKit (timestamp ISO)', () => {
    const pts = [
      { latitude: -23.5, longitude: -46.6, timestamp: '2026-05-01T10:00:00.000Z' },
      { latitude: -23.5 + LAT_STEP_10M * 3, longitude: -46.6, timestamp: '2026-05-01T10:00:10.000Z' },
      { latitude: -23.5 + LAT_STEP_10M * 6, longitude: -46.6, timestamp: '2026-05-01T10:00:20.000Z' },
    ];
    // ~30 m a cada 10 s = 3 m/s (em movimento) → 20 s contados.
    expect(movingTimeFromTrack(pts)).toBe(20);
  });
});
