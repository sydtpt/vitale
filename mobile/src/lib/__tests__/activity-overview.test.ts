import { describe, it, expect } from '@jest/globals';
import type { Activity } from '@vitale/shared';
import { buildOverview } from '../activity-overview';

function act(partial: Partial<Activity> & { startAt: string }): Activity {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    userId: 'u1',
    activityId: partial.activityId ?? 37, // Corrida por padrão
    activityName: undefined,
    calories: partial.calories ?? 0,
    endAt: partial.endAt ?? partial.startAt,
    durationS: partial.durationS ?? 0,
    distanceM: partial.distanceM,
    hasRoute: partial.hasRoute ?? false,
    hidden: partial.hidden ?? false,
    ...partial,
  } as Activity;
}

describe('buildOverview', () => {
  const now = new Date(2026, 4, 20); // 20 mai 2026 (mês 4 = maio)

  it('semana: gera 7 buckets diários e soma a métrica no dia certo', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 5000, durationS: 1800, calories: 300 }),
      act({ startAt: '2026-05-20T18:00:00', distanceM: 3000, durationS: 1200, calories: 200 }),
      act({ startAt: '2026-05-18T07:00:00', distanceM: 10000, durationS: 3600, calories: 600 }),
    ];
    const ov = buildOverview(activities, 'semana', 'distance', now);

    expect(ov.buckets).toHaveLength(7);
    expect(ov.totals.count).toBe(3);
    expect(ov.totals.distanceM).toBe(18000);

    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.total).toBe(8000); // duas corridas de hoje somadas
  });

  it('janela móvel: ignora atividades fora dos 7 dias', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 5000 }),
      act({ startAt: '2026-05-01T08:00:00', distanceM: 9999 }), // fora da semana
    ];
    const ov = buildOverview(activities, 'semana', 'distance', now);
    expect(ov.totals.count).toBe(1);
    expect(ov.totals.distanceM).toBe(5000);
  });

  it('ano: 12 buckets mensais', () => {
    const ov = buildOverview([act({ startAt: '2026-05-10T08:00:00' })], 'ano', 'count', now);
    expect(ov.buckets).toHaveLength(12);
    expect(ov.buckets[ov.buckets.length - 1].total).toBe(1); // mês atual
  });

  it('separa segmentos por tipo dentro do mesmo bucket', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', durationS: 1800 }), // Corrida
      act({ activityId: 50, startAt: '2026-05-20T20:00:00', durationS: 3600 }), // Musculação
    ];
    const ov = buildOverview(activities, 'semana', 'duration', now);
    const today = ov.buckets[ov.buckets.length - 1];
    expect(today.segments).toHaveLength(2);
    expect(ov.legend.map((l) => l.label).sort()).toEqual(['Corrida', 'Musculação']);
  });

  it('métrica count conta atividades independente da grandeza', () => {
    const activities = [
      act({ startAt: '2026-05-20T08:00:00', distanceM: 0, durationS: 0 }),
      act({ startAt: '2026-05-20T09:00:00', distanceM: 0, durationS: 0 }),
    ];
    const ov = buildOverview(activities, 'semana', 'count', now);
    expect(ov.buckets[ov.buckets.length - 1].total).toBe(2);
  });
});
