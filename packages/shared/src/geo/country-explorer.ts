/**
 * Agregação das atividades por país já visitado — insumo puro da visão
 * "Visão detalhada" (mapa-por-pais). Só depende dos modelos e do dataset de
 * bboxes; sem I/O nem framework, então web e mobile consomem a mesma lógica
 * via `@vitale/shared`, e os testes rodam sem mock.
 *
 * Duas questões que este módulo responde:
 *  - A quais países pertence uma `CityMark`? → `countryForCity` (código direto,
 *    com fallback geométrico por bbox ± buffer p/ marcas antigas sem código).
 *  - Dadas as atividades do usuário, o que mostrar por país? → resumo p/ a grade
 *    de seleção, cidades distintas cruzadas, e o enquadramento do mapa.
 */

import type { Activity, ActivityRoutePoint, CityMark } from '../models/index';
import { COUNTRY_BBOXES, countryName, flagEmoji, type Bbox } from '../constants/country-bboxes';

/** Buffer (km) além da borda do país onde ainda consideramos que a rota/cidade
 *  "pertence" à visão daquele país — cobre rotas que cruzam a fronteira. */
export const MAX_BORDER_BUFFER_KM = 50;

/** Bounds no formato do Leaflet: `[[sul, oeste], [norte, leste]]`. */
export type ViewportBounds = [[number, number], [number, number]];

/** Resumo de um país no histórico — uma célula da grade de seleção + cabeçalho. */
export interface CountrySummary {
  /** ISO2 maiúsculo. */
  code: string;
  name: string;
  flag: string;
  rideCount: number;
  distanceM: number;
  /** ISO do treino mais recente que cruzou o país. */
  lastRideAt: string;
}

/** Cidade agregada dentro de um país — uma linha da lista de cidades. */
export interface CountryCityMark extends CityMark {
  /** Quantas atividades passaram por esta cidade (dedupe por nome). */
  visitCount: number;
}

/* ───────────────────────────── geometria ───────────────────────────── */

/** Graus de latitude para uma distância em km (constante: ~111 km/grau). */
function kmToLatDeg(km: number): number {
  return km / 111;
}

/** Graus de longitude para uma distância em km na latitude dada (encolhe com o cos). */
function kmToLngDeg(km: number, atLat: number): number {
  const cos = Math.cos((atLat * Math.PI) / 180);
  return km / (111 * Math.max(0.01, Math.abs(cos)));
}

/** `[lng, lat]` está dentro do bbox esticado `bufferKm` em todos os lados? */
function inBbox(lng: number, lat: number, bbox: Bbox, bufferKm: number): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const dLat = kmToLatDeg(bufferKm);
  const dLng = kmToLngDeg(bufferKm, lat);
  return (
    lat >= minLat - dLat &&
    lat <= maxLat + dLat &&
    lng >= minLng - dLng &&
    lng <= maxLng + dLng
  );
}

/**
 * País de uma marca. Critério 1 (preferido): `countryCode` explícito — direto,
 * sem geometria, robusto em fronteiras. Critério 2 (fallback p/ marcas antigas
 * sem código): o único bbox conhecido, esticado pelo buffer, que a contém.
 * `null` quando nenhum critério resolve.
 */
export function countryForCity(city: CityMark): string | null {
  const code = city.countryCode?.toUpperCase();
  if (code && COUNTRY_BBOXES[code]) return code;
  if (code) return code; // código presente mas fora do dataset — ainda agrupa por ele

  for (const [c, info] of Object.entries(COUNTRY_BBOXES)) {
    if (inBbox(city.lng, city.lat, info.bbox, MAX_BORDER_BUFFER_KM)) return c;
  }
  return null;
}

/** A marca pertence à visão do país `code` (código igual OU dentro do bbox±buffer)? */
function cityBelongsToCountry(city: CityMark, code: string): boolean {
  if (city.countryCode?.toUpperCase() === code) {
    const info = COUNTRY_BBOXES[code];
    // Com dataset: exige também cair no bbox±buffer (descarta ponto de fronteira
    // que o Nominatim rotulou no país mas está longe da caixa). Sem dataset:
    // confia só no código.
    return info ? inBbox(city.lng, city.lat, info.bbox, MAX_BORDER_BUFFER_KM) : true;
  }
  const info = COUNTRY_BBOXES[code];
  return info ? inBbox(city.lng, city.lat, info.bbox, MAX_BORDER_BUFFER_KM) : false;
}

/* ─────────────────────────── agregações ─────────────────────────── */

/** Códigos de país distintos cruzados por uma atividade (via suas `cities`). */
function countriesOf(activity: Activity): Set<string> {
  const set = new Set<string>();
  for (const city of activity.cities ?? []) {
    const c = countryForCity(city);
    if (c) set.add(c);
  }
  return set;
}

/**
 * Resumo por país das atividades dadas (já filtradas para o tipo desejado pelo
 * chamador). Uma atividade que cruza N países conta em cada um deles. Ignora
 * atividades sem `cities`. Ordenado por nº de pedaladas (desc), depois por nome.
 */
export function ridesByCountry(activities: readonly Activity[]): CountrySummary[] {
  const acc = new Map<string, { rideCount: number; distanceM: number; lastRideAt: string }>();
  for (const a of activities) {
    for (const code of countriesOf(a)) {
      const cur = acc.get(code) ?? { rideCount: 0, distanceM: 0, lastRideAt: '' };
      cur.rideCount += 1;
      cur.distanceM += a.distanceM ?? 0;
      if (a.startAt > cur.lastRideAt) cur.lastRideAt = a.startAt;
      acc.set(code, cur);
    }
  }
  return [...acc.entries()]
    .map(([code, v]) => ({
      code,
      name: countryName(code),
      flag: flagEmoji(code),
      rideCount: v.rideCount,
      distanceM: v.distanceM,
      lastRideAt: v.lastRideAt,
    }))
    .sort((x, y) => y.rideCount - x.rideCount || x.name.localeCompare(y.name));
}

/** Atividades cujas `cities` cruzam o país `code`, mais recentes primeiro. */
export function activitiesInCountry(activities: readonly Activity[], code: string): Activity[] {
  const target = code.toUpperCase();
  return activities
    .filter((a) => countriesOf(a).has(target))
    .sort((x, y) => (x.startAt < y.startAt ? 1 : x.startAt > y.startAt ? -1 : 0));
}

/** Normaliza nome de cidade p/ dedupe: sem acento, minúsculo, sem espaço extra. */
function normalizeCity(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Cidades distintas do país, dedupe por nome normalizado somando `visitCount`.
 * Uma cidade só entra se cair dentro do território do país ± buffer — assim uma
 * rota que entrou fundo no país vizinho não polui a lista deste país. Ordenadas
 * alfabeticamente pelo nome exibido.
 */
export function citiesInCountry(activities: readonly Activity[], code: string): CountryCityMark[] {
  const target = code.toUpperCase();
  const byKey = new Map<string, CountryCityMark>();
  for (const a of activities) {
    // Uma atividade conta no máx. 1 visita por cidade (dedupe intra-atividade).
    const seenInActivity = new Set<string>();
    for (const city of a.cities ?? []) {
      if (!cityBelongsToCountry(city, target)) continue;
      const key = normalizeCity(city.name);
      if (!key || seenInActivity.has(key)) continue;
      seenInActivity.add(key);
      const existing = byKey.get(key);
      if (existing) existing.visitCount += 1;
      else byKey.set(key, { ...city, visitCount: 1 });
    }
  }
  return [...byKey.values()].sort((x, y) => x.name.localeCompare(y.name));
}

/* ─────────────────────────── enquadramento ─────────────────────────── */

/**
 * Enquadramento inicial do mapa do país. Piso = bbox do país (a vista nunca fica
 * menor que o território). Para cada ponto de cada rota que ultrapassa a borda
 * mas ainda está dentro do buffer, estica o lado correspondente até esse ponto —
 * nunca além do buffer (pontos mais distantes, ex. GPS esquecido ligado numa
 * viagem, ficam fora do enquadramento por design). Retorna `null` quando `code`
 * não está no dataset (o chamador cai num fitBounds só das rotas).
 */
export function countryViewport(
  code: string,
  routes: readonly (readonly ActivityRoutePoint[])[],
): ViewportBounds | null {
  const info = COUNTRY_BBOXES[code.toUpperCase()];
  if (!info) return null;
  let [minLng, minLat, maxLng, maxLat] = info.bbox;

  for (const route of routes) {
    for (const p of route) {
      if (!inBbox(p.lng, p.lat, info.bbox, MAX_BORDER_BUFFER_KM)) continue;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
