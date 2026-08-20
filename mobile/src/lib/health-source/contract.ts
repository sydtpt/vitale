/**
 * Contrato da fonte de dados de saúde (HealthKit) — a costura entre o app e a
 * biblioteca nativa.
 *
 * **Por que existe.** Até aqui, quatro arquivos importavam `react-native-health`
 * direto, cada um falando o dialeto daquela lib (nomes de método em string,
 * callbacks, unidades implícitas). Trocar a lib exigiria mudar os quatro de uma
 * vez, sem rede. Com a porta no meio, existe um único ponto de troca e é
 * possível rodar duas implementações lado a lado para comparar.
 *
 * **Vocabulário.** A porta fala **identificadores do HealthKit** (`HKQuantity
 * TypeIdentifierStepCount`), que são a nomenclatura da Apple — estável, comum a
 * qualquer biblioteca. Nome de método (`getStepCountSamples`) é dialeto de
 * implementação e fica confinado ao adaptador.
 *
 * **Por que no mobile e não no núcleo.** A AD-1 mandaria um arquivo sem import
 * de plataforma para `packages/shared`. Este é só de tipos, mas descreve uma
 * capacidade **do iOS**, que a web não tem e nunca terá: levá-lo ao núcleo
 * colocaria um conceito de plataforma no vocabulário compartilhado, contra a
 * AD-3. A fronteira certa aqui é a da AD-2 — o cálculo puro que consome estes
 * dados já vive no núcleo; o contrato da borda nativa fica na borda.
 */
import type { HrSample } from '../heart-rate-zones';
import type { WorkoutEventLike } from '../workout-types';

/* ───────────────────────── Identificadores ───────────────────────── */

/**
 * Tipos do HealthKit que o Orbe lê. A chave é o nome curto usado no app; o
 * valor é o identificador da Apple, que é o que a camada nativa entende.
 */
export const HK = {
  // Atividade
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  distanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  flightsClimbed: 'HKQuantityTypeIdentifierFlightsClimbed',
  activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  basalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned',
  appleExerciseTime: 'HKQuantityTypeIdentifierAppleExerciseTime',
  // Coração
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  restingHeartRate: 'HKQuantityTypeIdentifierRestingHeartRate',
  heartRateVariability: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  vo2Max: 'HKQuantityTypeIdentifierVO2Max',
  oxygenSaturation: 'HKQuantityTypeIdentifierOxygenSaturation',
  respiratoryRate: 'HKQuantityTypeIdentifierRespiratoryRate',
  bloodPressureSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  bloodPressureDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  // Corpo
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  bodyMassIndex: 'HKQuantityTypeIdentifierBodyMassIndex',
  bodyFatPercentage: 'HKQuantityTypeIdentifierBodyFatPercentage',
  leanBodyMass: 'HKQuantityTypeIdentifierLeanBodyMass',
  waistCircumference: 'HKQuantityTypeIdentifierWaistCircumference',
  // Sono
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis',
  // Nutrição
  dietaryWater: 'HKQuantityTypeIdentifierDietaryWater',
  dietaryEnergyConsumed: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  dietaryProtein: 'HKQuantityTypeIdentifierDietaryProtein',
  dietaryCarbohydrates: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
  dietaryFatTotal: 'HKQuantityTypeIdentifierDietaryFatTotal',
  // Treinos e rotas
  workout: 'HKWorkoutTypeIdentifier',
  workoutRoute: 'HKWorkoutRouteTypeIdentifier',
  // Agregados e características
  activitySummary: 'HKActivitySummaryTypeIdentifier',
  dateOfBirth: 'HKCharacteristicTypeIdentifierDateOfBirth',
  biologicalSex: 'HKCharacteristicTypeIdentifierBiologicalSex',
  bloodType: 'HKCharacteristicTypeIdentifierBloodType',
} as const;

export type HealthTypeId = (typeof HK)[keyof typeof HK];

/* ───────────────────────── Formas de dado ───────────────────────── */

/** Janela de consulta. Datas em ISO 8601. */
export interface HealthRange {
  startDate: string;
  endDate: string;
}

/** Amostra crua, na forma em que os consumidores já a esperam. */
export interface RawSample {
  value: number;
  startDate: string;
  endDate: string;
  bloodPressureSystolicValue?: number;
  bloodPressureDiastolicValue?: number;
}

/**
 * Amostra com a fonte que a escreveu. Só as cumulativas multi-fonte precisam
 * disso — é o insumo do `dedupeBySource` (ADR 0004).
 */
export interface RawSourcedSample {
  quantity?: number;
  distance?: number;
  start: string;
  end: string;
  sourceId?: string;
  sourceName?: string;
}

/** Treino cru, antes do mapeamento para `WorkoutItem`. */
export interface RawWorkout {
  id?: string;
  activityId?: number;
  activityName?: string;
  calories?: number;
  start: string;
  end: string;
  duration?: number;
  distance?: number;
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  metadata?: Record<string, unknown>;
  /** Tipo reusado de `workout-types` — o dono do conceito é ele (AD-3). */
  workoutEvents?: WorkoutEventLike[];
}

/** Página incremental de treinos, com o token para a próxima chamada. */
export interface RawWorkoutDelta {
  workouts: RawWorkout[];
  anchor: string;
}

/** Ponto GPS de uma rota de treino. */
export interface RawRouteLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  timestamp?: string;
}

/** Características do perfil. Todas opcionais: o usuário pode não as ter preenchido. */
export interface HealthCharacteristics {
  age?: number;
  biologicalSex?: string;
  bloodType?: string;
}

/**
 * Anéis de atividade de um dia. As **metas** são opcionais de propósito: o
 * `HKActivitySummary` é a única fonte delas no HealthKit, e nem toda
 * implementação a expõe. Quem consome trata a ausência (ver `health-goals.ts`).
 */
export interface RawActivityRings {
  activeEnergyBurned: number;
  activeEnergyBurnedGoal?: number;
  appleExerciseTime: number;
  appleExerciseTimeGoal?: number;
  appleStandHours: number;
  appleStandHoursGoal?: number;
}

/** Opções comuns de consulta por período. */
export interface QueryOptions extends HealthRange {
  ascending?: boolean;
  includeManuallyAdded?: boolean;
  /** Unidade exigida pela implementação para este tipo (ex.: 'bpm', 'gram'). */
  unit?: string;
  /** Tamanho do bucket em minutos, para consultas agregadas. */
  periodMinutes?: number;
}

/* ───────────────────────── A porta ───────────────────────── */

/**
 * Operações que o Orbe precisa do HealthKit. São oito — a superfície inteira do
 * app sobre a plataforma.
 *
 * **Contrato de erro, uniforme e deliberado:** nenhuma operação rejeita. Falta
 * de permissão, ausência de dado, indisponibilidade do HealthKit e erro nativo
 * resolvem no vazio (`[]` / `undefined`). É o comportamento que os consumidores
 * já assumem hoje — a UI trata "sem dado" e não trata exceção — e mantê-lo
 * explícito no contrato impede que um adaptador novo introduza um caminho de
 * falha que ninguém captura.
 */
export interface HealthSource {
  /** Nome da implementação. Aparece em log e no harness de paridade. */
  readonly id: string;

  /** HealthKit existe e está disponível neste device. */
  isAvailable(): boolean;

  /**
   * Pede autorização de leitura. Resolve `true` quando o pedido foi aceito.
   * O HealthKit **não** revela negação de leitura: `true` significa "liberado
   * para consultar", não "há dado".
   */
  requestReadAuthorization(types: readonly HealthTypeId[]): Promise<boolean>;

  /** Amostras pontuais (FC, peso, VO2max…). */
  queryQuantitySamples(type: HealthTypeId, options: QueryOptions): Promise<RawSample[]>;

  /** Cumulativas agregadas pelo próprio HealthKit em buckets de `periodMinutes`. */
  queryAggregatedSamples(type: HealthTypeId, options: QueryOptions): Promise<RawSample[]>;

  /** Cumulativas cruas, com `sourceId` — insumo do dedupe multi-fonte (ADR 0004). */
  querySourcedSamples(type: HealthTypeId, options: QueryOptions): Promise<RawSourcedSample[]>;

  /** Amostras categóricas (hoje só sono). `value` carrega o estágio. */
  queryCategorySamples(type: HealthTypeId, options: QueryOptions): Promise<RawSample[]>;

  /**
   * Treinos por âncora. Sem `anchor`, devolve o período inteiro e uma âncora
   * inicial; com âncora, só o que mudou desde ela.
   */
  queryWorkouts(options: {
    startDate: string;
    endDate?: string;
    limit: number;
    ascending: boolean;
    anchor?: string;
  }): Promise<RawWorkoutDelta>;

  /** Pontos GPS de um treino. `[]` quando não há rota (indoor, por exemplo). */
  queryWorkoutRoute(workoutId: string): Promise<RawRouteLocation[]>;

  /** Características do perfil (nascimento, sexo, tipo sanguíneo). */
  queryCharacteristics(): Promise<HealthCharacteristics>;

  /**
   * Anéis de atividade do período. `undefined` quando a implementação não
   * expõe `HKActivitySummary` — é o caso do adaptador novo, e o consumidor
   * cobre a lacuna com as metas configuradas pelo usuário.
   */
  queryActivityRings(range: HealthRange): Promise<RawActivityRings | undefined>;

  /**
   * Garante que a entrega em background dos tipos informados está registrada
   * nativamente — a chamada que precisa sobreviver ao fechamento do app (Fase
   * 1B do plano de migração, portão 3). Idempotente; chamar de novo com os
   * mesmos tipos não duplica nada. Implementações cuja entrega em background já
   * é fiada por fora (edição nativa fixa, por exemplo) podem tratar como no-op.
   */
  configureBackgroundDelivery(types: readonly HealthTypeId[]): Promise<void>;

  /**
   * Assina "há treino novo ou alterado no HealthKit". Dispara tanto com o app
   * em primeiro plano quanto quando o sistema o acorda em segundo plano por
   * causa da entrega configurada em `configureBackgroundDelivery`. `remove()`
   * cancela a assinatura.
   */
  subscribeWorkoutObserver(onChange: () => void): { remove: () => void };
}

/** Reexportado para quem consome FC de treino sem precisar do módulo de zonas. */
export type { HrSample };
