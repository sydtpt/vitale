/**
 * De que país é um ponto — pela fronteira de verdade, não por aproximação.
 *
 * Nasceu porque o rateio por país (`country-explorer`) decidia o lado da
 * fronteira pela cidade mais próxima: entre Aachen (DE) e Vaals (NL), a
 * bissetriz cai ~2 km dentro da Alemanha, e o traçado do mapa era cortado no
 * meio da estrada errada. Aqui o teste é ponto-em-polígono contra o contorno
 * real ([`country-borders.data.ts`](./country-borders.data.ts), gerado).
 *
 * Barato o bastante para rodar por ponto de rota: os candidatos vêm das cidades
 * da própria atividade (quase sempre 2 países), cada país é decodificado no
 * primeiro uso e fica em cache, e o bbox de cada anel descarta a maioria dos
 * testes antes de percorrer vértice nenhum.
 */

import { COUNTRY_BORDER_RINGS } from './country-borders.data';

/** Precisão da codificação: 4 casas decimais (~11 m). */
const PRECISION = 1e4;

/** Anel decodificado: vértices achatados `[lng, lat, lng, lat, …]` + bbox. */
interface Ring {
  points: Float64Array;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Decide o país de um ponto entre os candidatos dados. `null` quando nenhum o
 * contém (ponto no mar, país fora do dataset, fronteira que o contorno não
 * resolve) — aí o chamador decide o fallback.
 */
export type CountryResolver = (
  lng: number,
  lat: number,
  candidates: readonly string[],
) => string | null;

const cache = new Map<string, readonly Ring[]>();

/** Varint zigzag base64 (polyline do Google) → anéis com bbox. */
function decodeRing(encoded: string): Ring {
  const coords: number[] = [];
  let i = 0;
  let x = 0;
  let y = 0;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  while (i < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    x += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    y += result & 1 ? ~(result >> 1) : result >> 1;

    const lng = x / PRECISION;
    const lat = y / PRECISION;
    coords.push(lng, lat);
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { points: Float64Array.from(coords), minLng, minLat, maxLng, maxLat };
}

function ringsOf(code: string): readonly Ring[] {
  const cached = cache.get(code);
  if (cached) return cached;
  const rings = (COUNTRY_BORDER_RINGS[code] ?? []).map(decodeRing);
  cache.set(code, rings);
  return rings;
}

/** Ray casting clássico sobre o anel achatado. */
function inRing(ring: Ring, lng: number, lat: number): boolean {
  if (lng < ring.minLng || lng > ring.maxLng || lat < ring.minLat || lat > ring.maxLat) {
    return false;
  }
  const p = ring.points;
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i];
    const yi = p[i + 1];
    const xj = p[j];
    const yj = p[j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Este país conhece fronteiras? (nem todo código do histórico está no asset) */
export function hasCountryBorder(code: string): boolean {
  return COUNTRY_BORDER_RINGS[code.toUpperCase()] !== undefined;
}

/**
 * O país do ponto, entre os candidatos. Testa na ordem dada e devolve o
 * primeiro que contém o ponto — os candidatos são países distintos, então não
 * há empate a desfazer (as fronteiras não se sobrepõem).
 */
export const countryAt: CountryResolver = (lng, lat, candidates) => {
  for (const code of candidates) {
    for (const ring of ringsOf(code.toUpperCase())) {
      if (inRing(ring, lng, lat)) return code.toUpperCase();
    }
  }
  return null;
};
