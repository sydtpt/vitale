/**
 * Os períodos das subviews de sono, a FORMA que cada um pede, e a navegação.
 *
 * Cinco: última noite · 7d · 4s · 12 meses · ano. Nos três curtos, todos os
 * dias aparecem — uma barra por noite. Nos dois longos não cabe uma barra por
 * noite num telefone, e a decisão (05/09/2026) foi **semanas**: a coluna é uma
 * "noite típica" — mediana de apagar e acordar, com o miolo p25–p75 como faixa
 * —, então a regularidade continua aparecendo como forma.
 *
 * **Todo período navega** (05/09): ◀ ▶ recua ou avança *um período do próprio
 * tamanho* — 7d anda sete dias, 4s anda 28, 12m anda doze meses, ano anda um
 * ano, última anda uma noite — e só onde houver noite. "Sempre" foi retirado:
 * navegar substitui acumular.
 *
 * Este módulo só decide *quais noites* e *em que forma*. Quem agrega é
 * `buckets.ts`; quem desenha é o app.
 */

import type { SleepPeriod } from '../models';
import { localDateStr } from '../date/local';

export type SonoRange = 'ultima' | '7d' | '4s' | '12m' | 'ano';

/** Como o período se desenha: barra por noite ou coluna por semana. */
export type SonoForm = 'nights' | 'weeks';

export interface SonoRangeDef {
  id: SonoRange;
  label: string;
  form: SonoForm;
}

export const SONO_RANGES: readonly SonoRangeDef[] = [
  { id: 'ultima', label: 'última', form: 'nights' },
  { id: '7d', label: '7d', form: 'nights' },
  { id: '4s', label: '4s', form: 'nights' },
  { id: '12m', label: '12m', form: 'weeks' },
  { id: 'ano', label: 'ano', form: 'weeks' },
];

export function rangeForm(range: SonoRange): SonoForm {
  return SONO_RANGES.find((r) => r.id === range)?.form ?? 'nights';
}

export interface RangeBounds {
  /** Primeiro dia de acordar incluído; `null` = sem limite inferior. */
  since: string | null;
  /** Último dia incluído; `null` = até o fim (a janela corrente fica aberta ao sync de hoje). */
  until: string | null;
}

/**
 * Limites do período, em dias de acordar, `offset` períodos para trás.
 *
 * Aritmética de calendário (`setDate`/`setMonth`), não `Date.now() − n×24h`: a
 * Bélgica tem horário de verão, e a subtração em milissegundos atravessa a
 * virada deslocada. "Ano" é o ano civil; "12 meses" são doze meses de calendário.
 * A janela corrente (`offset = 0`) não tem `until`, para a noite que o sync de
 * hoje ainda vai trazer caber nela.
 */
export function rangeBounds(range: SonoRange, today: Date = new Date(), offset = 0): RangeBounds {
  const end = new Date(today);
  const open = offset === 0;
  switch (range) {
    case 'ultima':
      return { since: null, until: null }; // resolvido por `filterByRange`: a n-ésima noite mais recente
    case '7d': {
      end.setDate(end.getDate() - 7 * offset);
      const since = new Date(end);
      since.setDate(since.getDate() - 6);
      return { since: localDateStr(since), until: open ? null : localDateStr(end) };
    }
    case '4s': {
      end.setDate(end.getDate() - 28 * offset);
      const since = new Date(end);
      since.setDate(since.getDate() - 27);
      return { since: localDateStr(since), until: open ? null : localDateStr(end) };
    }
    case '12m': {
      end.setMonth(end.getMonth() - 12 * offset);
      const since = new Date(end);
      since.setMonth(since.getMonth() - 12);
      since.setDate(since.getDate() + 1);
      return { since: localDateStr(since), until: open ? null : localDateStr(end) };
    }
    case 'ano': {
      const y = today.getFullYear() - offset;
      return { since: `${y}-01-01`, until: `${y}-12-31` };
    }
  }
}

/**
 * As noites do período, em ordem cronológica.
 *
 * "Última" é a noite mais recente que existe — não "a de hoje": quem abre a tela
 * numa manhã sem sync ainda vê a noite anterior, não um vazio. Com `offset`, a
 * n-ésima mais recente.
 */
export function filterByRange(
  periods: readonly SleepPeriod[],
  range: SonoRange,
  today: Date = new Date(),
  offset = 0,
): SleepPeriod[] {
  const sorted = [...periods].sort((a, b) => a.wakeDay.localeCompare(b.wakeDay));
  if (range === 'ultima') {
    const p = sorted[sorted.length - 1 - offset];
    return p ? [p] : [];
  }
  const { since, until } = rangeBounds(range, today, offset);
  return sorted.filter((p) => (since === null || p.wakeDay >= since) && (until === null || p.wakeDay <= until));
}

/** Há noite no período `offset` passos atrás? É o que liga ou apaga o ◀. */
export function hasNights(periods: readonly SleepPeriod[], range: SonoRange, today: Date = new Date(), offset = 0): boolean {
  return filterByRange(periods, range, today, offset).length > 0;
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function dm(day: string): string {
  return `${Number(day.slice(8, 10))} ${MES[Number(day.slice(5, 7)) - 1]}`;
}

/**
 * O rótulo da janela, para os dois apps escreverem o mesmo: "30 ago → 5 set",
 * "set 2025 → set 2026", "2025", ou o dia da noite em "última".
 */
export function rangeLabel(range: SonoRange, nights: readonly SleepPeriod[], today: Date = new Date(), offset = 0): string {
  if (range === 'ultima') return nights.length ? dm(nights[0].wakeDay) : '—';
  const { since, until } = rangeBounds(range, today, offset);
  if (range === 'ano') return String(today.getFullYear() - offset);
  const end = until ?? localDateStr(today);
  if (range === '12m') return `${MES[Number(since!.slice(5, 7)) - 1]} ${since!.slice(0, 4)} → ${MES[Number(end.slice(5, 7)) - 1]} ${end.slice(0, 4)}`;
  return `${dm(since!)} → ${dm(end)}`;
}
