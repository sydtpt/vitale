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

/** Ritmo médio em min/km (mm:ss) a partir de distância (m) e duração (s). */
export function fmtPace(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  const secPerKm = seconds / (meters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  const sStr = s === 60 ? '00' : String(s).padStart(2, '0');
  return `${s === 60 ? m + 1 : m}:${sStr}`;
}

/** Velocidade média em km/h a partir de distância (m) e duração (s). */
export function fmtSpeed(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  return (meters / 1000 / (seconds / 3600)).toFixed(1);
}

/**
 * Métrica de ritmo por tipo (sobre o tempo em movimento): corrida → pace;
 * ciclismo → velocidade (km/h); demais com distância → min/km.
 */
export function fmtRate(
  activityId: number,
  meters?: number,
  seconds?: number,
): { value: string; caption: string } | null {
  if (activityId === 13) {
    const speed = fmtSpeed(meters, seconds);
    return speed ? { value: speed, caption: 'km/h' } : null;
  }
  const pace = fmtPace(meters, seconds);
  if (!pace) return null;
  return { value: pace, caption: activityId === 37 ? 'pace' : 'min/km' };
}
