/**
 * A **forma** do despertar: quanto ele dura, e a que ele se alinha.
 *
 * ## As duas perguntas que este módulo responde
 *
 * 1. *"Quanto duram esses tempos acordados?"* — {@link typicalAwakening}.
 * 2. *"Estou acordando na mesma hora? Tem um trem, um avião me acordando?"* —
 *    {@link awakeAlignment}.
 *
 * ## Por que a mediana, e por que o mínimo não entra
 *
 * A distribuição é violentamente torta. Em agosto de 2026 foram 85 despertares e
 * **56 duraram menos de cinco minutos**; a média dá 6,6 min e a mediana dá 2. O
 * mínimo vale `0,0` min em toda janela testada — é a resolução do aparelho, não
 * um fato sobre a noite. Publicar "seu despertar mais curto durou zero minutos"
 * seria imprimir ruído com cara de dado, então o mínimo foi trocado pela **fração
 * abaixo de {@link AWAKE_REAL_MIN}**, que diz a mesma coisa e diz certo.
 *
 * ## O achado que deixa esta peça atravessar a troca de relógio
 *
 * A contagem por noite despenca de 4,3 (Apple, 245 noites) para 1,1 (Garmin, 44),
 * mas a **duração de um despertar de verdade não muda**: mediana 9 e 11 min, p90
 * 27 e 26. A contagem é do instrumento; a duração é da noite. Por isso
 * {@link typicalAwakening} pode ser comparada entre eras e a contagem não pode —
 * essa continua trancada pelo marcador em `sleep/markers.ts`.
 *
 * ## O alinhamento — a parte sutil
 *
 * Uma causa **externa** está presa ao relógio: o trem das 6h12 passa às 6h12,
 * você tendo dormido cedo ou tarde. Uma causa **interna** está presa ao sono: o
 * fim de um ciclo acontece tantas horas depois de você apagar. Alinhando os
 * mesmos despertares das duas maneiras, a que concentrar acima do acaso explica.
 *
 * O acaso aqui **não é uniforme no relógio**: às 4h você quase sempre está
 * dormindo, então é claro que há mais despertares ali. O esperado de cada faixa
 * sai de espalhar os despertares *de cada noite* uniformemente *dentro daquela
 * noite* — é o denominador de exposição, e sem ele o gráfico bruto mede o
 * relógio, não você.
 *
 * E há uma armadilha: rodado cru, o teste de relógio acusa 23h (44 contra 19,6
 * esperados, p < 0,001) e pareceria haver um evento à meia-noite. Não há — 23h é
 * simplesmente quando ele **tinha acabado de pegar no sono**, e o pico de início
 * de noite vaza para o eixo do relógio. Por isso o teste de relógio desconta os
 * primeiros {@link ALIGNMENT_ONSET_GUARD_MIN} minutos de sono. Descontados eles,
 * a hora mais destacada vira 8h com 1,28× e p = 0,50: **nada**.
 *
 * Medido em 06/09/2026 sobre 1.047 despertares da era Apple. Confirmado contra
 * um teste de permutação com 2.000 embaralhamentos, que chegou à mesma conclusão
 * (relógio p = 0,72; desde que dormiu p < 0,001) por um caminho caro demais para
 * rodar no aparelho.
 */

import type { SleepPeriod } from '../models';
import { axisPosition, awakeningMin } from './timing';

/**
 * Piso de duração para um despertar contar como despertar, em minutos.
 *
 * Cinco minutos é o critério do Ohayon. Abaixo disso está o chão do sensor: 75%
 * dos eventos da era Apple e 61% dos da Garmin. A comparação é `>=`, igual à das
 * faixas de {@link AWAKE_DURATION_BUCKETS}.
 */
export const AWAKE_REAL_MIN = 5;

/** Noites que o teste de alinhamento olha para trás. Ver {@link awakeAlignment}. */
export const ALIGNMENT_NIGHTS = 180;

/**
 * Minutos de sono descontados do teste de **relógio**.
 *
 * Sem eles o pico de início de noite vaza para o eixo do relógio e o teste acusa
 * um evento externo que não existe. Ver a nota no cabeçalho.
 */
export const ALIGNMENT_ONSET_GUARD_MIN = 60;

/** Abaixo disto o teste não roda: agosto inteiro rende 29 eventos. */
export const ALIGNMENT_MIN_EVENTS = 200;

/** Faixa com menos que isto de esperado não é candidata a pico. */
export const ALIGNMENT_MIN_EXPECTED = 5;

/** Significância da família, já corrigida por Bonferroni sobre as faixas. */
export const ALIGNMENT_ALPHA = 0.05;

const SINCE_BIN_MIN = 30;
const SINCE_BINS = 16;
const CLOCK_BINS = 24;

/* ─────────────────────────── o despertar típico ─────────────────────────── */

export interface TypicalAwakening {
  /** Noites cuja fonte reporta despertares — o denominador honesto. */
  reporting: number;
  /** Todos os despertares do período. */
  total: number;
  /** Os que ficaram abaixo de {@link AWAKE_REAL_MIN} — o chão do sensor. */
  brief: number;
  /** Os de {@link AWAKE_REAL_MIN} minutos ou mais. */
  real: number;
  /** Mediana dos reais, em minutos. `null` sem nenhum real. */
  medianMin: number | null;
  /** O nono decil dos reais — "o longo". `null` com menos de 5 reais. */
  p90Min: number | null;
  /** O maior de todos, com o dia e a hora de eixo em que começou. */
  longest: { min: number; day: string; at: number } | null;
}

const quantile = (sorted: readonly number[], p: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

/**
 * Os três números que resumem a vigília de um período, mais a fração de piscada.
 *
 * `null` quando nenhuma noite reporta: a fonte muda não é zero despertar.
 */
export function typicalAwakening(periods: readonly SleepPeriod[]): TypicalAwakening | null {
  const reporting = periods.filter((p) => p.awakenings !== null);
  if (reporting.length === 0) return null;

  const events = reporting.flatMap((p) =>
    (p.awakenings ?? []).map((a) => ({
      min: awakeningMin(a),
      day: p.wakeDay,
      at: axisPosition(a.from, p.tzOffset),
    })),
  );
  const real = events.filter((e) => e.min >= AWAKE_REAL_MIN).map((e) => e.min).sort((a, b) => a - b);

  return {
    reporting: reporting.length,
    total: events.length,
    brief: events.length - real.length,
    real: real.length,
    medianMin: real.length > 0 ? quantile(real, 0.5) : null,
    p90Min: real.length >= 5 ? quantile(real, 0.9) : null,
    longest: events.length > 0 ? events.reduce((m, e) => (e.min > m.min ? e : m)) : null,
  };
}

/* ──────────────────────────── relógio ou corpo ──────────────────────────── */

/** Uma faixa do teste: o que houve contra o que o acaso daria. */
export interface AlignmentBin {
  /** Início da faixa — hora do dia (relógio) ou horas desde o início do sono. */
  from: number;
  observed: number;
  expected: number;
}

/** A faixa mais destacada de um alinhamento, se alguma se destacar. */
export interface AlignmentPeak {
  from: number;
  observed: number;
  expected: number;
  /** observado ÷ esperado. */
  ratio: number;
  /** Cauda de Poisson já multiplicada pelo número de faixas candidatas. */
  p: number;
}

export interface AlignmentTest {
  bins: AlignmentBin[];
  /** A faixa de menor `p`. `null` quando nenhuma faixa é candidata. */
  peak: AlignmentPeak | null;
  events: number;
  /** `peak.p < ALIGNMENT_ALPHA` — há concentração acima do acaso. */
  significant: boolean;
}

export interface AwakeAlignment {
  /** Noites olhadas — as últimas {@link ALIGNMENT_NIGHTS} que reportam. */
  nights: number;
  /** Despertares de {@link AWAKE_REAL_MIN} min ou mais nessas noites. */
  events: number;
  /** Alinhado pela hora do relógio, descontada a primeira hora de sono. */
  clock: AlignmentTest;
  /** Alinhado pelo tempo desde que pegou no sono. */
  since: AlignmentTest;
  /** O primeiro e o último dia da janela — a peça mostra de quando ela fala. */
  from: string;
  to: string;
}

/**
 * `P(X >= k)` para uma Poisson de média `lambda`, somando a cauda de baixo.
 *
 * A independência entre despertares da mesma noite é aproximação declarada: o
 * resultado bate com a permutação nas duas eras, que não a assume.
 */
export function poissonTailAtLeast(k: number, lambda: number): number {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;
  let term = Math.exp(-lambda);
  let cum = term;
  for (let i = 1; i < k; i += 1) {
    term *= lambda / i;
    cum += term;
  }
  return Math.min(1, Math.max(0, 1 - cum));
}

/** A faixa de menor `p` entre as candidatas, com Bonferroni sobre elas. */
function peakOf(bins: readonly AlignmentBin[]): AlignmentPeak | null {
  const eligible = bins.filter((b) => b.expected >= ALIGNMENT_MIN_EXPECTED);
  if (eligible.length === 0) return null;
  let best: AlignmentPeak | null = null;
  for (const b of eligible) {
    const p = Math.min(1, poissonTailAtLeast(b.observed, b.expected) * eligible.length);
    if (best === null || p < best.p) {
      best = { from: b.from, observed: b.observed, expected: b.expected, ratio: b.observed / b.expected, p };
    }
  }
  return best;
}

interface Prepared {
  /** Minutos locais desde a meia-noite em que a noite começou. */
  onClock: number;
  /** Duração da noite, do onset ao despertar final. */
  len: number;
  /** Cada despertar: minutos desde o onset, e hora local do começo. */
  events: { since: number; clock: number }[];
}

function prepare(periods: readonly SleepPeriod[]): Prepared[] {
  const out: Prepared[] = [];
  for (const p of periods) {
    if (p.awakenings === null) continue;
    const on = new Date(p.onsetAt).getTime();
    const len = (new Date(p.wakeAt).getTime() - on) / 60_000;
    if (!(len > 0)) continue;
    const local = (iso: string) => {
      const d = new Date(new Date(iso).getTime() + p.tzOffset * 60_000);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };
    out.push({
      onClock: local(p.onsetAt),
      len,
      events: p.awakenings
        .filter((a) => awakeningMin(a) >= AWAKE_REAL_MIN)
        .map((a) => ({ since: (new Date(a.from).getTime() - on) / 60_000, clock: local(a.from) })),
    });
  }
  return out;
}

/**
 * Alinhado pela hora do relógio, descontando os primeiros `guard` minutos.
 *
 * O esperado de cada hora é a massa que as noites passam nela dentro da janela
 * elegível — a exposição. Percorre a noite em passos de 2 min: mais fino não
 * muda o resultado e a peça roda a cada render.
 */
function clockTest(nights: readonly Prepared[], guard: number): AlignmentTest {
  const observed = new Array<number>(CLOCK_BINS).fill(0);
  const expected = new Array<number>(CLOCK_BINS).fill(0);
  const STEP = 2;

  for (const n of nights) {
    if (n.len <= guard) continue;
    const evs = n.events.filter((e) => e.since >= guard);
    for (const e of evs) observed[Math.floor(e.clock / 60) % CLOCK_BINS] += 1;
    if (evs.length === 0) continue;
    const span = n.len - guard;
    for (let m = guard; m < n.len; m += STEP) {
      const h = Math.floor((((n.onClock + m) % 1440) + 1440) % 1440 / 60) % CLOCK_BINS;
      expected[h] += (evs.length * STEP) / span;
    }
  }

  const bins = observed.map((o, i) => ({ from: i, observed: o, expected: expected[i] }));
  const peak = peakOf(bins);
  return {
    bins,
    peak,
    events: observed.reduce((a, b) => a + b, 0),
    significant: peak !== null && peak.p < ALIGNMENT_ALPHA,
  };
}

/** Alinhado pelo tempo desde que pegou no sono, em faixas de meia hora. */
function sinceTest(nights: readonly Prepared[]): AlignmentTest {
  const observed = new Array<number>(SINCE_BINS).fill(0);
  const expected = new Array<number>(SINCE_BINS).fill(0);

  for (const n of nights) {
    for (const e of n.events) {
      if (e.since >= 0 && e.since < SINCE_BINS * SINCE_BIN_MIN) observed[Math.floor(e.since / SINCE_BIN_MIN)] += 1;
    }
    if (n.events.length === 0) continue;
    for (let i = 0; i < SINCE_BINS; i += 1) {
      const lo = i * SINCE_BIN_MIN;
      const hi = Math.min((i + 1) * SINCE_BIN_MIN, n.len);
      if (hi > lo) expected[i] += (n.events.length * (hi - lo)) / n.len;
    }
  }

  const bins = observed.map((o, i) => ({ from: (i * SINCE_BIN_MIN) / 60, observed: o, expected: expected[i] }));
  const peak = peakOf(bins);
  return {
    bins,
    peak,
    events: observed.reduce((a, b) => a + b, 0),
    significant: peak !== null && peak.p < ALIGNMENT_ALPHA,
  };
}

/**
 * O teste inteiro sobre as últimas {@link ALIGNMENT_NIGHTS} noites que reportam.
 *
 * **A janela é fixa de propósito, e não é a do período.** O teste precisa de
 * algumas centenas de eventos: agosto de 2026 inteiro rende 29, e uma semana
 * rende dois. Rodada no período, a peça sumiria em quase todo mês e piscaria
 * conforme a janela encolhe. Ela responde a uma pergunta sobre *você*, não sobre
 * *este mês* — mesma decisão da base móvel de `sleep/score.ts`.
 *
 * `null` abaixo de {@link ALIGNMENT_MIN_EVENTS} despertares: sem amostra, a
 * resposta honesta é a ausência da peça.
 */
export function awakeAlignment(
  periods: readonly SleepPeriod[],
  window: number = ALIGNMENT_NIGHTS,
): AwakeAlignment | null {
  const sorted = periods.filter((p) => p.awakenings !== null).slice().sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
  const chosen = sorted.slice(-window);
  if (chosen.length === 0) return null;

  const nights = prepare(chosen);
  const events = nights.reduce((s, n) => s + n.events.length, 0);
  if (events < ALIGNMENT_MIN_EVENTS) return null;

  return {
    nights: chosen.length,
    events,
    clock: clockTest(nights, ALIGNMENT_ONSET_GUARD_MIN),
    since: sinceTest(nights),
    from: chosen[0].wakeDay,
    to: chosen[chosen.length - 1].wakeDay,
  };
}
