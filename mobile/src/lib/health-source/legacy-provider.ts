/**
 * Implementação da porta sobre `react-native-health` — a biblioteca que o Orbe
 * usa desde o início.
 *
 * É **tradução fiel**: cada operação faz exatamente a mesma chamada nativa, com
 * as mesmas opções, que o código dos consumidores fazia antes de existir a
 * porta. Nada de comportamento novo aqui — é o lado de referência da migração,
 * contra o qual o adaptador novo é comparado.
 *
 * Todo o dialeto da lib fica confinado neste arquivo: nomes de método em
 * string, callbacks de erro-primeiro, unidades impostas por tipo e o mapa de
 * permissões. Fora daqui, o app só conhece identificadores do HealthKit.
 */
import { NativeAppEventEmitter, Platform } from 'react-native';
import AppleHealthKit from 'react-native-health';
import {
  HK,
  type HealthCharacteristics,
  type HealthRange,
  type HealthSource,
  type HealthTypeId,
  type QueryOptions,
  type RawActivityRings,
  type RawRouteLocation,
  type RawSample,
  type RawSourcedSample,
  type RawWorkoutDelta,
} from './contract';

/**
 * Identificador do HealthKit → nome do método em `react-native-health`.
 *
 * O sono aparece aqui porque, nesta lib, categórica e quantitativa passam pelo
 * mesmo formato de chamada — a distinção só existe no HealthKit.
 */
const METHOD_BY_TYPE: Partial<Record<HealthTypeId, string>> = {
  [HK.heartRate]: 'getHeartRateSamples',
  [HK.restingHeartRate]: 'getRestingHeartRateSamples',
  [HK.heartRateVariability]: 'getHeartRateVariabilitySamples',
  [HK.vo2Max]: 'getVo2MaxSamples',
  [HK.oxygenSaturation]: 'getOxygenSaturationSamples',
  [HK.respiratoryRate]: 'getRespiratoryRateSamples',
  [HK.bloodPressureSystolic]: 'getBloodPressureSamples',
  [HK.bodyMass]: 'getWeightSamples',
  [HK.bodyMassIndex]: 'getBmiSamples',
  [HK.bodyFatPercentage]: 'getBodyFatPercentageSamples',
  [HK.leanBodyMass]: 'getLeanBodyMassSamples',
  [HK.waistCircumference]: 'getWaistCircumferenceSamples',
  [HK.appleExerciseTime]: 'getAppleExerciseTime',
  [HK.sleepAnalysis]: 'getSleepSamples',
  [HK.dietaryWater]: 'getWaterSamples',
  [HK.dietaryEnergyConsumed]: 'getEnergyConsumedSamples',
  [HK.dietaryProtein]: 'getProteinSamples',
  [HK.dietaryCarbohydrates]: 'getCarbohydratesSamples',
  [HK.dietaryFatTotal]: 'getTotalFatSamples',
};

/**
 * Identificador → nome do tipo no `getSamples` desta lib, que tem vocabulário
 * próprio: 'Running' aqui significa DistanceWalkingRunning.
 */
const SOURCED_TYPE_BY_ID: Partial<Record<HealthTypeId, string>> = {
  [HK.stepCount]: 'StepCount',
  [HK.distanceWalkingRunning]: 'Running',
  [HK.flightsClimbed]: 'StairClimbing',
  [HK.activeEnergyBurned]: 'ActiveEnergyBurned',
};

/** Identificador → chave em `AppleHealthKit.Constants.Permissions`. */
const PERMISSION_BY_TYPE: Partial<Record<HealthTypeId, string>> = {
  [HK.stepCount]: 'StepCount',
  [HK.distanceWalkingRunning]: 'DistanceWalkingRunning',
  [HK.flightsClimbed]: 'FlightsClimbed',
  [HK.activeEnergyBurned]: 'ActiveEnergyBurned',
  [HK.basalEnergyBurned]: 'BasalEnergyBurned',
  [HK.appleExerciseTime]: 'AppleExerciseTime',
  [HK.heartRate]: 'HeartRate',
  [HK.restingHeartRate]: 'RestingHeartRate',
  [HK.heartRateVariability]: 'HeartRateVariability',
  [HK.vo2Max]: 'Vo2Max',
  [HK.oxygenSaturation]: 'OxygenSaturation',
  [HK.respiratoryRate]: 'RespiratoryRate',
  [HK.bloodPressureSystolic]: 'BloodPressureSystolic',
  [HK.bloodPressureDiastolic]: 'BloodPressureDiastolic',
  [HK.bodyMass]: 'Weight',
  [HK.bodyMassIndex]: 'BodyMassIndex',
  [HK.bodyFatPercentage]: 'BodyFatPercentage',
  [HK.leanBodyMass]: 'LeanBodyMass',
  [HK.waistCircumference]: 'WaistCircumference',
  [HK.sleepAnalysis]: 'SleepAnalysis',
  [HK.dietaryWater]: 'Water',
  [HK.dietaryEnergyConsumed]: 'EnergyConsumed',
  [HK.dietaryProtein]: 'Protein',
  [HK.dietaryCarbohydrates]: 'Carbohydrates',
  [HK.dietaryFatTotal]: 'FatTotal',
  [HK.workout]: 'Workout',
  [HK.workoutRoute]: 'WorkoutRoute',
  [HK.activitySummary]: 'ActivitySummary',
  [HK.dateOfBirth]: 'DateOfBirth',
  [HK.biologicalSex]: 'BiologicalSex',
  [HK.bloodType]: 'BloodType',
};

/** Mapas expostos para o teste de cobertura — nenhum tipo do `HK` pode ficar órfão. */
export const LEGACY_MAPS = { METHOD_BY_TYPE, SOURCED_TYPE_BY_ID, PERMISSION_BY_TYPE };

const isIos = () => Platform.OS === 'ios';

/**
 * Chamada genérica: método por nome, callback erro-primeiro, array de resultado.
 * Resolve `[]` em qualquer falha — o contrato da porta diz que nada rejeita.
 */
function callArray<T>(method: string | undefined, options: Record<string, unknown>): Promise<T[]> {
  if (!isIos() || !method) return Promise.resolve([]);
  return new Promise((resolve) => {
    const fn = (AppleHealthKit as unknown as Record<string, unknown>)[method];
    if (typeof fn !== 'function') return resolve([]);
    try {
      (fn as (o: unknown, cb: (e: unknown, r: unknown) => void) => void)(options, (err, results) => {
        if (err || !Array.isArray(results)) return resolve([]);
        resolve(results as T[]);
      });
    } catch {
      resolve([]);
    }
  });
}

/** Chamada de valor único (características). Resolve `undefined` em falha. */
function callOne<T>(method: string, options: Record<string, unknown> = {}): Promise<T | undefined> {
  if (!isIos()) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const fn = (AppleHealthKit as unknown as Record<string, unknown>)[method];
    if (typeof fn !== 'function') return resolve(undefined);
    try {
      (fn as (o: unknown, cb: (e: unknown, r: unknown) => void) => void)(options, (err, r) => {
        resolve(err ? undefined : (r as T));
      });
    } catch {
      resolve(undefined);
    }
  });
}

/** Opções comuns, traduzidas para o formato desta lib. */
function baseOptions(options: QueryOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {
    startDate: options.startDate,
    endDate: options.endDate,
  };
  if (options.ascending !== undefined) out.ascending = options.ascending;
  if (options.includeManuallyAdded !== undefined) {
    out.includeManuallyAdded = options.includeManuallyAdded;
  }
  if (options.unit !== undefined) out.unit = options.unit;
  return out;
}

export const legacyHealthSource: HealthSource = {
  id: 'react-native-health',

  isAvailable: () => isIos(),

  requestReadAuthorization(types) {
    if (!isIos()) return Promise.resolve(false);
    const permissions = AppleHealthKit.Constants.Permissions as unknown as Record<string, string>;
    const read = types
      .map((t) => PERMISSION_BY_TYPE[t])
      .filter((k): k is string => typeof k === 'string')
      .map((k) => permissions[k])
      .filter((p): p is string => typeof p === 'string');
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit({ permissions: { read, write: [] } } as never, (err: string) => {
        // O HealthKit não revela negação de leitura: sem erro = liberado a consultar.
        resolve(!err);
      });
    });
  },

  queryQuantitySamples(type, options) {
    return callArray<RawSample>(METHOD_BY_TYPE[type], baseOptions(options));
  },

  queryAggregatedSamples(type, options) {
    return callArray<RawSample>(METHOD_BY_TYPE[type], {
      ...baseOptions(options),
      period: options.periodMinutes ?? 1440,
    });
  },

  querySourcedSamples(type, options) {
    const nativeType = SOURCED_TYPE_BY_ID[type];
    if (!nativeType) return Promise.resolve([]);
    return callArray<RawSourcedSample>('getSamples', {
      ...baseOptions(options),
      type: nativeType,
    });
  },

  queryCategorySamples(type, options) {
    return callArray<RawSample>(METHOD_BY_TYPE[type], baseOptions(options));
  },

  queryWorkouts({ startDate, endDate, limit, ascending, anchor }) {
    if (!isIos()) return Promise.resolve({ workouts: [], anchor: anchor ?? '' });
    return new Promise((resolve) => {
      AppleHealthKit.getAnchoredWorkouts(
        {
          startDate,
          ...(endDate ? { endDate } : {}),
          limit,
          ascending,
          ...(anchor ? { anchor } : {}),
        } as never,
        (err: unknown, results: { data?: unknown[]; anchor?: string } | undefined) => {
          if (err || !results?.data) return resolve({ workouts: [], anchor: anchor ?? '' });
          resolve({
            workouts: results.data as RawWorkoutDelta['workouts'],
            anchor: results.anchor ?? anchor ?? '',
          });
        },
      );
    });
  },

  queryWorkoutRoute(workoutId) {
    if (!isIos()) return Promise.resolve([]);
    return new Promise((resolve) => {
      AppleHealthKit.getWorkoutRouteSamples(
        { id: workoutId } as never,
        (err: unknown, results: { data?: { locations?: RawRouteLocation[] } } | undefined) => {
          const locations = results?.data?.locations;
          if (err || !Array.isArray(locations)) return resolve([]);
          resolve(locations);
        },
      );
    });
  },

  async queryCharacteristics(): Promise<HealthCharacteristics> {
    const [sex, blood, dob] = await Promise.all([
      callOne<{ value?: string }>('getBiologicalSex'),
      callOne<{ value?: string }>('getBloodType'),
      callOne<{ age?: number }>('getDateOfBirth'),
    ]);
    return {
      age: typeof dob?.age === 'number' ? dob.age : undefined,
      biologicalSex: sex?.value,
      bloodType: blood?.value,
    };
  },

  async queryActivityRings(range: HealthRange): Promise<RawActivityRings | undefined> {
    const results = await callArray<Record<string, number>>('getActivitySummary', {
      startDate: range.startDate,
      endDate: range.endDate,
    });
    if (results.length === 0) return undefined;
    const s = results[results.length - 1];
    return {
      activeEnergyBurned: s.activeEnergyBurned ?? 0,
      activeEnergyBurnedGoal: s.activeEnergyBurnedGoal,
      appleExerciseTime: s.appleExerciseTime ?? 0,
      appleExerciseTimeGoal: s.appleExerciseTimeGoal,
      appleStandHours: s.appleStandHours ?? 0,
      appleStandHoursGoal: s.appleStandHoursGoal,
    };
  },

  configureBackgroundDelivery() {
    // A entrega em background desta implementação já é fiada nativamente —
    // `RCTAppleHealthKit().initializeBackgroundObservers(bridge)` em
    // `AppDelegate.swift` (ADR 0009). Não há nada para configurar a partir do
    // JS aqui; existe só para a porta ter um único ponto de troca. `true`
    // porque o registro de fato existe — só não passa por aqui.
    return Promise.resolve(true);
  },

  subscribeWorkoutObserver(onChange) {
    if (!isIos()) return { remove: () => {} };
    const sub = NativeAppEventEmitter.addListener('healthKit:Workout:new', () => onChange());
    return { remove: () => sub.remove() };
  },
};
