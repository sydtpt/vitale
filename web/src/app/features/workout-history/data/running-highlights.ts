/**
 * Destaques (highlights) do histórico de corrida para a página de tipo.
 * Espelha a lógica de `mobile/src/lib/running-highlights.ts` — mantenha as duas
 * em sincronia (mesmas chaves de `bestEfforts`, mesma ordem de exibição).
 */
import type { Activity } from '@vitale/shared';
import { fmtClock, fmtDate, fmtPace } from './format';

/** Código HealthKit da corrida. */
const RUNNING_ACTIVITY_ID = 37;
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Distâncias dos recordes, na ordem de exibição. As chaves DEVEM casar com
 * `BEST_EFFORT_DISTANCES` de `mobile/src/lib/best-efforts.ts`.
 */
const BEST_EFFORT_DISTANCES: { key: string; meters: number; label: string }[] = [
  { key: '1000', meters: 1000, label: '1 km' },
  { key: '5000', meters: 5000, label: '5 km' },
  { key: '10000', meters: 10000, label: '10 km' },
  { key: '20000', meters: 20000, label: '20 km' },
  { key: 'half', meters: 21097.5, label: 'Meia maratona' },
  { key: '30000', meters: 30000, label: '30 km' },
  { key: '40000', meters: 40000, label: '40 km' },
  { key: 'marathon', meters: 42195, label: 'Maratona' },
];

export interface RunningHighlight {
  key: string;
  label: string;
  value: string;
  caption?: string;
  /** Atividade para a qual navegar ao clicar. */
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
      caption: fmtDate(longest.startAt),
      activityId: longest.id,
    });
  }

  // #1 — Km corridos nos últimos 12 meses (clique → corrida mais recente da janela).
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
      const pace = fmtPace(meters, best.secs);
      out.push({
        key,
        label,
        value: fmtClock(best.secs),
        caption: pace ? `${pace} /km` : fmtDate(best.activity.startAt),
        activityId: best.activity.id,
      });
    }
  }

  return out;
}
