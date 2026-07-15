/**
 * Dedupe/merge de atividades entre fontes (HealthKit, Strava, intervals.icu).
 *
 * O mesmo treino físico pode chegar por até 3 caminhos: Apple Watch → HealthKit;
 * Garmin → Garmin Connect → "stub" no HealthKit (sem rota, FC só mín/máx);
 * Garmin → intervals.icu/Strava (FIT completo). Este módulo decide se um treino
 * entrante É um treino já persistido (match por família de tipo + sobreposição
 * temporal) e, em caso positivo, o que sobrescrever (fonte mais rica vence,
 * edições do usuário nunca são tocadas). A linha canônica NUNCA muda de id —
 * merge é upgrade-in-place na linha que chegou primeiro.
 *
 * FOLHA sem imports (nem relativos): importável do Deno (edge functions) com
 * path `.ts` explícito, e do web/mobile via `@vitale/shared`.
 */

/* ───────────────────────── Mapa de tipos ───────────────────────── */

/**
 * Tipo esportivo (Strava `sport_type` / intervals.icu `type` — nomenclaturas
 * compatíveis) → código de atividade do HealthKit usado em `activities.activity_id`
 * (37 corrida, 13 ciclismo…), para labels/ícones/retro continuarem funcionando.
 * Desconhecidos caem em 3000 ("Outro" no HK) — `getActivityMeta` exibe "Treino".
 */
const SPORT_TO_ACTIVITY_ID: Record<string, number> = {
  Run: 37,
  TrailRun: 37,
  VirtualRun: 37,
  Ride: 13,
  VirtualRide: 13,
  GravelRide: 13,
  MountainBikeRide: 13,
  EBikeRide: 13,
  EMountainBikeRide: 13,
  Walk: 52,
  Hike: 24,
  Swim: 46,
  OpenWaterSwim: 46,
  WeightTraining: 50,
  Rowing: 35,
  VirtualRow: 35,
  Elliptical: 16,
  StairStepper: 44,
  Yoga: 57,
  Pilates: 66,
  HighIntensityIntervalTraining: 63,
  Hiit: 63,
  Crossfit: 11,
  Workout: 73,
  Pickleball: 82,
};

/** Código HK "Outro" — cai no default de `getActivityMeta` (label "Treino"). */
export const ACTIVITY_ID_OTHER = 3000;

/** Strava `sport_type` → código de atividade HK. */
export function mapStravaSport(sportType: string | undefined | null): number {
  return (sportType && SPORT_TO_ACTIVITY_ID[sportType]) || ACTIVITY_ID_OTHER;
}

/** intervals.icu `type` → código de atividade HK (mesma nomenclatura da Strava). */
export function mapIntervalsType(type: string | undefined | null): number {
  return mapStravaSport(type);
}

/* ───────────────────────── Famílias de tipo ───────────────────────── */

export type ActivityFamily = 'foot' | 'cycle' | 'swim' | 'row' | 'generic';

/**
 * Família de um código de atividade — o match só acontece dentro da mesma
 * família. FOOT junta corrida/trilha/caminhada (o mesmo treino é rotulado
 * diferente entre ecossistemas); GENERIC junta o resto (ex.: "HIIT" no Watch e
 * "Cardio" no Garmin para a mesma sessão) — a sobreposição temporal decide.
 */
export function activityFamily(activityId: number): ActivityFamily {
  switch (activityId) {
    case 37:
    case 24:
    case 52:
      return 'foot';
    case 13:
      return 'cycle';
    case 46:
      return 'swim';
    case 35:
      return 'row';
    default:
      return 'generic';
  }
}

/* ───────────────────────── Match temporal ───────────────────────── */

/** Janela (h) de busca de candidatos em torno do start do treino entrante. */
export const MATCH_CANDIDATE_WINDOW_HOURS = 6;

export interface MatchWindow {
  activityId: number;
  /** ISO timestamps. */
  startAt: string;
  endAt: string;
}

const MIN_ELAPSED_S = 60;

function epochS(iso: string): number {
  return Date.parse(iso) / 1000;
}

function elapsedS(w: MatchWindow): number {
  return Math.max(MIN_ELAPSED_S, epochS(w.endAt) - epochS(w.startAt));
}

/** Fração de sobreposição relativa ao mais curto dos dois treinos (0–1). */
export function overlapRatio(a: MatchWindow, b: MatchWindow): number {
  const overlap = Math.max(
    0,
    Math.min(epochS(a.endAt), epochS(b.endAt)) - Math.max(epochS(a.startAt), epochS(b.startAt)),
  );
  return overlap / Math.min(elapsedS(a), elapsedS(b));
}

/**
 * Mesmo treino físico? Mesma família E (sobreposição ≥ 50% do mais curto OU
 * starts a ≤ 3 min e ends a ≤ 5 min — cobre o stub do Garmin com duração
 * aparada). Treinos vindos do mesmo FIT concordam em segundos (ratio ≈ 1).
 */
export function isSameWorkout(a: MatchWindow, b: MatchWindow): boolean {
  if (activityFamily(a.activityId) !== activityFamily(b.activityId)) return false;
  if (overlapRatio(a, b) >= 0.5) return true;
  const dStart = Math.abs(epochS(a.startAt) - epochS(b.startAt));
  const dEnd = Math.abs(epochS(a.endAt) - epochS(b.endAt));
  return dStart <= 180 && dEnd <= 300;
}

/**
 * Melhor candidato que casa com o treino entrante (maior sobreposição; empate
 * decidido pelo menor |Δstart|). null se nenhum casa.
 */
export function findMatch<T extends MatchWindow>(incoming: MatchWindow, candidates: T[]): T | null {
  let best: T | null = null;
  let bestRatio = -1;
  let bestDStart = Infinity;
  for (const c of candidates) {
    if (!isSameWorkout(incoming, c)) continue;
    const ratio = overlapRatio(incoming, c);
    const dStart = Math.abs(epochS(incoming.startAt) - epochS(c.startAt));
    if (ratio > bestRatio || (ratio === bestRatio && dStart < bestDStart)) {
      best = c;
      bestRatio = ratio;
      bestDStart = dStart;
    }
  }
  return best;
}

/* ───────────────────────── Riqueza e merge ───────────────────────── */

/** A fonte HealthKit foi escrita pelo Garmin Connect (stub sem rota/FC densa)? */
export function isGarminSource(sourceId?: string | null, sourceName?: string | null): boolean {
  if (sourceId && sourceId.toLowerCase().startsWith('com.garmin')) return true;
  if (sourceName && /garmin/i.test(sourceName)) return true;
  return false;
}

export interface RichnessInput {
  /** 'strava' | 'intervals' | 'healthkit' | null (linhas antigas = healthkit). */
  provider?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
  /** Nº de pontos GPS disponíveis (rota entrante ou `point_count` persistido). */
  routePointCount?: number | null;
  /** Tem stream de FC (entrante) ou `hr_zones` já computadas (persistida). */
  hasHrData?: boolean;
  distanceM?: number | null;
}

/**
 * Score de riqueza: rota GPS vale mais que FC, que vale mais que distância; o
 * rank de provider desempata (intervals > strava > HK-Apple > stub HK-Garmin).
 */
export function richnessScore(x: RichnessInput): number {
  let score = 0;
  if ((x.routePointCount ?? 0) > 0) score += 4;
  if (x.hasHrData) score += 2;
  if ((x.distanceM ?? 0) > 0) score += 1;
  if (x.provider === 'intervals') score += 0.3;
  else if (x.provider === 'strava') score += 0.2;
  else if (isGarminSource(x.sourceId, x.sourceName)) score += 0;
  else score += 0.1; // HealthKit nativo (Apple Watch / apps)
  return score;
}

export interface MergeTarget extends MatchWindow, RichnessInput {
  id: string;
  nameEdited?: boolean;
  durationEdited?: boolean;
}

export interface MergeIncoming extends MatchWindow, RichnessInput {
  provider: string;
  externalId: string;
  activityName?: string | null;
}

/**
 * Decisão de merge para um treino entrante que casou com a linha `target`.
 * O executor (edge function) monta o UPDATE a partir daqui; campos de edição do
 * usuário (`hidden`, `locally_edited`, nome/duração editados) nunca entram.
 */
export interface MergeDecision {
  /** Entrante mais rico → sobrescreve métricas (distância, zonas, elevação…). */
  incomingRicher: boolean;
  /** Alvo era stub Garmin via HealthKit → pode corrigir start/end (mesmo FIT). */
  overwriteTimes: boolean;
  /** Atualizar `activity_name` (entrante mais rico, com nome, sem edição). */
  setName: boolean;
  /** Atualizar `duration_s` (entrante mais rico, sem edição). */
  setDuration: boolean;
  /** Substituir a rota (entrante tem mais pontos que a persistida). */
  attachRoute: boolean;
}

export function planMerge(incoming: MergeIncoming, target: MergeTarget): MergeDecision {
  const incomingRicher = richnessScore(incoming) > richnessScore(target);
  const targetIsGarminStub =
    (target.provider == null || target.provider === 'healthkit') &&
    isGarminSource(target.sourceId, target.sourceName);
  return {
    incomingRicher,
    overwriteTimes: incomingRicher && targetIsGarminStub,
    setName: incomingRicher && !target.nameEdited && !!incoming.activityName?.trim(),
    setDuration: incomingRicher && !target.durationEdited,
    attachRoute: (incoming.routePointCount ?? 0) > (target.routePointCount ?? 0),
  };
}
