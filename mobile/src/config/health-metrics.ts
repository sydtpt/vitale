/**
 * Registro central das métricas de saúde.
 * Cada métrica descreve como buscar (HealthKit), agregar, colorir e formatar.
 * Tanto o dashboard quanto a tela de detalhe são gerados a partir daqui.
 */
import type { Ionicons } from '@expo/vector-icons';
import { HK, healthSource, type HealthTypeId } from '../lib/health-source/active';
import { HEALTH_METRICS, healthMetricById, type HealthMetricMeta } from '@vitale/shared';
import { colors, moduleColors } from '../theme';
import {
  Sample,
  Period,
  formatNumber,
  formatHoursMin,
  aggregateSleepNights,
  dedupeBySource,
} from '../lib/health-buckets';

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

/**
 * Função, não constante: `tint` e `accent` dependem do tema e da paleta ativos,
 * e um array no escopo do módulo os congelaria no import — o que produzia chip
 * claro sobre fundo escuro. Chame no render.
 */
export function categories(): CategoryMeta[] {
  const treino = moduleColors('treino');
  const casa = moduleColors('casa');
  const food = moduleColors('food');
  const saude = moduleColors('saude');
  const agua = moduleColors('agua');
  return [
    { id: 'atividade', label: 'Atividade', icon: 'flame-outline', tint: treino.tint, accent: treino.accent },
    { id: 'coracao', label: 'Coração', icon: 'heart-outline', tint: saude.tint, accent: saude.accent },
    { id: 'corpo', label: 'Corpo', icon: 'body-outline', tint: casa.tint, accent: casa.accent },
    { id: 'sono', label: 'Sono', icon: 'moon-outline', tint: agua.tint, accent: agua.accent },
    { id: 'nutricao', label: 'Nutrição', icon: 'restaurant-outline', tint: food.tint, accent: food.accent },
  ];
}

export function categoryMeta(id: CategoryId): CategoryMeta {
  return categories().find((c) => c.id === id)!;
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

/** Aplica o mapa e descarta o que não é número — a forma que todos os fetch usam. */
function toSamples(raw: readonly any[], map: (v: any) => Sample): Sample[] {
  return raw.map(map).filter((s: Sample) => Number.isFinite(s.value));
}

/** Métricas cumulativas (passos, kcal…): HealthKit agrega por intervalo via `period`. */
function cumulativeFetch(type: HealthTypeId, opts: { unit?: string } = {}, map = defaultMap) {
  return (range: Range, period: Period): Promise<Sample[]> =>
    healthSource
      .queryAggregatedSamples(type, {
        startDate: range.startDate,
        endDate: range.endDate,
        ascending: true,
        includeManuallyAdded: true,
        periodMinutes: period === 'day' ? 60 : 1440,
        ...opts,
      })
      .then((raw) => toSamples(raw, map));
}

/**
 * Amostra crua devolvida por `getSamples` — chaves diferentes das dos agregados
 * (`quantity`/`distance` em vez de `value`, `start`/`end` em vez de `*Date`).
 */
type RawSourced = {
  quantity?: number;
  distance?: number;
  start: string;
  end: string;
  sourceId?: string;
  sourceName?: string;
};

/** Blocos do fatiamento da janela (ver `multiSourceFetch`). */
const CHUNK_DAYS = 30;
const DAY_MS = 86_400_000;
const METERS_PER_MILE = 1609.344;

/** Fatia um intervalo em janelas de no máximo `days` dias, sem sobreposição. */
function chunkRange(range: Range, days: number): Range[] {
  const startMs = new Date(range.startDate).getTime();
  const endMs = new Date(range.endDate).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return [range];
  const step = days * DAY_MS;
  const out: Range[] = [];
  for (let from = startMs; from < endMs; from += step + 1) {
    const to = Math.min(from + step, endMs);
    out.push({ startDate: new Date(from).toISOString(), endDate: new Date(to).toISOString() });
  }
  return out;
}

/**
 * Cumulativas com mais de uma fonte escrevendo (iPhone + relógio + apps).
 *
 * As chamadas `getDaily*Samples`/`getActiveEnergyBurned` usam
 * `HKStatisticsOptionCumulativeSum` e leem `sumQuantity`, que soma TODAS as
 * fontes: desde que o Garmin Connect passou a escrever passos/distância junto
 * com o iPhone, a contagem vinha dobrada. Aqui puxamos as amostras CRUAS — que
 * trazem `sourceId` — e deduplicamos em `dedupeBySource`.
 *
 * O HealthKit devolve tudo num array só, então a janela é fatiada em blocos de
 * ~30 dias para o backfill de um ano não atravessar a ponte de uma vez.
 *
 * `scale` converte a unidade que a lib impõe ao tipo (ver chamadas em METRICS).
 */
function multiSourceFetch(type: HealthTypeId, scale = 1, opts: { unit?: string } = {}) {
  const map = (v: RawSourced): Sample => ({
    value: (v.quantity ?? v.distance ?? 0) * scale,
    start: v.start,
    end: v.end,
    source: v.sourceId ?? v.sourceName,
  });
  return async (range: Range): Promise<Sample[]> => {
    const samples: Sample[] = [];
    for (const window of chunkRange(range, CHUNK_DAYS)) {
      const raw = await healthSource.querySourcedSamples(type, {
        ...window,
        ascending: true,
        ...opts,
      });
      samples.push(...toSamples(raw, map));
    }
    return dedupeBySource(samples);
  };
}

/** Métricas pontuais (FC, peso…): amostras brutas, sem agregação. */
function discreteFetch(type: HealthTypeId, opts: { unit?: string } = {}, map = defaultMap) {
  return (range: Range): Promise<Sample[]> =>
    healthSource
      .queryQuantitySamples(type, {
        startDate: range.startDate,
        endDate: range.endDate,
        ascending: true,
        includeManuallyAdded: true,
        ...opts,
      })
      .then((raw) => toSamples(raw, map));
}

/** Pressão arterial: sistólica em `value`, diastólica em `extra`. */
function bloodPressureFetch(range: Range): Promise<Sample[]> {
  return healthSource
    .queryQuantitySamples(HK.bloodPressureSystolic, {
      startDate: range.startDate,
      endDate: range.endDate,
      ascending: true,
    })
    .then((raw) =>
      toSamples(raw, (v: RawValue) => ({
        value: v.bloodPressureSystolicValue ?? 0,
        extra: v.bloodPressureDiastolicValue,
        start: v.startDate,
        end: v.endDate,
      })),
    );
}

/**
 * Sono: cada amostra do HealthKit é um estágio (possivelmente de várias fontes
 * sobrepostas). Lemos os estágios crus e consolidamos por noite em
 * `aggregateSleepNights` (união de intervalos − despertares, atribuído ao dia em
 * que se acordou). Sem isso, fontes sobrepostas dobravam o tempo dormido.
 */
function sleepFetch(range: Range): Promise<Sample[]> {
  return healthSource
    .queryCategorySamples(HK.sleepAnalysis, {
      startDate: range.startDate,
      endDate: range.endDate,
      ascending: true,
    })
    .then((raw) =>
      raw.map((v) => ({
        value: 0, // recalculado em aggregateSleepNights a partir dos intervalos
        start: v.startDate,
        end: v.endDate,
        label: String(v.value).toUpperCase(),
      })),
    )
    .then(aggregateSleepNights);
}

/** Anéis de atividade: 3 amostras (mover/exercício/em pé) do dia mais recente. */
function ringsFetch(range: Range): Promise<Sample[]> {
  return healthSource.queryActivityRings(range).then((rings) => {
    if (!rings) return [];
    const now = new Date().toISOString();
    // `extra` é a meta do anel. Fonte hoje: o próprio HKActivitySummary. Quando o
    // adaptador não a expuser, `?? 0` degrada para anel sem meta em vez de quebrar.
    return [
      { label: 'Mover', value: rings.activeEnergyBurned, extra: rings.activeEnergyBurnedGoal ?? 0, start: now, end: now },
      { label: 'Exercício', value: rings.appleExerciseTime, extra: rings.appleExerciseTimeGoal ?? 0, start: now, end: now },
      { label: 'Em pé', value: rings.appleStandHours, extra: rings.appleStandHoursGoal ?? 0, start: now, end: now },
    ];
  });
}

/** Macros: total de gramas de proteína/carbo/gordura no período (para o donut). */
function macrosFetch(range: Range): Promise<Sample[]> {
  const grab = (type: HealthTypeId) =>
    healthSource
      .queryQuantitySamples(type, {
        startDate: range.startDate,
        endDate: range.endDate,
        ascending: true,
        unit: 'gram',
        includeManuallyAdded: true,
      })
      .then((raw) => toSamples(raw, defaultMap));
  return Promise.all([
    grab(HK.dietaryProtein),
    grab(HK.dietaryCarbohydrates),
    grab(HK.dietaryFatTotal),
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
  // As quatro abaixo têm iPhone e relógio escrevendo em paralelo → multiSourceFetch.
  { ...meta('passos'), icon: 'footsteps-outline', chart: 'bar',
    fetch: multiSourceFetch(HK.stepCount), format: fmt(0) },
  { ...meta('distancia'), icon: 'map-outline', chart: 'bar',
    // A lib legada força milhas neste tipo; a conversão fica no `scale`.
    fetch: multiSourceFetch(HK.distanceWalkingRunning, METERS_PER_MILE), format: fmtDistance },
  { ...meta('andares'), icon: 'trending-up-outline', chart: 'bar',
    fetch: multiSourceFetch(HK.flightsClimbed), format: fmt(0) },
  { ...meta('energia'), icon: 'flame-outline', chart: 'bar',
    // 'calorie' é a única unidade de energia que a lib mapeia → cal para kcal.
    fetch: multiSourceFetch(HK.activeEnergyBurned, 1 / 1000, { unit: 'calorie' }), format: fmt(0) },
  // Métrica exclusiva da Apple: fonte única, sem risco de dupla contagem.
  { ...meta('exercicio'), icon: 'stopwatch-outline', chart: 'bar',
    fetch: cumulativeFetch(HK.appleExerciseTime), format: fmt(0) },
  { ...meta('aneis'), icon: 'ellipse-outline', chart: 'rings',
    fetch: ringsFetch, format: fmt(0) },

  // ── Coração ────────────────────────────────────────────────
  { ...meta('fc'), icon: 'heart-outline', chart: 'line',
    fetch: discreteFetch(HK.heartRate, { unit: 'bpm' }), format: fmt(0, 'bpm') },
  { ...meta('fcRepouso'), icon: 'bed-outline', chart: 'line',
    fetch: discreteFetch(HK.restingHeartRate, { unit: 'bpm' }), format: fmt(0, 'bpm') },
  { ...meta('vfc'), icon: 'pulse-outline', chart: 'line',
    fetch: discreteFetch(HK.heartRateVariability), format: fmt(0, 'ms') },
  { ...meta('vo2max'), icon: 'fitness-outline', chart: 'line',
    fetch: discreteFetch(HK.vo2Max), format: fmt(1) },
  { ...meta('spo2'), icon: 'water-outline', chart: 'line',
    fetch: discreteFetch(HK.oxygenSaturation, { unit: 'percent' }, pctMap), format: fmt(0, '%') },
  { ...meta('respiracao'), icon: 'cloud-outline', chart: 'line',
    fetch: discreteFetch(HK.respiratoryRate), format: fmt(0) },
  { ...meta('pressao'), icon: 'speedometer-outline', chart: 'line',
    fetch: bloodPressureFetch, format: fmt(0, 'mmHg') },

  // ── Corpo ──────────────────────────────────────────────────
  { ...meta('peso'), icon: 'barbell-outline', chart: 'line',
    fetch: discreteFetch(HK.bodyMass, { unit: 'gram' }, kgMap), format: fmt(1, 'kg') },
  { ...meta('imc'), icon: 'body-outline', chart: 'line',
    fetch: discreteFetch(HK.bodyMassIndex, { unit: 'count' }), format: fmt(1) },
  { ...meta('gordura'), icon: 'pie-chart-outline', chart: 'line',
    fetch: discreteFetch(HK.bodyFatPercentage, { unit: 'percent' }, pctMap), format: fmt(1, '%') },
  { ...meta('massaMagra'), icon: 'body-outline', chart: 'line',
    fetch: discreteFetch(HK.leanBodyMass, { unit: 'gram' }, kgMap), format: fmt(1, 'kg') },
  { ...meta('cintura'), icon: 'resize-outline', chart: 'line',
    fetch: discreteFetch(HK.waistCircumference, { unit: 'meter' }, (v) => ({
      value: v.value * 100, start: v.startDate, end: v.endDate,
    })),
    format: fmt(1, 'cm') },

  // ── Sono ───────────────────────────────────────────────────
  { ...meta('sono'), icon: 'moon-outline', chart: 'bar',
    fetch: sleepFetch, format: (v) => formatHoursMin(v) },

  // ── Nutrição ───────────────────────────────────────────────
  { ...meta('agua'), icon: 'water-outline', chart: 'bar',
    fetch: discreteFetch(HK.dietaryWater), format: fmt(2, 'L') },
  { ...meta('calorias'), icon: 'fast-food-outline', chart: 'bar',
    fetch: discreteFetch(HK.dietaryEnergyConsumed, { unit: 'kilocalorie' }), format: fmt(0, 'kcal') },
  { ...meta('macros'), icon: 'pie-chart-outline', chart: 'donut',
    fetch: macrosFetch, format: fmt(0, 'g') },
  { ...meta('proteina'), icon: 'nutrition-outline', chart: 'bar',
    fetch: discreteFetch(HK.dietaryProtein, { unit: 'gram' }), format: fmt(0, 'g') },
];

export function metricById(id: string): MetricDef | undefined {
  return METRICS.find((m) => m.id === id);
}

export function metricsByCategory(id: CategoryId): MetricDef[] {
  return METRICS.filter((m) => m.category === id);
}

/* ───────────────────────── Permissões ───────────────────────── */

/** Tipos do HealthKit que a aba Saúde precisa ler. */
export const HEALTH_PERMISSIONS: readonly HealthTypeId[] = [
  HK.activitySummary, HK.stepCount, HK.distanceWalkingRunning, HK.flightsClimbed,
  HK.activeEnergyBurned, HK.basalEnergyBurned, HK.appleExerciseTime,
  HK.heartRate, HK.restingHeartRate, HK.heartRateVariability, HK.vo2Max,
  HK.oxygenSaturation, HK.respiratoryRate, HK.bloodPressureSystolic, HK.bloodPressureDiastolic,
  HK.bodyMass, HK.bodyMassIndex, HK.bodyFatPercentage, HK.leanBodyMass, HK.waistCircumference,
  HK.sleepAnalysis, HK.dietaryWater, HK.dietaryEnergyConsumed, HK.dietaryProtein,
  HK.dietaryCarbohydrates, HK.dietaryFatTotal,
  HK.biologicalSex, HK.bloodType, HK.dateOfBirth,
];

/* ───────────────────────── Perfil (estático) ───────────────────────── */

export interface HealthProfile {
  biologicalSex?: string;
  bloodType?: string;
  age?: number;
}

const SEX_LABEL: Record<string, string> = { male: 'Masculino', female: 'Feminino', other: 'Outro' };

export function loadProfile(): Promise<HealthProfile> {
  return healthSource.queryCharacteristics().then((c) => ({
    biologicalSex:
      c.biologicalSex === undefined
        ? undefined
        : SEX_LABEL[String(c.biologicalSex)] ?? c.biologicalSex,
    bloodType: c.bloodType && c.bloodType !== 'unknown' ? c.bloodType : undefined,
    age: c.age,
  }));
}
