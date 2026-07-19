/**
 * Filtro preventivo de stubs de ponte no sync HealthKit: só descarta stubs cuja
 * data cai dentro da cobertura do ingest server-side — stubs mais antigos são
 * a única fonte daqueles treinos e continuam subindo. Stub Garmin cai com
 * qualquer ponte conectada; cópia do app da Strava só com vínculo Strava.
 */
import { describe, it, expect, jest } from '@jest/globals';

// O módulo importa o client supabase (I/O) — irrelevante para o predicado puro.
jest.mock('../supabase', () => ({ supabase: {} }));

import {
  makeStubKeepPredicate,
  isGarminHkStub,
  isStravaHkStub,
  INGEST_COVERAGE_DAYS,
  type BridgeCoverage,
} from '../connections';

const DAY_MS = 24 * 3600_000;
const NOW = Date.UTC(2026, 6, 15, 12, 0, 0);
// Ponte conectada hoje ⇒ cobertura começa 90 dias atrás.
const COVERAGE_START = NOW - INGEST_COVERAGE_DAYS * DAY_MS;
// Vínculo Strava mais recente que a ponte mais antiga — prova que a cobertura
// Strava usa o connected_at DELE, não o mínimo global.
const STRAVA_COVERAGE_START = NOW - (INGEST_COVERAGE_DAYS - 30) * DAY_MS;

const none: BridgeCoverage = { anyStartMs: null, stravaStartMs: null };
const onlyIntervals: BridgeCoverage = { anyStartMs: COVERAGE_START, stravaStartMs: null };
const withStrava: BridgeCoverage = {
  anyStartMs: COVERAGE_START,
  stravaStartMs: STRAVA_COVERAGE_START,
};

const garminStub = (startMs: number) => ({
  sourceId: 'com.garmin.ConnectMobile',
  sourceName: 'Garmin Connect',
  start: new Date(startMs).toISOString(),
});

const stravaCopy = (startMs: number) => ({
  sourceId: 'com.strava.stravaride',
  sourceName: 'Strava',
  start: new Date(startMs).toISOString(),
});

const appleWorkout = (startMs: number) => ({
  sourceId: 'com.apple.health',
  sourceName: 'Apple Watch',
  start: new Date(startMs).toISOString(),
});

describe('makeStubKeepPredicate', () => {
  it('sem ponte conectada mantém tudo', () => {
    const keep = makeStubKeepPredicate(none);
    expect(keep(garminStub(NOW - DAY_MS))).toBe(true);
    expect(keep(stravaCopy(NOW - DAY_MS))).toBe(true);
    expect(keep(appleWorkout(NOW - DAY_MS))).toBe(true);
  });

  it('descarta stub Garmin dentro da cobertura com qualquer ponte conectada', () => {
    for (const coverage of [onlyIntervals, withStrava]) {
      const keep = makeStubKeepPredicate(coverage);
      expect(keep(garminStub(NOW - DAY_MS))).toBe(false);
      expect(keep(garminStub(COVERAGE_START))).toBe(false); // borda inclusiva
    }
  });

  it('mantém stub Garmin mais antigo que a cobertura (única fonte dele)', () => {
    const keep = makeStubKeepPredicate(withStrava);
    expect(keep(garminStub(COVERAGE_START - DAY_MS))).toBe(true);
    expect(keep(garminStub(COVERAGE_START - 365 * DAY_MS))).toBe(true);
  });

  it('descarta cópia do app da Strava só quando há vínculo Strava', () => {
    expect(makeStubKeepPredicate(withStrava)(stravaCopy(NOW - DAY_MS))).toBe(false);
    expect(makeStubKeepPredicate(onlyIntervals)(stravaCopy(NOW - DAY_MS))).toBe(true);
  });

  it('cobertura Strava usa o connected_at do vínculo Strava, não o mínimo global', () => {
    const keep = makeStubKeepPredicate(withStrava);
    // Dentro da cobertura global, mas antes do vínculo Strava − 90d ⇒ mantém.
    const beforeStrava = STRAVA_COVERAGE_START - DAY_MS;
    expect(keep(stravaCopy(beforeStrava))).toBe(true);
    expect(keep(stravaCopy(STRAVA_COVERAGE_START))).toBe(false); // borda inclusiva
  });

  it('nunca descarta treinos que não são stubs de ponte', () => {
    const keep = makeStubKeepPredicate(withStrava);
    expect(keep(appleWorkout(NOW - DAY_MS))).toBe(true);
  });

  it('isGarminHkStub reconhece por sourceId ou sourceName', () => {
    expect(isGarminHkStub({ sourceId: 'com.garmin.ConnectMobile', sourceName: undefined })).toBe(true);
    expect(isGarminHkStub({ sourceId: undefined, sourceName: 'Garmin Connect' })).toBe(true);
    expect(isGarminHkStub({ sourceId: 'com.apple.health', sourceName: 'Apple Watch' })).toBe(false);
  });

  it('isStravaHkStub reconhece por sourceId ou sourceName', () => {
    expect(isStravaHkStub({ sourceId: 'com.strava.stravaride', sourceName: undefined })).toBe(true);
    expect(isStravaHkStub({ sourceId: undefined, sourceName: 'Strava' })).toBe(true);
    expect(isStravaHkStub({ sourceId: 'com.apple.health', sourceName: 'Apple Watch' })).toBe(false);
  });
});
