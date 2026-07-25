import React, { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MAP_STYLES, type ViewportBounds } from '@vitale/shared';
import { useSettingsStore } from '../store/settings.store';
import { buildCountryMapHtml, type MapPoint } from '../lib/map-html';
import { colors, radii, spacing } from '../theme';

/**
 * Mapa com TODAS as rotas de um país sobrepostas, enquadrado no `viewport`
 * (bbox do país ± buffer). Prévia estática; um toque abre em tela cheia com
 * pan/zoom e botão "Recentrar". Sem share/composer (isso é do detalhe de 1 treino).
 */
export function CountryMap({
  routes,
  viewport,
  height = 260,
}: {
  routes: MapPoint[][];
  viewport: ViewportBounds;
  height?: number;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const insets = useSafeAreaInsets();
  const fullWebRef = useRef<WebView>(null);
  const mapStyle = useSettingsStore((s) => s.preferences?.mapStyle) ?? 'voyager';
  const tile = MAP_STYLES[mapStyle];

  const previewHtml = useMemo(
    () => buildCountryMapHtml(routes, viewport, tile, false),
    [routes, viewport, tile],
  );
  const fullHtml = useMemo(
    () => buildCountryMapHtml(routes, viewport, tile, true),
    [routes, viewport, tile],
  );

  if (routes.length === 0) return null;

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
            ref={fullWebRef}
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

          <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Pressable
              style={({ pressed }) => [styles.pillDark, pressed && styles.pressed]}
              onPress={() =>
                fullWebRef.current?.injectJavaScript('window.recenter && window.recenter(); true;')
              }
              accessibilityRole="button"
              accessibilityLabel="Recentrar mapa"
              hitSlop={8}
            >
              <Ionicons name="locate-outline" size={18} color="#fff" />
              <Text style={styles.pillText}>Recentrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    backgroundColor: colors.surfaceMute,
  },
  web: { flex: 1, backgroundColor: colors.surfaceMute },
  expandHint: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  expandHintText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  fullContainer: { flex: 1, backgroundColor: colors.surfaceMute },
  fullWeb: { flex: 1, backgroundColor: colors.surfaceMute },
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
  closeButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', lineHeight: 20 },
  actionBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  pillDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
