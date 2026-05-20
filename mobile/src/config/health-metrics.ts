/**
 * Registro central das métricas de saúde.
 * Cada métrica descreve como buscar (HealthKit), agregar, colorir e formatar.
 * Tanto o dashboard quanto a tela de detalhe são gerados a partir daqui.
 */
import AppleHealthKit from 'react-native-health';
import type { Ionicons } from '@expo/vector-icons';
import { colors, MOD } from '../theme';
import {
  Sample,
  MetricKind,
  Period,
  formatNumber,
  formatHoursMin,
} from '../lib/health-format';

type IoniconName = keyof typeof Ionicons.glyphMap;

export type CategoryId = 'atividade' | 'coracao' | 'corpo' | 'sono' | 'nutricao';
export type ChartType = 'bar' | 'line' | 'rings' | 'donut';

export interface Range {
  startDate: string;
  endDate: string;
}

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  icon: IoniconName;
  tint: string;
  accent: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'atividade', label: 'Atividade', icon: 'flame-outline', tint: MOD.treino.tint, accent: MOD.treino.accent },
  { id: 'coracao', label: 'Coração', icon: 'heart-outline', tint: colors.roseSoft, accent: colors.rose },
  { id: 'corpo', label: 'Corpo', icon: 'body-outline', tint: MOD.casa.tint, accent: MOD.casa.accent },
  { id: 'sono', label: 'Sono', icon: 'moon-outline', tint: colors.blueSoft, accent: colors.blue },
  { id: 'nutricao', label: 'Nutrição', icon: 'restaurant-outline', tint: MOD.food.tint, accent: MOD.food.accent },
];

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((c) => c.id === id)!;
}

export interface MetricDef {
  id: string;
  label: string;
  category: CategoryId;
  icon: IoniconName;
  /** Unidade exibida como legenda (ex.: 'bpm', 'kcal'). */
  unit: string;
  kind: MetricKind;
  chart: ChartType;
  decimals?: number;
  /** Texto auxiliar do que a métrica representa. */
  caption?: string;
  fetch: (range: Range, period: Period) => Promise<Sample[]>;
  /** Formata um valor (usado em stats, eixos e cards). */
  format: (value: number) => string;
}

/* ───────────────────────── Fetch helpers ───────────────────────── */

type RawValue = {
  value: number;
  startDate: string;
  endDate: string;
  bloodPressureSystolicValue?: number;
  bloodPressureDiastolicValue?: number;
};

const defaultMap = (v: RawValue): Sample => ({
  value: v.value,
  start: v.startDate,
  end: v.endDate,
});

/** Valores de percentual podem vir como fração (0–1) ou já em %. */
const pctMap = (v: RawValue): Sample => ({
  value: v.value <= 1 ? v.value * 100 : v.value,
  start: v.startDate,
  end: v.endDate,
});

/** gramas → kg */
const kgMap = (v: RawValue): Sample => ({
  value: v.value / 1000,
  start: v.startDate,
  end: v.endDate,
});

function callArray(
  method: string,
  options: Record<string, unknown>,
  map: (v: any) => Sample
): Promise<Sample[]> {
  return new Promise((resolve) => {
    const fn = (AppleHealthKit as any)[method];
    if (typeof fn !== 'function') return resolve([]);
    try {
      fn(options, (err: unknown, results: unknown) => {
        if (err || !Array.isArray(results)) return resolve([]);
        resolve(results.map(map).filter((s: Sample) => Number.isFinite(s.value)));
      });
    } catch {
      resolve([]);
    }
  });
}

/** Métricas cumulativas (passos, kcal…): HealthKit agrega por intervalo via `period`. */
function cumulativeFetch(method: string, opts: Record<string, unknown> = {}, map = defaultMap) {
  return (range: Range, period: Period): Promise<Sample[]> =>
    callArray(
      method,
      {
        startDate: range.startDate,
        endDate: range.endDate,
        ascending: true,
        includeManuallyAdded: true,
        period: period === 'day' ? 60 : 1440,
        ...opts,
      },
      map
    );
}

/** Métricas pontuais (FC, peso…): amostras brutas, sem agregação. */
function discreteFetch(method: string, opts: Record<string, unknown> = {}, map = defaultMap) {
  return (range: Range): Promise<Sample[]> =>
    callArray(
      method,
      {
        startDate: range.startDate,
        endDate: range.endDate,
        ascending: true,
        includeManuallyAdded: true,
        ...opts,
      },
      map
    );
}

/** Pressão arterial: sistólica em `value`, diastólica em `extra`. */
function bloodPressureFetch(range: Range): Promise<Sample[]> {
  return callArray(
    'getBloodPressureSamples',
    { startDate: range.startDate, endDate: range.endDate, ascending: true },
    (v: RawValue) => ({
      value: v.bloodPressureSystolicValue ?? 0,
      extra: v.bloodPressureDiastolicValue,
      start: v.startDate,
      end: v.endDate,
    })
  );
}

/**
 * Sono: cada amostra é um estágio. Convertemos para horas dormidas
 * (excluindo "na cama" e "acordado") por amostra.
 */
function sleepFetch(range: Range): Promise<Sample[]> {
  return callArray(
    'getSleepSamples',
    { startDate: range.startDate, endDate: range.endDate, ascending: true },
    (v: RawValue) => {
      const stage = String(v.value).toUpperCase();
      const asleep = stage !== 'INBED' && stage !== 'AWAKE';
      const ms = new Date(v.endDate).getTime() - new Date(v.startDate).getTime();
      return {
        value: asleep ? ms / 3_600_000 : 0,
        start: v.startDate,
        end: v.endDate,
        label: stage,
      };
    }
  );
}

/** Anéis de atividade: 3 amostras (mover/exercício/em pé) do dia mais recente. */
function ringsFetch(range: Range): Promise<Sample[]> {
  return new Promise((resolve) => {
    AppleHealthKit.getActivitySummary(
      { startDate: range.startDate, endDate: range.endDate } as any,
      (err: unknown, results: any) => {
        if (err || !Array.isArray(results) || results.length === 0) return resolve([]);
        const s = results[results.length - 1];
        const now = new Date().toISOString();
        resolve([
          { label: 'Mover', value: s.activeEnergyBurned ?? 0, extra: s.activeEnergyBurnedGoal ?? 0, start: now, end: now },
          { label: 'Exercício', value: s.appleExerciseTime ?? 0, extra: s.appleExerciseTimeGoal ?? 0, start: now, end: now },
          { label: 'Em pé', value: s.appleStandHours ?? 0, extra: s.appleStandHoursGoal ?? 0, start: now, end: now },
        ]);
      }
    );
  });
}

/** Macros: total de gramas de proteína/carbo/gordura no período (para o donut). */
function macrosFetch(range: Range): Promise<Sample[]> {
  const grab = (method: string) =>
    callArray(
      method,
      { startDate: range.startDate, endDate: range.endDate, ascending: true, unit: 'gram', includeManuallyAdded: true },
      defaultMap
    );
  return Promise.all([
    grab('getProteinSamples'),
    grab('getCarbohydratesSamples'),
    grab('getTotalFatSamples'),
  ]).then(([p, c, f]) => {
    const sum = (arr: Sample[]) => arr.reduce((a, s) => a + s.value, 0);
    const now = new Date().toISOString();
    return [
      { label: 'Proteína', value: sum(p), start: now, end: now },
      { label: 'Carboidrato', value: sum(c), start: now, end: now },
      { label: 'Gordura', value: sum(f), start: now, end: now },
    ];
  });
}

/* ───────────────────────── Formatters ───────────────────────── */

const fmt = (decimals: number, unit?: string) => (v: number) =>
  unit ? `${formatNumber(v, decimals)} ${unit}` : formatNumber(v, decimals);

const fmtDistance = (m: number) =>
  m >= 1000 ? `${formatNumber(m / 1000, 2)} km` : `${formatNumber(Math.round(m))} m`;

/* ───────────────────────── Registro ───────────────────────── */

export const METRICS: MetricDef[] = [
  // ── Atividade ──────────────────────────────────────────────
  {
    id: 'passos', label: 'Passos', category: 'atividade', icon: 'footsteps-outline',
    unit: 'passos', kind: 'cumulative', chart: 'bar', caption: 'Contagem diária',
    fetch: cumulativeFetch('getDailyStepCountSamples'), format: fmt(0),
  },
  {
    id: 'distancia', label: 'Distância', category: 'atividade', icon: 'map-outline',
    unit: 'km', kind: 'cumulative', chart: 'bar', caption: 'Caminhada + corrida',
    fetch: cumulativeFetch('getDailyDistanceWalkingRunningSamples', { unit: 'meter' }),
    format: fmtDistance,
  },
  {
    id: 'andares', label: 'Andares', category: 'atividade', icon: 'trending-up-outline',
    unit: 'andares', kind: 'cumulative', chart: 'bar', caption: 'Lances de escada subidos',
    fetch: cumulativeFetch('getDailyFlightsClimbedSamples'), format: fmt(0),
  },
  {
    id: 'energia', label: 'Energia ativa', category: 'atividade', icon: 'flame-outline',
    unit: 'kcal', kind: 'cumulative', chart: 'bar', caption: 'Calorias de movimento',
    fetch: cumulativeFetch('getActiveEnergyBurned', { unit: 'kilocalorie' }), format: fmt(0),
  },
  {
    id: 'exercicio', label: 'Min. de exercício', category: 'atividade', icon: 'stopwatch-outline',
    unit: 'min', kind: 'cumulative', chart: 'bar', caption: 'Anel de exercício',
    fetch: cumulativeFetch('getAppleExerciseTime'), format: fmt(0),
  },
  {
    id: 'aneis', label: 'Anéis de atividade', category: 'atividade', icon: 'ellipse-outline',
    unit: '', kind: 'discrete', chart: 'rings', caption: 'Mover · Exercício · Em pé',
    fetch: ringsFetch, format: fmt(0),
  },

  // ── Coração ────────────────────────────────────────────────
  {
    id: 'fc', label: 'Freq. cardíaca', category: 'coracao', icon: 'heart-outline',
    unit: 'bpm', kind: 'discrete', chart: 'line', caption: 'Batimentos por minuto',
    fetch: discreteFetch('getHeartRateSamples', { unit: 'bpm' }), format: fmt(0, 'bpm'),
  },
  {
    id: 'fcRepouso', label: 'FC em repouso', category: 'coracao', icon: 'bed-outline',
    unit: 'bpm', kind: 'discrete', chart: 'line', caption: 'Em descanso',
    fetch: discreteFetch('getRestingHeartRateSamples', { unit: 'bpm' }), format: fmt(0, 'bpm'),
  },
  {
    id: 'vfc', label: 'Variabilidade (VFC)', category: 'coracao', icon: 'pulse-outline',
    unit: 'ms', kind: 'discrete', chart: 'line', caption: 'HRV — SDNN',
    fetch: discreteFetch('getHeartRateVariabilitySamples'), format: fmt(0, 'ms'),
  },
  {
    id: 'vo2max', label: 'VO₂ máx', category: 'coracao', icon: 'fitness-outline',
    unit: 'mL/kg·min', kind: 'discrete', chart: 'line', caption: 'Capacidade aeróbica',
    fetch: discreteFetch('getVo2MaxSamples'), format: fmt(1),
  },
  {
    id: 'spo2', label: 'Oxigênio (SpO₂)', category: 'coracao', icon: 'water-outline',
    unit: '%', kind: 'discrete', chart: 'line', caption: 'Saturação de oxigênio',
    fetch: discreteFetch('getOxygenSaturationSamples', { unit: 'percent' }, pctMap), format: fmt(0, '%'),
  },
  {
    id: 'respiracao', label: 'Freq. respiratória', category: 'coracao', icon: 'cloud-outline',
    unit: 'resp/min', kind: 'discrete', chart: 'line', caption: 'Respirações por minuto',
    fetch: discreteFetch('getRespiratoryRateSamples'), format: fmt(0),
  },
  {
    id: 'pressao', label: 'Pressão arterial', category: 'coracao', icon: 'speedometer-outline',
    unit: 'mmHg', kind: 'discrete', chart: 'line', caption: 'Sistólica / diastólica',
    fetch: bloodPressureFetch, format: fmt(0, 'mmHg'),
  },

  // ── Corpo ──────────────────────────────────────────────────
  {
    id: 'peso', label: 'Peso', category: 'corpo', icon: 'barbell-outline',
    unit: 'kg', kind: 'discrete', chart: 'line', caption: 'Massa corporal',
    fetch: discreteFetch('getWeightSamples', { unit: 'gram' }, kgMap), format: fmt(1, 'kg'),
  },
  {
    id: 'imc', label: 'IMC', category: 'corpo', icon: 'body-outline',
    unit: '', kind: 'discrete', chart: 'line', caption: 'Índice de massa corporal',
    fetch: discreteFetch('getBmiSamples', { unit: 'count' }), format: fmt(1),
  },
  {
    id: 'gordura', label: '% de gordura', category: 'corpo', icon: 'pie-chart-outline',
    unit: '%', kind: 'discrete', chart: 'line', caption: 'Percentual de gordura',
    fetch: discreteFetch('getBodyFatPercentageSamples', { unit: 'percent' }, pctMap), format: fmt(1, '%'),
  },
  {
    id: 'massaMagra', label: 'Massa magra', category: 'corpo', icon: 'body-outline',
    unit: 'kg', kind: 'discrete', chart: 'line', caption: 'Massa corporal magra',
    fetch: discreteFetch('getLeanBodyMassSamples', { unit: 'gram' }, kgMap), format: fmt(1, 'kg'),
  },
  {
    id: 'cintura', label: 'Cintura', category: 'corpo', icon: 'resize-outline',
    unit: 'cm', kind: 'discrete', chart: 'line', caption: 'Circunferência da cintura',
    fetch: discreteFetch('getWaistCircumferenceSamples', { unit: 'meter' }, (v) => ({
      value: v.value * 100, start: v.startDate, end: v.endDate,
    })),
    format: fmt(1, 'cm'),
  },

  // ── Sono ───────────────────────────────────────────────────
  {
    id: 'sono', label: 'Sono', category: 'sono', icon: 'moon-outline',
    unit: 'h', kind: 'cumulative', chart: 'bar', caption: 'Horas dormidas por noite',
    fetch: sleepFetch, format: (v) => formatHoursMin(v),
  },

  // ── Nutrição ───────────────────────────────────────────────
  {
    id: 'agua', label: 'Água', category: 'nutricao', icon: 'water-outline',
    unit: 'L', kind: 'cumulative', chart: 'bar', caption: 'Ingestão de água',
    fetch: discreteFetch('getWaterSamples'), format: fmt(2, 'L'),
  },
  {
    id: 'calorias', label: 'Calorias', category: 'nutricao', icon: 'fast-food-outline',
    unit: 'kcal', kind: 'cumulative', chart: 'bar', caption: 'Energia consumida',
    fetch: discreteFetch('getEnergyConsumedSamples', { unit: 'kilocalorie' }), format: fmt(0, 'kcal'),
  },
  {
    id: 'macros', label: 'Macronutrientes', category: 'nutricao', icon: 'pie-chart-outline',
    unit: 'g', kind: 'cumulative', chart: 'donut', caption: 'Proteína · Carbo · Gordura',
    fetch: macrosFetch, format: fmt(0, 'g'),
  },
  {
    id: 'proteina', label: 'Proteína', category: 'nutricao', icon: 'nutrition-outline',
    unit: 'g', kind: 'cumulative', chart: 'bar', caption: 'Proteína consumida',
    fetch: discreteFetch('getProteinSamples', { unit: 'gram' }), format: fmt(0, 'g'),
  },
];

export function metricById(id: string): MetricDef | undefined {
  return METRICS.find((m) => m.id === id);
}

export function metricsByCategory(id: CategoryId): MetricDef[] {
  return METRICS.filter((m) => m.category === id);
}

/* ───────────────────────── Permissões ───────────────────────── */

const P = AppleHealthKit.Constants.Permissions;

export const HEALTH_PERMISSIONS = {
  permissions: {
    read: [
      P.ActivitySummary, P.StepCount, P.DistanceWalkingRunning, P.FlightsClimbed,
      P.ActiveEnergyBurned, P.BasalEnergyBurned, P.AppleExerciseTime,
      P.HeartRate, P.RestingHeartRate, P.HeartRateVariability, P.Vo2Max,
      P.OxygenSaturation, P.RespiratoryRate, P.BloodPressureSystolic, P.BloodPressureDiastolic,
      P.Weight, P.BodyMassIndex, P.BodyFatPercentage, P.LeanBodyMass, P.WaistCircumference,
      P.SleepAnalysis, P.Water, P.EnergyConsumed, P.Protein, P.Carbohydrates, P.FatTotal,
      P.BiologicalSex, P.BloodType, P.DateOfBirth,
    ],
    write: [] as string[],
  },
};

/* ───────────────────────── Perfil (estático) ───────────────────────── */

export interface HealthProfile {
  biologicalSex?: string;
  bloodType?: string;
  age?: number;
}

const SEX_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' };

export function loadProfile(): Promise<HealthProfile> {
  const sex = new Promise<string | undefined>((resolve) =>
    AppleHealthKit.getBiologicalSex({} as any, (err, r: any) =>
      resolve(err ? undefined : SEX_LABEL[String(r?.value)] ?? r?.value)
    )
  );
  const blood = new Promise<string | undefined>((resolve) =>
    AppleHealthKit.getBloodType({} as any, (err, r: any) => resolve(err ? undefined : r?.value))
  );
  const dob = new Promise<number | undefined>((resolve) =>
    AppleHealthKit.getDateOfBirth({} as any, (err, r: any) => resolve(err ? undefined : r?.age))
  );
  return Promise.all([sex, blood, dob]).then(([biologicalSex, bloodType, age]) => ({
    biologicalSex,
    bloodType: bloodType && bloodType !== 'unknown' ? bloodType : undefined,
    age,
  }));
}
