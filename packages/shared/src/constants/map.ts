/**
 * Estilos de mapa disponíveis para as rotas GPS de atividades.
 * Fonte única reutilizada por web (Leaflet) e mobile (Leaflet em WebView).
 *
 * - `osm`               — OpenStreetMap clássico (antigo padrão).
 * - `voyager`           — CARTO Voyager: visual suave/pastel (padrão atual).
 * - `positron`          — CARTO Positron: cinza-claro minimalista.
 * - `voyager_nolabels`  — Voyager sem rótulos de ruas/lugares.
 * - `positron_nolabels` — Positron sem rótulos de ruas/lugares.
 * - `dark`              — CARTO Dark Matter: escuro minimalista (combina com tema dark).
 * - `satellite`         — Esri World Imagery: imagem de satélite/aérea.
 * - `topo`              — OpenTopoMap: relevo/trilhas para atividades ao ar livre.
 *
 * OpenFreeMap (vector tiles / MapLibre GL):
 * - `ofm_positron`      — Positron OFM: claro minimalista (vetor).
 * - `ofm_bright`        — Bright OFM: claro e colorido (vetor).
 * - `ofm_fiord`         — Fiord: tons frios/acinzentados (vetor).
 * - `ofm_3d`            — vista 3D inclinada com prédios extrudados (base Liberty).
 *
 * Todos os provedores são públicos e não exigem chave de API; a atribuição
 * de cada provedor é obrigatória.
 */
export type MapStyle =
  | 'osm'
  | 'voyager'
  | 'positron'
  | 'voyager_nolabels'
  | 'positron_nolabels'
  | 'dark'
  | 'satellite'
  | 'topo'
  | 'ofm_positron'
  | 'ofm_bright'
  | 'ofm_fiord'
  | 'ofm_3d';

/** Rótulo curto exibido na tela de configurações. */
interface MapStyleBase {
  label: string;
  /** Atribuição (HTML) exigida pelo provedor. */
  attribution: string;
}

/** Estilo de tiles raster (PNG XYZ) renderizado com `L.tileLayer` do Leaflet. */
export interface RasterMapStyle extends MapStyleBase {
  kind: 'raster';
  /** Template de URL de tiles XYZ para o Leaflet. */
  url: string;
  /** Subdomínios `{s}` aceitos pelo provedor. */
  subdomains: string;
  /** Zoom máximo suportado pelo estilo. */
  maxZoom: number;
}

/**
 * Estilo de vector tiles (MapLibre GL). Usado pelos estilos do OpenFreeMap.
 * No mobile renderiza com MapLibre GL JS nativo (WebView); na web entra como
 * camada do Leaflet via `maplibre-gl-leaflet` (2D — o tilt 3D só no mobile).
 */
export interface VectorMapStyle extends MapStyleBase {
  kind: 'vector';
  /** URL do style JSON (MapLibre). */
  styleUrl: string;
  /** Inclinação da câmera (graus) para a vista 3D; ausente = mapa plano. */
  pitch?: number;
  /** Extruda os prédios (fill-extrusion) para a vista 3D. */
  buildings3d?: boolean;
}

export type MapStyleConfig = RasterMapStyle | VectorMapStyle;

const OSM_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_CREDIT = '&copy; <a href="https://carto.com/attributions">CARTO</a>';
const ESRI_CREDIT =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> — Source: Esri, Maxar, Earthstar Geographics';
const OTM_CREDIT =
  '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';
const OFM_CREDIT =
  '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const OFM_STYLES_BASE = 'https://tiles.openfreemap.org/styles';

export const MAP_STYLES: Record<MapStyle, MapStyleConfig> = {
  osm: {
    kind: 'raster',
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: OSM_CREDIT,
  },
  voyager: {
    kind: 'raster',
    label: 'Pastel (Voyager)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  positron: {
    kind: 'raster',
    label: 'Claro (Positron)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  voyager_nolabels: {
    kind: 'raster',
    label: 'Pastel sem rótulos',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  positron_nolabels: {
    kind: 'raster',
    label: 'Claro sem rótulos',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  dark: {
    kind: 'raster',
    label: 'Escuro (Dark Matter)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: `${OSM_CREDIT} ${CARTO_CREDIT}`,
  },
  satellite: {
    kind: 'raster',
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: ESRI_CREDIT,
  },
  topo: {
    kind: 'raster',
    label: 'Topográfico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 17,
    attribution: `${OSM_CREDIT} ${OTM_CREDIT}`,
  },
  ofm_positron: {
    kind: 'vector',
    label: 'Positron OFM',
    styleUrl: `${OFM_STYLES_BASE}/positron`,
    attribution: OFM_CREDIT,
  },
  ofm_bright: {
    kind: 'vector',
    label: 'Bright OFM',
    styleUrl: `${OFM_STYLES_BASE}/bright`,
    attribution: OFM_CREDIT,
  },
  ofm_fiord: {
    kind: 'vector',
    label: 'Fiord',
    styleUrl: `${OFM_STYLES_BASE}/fiord`,
    attribution: OFM_CREDIT,
  },
  ofm_3d: {
    kind: 'vector',
    label: '3D',
    styleUrl: `${OFM_STYLES_BASE}/liberty`,
    pitch: 60,
    buildings3d: true,
    attribution: OFM_CREDIT,
  },
};

/** Estilo aplicado quando o usuário ainda não escolheu. */
export const DEFAULT_MAP_STYLE: MapStyle = 'voyager';

/** Resolve um estilo (com fallback seguro) a partir de um valor possivelmente inválido/ausente. */
export function resolveMapStyle(value: string | null | undefined): MapStyle {
  return value && value in MAP_STYLES ? (value as MapStyle) : DEFAULT_MAP_STYLE;
}

/**
 * Rota fixa de exemplo usada apenas nos previews de seleção de estilo
 * (mini-mapas na tela de configurações). Um loop curto em área urbana de
 * São Paulo — sem relação com dados reais do usuário.
 */
export const SAMPLE_ROUTE: ReadonlyArray<{ latitude: number; longitude: number }> = [
  { latitude: -23.5614, longitude: -46.6562 },
  { latitude: -23.5608, longitude: -46.6548 },
  { latitude: -23.5601, longitude: -46.6537 },
  { latitude: -23.5596, longitude: -46.6521 },
  { latitude: -23.5589, longitude: -46.6508 },
  { latitude: -23.5578, longitude: -46.6502 },
  { latitude: -23.5567, longitude: -46.6499 },
  { latitude: -23.5556, longitude: -46.6505 },
  { latitude: -23.5549, longitude: -46.6517 },
  { latitude: -23.5547, longitude: -46.6532 },
  { latitude: -23.5551, longitude: -46.6547 },
  { latitude: -23.5559, longitude: -46.6558 },
  { latitude: -23.5570, longitude: -46.6565 },
  { latitude: -23.5582, longitude: -46.6568 },
  { latitude: -23.5594, longitude: -46.6566 },
  { latitude: -23.5605, longitude: -46.6563 },
];
