/**
 * Piso das rotas — o passe do ingest (ADR 0035).
 *
 * Para UMA pedalada por run: lê o `route_overview`, amostra a cada ~400 m,
 * pergunta ao Overpass as vias a até 25 m da polilinha das amostras (uma
 * chamada só por rota), casa cada amostra com a via mais próxima (ciclovia a
 * ≤ 12 m vence a rua), classifica pela tag `surface` (ou `tracktype`/`highway`,
 * marcando como inferido) e grava segmentos + procedência na rota e o mix na
 * atividade. Toda a regra pura vem de `packages/shared/src/surface/classify.ts`
 * — a function é só a chamada e a escrita.
 *
 * Best-effort como o `enrichCities`: nunca lança. Falha grava
 * `surface_meta.status = 'failed'` com o erro e a hora, e a rota só volta para a
 * fila depois de `RETRY_AFTER_H` — uma API pública fora do ar não pode travar o
 * tick dos outros passes.
 *
 * Uma rota por run porque o Overpass leva 20–45 s por chamada (medido em
 * 05/09/2026 com 250 pontos) e o run inteiro divide o relógio da edge function
 * com o ingest e o geocoding.
 */
import {
  SURFACE_MATCH_RADIUS_M,
  SURFACE_SAMPLE_SPACING_M,
  classifyOsmTags,
  pickWay,
  sampleRoute,
  segmentsFromSamples,
  surfaceMix,
  type ClassifiedSample,
  type LatLng,
  type OsmWay,
  type SurfaceMeta,
  type SurfaceSegment,
} from '../../../packages/shared/src/surface/classify.ts';

/** Mesmo `Admin` do ingest — client com service role. Estrutural para não importar o supabase-js aqui. */
// deno-lint-ignore no-explicit-any
type Admin = any;

const BIKE_ACTIVITY_ID = 13;

/**
 * Espelhos do Overpass, na ordem de tentativa. `OVERPASS_URL` (env) entra na
 * frente quando existe.
 *
 * Por que mais de um: a mesma consulta desta rota responde em ~5 s da rede de
 * casa e ficou **125 s pendurada** saindo da edge function (smoke test de
 * 06/09/2026). O Overpass dá slots por IP, e o IP de saída da Supabase é
 * compartilhado — quando os slots dele estão gastos, a requisição fica na fila
 * em vez de levar 429. Espelho diferente é fila diferente.
 */
const OVERPASS_MIRRORS = [
  Deno.env.get('OVERPASS_URL'),
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
].filter((u): u is string => !!u);

const OVERPASS_UA = Deno.env.get('GEOCODE_UA') ?? 'Orbe/1.0 (life-organizer)';
/**
 * Curto de propósito. A consulta real custa segundos; qualquer coisa acima
 * disto é fila, e esperar na fila com o relógio da function correndo é pior que
 * desistir — o passe é retry-safe e a pedalada volta na próxima janela.
 */
const OVERPASS_TIMEOUT_MS = 25_000;
export const MAX_SURFACE_ACTIVITIES_PER_RUN = 1;
/**
 * Falha volta à fila em horas, não em um dia: com o backfill feito, o passe só
 * cuida das pedaladas novas, e uma janela curta dá várias chances por dia sem
 * custar nada quando não há o que fazer.
 */
const RETRY_AFTER_H = 6;

interface OverpassElement {
  type: string;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

function parseWays(body: unknown): OsmWay[] {
  const elements = ((body as { elements?: OverpassElement[] })?.elements ?? []);
  return elements
    .filter((e) => e.type === 'way' && e.geometry && e.geometry.length > 0)
    .map((e) => ({
      tags: e.tags ?? {},
      geometry: e.geometry!.map((g) => ({ lat: g.lat, lng: g.lon })),
    }));
}

/**
 * Uma chamada por rota: todas as vias `highway` a até `radiusM` da polilinha das
 * amostras. Tenta os espelhos em ordem e devolve o primeiro que responder; se
 * todos falharem, lança com o motivo de cada um — a mensagem vai para
 * `surface_meta.error` e é o que diz se foi fila, 429 ou rede.
 */
async function fetchWaysAlong(points: readonly LatLng[], radiusM: number): Promise<OsmWay[]> {
  const poly = points.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(',');
  const query = `[out:json][timeout:${Math.floor(OVERPASS_TIMEOUT_MS / 1000)}];way(around:${radiusM},${poly})[highway];out geom;`;
  const failures: string[] = [];
  for (const url of OVERPASS_MIRRORS) {
    const host = new URL(url).host;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': OVERPASS_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        failures.push(`${host} HTTP ${res.status}`);
        continue;
      }
      return parseWays(await res.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // O abort tem mensagem genérica ("The signal has been aborted"); o que
      // importa registrar é QUAL espelho ficou pendurado e por quanto tempo.
      failures.push(`${host} ${ctrl.signal.aborted ? `timeout ${OVERPASS_TIMEOUT_MS / 1000}s` : msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`overpass indisponível — ${failures.join(' · ')}`);
}

/** Calcula piso, segmentos e meta de uma rota já reduzida (`route_overview`). */
export async function surfaceOfRoute(
  overview: readonly LatLng[],
  today: string,
): Promise<{ segments: SurfaceSegment[]; meta: SurfaceMeta }> {
  const { samples, gaps, lengthM } = sampleRoute(overview, SURFACE_SAMPLE_SPACING_M);
  const ways = samples.length > 0 ? await fetchWaysAlong(samples.map((s) => s.point), SURFACE_MATCH_RADIUS_M) : [];
  const classified: ClassifiedSample[] = [];
  const dists: number[] = [];
  for (const s of samples) {
    const m = pickWay(s.point, ways);
    if (!m) {
      classified.push({ startM: s.startM, endM: s.endM, cat: 'desconhecido', inferred: true });
      continue;
    }
    dists.push(m.distM);
    const { cat, inferred } = classifyOsmTags(m.way.tags);
    classified.push({ startM: s.startM, endM: s.endM, cat, inferred });
  }
  for (const [a, b] of gaps) classified.push({ startM: a, endM: b, cat: 'desconhecido', inferred: true });
  dists.sort((x, y) => x - y);
  const meta: SurfaceMeta = {
    version: 1,
    source: 'osm-overpass',
    sampledAt: today,
    spacingM: SURFACE_SAMPLE_SPACING_M,
    radiusM: SURFACE_MATCH_RADIUS_M,
    samples: samples.length,
    lengthM: Math.round(lengthM),
    matchMedianM: dists.length ? Math.round(dists[Math.floor(dists.length / 2)] * 10) / 10 : undefined,
    status: 'ok',
  };
  return { segments: segmentsFromSamples(classified), meta };
}

type PendingRoute = {
  activity_id: string;
  route_overview: [number, number][] | null;
  surface_meta: (SurfaceMeta & { failedAt?: string }) | null;
};

/**
 * Preenche o piso de até `MAX_SURFACE_ACTIVITIES_PER_RUN` pedaladas ainda sem
 * `surface_segments`. Devolve quantas concluiu.
 */
export async function enrichSurface(admin: Admin, userId: string): Promise<number> {
  const retryBefore = new Date(Date.now() - RETRY_AFTER_H * 3600_000).toISOString();
  const { data: routes } = await admin
    .from('activity_routes')
    .select('activity_id, route_overview, surface_meta')
    .eq('user_id', userId)
    .is('surface_segments', null)
    .limit(20);
  const pending = ((routes ?? []) as PendingRoute[]).filter(
    (r) => !r.surface_meta || r.surface_meta.status !== 'failed' || String(r.surface_meta.failedAt ?? '') < retryBefore,
  );
  if (pending.length === 0) return 0;

  // Só ciclismo, e as mais recentes primeiro — igual ao passe de cidades.
  const { data: acts } = await admin
    .from('activities')
    .select('id, start_at')
    .eq('user_id', userId)
    .eq('activity_id', BIKE_ACTIVITY_ID)
    .in('id', pending.map((r) => r.activity_id))
    .order('start_at', { ascending: false })
    .limit(MAX_SURFACE_ACTIVITIES_PER_RUN);
  const today = new Date().toISOString().slice(0, 10);
  let done = 0;
  for (const a of (acts ?? []) as Array<{ id: string }>) {
    const route = pending.find((r) => r.activity_id === a.id);
    if (!route) continue;
    const overview = (route.route_overview ?? [])
      .filter((p) => Array.isArray(p) && p.length >= 2)
      .map(([lat, lng]) => ({ lat, lng }));
    try {
      const { segments, meta } = await surfaceOfRoute(overview, today);
      const mix = surfaceMix(segments);
      const { error: e1 } = await admin
        .from('activity_routes')
        .update({ surface_segments: segments, surface_meta: meta })
        .eq('user_id', userId)
        .eq('activity_id', a.id);
      if (e1) throw e1;
      const { error: e2 } = await admin
        .from('activities')
        .update({ surface_mix: mix })
        .eq('user_id', userId)
        .eq('id', a.id);
      if (e2) throw e2;
      done++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = {
        version: 1,
        source: 'osm-overpass',
        sampledAt: today,
        status: 'failed',
        error: message.slice(0, 300),
        failedAt: new Date().toISOString(),
      };
      await admin
        .from('activity_routes')
        .update({ surface_meta: failed })
        .eq('user_id', userId)
        .eq('activity_id', a.id);
    }
  }
  return done;
}
