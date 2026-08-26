import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, ScrollView, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  BRANDS,
  MAP_STYLES,
  PALETTES,
  SAMPLE_ROUTE,
  THEMES,
  resolveTheme,
  resolveTokens,
  wallpapersFor,
  type BrandId,
  type MapStyle,
  type PaletteId,
  type ThemeId,
} from '@vitale/shared';
import { useSettingsStore } from '../../store/settings.store';
import { buildMapHtml } from '../../lib/map-html';
import { RotinaBackground } from '../../components/ui/RotinaBackground';
import { colors, fonts, radii, shadows, spacing, themed, useTheme, useThemedStyles } from '../../theme';

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
  useTheme();
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

const sliderStyles = themed(() =>
  StyleSheet.create({
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
  }),
);

/**
 * Prévia de um tema: o fundo com um card dentro. É o mínimo que mostra a
 * diferença entre o `clean` (card sem preenchimento, definido pela linha) e o
 * `cleanElev` (card como degrau de superfície) — que é justamente o que o nome
 * de cada um não consegue explicar sozinho.
 */
function ThemePreview({ id, scheme }: { id: ThemeId; scheme: 'light' | 'dark' }) {
  const t = resolveTokens(id, scheme, 'orbe');
  return (
    <View style={[previewStyles.themeBox, { backgroundColor: t.bg }]}>
      <View
        style={[previewStyles.themeCard, { backgroundColor: t.surface, borderColor: t.hairline }]}
      >
        <View style={[previewStyles.themeLine, { backgroundColor: t.ink, width: '62%' }]} />
        <View style={[previewStyles.themeLine, { backgroundColor: t.ink3, width: '40%' }]} />
      </View>
    </View>
  );
}

/** Prévia de paleta: os módulos que mais aparecem, na ordem da tela Hoje. */
function PalettePreview({ id, themeId, scheme }: { id: PaletteId; themeId: ThemeId; scheme: 'light' | 'dark' }) {
  const t = resolveTokens(themeId, scheme, id);
  const roles = ['orange', 'yellow', 'blue', 'green', 'purple'] as const;
  return (
    <View style={previewStyles.paletteRow}>
      {roles.map((r) => (
        <View key={r} style={[previewStyles.dot, { backgroundColor: t.roles[r].accent }]} />
      ))}
    </View>
  );
}

const previewStyles = themed(() =>
  StyleSheet.create({
    themeBox: {
      height: 62,
      borderRadius: radii.md,
      padding: 9,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    themeCard: { borderRadius: 8, borderWidth: 1, padding: 7, gap: 4 },
    themeLine: { height: 3, borderRadius: 2 },
    paletteRow: { flexDirection: 'row', gap: 5, marginTop: 8 },
    dot: { width: 15, height: 15, borderRadius: 999 },
  }),
);

export default function AppSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { scheme, themeId, paletteId, brandId } = useTheme();
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

  // O núcleo decide o que faz sentido oferecer: some o decorativo nos temas que
  // abrem mão dele, e some o `pure` onde ele pintaria igual ao `flat` — no Clean,
  // `bg` e `bgPure` são o mesmo hex. A escolha anterior continua salva e
  // reaparece ao voltar para um tema que a aceita.
  const visibleWallpapers = wallpapersFor(themeId, scheme);

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

        {/* Tema — a família de neutros (superfície, tinta, linha). */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Tema</Text>
        <View style={styles.themeGrid}>
          {THEMES.map((t) => {
            const selected = themeId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => updatePreferences({ themeId: t.id })}
                style={({ pressed }) => [styles.themeCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Tema ${t.name}`}
              >
                <View style={[styles.themeFrame, selected && styles.mapPreviewSelected]}>
                  <ThemePreview id={t.id} scheme={scheme} />
                  {selected && (
                    <View style={styles.mapCheck}>
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                    </View>
                  )}
                </View>
                <Text style={[styles.mapLabel, selected && styles.mapLabelSelected]} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>{resolveTheme(themeId).hint}</Text>

        {/* Marca — o cromo: FAB, CTA, toggle. Independente da paleta. */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Cor principal</Text>
        <View style={styles.themeGrid}>
          {BRANDS.map((b) => {
            const selected = brandId === b.id;
            const t = resolveTokens(themeId, scheme, paletteId, b.id);
            return (
              <Pressable
                key={b.id}
                onPress={() => updatePreferences({ brandId: b.id as BrandId })}
                style={({ pressed }) => [styles.brandCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Cor principal ${b.name}`}
              >
                <View style={[styles.brandChip, { backgroundColor: t.primary }]}>
                  <Ionicons
                    name={selected ? 'checkmark' : 'add'}
                    size={19}
                    color={t.onPrimary}
                  />
                </View>
                <Text style={[styles.mapLabel, selected && styles.mapLabelSelected]} numberOfLines={1}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Vale para o botão “+”, os CTAs, o Salvar e os toggles. As cores dos módulos —
          Treino, Comida, Água — continuam vindo da paleta.
        </Text>

        {/* Paleta — vale para o app E para os gráficos. */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Paleta</Text>
        <View style={styles.card}>
          {PALETTES.map((p, i) => {
            const selected = paletteId === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => updatePreferences({ paletteId: p.id })}
                style={({ pressed }) => [
                  styles.row,
                  i < PALETTES.length - 1 && styles.rowBorder,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Paleta ${p.name}`}
              >
                <View style={styles.rowMeta}>
                  <Text style={styles.rowLabel}>{p.name}</Text>
                  <Text style={styles.rowSub}>{p.hint}</Text>
                  <PalettePreview id={p.id} themeId={themeId} scheme={scheme} />
                </View>
                <View style={styles.rowRight}>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Vale para o app e para as cores dos gráficos — antes eram duas escolhas separadas.
        </Text>

        {/* Wallpaper section — previews em retrato (formas ancoradas topo/rodapé). */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Papel de parede</Text>
        <View style={styles.wpGrid}>
          {visibleWallpapers.map((w) => {
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
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
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
                      <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansSemiBold, color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['4xl'] },
  sectionTitle: {
    fontSize: 13,
    fontFamily: fonts.sansSemiBold,
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
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
  rowLabel: { flex: 1, fontSize: 15, fontFamily: fonts.sans, color: colors.ink },
  timeRow: { paddingHorizontal: spacing.lg, paddingBottom: 13, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12 },
  timeLabel: { fontSize: 13, color: colors.ink2, fontFamily: fonts.sansSemiBold },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: colors.surfaceMute },
  timeChipOn: { backgroundColor: colors.primary },
  timeChipTxt: { fontSize: 13, color: colors.ink2, fontFamily: fonts.monoSemiBold },
  hint: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3, marginTop: spacing.sm, marginHorizontal: 4, lineHeight: 17 },
  rowMeta: { flex: 1, gap: 2 },
  rowSub: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
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
    fontFamily: fonts.sansSemiBold,
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
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  themeCard: { width: '31%' },
  brandCard: { width: '22%', alignItems: 'center' },
  brandChip: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  themeFrame: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 6,
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
    fontSize: 12, fontFamily: fonts.sans,
    color: colors.ink2,
    textAlign: 'center',
  },
  mapLabelSelected: {
    color: colors.ink,
    fontFamily: fonts.sansSemiBold,
  },
});
