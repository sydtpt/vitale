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

/** Ritmo médio em min/km a partir de distância (m) e duração (s). */
export function formatPace(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  const secPerKm = seconds / (meters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  const sStr = s === 60 ? '00' : String(s).padStart(2, '0');
  const min = s === 60 ? m + 1 : m;
  return `${min}:${sStr}`;
}

/** Velocidade média em km/h a partir de distância (m) e duração (s). */
export function formatSpeed(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  const kmh = meters / 1000 / (seconds / 3600);
  return kmh.toFixed(1);
}

/**
 * Métrica de ritmo por tipo de atividade, sempre calculada sobre o tempo em
 * movimento: corrida → pace (min/km); ciclismo → velocidade (km/h); demais
 * atividades com distância → min/km. Retorna null se não houver como calcular.
 */
export function formatRate(
  activityId: number,
  meters?: number,
  seconds?: number,
): { value: string; caption: string } | null {
  if (activityId === 13) {
    const speed = formatSpeed(meters, seconds);
    return speed ? { value: speed, caption: 'km/h' } : null;
  }
  const pace = formatPace(meters, seconds);
  if (!pace) return null;
  return { value: pace, caption: activityId === 37 ? 'pace' : 'min/km' };
}

export function formatElevation(meters: number): string | null {
  if (!meters || meters <= 0) return null;
  return `${Math.round(meters)} m`;
}
