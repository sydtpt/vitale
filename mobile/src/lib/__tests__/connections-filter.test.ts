/**
 * Filtro preventivo de stubs Garmin no sync HealthKit: só descarta stubs cuja
 * data cai dentro da cobertura do ingest server-side — stubs mais antigos são
 * a única fonte daqueles treinos e continuam subindo.
 */
import { describe, it, expect, jest } from '@jest/globals';

// O módulo importa o client supabase (I/O) — irrelevante para o predicado puro.
jest.mock('../supabase', () => ({ supabase: {} }));

import { makeStubKeepPredicate, isGarminHkStub, INGEST_COVERAGE_DAYS } from '../connections';

const DAY_MS = 24 * 3600_000;
const NOW = Date.UTC(2026, 6, 15, 12, 0, 0);
// Ponte conectada hoje ⇒ cobertura começa 90 dias atrás.
const COVERAGE_START = NOW - INGEST_COVERAGE_DAYS * DAY_MS;

const garminStub = (startMs: number) => ({
  sourceId: 'com.garmin.ConnectMobile',
  sourceName: 'Garmin Connect',
  start: new Date(startMs).toISOString(),
});

const appleWorkout = (startMs: number) => ({
  sourceId: 'com.apple.health',
  sourceName: 'Apple Watch',
  start: new Date(startMs).toISOString(),
});

describe('makeStubKeepPredicate', () => {
  it('sem ponte conectada (coverage null) mantém tudo', () => {
    const keep = makeStubKeepPredicate(null);
    expect(keep(garminStub(NOW - DAY_MS))).toBe(true);
    expect(keep(appleWorkout(NOW - DAY_MS))).toBe(true);
  });

  it('descarta stub Garmin dentro da cobertura do ingest', () => {
    const keep = makeStubKeepPredicate(COVERAGE_START);
    expect(keep(garminStub(NOW - DAY_MS))).toBe(false);
    expect(keep(garminStub(COVERAGE_START))).toBe(false); // borda inclusiva
  });

  it('mantém stub Garmin mais antigo que a cobertura (única fonte dele)', () => {
    const keep = makeStubKeepPredicate(COVERAGE_START);
    expect(keep(garminStub(COVERAGE_START - DAY_MS))).toBe(true);
    expect(keep(garminStub(COVERAGE_START - 365 * DAY_MS))).toBe(true);
  });

  it('nunca descarta treinos que não são stubs Garmin', () => {
    const keep = makeStubKeepPredicate(COVERAGE_START);
    expect(keep(appleWorkout(NOW - DAY_MS))).toBe(true);
    expect(keep({ sourceId: 'com.strava.stravaride', sourceName: 'Strava', start: new Date(NOW).toISOString() })).toBe(true);
  });

  it('isGarminHkStub reconhece por sourceId ou sourceName', () => {
    expect(isGarminHkStub({ sourceId: 'com.garmin.ConnectMobile', sourceName: undefined })).toBe(true);
    expect(isGarminHkStub({ sourceId: undefined, sourceName: 'Garmin Connect' })).toBe(true);
    expect(isGarminHkStub({ sourceId: 'com.apple.health', sourceName: 'Apple Watch' })).toBe(false);
  });
});
