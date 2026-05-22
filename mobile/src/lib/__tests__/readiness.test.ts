import { describe, it, expect } from '@jest/globals';
import { computeReadiness, rollingBaseline } from '@vitale/shared';

describe('rollingBaseline', () => {
  it('média das últimas N leituras válidas, ignorando nulos', () => {
    expect(rollingBaseline([60, null, 62, undefined, 64], 7)).toBeCloseTo(62);
  });

  it('respeita a janela', () => {
    expect(rollingBaseline([10, 20, 30, 40], 2)).toBeCloseTo(35);
  });

  it('null quando não há leituras válidas', () => {
    expect(rollingBaseline([null, undefined])).toBeNull();
  });
});

describe('computeReadiness', () => {
  it('sono perfeito + FC/VFC na baseline + anéis cheios ≈ alto', () => {
    const r = computeReadiness({
      sleepHours: 8,
      restingHr: 55,
      restingHrBaseline: 55,
      hrv: 60,
      hrvBaseline: 60,
      ringsPct: [1, 1, 1],
    });
    // sono 100*.3 + fc 100*.25 + vfc 50*.25 + anéis 100*.2 = 87.5 → 88
    expect(r.total).toBe(88);
    expect(r.components).toHaveLength(4);
  });

  it('FC acima da baseline derruba o componente', () => {
    const r = computeReadiness({ restingHr: 65, restingHrBaseline: 55 });
    const fc = r.components.find((c) => c.key === 'fcRepouso');
    expect(fc?.score).toBe(60); // 100 - 10*4
    expect(r.total).toBe(60); // único componente presente
  });

  it('renormaliza pesos com componentes ausentes', () => {
    const r = computeReadiness({ sleepHours: 4 }); // só sono (50)
    expect(r.components).toHaveLength(1);
    expect(r.total).toBe(50);
  });

  it('sem entradas → total 0 e sem componentes', () => {
    const r = computeReadiness({});
    expect(r.total).toBe(0);
    expect(r.components).toHaveLength(0);
  });

  it('anéis acima de 100% são limitados', () => {
    const r = computeReadiness({ ringsPct: [1.5, 1, 0.5] });
    const a = r.components.find((c) => c.key === 'aneis');
    expect(a?.score).toBeCloseTo((100 + 100 + 50) / 3);
  });
});
