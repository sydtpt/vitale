/**
 * Bounding boxes aproximados por país (ISO 3166-1 alpha-2) + nome em pt-BR.
 *
 * Usado pela visão "por país" das atividades (mapa-por-pais): serve de piso
 * para o enquadramento do mapa (a vista nunca fica menor que o país) e de
 * classificador de fallback quando uma `CityMark` não tem `countryCode`
 * (testa lat/lng contra o bbox ± buffer). Precisão de bbox não é crítica —
 * é uma caixa, não a fronteira real; o buffer de ~50 km absorve a folga.
 *
 * FOLHA sem imports: importável do Deno, web e mobile via `@vitale/shared`.
 * Cresce sob demanda — só precisa cobrir países onde o usuário registrou rota.
 */

/** Bounding box geográfico: `[minLng, minLat, maxLng, maxLat]`. */
export type Bbox = [number, number, number, number];

export interface CountryInfo {
  /** Nome em pt-BR para exibição. */
  name: string;
  bbox: Bbox;
}

/**
 * Mapa ISO2 → país. Lista ampla de países comuns para o histórico de um
 * viajante; adicionar novos é trivial (só a linha). Valores aproximados —
 * conferidos para dar uma caixa que contém o território continental principal.
 */
export const COUNTRY_BBOXES: Record<string, CountryInfo> = {
  AR: { name: 'Argentina', bbox: [-73.58, -55.06, -53.64, -21.78] },
  AT: { name: 'Áustria', bbox: [9.53, 46.37, 17.16, 49.02] },
  AU: { name: 'Austrália', bbox: [112.92, -43.64, 153.64, -10.06] },
  BE: { name: 'Bélgica', bbox: [2.51, 49.5, 6.16, 51.51] },
  BO: { name: 'Bolívia', bbox: [-69.64, -22.9, -57.45, -9.68] },
  BR: { name: 'Brasil', bbox: [-73.99, -33.75, -28.84, 5.27] },
  CA: { name: 'Canadá', bbox: [-141.0, 41.68, -52.62, 83.11] },
  CH: { name: 'Suíça', bbox: [5.96, 45.82, 10.49, 47.81] },
  CL: { name: 'Chile', bbox: [-75.64, -55.98, -66.42, -17.51] },
  CN: { name: 'China', bbox: [73.5, 18.16, 134.77, 53.56] },
  CO: { name: 'Colômbia', bbox: [-79.0, -4.23, -66.87, 12.44] },
  CZ: { name: 'Tchéquia', bbox: [12.09, 48.55, 18.86, 51.06] },
  DE: { name: 'Alemanha', bbox: [5.87, 47.27, 15.04, 55.06] },
  DK: { name: 'Dinamarca', bbox: [8.07, 54.56, 12.69, 57.75] },
  EC: { name: 'Equador', bbox: [-81.08, -5.01, -75.19, 1.68] },
  ES: { name: 'Espanha', bbox: [-9.39, 35.95, 4.33, 43.75] },
  FI: { name: 'Finlândia', bbox: [20.55, 59.81, 31.59, 70.09] },
  FR: { name: 'França', bbox: [-5.14, 41.33, 9.56, 51.09] },
  GB: { name: 'Reino Unido', bbox: [-8.65, 49.86, 1.76, 60.86] },
  GR: { name: 'Grécia', bbox: [19.37, 34.8, 28.25, 41.75] },
  HR: { name: 'Croácia', bbox: [13.5, 42.4, 19.43, 46.55] },
  HU: { name: 'Hungria', bbox: [16.11, 45.74, 22.9, 48.58] },
  IE: { name: 'Irlanda', bbox: [-10.48, 51.45, -6.0, 55.39] },
  IN: { name: 'Índia', bbox: [68.18, 6.75, 97.4, 35.5] },
  IS: { name: 'Islândia', bbox: [-24.55, 63.3, -13.5, 66.57] },
  IT: { name: 'Itália', bbox: [6.63, 36.65, 18.52, 47.09] },
  JP: { name: 'Japão', bbox: [122.94, 24.05, 145.82, 45.52] },
  LU: { name: 'Luxemburgo', bbox: [5.73, 49.44, 6.53, 50.18] },
  MX: { name: 'México', bbox: [-118.4, 14.53, -86.7, 32.72] },
  NL: { name: 'Países Baixos', bbox: [3.31, 50.75, 7.23, 53.68] },
  NO: { name: 'Noruega', bbox: [4.65, 57.98, 31.29, 71.19] },
  NZ: { name: 'Nova Zelândia', bbox: [166.4, -47.29, 178.6, -34.39] },
  PE: { name: 'Peru', bbox: [-81.33, -18.35, -68.65, -0.04] },
  PL: { name: 'Polônia', bbox: [14.12, 49.0, 24.15, 54.84] },
  PT: { name: 'Portugal', bbox: [-9.53, 36.96, -6.19, 42.15] },
  PY: { name: 'Paraguai', bbox: [-62.65, -27.61, -54.26, -19.29] },
  RO: { name: 'Romênia', bbox: [20.26, 43.62, 29.72, 48.27] },
  SE: { name: 'Suécia', bbox: [11.11, 55.34, 24.16, 69.06] },
  SI: { name: 'Eslovênia', bbox: [13.38, 45.42, 16.61, 46.88] },
  SK: { name: 'Eslováquia', bbox: [16.83, 47.73, 22.57, 49.61] },
  US: { name: 'Estados Unidos', bbox: [-124.85, 24.4, -66.89, 49.38] },
  UY: { name: 'Uruguai', bbox: [-58.44, -34.97, -53.07, -30.08] },
  ZA: { name: 'África do Sul', bbox: [16.34, -34.84, 32.83, -22.13] },
};

/**
 * Emoji de bandeira a partir do código ISO2 — mapeia cada letra para o
 * "regional indicator symbol" correspondente (não precisa de dataset por país).
 * Retorna string vazia para códigos que não sejam 2 letras.
 */
export function flagEmoji(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return [...c].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join('');
}

/** Nome de exibição do país; cai no próprio código quando fora do dataset. */
export function countryName(code: string): string {
  return COUNTRY_BBOXES[code.toUpperCase()]?.name ?? code.toUpperCase();
}
