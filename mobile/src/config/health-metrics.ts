/**
 * Registro central das métricas de saúde.
 * Cada métrica descreve como buscar (HealthKit), agregar, colorir e formatar.
 * Tanto o dashboard quanto a tela de detalhe são gerados a partir daqui.
 */
import AppleHealthKit from 'react-native-health';
import type { Ionicons } from '@expo/vector-icons';
import { HEALTH_METRICS, healthMetricById, type HealthMetricMeta } from '@vitale/shared';
import { colors, MOD } from '../theme';
import {
  Sample,
  Period,
  formatNumber,
  formatHoursMin,
  aggregateSleepNights,
} from '../lib/health-format';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** Categorias e o tipo de gráfico são metadados de UI; os demais vêm do shared. */
export type CategoryId = HealthMetricMeta['category'];
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

/**
 * Métrica do mobile = metadados compartilhados (`HealthMetricMeta`: id, label,
 * category, unit, kind, decimals, caption) + camada nativa/visual do app.
 */
export interface MetricDef extends HealthMetricMeta {
  icon: IoniconName;
  chart: ChartType;
  fetch: (range: Range, period: Period) => Promise<Sample[]>;
  /** Formata um valor (usado em stats, eixos e cards). */
  format: (value: number) => string;
}

/** Metadados compartilhados de uma métrica, por id (lança se desconhecida). */
function meta(id: string): HealthMetricMeta {
  const m = healthMetricById(id);
  if (!m) throw new Error(`Métrica de saúde desconhecida: ${id}`);
  return m;
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
 * Sono: cada amostra do HealthKit é um estágio (possivelmente de várias fontes
 * sobrepostas). Lemos os estágios crus e consolidamos por noite em
 * `aggregateSleepNights` (união de intervalos − despertares, atribuído ao dia em
 * que se acordou). Sem isso, fontes sobrepostas dobravam o tempo dormido.
 */
function sleepFetch(range: Range): Promise<Sample[]> {
  return callArray(
    'getSleepSamples',
    { startDate: range.startDate, endDate: range.endDate, ascending: true },
    (v: RawValue) => ({
      value: 0, // recalculado em aggregateSleepNights a partir dos intervalos
      start: v.startDate,
      end: v.endDate,
      label: String(v.value).toUpperCase(),
    })
  ).then(aggregateSleepNights);
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
  { ...meta('passos'), icon: 'footsteps-outline', chart: 'bar',
    fetch: cumulativeFetch('getDailyStepCountSamples'), format: fmt(0) },
  { ...meta('distancia'), icon: 'map-outline', chart: 'bar',
    fetch: cumulativeFetch('getDailyDistanceWalkingRunningSamples', { unit: 'meter' }),
    format: fmtDistance },
  { ...meta('andares'), icon: 'trending-up-outline', chart: 'bar',
    fetch: cumulativeFetch('getDailyFlightsClimbedSamples'), format: fmt(0) },
  { ...meta('energia'), icon: 'flame-outline', chart: 'bar',
    fetch: cumulativeFetch('getActiveEnergyBurned', { unit: 'kilocalorie' }), format: fmt(0) },
  { ...meta('exercicio'), icon: 'stopwatch-outline', chart: 'bar',
    fetch: cumulativeFetch('getAppleExerciseTime'), format: fmt(0) },
  { ...meta('aneis'), icon: 'ellipse-outline', chart: 'rings',
    fetch: ringsFetch, format: fmt(0) },

  // ── Coração ────────────────────────────────────────────────
  { ...meta('fc'), icon: 'heart-outline', chart: 'line',
    fetch: discreteFetch('getHeartRateSamples', { unit: 'bpm' }), format: fmt(0, 'bpm') },
  { ...meta('fcRepouso'), icon: 'bed-outline', chart: 'line',
    fetch: discreteFetch('getRestingHeartRateSamples', { unit: 'bpm' }), format: fmt(0, 'bpm') },
  { ...meta('vfc'), icon: 'pulse-outline', chart: 'line',
    fetch: discreteFetch('getHeartRateVariabilitySamples'), format: fmt(0, 'ms') },
  { ...meta('vo2max'), icon: 'fitness-outline', chart: 'line',
    fetch: discreteFetch('getVo2MaxSamples'), format: fmt(1) },
  { ...meta('spo2'), icon: 'water-outline', chart: 'line',
    fetch: discreteFetch('getOxygenSaturationSamples', { unit: 'percent' }, pctMap), format: fmt(0, '%') },
  { ...meta('respiracao'), icon: 'cloud-outline', chart: 'line',
    fetch: discreteFetch('getRespiratoryRateSamples'), format: fmt(0) },
  { ...meta('pressao'), icon: 'speedometer-outline', chart: 'line',
    fetch: bloodPressureFetch, format: fmt(0, 'mmHg') },

  // ── Corpo ──────────────────────────────────────────────────
  { ...meta('peso'), icon: 'barbell-outline', chart: 'line',
    fetch: discreteFetch('getWeightSamples', { unit: 'gram' }, kgMap), format: fmt(1, 'kg') },
  { ...meta('imc'), icon: 'body-outline', chart: 'line',
    fetch: discreteFetch('getBmiSamples', { unit: 'count' }), format: fmt(1) },
  { ...meta('gordura'), icon: 'pie-chart-outline', chart: 'line',
    fetch: discreteFetch('getBodyFatPercentageSamples', { unit: 'percent' }, pctMap), format: fmt(1, '%') },
  { ...meta('massaMagra'), icon: 'body-outline', chart: 'line',
    fetch: discreteFetch('getLeanBodyMassSamples', { unit: 'gram' }, kgMap), format: fmt(1, 'kg') },
  { ...meta('cintura'), icon: 'resize-outline', chart: 'line',
    fetch: discreteFetch('getWaistCircumferenceSamples', { unit: 'meter' }, (v) => ({
      value: v.value * 100, start: v.startDate, end: v.endDate,
    })),
    format: fmt(1, 'cm') },

  // ── Sono ───────────────────────────────────────────────────
  { ...meta('sono'), icon: 'moon-outline', chart: 'bar',
    fetch: sleepFetch, format: (v) => formatHoursMin(v) },

  // ── Nutrição ───────────────────────────────────────────────
  { ...meta('agua'), icon: 'water-outline', chart: 'bar',
    fetch: discreteFetch('getWaterSamples'), format: fmt(2, 'L') },
  { ...meta('calorias'), icon: 'fast-food-outline', chart: 'bar',
    fetch: discreteFetch('getEnergyConsumedSamples', { unit: 'kilocalorie' }), format: fmt(0, 'kcal') },
  { ...meta('macros'), icon: 'pie-chart-outline', chart: 'donut',
    fetch: macrosFetch, format: fmt(0, 'g') },
  { ...meta('proteina'), icon: 'nutrition-outline', chart: 'bar',
    fetch: discreteFetch('getProteinSamples', { unit: 'gram' }), format: fmt(0, 'g') },
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
