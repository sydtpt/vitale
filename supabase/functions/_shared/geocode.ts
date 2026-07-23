/**
 * Reverse-geocoding da rota GPS → lista ordenada de cidades atravessadas.
 *
 * Roda no ingest server-side (Deno). Amostra a rota de forma esparsa (por
 * distância acumulada) e resolve cada amostra no Nominatim, colapsando
 * duplicatas consecutivas — o objetivo é UMA marca por cidade, na ordem do
 * percurso, gastando poucas chamadas por rota (respeita o ~1 req/s do
 * Nominatim). Provider configurável por env (`GEOCODE_URL`), default Nominatim.
 *
 * Sem dependência do shared models/index.ts (imports extensionless não resolvem
 * no Deno) — a forma de `CityMark` é redefinida aqui, estruturalmente igual à do
 * shared, e persiste como jsonb em `activities.cities`.
 */

/** Ponto mínimo aceito (a rota persistida tem {lat,lng,alt?,t?}). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Uma cidade atravessada — espelha `CityMark` do shared. */
export interface CityMark {
  name: string;
  state?: string;
  country?: string;
  /** ISO 3166-1 alpha-2 maiúsculo (ex.: "BE"), do `country_code` do Nominatim —
   *  chave estável p/ agrupar por país, independente do idioma. */
  countryCode?: string;
  lat: number;
  lng: number;
}

const GEOCODE_URL = Deno.env.get('GEOCODE_URL') ?? 'https://nominatim.openstreetmap.org/reverse';
/** Nominatim exige um User-Agent identificável (política de uso). */
const GEOCODE_UA = Deno.env.get('GEOCODE_UA') ?? 'Orbe/1.0 (life-organizer)';

/** Espaçamento (m) entre amostras da rota — ~1.5 km cobre trocas de cidade. */
const SAMPLE_SPACING_M = 1500;
/** Teto de amostras por rota (limita chamadas ao geocoder por atividade). */
const MAX_SAMPLES = 40;
/** Intervalo entre chamadas (ms) — folga sobre o limite de ~1 req/s. */
const REQ_INTERVAL_MS = 1100;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Distância (m) entre dois pontos (haversine). */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Resolve uma coordenada em cidade. Lança em erro de rede/HTTP (o chamador
 * trata como transitório e tenta de novo). Devolve null quando o geocoder
 * responde OK mas sem cidade (ex.: ponto no mar). `lat`/`lng` devolvidos são os
 * do CENTRO da cidade (ponto representativo do município no Nominatim), não os
 * da amostra da rota — cai de volta na amostra se o centro vier ausente.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<CityMark | null> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '10'); // nível município/cidade
  url.searchParams.set('addressdetails', '1');
  // namedetails traz as variantes de nome por idioma (name:fr, name:nl…) — assim
  // localizamos a cidade na língua da região sem uma segunda chamada.
  url.searchParams.set('namedetails', '1');

  const res = await fetch(url, {
    headers: { 'User-Agent': GEOCODE_UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
  const body = await res.json();
  const a = body?.address;
  if (!a) return null;
  const base = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  const lang = preferredLang(a);
  const nd = body?.namedetails ?? {};
  const localized = lang ? nd[`name:${lang}`] : undefined;
  // Usa a variante localizada quando o nome padrão é bilíngue (ex.: Bruxelas,
  // "Bruxelles - Brussel") ou quando o objeto resolvido é a própria cidade —
  // evita trocar o nome da cidade pelo de um bairro em zooms ambíguos.
  const isBilingual = typeof base === 'string' && base.includes(' - ');
  const name = localized && (isBilingual || nd.name === base || !base) ? localized : base;
  if (!name) return null;
  // Âncora = centro da cidade (ponto representativo do município que o Nominatim
  // devolve no topo da resposta), não a amostra da rota.
  const centerLat = Number(body?.lat);
  const centerLng = Number(body?.lon);
  const hasCenter = Number.isFinite(centerLat) && Number.isFinite(centerLng);
  return {
    name: String(name),
    state: a.state ? String(a.state) : undefined,
    country: a.country ? String(a.country) : undefined,
    countryCode: a.country_code ? String(a.country_code).toUpperCase() : undefined,
    lat: hasCenter ? centerLat : lat,
    lng: hasCenter ? centerLng : lng,
  };
}

/**
 * Idioma preferido para os nomes, pela região do ponto (código ISO 3166-2 que o
 * Nominatim devolve em `addressdetails`). Bélgica: Flandres (BE-VLG) → nl;
 * Bruxelas (BE-BRU) e Valônia (BE-WAL) → fr. Fora das regiões mapeadas devolve
 * null: o nome padrão do OSM já vem no idioma local em regiões monolíngues.
 * Fácil de estender para outros países multilíngues (CH, CA…).
 */
function preferredLang(address: Record<string, unknown>): string | null {
  const iso = String(address['ISO3166-2-lvl4'] ?? '');
  if (iso === 'BE-VLG') return 'nl';
  if (iso === 'BE-BRU' || iso === 'BE-WAL') return 'fr';
  return null;
}

/**
 * Amostra a rota por distância acumulada, distribuindo o orçamento de amostras
 * pela rota INTEIRA: o espaçamento cresce em rotas longas para caber no teto de
 * `MAX_SAMPLES` — assim a segunda metade e o ponto final (cidade onde parou)
 * sempre entram, em vez de truncar nos primeiros ~60 km. Início e fim sempre
 * incluídos.
 */
function sampleByDistance(points: readonly GeoPoint[]): GeoPoint[] {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  // Nunca menor que SAMPLE_SPACING_M; aumenta para a rota inteira caber no teto.
  const spacing = Math.max(SAMPLE_SPACING_M, total / MAX_SAMPLES);
  const samples: GeoPoint[] = [points[0]];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += haversineM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    if (acc >= spacing) {
      samples.push(points[i]);
      acc = 0;
    }
  }
  const last = points[points.length - 1];
  if (samples[samples.length - 1] !== last) samples.push(last);
  return samples;
}

/**
 * Lista ordenada de cidades atravessadas pela rota. Colapsa duplicatas
 * consecutivas pelo nome (re-entradas em cidade já vista continuam a gerar uma
 * nova marca, como esperado). Lança se alguma chamada falhar (rede/rate-limit)
 * — o chamador deixa a atividade sem cities e tenta no próximo run.
 */
export async function citiesFromPoints(points: readonly GeoPoint[]): Promise<CityMark[]> {
  const clean = points.filter(
    (p) => typeof p?.lat === 'number' && typeof p?.lng === 'number',
  );
  if (clean.length < 2) return [];

  const samples = sampleByDistance(clean);
  const cities: CityMark[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (i > 0) await sleep(REQ_INTERVAL_MS);
    const c = await reverseGeocode(samples[i].lat, samples[i].lng);
    if (!c) continue;
    const prev = cities[cities.length - 1];
    if (prev && prev.name === c.name) continue;
    cities.push(c);
  }
  return cities;
}
