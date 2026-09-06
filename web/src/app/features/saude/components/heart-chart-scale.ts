/**
 * Escalas e rótulos partilhados pelos três painéis de FC ao longo do dia.
 * Geometria só — cor é variável CSS nos componentes.
 */
import { HEART_DAY_MAX_BPM, HEART_DAY_MIN_BPM } from '@vitale/shared';

export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function dowOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** "4 set" */
export function dayLabel(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

/** "07:32" a partir do minuto local. */
export function hm(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface Frame {
  w: number;
  h: number;
  l: number;
  r: number;
  t: number;
  b: number;
}

/** Escala do gráfico do dia: x pelo minuto local, y fixa em 40–170 bpm. */
export function dayScale(f: Frame) {
  const plotW = f.w - f.l - f.r;
  const plotH = f.h - f.t - f.b;
  const x = (minute: number) => f.l + (minute / 1440) * plotW;
  const y = (bpm: number) => {
    const v = Math.max(HEART_DAY_MIN_BPM, Math.min(HEART_DAY_MAX_BPM, bpm));
    return f.t + (1 - (v - HEART_DAY_MIN_BPM) / (HEART_DAY_MAX_BPM - HEART_DAY_MIN_BPM)) * plotH;
  };
  return { x, y, plotW, plotH };
}

export function fmt(n: number): string {
  return n.toFixed(1);
}
