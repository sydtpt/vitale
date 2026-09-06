/**
 * Piso das rotas — a classificação e a geometria, puras (ADR 0034).
 *
 * SEM IMPORTS de propósito: a edge function `connections-ingest` consome este
 * módulo por caminho relativo, e o Deno não resolve specifier sem extensão. A
 * barreira em `architecture.test.ts` cobra que continue assim.
 *
 * O que vive aqui: (1) a tabela que traduz tags do OpenStreetMap em cinco
 * categorias de piso + "desconhecido"; (2) a regra de escolher a via quando há
 * mais de uma perto do ponto; (3) a geometria do casamento ponto↔via; (4) a
 * montagem de segmentos e a soma por categoria. O que NÃO vive aqui: a chamada
 * ao Overpass e a escrita no banco — isso é a function.
 *
 * A pesquisa de 05/09/2026 mandou duas coisas que este módulo cumpre: o
 * "não especificado" é classe própria e nunca é redistribuído (a Strava somou
 * 61% quando o escondeu), e todo trecho carrega se foi INFERIDO pelo tipo de via
 * (14,5% dos pontos medidos não tinham tag `surface`).
 */

export type SurfaceCategory = 'liso' | 'blocos' | 'pave' | 'cascalho' | 'terra' | 'desconhecido';

/** Ordem do liso ao áspero — é a escada da rampa de cor, e a ordem das somas. */
export const SURFACE_CATEGORIES: readonly SurfaceCategory[] = [
  'liso',
  'blocos',
  'pave',
  'cascalho',
  'terra',
  'desconhecido',
];

/**
 * Um trecho contíguo da rota: [início m, fim m, categoria, inferido].
 * Metros ao longo do `route_overview` (não do track cheio — ver `SurfaceMeta.lengthM`).
 * `inferido` = 1 quando a via não tinha tag `surface` e a classe veio do
 * `tracktype` ou do `highway`.
 */
export type SurfaceSegment = [number, number, SurfaceCategory, 0 | 1];

/** Metros por categoria; `inferido` é a parte de `total` que veio sem tag. */
export interface SurfaceMix {
  liso: number;
  blocos: number;
  pave: number;
  cascalho: number;
  terra: number;
  desconhecido: number;
  inferido: number;
  total: number;
}

/** Procedência do cálculo — guardada por rota para poder recalcular quando a fonte mudar. */
export interface SurfaceMeta {
  version: 1;
  source: 'osm-overpass';
  /** ISO do dia em que o OSM foi consultado. */
  sampledAt: string;
  spacingM: number;
  radiusM: number;
  samples: number;
  /** Comprimento do overview amostrado (m) — menor que `distance_m` por cortar curvas. */
  lengthM: number;
  /** Mediana da distância ponto→via (m) nas amostras casadas; qualidade do casamento. */
  matchMedianM?: number;
  status?: 'ok' | 'failed';
  error?: string;
}

export const SURFACE_SAMPLE_SPACING_M = 400;
export const SURFACE_MATCH_RADIUS_M = 25;
/** Ciclovia a até esta distância vence a rua paralela: o ciclista está nela. */
export const SURFACE_CYCLEWAY_PREFER_M = 12;
/** Reta maior que isto entre pontos consecutivos é GPS perdido — não amostrar (regra do VeloViewer). */
export const SURFACE_GAP_M = 500;

export type OsmTags = Record<string, string | undefined>;

const SMOOTH = new Set([
  'asphalt', 'concrete', 'concrete:plates', 'concrete:lanes', 'paved', 'chipseal', 'metal',
  'wood', 'tartan', 'rubber', 'metal_grid',
]);
const STONES = new Set(['paving_stones', 'bricks', 'brick', 'paving_blocks']);
const COBBLE = new Set(['sett', 'cobblestone', 'unhewn_cobblestone', 'cobblestone:flattened', 'stone', 'rock']);
const GRAVEL = new Set(['compacted', 'fine_gravel', 'gravel', 'pebblestone', 'shells', 'crushed_limestone']);
const ROUGH = new Set([
  'ground', 'dirt', 'earth', 'mud', 'grass', 'sand', 'unpaved', 'woodchips', 'clay', 'grass_paver',
  'stepping_stones', 'soil', 'rocks', 'snow', 'ice', 'salt',
]);
const PAVED_HIGHWAY = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service',
  'living_street', 'cycleway', 'footway', 'pedestrian', 'road', 'busway', 'motorway_link', 'trunk_link',
  'primary_link', 'secondary_link', 'tertiary_link',
]);
const UNPAVED_HIGHWAY = new Set(['path', 'track', 'bridleway']);
const ROAD_HIGHWAY = new Set([
  'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk', 'primary_link',
  'secondary_link', 'tertiary_link', 'trunk_link',
]);
/** Vias que nunca são o chão de uma pedalada. */
export const SURFACE_SKIP_HIGHWAY = new Set([
  'steps', 'platform', 'corridor', 'elevator', 'proposed', 'construction', 'abandoned', 'razed',
  'bus_stop', 'services', 'rest_area', 'raceway',
]);

/** `surface=sett;concrete_plates` → `sett`; `paving_stones:30` → `paving_stones`. */
function baseSurface(raw: string): string {
  const first = raw.split(';')[0].trim().toLowerCase();
  if (SMOOTH.has(first) || STONES.has(first) || COBBLE.has(first) || GRAVEL.has(first) || ROUGH.has(first)) return first;
  return first.split(':')[0];
}

export function classifyOsmTags(tags: OsmTags): { cat: SurfaceCategory; inferred: boolean } {
  const s = tags['surface'];
  if (s) {
    const b = baseSurface(s);
    if (SMOOTH.has(b)) return { cat: 'liso', inferred: false };
    if (STONES.has(b)) return { cat: 'blocos', inferred: false };
    if (COBBLE.has(b)) return { cat: 'pave', inferred: false };
    if (GRAVEL.has(b)) return { cat: 'cascalho', inferred: false };
    if (ROUGH.has(b)) return { cat: 'terra', inferred: false };
    // Tag existe mas é exótica: melhor "não sei" honesto do que chute.
    return { cat: 'desconhecido', inferred: true };
  }
  const tt = tags['tracktype'];
  if (tt === 'grade1') return { cat: 'liso', inferred: true };
  if (tt === 'grade2') return { cat: 'cascalho', inferred: true };
  if (tt === 'grade3' || tt === 'grade4' || tt === 'grade5') return { cat: 'terra', inferred: true };
  const hw = tags['highway'] ?? '';
  if (PAVED_HIGHWAY.has(hw)) return { cat: 'liso', inferred: true };
  if (UNPAVED_HIGHWAY.has(hw)) return { cat: 'terra', inferred: true };
  return { cat: 'desconhecido', inferred: true };
}

/* ───────────────────────── geometria ───────────────────────── */

export interface LatLng {
  lat: number;
  lng: number;
}
export interface OsmWay {
  tags: OsmTags;
  /** Vértices em ordem. */
  geometry: readonly LatLng[];
}

/** Privada de propósito: o núcleo já exporta um `haversineM` com outra assinatura (fitness). */
function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distância planar aproximada (m) do ponto ao segmento — suficiente a 25 m. */
export function pointToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * cosLat, py = p.lat;
  const ax = a.lng * cosLat, ay = a.lat;
  const bx = b.lng * cosLat, by = b.lat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy) * 111320;
}

export function pointToWayM(p: LatLng, way: OsmWay): number {
  const g = way.geometry;
  if (g.length === 0) return Infinity;
  if (g.length === 1) return haversineM(p, g[0]);
  let best = Infinity;
  for (let i = 0; i < g.length - 1; i++) {
    const d = pointToSegmentM(p, g[i], g[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function isSidewalk(w: OsmWay): boolean {
  return w.tags['footway'] === 'sidewalk';
}
function isCycleway(w: OsmWay): boolean {
  const hw = w.tags['highway'];
  return hw === 'cycleway' || (w.tags['bicycle'] === 'designated' && (hw === 'path' || hw === 'footway'));
}

export interface WayMatch {
  way: OsmWay;
  distM: number;
}

/**
 * A via de um ponto, entre as que estão a até `radiusM`.
 *  1. Vias que não são chão (escadas, plataformas…) saem.
 *  2. Calçada (`footway=sidewalk`) só se não houver mais nada — o ciclista está na rua.
 *  3. Se a mais próxima é rua de carro e há ciclovia a até `preferM`, a ciclovia
 *     vence: o GPS erra mais do que a distância entre as duas.
 * Devolve null sem candidato.
 */
export function pickWay(
  p: LatLng,
  ways: readonly OsmWay[],
  radiusM = SURFACE_MATCH_RADIUS_M,
  preferM = SURFACE_CYCLEWAY_PREFER_M,
): WayMatch | null {
  const cands: WayMatch[] = [];
  for (const way of ways) {
    const hw = way.tags['highway'];
    if (!hw || SURFACE_SKIP_HIGHWAY.has(hw)) continue;
    const distM = pointToWayM(p, way);
    if (distM <= radiusM) cands.push({ way, distM });
  }
  if (cands.length === 0) return null;
  cands.sort((x, y) => x.distM - y.distM);
  const nonSide = cands.filter((c) => !isSidewalk(c.way));
  const pool = nonSide.length > 0 ? nonSide : cands;
  const first = pool[0];
  if (ROAD_HIGHWAY.has(first.way.tags['highway'] ?? '')) {
    const cycle = pool.find((c) => c.distM <= preferM && isCycleway(c.way));
    if (cycle) return cycle;
  }
  return first;
}

/* ───────────────────────── amostragem e segmentos ───────────────────────── */

export interface SurfaceSample {
  point: LatLng;
  startM: number;
  endM: number;
}

/**
 * Uma amostra a cada ~`spacingM` ao longo dos pontos, com o trecho de rota que
 * ela representa ([startM, endM]). Um salto maior que `gapM` entre pontos
 * consecutivos é GPS perdido: o trecho entra na conta como "desconhecido" em vez
 * de ser atribuído à via mais próxima do ponto que sobreviveu.
 */
export function sampleRoute(
  points: readonly LatLng[],
  spacingM = SURFACE_SAMPLE_SPACING_M,
  gapM = SURFACE_GAP_M,
): { samples: SurfaceSample[]; gaps: Array<[number, number]>; lengthM: number } {
  const samples: SurfaceSample[] = [];
  const gaps: Array<[number, number]> = [];
  if (points.length === 0) return { samples, gaps, lengthM: 0 };
  let acc = 0;
  let cursor = 0; // início do trecho da amostra corrente
  let current: LatLng = points[0];
  for (let i = 1; i < points.length; i++) {
    const d = haversineM(points[i - 1], points[i]);
    if (d > gapM) {
      // fecha a amostra corrente no ponto anterior e registra o buraco
      if (acc > cursor) samples.push({ point: current, startM: cursor, endM: acc });
      gaps.push([acc, acc + d]);
      acc += d;
      cursor = acc;
      current = points[i];
      continue;
    }
    acc += d;
    if (acc - cursor >= spacingM) {
      samples.push({ point: current, startM: cursor, endM: acc });
      cursor = acc;
      current = points[i];
    }
  }
  if (acc > cursor || samples.length === 0) samples.push({ point: current, startM: cursor, endM: acc });
  return { samples, gaps, lengthM: acc };
}

export interface ClassifiedSample {
  startM: number;
  endM: number;
  cat: SurfaceCategory;
  inferred: boolean;
}

/** Trechos contíguos com a mesma (categoria, inferido) viram um segmento só. */
export function segmentsFromSamples(samples: readonly ClassifiedSample[]): SurfaceSegment[] {
  const out: SurfaceSegment[] = [];
  const sorted = [...samples].sort((a, b) => a.startM - b.startM);
  for (const s of sorted) {
    const last = out[out.length - 1];
    const inf: 0 | 1 = s.inferred ? 1 : 0;
    if (last && last[2] === s.cat && last[3] === inf && Math.abs(last[1] - s.startM) < 1) {
      last[1] = Math.round(s.endM);
    } else {
      out.push([Math.round(s.startM), Math.round(s.endM), s.cat, inf]);
    }
  }
  return out;
}

export function surfaceMix(segments: readonly SurfaceSegment[]): SurfaceMix {
  const mix: SurfaceMix = { liso: 0, blocos: 0, pave: 0, cascalho: 0, terra: 0, desconhecido: 0, inferido: 0, total: 0 };
  for (const [a, b, cat, inf] of segments) {
    const len = Math.max(0, b - a);
    mix[cat] += len;
    if (inf) mix.inferido += len;
    mix.total += len;
  }
  return mix;
}

/** Fração 0–1 por categoria; tudo zero quando não há rota. */
export function surfaceShares(mix: SurfaceMix): Record<SurfaceCategory, number> {
  const t = mix.total || 1;
  return {
    liso: mix.liso / t,
    blocos: mix.blocos / t,
    pave: mix.pave / t,
    cascalho: mix.cascalho / t,
    terra: mix.terra / t,
    desconhecido: mix.desconhecido / t,
  };
}

/** Soma de várias rotas — a visão global por período ou por bicicleta. */
export function sumSurfaceMix(mixes: readonly (SurfaceMix | undefined | null)[]): SurfaceMix {
  const acc: SurfaceMix = { liso: 0, blocos: 0, pave: 0, cascalho: 0, terra: 0, desconhecido: 0, inferido: 0, total: 0 };
  for (const m of mixes) {
    if (!m) continue;
    acc.liso += m.liso; acc.blocos += m.blocos; acc.pave += m.pave; acc.cascalho += m.cascalho;
    acc.terra += m.terra; acc.desconhecido += m.desconhecido; acc.inferido += m.inferido; acc.total += m.total;
  }
  return acc;
}
