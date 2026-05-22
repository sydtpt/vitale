import { describe, it, expect } from '@jest/globals';
import { runningHighlights } from '../running-highlights';
import type { Activity } from '@vitale/shared';

function run(over: Partial<Activity>): Activity {
  return {
    id: 'a',
    userId: 'u',
    activityId: 37,
    calories: 0,
    startAt: '2026-05-01T10:00:00.000Z',
    endAt: '2026-05-01T10:30:00.000Z',
    durationS: 1800,
    hasRoute: true,
    ...over,
  };
}

describe('runningHighlights', () => {
  it('sem corridas → vazio', () => {
    expect(runningHighlights([])).toEqual([]);
    expect(runningHighlights([run({ activityId: 50 })])).toEqual([]);
  });

  it('escolhe a maior distância e o melhor recorde por distância', () => {
    const acts = [
      run({ id: 'short-fast', distanceM: 5200, bestEfforts: { '1000': 240, '5000': 1300 } }),
      run({ id: 'long-slow', distanceM: 12000, bestEfforts: { '1000': 300, '5000': 1600, '10000': 3200 } }),
    ];
    const hi = runningHighlights(acts);
    const byKey = Object.fromEntries(hi.map((h) => [h.key, h]));

    expect(byKey['longest'].activityId).toBe('long-slow'); // 12 km
    expect(byKey['1000'].activityId).toBe('short-fast'); // 240 s < 300 s
    expect(byKey['5000'].activityId).toBe('short-fast'); // 1300 s < 1600 s
    expect(byKey['10000'].activityId).toBe('long-slow'); // só essa cobre 10 km
    expect(byKey['marathon']).toBeUndefined(); // ninguém correu maratona
  });

  it('formata o recorde como relógio e o pace na caption', () => {
    const hi = runningHighlights([run({ distanceM: 5000, bestEfforts: { '5000': 1500 } })]);
    const fiveK = hi.find((h) => h.key === '5000');
    expect(fiveK?.value).toBe('25:00');
    expect(fiveK?.caption).toBe('5:00 /km');
  });

  it('ignora corridas hidden', () => {
    const hi = runningHighlights([
      run({ id: 'visible', distanceM: 5000, bestEfforts: { '5000': 1500 } }),
      run({ id: 'gone', distanceM: 99000, bestEfforts: { '5000': 1000 }, hidden: true }),
    ]);
    expect(hi.find((h) => h.key === 'longest')?.activityId).toBe('visible');
    expect(hi.find((h) => h.key === '5000')?.activityId).toBe('visible');
  });
});
