import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, ScrollView, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MAP_STYLES, SAMPLE_ROUTE, WALLPAPERS, type MapStyle } from '@vitale/shared';
import { useSettingsStore } from '../../store/settings.store';
import { buildMapHtml } from '../../lib/map-html';
import { RotinaBackground } from '../../components/ui/RotinaBackground';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

const MAP_STYLE_ORDER: MapStyle[] = [
  'voyager',
  'positron',
  'voyager_nolabels',
  'positron_nolabels',
  'dark',
  'satellite',
  'topo',
  'osm',
  'ofm_positron',
  'ofm_bright',
  'ofm_fiord',
  'ofm_3d',
];

const THUMB = 24;

function BlurSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(0);
  // Refs evitam closures obsoletas dentro do PanResponder (criado 1x).
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  function emit(locationX: number) {
    const w = widthRef.current;
    if (w <= 0) return;
    const pct = Math.round(Math.max(0, Math.min(100, (locationX / w) * 100)));
    onChangeRef.current(pct);
  }

  const thumbLeft = trackWidth > 0 ? (value / 100) * (trackWidth - THUMB) : 0;

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackWidth(w);
      }}
      {...panResponder.panHandlers}
      style={sliderStyles.hit}
    >
      <View style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${value}%` }]} />
      </View>
      <View style={[sliderStyles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  hit: { paddingVertical: 14, justifyContent: 'center' },
  track: {
    height: 4,
    backgroundColor: colors.line,
    borderRadius: 2,
    overflow: 'hidden',
    marginHorizontal: THUMB / 2,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    top: 14 - THUMB / 2 + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default function AppSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { preferences, loadSettings, updatePreferences } = useSettingsStore();

  useEffect(() => {
    if (!preferences) loadSettings();
  }, []);

  const theme = preferences?.theme ?? 'system';
  const glass = preferences?.glassEnabled ?? false;
  const blurIntensity = preferences?.blurIntensity ?? 50;
  const mapStyle = preferences?.mapStyle ?? 'voyager';
  const wallpaper = preferences?.wallpaper ?? 'flat';
  const darkMode = theme === 'dark';

  // HTML de cada preview (rota fixa de exemplo) — só depende de constantes.
  const mapPreviews = useMemo(
    () =>
      MAP_STYLE_ORDER.reduce(
        (acc, style) => {
          acc[style] = buildMapHtml(SAMPLE_ROUTE, false, MAP_STYLES[style]);
          return acc;
        },
        {} as Record<MapStyle, string>,
      ),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Aparência</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Appearance section */}
        <Text style={styles.sectionTitle}>Aparência</Text>
        <View style={styles.card}>
          {/* Dark Mode */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.iconWrap, { backgroundColor: '#6E6CE8' }]}>
              <Ionicons name="moon" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Modo Escuro</Text>
            <Switch
              value={darkMode}
              onValueChange={(v) => updatePreferences({ theme: v ? 'dark' : 'light' })}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>

          {/* System theme */}
          <Pressable
            onPress={() => updatePreferences({ theme: 'system' })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#9B9B9B' }]}>
              <Ionicons name="phone-portrait-outline" size={15} color="#fff" />
            </View>
            <Text style={styles.rowLabel}>Usar tema do sistema</Text>
            <View style={styles.rowRight}>
              {theme === 'system' && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </View>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Visual</Text>
        <View style={styles.card}>
          {/* Glass effect */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={[styles.iconWrap, { backgroundColor: '#5BAFDA' }]}>
              <Ionicons name="partly-sunny-outline" size={15} color="#fff" />
            </View>
            <View style={styles.rowMeta}>
              <Text style={styles.rowLabel}>Glass</Text>
              <Text style={styles.rowSub}>Efeito translúcido nos cards</Text>
            </View>
            <Switch
              value={glass}
              onValueChange={(v) => updatePreferences({ glassEnabled: v })}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.line}
            />
          </View>

          {/* Blur intensity slider */}
          <View style={styles.sliderRow}>
            <View style={styles.sliderHeader}>
              <View style={[styles.iconWrap, { backgroundColor: '#8BC4E0' }]}>
                <Ionicons name="water-outline" size={15} color="#fff" />
              </View>
              <Text style={styles.rowLabel}>Intensidade</Text>
              <Text style={styles.intensityValue}>{blurIntensity}%</Text>
            </View>
            <BlurSlider
              value={blurIntensity}
              onChange={(v) => updatePreferences({ blurIntensity: v })}
            />
          </View>
        </View>

        {/* Wallpaper section — previews em retrato (formas ancoradas topo/rodapé). */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Papel de parede</Text>
        <View style={styles.wpGrid}>
          {WALLPAPERS.map((w) => {
            const selected = wallpaper === w.id;
            return (
              <Pressable
                key={w.id}
                onPress={() => updatePreferences({ wallpaper: w.id })}
                style={({ pressed }) => [styles.wpCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Papel de parede ${w.label}`}
              >
                <View style={[styles.wpPreview, selected && styles.mapPreviewSelected]}>
                  <RotinaBackground variant={w.id} />
                  {selected && (
                    <View style={styles.mapCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.mapLabel, selected && styles.mapLabelSelected]}
                  numberOfLines={1}
                >
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Map style section */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Mapa</Text>
        <View style={styles.mapGrid}>
          {MAP_STYLE_ORDER.map((style) => {
            const selected = mapStyle === style;
            return (
              <Pressable
                key={style}
                onPress={() => updatePreferences({ mapStyle: style })}
                style={({ pressed }) => [styles.mapCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Estilo de mapa ${MAP_STYLES[style].label}`}
              >
                <View style={[styles.mapPreview, selected && styles.mapPreviewSelected]}>
                  <WebView
                    originWhitelist={['*']}
                    source={{ html: mapPreviews[style] }}
                    style={styles.mapWeb}
                    scrollEnabled={false}
                    pointerEvents="none"
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    androidLayerType="hardware"
                  />
                  {selected && (
                    <View style={styles.mapCheck}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.mapLabel, selected && styles.mapLabelSelected]}
                  numberOfLines={1}
                >
                  {MAP_STYLES[style].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: 12,
    minHeight: 52,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { flex: 1, fontSize: 15, color: colors.ink },
  timeRow: { paddingHorizontal: spacing.lg, paddingBottom: 13, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12 },
  timeLabel: { fontSize: 13, color: colors.ink2, fontWeight: '600' },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  timeChipOn: { backgroundColor: colors.primary },
  timeChipTxt: { fontSize: 13, fontWeight: '600', color: colors.ink2, fontFamily: 'GeistMono' },
  timeChipTxtOn: { color: '#fff' },
  hint: { fontSize: 12, color: colors.ink3, marginTop: spacing.sm, marginHorizontal: 4, lineHeight: 17 },
  rowMeta: { flex: 1, gap: 2 },
  rowSub: { fontSize: 12, color: colors.ink3 },
  rowRight: { width: 22, alignItems: 'center' },
  sliderRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  intensityValue: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 38,
    textAlign: 'right',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  wpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  wpCard: {
    width: '31%',
  },
  wpPreview: {
    aspectRatio: 232 / 478,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMute,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
  },
  mapCard: {
    width: '48%',
    marginBottom: spacing.md,
  },
  mapPreview: {
    height: 100,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMute,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  mapPreviewSelected: {
    borderColor: colors.primary,
  },
  mapWeb: {
    flex: 1,
    backgroundColor: colors.surfaceMute,
  },
  mapCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLabel: {
    marginTop: 6,
    fontSize: 12,
    color: colors.ink2,
    textAlign: 'center',
  },
  mapLabelSelected: {
    color: colors.ink,
    fontWeight: '600',
  },
});
