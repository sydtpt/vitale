import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import type { MapStyleConfig } from '@vitale/shared';
import type { MapPoint } from '../../lib/map-html';
import {
  formatDistance,
  formatDuration,
  formatRate,
  formatElevation,
  formatDateLabel,
} from '../../lib/workout-format';
import {
  buildShareCardHtml,
  formatRatio,
  FORMAT_DIMENSIONS,
  type ShareBackground,
  type ShareContext,
  type ShareFormat,
  type ShareMetricKey,
  type ShareMetricTile,
  type ShareTheme,
} from '../../lib/share-card-html';
import { captureAndShareCard } from '../../lib/share-export';
import { colors, spacing, radii, shadows, themed, useTheme, MOD } from '../../theme';

interface ShareComposerModalProps {
  visible: boolean;
  onClose: () => void;
  points: readonly MapPoint[];
  mapTile: MapStyleConfig;
  context: ShareContext;
}

interface MetricDef {
  key: ShareMetricKey;
  label: string;
  tile: ShareMetricTile;
}

const METRIC_ORDER: ShareMetricKey[] = [
  'distance',
  'movingTime',
  'elevation',
  'rate',
  'calories',
  'hr',
  'totalTime',
];

/** Quebra "8.42 km" → { value: "8.42", caption: "km" }. */
function splitMeasure(s: string): { value: string; caption: string } {
  const i = s.lastIndexOf(' ');
  return i > 0 ? { value: s.slice(0, i), caption: s.slice(i + 1) } : { value: s, caption: '' };
}

/** Deriva as métricas disponíveis (com dados) a partir do contexto. */
function availableMetrics(ctx: ShareContext): MetricDef[] {
  const out: MetricDef[] = [];
  const push = (key: ShareMetricKey, label: string, tile: ShareMetricTile | null) => {
    if (tile) out.push({ key, label, tile });
  };

  const dist = formatDistance(ctx.distanceM);
  if (dist) push('distance', 'Distância', { key: 'distance', ...splitMeasure(dist) });

  if (ctx.movingS && ctx.movingS > 0)
    push('movingTime', 'Movimento', {
      key: 'movingTime',
      value: formatDuration(ctx.movingS),
      caption: 'movimento',
    });

  const elev = formatElevation(ctx.elevationM ?? 0);
  if (elev) push('elevation', 'Elevação', { key: 'elevation', ...splitMeasure(elev) });

  const rate = formatRate(ctx.activityId, ctx.distanceM, ctx.movingS);
  if (rate) push('rate', 'Ritmo', { key: 'rate', value: rate.value, caption: rate.caption });

  if (ctx.calories && ctx.calories > 0)
    push('calories', 'Calorias', { key: 'calories', value: String(ctx.calories), caption: 'kcal' });

  if (ctx.hrAvgBpm && ctx.hrAvgBpm > 0)
    push('hr', 'FC', { key: 'hr', value: String(Math.round(ctx.hrAvgBpm)), caption: 'bpm' });

  if (ctx.totalS && ctx.totalS > 0)
    push('totalTime', 'Tempo total', {
      key: 'totalTime',
      value: formatDuration(ctx.totalS),
      caption: 'tempo total',
    });

  return out.sort((a, b) => METRIC_ORDER.indexOf(a.key) - METRIC_ORDER.indexOf(b.key));
}

const FORMAT_OPTS: { key: ShareFormat; label: string }[] = [
  { key: 'story', label: 'Story' },
  { key: 'square', label: 'Quadrado' },
  { key: 'portrait', label: 'Retrato' },
];
const BG_OPTS: { key: ShareBackground; label: string }[] = [
  { key: 'art', label: 'Arte' },
  { key: 'map', label: 'Mapa' },
];
const THEME_OPTS: { key: ShareTheme; label: string }[] = [
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Escuro' },
];

function tap() {
  Haptics.selectionAsync().catch(() => {});
}

export function ShareComposerModal({
  visible,
  onClose,
  points,
  mapTile,
  context,
}: ShareComposerModalProps) {
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();

  const metrics = useMemo(() => availableMetrics(context), [context]);
  const defaultTitle = (context.activityName?.trim() || context.metaLabel).trim();
  const subtitle = `${context.metaLabel} · ${formatDateLabel(context.startISO)}`;

  const [format, setFormat] = useState<ShareFormat>('story');
  const [background, setBackground] = useState<ShareBackground>('art');
  const [theme, setTheme] = useState<ShareTheme>(scheme);
  const [watermark, setWatermark] = useState(true);
  const [title, setTitle] = useState(defaultTitle);
  const [enabled, setEnabled] = useState<Set<ShareMetricKey>>(
    () => new Set(metrics.map((m) => m.key)),
  );

  // Reinicializa quando abre para uma atividade diferente.
  useEffect(() => {
    if (!visible) return;
    setTitle(defaultTitle);
    setEnabled(new Set(metrics.map((m) => m.key)));
    setTheme(scheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, context.activityId]);

  // Título com debounce p/ não recarregar o WebView a cada tecla.
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTitle(title), 250);
    return () => clearTimeout(t);
  }, [title]);

  const selectedTiles = useMemo(
    () => metrics.filter((m) => enabled.has(m.key)).map((m) => m.tile),
    [metrics, enabled],
  );

  const html = useMemo(
    () =>
      buildShareCardHtml({
        points,
        format,
        background,
        theme,
        title: debouncedTitle || defaultTitle,
        subtitle,
        metrics: selectedTiles,
        watermark,
        mapTile,
      }),
    [points, format, background, theme, debouncedTitle, defaultTitle, subtitle, selectedTiles, watermark, mapTile],
  );

  // Letterbox: dimensiona o WebView à proporção real de saída dentro da área.
  const [area, setArea] = useState({ w: 0, h: 0 });
  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  };
  const ratio = formatRatio(format);
  const box = useMemo(() => {
    if (area.w <= 0 || area.h <= 0) return { width: 0, height: 0 };
    return area.w / area.h > ratio
      ? { width: area.h * ratio, height: area.h }
      : { width: area.w, height: area.w / ratio };
  }, [area, ratio]);

  const toggleMetric = (key: ShareMetricKey) => {
    tap();
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Exportar: renderiza o cartão num WebView offscreen em resolução plena
  //    (1080px), captura em PNG e abre o share sheet nativo. ────────────────
  const dim = FORMAT_DIMENSIONS[format];
  const exportRef = useRef<WebView>(null);
  const [exporting, setExporting] = useState(false);

  const onExportLoaded = async () => {
    if (!exporting) return;
    try {
      // Dá tempo do mapa (tiles remotos) desenhar antes do snapshot.
      await new Promise((r) => setTimeout(r, background === 'map' ? 1500 : 350));
      const result = await captureAndShareCard(exportRef, dim, title || defaultTitle);
      if (result === 'unavailable') {
        Alert.alert('Indisponível', 'Compartilhamento não está disponível neste dispositivo.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar a imagem do cartão.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Barra superior */}
        <View style={styles.topbar}>
          <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Text style={styles.topTitle}>Compartilhar</Text>
          <Pressable
            onPress={() => {
              tap();
              setExporting(true);
            }}
            disabled={exporting || metrics.length === 0}
            hitSlop={12}
            style={({ pressed }) => [
              styles.exportBtn,
              exporting && styles.exportDisabled,
              pressed && styles.pressed,
            ]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.exportText}>Exportar</Text>
            )}
          </Pressable>
        </View>

        {/* Preview */}
        <View style={styles.previewArea} onLayout={onArea}>
          {box.width > 0 && (
            <View
              style={[
                styles.previewFrame,
                { width: box.width, height: box.height },
              ]}
            >
              <WebView
                key={`${format}-${background}-${theme}`}
                originWhitelist={['*']}
                source={{ html }}
                style={styles.web}
                scrollEnabled={false}
                pointerEvents="none"
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                androidLayerType="hardware"
              />
            </View>
          )}
        </View>

        {/* Controles */}
        <ScrollView
          style={styles.controls}
          contentContainerStyle={[styles.controlsContent, { paddingBottom: insets.bottom + spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.fieldLabel}>Nome</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder={defaultTitle}
            placeholderTextColor={colors.ink4}
            maxLength={60}
          />

          <Text style={styles.fieldLabel}>Formato</Text>
          <Segmented
            options={FORMAT_OPTS}
            value={format}
            onChange={(v) => {
              tap();
              setFormat(v);
            }}
          />

          <Text style={styles.fieldLabel}>Fundo</Text>
          <Segmented
            options={BG_OPTS}
            value={background}
            onChange={(v) => {
              tap();
              setBackground(v);
            }}
          />

          <Text style={styles.fieldLabel}>Tema do cartão</Text>
          <Segmented
            options={THEME_OPTS}
            value={theme}
            onChange={(v) => {
              tap();
              setTheme(v);
            }}
          />

          <Text style={styles.fieldLabel}>Métricas</Text>
          <View style={styles.chips}>
            {metrics.map((m) => {
              const on = enabled.has(m.key);
              return (
                <Pressable
                  key={m.key}
                  onPress={() => toggleMetric(m.key)}
                  style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
            {metrics.length === 0 && (
              <Text style={styles.note}>Sem métricas disponíveis para esta atividade.</Text>
            )}
          </View>

          <Pressable
            style={styles.switchRow}
            onPress={() => {
              tap();
              setWatermark((w) => !w);
            }}
          >
            <Text style={styles.switchLabel}>Marca d'água Vitale</Text>
            <View style={[styles.switchTrack, watermark && styles.switchTrackOn]}>
              <View style={[styles.switchThumb, watermark && styles.switchThumbOn]} />
            </View>
          </Pressable>
        </ScrollView>

        {/* WebView offscreen em resolução plena — fonte do snapshot PNG. */}
        {exporting && (
          <View
            style={[styles.offscreen, { width: dim.width, height: dim.height }]}
            pointerEvents="none"
            collapsable={false}
          >
            <WebView
              ref={exportRef}
              originWhitelist={['*']}
              source={{ html }}
              style={{ width: dim.width, height: dim.height }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              androidLayerType="hardware"
              onLoadEnd={onExportLoaded}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

/** Controle segmentado genérico (Pressables ad-hoc, tokens do tema). */
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, active && styles.segItemActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    pressed: { opacity: 0.6 },

    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    cancel: { fontSize: 15, color: colors.ink2 },
    topTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
    exportBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.primary,
    },
    exportDisabled: { backgroundColor: colors.ink4, opacity: 0.5 },
    exportText: { fontSize: 14, fontWeight: '600', color: '#fff' },

    previewArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    previewFrame: {
      borderRadius: radii['2xl'],
      overflow: 'hidden',
      backgroundColor: colors.surfaceMute,
      ...shadows.card,
    },
    web: { flex: 1, backgroundColor: 'transparent' },
    offscreen: { position: 'absolute', left: -100000, top: 0 },

    controls: {
      maxHeight: '46%',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      backgroundColor: colors.surface,
    },
    controlsContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    fieldLabel: {
      fontSize: 11,
      color: colors.ink3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.surfaceMute,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.ink,
    },

    segment: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMute,
      borderRadius: radii.pill,
      padding: 3,
      gap: 3,
    },
    segItem: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radii.pill,
      alignItems: 'center',
    },
    segItemActive: { backgroundColor: colors.primary },
    segText: { fontSize: 13.5, fontWeight: '600', color: colors.ink2 },
    segTextActive: { color: '#fff' },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radii.pill,
      borderWidth: 1,
    },
    chipOn: { backgroundColor: MOD.treino.tint, borderColor: 'transparent' },
    chipOff: { backgroundColor: 'transparent', borderColor: colors.line },
    chipText: { fontSize: 13.5, fontWeight: '600' },
    chipTextOn: { color: colors.primary },
    chipTextOff: { color: colors.ink3 },
    note: { fontSize: 13, color: colors.ink3, fontStyle: 'italic' },

    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      paddingVertical: spacing.xs,
    },
    switchLabel: { fontSize: 15, color: colors.ink },
    switchTrack: {
      width: 46,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.lineDeep,
      padding: 3,
      justifyContent: 'center',
    },
    switchTrackOn: { backgroundColor: colors.primary },
    switchThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#fff',
    },
    switchThumbOn: { alignSelf: 'flex-end' },
  }),
);
