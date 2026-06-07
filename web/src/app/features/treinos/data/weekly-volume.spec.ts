import type { Activity } from '@vitale/shared';
import { buildWeeklyVolume } from './weekly-volume';

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

// Quarta-feira 2026-06-03 → semana de seg 2026-06-01.
const NOW = new Date(2026, 5, 3, 12, 0, 0);

describe('buildWeeklyVolume — distance (km)', () => {
  it('devolve N buckets terminando na semana atual', () => {
    const out = buildWeeklyVolume([], 37, 'distance', 6, NOW);
    expect(out.length).toBe(6);
    expect(out[5].key).toBe('2026-06-01');
  });

  it('soma km e conta sessões da semana', () => {
    const out = buildWeeklyVolume(
      [
        act({ startAt: '2026-06-02T07:00:00', distanceM: 5200 }),
        act({ startAt: '2026-06-04T07:00:00', distanceM: 8100 }),
      ],
      37, 'distance', 6, NOW,
    );
    expect(out[5].value).toBe(13.3);
    expect(out[5].count).toBe(2);
  });

  it('filtra por activityId, ocultas e sem distância', () => {
    const out = buildWeeklyVolume(
      [
        act({ startAt: '2026-06-02T07:00:00', activityId: 13, distanceM: 20000 }),
        act({ startAt: '2026-06-02T07:00:00', hidden: true, distanceM: 5000 }),
        act({ startAt: '2026-06-02T07:00:00', distanceM: 0 }),
        act({ startAt: '2026-06-02T07:00:00', distanceM: 5000 }),
      ],
      37, 'distance', 6, NOW,
    );
    expect(out[5].value).toBe(5);
    expect(out[5].count).toBe(1);
  });

  it('aloca na semana correta', () => {
    const out = buildWeeklyVolume(
      [act({ startAt: '2026-05-26T07:00:00', distanceM: 10000 })],
      37, 'distance', 6, NOW,
    );
    expect(out[5].value).toBe(0);
    expect(out[4].value).toBe(10);
  });
});

describe('buildWeeklyVolume — duration (min)', () => {
  it('soma minutos das sessões (yoga sem distância)', () => {
    const out = buildWeeklyVolume(
      [
        act({ startAt: '2026-06-02T07:00:00', activityId: 57, durationS: 1800, distanceM: 0 }),
        act({ startAt: '2026-06-03T07:00:00', activityId: 57, durationS: 2700, distanceM: 0 }),
      ],
      57, 'duration', 6, NOW,
    );
    expect(out[5].value).toBe(75); // 30 + 45 min
    expect(out[5].count).toBe(2);
  });
});
