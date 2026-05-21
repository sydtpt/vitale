import type { Activity } from '@vitale/shared';
import { buildTypeSummaries } from './type-summary';

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

describe('buildTypeSummaries', () => {
  it('agrupa por tipo e soma os agregados de todo o histórico', () => {
    const summaries = buildTypeSummaries([
      act({ startAt: '2026-01-01T08:00:00', activityId: 37, distanceM: 5000, durationS: 1800, calories: 300 }),
      act({ startAt: '2026-02-01T08:00:00', activityId: 37, distanceM: 3000, durationS: 1200, calories: 200 }),
      act({ startAt: '2026-03-01T08:00:00', activityId: 50, distanceM: undefined, durationS: 3600, calories: 250 }),
    ]);

    const corrida = summaries.find((s) => s.label === 'Corrida');
    expect(corrida?.count).toBe(2);
    expect(corrida?.distanceM).toBe(8000);
    expect(corrida?.hasDistance).toBe(true);

    const musc = summaries.find((s) => s.label === 'Musculação');
    expect(musc?.count).toBe(1);
    expect(musc?.distanceM).toBe(0);
    expect(musc?.hasDistance).toBe(false);
    expect(musc?.durationS).toBe(3600);
    expect(musc?.calories).toBe(250);
  });

  it('ordena por contagem desc', () => {
    const summaries = buildTypeSummaries([
      act({ startAt: '2026-01-01T08:00:00', activityId: 50, distanceM: undefined }),
      act({ startAt: '2026-01-02T08:00:00', activityId: 37 }),
      act({ startAt: '2026-01-03T08:00:00', activityId: 37 }),
    ]);
    expect(summaries[0].label).toBe('Corrida');
  });

  it('expõe slug do tipo para a rota', () => {
    const [s] = buildTypeSummaries([act({ startAt: '2026-01-01T08:00:00', activityId: 37 })]);
    expect(s.slug).toBe('corrida');
  });
});
