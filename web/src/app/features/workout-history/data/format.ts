/** Helpers de formatação compartilhados pela feature Histórico de Treinos. */

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
