/**
 * Agregação das atividades por país já visitado — insumo puro da visão
 * "Visão detalhada" (mapa-por-pais). Só depende dos modelos e do dataset de
 * bboxes; sem I/O nem framework, então web e mobile consomem a mesma lógica
 * via `@vitale/shared`, e os testes rodam sem mock.
 *
 * Três questões que este módulo responde:
 *  - A quais países pertence uma `CityMark`? → `countryForCity` (código direto,
 *    com fallback geométrico por bbox ± buffer p/ marcas antigas sem código).
 *  - Dadas as atividades do usuário, o que mostrar por país? → resumo p/ a grade
 *    de seleção, cidades distintas cruzadas, e o enquadramento do mapa.
 *  - Quanto de uma pedalada aconteceu DENTRO de um país? → `countryShares`, para
 *    que uma rota que cruza a fronteira não conte inteira nos dois lados.
 */

import type { Activity, ActivityRoutePoint, CityMark } from '../models/index';
import { COUNTRY_BBOXES, countryName, flagEmoji, type Bbox } from '../constants/country-bboxes';
import type { CountryResolver } from './country-borders';
import { haversineM } from './distance';

/** Buffer (km) além da borda do país onde ainda consideramos que a rota/cidade
 *  "pertence" à visão daquele país — cobre rotas que cruzam a fronteira. */
export const MAX_BORDER_BUFFER_KM = 50;

/** Span mínimo (km) do enquadramento — evita over-zoom numa rota minúscula ou
 *  degenerada (poucos pontos quase coincidentes). */
export const MIN_VIEWPORT_SPAN_KM = 2;

/** Margem de respiro proporcional somada a cada lado do bbox das rotas, além do
 *  padding em px do `fitBounds` — a rota não cola nas bordas. */
const VIEWPORT_MARGIN = 0.08;

/** Bounds no formato do Leaflet: `[[sul, oeste], [norte, leste]]`. */
export type ViewportBounds = [[number, number], [number, number]];

/** Resumo de um país no histórico — uma célula da grade de seleção + cabeçalho. */
export interface CountrySummary {
  /** ISO2 maiúsculo. */
  code: string;
  name: string;
  flag: string;
  rideCount: number;
  /** Distância dentro do país (m), rateada por contagem de cidades — a grade é
   *  desenhada antes das rotas carregarem, então o rateio fino não cabe aqui. */
  distanceM: number;
  /** ISO do treino mais recente que cruzou o país. */
  lastRideAt: string;
}

/** Cidade agregada dentro de um país — uma linha da lista de cidades. */
export interface CountryCityMark extends CityMark {
  /** Quantas atividades passaram por esta cidade (dedupe por nome). */
  visitCount: number;
}

/**
 * Agregados de todas as pedaladas de um país — a faixa de estatísticas. Todo
 * volume aqui é **rateado**: só a parte que aconteceu dentro do país conta (ver
 * `countryShares`). `rideCount` é a exceção — ver o campo.
 */
export interface CountryStats {
  /** Pedaladas que passaram pelo país. NÃO é rateado: uma pedalada que cruzou a
   *  fronteira conta como 1 em cada país, porque aconteceu nos dois. */
  rideCount: number;
  /** Soma das distâncias percorridas dentro do país (m). */
  distanceM: number;
  /** Soma do ganho de elevação (m) atribuído ao país; sem elevação conta 0. */
  elevationM: number;
  /** Soma do tempo em movimento (s) no país, com fallback para `durationS`. */
  movingTimeS: number;
  /** Soma das calorias (kcal) atribuídas ao país. */
  calories: number;
  /** Maior trecho dentro do país numa única pedalada (m) — não a maior pedalada. */
  longestRideM: number;
  /** Maior ganho de elevação atribuído ao país numa única pedalada (m). */
  maxClimbM: number;
  /** Velocidade média (km/h), derivada dos totais (não a média das médias). */
  avgSpeedKmh: number;
  /** ISO da pedalada mais recente. */
  lastRideAt: string;
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

/**
 * A cidade pertence estritamente ao país `code`? Com `countryCode` presente, só
 * pertence se o código bater — assim a lista de um país NÃO mostra cidades de
 * outro (ex.: uma cidade francesa próxima da fronteira, que uma rota cruzou, não
 * aparece na lista da Bélgica). Sem código (marcas antigas, pré-enriquecimento),
 * cai no teste geométrico por bbox ± buffer.
 */
function cityBelongsToCountry(city: CityMark, code: string): boolean {
  const cc = city.countryCode?.toUpperCase();
  if (cc) return cc === code;
  const info = COUNTRY_BBOXES[code];
  return info ? inBbox(city.lng, city.lat, info.bbox, MAX_BORDER_BUFFER_KM) : false;
}

/** Códigos de país distintos cruzados por uma atividade (via suas `cities`). */
function countriesOf(activity: Activity): Set<string> {
  const set = new Set<string>();
  for (const city of activity.cities ?? []) {
    const c = countryForCity(city);
    if (c) set.add(c);
  }
  return set;
}

/* ─────────────────────────── rateio por país ─────────────────────────── */

/** Cidade da atividade com país resolvido — os pontos de referência do rateio. */
interface CityAnchor {
  lat: number;
  lng: number;
  code: string;
}

/** Cidades da atividade cujo país foi possível resolver, na ordem da rota. */
function cityAnchors(activity: Activity): CityAnchor[] {
  const out: CityAnchor[] = [];
  for (const city of activity.cities ?? []) {
    const code = countryForCity(city);
    if (code) out.push({ lat: city.lat, lng: city.lng, code });
  }
  return out;
}

/**
 * País da cidade mais próxima do ponto — a fronteira efetiva usada no rateio.
 * Distância planar com a longitude encolhida pelo cos(lat): só precisamos da
 * ORDEM entre candidatos, e nessas escalas ela é a mesma do haversine (que
 * custaria um trig por cidade e por segmento da rota).
 */
function nearestCityCountry(anchors: readonly CityAnchor[], lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const a of anchors) {
    const dLat = a.lat - lat;
    const dLng = (a.lng - lng) * cos;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = a.code;
    }
  }
  return best;
}

/**
 * Fração da atividade no país por CONTAGEM DE CIDADES — o fallback de quando a
 * rota não está disponível (ainda carregando, ou pedalada sem GPS). Conta as
 * marcas repetidas: passar duas vezes pela mesma cidade é, grosso modo, mais
 * tempo ali. Aproximação grosseira (cidades não são igualmente espaçadas), mas
 * mantém a soma das frações de uma atividade em 1.
 */
function cityShare(activity: Activity, code: string): number {
  const anchors = cityAnchors(activity);
  if (anchors.length === 0) return 0;
  const hits = anchors.filter((a) => a.code === code).length;
  return hits / anchors.length;
}

/**
 * Classificador de um ponto da rota desta atividade. Com um `resolve` (o
 * `countryAt`, que testa o contorno real do país) a fronteira é a de verdade;
 * sem ele — ou quando o contorno não decide, p.ex. um ponto sobre a água — cai
 * na cidade mais próxima.
 *
 * O fallback nunca é bom perto da fronteira: entre Aachen (DE) e Vaals (NL) a
 * bissetriz das duas cidades corre ~2 km dentro da Alemanha. Por isso `resolve`
 * existe. Também não dá para usar `inBbox`: com `MAX_BORDER_BUFFER_KM` os bboxes
 * de países vizinhos se sobrepõem exatamente na faixa que interessa.
 */
function pointClassifier(
  activity: Activity,
  candidates: readonly string[],
  resolve?: CountryResolver,
): (lng: number, lat: number) => string | null {
  const anchors = cityAnchors(activity);
  return (lng, lat) => {
    if (resolve) {
      const hit = resolve(lng, lat, candidates);
      if (hit) return hit;
    }
    return nearestCityCountry(anchors, lat, lng);
  };
}

function lerpPoint(
  a: ActivityRoutePoint,
  b: ActivityRoutePoint,
  t: number,
): ActivityRoutePoint {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Iterações da bissecção do cruzamento: 20 deixam o corte em ~1/1.000.000 do
 *  segmento (centímetros), ordens de grandeza abaixo do ruído do GPS. Custo
 *  constante e só nos poucos segmentos que cruzam a fronteira. */
const CROSSING_STEPS = 20;

/**
 * Onde, entre `a` e `b`, a rota cruza a fronteira — como fração de 0 a 1.
 * Bissecção sobre o próprio classificador: vale tanto para o contorno real
 * quanto para o fallback por cidade (onde o "cruzamento" é a bissetriz).
 */
function crossingFraction(
  a: ActivityRoutePoint,
  b: ActivityRoutePoint,
  isInside: (p: ActivityRoutePoint) => boolean,
): number {
  const aInside = isInside(a);
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < CROSSING_STEPS; k++) {
    const mid = (lo + hi) / 2;
    if (isInside(lerpPoint(a, b, mid)) === aInside) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Quanto da rota ficou no país e quais trechos são esses. */
interface CountryLegs {
  /** Trechos contíguos dentro do país, já cortados na fronteira (≥2 pontos). */
  pieces: ActivityRoutePoint[][];
  /** Metros dentro do país. */
  inCountryM: number;
  /** Metros totais da rota. */
  totalM: number;
}

/**
 * Percorre a rota classificando ponto a ponto e corta na fronteira: uma única
 * passada que responde as duas perguntas da feature — quanto foi pedalado no
 * país (o rateio) e que linhas desenhar nele (o recorte). Segmentos que cruzam
 * entram partidos, com o ponto de cruzamento interpolado.
 *
 * `null` quando não há como classificar (rota curta demais, ou nem contorno nem
 * cidade resolvida) — o chamador cai no rateio por contagem de cidades.
 */
function splitRoute(
  activity: Activity,
  route: readonly ActivityRoutePoint[],
  code: string,
  candidates: readonly string[],
  resolve?: CountryResolver,
): CountryLegs | null {
  if (route.length < 2) return null;
  if (!resolve && cityAnchors(activity).length === 0) return null;

  const classify = pointClassifier(activity, candidates, resolve);
  const isInside = (p: ActivityRoutePoint) => classify(p.lng, p.lat) === code;

  const pieces: ActivityRoutePoint[][] = [];
  let current: ActivityRoutePoint[] = [];
  let inCountryM = 0;
  let totalM = 0;

  const closePiece = () => {
    if (current.length >= 2) pieces.push(current);
    current = [];
  };

  /** Evita vértice duplicado quando a fronteira cai em cima de um ponto da rota
   *  (o interpolado e o original coincidem) — segmento de comprimento zero. */
  const pushPoint = (p: ActivityRoutePoint) => {
    const last = current[current.length - 1];
    if (last && Math.abs(last.lat - p.lat) < 1e-7 && Math.abs(last.lng - p.lng) < 1e-7) return;
    current.push(p);
  };

  let prevInside = isInside(route[0]);
  if (prevInside) current.push(route[0]);

  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const cur = route[i];
    const len = haversineM(prev.lat, prev.lng, cur.lat, cur.lng);
    totalM += len;
    const curInside = isInside(cur);

    if (curInside === prevInside) {
      if (curInside) {
        inCountryM += len;
        pushPoint(cur);
      }
    } else {
      const t = crossingFraction(prev, cur, isInside);
      const border = lerpPoint(prev, cur, t);
      if (prevInside) {
        inCountryM += len * t;
        pushPoint(border);
        closePiece();
      } else {
        inCountryM += len * (1 - t);
        current = [border];
        pushPoint(cur);
      }
    }
    prevInside = curInside;
  }
  closePiece();

  return { pieces, inCountryM, totalM };
}

/**
 * Fração (0..1) de cada atividade que aconteceu dentro de `code`, indexada por
 * `activity.id` — o insumo que faz uma pedalada cross-border parar de contar
 * inteira nos dois países. Cascata do mais preciso ao mais barato:
 *
 *  1. Não cruzou o país → 0. Cruzou só ele → 1 (caso comum, nem olha a rota).
 *  2. Rota disponível → rateio geométrico (`splitRoute`), com a fronteira real
 *     quando `resolve` é dado.
 *  3. Sem rota → contagem de cidades (`cityShare`).
 *
 * Invariante: para uma mesma atividade, a soma das frações de todos os países
 * que ela cruza é 1 — nenhum metro se perde nem se duplica.
 *
 * `routes` é indexado por `activity.id`; ids ausentes caem no passo 3, o que faz
 * do carregamento assíncrono das rotas um refinamento (o número já nasce
 * aproximado e converge) em vez de um estado vazio.
 *
 * `resolve` (na prática o `countryAt`) é opcional de propósito: o asset de
 * fronteiras tem ~1 MB, e injetá-lo mantém este módulo puro e fora do bundle de
 * quem só quer os agregados.
 */
export function countryShares(
  activities: readonly Activity[],
  routes: ReadonlyMap<string, readonly ActivityRoutePoint[]>,
  code: string,
  resolve?: CountryResolver,
): Map<string, number> {
  const target = code.toUpperCase();
  const out = new Map<string, number>();
  for (const a of activities) {
    const countries = countriesOf(a);
    if (!countries.has(target)) {
      out.set(a.id, 0);
      continue;
    }
    if (countries.size === 1) {
      out.set(a.id, 1);
      continue;
    }
    const legs = splitRoute(a, routes.get(a.id) ?? [], target, [...countries], resolve);
    out.set(a.id, legs && legs.totalM > 0 ? legs.inCountryM / legs.totalM : cityShare(a, target));
  }
  return out;
}

/**
 * As linhas a desenhar no mapa do país: as rotas das atividades **recortadas**
 * ao território dele, pela mesma classificação do rateio. Sem isso o mapa de um
 * país mostraria inteira a rota que só passou por ele de raspão.
 *
 * O corte cai em cima da fronteira, não no ponto de rota mais próximo dela: o
 * segmento que cruza é partido no ponto interpolado (ver `crossingFraction`).
 *
 * O resultado é achatado (pedaços de todas as atividades numa lista só) porque é
 * o que mapa e enquadramento consomem — nenhum dos dois se importa com de qual
 * treino é cada linha. Uma rota que sai e volta ao país vira mais de um pedaço:
 * o corte é por trechos contíguos, não por atividade.
 *
 * Pedaços de um ponto só são descartados (nada a desenhar). Quando não dá para
 * atribuir — atividade de um país só, ou sem contorno nem cidade resolvida — a
 * rota entra inteira, que é o melhor palpite disponível.
 */
export function routesInCountry(
  activities: readonly Activity[],
  routes: ReadonlyMap<string, readonly ActivityRoutePoint[]>,
  code: string,
  resolve?: CountryResolver,
): ActivityRoutePoint[][] {
  const target = code.toUpperCase();
  const pieces: ActivityRoutePoint[][] = [];

  for (const a of activities) {
    const route = routes.get(a.id) ?? [];
    if (route.length < 2) continue;

    const countries = countriesOf(a);
    if (!countries.has(target)) continue;

    if (countries.size === 1) {
      pieces.push(route.slice());
      continue;
    }

    const legs = splitRoute(a, route, target, [...countries], resolve);
    if (legs) pieces.push(...legs.pieces);
    else pieces.push(route.slice());
  }

  return pieces;
}

/* ─────────────────────────── agregações ─────────────────────────── */

/**
 * Resumo por país das atividades dadas (já filtradas para o tipo desejado pelo
 * chamador). Uma atividade que cruza N países conta como 1 pedalada em cada um
 * — ela foi pedalada nos dois —, mas a distância entra **rateada**. Aqui o
 * rateio é sempre o de cidades: a grade de seleção é desenhada antes de qualquer
 * rota ser carregada. Ignora atividades sem `cities`. Ordenado por nº de
 * pedaladas (desc), depois por nome.
 */
export function ridesByCountry(activities: readonly Activity[]): CountrySummary[] {
  const acc = new Map<string, { rideCount: number; distanceM: number; lastRideAt: string }>();
  for (const a of activities) {
    for (const code of countriesOf(a)) {
      const cur = acc.get(code) ?? { rideCount: 0, distanceM: 0, lastRideAt: '' };
      cur.rideCount += 1;
      cur.distanceM += (a.distanceM ?? 0) * cityShare(a, code);
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

/**
 * Agregados das atividades do país (a faixa de estatísticas). Cada métrica de
 * volume entra multiplicada pela fração da atividade que aconteceu ali
 * (`shares`, de `countryShares`) — sem isso uma pedalada cross-border somaria
 * seus 85 km em cada um dos dois países. `rideCount` NÃO é rateado: a pedalada
 * aconteceu nos dois países e conta como 1 em cada.
 *
 * Subida, tempo e calorias são rateados pela mesma fração de DISTÂNCIA, não por
 * geometria própria: o `route_overview` que alimenta o rateio é só `[lat,lng]`,
 * sem altitude nem timestamp. Um trecho de 30% da distância num país plano leva
 * 30% da subida total mesmo que a serra tenha ficado do outro lado.
 *
 * Campos opcionais ausentes contam 0; `movingTimeS` cai para `durationS` por
 * atividade quando o tempo em movimento não veio no sync. `avgSpeedKmh` deriva
 * dos TOTAIS já rateados (não a média das médias), então pausas longas de uma
 * pedalada não distorcem o geral. `longestRideM`/`maxClimbM` são o maior TRECHO
 * dentro do país, não a maior pedalada inteira que passou por ele.
 */
export function countryStats(
  activities: readonly Activity[],
  shares: ReadonlyMap<string, number>,
): CountryStats {
  const s: CountryStats = {
    rideCount: activities.length,
    distanceM: 0,
    elevationM: 0,
    movingTimeS: 0,
    calories: 0,
    longestRideM: 0,
    maxClimbM: 0,
    avgSpeedKmh: 0,
    lastRideAt: '',
  };
  for (const a of activities) {
    // Sem fração conhecida, a atividade conta inteira — o chamador que monta o
    // mapa já filtrou para o país, então o caso é "pedalada de um país só".
    const share = shares.get(a.id) ?? 1;
    const dist = (a.distanceM ?? 0) * share;
    const climb = (a.elevationM ?? 0) * share;
    s.distanceM += dist;
    s.elevationM += climb;
    s.movingTimeS += (a.movingTimeS ?? a.durationS ?? 0) * share;
    s.calories += (a.calories ?? 0) * share;
    if (dist > s.longestRideM) s.longestRideM = dist;
    if (climb > s.maxClimbM) s.maxClimbM = climb;
    if (a.startAt > s.lastRideAt) s.lastRideAt = a.startAt;
  }
  s.avgSpeedKmh = s.movingTimeS > 0 ? s.distanceM / 1000 / (s.movingTimeS / 3600) : 0;
  return s;
}

/* ─────────────────────────── enquadramento ─────────────────────────── */

/**
 * Enquadramento inicial do mapa do país. Zoom proporcional às rotas: enquadra o
 * bbox dos pontos das rotas, com o tamanho do país como TETO (não piso) — o
 * filtro `inBbox(..., buffer)` só deixa entrar pontos dentro do país ± buffer,
 * então a vista nunca ultrapassa o território (pontos mais distantes, ex. GPS
 * esquecido ligado numa viagem, ficam de fora por design). Aplica um span mínimo
 * (anti over-zoom) e uma margem de respiro. Sem nenhum ponto válido (carregando,
 * ou país sem rotas resolvidas), cai no bbox do país inteiro. Retorna `null`
 * quando `code` não está no dataset (o chamador cai num fitBounds só das rotas).
 */
export function countryViewport(
  code: string,
  routes: readonly (readonly ActivityRoutePoint[])[],
): ViewportBounds | null {
  const info = COUNTRY_BBOXES[code.toUpperCase()];
  if (!info) return null;
  const [cMinLng, cMinLat, cMaxLng, cMaxLat] = info.bbox;

  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  let found = false;
  for (const route of routes) {
    for (const p of route) {
      if (!inBbox(p.lng, p.lat, info.bbox, MAX_BORDER_BUFFER_KM)) continue;
      found = true;
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
  }

  // Sem pontos válidos → país inteiro (fallback / carregando).
  if (!found) {
    return [
      [cMinLat, cMinLng],
      [cMaxLat, cMaxLng],
    ];
  }

  // Span mínimo (anti over-zoom) + margem de respiro, centrado no bbox das rotas.
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latSpan =
    Math.max(maxLat - minLat, kmToLatDeg(MIN_VIEWPORT_SPAN_KM)) * (1 + VIEWPORT_MARGIN);
  const lngSpan =
    Math.max(maxLng - minLng, kmToLngDeg(MIN_VIEWPORT_SPAN_KM, midLat)) * (1 + VIEWPORT_MARGIN);
  return [
    [midLat - latSpan / 2, midLng - lngSpan / 2],
    [midLat + latSpan / 2, midLng + lngSpan / 2],
  ];
}
