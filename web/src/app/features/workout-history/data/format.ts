/**
 * Formatação específica da web para o Histórico de Treinos.
 * O que é idêntico ao mobile vive em `@vitale/shared` (`format/workout.ts`) e é
 * repassado abaixo; aqui ficam só as formas que a web escolhe diferente.
 */
export { totalTimeS, formatClock, formatPace, formatSpeed, formatRate } from '@vitale/shared';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function fmtKm(m: number): string {
  return (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const min = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function fmtKcal(c: number): string {
  return Math.round(c).toLocaleString('pt-BR');
}

/** Ganho de elevação em metros inteiros; null quando ausente ou zero. */
export function fmtElevation(meters?: number): string | null {
  if (!meters || meters <= 0) return null;
  return `${Math.round(meters).toLocaleString('pt-BR')} m`;
}

