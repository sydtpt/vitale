import { describe, it, expect } from '@jest/globals';
import { milesToMeters, METERS_PER_MILE } from '../workout-types';

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
