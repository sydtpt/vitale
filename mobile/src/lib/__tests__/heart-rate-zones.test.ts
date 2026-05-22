import { describe, it, expect } from '@jest/globals';
import { computeHrZones, maxHrFromAge, type HrSample } from '../heart-rate-zones';

const BASE_MS = Date.UTC(2026, 0, 1, 8, 0, 0);

/** Série de FC com `bpm` constante e `stepS` segundos entre amostras. */
function constant(bpm: number, count: number, stepS = 5): HrSample[] {
  return Array.from({ length: count }, (_, i) => ({ bpm, t: BASE_MS + i * stepS * 1000 }));
}

describe('computeHrZones', () => {
  // FCmáx 200, FCrep 50 → reserva 150. Limites de zona (Karvonen):
  // z1<140, z2<155, z3<170, z4<185, z5≥185.
  const params = { maxHr: 200, restHr: 50 };

  it('FC constante cai inteira numa zona', () => {
    // 60% FCR = 50 + 0.6*150 = 140 → fronteira z1/z2; 150 bpm = 66,7% → z2.
    const zones = computeHrZones(constant(150, 13, 5), params); // 12 intervalos × 5 s = 60 s
    expect(zones).toEqual({ z2: 60 });
  });

  it('FC alta cai na zona máxima', () => {
    // 190 bpm = (190-50)/150 = 93% → z5.
    const zones = computeHrZones(constant(190, 11, 10), params); // 10 × 10 s = 100 s
    expect(zones).toEqual({ z5: 100 });
  });

  it('soma o tempo por zona ao longo do treino', () => {
    const samples = [...constant(150, 7, 5), ...constant(190, 6, 5).map((s, i) => ({ ...s, t: BASE_MS + (7 + i) * 5000 }))];
    const zones = computeHrZones(samples, params);
    // 6 intervalos em z2 (30 s), depois transição + z5.
    expect(zones.z2).toBeGreaterThan(0);
    expect(zones.z5).toBeGreaterThan(0);
    expect(zones.z2 + zones.z5).toBe(60); // 12 intervalos × 5 s
  });

  it('descarta lacunas grandes (pausa)', () => {
    const samples: HrSample[] = [
      { bpm: 150, t: BASE_MS },
      { bpm: 150, t: BASE_MS + 5000 }, // +5 s conta
      { bpm: 150, t: BASE_MS + 5 * 60 * 1000 }, // +5 min: pausa, descartada
      { bpm: 150, t: BASE_MS + 5 * 60 * 1000 + 5000 }, // +5 s conta
    ];
    expect(computeHrZones(samples, params)).toEqual({ z2: 10 });
  });

  it('sem FCrep cai para % da FCmáx', () => {
    // FCmáx 200, sem repouso → 150 bpm = 75% da FCmáx → z3 (<80%).
    const zones = computeHrZones(constant(150, 13, 5), { maxHr: 200 });
    expect(zones).toEqual({ z3: 60 });
  });

  it('amostras insuficientes → vazio', () => {
    expect(computeHrZones(constant(150, 1), params)).toEqual({});
    expect(computeHrZones([], params)).toEqual({});
  });

  it('parâmetros inválidos → vazio', () => {
    expect(computeHrZones(constant(150, 5), { maxHr: 0 })).toEqual({});
    expect(computeHrZones(constant(150, 5), { maxHr: 100, restHr: 200 })).toEqual({});
  });
});

describe('maxHrFromAge', () => {
  it('220 − idade quando válida', () => {
    expect(maxHrFromAge(30)).toBe(190);
    expect(maxHrFromAge(50)).toBe(170);
  });

  it('fallback quando idade ausente ou absurda', () => {
    expect(maxHrFromAge(undefined)).toBe(190);
    expect(maxHrFromAge(0)).toBe(190);
    expect(maxHrFromAge(200)).toBe(190);
  });
});
