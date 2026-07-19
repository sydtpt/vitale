import { describe, it, expect } from '@jest/globals';
import { speedFractions, elevationProfile, haversineM } from '../share-art-data';
import type { RoutePoint } from '../workout-types';

/** Pontos numa linha reta para leste, 1 amostra/s; `mps` controla a velocidade
 *  por trecho (graus de longitude ∝ metros na latitude 0). */
function track(speedsMps: number[], withTimestamps = true, altitude?: (i: number) => number): RoutePoint[] {
  const M_PER_DEG = 111195; // ~ metros por grau na linha do equador
  const pts: RoutePoint[] = [];
  let lng = 0;
  for (let i = 0; i < speedsMps.length; i++) {
    pts.push({
      latitude: 0,
      longitude: lng,
      ...(withTimestamps ? { timestamp: new Date(1_700_000_000_000 + i * 1000).toISOString() } : {}),
      ...(altitude ? { altitude: altitude(i) } : {}),
    });
    lng += speedsMps[i] / M_PER_DEG;
  }
  return pts;
}

describe('share-art-data', () => {
  it('haversineM: ~111 km por grau de latitude', () => {
    const d = haversineM({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  describe('speedFractions', () => {
    it('velocidade constante → todas as frações 0.5', () => {
      const fr = speedFractions(track(new Array(60).fill(3)));
      expect(fr).not.toBeNull();
      expect(fr!).toHaveLength(59);
      for (const f of fr!) expect(f).toBeCloseTo(0.5, 5);
    });

    it('sprint no meio → frações maiores no trecho rápido', () => {
      const speeds = [...new Array(40).fill(2), ...new Array(40).fill(8), ...new Array(40).fill(2)];
      const fr = speedFractions(track(speeds))!;
      expect(fr).not.toBeNull();
      const slowAvg = fr.slice(5, 25).reduce((s, v) => s + v, 0) / 20;
      const fastAvg = fr.slice(50, 70).reduce((s, v) => s + v, 0) / 20;
      expect(fastAvg).toBeGreaterThan(slowAvg + 0.4);
      for (const f of fr) {
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    });

    it('sem timestamps → null', () => {
      expect(speedFractions(track(new Array(60).fill(3), false))).toBeNull();
    });

    it('poucos pontos → null', () => {
      expect(speedFractions(track(new Array(5).fill(3)))).toBeNull();
    });
  });

  describe('elevationProfile', () => {
    it('pico no meio → peakIdx central e maxAlt > minAlt', () => {
      const n = 100;
      const prof = elevationProfile(
        track(new Array(n).fill(3), true, (i) => 100 + 80 * Math.sin((i / (n - 1)) * Math.PI)),
      )!;
      expect(prof).not.toBeNull();
      expect(prof.xs).toHaveLength(n);
      expect(prof.ys).toHaveLength(n);
      expect(prof.peakIdx).toBeGreaterThan(n * 0.3);
      expect(prof.peakIdx).toBeLessThan(n * 0.7);
      expect(prof.maxAlt).toBeGreaterThan(prof.minAlt + 50);
      // Distância acumulada cresce monotonicamente.
      for (let i = 1; i < n; i++) expect(prof.xs[i]).toBeGreaterThan(prof.xs[i - 1]);
    });

    it('sem altitude → null', () => {
      expect(elevationProfile(track(new Array(60).fill(3)))).toBeNull();
    });

    it('percurso plano → null', () => {
      expect(elevationProfile(track(new Array(60).fill(3), true, () => 12))).toBeNull();
    });
  });
});
