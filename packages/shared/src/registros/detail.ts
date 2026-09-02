/**
 * Derivações puras do detalhe de um Registro (SPEC-registros CAP-5/6).
 *
 * Tudo aqui opera sobre a lista de datas locais 'YYYY-MM-DD' de
 * `registro_logs` (o que `fetchRegistroLogDates` devolve) — nada é persistido
 * e nenhum app refaz conta. O eixo de período é o mesmo `Period` do histórico
 * de treinos, com as divergências de dado esparso documentadas em
 * docs/specs/registros/metricas-do-detalhe.md:
 *
 * - **delta é contagem absoluta** (+1/−2), nunca percentual — `totalsDelta`
 *   não serve aqui;
 * - **barras e totais são sempre inteiros** (contagens 0–3 são o caso comum);
 * - o default de período (`meses12`) e a persistência da escolha são assunto
 *   da tela, não deste módulo.
 *
 * Semana começa na **segunda** (convenção do retro/HeatmapGrid), não no
 * domingo do calendário de `marcar`.
 */
import type { Period } from '../fitness/overview';
import { mondayOf } from '../week/recap';
import { localDateStr } from '../date/local';

const DAY_MS = 86_400_000;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 'YYYY-MM-DD' → meia-noite **local**. `new Date('YYYY-MM-DD')` interpretaria
 * UTC e deslocaria o dia em qualquer fuso a oeste de Greenwich.
 */
function parseLocal(s: string): Date {
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
}

/** Dias entre duas meia-noites locais. `round` absorve a hora de verão. */
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Barra do gráfico do detalhe. Estruturalmente compatível com o `Bucket` que o
 * `BarChart` do mobile consome (`label`/`date`/`value`/`count`/`empty`) — a
 * `key` extra é a chave estável do bucket ('2026-08-14', '2026-08', '2026').
 */
export interface RegistroBucket {
  key: string;
  label: string;
  /** ms — início local do bucket. */
  date: number;
  /** Contagem de marcas no bucket — sempre inteiro. */
  value: number;
  count: number;
  empty: boolean;
}

/** Frequência média na janela: marcas por semana (7d/4s) ou por mês (demais). */
export interface RegistroFreq {
  value: number;
  per: 'semana' | 'mes';
}

export interface RegistroDetail {
  buckets: RegistroBucket[];
  /** Marcas dentro da janela do período. */
  total: number;
  /**
   * Contagem absoluta vs o período anterior. Nos períodos móveis (7d/4s/12m) a
   * janela anterior tem o mesmo tamanho; no 'ano' corrente a comparação é
   * **deliberadamente assimétrica** — jan–hoje contra o ano anterior inteiro,
   * herdada do molde do histórico (`previousWindow` em fitness/overview.ts):
   * a pergunta ali é "já superei o ano passado?", não "estou no ritmo dele?".
   * `null` = não há período anterior comparável ('sempre', ou o 1º ano no
   * período 'ano') — a UI não renderiza comparação nesse caso. Janela anterior
   * vazia é `delta = total`, que é informação, não ausência dela.
   */
  delta: number | null;
  /** Última marca de todo o histórico — independe do período selecionado. */
  lastDate: string | null;
  /**
   * Dias desde a última marca (0 = hoje); `null` sem nenhuma marca. Nunca
   * negativo: uma marca "de amanhã" existe de verdade (marcou hoje no Japão,
   * abriu o app na Bélgica) e leria "-1 dias".
   */
  daysSinceLast: number | null;
  freq: RegistroFreq;
  /** Média dos dias entre marcas consecutivas na janela; `null` com <2 marcas. */
  avgGapDays: number | null;
  /** Maior distância entre marcas consecutivas na janela; `null` com <2 marcas. */
  maxGapDays: number | null;
  /** Contagem por dia da semana na janela — **segunda-first** (índice 0 = seg). */
  weekdayCounts: number[];
  /**
   * Contagem por mês civil na janela (índice 0 = jan). `null` em 7d/4s: uma
   * janela menor que 12 meses não tem sazonalidade a mostrar.
   */
  monthCounts: number[] | null;
  /** Primeira marca de todo o histórico — fixa, como o total histórico. */
  firstDate: string | null;
  allTimeTotal: number;
  /** Navegação de ano: há ano anterior com histórico para visitar? */
  canPrevYear: boolean;
  /** `true` enquanto o ano mostrado está atrás do corrente. */
  canNextYear: boolean;
}

interface Plan {
  buckets: { key: string; label: string; date: number }[];
  keyOf: (dateStr: string) => string;
  /** Chaves da janela imediatamente anterior; `null` = sem delta. */
  prevKeys: ReadonlySet<string> | null;
}

function monthKey(y: number, m0: number): string {
  return `${y}-${pad2(m0 + 1)}`;
}

function planFor(
  period: Period,
  today: Date,
  shownYear: number,
  firstYear: number | undefined,
): Plan {
  if (period === 'semana') {
    const dayAt = (back: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayAt(i);
      buckets.push({ key: localDateStr(d), label: WEEKDAYS[d.getDay()], date: d.getTime() });
    }
    const prevKeys = new Set<string>();
    for (let i = 13; i >= 7; i--) prevKeys.add(localDateStr(dayAt(i)));
    return { buckets, keyOf: (s) => s, prevKeys };
  }

  if (period === 'mes') {
    // 4 semanas seg–dom (a corrente + 3), alinhadas como no histórico. O rótulo
    // é a segunda-feira que abre a semana.
    const thisMonday = mondayOf(today);
    const weekAt = (back: number) =>
      new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - back * 7);
    const buckets = [];
    for (let i = 3; i >= 0; i--) {
      const m = weekAt(i);
      buckets.push({
        key: localDateStr(m),
        label: `${pad2(m.getDate())}/${pad2(m.getMonth() + 1)}`,
        date: m.getTime(),
      });
    }
    const prevKeys = new Set<string>();
    for (let i = 7; i >= 4; i--) prevKeys.add(localDateStr(weekAt(i)));
    return { buckets, keyOf: (s) => localDateStr(mondayOf(parseLocal(s))), prevKeys };
  }

  if (period === 'meses12') {
    const monthAt = (back: number) =>
      new Date(today.getFullYear(), today.getMonth() - back, 1);
    const buckets = [];
    for (let i = 11; i >= 0; i--) {
      const d = monthAt(i);
      buckets.push({
        key: monthKey(d.getFullYear(), d.getMonth()),
        label: MONTHS[d.getMonth()],
        date: d.getTime(),
      });
    }
    const prevKeys = new Set<string>();
    for (let i = 23; i >= 12; i--) {
      const d = monthAt(i);
      prevKeys.add(monthKey(d.getFullYear(), d.getMonth()));
    }
    return { buckets, keyOf: (s) => s.slice(0, 7), prevKeys };
  }

  if (period === 'ano') {
    // No ano corrente só os meses decorridos: barra futura zerada leria como
    // "não aconteceu" num mês que ainda nem chegou.
    const isCurrent = shownYear === today.getFullYear();
    const lastMonth = isCurrent ? today.getMonth() : 11;
    const buckets = [];
    for (let m = 0; m <= lastMonth; m++) {
      buckets.push({
        key: monthKey(shownYear, m),
        label: MONTHS[m],
        date: new Date(shownYear, m, 1).getTime(),
      });
    }
    // "1º ano" da matriz: sem um ano anterior com histórico possível, não há
    // contra o que comparar — delta `null`, não zero.
    const prevKeys =
      firstYear !== undefined && shownYear > firstYear
        ? new Set(Array.from({ length: 12 }, (_, m) => monthKey(shownYear - 1, m)))
        : null;
    return { buckets, keyOf: (s) => s.slice(0, 7), prevKeys };
  }

  // sempre — um bucket por ano, do primeiro com marca até o corrente (anos
  // vazios no meio e no fim aparecem: dois anos sem pizza são dado, não buraco).
  const nowYear = today.getFullYear();
  const from = firstYear !== undefined ? Math.min(firstYear, nowYear) : nowYear;
  const buckets = [];
  for (let y = from; y <= nowYear; y++) {
    buckets.push({ key: `${y}`, label: `${y}`, date: new Date(y, 0, 1).getTime() });
  }
  return { buckets, keyOf: (s) => s.slice(0, 4), prevKeys: null };
}

function freqOf(
  period: Period,
  total: number,
  today: Date,
  shownYear: number,
  firstDate: string | null,
): RegistroFreq {
  switch (period) {
    case 'semana':
      // Janela móvel que termina hoje: os 7 dias já decorreram por definição.
      return { value: total, per: 'semana' };
    case 'mes': {
      // A 4ª semana está em curso: dividir por 4 cheias subestimaria a
      // frequência. O denominador é o que decorreu de verdade — dias desde a
      // abertura da janela (a segunda de 3 semanas atrás) ÷ 7.
      const thisMonday = mondayOf(today);
      const start = new Date(
        thisMonday.getFullYear(),
        thisMonday.getMonth(),
        thisMonday.getDate() - 21,
      );
      const weeks = (diffDays(start, today) + 1) / 7;
      return { value: total / weeks, per: 'semana' };
    }
    case 'meses12': {
      // Mesma razão: 11 meses fechados + a fração decorrida do corrente.
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const months = 11 + today.getDate() / daysInMonth;
      return { value: total / months, per: 'mes' };
    }
    case 'ano': {
      const months = shownYear === today.getFullYear() ? today.getMonth() + 1 : 12;
      return { value: total / months, per: 'mes' };
    }
    case 'sempre': {
      if (!firstDate) return { value: 0, per: 'mes' };
      const f = parseLocal(firstDate);
      const months =
        (today.getFullYear() - f.getFullYear()) * 12 + (today.getMonth() - f.getMonth()) + 1;
      return { value: total / Math.max(1, months), per: 'mes' };
    }
  }
}

/**
 * Todas as métricas do detalhe de um registro, num período.
 *
 * `dates` é o histórico completo ('YYYY-MM-DD'), em qualquer ordem — a função
 * ordena e deduplica. `yearOffset` (0 = ano corrente, negativo = anteriores)
 * governa o período 'ano' e a navegação `canPrevYear`/`canNextYear`; os demais
 * períodos o ignoram nas barras. Offset positivo é grampeado em 0 — não existe
 * navegar para um ano futuro zerado.
 */
export function buildRegistroDetail(
  dates: string[],
  period: Period,
  opts: { now?: Date; yearOffset?: number } = {},
): RegistroDetail {
  const now = opts.now ?? new Date();
  const yearOffset = Math.min(0, opts.yearOffset ?? 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sorted = [...new Set(dates)].sort();

  const firstDate = sorted.length ? sorted[0] : null;
  const lastDate = sorted.length ? sorted[sorted.length - 1] : null;
  const firstYear = firstDate ? Number(firstDate.slice(0, 4)) : undefined;
  const shownYear = today.getFullYear() + yearOffset;

  const plan = planFor(period, today, shownYear, firstYear);
  const keySet = new Set(plan.buckets.map((b) => b.key));

  const counts = new Map<string, number>();
  let prevTotal = 0;
  const windowDates: string[] = [];
  for (const s of sorted) {
    const k = plan.keyOf(s);
    if (keySet.has(k)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
      windowDates.push(s); // `sorted` filtrado preserva a ordem cronológica
    } else if (plan.prevKeys?.has(k)) {
      prevTotal += 1;
    }
  }

  const buckets: RegistroBucket[] = plan.buckets.map((b) => {
    const c = counts.get(b.key) ?? 0;
    return { key: b.key, label: b.label, date: b.date, value: c, count: c, empty: c === 0 };
  });

  const total = windowDates.length;
  const delta = plan.prevKeys ? total - prevTotal : null;

  let avgGapDays: number | null = null;
  let maxGapDays: number | null = null;
  if (windowDates.length >= 2) {
    let sum = 0;
    let max = 0;
    for (let i = 1; i < windowDates.length; i++) {
      const g = diffDays(parseLocal(windowDates[i - 1]), parseLocal(windowDates[i]));
      sum += g;
      if (g > max) max = g;
    }
    avgGapDays = sum / (windowDates.length - 1);
    maxGapDays = max;
  }

  const weekdayCounts = new Array<number>(7).fill(0);
  for (const s of windowDates) {
    // getDay(): 0 = domingo. A grade do detalhe é segunda-first, então domingo
    // vai para o fim (índice 6).
    weekdayCounts[(parseLocal(s).getDay() + 6) % 7] += 1;
  }

  let monthCounts: number[] | null = null;
  if (period === 'meses12' || period === 'ano' || period === 'sempre') {
    monthCounts = new Array<number>(12).fill(0);
    for (const s of windowDates) monthCounts[Number(s.slice(5, 7)) - 1] += 1;
  }

  return {
    buckets,
    total,
    delta,
    lastDate,
    daysSinceLast: lastDate ? Math.max(0, diffDays(parseLocal(lastDate), today)) : null,
    freq: freqOf(period, total, today, shownYear, firstDate),
    avgGapDays,
    maxGapDays,
    weekdayCounts,
    monthCounts,
    firstDate,
    allTimeTotal: sorted.length,
    canPrevYear: firstYear !== undefined && shownYear > firstYear,
    canNextYear: yearOffset < 0,
  };
}

/** Célula do heatmap anual — binário: marcado ou não (CAP-7 é só-leitura no mobile). */
export interface RegistroHeatCell {
  date: string;
  marked: boolean;
  /** Falso nas pontas que completam a 1ª e a última semana — a UI não as pinta. */
  inYear: boolean;
}

/**
 * Grade do ano civil, estilo GitHub: uma coluna por semana **segunda-first**,
 * da semana que contém 1º/jan à que contém 31/dez (53–54 colunas). Cada semana
 * vem completa; os dias de dezembro/janeiro vizinhos entram com `inYear: false`.
 */
export function yearHeatmap(dates: string[], year: number): RegistroHeatCell[][] {
  const marked = new Set(dates);
  const start = mondayOf(new Date(year, 0, 1));
  const lastMonday = mondayOf(new Date(year, 11, 31)).getTime();
  const weeks: RegistroHeatCell[][] = [];
  for (
    let w = start;
    w.getTime() <= lastMonday;
    w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)
  ) {
    const week: RegistroHeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(w.getFullYear(), w.getMonth(), w.getDate() + i);
      const s = localDateStr(d);
      week.push({ date: s, marked: marked.has(s), inYear: d.getFullYear() === year });
    }
    weeks.push(week);
  }
  return weeks;
}
