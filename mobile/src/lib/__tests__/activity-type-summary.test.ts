import { describe, it, expect } from '@jest/globals';
import type { Activity } from '@vitale/shared';
import { buildTypeSummaries } from '../activity-type-summary';

function act(partial: Partial<Activity> & { activityId: number; startAt: string }): Activity {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    userId: 'u1',
    activityName: undefined,
    calories: partial.calories ?? 0,
    endAt: partial.endAt ?? partial.startAt,
    durationS: partial.durationS ?? 0,
    distanceM: partial.distanceM,
    hasRoute: partial.hasRoute ?? false,
    hidden: false,
    ...partial,
  } as Activity;
}

describe('buildTypeSummaries', () => {
  it('agrega por tipo com somas all-time e ordena pelo treino mais recente', () => {
    const activities = [
      act({ activityId: 37, startAt: '2026-05-20T08:00:00', distanceM: 5000, durationS: 1800, calories: 300 }),
      act({ activityId: 37, startAt: '2026-05-19T08:00:00', distanceM: 3000, durationS: 1200, calories: 200 }),
      act({ activityId: 50, startAt: '2026-05-18T20:00:00', distanceM: 0, durationS: 3600, calories: 400 }),
    ];
    const summaries = buildTypeSummaries(activities);

    expect(summaries.map((s) => s.label)).toEqual(['Corrida', 'Musculação']);

    const corrida = summaries[0];
    expect(corrida.count).toBe(2);
    expect(corrida.totalDistanceM).toBe(8000);
    expect(corrida.totalDurationS).toBe(3000);
    expect(corrida.totalCalories).toBe(500);
    expect(corrida.hasDistance).toBe(true);
  });

  it('põe na frente o tipo praticado por último, mesmo com menos atividades', () => {
    const summaries = buildTypeSummaries([
      act({ activityId: 37, startAt: '2026-05-19T08:00:00' }),
      act({ activityId: 37, startAt: '2026-05-18T08:00:00' }),
      act({ activityId: 50, startAt: '2026-05-20T20:00:00', distanceM: 0 }),
    ]);
    expect(summaries.map((s) => s.label)).toEqual(['Musculação', 'Corrida']);
    expect(summaries[0].lastAtMs).toBe(new Date('2026-05-20T20:00:00').getTime());
  });

  it('marca tipos sem distância', () => {
    const summaries = buildTypeSummaries([
      act({ activityId: 50, startAt: '2026-05-18T20:00:00', distanceM: 0, durationS: 3600 }),
    ]);
    expect(summaries[0].hasDistance).toBe(false);
  });
});
