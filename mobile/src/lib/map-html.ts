import type { CityMark, MapStyleConfig, ViewportBounds } from '@vitale/shared';
import { colors, MOD } from '../theme';

/** Ponto mínimo de rota aceito pelo gerador de HTML (estrutural). */
export type MapPoint = { latitude: number; longitude: number };

/**
 * Comentário injetado nos dois scripts, para quem abrir o HTML gerado entender
 * de onde vem a chamada. Mora aqui para não divergir entre Leaflet e MapLibre.
 *
 * **Núcleo escuro com anel branco, e não uma cor de tema.** O marcador tem de
 * ser legível sobre qualquer tile, e há estilo de mapa claro *e* escuro na
 * lista: um token que virasse quase-branco no esquema escuro sumiria sobre o
 * Positron, e um fixo escuro sumiria sobre o Dark Matter. O par núcleo+anel é
 * a mesma solução do casing branco sob a linha da rota, logo acima.
 */
const CURSOR_API_COMMENT = `// Cursor do scrub: o RN chama por injectJavaScript quando o dedo (ou o
    // mouse) percorre o gráfico de elevação/velocidade. Ver RouteProfileCard.`;

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
  /** Cidades a rotular sobre a rota (cartão de share). Ausente/vazio ⇒ nenhuma. */
  cities?: readonly CityMark[];
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
  { interactive, padding = 24, view, reportView, cities }: MapScriptOptions,
): string {
  const coords = points.map((p) => [p.latitude, p.longitude]);
  const data = JSON.stringify(coords);
  const cityData = JSON.stringify(
    (cities ?? []).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng })),
  );

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

    ${CURSOR_API_COMMENT}
    var cursor = null;
    window.__cursor = function (lat, lng) {
      if (cursor) { cursor.setLatLng([lat, lng]); return; }
      cursor = L.circleMarker([lat, lng], {
        radius: 4, color: '#FFFFFF', weight: 3,
        fillColor: '#1F1B16', fillOpacity: 1, interactive: false,
      }).addTo(map);
    };
    window.__cursorHide = function () { if (cursor) { cursor.remove(); cursor = null; } };

    // Cidades atravessadas: ponto sobre a rota + rótulo (divIcon com o nome via
    // textContent — sem interpolar HTML, evita quebra/injeção por nomes com aspas).
    var cityData = ${cityData};
    cityData.forEach(function (c) {
      L.circleMarker([c.lat, c.lng], { radius: 4, color: '#FFFFFF', weight: 2, fillColor: '${MOD.treino.accent}', fillOpacity: 1, interactive: false }).addTo(map);
      var el = document.createElement('div');
      el.textContent = c.name;
      el.style.cssText = 'white-space:nowrap;transform:translate(-50%,-150%);font:600 12px -apple-system,system-ui,sans-serif;color:#FFFFFF;text-shadow:0 1px 4px rgba(0,0,0,0.95);';
      L.marker([c.lat, c.lng], { icon: L.divIcon({ html: el, className: '', iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(map);
    });
  </script>`;
}

/* ─────────────────── mapa agregado por país (multi-rota) ─────────────────── */

/** Reduz uma rota a no máx. `max` pontos (a forma sobrevive no zoom de país). */
function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return points.slice();
  const step = Math.ceil(points.length / max);
  const out: T[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * HTML de um mapa com TODAS as rotas de um país sobrepostas (uma polyline fina
 * por rota, sem casing dupla) enquadrado no `bounds` do `countryViewport`.
 * Reusa `mapHead`; o script varia por Leaflet (raster) / MapLibre (vector).
 */
export function buildCountryMapHtml(
  routes: readonly MapPoint[][],
  bounds: ViewportBounds,
  tile: MapStyleConfig,
  interactive: boolean,
): string {
  const reduced = routes.map((r) => downsample(r, 150)).filter((r) => r.length >= 2);
  const script =
    tile.kind === 'vector'
      ? countryMaplibreScript(reduced, bounds, tile, interactive)
      : countryLeafletScript(reduced, bounds, tile, interactive);
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
  ${script}
</body>
</html>`;
}

function countryLeafletScript(
  routes: readonly MapPoint[][],
  bounds: ViewportBounds,
  tile: Extract<MapStyleConfig, { kind: 'raster' }>,
  interactive: boolean,
): string {
  // Leaflet aceita array de arrays de latlng como multi-polyline (uma camada).
  const data = JSON.stringify(routes.map((r) => r.map((p) => [p.latitude, p.longitude])));
  const bnds = JSON.stringify(bounds); // [[sul,oeste],[norte,leste]] — direto no fitBounds
  return `<script>
    var routes = ${data};
    var bounds = ${bnds};
    var interactive = ${interactive ? 'true' : 'false'};
    var map = L.map('map', {
      zoomControl: interactive, attributionControl: true,
      dragging: interactive, touchZoom: interactive, scrollWheelZoom: interactive,
      doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive,
      tap: interactive, zoomSnap: 0,
    });
    L.tileLayer('${tile.url}', { maxZoom: ${tile.maxZoom}, subdomains: '${tile.subdomains}', attribution: '${tile.attribution}' }).addTo(map);
    if (routes.length) L.polyline(routes, { color: '${MOD.treino.accent}', weight: 3, opacity: 0.7, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    function fit() { map.fitBounds(bounds, { padding: [16, 16] }); }
    fit();
    window.recenter = fit;
  </script>`;
}

function countryMaplibreScript(
  routes: readonly MapPoint[][],
  bounds: ViewportBounds,
  tile: Extract<MapStyleConfig, { kind: 'vector' }>,
  interactive: boolean,
): string {
  // MapLibre usa [lng,lat]; uma FeatureCollection com uma LineString por rota.
  const features = JSON.stringify(
    routes.map((r) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: r.map((p) => [p.longitude, p.latitude]) },
    })),
  );
  // LngLatBounds: [[oeste,sul],[leste,norte]].
  const mlBounds = JSON.stringify([
    [bounds[0][1], bounds[0][0]],
    [bounds[1][1], bounds[1][0]],
  ]);
  return `<script>
    var features = ${features};
    var bounds = ${mlBounds};
    var interactive = ${interactive ? 'true' : 'false'};
    var map = new maplibregl.Map({
      container: 'map', style: '${tile.styleUrl}', interactive: interactive,
      attributionControl: { compact: true }, bounds: bounds, fitBoundsOptions: { padding: 20 },
    });
    if (interactive) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', function () {
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });
      map.addLayer({ id: 'routes', type: 'line', source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '${MOD.treino.accent}', 'line-width': 3, 'line-opacity': 0.7 } });
      window.recenter = function () { map.fitBounds(bounds, { padding: 20, duration: 400 }); };
    });
  </script>`;
}

function maplibreScript(
  points: readonly MapPoint[],
  tile: Extract<MapStyleConfig, { kind: 'vector' }>,
  { interactive, padding, view, reportView, cities }: MapScriptOptions,
): string {
  // MapLibre usa ordem [lng, lat].
  const coords = points.map((p) => [p.longitude, p.latitude]);
  const data = JSON.stringify(coords);
  const cityData = JSON.stringify(
    (cities ?? []).map((c) => ({ name: c.name, lat: c.lat, lng: c.lng })),
  );
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

    ${CURSOR_API_COMMENT}
    // A camada só existe depois do 'load'; um scrub que chegue antes disso fica
    // guardado em vez de virar exceção dentro do WebView, onde ninguém a veria.
    var cursorReady = false;
    var pendingCursor = null;
    window.__cursor = function (lat, lng) {
      if (!cursorReady) { pendingCursor = [lat, lng]; return; }
      map.getSource('cursor').setData({ type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } }
      ] });
    };
    window.__cursorHide = function () {
      pendingCursor = null;
      if (cursorReady) map.getSource('cursor').setData({ type: 'FeatureCollection', features: [] });
    };

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

      map.addSource('cursor', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'cursor', type: 'circle', source: 'cursor', paint: {
        'circle-radius': 4, 'circle-color': '#1F1B16',
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } });
      cursorReady = true;
      if (pendingCursor) { window.__cursor(pendingCursor[0], pendingCursor[1]); pendingCursor = null; }

      // Cidades atravessadas: pontos + rótulos nativos (symbol). O text-font
      // depende dos glyphs do estilo — try/catch cai para o default se faltar.
      var cityData = ${cityData};
      if (cityData.length) {
        map.addSource('cities', { type: 'geojson', data: { type: 'FeatureCollection', features: cityData.map(function (c) {
          return { type: 'Feature', properties: { name: c.name }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } };
        }) } });
        try {
          map.addLayer({ id: 'city-dots', type: 'circle', source: 'cities', paint: {
            'circle-radius': 4, 'circle-color': '${MOD.treino.accent}', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 } });
        } catch (e) {}
        var labelLayout = { 'text-field': ['get', 'name'], 'text-size': 13, 'text-offset': [0, -1.2], 'text-anchor': 'bottom' };
        var labelPaint = { 'text-color': '#FFFFFF', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.4 };
        try {
          map.addLayer({ id: 'city-labels', type: 'symbol', source: 'cities',
            layout: Object.assign({ 'text-font': ['Noto Sans Regular'] }, labelLayout), paint: labelPaint });
        } catch (e) {
          try { map.addLayer({ id: 'city-labels', type: 'symbol', source: 'cities', layout: labelLayout, paint: labelPaint }); } catch (e2) {}
        }
      }

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
