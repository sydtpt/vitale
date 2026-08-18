/**
 * Formatação de treino que é **a mesma nas duas plataformas** — fonte única.
 *
 * Só entra aqui o que web e mobile produziam byte a byte igual. Rótulo de data,
 * distância, duração e elevação ficam de fora de propósito: cada app formata do
 * seu jeito ("5 jan 2026" contra "Hoje"; "30m" contra "30min"), e isso é escolha
 * de apresentação, não divergência a corrigir.
 */

/**
 * Tempo total (s) de uma atividade: o tempo de relógio decorrido (fim − início),
 * que inclui as pausas. `durationS` (HKWorkout.duration) já desconta as pausas —
 * usá-lo como "tempo total" fazia o total coincidir com o tempo em movimento.
 * Nunca fica abaixo de `durationS`; cai para ele com datas inválidas.
 */
export function totalTimeS(startISO: string, endISO: string, durationS: number): number {
  const dur = Math.max(0, Math.round(durationS));
  const elapsed = Math.round((Date.parse(endISO) - Date.parse(startISO)) / 1000);
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.max(elapsed, dur) : dur;
}

/** Tempo de recorde no formato relógio: `h:mm:ss` ou `m:ss`. */
export function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Ritmo médio em min/km (mm:ss) a partir de distância (m) e duração (s). */
export function formatPace(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  const secPerKm = seconds / (meters / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  const sStr = s === 60 ? '00' : String(s).padStart(2, '0');
  return `${s === 60 ? m + 1 : m}:${sStr}`;
}

/** Velocidade média em km/h a partir de distância (m) e duração (s). */
export function formatSpeed(meters?: number, seconds?: number): string | null {
  if (!meters || meters <= 0 || !seconds || seconds <= 0) return null;
  return (meters / 1000 / (seconds / 3600)).toFixed(1);
}

/**
 * Métrica de ritmo por tipo, sempre sobre o tempo em movimento: corrida → pace;
 * ciclismo → velocidade (km/h); demais com distância → min/km. `null` quando não
 * há como calcular.
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
