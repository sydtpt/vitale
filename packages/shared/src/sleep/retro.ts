/**
 * Sono na Retrospectiva — a **noite típica** de um período, comparada com a do
 * período anterior, e as frases que ela autoriza a manchete a dizer.
 *
 * ## O que é, e o que não é
 *
 * A Retrospectiva é um jornal: informa, não aconselha. Então tudo aqui é
 * grandeza que existe — média de horas, mediana de horário com o miolo p25–p75,
 * minutos acordado, horas por estágio, a nota que o usuário deu cruzada com o que
 * o relógio mediu — e as **diferenças saem em minutos**, nunca em nota, seta ou
 * índice. O saldo contra uma meta ficou fora por decisão (05/09/2026): tem cara
 * de placar, e a tela de sono recusa placar.
 *
 * A mesma peça serve três lugares — o bloco Sono da retro, o "antes × agora" do
 * Tempos e as colunas por semana — por isso mora no núcleo, não numa tela.
 *
 * ## Honestidade que o tipo carrega
 *
 * - `awake === null`: a fonte não reporta despertares. Não é zero.
 * - `delta.awakeMin === null` quando a comparação **cruza a troca de relógio**
 *   (`SONO_MARKERS`): a contagem de despertares muda de instrumento, e uma média
 *   única mentiria. A UI mostra o marcador na caixa de correções.
 * - `weekend === null` com menos de {@link MIN_WEEKEND_NIGHTS} noites de cada tipo.
 * - A manchete só cruza nota × medição com {@link MIN_RATING_NIGHTS} noites de
 *   cada lado — abaixo disso é uma noite, não um padrão.
 * - Estágios são estimativa do aparelho, comparáveis com você mesmo (spec R5);
 *   o texto nunca os compara com norma clínica.
 *
 * Ver docs/specs/retrospectiva/v2-jornal.md §9 e docs/specs/sono/spec.md CAP-9 e CAP-10.
 */

import type { SleepPeriod } from '../models';
import type { WeekHighlight } from '../week/highlights';
import { axisPosition, awakeningMin } from './timing';
import { awakeMinOf } from './derive';
import { bucketPeriods, median, quantile, type SleepBucket } from './buckets';
import { formatHm, isFreeWakeDay, type SleepMarker } from './facts';
import { socialJetlag } from './regularity';

/**
 * A referência de horas por noite — a **única** constante de sono do app. É a
 * mesma que a grade diária da retro usa como centro da escala divergente
 * (`HEALTH_TARGETS.sono` aponta para cá). Não é meta configurável: descobre-se se
 * o número está certo usando; se estiver errado, aí vira campo (v2-jornal §4.1).
 */
export const NIGHT_REFERENCE_H = 7;

/** Noites livres E de semana necessárias para falar de fim de semana. */
export const MIN_WEEKEND_NIGHTS = 2;

/** Noites com nota alta E com nota baixa para o cruzamento virar manchete. */
export const MIN_RATING_NIGHTS = 3;

/** Abaixo disto a diferença de horas dormidas é "o mesmo", não "menos". */
export const FLAT_SLEEP_MIN = 5;

/** Abaixo disto a diferença de tempo acordado não vira destaque. */
export const FLAT_AWAKE_MIN = 3;

/** Nota ao acordar a partir da qual a noite conta como "boa" no cruzamento. */
export const GOOD_RATING_MIN = 4;

const STAGE_KEYS = ['rem', 'core', 'deep'] as const;

/** Mediana e quartis de um horário, em horas de eixo (origem 18h). */
export interface SleepClockStat {
  median: number;
  p25: number;
  p75: number;
}

export interface SleepAwakeStat {
  /** Noites cuja fonte reporta despertares. */
  reporting: number;
  /** Dessas, quantas tiveram ao menos um. */
  nightsWith: number;
  /** Minutos acordado por noite, média sobre as que reportam. */
  minMean: number;
  /** Despertares por noite, média. */
  countMean: number;
  /** O despertar mais longo do período, com o dia e a hora de eixo em que começou. */
  longest: { min: number; day: string; at: number } | null;
}

/** Horas por estágio, média sobre as noites que têm hipnograma. */
export interface SleepStageStat {
  staged: number;
  rem: number;
  core: number;
  deep: number;
  unspecified: number;
}

/** Um lado da comparação — o período exibido ou o anterior. */
export interface SleepSide {
  nights: number;
  /** Horas dormidas por noite, média. */
  asleepH: number;
  /** Noites com {@link NIGHT_REFERENCE_H} horas ou mais. Contagem, não saldo. */
  nightsAtReference: number;
  onset: SleepClockStat;
  wake: SleepClockStat;
  /** `null` = a fonte não reporta. */
  awake: SleepAwakeStat | null;
  /** `null` = nenhuma noite com hipnograma. */
  stages: SleepStageStat | null;
  longest: { day: string; h: number };
  shortest: { day: string; h: number };
}

/** Diferenças `atual − anterior`, em minutos inteiros. */
export interface SleepDelta {
  asleepMin: number;
  /** `null` quando um dos lados não reporta ou a comparação cruza a troca de relógio. */
  awakeMin: number | null;
  onsetMin: number;
  wakeMin: number;
  remMin: number | null;
  coreMin: number | null;
  deepMin: number | null;
}

export interface SleepRatingsSide {
  n: number;
  asleepH: number;
  awakeMin: number | null;
}

/** A nota que o usuário deu ao acordar, cruzada com o que o relógio mediu. */
export interface SleepRatingsSplit {
  n: number;
  mean: number;
  /** Noites com nota ≥ {@link GOOD_RATING_MIN}. */
  hi: SleepRatingsSide | null;
  /** Noites com nota abaixo disso. */
  lo: SleepRatingsSide | null;
}

/** Fim de semana contra semana — o jetlag social de Roenneberg, dito em minutos. */
export interface SleepWeekend {
  /** Quanto o meio do sono cai mais tarde nas noites livres (negativo = mais cedo). */
  midpointLaterMin: number;
  onsetLaterMin: number;
  wakeLaterMin: number;
  freeNights: number;
  workNights: number;
}

export interface SleepRetro {
  cur: SleepSide;
  /** `null` sem noites no período anterior, ou quando não há anterior (Total). */
  prev: SleepSide | null;
  delta: SleepDelta | null;
  ratings: SleepRatingsSplit | null;
  weekend: SleepWeekend | null;
  /** A noite típica de cada semana do período — a faixa do Mês e da Estação. */
  weeks: SleepBucket[];
  /**
   * Marcador de troca de fonte cruzado pela comparação (dentro do período ou
   * entre o anterior e o atual). Quando existe, `delta.awakeMin` é `null`.
   */
  sourceChange: SleepMarker | null;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clockStat(positions: number[]): SleepClockStat {
  return { median: median(positions), p25: quantile(positions, 0.25), p75: quantile(positions, 0.75) };
}

function byDay(periods: readonly SleepPeriod[]): SleepPeriod[] {
  return [...periods].sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
}

/** Um lado da comparação. `null` sem noites. */
export function sleepSide(periods: readonly SleepPeriod[]): SleepSide | null {
  if (periods.length === 0) return null;
  const on = periods.map((p) => axisPosition(p.onsetAt, p.tzOffset));
  const wk = periods.map((p) => axisPosition(p.wakeAt, p.tzOffset));

  const reporting = periods.filter((p) => p.awakenings !== null);
  let awake: SleepAwakeStat | null = null;
  if (reporting.length > 0) {
    const events = reporting.flatMap((p) =>
      (p.awakenings ?? []).map((a) => ({ day: p.wakeDay, min: awakeningMin(a), at: axisPosition(a.from, p.tzOffset) })),
    );
    awake = {
      reporting: reporting.length,
      nightsWith: reporting.filter((p) => (p.awakenings?.length ?? 0) > 0).length,
      minMean: mean(reporting.map((p) => awakeMinOf(p) ?? 0)),
      countMean: mean(reporting.map((p) => p.awakenings?.length ?? 0)),
      longest: events.length > 0 ? events.reduce((m, a) => (a.min > m.min ? a : m)) : null,
    };
  }

  const staged = periods.filter((p) => p.stages && STAGE_KEYS.some((k) => (p.stages?.[k] ?? 0) > 0));
  const stg = (k: string) => mean(staged.map((p) => p.stages?.[k] ?? 0));
  const stages: SleepStageStat | null =
    staged.length > 0
      ? { staged: staged.length, rem: stg('rem'), core: stg('core'), deep: stg('deep'), unspecified: stg('unspecified') }
      : null;

  const longest = periods.reduce((m, p) => (p.asleepH > m.asleepH ? p : m));
  const shortest = periods.reduce((m, p) => (p.asleepH < m.asleepH ? p : m));

  return {
    nights: periods.length,
    asleepH: mean(periods.map((p) => p.asleepH)),
    nightsAtReference: periods.filter((p) => p.asleepH >= NIGHT_REFERENCE_H).length,
    onset: clockStat(on),
    wake: clockStat(wk),
    awake,
    stages,
    longest: { day: longest.wakeDay, h: longest.asleepH },
    shortest: { day: shortest.wakeDay, h: shortest.asleepH },
  };
}

const toMin = (hours: number): number => Math.round(hours * 60);

function deltaOf(cur: SleepSide, prev: SleepSide): SleepDelta {
  const both = cur.stages && prev.stages;
  return {
    asleepMin: toMin(cur.asleepH - prev.asleepH),
    awakeMin: cur.awake && prev.awake ? Math.round(cur.awake.minMean - prev.awake.minMean) : null,
    onsetMin: toMin(cur.onset.median - prev.onset.median),
    wakeMin: toMin(cur.wake.median - prev.wake.median),
    remMin: both ? toMin(cur.stages!.rem - prev.stages!.rem) : null,
    coreMin: both ? toMin(cur.stages!.core - prev.stages!.core) : null,
    deepMin: both ? toMin(cur.stages!.deep - prev.stages!.deep) : null,
  };
}

/**
 * Nota ao acordar × medição. `null` sem mapa de notas ou sem noite com nota.
 * Cada lado (`hi`, `lo`) é `null` quando não tem noite.
 */
export function ratingsSplit(
  periods: readonly SleepPeriod[],
  ratings: ReadonlyMap<string, number> | undefined,
): SleepRatingsSplit | null {
  if (!ratings) return null;
  const rated = periods.filter((p) => ratings.has(p.wakeDay));
  if (rated.length === 0) return null;
  const side = (xs: SleepPeriod[]): SleepRatingsSide | null => {
    if (xs.length === 0) return null;
    const rep = xs.filter((p) => p.awakenings !== null);
    return {
      n: xs.length,
      asleepH: mean(xs.map((p) => p.asleepH)),
      awakeMin: rep.length > 0 ? Math.round(mean(rep.map((p) => awakeMinOf(p) ?? 0))) : null,
    };
  };
  const note = (p: SleepPeriod) => ratings.get(p.wakeDay)!;
  return {
    n: rated.length,
    mean: mean(rated.map(note)),
    hi: side(rated.filter((p) => note(p) >= GOOD_RATING_MIN)),
    lo: side(rated.filter((p) => note(p) < GOOD_RATING_MIN)),
  };
}

/**
 * Fim de semana contra semana. O meio do sono vem de `socialJetlag` (médias, como
 * Roenneberg define); apagar e acordar vêm de medianas, como os fatos do Tempos.
 * `null` com menos de {@link MIN_WEEKEND_NIGHTS} noites de um dos tipos.
 */
export function weekendShift(periods: readonly SleepPeriod[]): SleepWeekend | null {
  const free = periods.filter((p) => isFreeWakeDay(p.wakeDay));
  const work = periods.filter((p) => !isFreeWakeDay(p.wakeDay));
  if (free.length < MIN_WEEKEND_NIGHTS || work.length < MIN_WEEKEND_NIGHTS) return null;
  const sj = socialJetlag(periods);
  if (!sj) return null;
  const med = (xs: SleepPeriod[], at: (p: SleepPeriod) => string) =>
    median(xs.map((p) => axisPosition(at(p), p.tzOffset)));
  return {
    midpointLaterMin: toMin(sj.msf - sj.msw),
    onsetLaterMin: toMin(med(free, (p) => p.onsetAt) - med(work, (p) => p.onsetAt)),
    wakeLaterMin: toMin(med(free, (p) => p.wakeAt) - med(work, (p) => p.wakeAt)),
    freeNights: free.length,
    workNights: work.length,
  };
}

/**
 * A comparação inteira. `null` sem noites no período exibido.
 *
 * `prev` é `null` quando não há período anterior (Total). Um `prev` vazio dá
 * `prev: null` e `delta: null` — a UI escreve o fato sem a variação.
 */
export function sleepRetro(
  cur: readonly SleepPeriod[],
  prev: readonly SleepPeriod[] | null,
  ratings?: ReadonlyMap<string, number>,
  markers: readonly SleepMarker[] = [],
): SleepRetro | null {
  const c = sleepSide(cur);
  if (!c) return null;
  const p = prev && prev.length > 0 ? sleepSide(prev) : null;

  const span = byDay(p ? [...prev!, ...cur] : cur);
  const first = span[0].wakeDay;
  const last = span[span.length - 1].wakeDay;
  const sourceChange = markers.find((m) => first < m.day && last >= m.day) ?? null;

  let delta = p ? deltaOf(c, p) : null;
  if (delta && sourceChange) delta = { ...delta, awakeMin: null };

  return {
    cur: c,
    prev: p,
    delta,
    ratings: ratingsSplit(cur, ratings),
    weekend: weekendShift(cur),
    weeks: bucketPeriods(cur, 'week'),
    sourceChange,
  };
}

/** "+12 min" · "−25 min" · "0 min". */
export function signedMin(min: number): string {
  const r = Math.round(Math.abs(min));
  if (r === 0) return '0 min';
  return `${min > 0 ? '+' : '−'}${r} min`;
}

function pct(delta: number, base: number): number {
  return base > 0 ? (Math.abs(delta) / base) * 100 : 0;
}

/**
 * Os destaques que o sono autoriza — no vocabulário de `buildRetroHighlights`.
 *
 * - **health** — horas dormidas (sempre) e tempo acordado (quando muda ≥ 3 min).
 * - **cross** — nota × medição, só com {@link MIN_RATING_NIGHTS} noites de cada
 *   lado. Tom neutro: a diferença entre como acordou e quanto dormiu não é boa
 *   nem má, é a informação. Decidido em 05/09/2026: pode ser a manchete do mês.
 *
 * `noun` é o nome do período ("semana", "mês"…); `noPrior` suprime a variação.
 */
export function sleepHighlights(r: SleepRetro, noun: string, noPrior: boolean): WeekHighlight[] {
  const out: WeekHighlight[] = [];
  const c = r.cur;
  const d = noPrior ? null : r.delta;
  const vs = `vs. ${noun} anterior`;

  if (!d || !r.prev) {
    out.push({
      id: 'sleep-asleep', kind: 'health', tone: 'neutral', icon: 'sleep',
      text: `Dormiu ${formatHm(c.asleepH)} por noite em ${c.nights} ${c.nights === 1 ? 'noite' : 'noites'}`,
      priority: 1,
    });
  } else {
    const flat = Math.abs(d.asleepMin) < FLAT_SLEEP_MIN;
    out.push({
      id: 'sleep-asleep', kind: 'health', tone: flat ? 'neutral' : d.asleepMin > 0 ? 'good' : 'bad', icon: 'sleep',
      text: flat
        ? `Dormiu ${formatHm(c.asleepH)} por noite, o mesmo que no ${noun} anterior`
        : `Dormiu ${formatHm(c.asleepH)} por noite · ${signedMin(d.asleepMin)} ${vs}`,
      priority: pct(d.asleepMin / 60, r.prev.asleepH),
    });
    if (c.awake && r.prev.awake && d.awakeMin !== null && Math.abs(d.awakeMin) >= FLAT_AWAKE_MIN) {
      out.push({
        id: 'sleep-awake', kind: 'health', tone: d.awakeMin > 0 ? 'bad' : 'good', icon: 'sleep',
        text: `Acordado ${Math.round(c.awake.minMean)} min por noite · ${signedMin(d.awakeMin)} ${vs}`,
        priority: pct(d.awakeMin, r.prev.awake.minMean),
      });
    }
  }

  const rt = r.ratings;
  if (rt?.hi && rt.lo && rt.hi.n >= MIN_RATING_NIGHTS && rt.lo.n >= MIN_RATING_NIGHTS) {
    out.push({
      id: 'sleep-rating', kind: 'cross', tone: 'neutral', icon: 'sleep',
      text: `Nas noites com nota ${GOOD_RATING_MIN} ou mais dormiu ${formatHm(rt.hi.asleepH)}; com nota ${GOOD_RATING_MIN - 1} ou menos, ${formatHm(rt.lo.asleepH)}`,
      support: `${rt.hi.n} noites · ${rt.lo.n} noites · a nota é sua, a medição é do relógio`,
      priority: pct(rt.hi.asleepH - rt.lo.asleepH, rt.lo.asleepH),
    });
  }
  return out;
}
