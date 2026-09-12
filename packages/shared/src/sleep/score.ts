/**
 * Saúde do sono — a contagem de dimensões que substitui o placar.
 *
 * ## O que este módulo é, e o que ele recusa ser
 *
 * Não é um score de 0 a 100. É uma **contagem**: cada dimensão vale 0, 1 ou 2, e
 * o total é a soma — a escala do RU-SATED (Buysse 2014), que é a única moldura
 * multidimensional de sono saudável com instrumento publicado. A literatura, quando
 * compõe, compõe assim: o Wallace 2018 (n = 2.887, 11 anos) usa **contagem de
 * dimensões extremas**, e cada dimensão ruim a mais vale HR 1,10 — não uma média
 * ponderada de sete contribuidores com pesos não publicados, que é o que a
 * categoria faz.
 *
 * A diferença não é cosmética. Uma nota ponderada esconde de qual medida ela veio;
 * uma contagem mostra as cinco linhas e deixa a pessoa discordar de uma delas sem
 * descartar as outras quatro.
 *
 * ## As cinco dimensões, e por que exatamente estas
 *
 * | Dimensão | Origem do limiar |
 * |---|---|
 * | Duração | AASM/SRS 2015 — sete horas ou mais |
 * | Continuidade | Ohayon 2017 (consenso), mas com limiar **da própria pessoa** — ver abaixo |
 * | Horário | Buysse 2014, relativo ao habitual da pessoa, não à janela 2h–4h |
 * | Regularidade | Windred 2024 (UK Biobank, n = 60.977; HR 0,70 no quintil mais regular) |
 * | Percepção | Buysse 2014, dimensão "satisfaction" — o lado que só quem pergunta tem |
 *
 * **Estágios não entram, e o motivo é aritmético.** Medido nas 288 noites reais em
 * 06/09/2026: a fração de sono profundo tem ρ = −0,61 com as horas dormidas. As
 * horas de profundo quase não variam (ρ = 0,17); o denominador é que cresce. Um
 * ponto por "% de profundo" seria um ponto por **dormir pouco** — e de fato a
 * fração de profundo correlaciona −0,56 com a nota que o usuário dá ao acordar.
 * Soma-se a isso que o painel do NSF não chegou a consenso sobre arquitetura
 * (Ohayon 2017) e que os aparelhos erram de 30% a 50% do REM e do profundo
 * (Chinoy 2021). Três razões independentes, uma decisão.
 *
 * **Latência também não entra:** o Garmin não mede a hora de deitar (0 de 43
 * noites), e uma dimensão que só existe no passado quebraria a comparação.
 *
 * ## Por que a linha de base é móvel, e não uma constante de painel
 *
 * Este é o achado que governa o módulo. Em 18/07/2026 o usuário trocou o Apple
 * Watch pelo Garmin. O tempo acordado mediano por noite caiu de **71,5 para 13
 * minutos** e a eficiência subiu de **76% para 97%** — mesma pessoa, mesma cama,
 * mesmos hábitos. Os 20 minutos de WASO do consenso Ohayon dariam a ele um ano
 * inteiro de notas ruins e um agosto de notas ótimas, e a diferença seria o pulso.
 *
 * Por isso continuidade e horário são medidos contra a **distribuição recente dele
 * mesmo** ({@link sleepBaseline}, janela de {@link BASELINE_NIGHTS} noites). Uma
 * troca de aparelho é absorvida em cerca de um mês, sozinha, sem ninguém precisar
 * declarar a fonte. *(A coluna `source` de `sleep_periods` está nula em 288 de 288
 * linhas; quando ela existir, dá para estreitar a base por fonte e a convergência
 * fica imediata.)*
 *
 * Duração, regularidade e percepção **não** são relativas: sete horas são sete
 * horas em qualquer relógio, o índice de regularidade não depende de estagiamento,
 * e a nota é do dono.
 *
 * ## Regularidade só existe no período
 *
 * Não é escolha de produto, é a definição. O índice de regularidade compara o
 * estado em *t* com o estado em *t + 24 h*: é uma relação **entre** noites, como
 * inclinação é uma relação entre pontos. Uma noite sozinha não tem regularidade.
 * Por isso a noite conta quatro dimensões (0–8) e o período conta cinco (0–10) — e
 * é isso que dá sentido a existir uma tela de semana separada da de noite.
 *
 * ## O piso de cobertura
 *
 * Um mês com metade das noites gravadas não vira nota: viraria uma nota sobre as
 * noites que sobraram, que são justamente as que o relógio conseguiu registrar.
 * Abaixo de {@link SCORE_COVERAGE_FLOOR} o resultado sai com `scored: false` — as
 * dimensões continuam visíveis, a contagem não. No histórico real isto é o caso
 * **comum**: 14 dos 18 meses estão abaixo do piso.
 *
 * ## O que este módulo nunca vai fazer
 *
 * Sem streak, sem meta, sem seta de tendência, sem comparação com outras pessoas e
 * sem texto de conselho. São os guarda-corpos contra ortossonia, e a razão de a
 * contagem vir sempre acompanhada do fato cru que a gerou: se a medição discordar
 * do corpo, quem está certo é o corpo.
 *
 * Ver [ADR 0036](../../../../docs/decisions/0036-saude-do-sono-e-contagem-nao-placar.md).
 */

import type { SleepPeriod } from '../models';
import { awakeMinOf } from './derive';
import { midpointHour, SLEEP_AXIS_ORIGIN_H } from './timing';
import { median, quantile } from './buckets';
import { formatHm } from './facts';
import { sleepRegularityIndex } from './regularity';
import { formatarNumero } from '../format/numero';

// ─────────────────────────── limiares ───────────────────────────

/** Duas horas de sono para dois pontos — consenso AASM/SRS 2015. */
export const DURATION_FULL_H = 7;
/** Um ponto: abaixo disto a duração não sustenta nem meio ponto. */
export const DURATION_HALF_H = 6;

/** Desvio máximo do midpoint habitual, em minutos, para dois pontos. */
export const MIDPOINT_FULL_MIN = 30;
/** E para um ponto. */
export const MIDPOINT_HALF_MIN = 60;

/**
 * Índice de regularidade para dois pontos.
 *
 * 71,65 é a fronteira do quintil inferior do UK Biobank — abaixo dela está o grupo
 * com o maior risco medido (Windred 2024). Arredondado para 72 porque a fronteira
 * de um quintil de outra coorte não é um corte clínico e fingir precisão de duas
 * casas nela seria emprestar autoridade que o número não tem.
 */
export const SRI_FULL = 72;
/** Um ponto. */
export const SRI_HALF = 60;

/** Nota ao acordar para dois pontos. */
export const RATING_FULL = 4;
/** Um ponto — o meio da escala 1–5. */
export const RATING_HALF = 3;

/** Fração mínima de noites gravadas para o período receber contagem. */
export const SCORE_COVERAGE_FLOOR = 0.7;

/** Janela da linha de base móvel, em noites de acordar. */
export const BASELINE_NIGHTS = 30;
/** Menos que isto e a linha de base não é distribuição, é anedota. */
export const BASELINE_MIN_NIGHTS = 10;

/** Noites seguidas mínimas para o índice de regularidade significar algo. */
export const REGULARITY_MIN_NIGHTS = 5;

// ─────────────────────────── tipos ───────────────────────────

export type SleepDimensionKey =
  | 'duracao'
  | 'continuidade'
  | 'horario'
  | 'regularidade'
  | 'percepcao';

export const DIMENSION_LABEL: Record<SleepDimensionKey, string> = {
  duracao: 'Duração',
  continuidade: 'Continuidade',
  horario: 'Horário',
  regularidade: 'Regularidade',
  percepcao: 'Percepção',
};

export interface SleepDimension {
  key: SleepDimensionKey;
  label: string;
  /** 0, 1 ou 2. `null` quando não há como medir — e aí ela não entra no máximo. */
  points: number | null;
  /**
   * O dado cru que gerou os pontos, já formatado. Aparece **ao lado** da
   * contagem, sempre: é o que permite discordar do ponto sem discordar do app.
   */
  fact: string;
  /** Por que não deu para medir. Só quando `points` é `null`. */
  absent?: string;
}

export interface SleepCoverage {
  /** Noites com registro no período. */
  nights: number;
  /** Noites que o período comporta. */
  expected: number;
  ratio: number;
}

export interface SleepScore {
  dimensions: SleepDimension[];
  /** Soma dos pontos das dimensões medidas. */
  points: number;
  /** 2 × dimensões medidas — o denominador honesto, que encolhe quando falta dado. */
  max: number;
  /** `null` para uma noite: cobertura é propriedade de período. */
  coverage: SleepCoverage | null;
  /**
   * `false` quando a cobertura está abaixo do piso, ou quando nenhuma dimensão
   * pôde ser medida. As dimensões continuam na lista; só a contagem não vale.
   */
  scored: boolean;
}

// ─────────────────────────── linha de base ───────────────────────────

export interface SleepBaseline {
  /** Quantil 25 do tempo acordado, em minutos — o limiar de dois pontos. */
  wasoP25: number;
  /** Mediana do tempo acordado — o limiar de um ponto. */
  wasoMedian: number;
  /** Midpoint habitual, em horas no eixo de origem 18h. */
  midpoint: number;
  /** Noites que sustentam a base. */
  nights: number;
}

/** Uma noite por dia de acordar — a mais longa, quando o dia tem mais de uma. */
function oneNightPerDay(periods: readonly SleepPeriod[]): SleepPeriod[] {
  const by = new Map<string, SleepPeriod>();
  for (const p of periods) {
    const cur = by.get(p.wakeDay);
    if (!cur || p.asleepH > cur.asleepH) by.set(p.wakeDay, p);
  }
  return [...by.values()].sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
}

/** Midpoint no eixo de origem 18h — a coordenada em que a média faz sentido. */
function midpointAxis(p: SleepPeriod): number {
  return (midpointHour(p) - SLEEP_AXIS_ORIGIN_H + 24) % 24;
}

/**
 * A distribuição recente da pessoa, para os limiares relativos.
 *
 * `before` é o dia de acordar da noite que vai ser pontuada: a base olha só para
 * **trás**, senão a noite se compara consigo mesma e com o futuro. `null` quando
 * não há noites suficientes — e aí a dimensão de continuidade sai como não medida
 * em vez de cair num limiar inventado.
 */
export function sleepBaseline(
  periods: readonly SleepPeriod[],
  before: string,
  window = BASELINE_NIGHTS,
): SleepBaseline | null {
  const prior = oneNightPerDay(periods)
    .filter((p) => p.wakeDay < before)
    .slice(-window);
  if (prior.length < BASELINE_MIN_NIGHTS) return null;

  const waso = prior.map(awakeMinOf).filter((m): m is number => m !== null);
  if (waso.length < BASELINE_MIN_NIGHTS) return null;

  return {
    wasoP25: quantile(waso, 0.25),
    wasoMedian: median(waso),
    midpoint: median(prior.map(midpointAxis)),
    nights: prior.length,
  };
}

// ─────────────────────────── dimensões ───────────────────────────

/**
 * Escada de três degraus, com a direção **declarada** e não inferida da ordem
 * dos limiares.
 *
 * Inferir seria a armadilha: numa pessoa cuja vigília é quase sempre zero, o
 * quantil 25 e a mediana empatam, e um `full >= half` diria "maior é melhor" —
 * dando dois pontos justamente à noite mais fragmentada.
 */
function stepsUp(value: number, full: number, half: number): number {
  return value >= full ? 2 : value >= half ? 1 : 0;
}

/** Menor é melhor: vigília e desvio de horário. */
function stepsDown(value: number, full: number, half: number): number {
  return value <= full ? 2 : value <= half ? 1 : 0;
}

function durationDim(hours: number, label: string): SleepDimension {
  return {
    key: 'duracao',
    label: DIMENSION_LABEL.duracao,
    points: stepsUp(hours, DURATION_FULL_H, DURATION_HALF_H),
    fact: label,
  };
}

function continuityDim(
  awakeMin: number | null,
  base: SleepBaseline | null,
  fact: string,
): SleepDimension {
  const d: SleepDimension = { key: 'continuidade', label: DIMENSION_LABEL.continuidade, points: null, fact };
  if (awakeMin === null) {
    d.absent = 'seu relógio não reporta despertares nestas noites';
    return d;
  }
  if (!base) {
    d.absent = `precisa de ${BASELINE_MIN_NIGHTS} noites anteriores para saber o que é pouco para você`;
    return d;
  }
  d.points = stepsDown(awakeMin, base.wasoP25, base.wasoMedian);
  return d;
}

function timingDim(midpoint: number, base: SleepBaseline | null, fact: string): SleepDimension {
  const d: SleepDimension = { key: 'horario', label: DIMENSION_LABEL.horario, points: null, fact };
  if (!base) {
    d.absent = `precisa de ${BASELINE_MIN_NIGHTS} noites anteriores para saber qual é o seu horário`;
    return d;
  }
  // O eixo é circular: 23h50 e 00h10 distam 20 min, não 23h40.
  const raw = Math.abs(midpoint - base.midpoint);
  const devMin = Math.min(raw, 24 - raw) * 60;
  d.points = stepsDown(devMin, MIDPOINT_FULL_MIN, MIDPOINT_HALF_MIN);
  return d;
}

function ratingDim(rating: number | null, fact: string): SleepDimension {
  const d: SleepDimension = { key: 'percepcao', label: DIMENSION_LABEL.percepcao, points: null, fact };
  if (rating === null) {
    d.absent = 'você não deu nota';
    return d;
  }
  d.points = stepsUp(rating, RATING_FULL, RATING_HALF);
  return d;
}

function tally(dimensions: SleepDimension[], coverage: SleepCoverage | null): SleepScore {
  const measured = dimensions.filter((d) => d.points !== null);
  const points = measured.reduce((s, d) => s + (d.points ?? 0), 0);
  const covered = coverage === null || coverage.ratio >= SCORE_COVERAGE_FLOOR;
  return {
    dimensions,
    points,
    max: measured.length * 2,
    coverage,
    scored: measured.length > 0 && covered,
  };
}

// ─────────────────────────── a noite ───────────────────────────

/**
 * As quatro dimensões de uma noite. Sem regularidade — ela não existe aqui.
 *
 * `history` são as noites anteriores de onde sai a linha de base; passar o
 * histórico inteiro é o uso normal, o corte é feito aqui dentro.
 */
export function nightScore(
  period: SleepPeriod,
  history: readonly SleepPeriod[],
  rating: number | null = null,
): SleepScore {
  const base = sleepBaseline(history, period.wakeDay);
  const awake = awakeMinOf(period);
  const n = period.awakenings?.length ?? 0;

  return tally(
    [
      durationDim(period.asleepH, formatHm(period.asleepH)),
      continuityDim(
        awake,
        base,
        awake === null
          ? '—'
          : `${Math.round(awake)} min · ${n} ${n === 1 ? 'despertar' : 'despertares'}`,
      ),
      timingDim(midpointAxis(period), base, clockOfMidpoint(period)),
      ratingDim(rating, rating === null ? '—' : `${rating}/5`),
    ],
    null,
  );
}

/** "meio 05:02" — o midpoint como hora de relógio. */
function clockOfMidpoint(p: SleepPeriod): string {
  const h = midpointHour(p);
  const hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  let out = hh;
  if (mm === 60) {
    mm = 0;
    out = (hh + 1) % 24;
  }
  return `meio ${String(out).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─────────────────────────── o período ───────────────────────────

/**
 * O trecho mais longo de noites em dias consecutivos.
 *
 * O índice de regularidade percorre a série minuto a minuto do primeiro onset ao
 * último wake e compara *t* com *t + 24 h*. Um buraco no meio vira "acordado" nos
 * dois lados da comparação, o que **conta como mesmo estado** e infla o índice —
 * exatamente nas semanas em que faltou dado. Rodar só no trecho contíguo evita
 * inventar regularidade a partir de ausência.
 */
export function longestRun(periods: readonly SleepPeriod[]): SleepPeriod[] {
  const nights = oneNightPerDay(periods);
  if (nights.length === 0) return [];

  let best: SleepPeriod[] = [];
  let run: SleepPeriod[] = [nights[0]];
  for (let i = 1; i < nights.length; i += 1) {
    const prev = new Date(`${nights[i - 1].wakeDay}T12:00:00`);
    const cur = new Date(`${nights[i].wakeDay}T12:00:00`);
    const days = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (days === 1) run.push(nights[i]);
    else {
      if (run.length > best.length) best = run;
      run = [nights[i]];
    }
  }
  return run.length > best.length ? run : best;
}

function regularityDim(periods: readonly SleepPeriod[]): SleepDimension {
  const d: SleepDimension = {
    key: 'regularidade',
    label: DIMENSION_LABEL.regularidade,
    points: null,
    fact: '—',
  };
  const run = longestRun(periods);
  if (run.length < REGULARITY_MIN_NIGHTS) {
    d.absent = `precisa de ${REGULARITY_MIN_NIGHTS} noites seguidas`;
    return d;
  }
  const sri = sleepRegularityIndex(run);
  if (sri === null) {
    d.absent = `precisa de ${REGULARITY_MIN_NIGHTS} noites seguidas`;
    return d;
  }
  d.points = stepsUp(sri, SRI_FULL, SRI_HALF);
  d.fact = `SRI ${Math.round(sri)} · ${run.length} seguidas`;
  return d;
}

/**
 * As cinco dimensões de um período — semana, mês, estação, ano.
 *
 * `expectedNights` são as noites que o período comporta (7 numa semana, 31 num
 * mês de janeiro): é o denominador da cobertura, e é o que separa "dormi mal" de
 * "não medi". Quem chama sabe o tamanho do período; este módulo não adivinha
 * calendário.
 *
 * `ratings` mapeia dia de acordar para a nota 1–5.
 */
export function periodScore(
  periods: readonly SleepPeriod[],
  expectedNights: number,
  ratings: Readonly<Record<string, number>> = {},
  history: readonly SleepPeriod[] = periods,
): SleepScore {
  const nights = oneNightPerDay(periods);
  const coverage: SleepCoverage = {
    nights: nights.length,
    expected: Math.max(expectedNights, nights.length),
    ratio: expectedNights > 0 ? Math.min(1, nights.length / expectedNights) : 0,
  };

  if (nights.length === 0) {
    return {
      dimensions: (Object.keys(DIMENSION_LABEL) as SleepDimensionKey[]).map((key) => ({
        key,
        label: DIMENSION_LABEL[key],
        points: null,
        fact: '—',
        absent: 'sem noites no período',
      })),
      points: 0,
      max: 0,
      coverage,
      scored: false,
    };
  }

  // A base olha para antes do período — senão o período se compara consigo mesmo
  // e a continuidade vira, por construção, sempre mediana.
  const base = sleepBaseline(history, nights[0].wakeDay);

  const durH = median(nights.map((p) => p.asleepH));
  const over = nights.filter((p) => p.asleepH >= DURATION_FULL_H).length;

  const awakes = nights.map(awakeMinOf).filter((m): m is number => m !== null);
  const awakeMed = awakes.length > 0 ? median(awakes) : null;

  const mids = nights.map(midpointAxis);
  const midMed = median(mids);
  // Dispersão como desvio absoluto mediano — resistente a uma noite fora da curva,
  // que numa amostra de 7 o desvio-padrão levaria a sério demais.
  const spreadMin =
    median(
      mids.map((m) => {
        const raw = Math.abs(m - midMed);
        return Math.min(raw, 24 - raw);
      }),
    ) * 60;

  const notes = nights.map((p) => ratings[p.wakeDay]).filter((r): r is number => r != null);
  const noteAvg = notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : null;

  return tally(
    [
      durationDim(durH, `${formatHm(durH)} · ${Math.round((over / nights.length) * 100)}% ≥ 7h`),
      continuityDim(awakeMed, base, awakeMed === null ? '—' : `${Math.round(awakeMed)} min`),
      // O horário do período é dispersão, não posição: uma semana toda deslocada
      // 40 min do habitual, mas coerente consigo, não é desordem de horário.
      spreadDim(spreadMin),
      regularityDim(periods),
      // A média sai em pt-BR, com vírgula, por `formatarNumero` (story 5.3): é o
      // texto que a leitura da Saúde interpola na frase. É a única casa decimal
      // da contagem — os outros fatos são inteiros.
      ratingDim(
        noteAvg === null ? null : Math.round(noteAvg * 10) / 10,
        noteAvg === null
          ? '—'
          : `${formatarNumero(noteAvg, 1)}/5 · ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}`,
      ),
    ],
    coverage,
  );
}

function spreadDim(spreadMin: number): SleepDimension {
  return {
    key: 'horario',
    label: DIMENSION_LABEL.horario,
    points: stepsDown(spreadMin, MIDPOINT_FULL_MIN, MIDPOINT_HALF_MIN),
    fact: `± ${Math.round(spreadMin)} min`,
  };
}

/**
 * O texto de uma linha só sobre a cobertura — para a tela dizer por que não há
 * contagem sem inventar frase própria.
 */
export function coverageNote(score: SleepScore): string | null {
  const c = score.coverage;
  if (!c) return null;
  if (c.ratio >= SCORE_COVERAGE_FLOOR) return `${c.nights} de ${c.expected} noites`;
  return `${c.nights} de ${c.expected} noites — abaixo do piso de ${Math.round(
    SCORE_COVERAGE_FLOOR * 100,
  )}%, as medidas aparecem e a contagem não`;
}
