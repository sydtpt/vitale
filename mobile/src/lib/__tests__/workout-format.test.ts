import { describe, it, expect } from '@jest/globals';
import { formatPace, formatSpeed, formatRate } from '../workout-format';

describe('formatPace', () => {
  it('5 km em 25 min → 5:00 /km', () => {
    expect(formatPace(5000, 1500)).toBe('5:00');
  });

  it('arredonda os segundos do ritmo', () => {
    expect(formatPace(1000, 330)).toBe('5:30');
  });

  it('sem distância/tempo → null', () => {
    expect(formatPace(0, 100)).toBeNull();
    expect(formatPace(1000, 0)).toBeNull();
  });
});

describe('formatSpeed', () => {
  it('10 km em 30 min → 20.0 km/h', () => {
    expect(formatSpeed(10000, 1800)).toBe('20.0');
  });
});

describe('formatRate', () => {
  it('corrida (37) usa pace', () => {
    expect(formatRate(37, 5000, 1500)).toEqual({ value: '5:00', caption: 'pace' });
  });

  it('ciclismo (13) usa velocidade km/h', () => {
    expect(formatRate(13, 10000, 1800)).toEqual({ value: '20.0', caption: 'km/h' });
  });

  it('caminhada (52) usa min/km', () => {
    expect(formatRate(52, 5000, 1500)).toEqual({ value: '5:00', caption: 'min/km' });
  });

  it('sem distância → null', () => {
    expect(formatRate(37, 0, 1500)).toBeNull();
  });
});
