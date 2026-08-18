/**
 * Destaques (highlights) do histórico de uma atividade de distância (corrida,
 * ciclismo) para a página de tipo. Espelha `mobile/src/lib/running-highlights.ts`
 * — mantenha as duas em sincronia (mesmas chaves, mesma ordem de exibição).
 *
 * Linha 1: resumo de distância (maior, últimos 12 meses, total) — para todo tipo
 * habilitado. Linha 2: recordes por distância (best efforts) — só corrida; ou
 * recordes de elevação (maior ganho, acumulado 12 meses) — só ciclismo.
 */
import type { Activity } from '@vitale/shared';
import { formatClock, fmtDate, fmtElevation, formatPace } from './format';

/** Códigos HealthKit. */
const RUNNING_ACTIVITY_ID = 37;
const CYCLING_ACTIVITY_ID = 13;
/** Tipos que exibem cards de recorde. */
const HIGHLIGHT_ACTIVITY_IDS = new Set<number>([RUNNING_ACTIVITY_ID, CYCLING_ACTIVITY_ID]);
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/** Substantivo da atividade para legendas (ex.: "12 corridas" / "12 pedaladas"). */
const ACTIVITY_NOUN: Record<number, { one: string; many: string }> = {
  [RUNNING_ACTIVITY_ID]: { one: 'corrida', many: 'corridas' },
  [CYCLING_ACTIVITY_ID]: { one: 'pedalada', many: 'pedaladas' },
};
function noun(activityId: number, n: number): string {
  const w = ACTIVITY_NOUN[activityId] ?? { one: 'atividade', many: 'atividades' };
  return `${n} ${n === 1 ? w.one : w.many}`;
}

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

export interface ActivityHighlight {
  key: string;
  label: string;
  value: string;
  caption?: string;
  /** Linha onde o card aparece: distâncias (resumo) ou recordes por distância. */
  group: 'summary' | 'record';
  /** Cor de fundo do card (tom suave da paleta orgânica). */
  bg: string;
  /** Cor do valor, casando com o fundo. */
  fg: string;
  /** Atividade para a qual navegar ao clicar; ausente nos agregados (sem link). */
  activityId?: string;
}

/**
 * Cor por card — um tom orgânico distinto para cada destaque. Mantenha em sincronia
 * com `mobile/src/lib/running-highlights.ts` (mesmas chaves, mesmos valores).
 */
const HL_COLORS: Record<string, { bg: string; fg: string }> = {
  longest: { bg: '#FCDCC4', fg: '#D26B1E' }, // laranja
  last12mo: { bg: '#DCE4F2', fg: '#4F6FB0' }, // azul
  total: { bg: '#DCEBD6', fg: '#4F8049' }, // verde
  '1000': { bg: '#FBEFC9', fg: '#B68413' }, // amarelo
  '5000': { bg: '#FAE3BE', fg: '#BE7E15' }, // âmbar
  '10000': { bg: '#FBD7CC', fg: '#CF5740' }, // coral
  '20000': { bg: '#F6DCE5', fg: '#C24D72' }, // rosa
  half: { bg: '#F1D8EC', fg: '#A8508F' }, // magenta
  '30000': { bg: '#E7D9EC', fg: '#8657A8' }, // lilás
  '40000': { bg: '#D7EBE0', fg: '#3F8C68' }, // verde-água
  marathon: { bg: '#ECE0D2', fg: '#8A6038' }, // terra
  maxElev: { bg: '#E8E0C9', fg: '#7D6B2F' }, // oliva
  elev12mo: { bg: '#D8E6E9', fg: '#48808F' }, // azul-petróleo
};
const HL_FALLBACK = { bg: '#F3ECE0', fg: '#5C534A' };

function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Destaques de um tipo de distância. `[]` se o tipo não exibe recordes. */
export function activityHighlights(activities: Activity[], activityId: number): ActivityHighlight[] {
  if (!HIGHLIGHT_ACTIVITY_IDS.has(activityId)) return [];
  const items = activities.filter((a) => a.activityId === activityId && !a.hidden);
  if (items.length === 0) return [];

  const out: ActivityHighlight[] = [];

  // ── Linha 1: distâncias (resumo) ──────────────────────────────
  // #0 — Maior distância já percorrida.
  let longest: Activity | undefined;
  for (const a of items) {
    if ((a.distanceM ?? 0) > (longest?.distanceM ?? 0)) longest = a;
  }
  if (longest && (longest.distanceM ?? 0) > 0) {
    out.push({
      key: 'longest',
      label: 'Maior distância',
      value: fmtKm(longest.distanceM as number),
      caption: fmtDate(longest.startAt),
      group: 'summary',
      ...HL_COLORS['longest'],
      activityId: longest.id,
    });
  }

  // #1 — Km nos últimos 12 meses (agregado, sem link).
  const cutoff = Date.now() - TWELVE_MONTHS_MS;
  const recent = items.filter((a) => new Date(a.startAt).getTime() >= cutoff);
  const recentM = recent.reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
  if (recentM > 0) {
    out.push({
      key: 'last12mo',
      label: 'Últimos 12 meses',
      value: fmtKm(recentM),
      caption: noun(activityId, recent.length),
      group: 'summary',
      ...HL_COLORS['last12mo'],
    });
  }

  // #2 — Total em todo o histórico (agregado, sem link).
  const totalM = items.reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
  if (totalM > 0) {
    out.push({
      key: 'total',
      label: 'Total',
      value: fmtKm(totalM),
      caption: noun(activityId, items.length),
      group: 'summary',
      ...HL_COLORS['total'],
    });
  }

  // ── Linha 2: recordes por distância (best efforts), ordem decrescente ──
  // Só corrida tem best efforts; ciclismo tem recordes de elevação abaixo.
  if (activityId === RUNNING_ACTIVITY_ID) {
    for (const { key, label, meters } of [...BEST_EFFORT_DISTANCES].reverse()) {
      let best: { activity: Activity; secs: number } | undefined;
      for (const a of items) {
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
          caption: pace ? `${pace} /km` : fmtDate(best.activity.startAt),
          group: 'record',
          ...(HL_COLORS[key] ?? HL_FALLBACK),
          activityId: best.activity.id,
        });
      }
    }
  }

  // ── Linha 2 (ciclismo): recordes de elevação ──────────────────
  if (activityId === CYCLING_ACTIVITY_ID) {
    // Maior ganho de elevação em uma única pedalada.
    let maxElev: Activity | undefined;
    for (const a of items) {
      if ((a.elevationM ?? 0) > (maxElev?.elevationM ?? 0)) maxElev = a;
    }
    const maxElevValue = maxElev ? fmtElevation(maxElev.elevationM) : null;
    if (maxElev && maxElevValue) {
      out.push({
        key: 'maxElev',
        label: 'Maior elevação',
        value: maxElevValue,
        caption: fmtDate(maxElev.startAt),
        group: 'record',
        ...HL_COLORS['maxElev'],
        activityId: maxElev.id,
      });
    }

    // Elevação acumulada nos últimos 12 meses (agregado, sem link).
    const climbed = recent.filter((a) => (a.elevationM ?? 0) > 0);
    const elev12moValue = fmtElevation(climbed.reduce((sum, a) => sum + (a.elevationM ?? 0), 0));
    if (elev12moValue) {
      out.push({
        key: 'elev12mo',
        label: 'Elevação 12 meses',
        value: elev12moValue,
        caption: noun(activityId, climbed.length),
        group: 'record',
        ...HL_COLORS['elev12mo'],
      });
    }
  }

  return out;
}

/** Atalho para a corrida (com best efforts). Mantido para compatibilidade. */
export function runningHighlights(activities: Activity[]): ActivityHighlight[] {
  return activityHighlights(activities, RUNNING_ACTIVITY_ID);
}

/** Highlights agregados — não pertencem a uma única atividade, então não viram badge. */
const AGGREGATE_KEYS = new Set<string>(['last12mo', 'total', 'elev12mo']);

export interface RecordBadge {
  key: string;
  label: string;
  bg: string;
  fg: string;
}

/**
 * Recordes que ESTA atividade detém atualmente (maior distância, best efforts,
 * maior elevação). Exclui os agregados (últimos 12 meses, total, elevação 12
 * meses). Vazio se não bate nenhum recorde.
 */
export function activityRecordBadges(activities: Activity[], activity: Activity): RecordBadge[] {
  return activityHighlights(activities, activity.activityId)
    .filter((h) => h.activityId === activity.id && !AGGREGATE_KEYS.has(h.key))
    .map((h) => ({ key: h.key, label: h.label, bg: h.bg, fg: h.fg }));
}
