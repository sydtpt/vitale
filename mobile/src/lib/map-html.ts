import type { MapStyleConfig } from '@vitale/shared';
import { colors, MOD } from '../theme';

/** Ponto mínimo de rota aceito pelo gerador de HTML (estrutural). */
export type MapPoint = { latitude: number; longitude: number };

/** Estado de vista do mapa (enquadramento): centro [lat, lng], zoom e rotação. */
export interface MapViewState {
  center: [number, number];
  zoom: number;
  /** Só tem efeito nos estilos vector (MapLibre); Leaflet não rotaciona. */
  bearing?: number;
  pitch?: number;
}

/** Opções de inicialização do mapa (compartilhadas entre preview, tela cheia e cartão de share). */
export interface MapScriptOptions {
  /** Libera arrastar/zoom (`false` = mapa estático). */
  interactive: boolean;
  /** Padding do `fitBounds` (px). Default: `[24,24]` no Leaflet e `pitch?44:28` no MapLibre. */
  padding?: number;
  /** Vista inicial explícita (enquadramento salvo) — substitui o fitBounds inicial. */
  view?: MapViewState;
  /** Reporta mudanças de vista ao RN via postMessage: JSON `{type:'mapView', center, zoom, bearing, pitch}`. */
  reportView?: boolean;
}

/**
 * Gera o HTML de um mapa com a rota desenhada, para renderizar num WebView.
 *
 * - Estilos `raster` → Leaflet + `L.tileLayer` (tiles PNG XYZ).
 * - Estilos `vector` (OpenFreeMap) → MapLibre GL JS, com suporte a vista 3D
 *   (inclinação + prédios extrudados) quando o estilo define `pitch`.
 *
 * `interactive=false` gera um mapa estático (preview/thumbnail);
 * `interactive=true` libera arrastar/zoom (tela cheia).
 */
export function buildMapHtml(
  points: readonly MapPoint[],
  interactive: boolean,
  tile: MapStyleConfig,
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  ${mapHead(tile)}
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.surfaceMute}; }
  </style>
</head>
<body>
  <div id="map"></div>
  ${mapScript(points, tile, { interactive })}
</body>
</html>`;
}

/**
 * Fragmento de `<head>`: tags CDN (`<link>`/`<script>`) do provedor + CSS de
 * controle específico (tamanho da atribuição). Reutilizado por `buildMapHtml` e
 * pelo cartão de compartilhamento (que embute o mapa como camada de fundo).
 */
export function mapHead(tile: MapStyleConfig): string {
  return tile.kind === 'vector'
    ? `<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>.maplibregl-ctrl-attrib { font-size: 9px; }</style>`
    : `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>.leaflet-control-attribution { font-size: 9px; }</style>`;
}

/**
 * Fragmento `<script>` que inicializa o mapa sobre um `<div id="map">` já
 * presente no documento, desenhando a rota (casing branco + linha accent) e os
 * pontos de início/fim, com `fitBounds` sobre a rota.
 */
export function mapScript(
  points: readonly MapPoint[],
  tile: MapStyleConfig,
  opts: MapScriptOptions,
): string {
  return tile.kind === 'vector'
    ? maplibreScript(points, tile, opts)
    : leafletScript(points, tile, opts);
}

function leafletScript(
  points: readonly MapPoint[],
  tile: Extract<MapStyleConfig, { kind: 'raster' }>,
  { interactive, padding = 24, view, reportView }: MapScriptOptions,
): string {
  const coords = points.map((p) => [p.latitude, p.longitude]);
  const data = JSON.stringify(coords);

  return `<script>
    var coords = ${data};
    var interactive = ${interactive ? 'true' : 'false'};
    var map = L.map('map', {
      zoomControl: interactive,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
      zoomSnap: 0,
    });
    L.tileLayer('${tile.url}', { maxZoom: ${tile.maxZoom}, subdomains: '${tile.subdomains}', attribution: '${tile.attribution}' }).addTo(map);

    // Casing branco por baixo (halo estilo Strava) + rota colorida por cima.
    L.polyline(coords, { color: '#FFFFFF', weight: 6.75, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    var line = L.polyline(coords, { color: '${MOD.treino.accent}', weight: 3.75, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    function fit() { if (coords.length) map.fitBounds(line.getBounds(), { padding: [${padding}, ${padding}] }); }
    ${view ? `map.setView(${JSON.stringify(view.center)}, ${view.zoom});` : 'fit();'}
    window.recenter = fit;
    ${
      reportView
        ? `map.on('moveend zoomend', function () {
      var c = map.getCenter();
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(
        { type: 'mapView', center: [c.lat, c.lng], zoom: map.getZoom(), bearing: 0, pitch: 0 }));
    });`
        : ''
    }

    function dot(latlng, fill) {
      return L.circleMarker(latlng, { radius: 6, color: '#FFFFFF', weight: 2, fillColor: fill, fillOpacity: 1 }).addTo(map);
    }
    if (coords.length > 0) {
      dot(coords[0], '${colors.green}');
      dot(coords[coords.length - 1], '${MOD.treino.accent}');
    }
  </script>`;
}

function maplibreScript(
  points: readonly MapPoint[],
  tile: Extract<MapStyleConfig, { kind: 'vector' }>,
  { interactive, padding, view, reportView }: MapScriptOptions,
): string {
  // MapLibre usa ordem [lng, lat].
  const coords = points.map((p) => [p.longitude, p.latitude]);
  const data = JSON.stringify(coords);
  const pitch = view?.pitch ?? tile.pitch ?? 0;
  const bearing = view?.bearing ?? (tile.pitch ? -18 : 0);
  const fitPadding = padding ?? (pitch ? 44 : 28);

  const buildings = tile.buildings3d
    ? `
    try {
      map.addLayer({
        id: 'buildings-3d', source: 'openmaptiles', 'source-layer': 'building',
        type: 'fill-extrusion', minzoom: 14,
        paint: {
          'fill-extrusion-color': '#d9d0c3',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      });
    } catch (e) {}`
    : '';

  return `<script>
    var coords = ${data};
    var interactive = ${interactive ? 'true' : 'false'};
    var hasView = ${view ? 'true' : 'false'};
    var pitch = ${pitch};
    // Defaults do estilo (recentrar volta a eles, não à vista salva).
    var defPitch = ${tile.pitch ?? 0};
    var defBearing = ${tile.pitch ? -18 : 0};
    var map = new maplibregl.Map({
      container: 'map',
      style: '${tile.styleUrl}',
      interactive: interactive,
      attributionControl: { compact: true },
      ${view ? `center: [${view.center[1]}, ${view.center[0]}], zoom: ${view.zoom},` : ''}
      pitch: pitch,
      bearing: ${bearing},
      dragRotate: interactive,
    });
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    }
    ${
      reportView
        ? `['moveend', 'zoomend', 'rotateend', 'pitchend'].forEach(function (ev) {
      map.on(ev, function () {
        var c = map.getCenter();
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(
          { type: 'mapView', center: [c.lat, c.lng], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }));
      });
    });`
        : ''
    }

    map.on('load', function () {
      if (coords.length === 0) return;
${buildings}
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 6.75, 'line-opacity': 0.95 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '${MOD.treino.accent}', 'line-width': 3.75 } });
      map.addSource('endpoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { role: 'start' }, geometry: { type: 'Point', coordinates: coords[0] } },
        { type: 'Feature', properties: { role: 'end' }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } }
      ] } });
      map.addLayer({ id: 'endpoints', type: 'circle', source: 'endpoints', paint: {
        'circle-radius': 6,
        'circle-color': ['match', ['get', 'role'], 'start', '${colors.green}', '${MOD.treino.accent}'],
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });

      var b = new maplibregl.LngLatBounds(coords[0], coords[0]);
      for (var i = 1; i < coords.length; i++) b.extend(coords[i]);
      if (!hasView) {
        map.fitBounds(b, { padding: ${fitPadding}, duration: 0 });
        if (defPitch) { map.setPitch(defPitch); map.setBearing(defBearing); }
      }
      window.recenter = function () {
        map.fitBounds(b, { padding: ${fitPadding}, duration: 400 });
        map.setPitch(defPitch);
        map.setBearing(defBearing);
      };
    });
  </script>`;
}
