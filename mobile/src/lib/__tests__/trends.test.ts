import { describe, it, expect } from '@jest/globals';
import {
  movingAverage,
  detectTrend,
  detectAnomaly,
  pearson,
  correlate,
  stdDev,
} from '@vitale/shared';

describe('movingAverage', () => {
  it('média trailing da janela', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });
});

describe('detectTrend', () => {
  it('série crescente → up (slope conhecido)', () => {
    const t = detectTrend([10, 11, 12, 13, 14]);
    expect(t.slope).toBeCloseTo(1);
    expect(t.direction).toBe('up');
  });

  it('série decrescente → down', () => {
    expect(detectTrend([20, 18, 16, 14]).direction).toBe('down');
  });

  it('série estável → flat', () => {
    expect(detectTrend([50, 50, 50, 50]).direction).toBe('flat');
  });
});

describe('detectAnomaly', () => {
  it('flag quando |z| > threshold', () => {
    const r = detectAnomaly(100, 70, 10, 2); // z = 3
    expect(r.z).toBeCloseTo(3);
    expect(r.anomaly).toBe(true);
  });

  it('sem flag dentro da faixa', () => {
    expect(detectAnomaly(75, 70, 10, 2).anomaly).toBe(false);
  });

  it('sd zero não acusa anomalia', () => {
    expect(detectAnomaly(100, 70, 0).anomaly).toBe(false);
  });
});

describe('pearson / correlate', () => {
  it('correlação positiva perfeita', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('correlação negativa perfeita', () => {
    expect(pearson([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });

  it('correlate pareia por dia (interseção de datas)', () => {
    const a = new Map([
      ['2026-05-01', 1],
      ['2026-05-02', 2],
      ['2026-05-03', 3],
    ]);
    const b = new Map([
      ['2026-05-02', 4],
      ['2026-05-03', 6],
      ['2026-05-04', 9],
    ]);
    const c = correlate(a, b);
    expect(c.n).toBe(2); // dias 02 e 03
    expect(c.coefficient).toBeCloseTo(1);
  });
});

describe('stdDev', () => {
  it('desvio amostral', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
  });
});
