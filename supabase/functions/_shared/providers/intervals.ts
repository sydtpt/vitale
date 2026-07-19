/**
 * Cliente intervals.icu (ponte Garmin → Vitale).
 * Auth: HTTP Basic com usuário literal "API_KEY" e senha = chave pessoal
 * (Settings → Developer no intervals.icu). Endpoints usados:
 *   GET /api/v1/athlete/{id}                         — validação do vínculo
 *   GET /api/v1/athlete/{id}/activities?oldest&newest — lista (ISO local)
 *   GET /api/v1/activity/{id}/streams?types=...       — streams do FIT
 * Parsing defensivo: campos variam entre versões da API. O stream `latlng`
 * separa as coordenadas em `data` (lat) e `data2` (lng) — não são pares.
 */
import { mapIntervalsType } from '../../../../packages/shared/src/fitness/dedupe.ts';
import {
  localIsoToUtcMs,
  streamsToPointsAndHr,
  type NormalizedActivity,
} from '../normalize.ts';
import { AuthError } from './errors.ts';

const BASE = 'https://intervals.icu/api/v1';

function basicAuth(apiKey: string): string {
  return `Basic ${btoa(`API_KEY:${apiKey}`)}`;
}

async function icuGet(apiKey: string, path: string): Promise<Response> {
  return await fetch(`${BASE}${path}`, {
    headers: { Authorization: basicAuth(apiKey), Accept: 'application/json' },
  });
}

export interface IntervalsAthlete {
  athleteId: string;
  name?: string;
  /** Metadados úteis ao ingest (zonas de FC): {max_hr?, resting_hr?}. */
  meta: Record<string, unknown>;
}

/** Valida a API key + athleteId. Lança com mensagem amigável se inválidos. */
export async function validateIntervals(apiKey: string, athleteId: string): Promise<IntervalsAthlete> {
  const res = await icuGet(apiKey, `/athlete/${encodeURIComponent(athleteId)}`);
  if (res.status === 401 || res.status === 403) throw new Error('API key inválida');
  if (res.status === 404) throw new Error('Athlete ID não encontrado');
  if (!res.ok) throw new Error(`intervals.icu respondeu ${res.status}`);
  const a = await res.json();
  const sport = Array.isArray(a?.sportSettings) ? a.sportSettings[0] : undefined;
  const maxHr = a?.icu_max_hr ?? sport?.max_hr;
  const restingHr = a?.icu_resting_hr;
  return {
    athleteId: String(a?.id ?? athleteId),
    name: a?.name ?? undefined,
    meta: {
      ...(typeof maxHr === 'number' ? { max_hr: maxHr } : {}),
      ...(typeof restingHr === 'number' ? { resting_hr: restingHr } : {}),
    },
  };
}

interface RawIntervalsActivity {
  id: string | number;
  type?: string;
  name?: string;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  calories?: number;
  device_name?: string;
}

/**
 * Lista atividades no intervalo, ascendente por início, SEM streams (buscados
 * depois, uma chamada por atividade). Datas dos params em ISO local (a API
 * interpreta no fuso do atleta).
 */
export async function fetchIntervalsActivities(
  apiKey: string,
  athleteId: string,
  oldestIso: string,
  newestIso: string,
): Promise<RawIntervalsActivity[]> {
  // A API interpreta as datas no fuso do atleta e responde 422 a sufixo de fuso
  // (`Z`/`±hh`) — corta para `YYYY-MM-DDTHH:mm:ss`. O desvio de até um fuso é
  // absorvido pelas margens da janela (rewind de 24h no cursor, +1d no newest).
  const local = (iso: string) => iso.slice(0, 19);
  const qs = `oldest=${encodeURIComponent(local(oldestIso))}&newest=${encodeURIComponent(local(newestIso))}`;
  const res = await icuGet(apiKey, `/athlete/${encodeURIComponent(athleteId)}/activities?${qs}`);
  if (res.status === 401 || res.status === 403) throw new AuthError('intervals.icu: API key rejeitada');
  if (!res.ok) throw new Error(`intervals.icu /activities respondeu ${res.status}`);
  const list = (await res.json()) as RawIntervalsActivity[];
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && a.id != null && (a.start_date || a.start_date_local))
    .sort((a, b) => intervalsStartMs(a) - intervalsStartMs(b));
}

/** Início da atividade em epoch ms (exportado p/ o check de idempotência do ingest). */
export function intervalsStartMs(a: RawIntervalsActivity): number {
  if (a.start_date) return localIsoToUtcMs(a.start_date, a.timezone);
  return localIsoToUtcMs(a.start_date_local as string, a.timezone);
}

/** Streams de uma atividade → pontos + FC. Vazio quando não há (indoor). */
async function fetchIntervalsStreams(
  apiKey: string,
  activityId: string,
  startMsEpoch: number,
): Promise<{ points: NormalizedActivity['points']; hrSamples: NormalizedActivity['hrSamples'] }> {
  const types = 'time,latlng,altitude,heartrate';
  const res = await icuGet(apiKey, `/activity/${encodeURIComponent(activityId)}/streams?types=${types}`);
  if (!res.ok) return { points: [], hrSamples: [] };
  const body = await res.json();
  // Formatos observados: array de {type,data,data2} OU objeto {type: {data}}.
  const streamOf = (t: string): Record<string, unknown> | undefined => {
    const e = Array.isArray(body) ? body.find((s) => s?.type === t) : body?.[t];
    return e && !Array.isArray(e) ? (e as Record<string, unknown>) : undefined;
  };
  const dataOf = (t: string): unknown[] | undefined => {
    if (Array.isArray(body)) return body.find((s) => s?.type === t)?.data;
    const e = body?.[t];
    return Array.isArray(e) ? e : (e?.data as unknown[] | undefined);
  };
  // O intervals.icu NÃO devolve o latlng como pares: latitude vai em `data` e
  // longitude em `data2`. Junta índice a índice em [lat,lng] (par incompleto → null).
  const ll = streamOf('latlng');
  const lat = ll?.data as Array<number | null> | undefined;
  const lng = ll?.data2 as Array<number | null> | undefined;
  const latlng =
    lat && lng
      ? lat.map((la, i): [number, number] | null => {
          const lo = lng[i];
          return typeof la === 'number' && typeof lo === 'number' ? [la, lo] : null;
        })
      : undefined;
  return streamsToPointsAndHr(
    startMsEpoch,
    dataOf('time') as number[] | undefined,
    latlng,
    dataOf('altitude') as Array<number | null> | undefined,
    dataOf('heartrate') as Array<number | null> | undefined,
  );
}

/** Normaliza uma atividade da lista (busca os streams na hora). */
export async function normalizeIntervalsActivity(
  apiKey: string,
  raw: RawIntervalsActivity,
): Promise<NormalizedActivity | null> {
  const startEpochMs = intervalsStartMs(raw);
  const durationS = Math.round(raw.elapsed_time ?? raw.moving_time ?? 0);
  if (!Number.isFinite(startEpochMs) || durationS <= 0) return null;
  const externalId = String(raw.id);
  const { points, hrSamples } = await fetchIntervalsStreams(apiKey, externalId, startEpochMs);
  return {
    provider: 'intervals',
    externalId,
    activityId: mapIntervalsType(raw.type),
    activityName: raw.name ?? undefined,
    startAt: new Date(startEpochMs).toISOString(),
    endAt: new Date(startEpochMs + durationS * 1000).toISOString(),
    durationS,
    movingTimeS: typeof raw.moving_time === 'number' ? Math.round(raw.moving_time) : undefined,
    distanceM: typeof raw.distance === 'number' && raw.distance > 0 ? raw.distance : undefined,
    // 0 também vem em atividades sem altímetro — nesse caso cai no cálculo dos pontos.
    elevationM:
      typeof raw.total_elevation_gain === 'number' && raw.total_elevation_gain > 0
        ? raw.total_elevation_gain
        : undefined,
    calories: typeof raw.calories === 'number' && raw.calories > 0 ? Math.round(raw.calories) : undefined,
    device: raw.device_name ?? undefined,
    points,
    hrSamples,
  };
}
