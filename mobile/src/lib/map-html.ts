import type { MapStyleConfig } from '@vitale/shared';
import { colors, MOD } from '../theme';

/** Ponto mínimo de rota aceito pelo gerador de HTML (estrutural). */
export type MapPoint = { latitude: number; longitude: number };

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
  return tile.kind === 'vector'
    ? buildMapLibreHtml(points, interactive, tile)
    : buildLeafletHtml(points, interactive, tile);
}

function buildLeafletHtml(
  points: readonly MapPoint[],
  interactive: boolean,
  tile: Extract<MapStyleConfig, { kind: 'raster' }>,
): string {
  const coords = points.map((p) => [p.latitude, p.longitude]);
  const data = JSON.stringify(coords);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.surfaceMute}; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
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
    });
    L.tileLayer('${tile.url}', { maxZoom: ${tile.maxZoom}, subdomains: '${tile.subdomains}', attribution: '${tile.attribution}' }).addTo(map);

    // Casing branco por baixo (halo estilo Strava) + rota colorida por cima.
    L.polyline(coords, { color: '#FFFFFF', weight: 9, opacity: 0.95, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    var line = L.polyline(coords, { color: '${MOD.treino.accent}', weight: 5, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [24, 24] });

    function dot(latlng, fill) {
      return L.circleMarker(latlng, { radius: 6, color: '#FFFFFF', weight: 2, fillColor: fill, fillOpacity: 1 }).addTo(map);
    }
    if (coords.length > 0) {
      dot(coords[0], '${colors.green}');
      dot(coords[coords.length - 1], '${MOD.treino.accent}');
    }
  </script>
</body>
</html>`;
}

function buildMapLibreHtml(
  points: readonly MapPoint[],
  interactive: boolean,
  tile: Extract<MapStyleConfig, { kind: 'vector' }>,
): string {
  // MapLibre usa ordem [lng, lat].
  const coords = points.map((p) => [p.longitude, p.latitude]);
  const data = JSON.stringify(coords);
  const pitch = tile.pitch ?? 0;
  const bearing = pitch ? -18 : 0;
  const padding = pitch ? 44 : 28;

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

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: ${colors.surfaceMute}; }
    .maplibregl-ctrl-attrib { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var coords = ${data};
    var interactive = ${interactive ? 'true' : 'false'};
    var pitch = ${pitch};
    var map = new maplibregl.Map({
      container: 'map',
      style: '${tile.styleUrl}',
      interactive: interactive,
      attributionControl: { compact: true },
      pitch: pitch,
      bearing: ${bearing},
      dragRotate: interactive,
    });
    if (interactive) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: !!pitch }), 'top-right');
    }

    map.on('load', function () {
      if (coords.length === 0) return;
${buildings}
      map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': 0.95 } });
      map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '${MOD.treino.accent}', 'line-width': 5 } });
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
      map.fitBounds(b, { padding: ${padding}, duration: 0 });
      if (pitch) { map.setPitch(pitch); map.setBearing(${bearing}); }
    });
  </script>
</body>
</html>`;
}
