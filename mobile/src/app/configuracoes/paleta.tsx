import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHART_PALETTES, type ChartPalette, type PaletteRoles } from '../../lib/chart-palettes';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';

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
});

export default function ChartPaletteScreen() {
  const s = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const paletteId = useChartPaletteStore((st) => st.paletteId);
  const setPalette = useChartPaletteStore((st) => st.setPalette);

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
