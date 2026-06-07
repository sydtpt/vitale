import type { Activity } from '@vitale/shared';
import { activityRecap, countRecap, metricRecap, weekBounds, weekLabel } from './weekly-recap';

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

// Quarta 2026-06-03 → semana atual seg 01/06 a dom 07/06; anterior seg 25/05 a dom 31/05.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

describe('weekBounds / weekLabel', () => {
  it('delimita a semana atual (seg–dom) e a anterior', () => {
    const cur = weekBounds(NOW, 0);
    expect(cur.start).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
    expect(cur.end).toEqual(new Date(2026, 5, 8, 0, 0, 0, 0));
    const prev = weekBounds(NOW, 1);
    expect(prev.start).toEqual(new Date(2026, 4, 25, 0, 0, 0, 0));
  });
  it('rotula a semana', () => {
    expect(weekLabel(NOW)).toBe('01/06 – 07/06');
  });
});

describe('activityRecap', () => {
  it('soma totais da semana e compara com a anterior', () => {
    const r = activityRecap(
      [
        act({ startAt: '2026-06-02T08:00:00', distanceM: 5000, durationS: 1800, calories: 300 }),
        act({ startAt: '2026-06-04T08:00:00', distanceM: 3000, durationS: 1200, calories: 200 }),
        act({ startAt: '2026-05-26T08:00:00', distanceM: 4000, durationS: 1500, calories: 250 }), // anterior
      ],
      NOW,
    );
    expect(r.count.current).toBe(2);
    expect(r.count.prior).toBe(1);
    expect(r.distanceM.current).toBe(8000);
    expect(r.distanceM.delta).toBe(8000 - 4000);
    expect(r.calories.current).toBe(500);
  });

  it('ignora atividades fora das duas semanas', () => {
    const r = activityRecap([act({ startAt: '2026-04-01T08:00:00' })], NOW);
    expect(r.count.current).toBe(0);
    expect(r.count.prior).toBe(0);
    expect(r.distanceM.deltaPct).toBeNull(); // prior 0 → pct indefinido
  });
});

describe('metricRecap', () => {
  it('média da semana vs anterior com delta e pct', () => {
    const values = new Map<string, number>([
      ['2026-06-02', 60], ['2026-06-04', 64], // atual → média 62
      ['2026-05-26', 58], ['2026-05-28', 58], // anterior → média 58
    ]);
    const r = metricRecap(values, NOW);
    expect(r.current).toBe(62);
    expect(r.prior).toBe(58);
    expect(r.delta).toBe(4);
    expect(r.deltaPct).toBeCloseTo((4 / 58) * 100, 5);
    expect(r.n).toBe(2);
  });

  it('sem dado na semana atual → current null, n 0', () => {
    const values = new Map<string, number>([['2026-05-26', 58]]);
    const r = metricRecap(values, NOW);
    expect(r.current).toBeNull();
    expect(r.delta).toBeNull();
    expect(r.n).toBe(0);
  });
});

describe('countRecap', () => {
  it('conta eventos por semana', () => {
    const r = countRecap(['2026-06-02', '2026-06-03', '2026-05-27'], NOW);
    expect(r.current).toBe(2);
    expect(r.prior).toBe(1);
    expect(r.delta).toBe(1);
  });
});
