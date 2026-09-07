/**
 * Derivações puras do detalhe de um Hábito contador.
 *
 * É o irmão quantitativo de `registros/detail.ts`, e o eixo de tempo é
 * literalmente o mesmo (`period/bucket-plan.ts`). A diferença cabe numa frase:
 * **um registro conta marcas, um hábito soma valores.** Dela saem as três
 * divergências deste módulo:
 *
 * - o **delta é na unidade** (`+11,0 L`), não em contagem de dias — a pergunta
 *   do hábito é "bebi mais?", não "bebi em mais dias?"; a contagem continua
 *   existindo, em `daysDelta`, porque as duas leituras discordam com frequência
 *   (menos dias e mais litros é um mês inteiro contado numa frase);
 * - a média é **por dia com registro**, não por dia do período: um hábito
 *   esparso diluído em 30 dias vira 0,5 L/dia, número que não descreve nenhum
 *   dia real que aconteceu;
 * - existe **`best`**, o maior dia da janela, que em contagem de marcas seria
 *   sempre 1 e por isso não existe em Registros.
 *
 * Dia com valor **zero** não é dia com registro. A RPC `habit_log_add` deixa
 * linha com `value = 0` quando o usuário incrementa e desfaz, e contá-la
 * inflaria "dias" com dias em que nada aconteceu.
 *
 * Preço e caloria não entram aqui: são estimativas sobre o total, moram em
 * `habits/cost.ts` e `habits/calories.ts`, e a tela as compõe.
 */
import type { Period } from '../fitness/overview';
import {
  diffDays,
  gridMonthStarts,
  parseLocal,
  planFor,
  yearGrid,
} from '../period/bucket-plan';
import type { HeatmapMonthStart } from '../period/bucket-plan';

export type { HeatmapMonthStart } from '../period/bucket-plan';

/** O que a tela precisa de um log — `HabitLog` serve, e qualquer par também. */
export interface HabitLogPoint {
  logDate: string;
  value: number;
}

/**
 * Barra do gráfico. Compatível com o `Bucket` do `BarChart` do mobile
 * (`label`/`date`/`value`/`count`/`empty`); `count` aqui são os **dias com
 * registro** dentro do balde, que é o que a barra de um mês esconde.
 */
export interface HabitBucket {
  key: string;
  label: string;
  /** ms — início local do balde. */
  date: number;
  /** Soma dos valores no balde, na unidade do hábito. */
  value: number;
  /** Dias com registro no balde. */
  count: number;
  empty: boolean;
}

/** O maior dia da janela — a leitura que só um hábito quantitativo tem. */
export interface HabitBestDay {
  date: string;
  value: number;
}

export interface HabitDetail {
  buckets: HabitBucket[];
  /** Soma dos valores na janela. */
  total: number;
  /**
   * Diferença **na unidade** vs a janela anterior; `null` quando não há janela
   * comparável ('sempre', ou o 1º ano no período 'ano'). Janela anterior vazia
   * dá `delta = total`, que é informação, não ausência dela — a mesma regra do
   * detalhe de Registros.
   */
  delta: number | null;
  /** Dias com registro (valor > 0) na janela. */
  days: number;
  /** Mesma comparação, em dias. `null` nos mesmos casos de `delta`. */
  daysDelta: number | null;
  /** Média do dia em que houve registro; 0 quando não houve nenhum. */
  perLoggedDay: number;
  best: HabitBestDay | null;
  /** Soma por dia da semana na janela — **segunda-first** (índice 0 = seg). */
  weekdayTotals: number[];
  /**
   * Soma por mês civil na janela (índice 0 = jan). `null` em 7d/4s: uma janela
   * menor que 12 meses não tem sazonalidade a mostrar.
   */
  monthTotals: number[] | null;
  /** Último dia com registro de todo o histórico — independe do período. */
  lastDate: string | null;
  /** Dias desde o último registro (0 = hoje); `null` sem nenhum. */
  daysSinceLast: number | null;
  /** Primeiro dia com registro de todo o histórico. */
  firstDate: string | null;
  /** Soma de todo o histórico — fixa, independe do período. */
  allTimeTotal: number;
  /** Navegação de ano: há ano anterior com histórico para visitar? */
  canPrevYear: boolean;
  /** `true` enquanto o ano mostrado está atrás do corrente. */
  canNextYear: boolean;
}

/**
 * Soma por dia, ignorando linhas zeradas. `habit_logs` tem unique(habit,dia),
 * mas somar em vez de sobrescrever mantém a função correta se um chamador
 * passar a mesma data duas vezes.
 */
function byDate(logs: readonly HabitLogPoint[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) {
    if (!(l.value > 0)) continue;
    m.set(l.logDate, (m.get(l.logDate) ?? 0) + l.value);
  }
  return m;
}

/**
 * Todas as métricas do detalhe de um hábito, num período.
 *
 * `logs` é o histórico completo do hábito, em qualquer ordem. `yearOffset`
 * (0 = ano corrente, negativo = anteriores) governa o período 'ano' e a
 * navegação; offset positivo é grampeado em 0 — não existe navegar para um ano
 * futuro zerado.
 */
export function buildHabitDetail(
  logs: readonly HabitLogPoint[],
  period: Period,
  opts: { now?: Date; yearOffset?: number } = {},
): HabitDetail {
  const now = opts.now ?? new Date();
  const yearOffset = Math.min(0, opts.yearOffset ?? 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const values = byDate(logs);
  const dates = [...values.keys()].sort();

  const firstDate = dates.length ? dates[0] : null;
  const lastDate = dates.length ? dates[dates.length - 1] : null;
  const firstYear = firstDate ? Number(firstDate.slice(0, 4)) : undefined;
  const shownYear = today.getFullYear() + yearOffset;

  const plan = planFor(period, today, shownYear, firstYear);
  const keySet = new Set(plan.buckets.map((b) => b.key));

  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  let prevTotal = 0;
  let prevDays = 0;
  const windowDates: string[] = [];

  for (const date of dates) {
    const v = values.get(date) ?? 0;
    const k = plan.keyOf(date);
    if (keySet.has(k)) {
      sums.set(k, (sums.get(k) ?? 0) + v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      windowDates.push(date); // `dates` filtrado preserva a ordem cronológica
    } else if (plan.prevKeys?.has(k)) {
      prevTotal += v;
      prevDays += 1;
    }
  }

  const buckets: HabitBucket[] = plan.buckets.map((b) => {
    const v = sums.get(b.key) ?? 0;
    const c = counts.get(b.key) ?? 0;
    return { key: b.key, label: b.label, date: b.date, value: v, count: c, empty: c === 0 };
  });

  let total = 0;
  let best: HabitBestDay | null = null;
  for (const date of windowDates) {
    const v = values.get(date) ?? 0;
    total += v;
    // `>` e não `>=`: empate fica com o dia mais antigo, que é o que o gráfico
    // mostra primeiro. Trocar isso faria a leitura pular sem motivo visível.
    if (!best || v > best.value) best = { date, value: v };
  }
  const days = windowDates.length;

  const weekdayTotals = new Array<number>(7).fill(0);
  for (const date of windowDates) {
    // getDay(): 0 = domingo. A grade é segunda-first, então domingo vai para o
    // fim (índice 6).
    weekdayTotals[(parseLocal(date).getDay() + 6) % 7] += values.get(date) ?? 0;
  }

  let monthTotals: number[] | null = null;
  if (period === 'meses12' || period === 'ano' || period === 'sempre') {
    monthTotals = new Array<number>(12).fill(0);
    for (const date of windowDates) {
      monthTotals[Number(date.slice(5, 7)) - 1] += values.get(date) ?? 0;
    }
  }

  let allTimeTotal = 0;
  for (const v of values.values()) allTimeTotal += v;

  return {
    buckets,
    total,
    delta: plan.prevKeys ? total - prevTotal : null,
    days,
    daysDelta: plan.prevKeys ? days - prevDays : null,
    perLoggedDay: days > 0 ? total / days : 0,
    best,
    weekdayTotals,
    monthTotals,
    lastDate,
    // Nunca negativo: um registro "de amanhã" existe de verdade (marcou no
    // Japão, abriu o app na Bélgica) e leria "−1 dias".
    daysSinceLast: lastDate ? Math.max(0, diffDays(parseLocal(lastDate), today)) : null,
    firstDate,
    allTimeTotal,
    canPrevYear: firstYear !== undefined && shownYear > firstYear,
    canNextYear: yearOffset < 0,
  };
}

/** Célula do heatmap anual de hábito: a quantidade do dia, não um booleano. */
export interface HabitHeatCell {
  date: string;
  /** Soma do dia; 0 = sem registro. */
  value: number;
  /** Falso nas pontas que completam a 1ª e a última semana — a UI não as pinta. */
  inYear: boolean;
}

/**
 * A grade do ano com o valor de cada dia (ver `yearGrid`). A intensidade é da
 * tela: ela conhece o tema, e cor não se resolve aqui.
 */
export function habitYearHeat(logs: readonly HabitLogPoint[], year: number): HabitHeatCell[][] {
  const values = byDate(logs);
  return yearGrid(year).map((week) =>
    week.map((c) => ({ date: c.date, value: values.get(c.date) ?? 0, inYear: c.inYear })),
  );
}

/** As colunas onde os meses começam — a tela rotula sem conhecer o bucket-plan. */
export function habitHeatMonthStarts(weeks: HabitHeatCell[][]): HeatmapMonthStart[] {
  return gridMonthStarts(weeks);
}

/**
 * Maior valor diário da grade — o topo da escala de intensidade.
 *
 * Vem da própria grade, não do histórico inteiro: um ano fraco depois de um ano
 * pesado ficaria todo pálido se a escala fosse global, e a leitura "quando foi
 * mais forte **neste** ano" é a que a grade existe para dar.
 */
export function habitHeatMax(weeks: readonly (readonly HabitHeatCell[])[]): number {
  let max = 0;
  for (const week of weeks) for (const c of week) if (c.inYear && c.value > max) max = c.value;
  return max;
}
