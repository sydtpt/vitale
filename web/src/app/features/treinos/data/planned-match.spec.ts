import type { Activity, PlannedWorkout } from '@vitale/shared';
import { autoMatch, kindForActivity, localDateOf } from '@vitale/shared';

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

function plan(partial: Partial<PlannedWorkout> & { date: string; kind: PlannedWorkout['kind'] }): PlannedWorkout {
  return {
    id: Math.random().toString(36),
    type: 'Treino',
    durMin: 45,
    done: false,
    sort: 0,
    createdAt: '2026-06-01T00:00:00Z',
    ...partial,
  };
}

describe('kindForActivity', () => {
  it('classifica corrida/bike/natação como endurance', () => {
    expect(kindForActivity(37)).toBe('endurance'); // corrida
    expect(kindForActivity(13)).toBe('endurance'); // ciclismo
    expect(kindForActivity(46)).toBe('endurance'); // natação
  });
  it('classifica musculação/funcional como strength', () => {
    expect(kindForActivity(50)).toBe('strength');
    expect(kindForActivity(20)).toBe('strength');
  });
  it('classifica yoga/pilates como easy', () => {
    expect(kindForActivity(57)).toBe('easy'); // yoga
    expect(kindForActivity(66)).toBe('easy'); // pilates
  });
  it('classifica caminhada como endurance (é atividade com GPS)', () => {
    expect(kindForActivity(52)).toBe('endurance');
  });
});

describe('localDateOf', () => {
  it('extrai a data local do ISO', () => {
    expect(localDateOf('2026-06-03T08:30:00')).toBe('2026-06-03');
  });
});

describe('autoMatch', () => {
  it('marca done quando há atividade do mesmo dia e kind', () => {
    const out = autoMatch(
      [plan({ date: '2026-06-03', kind: 'endurance' })],
      [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })],
    );
    expect(out[0].done).toBe(true);
    expect(out[0].doneActivityId).toBeDefined();
  });

  it('casa por dia mesmo sem kind compatível (fallback)', () => {
    const out = autoMatch(
      [plan({ date: '2026-06-03', kind: 'strength' })],
      [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })], // corrida
    );
    expect(out[0].done).toBe(true);
  });

  it('prefere a atividade do kind compatível quando há várias', () => {
    const run = act({ startAt: '2026-06-03T07:00:00', activityId: 37 });
    const lift = act({ startAt: '2026-06-03T18:00:00', activityId: 50 });
    const out = autoMatch([plan({ date: '2026-06-03', kind: 'strength' })], [run, lift]);
    expect(out[0].doneActivityId).toBe(lift.id);
  });

  it('não marca done sem atividade no dia', () => {
    const out = autoMatch([plan({ date: '2026-06-03', kind: 'endurance' })], []);
    expect(out[0].done).toBe(false);
  });

  it('ignora atividades ocultas', () => {
    const out = autoMatch(
      [plan({ date: '2026-06-03', kind: 'endurance' })],
      [act({ startAt: '2026-06-03T07:00:00', hidden: true })],
    );
    expect(out[0].done).toBe(false);
  });

  it('rest nunca auto-completa', () => {
    const out = autoMatch(
      [plan({ date: '2026-06-03', kind: 'rest' })],
      [act({ startAt: '2026-06-03T07:00:00', activityId: 37 })],
    );
    expect(out[0].done).toBe(false);
  });

  it('reverte done quando a atividade some', () => {
    const out = autoMatch(
      [plan({ date: '2026-06-03', kind: 'endurance', done: true, doneActivityId: 'x' })],
      [],
    );
    expect(out[0].done).toBe(false);
    expect(out[0].doneActivityId).toBeUndefined();
  });
});
