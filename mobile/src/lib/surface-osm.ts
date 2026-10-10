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
  SURFACE_MATCH_RADIUS_M,
  SURFACE_SAMPLE_SPACING_M,
  overpassWaysQuery,
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

/**
 * Orçamento que a consulta pede ao Overpass (`[timeout:N]`).
 *
 * Uma pedalada de 106 km vira 265 amostras num único `around` com `out geom` —
 * e o servidor às vezes precisa de mais de 25 s para isso.
 */
export const OVERPASS_TIMEOUT_S = 50;

/**
 * **Tem de ser MAIOR que o orçamento do servidor, e esse era o defeito.**
 *
 * Até 10/10/2026 os dois eram 25 s: a consulta pedia `[timeout:25]` e o
 * cliente abortava em 25 s. Uma consulta que usasse todo o orçamento do
 * servidor **nunca** podia ser entregue — o `AbortController` disparava no
 * mesmo instante em que a resposta começava a viajar, e ainda por 4G. As duas
 * pedaladas pendentes morriam assim, nos dois espelhos:
 *
 *     overpass indisponível — overpass-api.de timeout 25s · overpass.kumi…
 *
 * Derivado do orçamento de propósito: assim os dois não voltam a ser iguais
 * quando alguém mexer num deles.
 */
export const TIMEOUT_MS = (OVERPASS_TIMEOUT_S + 25) * 1000;

/**
 * Amostras por consulta. **Medido contra o `overpass-api.de` em 10/10/2026**,
 * com um laço de 106 km na Bélgica amostrado a 400 m — a pedalada de 29/09:
 *
 * | pontos | resultado                          |
 * |--------|------------------------------------|
 * | 265    | conexão **derrubada** aos 62 s     |
 * | 90     | **HTTP 200 · 27,7 s · 329 KB**     |
 *
 * Esticar o tempo não resolvia: o pedido de 265 pontos num `around` só, com
 * `out geom`, é grande demais e o servidor desiste. Oitenta dá margem sobre os
 * 90 que passaram, e uma rota longa vira três ou quatro pedidos que respondem
 * — em vez de um que nunca responde.
 *
 * Fatias não precisam de dedupe: `OsmWay` não tem id, a sobreposição é só nas
 * bordas, e o `pickWay` escolhe a via mais próxima de cada amostra de todo
 * jeito. Ver a via repetida duas vezes não muda o resultado.
 */
export const PONTOS_POR_CONSULTA = 80;
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
  const plan = planSurface(
    overview,
    SURFACE_SAMPLE_SPACING_M,
    SURFACE_MATCH_RADIUS_M,
    OVERPASS_TIMEOUT_S,
  );
  // Rota degenerada (um ponto ou nenhum): não há o que perguntar ao OSM, e o
  // resultado honesto é uma rota sem piso — não um erro que volta toda hora.
  const pontos = plan.samples.map((s) => s.point);
  const ways: OsmWay[] = [];
  for (let i = 0; i < pontos.length; i += PONTOS_POR_CONSULTA) {
    const fatia = pontos.slice(i, i + PONTOS_POR_CONSULTA);
    ways.push(
      ...(await fetchWays(
        overpassWaysQuery(fatia, SURFACE_MATCH_RADIUS_M, OVERPASS_TIMEOUT_S),
      )),
    );
  }
  /**
   * **Zero vias para uma rota de verdade não é resposta, é resposta vazia.**
   *
   * Sem nenhuma via, o `surfaceFromWays` classifica *toda* amostra como
   * `desconhecido` — e isso é gravado como piso válido, o que tira a rota da
   * fila **para sempre** (`surface_segments` deixa de ser nulo). Medido em
   * 10/10/2026: uma pedalada apareceu na tela com 0%, que é como 100%
   * desconhecido se lê.
   *
   * O Overpass responder 200 com lista vazia para uma pedalada na Bélgica é
   * falha dele, não ausência de estrada. Lançar põe a rota de volta na fila com
   * o motivo gravado, que é o mesmo contrato do `cities` em NULL.
   */
  if (plan.query && ways.length === 0) {
    throw new Error('overpass devolveu zero vias — resposta vazia, não rota sem piso');
  }
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
