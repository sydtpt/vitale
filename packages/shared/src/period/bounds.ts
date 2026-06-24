/**
 * Limites de período para a Retrospectiva — generaliza a noção de "semana"
 * (ver `../week/recap.ts`) para semana | mês | ano, com regras de
 * disponibilidade. Derivação 100% pura (sem Angular/React), compartilhada por
 * web e mobile. Datas em horário local.
 *
 * Convenção de `offset`: 0 = período corrente do tipo, −1 = anterior, +1 = seguinte.
 * Disponibilidade (o quanto à frente o usuário pode navegar):
 *   - week:  a semana corrente só "fecha" no domingo ≥ 20h; antes disso o último
 *            período disponível é a semana anterior.
 *   - month: o mês corrente só fica disponível no dia 01 do mês seguinte → o
 *            último disponível é sempre o mês anterior.
 *   - year:  o ano corrente fica disponível ao vivo (offset 0).
 */
import { mondayOf } from '../week/recap';

export type PeriodKind = 'week' | 'month' | 'year';

export interface PeriodBounds {
  /** Início inclusivo (00:00 local). */
  start: Date;
  /** Fim exclusivo (00:00 local do dia seguinte ao último). */
  end: Date;
  /** Rótulo pronto para exibição. */
  label: string;
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Início do período (00:00 local) que contém `now`, deslocado por `offset`. */
function periodStart(now: Date, kind: PeriodKind, offset: number): Date {
  switch (kind) {
    case 'week': {
      const monday = mondayOf(now);
      return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset * 7);
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() + offset, 1);
    case 'year':
      return new Date(now.getFullYear() + offset, 0, 1);
  }
}

/** Próximo início após `start` (= fim exclusivo do período). */
function nextStart(start: Date, kind: PeriodKind): Date {
  switch (kind) {
    case 'week':
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    case 'month':
      return new Date(start.getFullYear(), start.getMonth() + 1, 1);
    case 'year':
      return new Date(start.getFullYear() + 1, 0, 1);
  }
}

/** Rótulo do período a partir do seu início. */
export function periodLabel(kind: PeriodKind, start: Date): string {
  switch (kind) {
    case 'week': {
      const end = nextStart(start, 'week');
      const sun = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
      return `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)} – ${pad2(sun.getDate())}/${pad2(sun.getMonth() + 1)}`;
    }
    case 'month':
      return `${MONTHS_PT[start.getMonth()]} ${start.getFullYear()}`;
    case 'year':
      return `${start.getFullYear()}`;
  }
}

/** Intervalo [início, fim) do período + rótulo. */
export function periodBounds(now: Date, kind: PeriodKind, offset = 0): PeriodBounds {
  const start = periodStart(now, kind, offset);
  start.setHours(0, 0, 0, 0);
  const end = nextStart(start, kind);
  end.setHours(0, 0, 0, 0);
  return { start, end, label: periodLabel(kind, start) };
}

/**
 * Maior `offset` que o usuário pode visualizar agora (o período mais recente
 * "disponível"). É o teto de navegação para frente; para trás é livre.
 */
export function latestAvailableOffset(now: Date, kind: PeriodKind): number {
  switch (kind) {
    case 'week': {
      // Semana corrente disponível só no domingo (getDay()===0) a partir das 20h.
      const closed = now.getDay() === 0 && now.getHours() >= 20;
      return closed ? 0 : -1;
    }
    case 'month':
      // O mês corrente só fecha no dia 01 do mês seguinte → último é o anterior.
      return -1;
    case 'year':
      // Ano corrente disponível ao vivo.
      return 0;
  }
}
