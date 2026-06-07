import type { Activity } from '@vitale/shared';
import { buildWeeklyLoad, mondayOf } from './weekly-load';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: Math.random().toString(36),
    userId: 'u1',
    activityId: 37,
    calories: 100,
    durationS: 1800,
    distanceM: 5000,
    endAt: partial.startAt,
    hasRoute: false,
    ...partial,
  };
}

// Quarta-feira 2026-06-03 → semana de seg 2026-06-01 a dom 2026-06-07.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

describe('mondayOf', () => {
  it('retorna a segunda da semana (domingo cai na semana anterior)', () => {
    expect(mondayOf(new Date(2026, 5, 3))).toEqual(new Date(2026, 5, 1)); // qua → seg 01/06
    expect(mondayOf(new Date(2026, 5, 1))).toEqual(new Date(2026, 5, 1)); // seg → seg
    expect(mondayOf(new Date(2026, 5, 7))).toEqual(new Date(2026, 5, 1)); // dom → seg 01/06
    expect(mondayOf(new Date(2026, 5, 8))).toEqual(new Date(2026, 5, 8)); // seg seguinte
  });
});

describe('buildWeeklyLoad — buckets', () => {
  it('produz N buckets em ordem cronológica terminando na semana atual', () => {
    const r = buildWeeklyLoad([], 8, NOW);
    expect(r.buckets.length).toBe(8);
    expect(r.buckets[7].key).toBe('2026-06-01'); // última = semana atual
    expect(r.buckets[7].label).toBe('01/06');
    expect(r.buckets[0].key).toBe('2026-04-13'); // 7 semanas antes
    // chaves estritamente crescentes
    const keys = r.buckets.map((b) => b.key);
    expect([...keys].sort()).toEqual(keys);
  });

  it('soma segundos por zona na semana e ordena Z1..Z5', () => {
    const r = buildWeeklyLoad(
      [
        act({ startAt: '2026-06-01T08:00:00', hrZones: { z1: 600, z3: 300 } }),
        act({ startAt: '2026-06-04T08:00:00', hrZones: { z1: 400, z5: 120 } }),
      ],
      8,
      NOW,
    );
    const cur = r.buckets[7];
    expect(cur.total).toBe(600 + 300 + 400 + 120);
    expect(cur.segments.map((s) => s.value)).toEqual([1000, 300, 120]); // z1, z3, z5 (z2/z4 omitidos)
  });

  it('semana sem dado de FC vira barra vazia (mantém o eixo)', () => {
    const r = buildWeeklyLoad([act({ startAt: '2026-06-01T08:00:00', hrZones: { z2: 500 } })], 8, NOW);
    expect(r.buckets[0].total).toBe(0);
    expect(r.buckets[0].segments).toEqual([]);
  });

  it('treino sem hrZones não contribui', () => {
    const r = buildWeeklyLoad([act({ startAt: '2026-06-02T08:00:00' })], 8, NOW);
    expect(r.buckets[7].total).toBe(0);
  });
});

describe('buildWeeklyLoad — polarização', () => {
  it('calcula leve/forte e easyPct da semana atual', () => {
    const r = buildWeeklyLoad(
      [act({ startAt: '2026-06-02T08:00:00', hrZones: { z1: 300, z2: 300, z3: 100, z4: 100, z5: 100 } })],
      8,
      NOW,
    );
    expect(r.polarization.easyS).toBe(600); // z1+z2
    expect(r.polarization.hardS).toBe(200); // z4+z5
    expect(r.polarization.totalS).toBe(900);
    expect(r.polarization.easyPct).toBeCloseTo((600 / 900) * 100, 5);
  });

  it('easyPct é 0 quando não há tempo em zona (sem divisão por zero)', () => {
    const r = buildWeeklyLoad([], 8, NOW);
    expect(r.polarization.totalS).toBe(0);
    expect(r.polarization.easyPct).toBe(0);
  });
});

describe('buildWeeklyLoad — alerta de carga', () => {
  it('liga quando Z4+Z5 atual > 1,5× a média das semanas anteriores (≥2 com dado)', () => {
    const r = buildWeeklyLoad(
      [
        act({ startAt: '2026-05-18T08:00:00', hrZones: { z4: 100 } }), // baseline 100
        act({ startAt: '2026-05-25T08:00:00', hrZones: { z4: 100 } }), // baseline 100 → média 100
        act({ startAt: '2026-06-02T08:00:00', hrZones: { z4: 200 } }), // atual 200 > 150
      ],
      8,
      NOW,
    );
    expect(r.highLoadAlert).toBe(true);
  });

  it('não liga com menos de 2 semanas de baseline', () => {
    const r = buildWeeklyLoad(
      [
        act({ startAt: '2026-05-25T08:00:00', hrZones: { z4: 100 } }), // só 1 semana de baseline
        act({ startAt: '2026-06-02T08:00:00', hrZones: { z4: 999 } }),
      ],
      8,
      NOW,
    );
    expect(r.highLoadAlert).toBe(false);
  });

  it('não liga quando a carga atual está dentro do habitual', () => {
    const r = buildWeeklyLoad(
      [
        act({ startAt: '2026-05-18T08:00:00', hrZones: { z5: 200 } }),
        act({ startAt: '2026-05-25T08:00:00', hrZones: { z5: 200 } }),
        act({ startAt: '2026-06-02T08:00:00', hrZones: { z5: 220 } }), // 220 < 1.5*200
      ],
      8,
      NOW,
    );
    expect(r.highLoadAlert).toBe(false);
  });
});
