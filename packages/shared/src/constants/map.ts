/**
 * Estilos de mapa disponíveis para as rotas GPS de atividades.
 * Fonte única reutilizada por web (Leaflet) e mobile (Leaflet em WebView).
 *
 * - `osm`      — OpenStreetMap clássico (antigo padrão).
 * - `voyager`  — CARTO Voyager: visual suave/pastel (padrão atual).
 * - `positron` — CARTO Positron: cinza-claro minimalista.
 *
 * Os tiles da CARTO são públicos e não exigem chave de API; a atribuição
 * de OSM + CARTO é obrigatória.
 */
export type MapStyle = 'osm' | 'voyager' | 'positron';

export interface MapStyleConfig {
  /** Rótulo curto exibido na tela de configurações. */
  label: string;
  /** Template de URL de tiles XYZ para o Leaflet. */
  url: string;
  /** Subdomínios `{s}` aceitos pelo provedor. */
  subdomains: string;
  /** Zoom máximo suportado pelo estilo. */
  maxZoom: number;
  /** Atribuição (HTML) exigida pelo provedor. */
  attribution: string;
}

const OSM_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_CREDIT = '&copy; <a href="https://carto.com/attributions">CARTO</a>';

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  osm: {
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: OSM_CREDIT,
  },
  voyager: {
    label: 'Pastel (Voyager)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  positron: {
    label: 'Claro (Positron)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
};

/** Estilo aplicado quando o usuário ainda não escolheu. */
export const DEFAULT_MAP_STYLE: MapStyle = 'voyager';

/** Resolve um estilo (com fallback seguro) a partir de um valor possivelmente inválido/ausente. */
export function resolveMapStyle(value: string | null | undefined): MapStyle {
  return value && value in MAP_STYLES ? (value as MapStyle) : DEFAULT_MAP_STYLE;
}
