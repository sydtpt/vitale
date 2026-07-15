/**
 * Shape normalizado de um treino vindo de provedor externo (Strava,
 * intervals.icu), pronto para o dedupe/merge e para virar linha de
 * `activities` + `activity_routes`. Pontos no shape persistido
 * (`{lat,lng,alt?,t?}`, `t` em epoch ms) — o mesmo do kernel fitness do shared.
 */
import type { FitnessPoint, FitnessHrSample } from '../../../packages/shared/src/fitness/streams.ts';

export interface NormalizedActivity {
  provider: 'strava' | 'intervals';
  externalId: string;
  /** Código de atividade do HealthKit (37 corrida, 13 ciclismo…). */
  activityId: number;
  activityName?: string;
  startAt: string;
  endAt: string;
  /** Tempo total decorrido (s). */
  durationS: number;
  /** Tempo em movimento (s) reportado pela fonte, quando existe. */
  movingTimeS?: number;
  distanceM?: number;
  /** Ganho de elevação (m) reportado pela fonte — preferido ao cálculo dos pontos. */
  elevationM?: number;
  calories?: number;
  device?: string;
  points: FitnessPoint[];
  hrSamples: FitnessHrSample[];
}

/**
 * Converte um ISO local sem offset ("2026-07-10T07:00:00") + IANA timezone em
 * epoch ms. Estratégia de duas passadas com Intl (disponível no Deno): formata
 * um chute em UTC no fuso alvo e corrige pela diferença. Strings já com
 * offset/Z são parseadas direto.
 */
export function localIsoToUtcMs(iso: string, timeZone?: string): number {
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso)) return Date.parse(iso);
  const naive = Date.parse(`${iso}Z`); // trata como UTC para começar
  if (!timeZone || !Number.isFinite(naive)) return naive;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(naive)).map((p) => [p.type, p.value]));
    const hour = parts.hour === '24' ? '00' : parts.hour;
    const asIfUtc = Date.parse(
      `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}Z`,
    );
    // naive − offset: se o fuso está atrás do UTC, o instante real é depois.
    return naive - (asIfUtc - naive);
  } catch {
    return naive;
  }
}

/**
 * Monta pontos e amostras de FC a partir de streams paralelos estilo
 * Strava/intervals: `time` (s desde o início), `latlng` ([lat,lng]),
 * `altitude` (m), `heartrate` (bpm). Índices sem dado são pulados.
 */
export function streamsToPointsAndHr(
  startMs: number,
  time: number[] | undefined,
  latlng: Array<[number, number] | null> | undefined,
  altitude: Array<number | null> | undefined,
  heartrate: Array<number | null> | undefined,
): { points: FitnessPoint[]; hrSamples: FitnessHrSample[] } {
  const n = time?.length ?? 0;
  const points: FitnessPoint[] = [];
  const hrSamples: FitnessHrSample[] = [];
  for (let i = 0; i < n; i++) {
    const tS = time![i];
    if (!Number.isFinite(tS)) continue;
    const tMs = startMs + tS * 1000;
    const ll = latlng?.[i];
    if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
      const alt = altitude?.[i];
      points.push({
        lat: ll[0],
        lng: ll[1],
        ...(typeof alt === 'number' && Number.isFinite(alt) ? { alt } : {}),
        t: tMs,
      });
    }
    const bpm = heartrate?.[i];
    if (typeof bpm === 'number' && bpm > 0) hrSamples.push({ bpm, t: tMs });
  }
  return { points, hrSamples };
}
