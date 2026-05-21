import type { Activity } from '@vitale/shared';
import { applyFilters, buildActivityList, filterByType, sortActivities } from './activity-list';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: Math.random().toString(36),
    userId: 'u1',
    activityId: 37, // Corrida
    calories: 100,
    durationS: 1800,
    distanceM: 5000,
    endAt: partial.startAt,
    hasRoute: false,
    ...partial,
  };
}

describe('filterByType', () => {
  it('filtra atividades pelo label do tipo', () => {
    const items = [
      act({ startAt: '2026-01-01T08:00:00', activityId: 37 }),
      act({ startAt: '2026-01-02T08:00:00', activityId: 50 }),
    ];
    expect(filterByType(items, 'Corrida').length).toBe(1);
  });
});

describe('applyFilters', () => {
  const items = [
    act({ startAt: '2026-03-01T08:00:00', distanceM: 5000, durationS: 1800, hasRoute: true, sourceName: 'Apple Watch' }),
    act({ startAt: '2026-03-10T08:00:00', distanceM: 12000, durationS: 3600, hasRoute: false, sourceName: 'iPhone' }),
  ];

  it('filtra por intervalo de datas', () => {
    expect(applyFilters(items, { from: '2026-03-05', to: '2026-03-31' }).length).toBe(1);
  });

  it('filtra por faixa de distância (km)', () => {
    expect(applyFilters(items, { minDistanceKm: 10 }).length).toBe(1);
  });

  it('filtra por rota', () => {
    expect(applyFilters(items, { hasRoute: 'yes' }).length).toBe(1);
    expect(applyFilters(items, { hasRoute: 'no' }).length).toBe(1);
    expect(applyFilters(items, { hasRoute: 'all' }).length).toBe(2);
  });

  it('filtra por fonte', () => {
    expect(applyFilters(items, { source: 'iPhone' }).length).toBe(1);
  });
});

describe('sortActivities', () => {
  const items = [
    act({ startAt: '2026-01-01T08:00:00', distanceM: 3000 }),
    act({ startAt: '2026-01-02T08:00:00', distanceM: 9000 }),
  ];

  it('ordena por distância desc', () => {
    expect(sortActivities(items, 'distance', 'desc')[0].distanceM).toBe(9000);
  });

  it('ordena por data asc', () => {
    expect(sortActivities(items, 'date', 'asc')[0].startAt).toBe('2026-01-01T08:00:00');
  });
});

describe('buildActivityList', () => {
  const activities = Array.from({ length: 25 }, (_, i) =>
    act({ startAt: `2026-01-${(i + 1).toString().padStart(2, '0')}T08:00:00`, activityId: 37 }),
  );

  it('pagina e reporta total/pageCount', () => {
    const r = buildActivityList(activities, 'Corrida', {
      filters: {}, sort: 'date', dir: 'desc', page: 1, pageSize: 10,
    });
    expect(r.total).toBe(25);
    expect(r.pageCount).toBe(3);
    expect(r.items.length).toBe(10);
  });

  it('clampa página acima do máximo', () => {
    const r = buildActivityList(activities, 'Corrida', {
      filters: {}, sort: 'date', dir: 'desc', page: 99, pageSize: 10,
    });
    expect(r.page).toBe(3);
    expect(r.items.length).toBe(5);
  });

  it('expõe fontes distintas', () => {
    const withSources = [
      act({ startAt: '2026-02-01T08:00:00', sourceName: 'Apple Watch' }),
      act({ startAt: '2026-02-02T08:00:00', sourceName: 'iPhone' }),
      act({ startAt: '2026-02-03T08:00:00', sourceName: 'Apple Watch' }),
    ];
    const r = buildActivityList(withSources, 'Corrida', {
      filters: {}, sort: 'date', dir: 'desc', page: 1, pageSize: 10,
    });
    expect(r.sources).toEqual(['Apple Watch', 'iPhone']);
  });
});
