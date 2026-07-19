/**
 * Cenários de dedupe/merge cross-source (`fitness/dedupe.ts` do shared): o mesmo
 * treino físico chegando por HealthKit (Apple Watch ou stub do Garmin Connect),
 * Strava e intervals.icu deve casar numa única linha canônica; treinos distintos
 * não podem casar.
 */
import { describe, it, expect } from '@jest/globals';
import {
  mapStravaSport,
  mapIntervalsType,
  ACTIVITY_ID_OTHER,
  activityFamily,
  overlapRatio,
  isSameWorkout,
  findMatch,
  isGarminSource,
  isStravaSource,
  richnessScore,
  planMerge,
  type MatchWindow,
  type MergeTarget,
  type MergeIncoming,
} from '@vitale/shared';

const T0 = Date.UTC(2026, 6, 10, 7, 0, 0);
const iso = (offsetS: number) => new Date(T0 + offsetS * 1000).toISOString();

/** Janela de treino: corrida de 40 min começando em T0+startS. */
function win(activityId: number, startS: number, durS: number): MatchWindow {
  return { activityId, startAt: iso(startS), endAt: iso(startS + durS) };
}

/** Linha persistida típica vinda do stub Garmin Connect → HealthKit. */
function garminStubTarget(overrides: Partial<MergeTarget> = {}): MergeTarget {
  return {
    id: 'ABC-123',
    ...win(37, 0, 2400),
    provider: 'healthkit',
    sourceId: 'com.garmin.ConnectMobile',
    sourceName: 'Garmin Connect',
    routePointCount: 0,
    hasHrData: false,
    distanceM: 8000,
    ...overrides,
  };
}

/** Treino entrante rico vindo do intervals.icu (mesmo FIT do stub acima). */
function intervalsIncoming(overrides: Partial<MergeIncoming> = {}): MergeIncoming {
  return {
    provider: 'intervals',
    externalId: 'i77001',
    activityName: 'Corrida da manhã',
    ...win(37, 2, 2395), // mesmos segundos do FIT, borda levemente aparada
    routePointCount: 2400,
    hasHrData: true,
    distanceM: 8100,
    ...overrides,
  };
}

describe('mapa de tipos', () => {
  it('mapeia esportes conhecidos para os códigos HK do app', () => {
    expect(mapStravaSport('Run')).toBe(37);
    expect(mapStravaSport('TrailRun')).toBe(37);
    expect(mapStravaSport('VirtualRide')).toBe(13);
    expect(mapStravaSport('Walk')).toBe(52);
    expect(mapStravaSport('Hike')).toBe(24);
    expect(mapStravaSport('OpenWaterSwim')).toBe(46);
    expect(mapStravaSport('WeightTraining')).toBe(50);
    expect(mapIntervalsType('Rowing')).toBe(35);
    expect(mapIntervalsType('Ride')).toBe(13);
  });

  it('desconhecidos caem em "Outro" (3000), nunca num tipo real', () => {
    expect(mapStravaSport('Windsurf')).toBe(ACTIVITY_ID_OTHER);
    expect(mapStravaSport(undefined)).toBe(ACTIVITY_ID_OTHER);
    expect(mapIntervalsType(null)).toBe(ACTIVITY_ID_OTHER);
    expect(activityFamily(ACTIVITY_ID_OTHER)).toBe('generic');
  });
});

describe('match temporal', () => {
  it('casa stub Garmin × intervals (mesmo FIT, bordas aparadas)', () => {
    expect(isSameWorkout(win(37, 0, 2400), win(37, 2, 2395))).toBe(true);
    expect(overlapRatio(win(37, 0, 2400), win(37, 2, 2395))).toBeGreaterThan(0.99);
  });

  it('casa corrida Apple Watch × Strava com famílias diferentes de rótulo (corrida × caminhada)', () => {
    // Garmin classifica como Walk o que o Watch gravou como corrida leve.
    expect(isSameWorkout(win(37, 0, 3000), win(52, 10, 2980))).toBe(true);
  });

  it('rejeita famílias incompatíveis mesmo com horário idêntico', () => {
    expect(isSameWorkout(win(37, 0, 2400), win(13, 0, 2400))).toBe(false); // corrida × ciclismo
    expect(isSameWorkout(win(46, 0, 2400), win(35, 0, 2400))).toBe(false); // natação × remo
  });

  it('rejeita treinos sem sobreposição suficiente', () => {
    expect(isSameWorkout(win(37, 0, 1800), win(37, 7200, 1800))).toBe(false); // manhã × tarde
    expect(isSameWorkout(win(37, 0, 3600), win(37, 2700, 3600))).toBe(false); // 25% de overlap
  });

  it('borda: |Δstart| ≤ 3min e |Δend| ≤ 5min casa mesmo com ratio < 0.5 (stub aparado)', () => {
    // Stub de 2 min dentro de um treino de 40 min: ratio alto pelo mais curto — já casa.
    // Caso real da regra: durações ~iguais com deslocamento pequeno.
    expect(isSameWorkout(win(50, 0, 300), win(50, 170, 320))).toBe(true);
  });

  it('findMatch escolhe o candidato com maior sobreposição', () => {
    const incoming = win(37, 0, 2400);
    const far = { ...win(37, 2000, 2400), id: 'far' };
    const near = { ...win(37, 5, 2390), id: 'near' };
    expect(findMatch(incoming, [far, near])?.id).toBe('near');
    expect(findMatch(incoming, [{ ...win(13, 0, 2400), id: 'bike' }])).toBeNull();
  });
});

describe('riqueza e merge', () => {
  it('detecta a fonte Garmin no HealthKit por sourceId ou sourceName', () => {
    expect(isGarminSource('com.garmin.ConnectMobile', null)).toBe(true);
    expect(isGarminSource(null, 'Garmin Connect')).toBe(true);
    expect(isGarminSource('com.apple.health', 'Apple Watch de Sydnei')).toBe(false);
  });

  it('detecta a fonte Strava no HealthKit por sourceId ou sourceName', () => {
    expect(isStravaSource('com.strava.stravaride', null)).toBe(true);
    expect(isStravaSource(null, 'Strava')).toBe(true);
    expect(isStravaSource('com.apple.health', 'Apple Watch de Sydnei')).toBe(false);
  });

  it('cópia Strava-HK é stub pobre; linha do ingest Strava mantém o rank de provider', () => {
    const stravaHkCopy = garminStubTarget({
      sourceId: 'com.strava.stravaride',
      sourceName: 'Strava',
    });
    const appleNative = garminStubTarget({
      sourceId: 'com.apple.health',
      sourceName: 'Apple Watch',
    });
    expect(richnessScore(stravaHkCopy)).toBeLessThan(richnessScore(appleNative));
    // Linha criada pelo ingest (provider='strava', source_name='Strava'): o
    // branch de provider ganha antes do sourceName — não é demovida a stub.
    const ingestRow = garminStubTarget({
      provider: 'strava',
      sourceId: 'strava',
      sourceName: 'Strava',
    });
    expect(richnessScore(ingestRow)).toBeGreaterThan(richnessScore(appleNative));
  });

  it('entrante rico sobre cópia Strava-HK: corrige tempos (duração = elapsed)', () => {
    const stravaHkCopy = garminStubTarget({
      sourceId: 'com.strava.stravaride',
      sourceName: 'Strava',
    });
    const plan = planMerge(intervalsIncoming(), stravaHkCopy);
    expect(plan.incomingRicher).toBe(true);
    expect(plan.overwriteTimes).toBe(true);
    expect(plan.attachRoute).toBe(true);
  });

  it('intervals com rota+FC > stub Garmin sem rota', () => {
    expect(richnessScore(intervalsIncoming())).toBeGreaterThan(richnessScore(garminStubTarget()));
  });

  it('stub Garmin atrasado NÃO sobrescreve linha rica já mesclada', () => {
    const richTarget = garminStubTarget({
      provider: 'intervals',
      sourceId: null,
      sourceName: null,
      routePointCount: 2400,
      hasHrData: true,
    });
    const lateStub: MergeIncoming = {
      provider: 'healthkit',
      externalId: 'HK-STUB-1',
      sourceId: 'com.garmin.ConnectMobile',
      sourceName: 'Garmin Connect',
      ...win(37, 0, 2400),
      routePointCount: 0,
      hasHrData: false,
      distanceM: 8000,
    };
    const plan = planMerge(lateStub, richTarget);
    expect(plan.incomingRicher).toBe(false);
    expect(plan.setName).toBe(false);
    expect(plan.setDuration).toBe(false);
    expect(plan.attachRoute).toBe(false);
    expect(plan.overwriteTimes).toBe(false);
  });

  it('entrante rico sobre stub Garmin: sobrescreve métricas, tempos e anexa rota', () => {
    const plan = planMerge(intervalsIncoming(), garminStubTarget());
    expect(plan.incomingRicher).toBe(true);
    expect(plan.overwriteTimes).toBe(true); // alvo é stub Garmin → tempos do FIT valem
    expect(plan.setName).toBe(true);
    expect(plan.setDuration).toBe(true);
    expect(plan.attachRoute).toBe(true);
  });

  it('entrante rico sobre treino nativo do Apple Watch: NÃO reescreve tempos', () => {
    const appleTarget = garminStubTarget({
      sourceId: 'com.apple.health',
      sourceName: 'Apple Watch',
      routePointCount: 800,
      hasHrData: true,
    });
    const plan = planMerge(intervalsIncoming(), appleTarget);
    expect(plan.overwriteTimes).toBe(false);
    // Rota só troca se a entrante tiver mais pontos.
    expect(plan.attachRoute).toBe(true);
    const fewerPoints = planMerge(intervalsIncoming({ routePointCount: 100 }), appleTarget);
    expect(fewerPoints.attachRoute).toBe(false);
  });

  it('preserva edições do usuário (name_edited / duration_edited)', () => {
    const plan = planMerge(
      intervalsIncoming(),
      garminStubTarget({ nameEdited: true, durationEdited: true }),
    );
    expect(plan.incomingRicher).toBe(true);
    expect(plan.setName).toBe(false);
    expect(plan.setDuration).toBe(false);
  });

  it('re-merge idempotente: mesma fonte re-aplicada não é "mais rica" que ela mesma', () => {
    const merged = garminStubTarget({
      provider: 'intervals',
      sourceId: null,
      sourceName: null,
      routePointCount: 2400,
      hasHrData: true,
      distanceM: 8100,
    });
    const plan = planMerge(intervalsIncoming(), merged);
    expect(plan.incomingRicher).toBe(false);
    expect(plan.attachRoute).toBe(false);
  });
});
