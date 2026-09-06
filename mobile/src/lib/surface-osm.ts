/**
 * Piso das rotas — a consulta ao OpenStreetMap, feita **do aparelho** (ADR 0035).
 *
 * A regra é toda do núcleo (`surface/classify.ts`): amostrar, montar a consulta,
 * classificar, somar. O que existe aqui é o `fetch` — e ele está aqui, e não na
 * edge function, por um motivo medido em 06/09/2026: da Supabase o Overpass
 * devolve 504 e os espelhos penduram, enquanto da rede do usuário a mesma
 * consulta responde em ~5 s. O Overpass dá slots por IP; um IP compartilhado de
 * datacenter não tem slot, o do celular tem.
 *
 * Contrato do passe: best-effort e retry-safe. Uma pedalada por vez, poucas por
 * sync, e falha grava o motivo em `surface_meta` para a rota sair da fila até a
 * próxima janela — nunca derruba o sync.
 */
import {
  parseOverpassWays,
  planSurface,
  surfaceFromWays,
  surfaceMix,
  type LatLng,
  type OsmWay,
  type SurfaceMeta,
} from '@vitale/shared';

/**
 * Espelhos na ordem de tentativa. O principal é o que responde de casa; os
 * outros dois existem para o dia em que ele estiver de castigo, e o erro
 * registrado diz qual falhou e como.
 */
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Curto: a consulta real custa segundos, o resto é fila. */
const TIMEOUT_MS = 25_000;
const UA = 'Orbe/1.0 (life-organizer)';

async function fetchWays(query: string): Promise<OsmWay[]> {
  const failures: string[] = [];
  for (const url of MIRRORS) {
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        failures.push(`${host} HTTP ${res.status}`);
        continue;
      }
      return parseOverpassWays(await res.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`${host} ${ctrl.signal.aborted ? `timeout ${TIMEOUT_MS / 1000}s` : msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`overpass indisponível — ${failures.join(' · ')}`);
}

export interface SurfaceResult {
  segments: ReturnType<typeof surfaceFromWays>['segments'];
  meta: SurfaceMeta;
  mix: ReturnType<typeof surfaceMix>;
}

/**
 * O piso de UMA rota, a partir do traçado reduzido. Lança quando o OSM não
 * responde — quem chama grava a falha e segue.
 */
export async function surfaceOfOverview(overview: readonly LatLng[]): Promise<SurfaceResult> {
  const today = new Date().toISOString().slice(0, 10);
  const plan = planSurface(overview);
  // Rota degenerada (um ponto ou nenhum): não há o que perguntar ao OSM, e o
  // resultado honesto é uma rota sem piso — não um erro que volta toda hora.
  const ways = plan.query ? await fetchWays(plan.query) : [];
  const { segments, meta } = surfaceFromWays(plan, ways, today);
  return { segments, meta, mix: surfaceMix(segments) };
}

/** A procedência de uma falha, no formato que o retry entende. */
export function surfaceFailureMeta(error: unknown): SurfaceMeta {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    version: 1,
    source: 'osm-overpass',
    sampledAt: new Date().toISOString().slice(0, 10),
    spacingM: 0,
    radiusM: 0,
    samples: 0,
    lengthM: 0,
    status: 'failed',
    error: msg.slice(0, 300),
    failedAt: new Date().toISOString(),
  };
}
