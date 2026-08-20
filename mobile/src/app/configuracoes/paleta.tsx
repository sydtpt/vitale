import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHART_PALETTES, REFERENCE_LINE_SCHEMES, resolveReferenceLineScheme, type ChartPalette, type PaletteRoles } from '@vitale/shared';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { useSettingsStore } from '../../store/settings.store';
import { colors, spacing, radii, shadows, useThemedStyles, useTheme } from '../../theme';

// Barras de exemplo (topo → base) para a prévia — imitam o gráfico empilhado.
type Role = keyof PaletteRoles;
const PREVIEW_BARS: { role: Role; h: number }[][] = [
  [{ role: 'green', h: 15 }, { role: 'orange', h: 24 }],
  [{ role: 'orange', h: 10 }, { role: 'blue', h: 31 }],
  [{ role: 'rose', h: 8 }, { role: 'blue', h: 12 }, { role: 'green', h: 20 }],
  [{ role: 'orange', h: 30 }],
  [{ role: 'yellow', h: 8 }, { role: 'green', h: 18 }, { role: 'blue', h: 17 }],
];

function PalettePreview({ roles }: { roles: PaletteRoles }) {
  return (
    <View style={previewStyles.preview}>
      {PREVIEW_BARS.map((segs, bi) => (
        <View key={bi} style={previewStyles.bar}>
          {segs.map((s, si) => (
            <View
              key={si}
              style={{
                width: 15,
                height: s.h,
                backgroundColor: roles[s.role],
                borderTopLeftRadius: si === 0 ? 4 : 0,
                borderTopRightRadius: si === 0 ? 4 : 0,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** Prévia das linhas: pontilhada (média) sobre sólida (progressão), sobre barras neutras. */
function LinesPreview({ average, series }: { average: string; series: string }) {
  return (
    <View style={previewStyles.preview}>
      <View style={previewStyles.linesLayer} pointerEvents="none">
        <View style={[previewStyles.solidLine, { backgroundColor: series }]} />
        <View style={previewStyles.dottedRow}>
          {Array.from({ length: 9 }, (_, i) => (
            <View key={i} style={[previewStyles.dot, { backgroundColor: average }]} />
          ))}
        </View>
      </View>
      {[18, 30, 12, 26, 20].map((h, i) => (
        <View key={i} style={{ width: 15, height: h, borderRadius: 4, backgroundColor: colors.line }} />
      ))}
    </View>
  );
}

const previewStyles = StyleSheet.create({
  preview: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 44,
    paddingHorizontal: 10,
    paddingBottom: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMute,
  },
  bar: { flexDirection: 'column', justifyContent: 'flex-end' },
  linesLayer: { ...StyleSheet.absoluteFill, justifyContent: 'center', paddingHorizontal: 8, gap: 7 },
  solidLine: { height: 2, borderRadius: 1, opacity: 0.85 },
  dottedRow: { flexDirection: 'row', gap: 3 },
  dot: { width: 2, height: 2, borderRadius: 1, opacity: 0.85 },
});

export default function ChartPaletteScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const paletteId = useChartPaletteStore((st) => st.paletteId);
  const setPalette = useChartPaletteStore((st) => st.setPalette);
  const preferences = useSettingsStore((st) => st.preferences);
  const loadSettings = useSettingsStore((st) => st.loadSettings);
  const updatePreferences = useSettingsStore((st) => st.updatePreferences);
  const scheme = resolveReferenceLineScheme(preferences?.referenceLineScheme);
  // A prévia tem que mostrar o passo do tema ativo, senão ela mente sobre o que o
  // gráfico vai desenhar (cada esquema tem uma cor por tema — ver reference-lines.ts).
  const { scheme: themeMode } = useTheme();

  useEffect(() => {
    if (!preferences) loadSettings();
  }, []);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={s.headerTitle}>Cores dos gráficos</Text>
        <View style={s.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.hint}>
          Muda as cores por tipo de atividade nos gráficos (barras empilhadas, legenda e tooltip).
          A escolha é salva só neste aparelho.
        </Text>

        {CHART_PALETTES.map((p: ChartPalette) => {
          const selected = p.id === paletteId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPalette(p.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Paleta ${p.name}`}
              style={({ pressed }) => [s.card, selected && s.cardSelected, pressed && s.pressed]}
            >
              <PalettePreview roles={p.roles} />
              <View style={s.meta}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.sub}>{p.hint}</Text>
              </View>
              <View style={[s.check, selected && s.checkOn]}>
                {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
            </Pressable>
          );
        })}

        <Text style={[s.sectionTitle]}>Linhas de referência</Text>
        <Text style={s.hint}>
          Cores das linhas do gráfico de duração no Histórico: a sua média e a progressão
          barra a barra. A linha da OMS fica sempre em cinza. Ficam fora da paleta acima de
          propósito — assim não se confundem com nenhum tipo de atividade e não mudam quando
          você troca as cores dos gráficos. Sincroniza entre os aparelhos.
        </Text>

        {REFERENCE_LINE_SCHEMES.map((r) => {
          const selected = r.id === scheme;
          return (
            <Pressable
              key={r.id}
              onPress={() => updatePreferences({ referenceLineScheme: r.id })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Linhas ${r.label}`}
              style={({ pressed }) => [s.card, selected && s.cardSelected, pressed && s.pressed]}
            >
              <LinesPreview average={r[themeMode].average} series={r[themeMode].series} />
              <View style={s.meta}>
                <Text style={s.name}>{r.label}</Text>
                <Text style={s.sub}>{r.hint}</Text>
              </View>
              <View style={[s.check, selected && s.checkOn]}>
                {selected && <Ionicons name="checkmark" size={15} color="#fff" />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: colors.ink },
  pressed: { opacity: 0.6 },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
  hint: { fontSize: 13, color: colors.ink3, lineHeight: 18, marginBottom: spacing.sm, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.ink2, marginTop: spacing.xl, paddingHorizontal: 4 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 14,
    ...shadows.card,
  },
  cardSelected: { borderColor: colors.primary },
  meta: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.ink3 },
  check: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
