import { describe, it, expect } from '@jest/globals';
import { activityHighlights, runningHighlights } from '../running-highlights';
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

const DAY_MS = 24 * 60 * 60 * 1000;
function ride(over: Partial<Activity>, daysAgo = 30): Activity {
  const start = new Date(Date.now() - daysAgo * DAY_MS);
  return {
    id: 'b',
    userId: 'u',
    activityId: 13,
    calories: 0,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3600_000).toISOString(),
    durationS: 3600,
    hasRoute: true,
    ...over,
  };
}

describe('cyclingHighlights (recordes de elevação)', () => {
  it('maior elevação aponta para a pedalada recordista; 12 meses agrega sem link', () => {
    const hi = activityHighlights(
      [
        ride({ id: 'hilly', distanceM: 40000, elevationM: 850 }),
        ride({ id: 'flat', distanceM: 60000, elevationM: 120 }),
      ],
      13,
    );
    const byKey = Object.fromEntries(hi.map((h) => [h.key, h]));

    expect(byKey['maxElev'].activityId).toBe('hilly');
    expect(byKey['maxElev'].value).toBe('850 m');
    expect(byKey['maxElev'].group).toBe('record');
    expect(byKey['elev12mo'].value).toBe('970 m');
    expect(byKey['elev12mo'].activityId).toBeUndefined();
    expect(byKey['elev12mo'].caption).toBe('2 pedaladas');
  });

  it('pedalada antiga conta para a maior elevação, mas não para os 12 meses', () => {
    const hi = activityHighlights(
      [
        ride({ id: 'old-epic', elevationM: 2000 }, 400),
        ride({ id: 'recent', elevationM: 300 }, 10),
      ],
      13,
    );
    const byKey = Object.fromEntries(hi.map((h) => [h.key, h]));

    expect(byKey['maxElev'].activityId).toBe('old-epic');
    expect(byKey['elev12mo'].value).toBe('300 m');
    expect(byKey['elev12mo'].caption).toBe('1 pedalada');
  });

  it('sem elevação → sem cards de elevação; corrida nunca os exibe', () => {
    const semElev = activityHighlights([ride({ distanceM: 20000 })], 13);
    expect(semElev.find((h) => h.key === 'maxElev')).toBeUndefined();
    expect(semElev.find((h) => h.key === 'elev12mo')).toBeUndefined();

    const corrida = runningHighlights([run({ distanceM: 10000, elevationM: 500 })]);
    expect(corrida.find((h) => h.key === 'maxElev')).toBeUndefined();
    expect(corrida.find((h) => h.key === 'elev12mo')).toBeUndefined();
  });
});
