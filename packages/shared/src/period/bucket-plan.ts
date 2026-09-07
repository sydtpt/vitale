/**
 * O eixo de tempo dos detalhes: como um `Period` vira barras.
 *
 * Nasceu dentro do detalhe de Registros e saiu de lá quando o detalhe de
 * Hábitos passou a precisar do mesmo eixo. As duas telas têm de concordar sobre
 * o que é "4s" e sobre qual é a janela anterior comparável — se cada uma
 * montasse o seu plano, a mesma palavra na mesma barra de período passaria a
 * significar coisas diferentes em telas vizinhas.
 *
 * O que muda entre elas é só o que se faz com os dias que caem em cada balde:
 * Registros **conta** marcas, Hábitos **soma** valores. O plano é o mesmo.
 *
 * Semana começa na **segunda** (convenção do retro/HeatmapGrid), não no
 * domingo do calendário de `marcar`.
 */
import type { Period } from '../fitness/overview';
import { mondayOf } from '../week/recap';
import { localDateStr } from '../date/local';
import { DIAS_ABREV, MESES_ABREV } from '../date/ptbr';

const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * 'YYYY-MM-DD' → meia-noite **local**. `new Date('YYYY-MM-DD')` interpretaria
 * UTC e deslocaria o dia em qualquer fuso a oeste de Greenwich.
 */
export function parseLocal(s: string): Date {
  return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
}

/** Dias entre duas meia-noites locais. `round` absorve a hora de verão. */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function monthKey(y: number, m0: number): string {
  return `${y}-${pad2(m0 + 1)}`;
}

export interface BucketPlan {
  buckets: { key: string; label: string; date: number }[];
  keyOf: (dateStr: string) => string;
  /** Chaves da janela imediatamente anterior; `null` = sem delta. */
  prevKeys: ReadonlySet<string> | null;
}

/**
 * Os baldes de um período e a janela anterior contra a qual ele se compara.
 *
 * `firstYear` é o ano do primeiro dado do histórico — governa o "1º ano" (sem
 * comparação possível) e a extensão do período 'sempre'.
 */
export function planFor(
  period: Period,
  today: Date,
  shownYear: number,
  firstYear: number | undefined,
): BucketPlan {
  if (period === 'semana') {
    const dayAt = (back: number) =>
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const d = dayAt(i);
      buckets.push({ key: localDateStr(d), label: DIAS_ABREV[d.getDay()], date: d.getTime() });
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
        label: MESES_ABREV[d.getMonth()],
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
        label: MESES_ABREV[m],
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

  // sempre — um bucket por ano, do primeiro com dado até o corrente (anos
  // vazios no meio e no fim aparecem: dois anos sem pizza são dado, não buraco).
  const nowYear = today.getFullYear();
  const from = firstYear !== undefined ? Math.min(firstYear, nowYear) : nowYear;
  const buckets = [];
  for (let y = from; y <= nowYear; y++) {
    buckets.push({ key: `${y}`, label: `${y}`, date: new Date(y, 0, 1).getTime() });
  }
  return { buckets, keyOf: (s) => s.slice(0, 4), prevKeys: null };
}

/** Um dia da grade anual — a casa, antes de qualquer valor entrar nela. */
export interface YearGridCell {
  date: string;
  /** Falso nas pontas que completam a 1ª e a última semana — a UI não as pinta. */
  inYear: boolean;
}

/**
 * Grade do ano civil, estilo GitHub: uma coluna por semana **segunda-first**,
 * da semana que contém 1º/jan à que contém 31/dez (53–54 colunas). Cada semana
 * vem completa; os dias de dezembro/janeiro vizinhos entram com `inYear: false`.
 *
 * Só a forma — quem pinta decide o que a célula carrega (marca binária em
 * Registros, quantidade em Hábitos).
 */
export function yearGrid(year: number): YearGridCell[][] {
  const start = mondayOf(new Date(year, 0, 1));
  const lastMonday = mondayOf(new Date(year, 11, 31)).getTime();
  const weeks: YearGridCell[][] = [];
  for (
    let w = start;
    w.getTime() <= lastMonday;
    w = new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)
  ) {
    const week: YearGridCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(w.getFullYear(), w.getMonth(), w.getDate() + i);
      week.push({ date: localDateStr(d), inYear: d.getFullYear() === year });
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * As colunas onde os meses começam, em ordem (jan → dez). Um mês "começa" na
 * semana que contém o seu dia 1º dentro do ano; como todo mês tem ≥ 28 dias,
 * nunca há dois inícios na mesma coluna.
 */
export interface HeatmapMonthStart {
  /** Índice da coluna (semana) na grade. */
  week: number;
  /** Mês civil, 0 = jan. */
  month: number;
}

export function gridMonthStarts(weeks: readonly (readonly YearGridCell[])[]): HeatmapMonthStart[] {
  const starts: HeatmapMonthStart[] = [];
  weeks.forEach((week, wi) => {
    for (const c of week) {
      if (c.inYear && c.date.slice(8) === '01') {
        starts.push({ week: wi, month: Number(c.date.slice(5, 7)) - 1 });
      }
    }
  });
  return starts;
}
