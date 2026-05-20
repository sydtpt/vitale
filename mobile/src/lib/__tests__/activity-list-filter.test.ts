import { describe, it, expect } from '@jest/globals';
import type { Activity } from '@vitale/shared';
import { applyFilters, filterByType, distinctSources } from '../activity-list-filter';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    userId: 'u1',
    activityId: partial.activityId ?? 37,
    activityName: undefined,
    calories: partial.calories ?? 0,
    endAt: partial.endAt ?? partial.startAt,
    durationS: partial.durationS ?? 0,
    distanceM: partial.distanceM,
    sourceName: partial.sourceName,
    hasRoute: partial.hasRoute ?? false,
    hidden: false,
    ...partial,
  } as Activity;
}

describe('filterByType', () => {
  it('filtra pelo label do tipo', () => {
    const list = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00' }), // Corrida
      act({ activityId: 50, startAt: '2026-05-19T08:00:00' }), // Musculação
    ];
    expect(filterByType(list, 'Corrida')).toHaveLength(1);
  });
});

describe('applyFilters', () => {
  const list = [
    act({ startAt: '2026-05-20T08:00:00', distanceM: 5000, durationS: 1800, sourceName: 'Apple Watch', hasRoute: true }),
    act({ startAt: '2026-05-15T08:00:00', distanceM: 10000, durationS: 3600, sourceName: 'iPhone', hasRoute: false }),
    act({ startAt: '2026-05-10T08:00:00', distanceM: 2000, durationS: 900, sourceName: 'Apple Watch', hasRoute: true }),
  ];

  it('ordena por data desc', () => {
    const out = applyFilters(list, {});
    expect(out.map((a) => a.startAt)).toEqual([
      '2026-05-20T08:00:00',
      '2026-05-15T08:00:00',
      '2026-05-10T08:00:00',
    ]);
  });

  it('filtra por intervalo de datas (inclusivo)', () => {
    const out = applyFilters(list, { fromDate: '2026-05-11', toDate: '2026-05-16' });
    expect(out).toHaveLength(1);
    expect(out[0].startAt).toBe('2026-05-15T08:00:00');
  });

  it('filtra por faixa de distância (metros)', () => {
    const out = applyFilters(list, { minDistanceM: 3000, maxDistanceM: 8000 });
    expect(out.map((a) => a.distanceM)).toEqual([5000]);
  });

  it('filtra por duração mínima (segundos)', () => {
    const out = applyFilters(list, { minDurationS: 1800 });
    expect(out.map((a) => a.durationS).sort((a, b) => a - b)).toEqual([1800, 3600]);
  });

  it('filtra por fonte e por presença de rota', () => {
    expect(applyFilters(list, { sourceName: 'iPhone' })).toHaveLength(1);
    expect(applyFilters(list, { hasRoute: true })).toHaveLength(2);
    expect(applyFilters(list, { hasRoute: false })).toHaveLength(1);
  });
});

describe('distinctSources', () => {
  it('retorna fontes únicas ordenadas', () => {
    const list = [
      act({ startAt: '2026-05-20T08:00:00', sourceName: 'iPhone' }),
      act({ startAt: '2026-05-19T08:00:00', sourceName: 'Apple Watch' }),
      act({ startAt: '2026-05-18T08:00:00', sourceName: 'Apple Watch' }),
    ];
    expect(distinctSources(list)).toEqual(['Apple Watch', 'iPhone']);
  });
});
