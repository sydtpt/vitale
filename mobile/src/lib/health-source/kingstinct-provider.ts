/**
 * Implementação da porta sobre `@kingstinct/react-native-healthkit` — o
 * adaptador da Fase 1B do plano de migração (ver
 * `_bmad-output/planning-artifacts/plano-migracao-react-native.md`).
 *
 * Diferente do legado, esta lib fala o vocabulário de identificadores do
 * HealthKit diretamente — não há dicionário de nome-de-método nem de
 * permissão para manter. O dialeto que sobra para confinar aqui é outro: (1)
 * ela usa `Date`/`Quantity{unit,quantity}` onde o legado usava string
 * ISO/número cru, e (2) ela exige string de unidade **canônica do HealthKit**
 * (`HKUnit(from:)` da Apple — "count/min", "g", "%"...), enquanto os
 * chamadores em `config/health-metrics.ts` e `healthkit-workouts.ts` foram
 * escritos contra os apelidos do react-native-health ("bpm", "gram",
 * "percent"...) — a Fase 1 nunca teve motivo para abstrair isso, e a `unit`
 * de `QueryOptions` já é documentada como "dialeto da implementação".
 *
 * Cada `unit`/default abaixo foi conferido contra o **fonte nativo** das duas
 * libs (não a doc) para achar os pontos em que os defaults divergem — dois
 * são divergências reais que produziriam número errado sem crash: água (o
 * legado fixa litro; esta lib, por padrão, mL) e frequência respiratória (o
 * legado usa respirações/minuto; esta lib, por padrão, respirações/segundo).
 * FC-variabilidade replica o default do legado (segundo) mesmo sendo,
 * aparentemente, uma unidade estranha para o card mostrar — ver nota em
 * `LEGACY_DEFAULT_UNIT`; esta troca preserva comportamento, não conserta bug.
 */
import { Platform } from 'react-native';
import {
  configureBackgroundTypes,
  getBiologicalSexAsync,
  getBloodTypeAsync,
  getDateOfBirthAsync,
  isHealthDataAvailable,
  queryCategorySamples as kQueryCategorySamples,
  queryCorrelationSamples,
  queryQuantitySamples as kQueryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamples,
  queryWorkoutSamplesWithAnchor,
  requestAuthorization,
  subscribeToChanges,
  UpdateFrequency,
  type QuantitySample,
} from '@kingstinct/react-native-healthkit';
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
  type RawWorkout,
} from './contract';

const isIos = () => Platform.OS === 'ios';

/* ───────────────────────── Unidades ───────────────────────── */

/**
 * Alias herdado do vocabulário do react-native-health → string HKUnit
 * canônica que esta lib exige (`HKUnit(from:)` da Apple, não aceita
 * "bpm"/"gram"/"percent"/"calorie" etc.).
 */
const UNIT_ALIAS: Record<string, string> = {
  bpm: 'count/min',
  gram: 'g',
  percent: '%',
  calorie: 'cal',
  kilocalorie: 'kcal',
  meter: 'm',
  count: 'count',
};

/**
 * Unidade a usar quando o chamador NÃO especifica `unit` — o default do
 * react-native-health para aquele tipo (verificado no `.m` nativo dele), não
 * o default desta lib, para o número exibido não mudar. `distanceWalkingRunning`
 * entra aqui porque `multiSourceFetch` em `health-metrics.ts` não passa `unit`
 * e assume milhas (por isso o `scale: METERS_PER_MILE` do lado de lá).
 */
const LEGACY_DEFAULT_UNIT: Partial<Record<HealthTypeId, string>> = {
  [HK.appleExerciseTime]: 's',
  [HK.respiratoryRate]: 'count/min',
  [HK.vo2Max]: 'ml/(kg*min)',
  [HK.distanceWalkingRunning]: 'mi',
  [HK.bloodPressureSystolic]: 'mmHg',
};

/**
 * Unidades que o react-native-health **hardcodeia** nativamente — o `unit`
 * das opções nem chega a ser lido para esses dois tipos. Vence mesmo que o
 * chamador peça outra coisa, replicando o comportamento exato (bug incluso:
 * HRV em segundos é estranho para um card, mas é o que o app sempre mostrou).
 */
const FORCED_UNIT: Partial<Record<HealthTypeId, string>> = {
  [HK.heartRateVariability]: 's',
  [HK.dietaryWater]: 'L',
};

function resolveUnit(type: HealthTypeId, requested?: string): string | undefined {
  if (FORCED_UNIT[type]) return FORCED_UNIT[type];
  if (requested) return UNIT_ALIAS[requested] ?? requested;
  return LEGACY_DEFAULT_UNIT[type];
}

const METERS_PER_MILE = 1609.344;
const metersToMiles = (m: number) => m / METERS_PER_MILE;

/* ───────────────────────── Sono e eventos de treino ───────────────────────── */

/**
 * `CategoryValueSleepAnalysis` (numérico) → o rótulo em string que
 * `aggregateSleepNights` (`health-buckets.ts`) espera — é o que o
 * react-native-health devolvia nativamente em `.value` para este tipo, apesar
 * do contrato tipar `RawSample.value` como `number`.
 */
const SLEEP_LABEL: Record<number, string> = {
  0: 'INBED',
  1: 'ASLEEP',
  2: 'AWAKE',
  3: 'CORE',
  4: 'DEEP',
  5: 'REM',
};

/** `WorkoutEventType` (numérico) → rótulo que `pausedSecondsFromEvents` reconhece. */
const WORKOUT_EVENT_LABEL: Record<number, string> = {
  1: 'pause',
  2: 'resume',
  5: 'motion paused',
  6: 'motion resumed',
};

/** Mapas expostos para o teste de cobertura. */
export const KINGSTINCT_MAPS = {
  UNIT_ALIAS,
  LEGACY_DEFAULT_UNIT,
  FORCED_UNIT,
  SLEEP_LABEL,
  WORKOUT_EVENT_LABEL,
};

/* ───────────────────────── Características ───────────────────────── */

const BIO_SEX_LABEL: Record<number, string> = { 1: 'female', 2: 'male', 3: 'other' };
const BLOOD_TYPE_LABEL: Record<number, string> = {
  1: 'A+', 2: 'A-', 3: 'B+', 4: 'B-', 5: 'AB+', 6: 'AB-', 7: 'O+', 8: 'O-',
};

function ageFromDate(dob: Date): number {
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/* ───────────────────────── Pressão arterial ─────────────────────────
 * Não existe consulta de quantidade simples para pressão: sístole e diástole
 * chegam juntas numa `HKCorrelation`. O legado já entrega as duas no mesmo
 * `RawSample` (consultado pelo identificador da sístole) — replicado aqui.
 */
async function queryBloodPressure(options: QueryOptions): Promise<RawSample[]> {
  try {
    const correlations = await queryCorrelationSamples('HKCorrelationTypeIdentifierBloodPressure', {
      filter: { date: { startDate: new Date(options.startDate), endDate: new Date(options.endDate) } },
      limit: -1,
      ascending: options.ascending,
    });
    return correlations.map((c) => {
      const sys = c.objects.find(
        (o): o is QuantitySample => 'quantityType' in o && o.quantityType === HK.bloodPressureSystolic,
      );
      const dia = c.objects.find(
        (o): o is QuantitySample => 'quantityType' in o && o.quantityType === HK.bloodPressureDiastolic,
      );
      return {
        value: sys?.quantity ?? 0,
        bloodPressureSystolicValue: sys?.quantity,
        bloodPressureDiastolicValue: dia?.quantity,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
      };
    });
  } catch {
    return [];
  }
}

/* ───────────────────────── Treinos ───────────────────────── */

/**
 * Foto de um treino já em JS puro — o que `WorkoutProxy.toJSON()` devolve.
 * Ler daqui é acesso a objeto comum, sem custo de ponte.
 */
interface WorkoutSnapshot {
  uuid: string;
  workoutActivityType: number;
  duration: { quantity: number };
  totalEnergyBurned?: { quantity: number };
  totalDistance?: { quantity: number };
  startDate: Date;
  endDate: Date;
  sourceRevision: { source: { name: string; bundleIdentifier: string } };
  device?: { name?: string };
  metadata?: Record<string, unknown>;
  events?: readonly { type: number; startDate: Date }[];
}

/**
 * O treino como esta lib o entrega: um **HybridObject do Nitro**, não um
 * objeto JS. Cada propriedade lida aqui é uma chamada SÍNCRONA pro Swift,
 * atravessando a ponte — diferença estrutural em relação à lib legada, que
 * serializava tudo no nativo e devolvia objeto comum.
 *
 * Por isso o mapeamento nunca lê propriedade do proxy: chama `toJSON()` uma
 * vez e trabalha em cima do snapshot. Com `PAGE_SIZE = 1000`, a diferença é
 * ~1.000 travessias em vez de ~12.000 — era o que congelava a aba "Sync de
 * atividades" ao abrir (`loadWorkouts` → `fetchWorkoutsPage`).
 */
interface WorkoutProxyLike extends WorkoutSnapshot {
  toJSON(): WorkoutSnapshot;
  getWorkoutRoutes(): Promise<readonly { locations: readonly RawRouteLocationLike[] }[]>;
}

interface RawRouteLocationLike {
  latitude: number;
  longitude: number;
  altitude?: number;
  date: Date;
}

function toRawWorkout(proxy: WorkoutProxyLike): RawWorkout {
  // UMA travessia da ponte; daqui pra baixo é tudo objeto JS.
  const w = proxy.toJSON();
  return {
    id: w.uuid,
    activityId: w.workoutActivityType,
    // Não há nome amigável por tipo na API desta lib (o legado tinha o seu
    // próprio dicionário); o rótulo principal da UI vem de `activityId` via
    // `getActivityMeta`, que continua correto — só o campo secundário
    // "Nome (Health)" na tela de detalhe do treino perde o valor específico.
    activityName: undefined,
    calories: w.totalEnergyBurned?.quantity,
    start: w.startDate.toISOString(),
    end: w.endDate.toISOString(),
    duration: w.duration.quantity,
    // `totalDistance` desta lib é sempre metros (HKUnit.meter() fixo no nativo);
    // `mapRawWorkout` em healthkit-workouts.ts espera milhas (dialeto do
    // legado) e converte de volta — por isso a ida-e-volta aqui.
    distance: typeof w.totalDistance?.quantity === 'number' ? metersToMiles(w.totalDistance.quantity) : undefined,
    sourceName: w.sourceRevision?.source?.name,
    sourceId: w.sourceRevision?.source?.bundleIdentifier,
    device: w.device?.name,
    tracked: w.metadata?.HKWasUserEntered !== true,
    metadata: w.metadata,
    workoutEvents: (w.events ?? []).map((e) => ({
      eventType: WORKOUT_EVENT_LABEL[e.type] ?? '',
      startDate: e.startDate.toISOString(),
    })),
  };
}

/* ───────────────────────── A implementação ───────────────────────── */

export const kingstinctHealthSource: HealthSource = {
  id: 'kingstinct-react-native-healthkit',

  isAvailable: () => isIos() && isHealthDataAvailable(),

  requestReadAuthorization(types) {
    if (!isIos()) return Promise.resolve(false);
    return requestAuthorization({ toRead: types as never }).catch(() => false);
  },

  queryQuantitySamples(type, options) {
    if (type === HK.bloodPressureSystolic) return queryBloodPressure(options);
    return kQueryQuantitySamples(type as never, {
      filter: { date: { startDate: new Date(options.startDate), endDate: new Date(options.endDate) } },
      limit: -1,
      ascending: options.ascending,
      unit: resolveUnit(type, options.unit) as never,
    })
      .then((samples) =>
        samples.map((s) => ({
          value: s.quantity,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
        })),
      )
      .catch(() => []);
  },

  queryAggregatedSamples(type, options) {
    return queryStatisticsCollectionForQuantity(
      type as never,
      ['cumulativeSum'],
      new Date(options.startDate),
      { minute: options.periodMinutes ?? 1440 },
      {
        filter: { date: { startDate: new Date(options.startDate), endDate: new Date(options.endDate) } },
        unit: resolveUnit(type, options.unit) as never,
      },
    )
      .then((buckets) =>
        buckets
          .filter((b) => b.sumQuantity && b.startDate && b.endDate)
          .map((b) => ({
            value: b.sumQuantity!.quantity,
            startDate: b.startDate!.toISOString(),
            endDate: b.endDate!.toISOString(),
          })),
      )
      .catch(() => []);
  },

  querySourcedSamples(type, options): Promise<RawSourcedSample[]> {
    return kQueryQuantitySamples(type as never, {
      filter: { date: { startDate: new Date(options.startDate), endDate: new Date(options.endDate) } },
      limit: -1,
      ascending: options.ascending,
      unit: resolveUnit(type, options.unit) as never,
    })
      .then((samples) =>
        samples.map((s) => ({
          quantity: s.quantity,
          start: s.startDate.toISOString(),
          end: s.endDate.toISOString(),
          sourceId: s.sourceRevision?.source?.bundleIdentifier,
          sourceName: s.sourceRevision?.source?.name,
        })),
      )
      .catch(() => []);
  },

  queryCategorySamples(type, options) {
    return kQueryCategorySamples(type as never, {
      filter: { date: { startDate: new Date(options.startDate), endDate: new Date(options.endDate) } },
      limit: -1,
      ascending: options.ascending,
    })
      .then((samples) =>
        samples.map((s) => ({
          value:
            type === HK.sleepAnalysis
              ? ((SLEEP_LABEL[s.value as unknown as number] ?? String(s.value)) as unknown as number)
              : (s.value as unknown as number),
          startDate: s.startDate.toISOString(),
          endDate: s.endDate.toISOString(),
        })),
      )
      .catch(() => []);
  },

  queryWorkouts({ startDate, endDate, limit, ascending, anchor }) {
    if (!isIos()) return Promise.resolve({ workouts: [], anchor: anchor ?? '' });
    const from = new Date(startDate);
    // A variante ancorada desta lib não tem `ascending` (só filtro + limite);
    // a variante sem âncora tem `ascending` mas não devolve âncora nova. O
    // legado fazia as duas coisas numa API só (`getAnchoredWorkouts`).
    // `fetchWorkoutsPage` (paginação do backfill) pede ordem e descarta a
    // âncora; `fetchWorkoutsDelta` pede âncora e não liga pra ordem — por
    // isso a escolha abaixo cobre os dois sem perder o que os chamadores
    // realmente usam.
    if (ascending === false) {
      return queryWorkoutSamples({
        filter: { date: { startDate: from, endDate: endDate ? new Date(endDate) : undefined } },
        limit,
        ascending: false,
      })
        .then((workouts) => ({ workouts: workouts.map((w) => toRawWorkout(w as unknown as WorkoutProxyLike)), anchor: anchor ?? '' }))
        .catch(() => ({ workouts: [], anchor: anchor ?? '' }));
    }
    return queryWorkoutSamplesWithAnchor({
      filter: { date: { startDate: from } },
      limit,
      ...(anchor ? { anchor } : {}),
    })
      .then((r) => ({
        workouts: r.workouts.map((w) => toRawWorkout(w as unknown as WorkoutProxyLike)),
        anchor: r.newAnchor || anchor || '',
      }))
      .catch(() => ({ workouts: [], anchor: anchor ?? '' }));
  },

  async queryWorkoutRoute(workoutId) {
    try {
      const matches = await queryWorkoutSamples({ filter: { uuid: workoutId }, limit: 1 });
      const workout = matches[0] as unknown as WorkoutProxyLike | undefined;
      if (!workout) return [];
      const routes = await workout.getWorkoutRoutes();
      return routes.flatMap((r) =>
        r.locations.map((l) => ({
          latitude: l.latitude,
          longitude: l.longitude,
          altitude: typeof l.altitude === 'number' ? l.altitude : undefined,
          timestamp: l.date.toISOString(),
        })),
      );
    } catch {
      return [];
    }
  },

  async queryCharacteristics(): Promise<HealthCharacteristics> {
    try {
      const [sex, blood, dob] = await Promise.all([
        getBiologicalSexAsync().catch(() => undefined),
        getBloodTypeAsync().catch(() => undefined),
        getDateOfBirthAsync().catch(() => undefined),
      ]);
      return {
        age: dob ? ageFromDate(dob) : undefined,
        biologicalSex: sex ? BIO_SEX_LABEL[sex] : undefined,
        bloodType: blood ? BLOOD_TYPE_LABEL[blood] : undefined,
      };
    } catch {
      return {};
    }
  },

  // Esta lib não expõe `HKActivitySummary` — o contrato já prevê essa lacuna
  // (ver docstring de `queryActivityRings` em contract.ts): o consumidor
  // (`ringsFetch` em health-metrics.ts) degrada para anel sem meta.
  queryActivityRings(_range: HealthRange): Promise<RawActivityRings | undefined> {
    return Promise.resolve(undefined);
  },

  configureBackgroundDelivery(types) {
    if (!isIos()) return Promise.resolve();
    // Cópia mutável: a lib pede `string[]` e o contrato entrega `readonly`.
    return configureBackgroundTypes([...types], UpdateFrequency.immediate)
      .then(() => undefined)
      .catch(() => undefined);
  },

  subscribeWorkoutObserver(onChange) {
    if (!isIos()) return { remove: () => {} };
    try {
      // Sem cast: `HKWorkoutTypeIdentifier` está no union `SampleTypeIdentifier`
      // da lib, então o compilador confirma que o observer é aplicável a treino.
      return subscribeToChanges(HK.workout, (args) => {
        if (!args.errorMessage) onChange();
      });
    } catch {
      return { remove: () => {} };
    }
  },
};
