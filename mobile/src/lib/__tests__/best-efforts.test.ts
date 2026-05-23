import { describe, it, expect } from '@jest/globals';
import { computeBestEfforts } from '../best-efforts';
import type { RoutePoint } from '../workout-types';

const EARTH_RADIUS_M = 6371000;
const BASE_MS = Date.UTC(2026, 0, 1, 8, 0, 0);

/**
 * Constrói um track ao longo do equador (lat 0). Nessa latitude o Haversine
 * devolve exatamente os metros, então as distâncias do teste são determinísticas.
 * `stepM` = espaçamento entre pontos; `stepS` = intervalo de tempo entre pontos.
 */
function buildTrack(count: number, stepM: number, stepS: number): RoutePoint[] {
  const dLngDeg = ((stepM / EARTH_RADIUS_M) * 180) / Math.PI;
  return Array.from({ length: count }, (_, i) => ({
    latitude: 0,
    longitude: i * dLngDeg,
    timestamp: new Date(BASE_MS + i * stepS * 1000).toISOString(),
  }));
}

describe('computeBestEfforts', () => {
  it('ritmo constante → tempos exatos para as distâncias cobertas', () => {
    // 60 pontos, 100 m e 30 s entre cada → 5900 m a 300 s/km (5:00/km).
    const efforts = computeBestEfforts(buildTrack(60, 100, 30));

    expect(efforts['1000']).toBeCloseTo(300, 0);
    expect(efforts['5000']).toBeCloseTo(1500, 0);
    // Track só cobre 5,9 km — sem recordes a partir de 10 km.
    expect(efforts['10000']).toBeUndefined();
    expect(efforts['marathon']).toBeUndefined();
  });

  it('pega o trecho mais rápido quando o ritmo varia', () => {
    // 1 km rápido (10 pontos × 100 m × 10 s = 1000 m em 100 s) seguido de 4 km lento.
    const fast = buildTrack(11, 100, 10); // 0..1000 m, 0..100 s
    const lastFast = fast[fast.length - 1];
    const t0 = new Date(lastFast.timestamp as string).getTime();
    const dLngDeg = ((100 / EARTH_RADIUS_M) * 180) / Math.PI;
    const slow: RoutePoint[] = Array.from({ length: 40 }, (_, i) => ({
      latitude: 0,
      longitude: lastFast.longitude + (i + 1) * dLngDeg,
      timestamp: new Date(t0 + (i + 1) * 60 * 1000).toISOString(), // 60 s/100 m
    }));
    const efforts = computeBestEfforts([...fast, ...slow]);

    // O melhor 1 km é o trecho inicial rápido (~100 s), não a média.
    expect(efforts['1000']).toBeCloseTo(100, -1);
    expect(efforts['1000']).toBeLessThan(200);
  });

  it('usa o tempo em movimento: parada no meio não infla o recorde', () => {
    const dLngDeg = ((100 / EARTH_RADIUS_M) * 180) / Math.PI;
    const pts: RoutePoint[] = [];
    const push = (stepIdx: number, ms: number) =>
      pts.push({ latitude: 0, longitude: stepIdx * dLngDeg, timestamp: new Date(ms).toISOString() });

    let t = BASE_MS;
    // 0..500 m em movimento (10 s entre pontos).
    for (let i = 0; i <= 5; i++) {
      push(i, t);
      t += 10_000;
    }
    // 5 min parado em 500 m (mesma posição) — o laço já somou 10 s após o ponto 5.
    t += 5 * 60_000 - 10_000;
    push(5, t);
    t += 10_000;
    // 600..1000 m em movimento.
    for (let i = 6; i <= 10; i++) {
      push(i, t);
      t += 10_000;
    }

    const efforts = computeBestEfforts(pts);
    // Tempo total decorrido no 1 km ≈ 400 s; em movimento ≈ 100 s.
    expect(efforts['1000']).toBeLessThan(150);
    expect(efforts['1000']).toBeGreaterThan(90);
  });

  it('sem timestamps → mapa vazio', () => {
    const noTime: RoutePoint[] = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.01 },
    ];
    expect(computeBestEfforts(noTime)).toEqual({});
  });

  it('track curto demais → sem recordes', () => {
    expect(computeBestEfforts(buildTrack(3, 100, 30))).toEqual({});
  });
});
