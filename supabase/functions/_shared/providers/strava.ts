/**
 * Cliente Strava (ponte alternativa Garmin/Apple → Vitale).
 * OAuth 2: authorize → code → token (com refresh_token ROTACIONADO a cada
 * refresh — sempre persistir o novo). Secrets via `supabase secrets set
 * STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET`. Rate limit: 200 req/15min, 2000/dia
 * — o cap de atividades por run do ingest mantém folga.
 */
import { mapStravaSport } from '../../../../packages/shared/src/fitness/dedupe.ts';
import { streamsToPointsAndHr, type NormalizedActivity } from '../normalize.ts';
import { AuthError } from './errors.ts';

const API = 'https://www.strava.com/api/v3';

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO de expiração do access token. */
  expiresAt: string;
}

export interface StravaTokenResponse extends StravaTokens {
  athleteId?: string;
  athleteName?: string;
}

function clientCreds(): { id: string; secret: string } {
  const id = Deno.env.get('STRAVA_CLIENT_ID');
  const secret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!id || !secret) throw new Error('STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET não configurados');
  return { id, secret };
}

/** URL de autorização para o navegador do usuário. */
export function stravaAuthorizeUrl(redirectUri: string, state: string): string {
  const { id } = clientCreds();
  const qs = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  return `https://www.strava.com/oauth/authorize?${qs}`;
}

function parseTokenResponse(body: Record<string, unknown>): StravaTokenResponse {
  const athlete = body.athlete as Record<string, unknown> | undefined;
  const first = athlete?.firstname ?? '';
  const last = athlete?.lastname ?? '';
  return {
    accessToken: String(body.access_token),
    refreshToken: String(body.refresh_token),
    expiresAt: new Date(Number(body.expires_at) * 1000).toISOString(),
    athleteId: athlete?.id != null ? String(athlete.id) : undefined,
    athleteName: `${first} ${last}`.trim() || undefined,
  };
}

/** Troca o `code` do callback por tokens (+ dados do atleta). */
export async function exchangeStravaCode(code: string): Promise<StravaTokenResponse> {
  const { id, secret } = clientCreds();
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange falhou (${res.status})`);
  return parseTokenResponse(await res.json());
}

/** Renova o access token. O refresh_token retornado SUBSTITUI o anterior. */
export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const { id, secret } = clientCreds();
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (res.status === 400 || res.status === 401) throw new AuthError('Strava: refresh token rejeitado');
  if (!res.ok) throw new Error(`Strava token refresh falhou (${res.status})`);
  return parseTokenResponse(await res.json());
}

/** Revoga o acesso do app na conta Strava (best-effort no desvincular). */
export async function deauthorizeStrava(accessToken: string): Promise<void> {
  await fetch('https://www.strava.com/oauth/deauthorize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => undefined);
}

interface RawStravaActivity {
  id: number;
  sport_type?: string;
  type?: string;
  name?: string;
  start_date?: string; // UTC com Z
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  device_name?: string;
}

/** Início da atividade em epoch ms (exportado p/ o check de idempotência do ingest). */
export function stravaStartMs(a: RawStravaActivity): number {
  return Date.parse(a.start_date ?? '');
}

async function stravaGet(accessToken: string, path: string): Promise<Response> {
  return await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
}

/** Atividades após `afterEpochS`, ascendente por início (ordem da API). */
export async function fetchStravaActivities(
  accessToken: string,
  afterEpochS: number,
): Promise<RawStravaActivity[]> {
  const res = await stravaGet(accessToken, `/athlete/activities?after=${Math.floor(afterEpochS)}&per_page=100`);
  if (res.status === 401) throw new AuthError('Strava: access token rejeitado');
  if (res.status === 429) throw new Error('Strava: rate limit atingido');
  if (!res.ok) throw new Error(`Strava /athlete/activities respondeu ${res.status}`);
  const list = (await res.json()) as RawStravaActivity[];
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && a.id != null && a.start_date)
    .sort((a, b) => Date.parse(a.start_date!) - Date.parse(b.start_date!));
}

/** Streams de uma atividade → pontos + FC. Vazio quando não há (indoor). */
async function fetchStravaStreams(
  accessToken: string,
  activityId: number | string,
  startMsEpoch: number,
): Promise<{ points: NormalizedActivity['points']; hrSamples: NormalizedActivity['hrSamples'] }> {
  const res = await stravaGet(
    accessToken,
    `/activities/${activityId}/streams?keys=time,latlng,altitude,heartrate&key_by_type=true`,
  );
  if (!res.ok) return { points: [], hrSamples: [] };
  const body = await res.json();
  return streamsToPointsAndHr(
    startMsEpoch,
    body?.time?.data,
    body?.latlng?.data,
    body?.altitude?.data,
    body?.heartrate?.data,
  );
}

/** Normaliza uma atividade da lista (busca os streams na hora). */
export async function normalizeStravaActivity(
  accessToken: string,
  raw: RawStravaActivity,
): Promise<NormalizedActivity | null> {
  const startEpochMs = Date.parse(raw.start_date ?? '');
  const durationS = Math.round(raw.elapsed_time ?? raw.moving_time ?? 0);
  if (!Number.isFinite(startEpochMs) || durationS <= 0) return null;
  const { points, hrSamples } = await fetchStravaStreams(accessToken, raw.id, startEpochMs);
  return {
    provider: 'strava',
    externalId: String(raw.id),
    activityId: mapStravaSport(raw.sport_type ?? raw.type),
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
    // A lista da Strava não traz calorias (só o detalhe); ficam do lado mais rico do merge.
    device: raw.device_name ?? undefined,
    points,
    hrSamples,
  };
}
