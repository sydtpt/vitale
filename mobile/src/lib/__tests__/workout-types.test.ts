import { describe, it, expect } from '@jest/globals';
import {
  milesToMeters,
  METERS_PER_MILE,
  pausedSecondsFromEvents,
  computeMovingTimeS,
} from '../workout-types';

describe('milesToMeters', () => {
  it('converte milhas do HealthKit para metros', () => {
    // 21.01 km de corrida chegam como ~13.05 milhas do nativo
    expect(milesToMeters(13.0549)).toBeCloseTo(21010, -1);
  });

  it('1 milha é 1609.344 m', () => {
    expect(milesToMeters(1)).toBe(METERS_PER_MILE);
  });

  it('0 (treino indoor sem distância) permanece 0', () => {
    expect(milesToMeters(0)).toBe(0);
  });

  it('undefined permanece undefined', () => {
    expect(milesToMeters(undefined)).toBeUndefined();
  });
});

describe('pausedSecondsFromEvents', () => {
  it('soma o intervalo de uma pausa manual', () => {
    const events = [
      { eventType: 'pause', startDate: '2026-05-01T10:10:00.000Z' },
      { eventType: 'resume', startDate: '2026-05-01T10:12:30.000Z' },
    ];
    expect(pausedSecondsFromEvents(events)).toBe(150);
  });

  it('une auto-pause sobreposto sem contar em dobro', () => {
    const events = [
      { eventType: 'motion paused', startDate: '2026-05-01T10:10:00.000Z' },
      { eventType: 'pause', startDate: '2026-05-01T10:10:30.000Z' },
      { eventType: 'resume', startDate: '2026-05-01T10:11:00.000Z' },
      { eventType: 'motion resumed', startDate: '2026-05-01T10:11:00.000Z' },
    ];
    expect(pausedSecondsFromEvents(events)).toBe(60);
  });

  it('sem eventos → zero', () => {
    expect(pausedSecondsFromEvents(undefined)).toBe(0);
    expect(pausedSecondsFromEvents([])).toBe(0);
  });

  it('ignora laps/marcadores', () => {
    const events = [
      { eventType: 'lap', startDate: '2026-05-01T10:05:00.000Z' },
      { eventType: 'pause', startDate: '2026-05-01T10:10:00.000Z' },
      { eventType: 'resume', startDate: '2026-05-01T10:11:00.000Z' },
    ];
    expect(pausedSecondsFromEvents(events)).toBe(60);
  });
});

describe('computeMovingTimeS', () => {
  const start = '2026-05-01T10:00:00.000Z';
  const end = '2026-05-01T10:30:00.000Z'; // 1800s decorridos

  it('desconta as pausas do tempo decorrido', () => {
    const moving = computeMovingTimeS({
      start,
      end,
      durationS: 1800,
      events: [
        { eventType: 'pause', startDate: '2026-05-01T10:10:00.000Z' },
        { eventType: 'resume', startDate: '2026-05-01T10:15:00.000Z' }, // 300s pausado
      ],
    });
    expect(moving).toBe(1500);
  });

  it('sem pausas → igual ao tempo total', () => {
    expect(computeMovingTimeS({ start, end, durationS: 1800 })).toBe(1800);
  });

  it('nunca passa da duração do HealthKit (que já pode excluir pausas)', () => {
    // HK já reporta 1700 (excluiu pausas) e não há eventos expostos → usa 1700.
    expect(computeMovingTimeS({ start, end, durationS: 1700 })).toBe(1700);
  });

  it('cai para a duração quando início/fim são inválidos', () => {
    expect(computeMovingTimeS({ start: 'x', end: 'y', durationS: 1234 })).toBe(1234);
  });
});
