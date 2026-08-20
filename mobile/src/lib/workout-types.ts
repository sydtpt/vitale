/**
 * Tipos e helpers puros de treino — sem dependência de react-native / HealthKit.
 * Importável em testes e em código compartilhado sem mocks nativos.
 */
import type { MaterialCommunityIcons } from '@expo/vector-icons';
import { activityTypeLabel } from '@vitale/shared';
import type { RoutePoint } from '@vitale/shared';

export type PermissionStatus = 'unknown' | 'authorized' | 'denied' | 'unavailable';

export interface WorkoutItem {
  id: string;
  activityId: number;
  activityName: string;
  calories: number;
  start: string;
  end: string;
  duration: number; // seconds — duração ativa (HKWorkout.duration, já exclui pausas). Para o "tempo total" use totalTimeS(start, end, duration).
  movingTimeS: number; // seconds — tempo em movimento (total menos pausas)
  distance?: number; // meters
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  metadata?: Record<string, unknown>;
  workoutEventsCount?: number;
}

/** Evento de treino do HealthKit (subconjunto usado para descontar pausas). */
export interface WorkoutEventLike {
  eventType?: string; // 'pause' | 'resume' | 'motion paused' | 'motion resumed' | ...
  startDate?: string;
}

const PAUSE_EVENT_TYPES = new Set(['pause', 'motion paused']);
const RESUME_EVENT_TYPES = new Set(['resume', 'motion resumed']);

/**
 * Soma (s) dos intervalos pausados a partir dos workoutEvents. Pareia cada pausa
 * com a próxima retomada e une intervalos sobrepostos, para que auto-pause e
 * pausa manual não sejam contados em dobro.
 */
export function pausedSecondsFromEvents(events: WorkoutEventLike[] | undefined): number {
  if (!events || events.length === 0) return 0;

  const sorted = events
    .map((e) => ({ type: (e.eventType ?? '').toLowerCase(), t: Date.parse(e.startDate ?? '') }))
    .filter((e) => Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);

  const intervals: Array<[number, number]> = [];
  let pauseStart: number | null = null;
  for (const e of sorted) {
    if (PAUSE_EVENT_TYPES.has(e.type)) {
      if (pauseStart === null) pauseStart = e.t;
    } else if (RESUME_EVENT_TYPES.has(e.type) && pauseStart !== null) {
      intervals.push([pauseStart, e.t]);
      pauseStart = null;
    }
  }

  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, end] of intervals) {
    if (s > curEnd) {
      if (curEnd >= 0) total += curEnd - curStart;
      curStart = s;
      curEnd = end;
    } else {
      curEnd = Math.max(curEnd, end);
    }
  }
  if (curEnd >= 0) total += curEnd - curStart;

  return Math.max(0, Math.round(total / 1000));
}

/**
 * Tempo em movimento (s): tempo decorrido (fim − início) menos as pausas. É
 * limitado por `durationS` (HKWorkout.duration), que já pode excluir pausas —
 * assim o tempo em movimento nunca passa do tempo total exibido.
 */
export function computeMovingTimeS(args: {
  start: string;
  end: string;
  durationS: number;
  events?: WorkoutEventLike[];
}): number {
  const duration = Math.max(0, Math.round(args.durationS));
  const elapsed = Math.round((Date.parse(args.end) - Date.parse(args.start)) / 1000);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return duration;

  const moving = elapsed - pausedSecondsFromEvents(args.events);
  // Conservador: o menor entre (decorrido − pausas) e o tempo total do HealthKit.
  return Math.max(0, duration > 0 ? Math.min(moving, duration) : moving);
}


/**
 * Fator milha → metro. O react-native-health devolve a distância dos workouts
 * em milhas (`HKUnit mileUnit` no nativo), então convertemos na leitura para
 * manter `WorkoutItem.distance` em metros, como o resto do código assume.
 */
export const METERS_PER_MILE = 1609.344;

/** Converte a distância de workout do HealthKit (milhas) para metros. */
export function milesToMeters(miles?: number): number | undefined {
  return typeof miles === 'number' ? miles * METERS_PER_MILE : undefined;
}

/** Taxonomia de tipos de treino — definida em `@vitale/shared`, repassada aqui. */
export { GPS_ACTIVITY_IDS, hasGpsRoute } from '@vitale/shared';
export type { RoutePoint } from '@vitale/shared';

/**
 * Janela da média móvel centrada (amostras ≈ segundos a 1 Hz) e limiar da
 * histerese do ganho de elevação. DEVEM casar com o shared
 * (`ELEVATION_SMOOTH_WINDOW` / `ELEVATION_GAIN_THRESHOLD_M`).
 */
const ELEVATION_SMOOTH_WINDOW = 15;
const ELEVATION_GAIN_THRESHOLD_M = 3;

/** Média móvel centrada de janela `window`, encolhendo nas bordas. */
function smoothAltitudes(xs: number[], window: number): number[] {
  if (window <= 1) return xs;
  const half = Math.floor(window / 2);
  const prefix = new Array<number>(xs.length + 1);
  prefix[0] = 0;
  for (let i = 0; i < xs.length; i++) prefix[i + 1] = prefix[i] + xs[i];
  const out = new Array<number>(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(xs.length - 1, i + half);
    out[i] = (prefix[b + 1] - prefix[a]) / (b - a + 1);
  }
  return out;
}

/**
 * Ganho de elevação acumulado (m): suaviza a altitude (média móvel centrada)
 * e soma só as subidas, com histerese — a âncora só avança quando a variação
 * acumulada desde ela passa do limiar, então subidas graduais contam por
 * inteiro e o ruído do barômetro/GPS não. Espelha o
 * `elevationGainFromPoints` do shared.
 */
export function elevationGain(points: RoutePoint[], threshold = ELEVATION_GAIN_THRESHOLD_M): number {
  const alts: number[] = [];
  for (const p of points) {
    if (typeof p.altitude === 'number') alts.push(p.altitude);
  }
  let gain = 0;
  let ref: number | undefined;
  for (const alt of smoothAltitudes(alts, ELEVATION_SMOOTH_WINDOW)) {
    if (ref === undefined) {
      ref = alt;
      continue;
    }
    const delta = alt - ref;
    if (delta > threshold) {
      gain += delta;
      ref = alt;
    } else if (delta < -threshold) {
      ref = alt;
    }
  }
  return gain;
}

export type ActivityMeta = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string };

/** Ícone por tipo; o label vem do shared (`ACTIVITY_TYPE_LABELS`). */
const ACTIVITY_ICONS: Record<number, ActivityMeta['icon']> = {
  11: 'dumbbell',
  13: 'bike',
  16: 'run-fast',
  20: 'kettlebell',
  24: 'hiking',
  35: 'rowing',
  37: 'run',
  44: 'stairs-up',
  46: 'swim',
  50: 'weight-lifter',
  52: 'walk',
  57: 'yoga',
  59: 'arm-flex',
  63: 'jump-rope',
  66: 'meditation',
  73: 'heart-pulse',
  82: 'tennis',
};

export function getActivityMeta(activityId: number): ActivityMeta {
  return {
    icon: ACTIVITY_ICONS[activityId] ?? 'dumbbell',
    label: activityTypeLabel(activityId),
  };
}

/**
 * Tipos de atividade conhecidos (ordem de uso comum) — para seletores de UI,
 * como o vínculo Tarefa × Treino. Cada id resolve label/ícone via getActivityMeta.
 */
export const KNOWN_ACTIVITY_IDS = [
  37, 13, 52, 24, 46, 50, 57, 66, 63, 73, 11, 20, 35, 16, 44, 59, 82,
] as const;

/**
 * Cor por tipo de atividade — espelha web/src/app/core/models/activity-types.ts
 * (valores do design system). Usada nos segmentos do gráfico empilhado.
 * Mantida aqui (hex literais) para a função pura permanecer testável sem tema.
 */
const ACTIVITY_COLORS: Record<number, string> = {
  11: '#D9491B', // Cross Training
  13: '#6E8CC9', // Ciclismo
  16: '#6FA86A', // Elíptico
  20: '#B4825B', // Funcional
  24: '#6FA86A', // Trilha
  35: '#6E8CC9', // Remo
  37: '#F25C2B', // Corrida
  44: '#B4825B', // Escadas
  46: '#6E8CC9', // Natação
  50: '#1F1B16', // Musculação
  52: '#F5B946', // Caminhada
  57: '#6FA86A', // Yoga
  59: '#E26A8A', // Core
  63: '#D9491B', // HIIT
  66: '#E26A8A', // Pilates
  73: '#E26A8A', // Cardio
  82: '#F5B946', // Pickleball
};

const DEFAULT_ACTIVITY_COLOR = '#5C534A';

export function getActivityColor(activityId: number): string {
  return ACTIVITY_COLORS[activityId] ?? DEFAULT_ACTIVITY_COLOR;
}

/**
 * Chave determinística para treinos sem UUID do HealthKit, garantindo dedup
 * estável no sync (FR-014). Mesmos campos → mesma chave entre execuções.
 */
export function deriveWorkoutId(parts: {
  activityId?: number;
  start?: string;
  end?: string;
  sourceId?: string;
}): string {
  return `hk-derived:${parts.activityId ?? 0}:${parts.start ?? ''}:${parts.end ?? ''}:${parts.sourceId ?? ''}`;
}

export const YEARS_BACK = 3;
export const PAGE_SIZE = 1000;

/**
 * Janela do delta quando ainda NÃO há âncora utilizável — primeiro sync do
 * usuário ou troca de adaptador de HealthKit (ver `sync-anchor.ts`).
 *
 * Sem esse limite o delta cai em `YEARS_BACK` e varre o histórico inteiro: hoje
 * são ~400 treinos, e cada um custa uma busca de rota GPS e uma de FC, em série
 * — dezenas de minutos de ponte nativa, sem nenhum indicador na tela. Pior: a
 * âncora só é gravada no fim, então fechar o app antes disso faz o próximo
 * lançamento recomeçar do zero. O sync automático nunca converge.
 *
 * Varrer o histórico é trabalho do backfill (`syncType`), que é disparado pelo
 * usuário e tem barra de progresso. O delta é incremental por definição: pega a
 * janela recente, grava a âncora e a partir daí anda de verdade.
 */
export const DELTA_CATCHUP_DAYS = 7;

export function startDateYearsAgo(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

export function startDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
