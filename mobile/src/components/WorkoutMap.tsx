import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { RoutePoint } from '../store/fitness.store';
import { colors, radii, MOD } from '../theme';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; OpenStreetMap contributors';

/**
 * Renderiza a rota GPS de um treino sobre o OpenStreetMap usando Leaflet
 * dentro de um WebView (mapa OSM puro, sem chave de API).
 */
export function WorkoutMap({
  points,
  height = 240,
}: {
  points: RoutePoint[];
  height?: number;
}) {
  const html = useMemo(() => buildHtml(points), [points]);

  if (points.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

function buildHtml(points: RoutePoint[]): string {
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
    var map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('${TILE_URL}', { maxZoom: 19, attribution: '${ATTRIBUTION}' }).addTo(map);

    var line = L.polyline(coords, { color: '${MOD.treino.accent}', weight: 5, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(map);
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

const styles = StyleSheet.create({
  container: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.surfaceMute,
  },
  web: {
    flex: 1,
    backgroundColor: colors.surfaceMute,
  },
});
