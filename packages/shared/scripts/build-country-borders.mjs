#!/usr/bin/env node
/**
 * Gera `src/geo/country-borders.data.ts` — os polígonos de fronteira usados para
 * decidir de que país é cada trecho de uma rota (feature mapa-por-pais).
 *
 * Rodar só quando `COUNTRY_BBOXES` ganhar países novos; o asset é estável e
 * fica versionado. O dataset de origem tem 120 MB, então NÃO é dependência do
 * repo — baixe na hora:
 *
 *   cd "$(mktemp -d)" && npm pack @geo-maps/countries-land-100m@0.6.0 \
 *     && tar xzf geo-maps-countries-land-100m-0.6.0.tgz
 *   node packages/shared/scripts/build-country-borders.mjs <dir>/package/map.geo.json
 *
 * Fonte: @geo-maps/countries-land-100m (ODbL/domínio público, ver LICENSE do
 * pacote), vértices a cada ~100 m, features com ISO alpha-3 em `properties.A3`.
 *
 * O que o script faz com 120 MB para caber em ~1 MB, sem perder o que importa:
 *  1. Fica só com os países do `COUNTRY_BBOXES` (o resto nunca é candidato).
 *  2. Descarta ilhotas com menos de 2 km de diagonal (não classificam rota).
 *  3. Preserva em resolução CHEIA todo vértice a ≤2 km de vértice de outro país
 *     — é fronteira terrestre, onde a precisão decide o corte. O litoral entre
 *     essas âncoras é simplificado a ~2 km: não separa nada de ninguém.
 *  4. Codifica cada anel como polyline (delta + varint base64, precisão 1e-4 ≈
 *     11 m), o que sozinho tira 3,7 MB → 0,93 MB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'geo', 'country-borders.data.ts');

/** ISO alpha-3 → alpha-2, só para os países do COUNTRY_BBOXES. */
const A2_OF_A3 = {
  ARG: 'AR', AUT: 'AT', AUS: 'AU', BEL: 'BE', BOL: 'BO', BRA: 'BR', CAN: 'CA',
  CHE: 'CH', CHL: 'CL', CHN: 'CN', COL: 'CO', CZE: 'CZ', DEU: 'DE', DNK: 'DK',
  ECU: 'EC', ESP: 'ES', FIN: 'FI', FRA: 'FR', GBR: 'GB', GRC: 'GR', HRV: 'HR',
  HUN: 'HU', IRL: 'IE', IND: 'IN', ISL: 'IS', ITA: 'IT', JPN: 'JP', LUX: 'LU',
  MEX: 'MX', NLD: 'NL', NOR: 'NO', NZL: 'NZ', PER: 'PE', POL: 'PL', PRT: 'PT',
  PRY: 'PY', ROU: 'RO', SWE: 'SE', SVN: 'SI', SVK: 'SK', USA: 'US', URY: 'UY',
  ZAF: 'ZA',
};

const CELL_DEG = 0.02; // ~2 km — granularidade da detecção de fronteira
const COAST_EPS = 0.02; // ~2 km — tolerância do litoral
const MIN_RING_KM = 2; // ilhota menor que isto não classifica rota
const PRECISION = 1e4; // 4 casas ≈ 11 m

const input = process.argv[2];
if (!input) {
  console.error('uso: build-country-borders.mjs <caminho do map.geo.json>');
  process.exit(1);
}

const wanted = new Set(Object.values(A2_OF_A3));
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));

// ── 1ª passada: que países ocupam cada célula da grade ──────────────────────
const cellKey = (x, y) => `${Math.floor(x / CELL_DEG)}:${Math.floor(y / CELL_DEG)}`;
const cells = new Map();
const countries = [];
for (const f of raw.features) {
  const a2 = A2_OF_A3[f.properties?.A3];
  if (!a2 || !wanted.has(a2)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = polys.map((p) => p[0]); // só o anel externo: buracos não mudam o lado da fronteira
  countries.push([a2, rings]);
  for (const ring of rings) {
    for (const [x, y] of ring) {
      const k = cellKey(x, y);
      let set = cells.get(k);
      if (!set) cells.set(k, (set = new Set()));
      set.add(a2);
    }
  }
}

/** Há vértice de OUTRO país a ≤1 célula daqui? Então isto é fronteira terrestre. */
function nearBorder(x, y, own) {
  const cx = Math.floor(x / CELL_DEG);
  const cy = Math.floor(y / CELL_DEG);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const set = cells.get(`${cx + dx}:${cy + dy}`);
      if (!set) continue;
      for (const c of set) if (c !== own) return true;
    }
  }
  return false;
}

/** Douglas–Peucker iterativo numa cadeia ABERTA (graus, planar). */
function simplifyChain(pts, eps) {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    if (i1 <= i0 + 1) continue;
    const [ax, ay] = pts[i0];
    const [bx, by] = pts[i1];
    const dx = bx - ax;
    const dy = by - ay;
    const den = Math.hypot(dx, dy);
    let maxD = -1;
    let idx = -1;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = pts[i];
      const d =
        den === 0 ? Math.hypot(px - ax, py - ay) : Math.abs(dy * (px - ax) - dx * (py - ay)) / den;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > i0) {
      keep[idx] = 1;
      stack.push([i0, idx], [idx, i1]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

function ringSpanKm(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.hypot((maxX - minX) * 111 * Math.cos((minY * Math.PI) / 180), (maxY - minY) * 111);
}

/** Anel puramente litorâneo: parte no ponto mais distante do primeiro, porque a
 *  linha base do DP num anel fechado (primeiro == último) é degenerada. */
function simplifyClosedRing(ring, eps) {
  const open = ring.slice(0, -1);
  if (open.length <= 4) return ring.slice();
  let far = 0;
  let farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  const a = simplifyChain(open.slice(0, far + 1), eps);
  const b = simplifyChain(open.slice(far).concat([open[0]]), eps);
  return a.slice(0, -1).concat(b);
}

/** Varint zigzag base64 (codificação polyline do Google). */
function encodeValue(v) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

function encodeRing(points) {
  let s = '';
  let px = 0;
  let py = 0;
  for (const [x, y] of points) {
    const ix = Math.round(x * PRECISION);
    const iy = Math.round(y * PRECISION);
    s += encodeValue(ix - px) + encodeValue(iy - py);
    px = ix;
    py = iy;
  }
  return s;
}

// ── 2ª passada: simplifica preservando fronteira e codifica ─────────────────
const out = {};
let totalPoints = 0;
let totalRings = 0;
for (const [a2, rings] of countries) {
  const kept = [];
  for (const ring of rings) {
    if (ringSpanKm(ring) < MIN_RING_KM) continue;

    const anchorIdx = [];
    for (let i = 0; i < ring.length; i++) {
      if (nearBorder(ring[i][0], ring[i][1], a2)) anchorIdx.push(i);
    }

    let simplified;
    if (anchorIdx.length < 2) {
      simplified = simplifyClosedRing(ring, COAST_EPS);
    } else {
      // Cada vão entre âncoras de fronteira é simplificado por si; as âncoras
      // (a fronteira em si) sobrevivem intactas.
      simplified = [];
      for (let a = 0; a < anchorIdx.length; a++) {
        const from = anchorIdx[a];
        const to = anchorIdx[(a + 1) % anchorIdx.length];
        const gap = [];
        for (let i = from; ; i = (i + 1) % ring.length) {
          gap.push(ring[i]);
          if (i === to) break;
        }
        const piece = gap.length > 2 ? simplifyChain(gap, COAST_EPS) : gap;
        simplified.push(...piece.slice(0, -1));
      }
      simplified.push(simplified[0]);
    }

    if (simplified.length < 4) continue;
    kept.push(encodeRing(simplified));
    totalRings++;
    totalPoints += simplified.length;
  }
  if (kept.length) out[a2] = kept;
}

const body = `/**
 * GERADO por \`scripts/build-country-borders.mjs\` — não editar à mão.
 *
 * Fronteiras dos países do \`COUNTRY_BBOXES\`, para decidir de que país é cada
 * trecho de rota. Cada país tem N anéis externos, codificados como polyline
 * (delta + varint base64, precisão 1e-4 ≈ 11 m). Fronteira terrestre em
 * resolução cheia (~100 m); litoral simplificado a ~2 km, que não separa
 * ninguém. Decodificação em \`country-borders.ts\`.
 *
 * Fonte: @geo-maps/countries-land-100m@0.6.0.
 * ${Object.keys(out).length} países · ${totalRings} anéis · ${totalPoints} vértices.
 */

export const COUNTRY_BORDER_RINGS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(
  out,
)};
`;

fs.writeFileSync(OUT, body);
console.log(
  `${OUT}\n${Object.keys(out).length} países · ${totalRings} anéis · ${totalPoints} vértices · ${(
    body.length /
    1024 /
    1024
  ).toFixed(2)} MB`,
);
