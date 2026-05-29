import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MAP_STYLES, type MapStyleConfig } from '@vitale/shared';
import type { RoutePoint } from '../store/fitness.store';
import { useSettingsStore } from '../store/settings.store';
import { colors, radii, spacing, MOD } from '../theme';

/**
 * Renderiza a rota GPS de um treino sobre o OpenStreetMap usando Leaflet
 * dentro de um WebView (mapa OSM puro, sem chave de API).
 *
 * A prévia inline é estática (sem arrastar/zoom); um toque abre o mapa em
 * tela cheia, onde o usuário pode arrastar e dar zoom livremente.
 */
export function WorkoutMap({
  points,
  height = 240,
}: {
  points: RoutePoint[];
  height?: number;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const insets = useSafeAreaInsets();
  const mapStyle = useSettingsStore((s) => s.preferences?.mapStyle) ?? 'voyager';
  const tile = MAP_STYLES[mapStyle];
  const previewHtml = useMemo(() => buildHtml(points, false, tile), [points, tile]);
  const fullHtml = useMemo(() => buildHtml(points, true, tile), [points, tile]);

  if (points.length === 0) return null;

  return (
    <>
      <Pressable
        style={[styles.container, { height }]}
        onPress={() => setFullscreen(true)}
        accessibilityRole="button"
        accessibilityLabel="Abrir mapa em tela cheia"
      >
        <WebView
          originWhitelist={['*']}
          source={{ html: previewHtml }}
          style={styles.web}
          scrollEnabled={false}
          pointerEvents="none"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          androidLayerType="hardware"
        />
        <View style={styles.expandHint} pointerEvents="none">
          <Text style={styles.expandHintText}>Toque para ampliar</Text>
        </View>
      </Pressable>

      <Modal
        visible={fullscreen}
        animationType="slide"
        onRequestClose={() => setFullscreen(false)}
        statusBarTranslucent
      >
        <View style={styles.fullContainer}>
          <WebView
            originWhitelist={['*']}
            source={{ html: fullHtml }}
            style={styles.fullWeb}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            androidLayerType="hardware"
          />
          <Pressable
            style={[styles.closeButton, { top: insets.top + spacing.md }]}
            onPress={() => setFullscreen(false)}
            accessibilityRole="button"
            accessibilityLabel="Fechar mapa"
            hitSlop={12}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function buildHtml(points: RoutePoint[], interactive: boolean, tile: MapStyleConfig): string {
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
  expandHint: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  expandHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fullContainer: {
    flex: 1,
    backgroundColor: colors.surfaceMute,
  },
  fullWeb: {
    flex: 1,
    backgroundColor: colors.surfaceMute,
  },
  closeButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
});
