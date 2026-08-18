/**
 * Formatação específica do mobile para treinos.
 * O que é idêntico à web vive em `@vitale/shared` (`format/workout.ts`) e é
 * repassado abaixo; aqui ficam só as formas que o app escolhe diferente.
 */
export { totalTimeS, formatClock, formatPace, formatSpeed, formatRate } from '@vitale/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = startOfDay(new Date());
  const diff = Math.round((today - startOfDay(d)) / DAY_MS);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: today - startOfDay(d) > 365 * DAY_MS ? 'numeric' : undefined,
  });
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  if (m > 0) return `${m}min`;
  return `${total}s`;
}

export function formatDistance(meters?: number): string | null {
  if (!meters || meters <= 0) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatElevation(meters: number): string | null {
  if (!meters || meters <= 0) return null;
  return `${Math.round(meters)} m`;
}
