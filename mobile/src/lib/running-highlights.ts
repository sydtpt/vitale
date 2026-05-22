/**
 * Destaques (highlights) do histórico de corrida, derivados das atividades já
 * carregadas. Módulo puro — a UI só renderiza o resultado.
 *
 * - Maior distância e km dos últimos 12 meses vêm de `distanceM`.
 * - Os recordes por distância (1/5/10/20 km, meia, 30/40 km, maratona) vêm de
 *   `bestEfforts`, calculado no sync a partir do track GPS.
 *
 * Cada highlight aponta para uma atividade (`activityId`) para navegação ao
 * detalhe. Só highlights com dado real entram na lista.
 */
import type { Activity } from '@vitale/shared';
import { BEST_EFFORT_DISTANCES } from './best-efforts';
import { formatClock, formatDateLabel, formatPace } from './workout-format';

/** Código HealthKit da corrida. */
const RUNNING_ACTIVITY_ID = 37;
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

export interface RunningHighlight {
  key: string;
  label: string;
  value: string;
  caption?: string;
  /** Atividade para a qual navegar ao tocar. */
  activityId: string;
}

function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function runningHighlights(activities: Activity[]): RunningHighlight[] {
  const runs = activities.filter((a) => a.activityId === RUNNING_ACTIVITY_ID && !a.hidden);
  if (runs.length === 0) return [];

  const out: RunningHighlight[] = [];

  // #0 — Maior distância já corrida.
  let longest: Activity | undefined;
  for (const a of runs) {
    if ((a.distanceM ?? 0) > (longest?.distanceM ?? 0)) longest = a;
  }
  if (longest && (longest.distanceM ?? 0) > 0) {
    out.push({
      key: 'longest',
      label: 'Maior distância',
      value: fmtKm(longest.distanceM as number),
      caption: formatDateLabel(longest.startAt),
      activityId: longest.id,
    });
  }

  // #1 — Km corridos nos últimos 12 meses (toca → corrida mais recente da janela).
  const cutoff = Date.now() - TWELVE_MONTHS_MS;
  const recent = runs.filter((a) => new Date(a.startAt).getTime() >= cutoff);
  const totalM = recent.reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
  if (totalM > 0) {
    const mostRecent = recent.reduce((r, a) =>
      new Date(a.startAt).getTime() > new Date(r.startAt).getTime() ? a : r,
    );
    out.push({
      key: 'last12mo',
      label: 'Últimos 12 meses',
      value: fmtKm(totalM),
      caption: `${recent.length} ${recent.length === 1 ? 'corrida' : 'corridas'}`,
      activityId: mostRecent.id,
    });
  }

  // #2–#9 — Recordes por distância (best efforts).
  for (const { key, label, meters } of BEST_EFFORT_DISTANCES) {
    let best: { activity: Activity; secs: number } | undefined;
    for (const a of runs) {
      const secs = a.bestEfforts?.[key];
      if (typeof secs === 'number' && (best === undefined || secs < best.secs)) {
        best = { activity: a, secs };
      }
    }
    if (best) {
      const pace = formatPace(meters, best.secs);
      out.push({
        key,
        label,
        value: formatClock(best.secs),
        caption: pace ? `${pace} /km` : formatDateLabel(best.activity.startAt),
        activityId: best.activity.id,
      });
    }
  }

  return out;
}
