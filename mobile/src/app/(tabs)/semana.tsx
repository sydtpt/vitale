import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { WEEK, TODAY_IDX, TREINOS_SEMANA, HEATMAP } from '../../services/mock-data';

export default function SemanaScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Semana</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.greet}>
        <Text style={styles.eyebrow}>SEMANA 21</Text>
        <Text style={styles.title}>18 — 24 maio</Text>
      </View>

      {/* Mini week strip */}
      <View style={styles.strip}>
        {WEEK.map((d, i) => (
          <View key={d} style={[styles.day, i === TODAY_IDX && styles.dayActive, i < TODAY_IDX && styles.dayPast]}>
            <Text style={[styles.dayLabel, i === TODAY_IDX && styles.dayLabelActive]}>{d}</Text>
            <Text style={[styles.dayNum, i === TODAY_IDX && styles.dayNumActive]}>{18 + i}</Text>
          </View>
        ))}
      </View>

      {/* Stat tiles */}
      <View style={styles.grid}>
        <StatTile icon="barbell-outline" iconBg="#F25C2B22" iconColor="#F25C2B" label="Treinos" value="3/5" sub="60% concluído" />
        <StatTile icon="flame-outline" iconBg="#F5B94622" iconColor="#F5B946" label="kcal/dia" value="2.041" sub="média" />
        <StatTile icon="golf-outline" iconBg="#6FA86A22" iconColor="#6FA86A" label="Hábitos" value="22/28" sub="79%" />
        <StatTile icon="wallet-outline" iconBg="#1F1B1622" iconColor="#1F1B16" label="Gastos" value="R$ 412" sub="-12% vs anterior" />
      </View>

      {/* Heatmap (simplified) */}
      <SectionLabel>Hábitos da semana</SectionLabel>
      <View style={[styles.card, styles.pad]}>
        {Object.entries(HEATMAP).map(([name, values]) => (
          <View key={name} style={styles.heatRow}>
            <Text style={styles.heatLabel}>{name}</Text>
            <View style={styles.heatCells}>
              {values.map((v, i) => (
                <View key={i} style={[
                  styles.heatCell,
                  { backgroundColor: v === 0 ? colors.surfaceMute : `rgba(242, 92, 43, ${[0, 0.25, 0.45, 0.7, 1][v]})` },
                  i === TODAY_IDX && styles.heatToday,
                  i > TODAY_IDX && styles.heatFuture,
                ]} />
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Treinos planejados */}
      <SectionLabel>Treinos planejados</SectionLabel>
      <View style={styles.card}>
        {TREINOS_SEMANA.map((t, i) => (
          <View key={t.day} style={[styles.tRow, i === TREINOS_SEMANA.length - 1 && styles.noBorder, t.rest && styles.rest]}>
            <View style={styles.tDate}>
              <Text style={styles.tDay}>{t.day}</Text>
              <Text style={styles.tNum}>{t.date}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.tType}>{t.type}</Text>
              <Text style={styles.tMeta}>
                {t.rest ? 'Descanso ativo' : t.run ? `${t.run.dist}km · ${t.run.pace}/km` : `${t.dur}min · ${t.vol > 0 ? t.vol + 'kg vol' : 'a iniciar'}`}
              </Text>
            </View>
            {t.done ? <Ionicons name="checkmark" size={18} color="#6FA86A" /> :
              t.rest ? <Ionicons name="moon-outline" size={18} color={colors.ink3} /> :
              <View style={styles.ring} />}
          </View>
        ))}
      </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function StatTile({ icon, iconBg, iconColor, label, value, sub }: {
  icon: string; iconBg: string; iconColor: string; label: string; value: string; sub: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIco, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={styles.tileLbl}>{label}</Text>
      <Text style={styles.tileVal}>{value}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  headerSpacer: { width: 36, height: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm },
  greet: { paddingVertical: spacing.lg },
  eyebrow: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontWeight: '600' },
  title: { fontFamily: 'InstrumentSerif', fontSize: 32, marginTop: 4, color: colors.ink },

  strip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 18, padding: 12, paddingHorizontal: 8, marginBottom: 16 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12 },
  dayActive: { backgroundColor: colors.primary },
  dayPast: { opacity: 0.5 },
  dayLabel: { fontSize: 10, color: colors.ink3, letterSpacing: 0.6, fontWeight: '600' },
  dayLabelActive: { color: colors.primarySoft },
  dayNum: { fontSize: 18, fontWeight: '600', color: colors.ink },
  dayNumActive: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 12 },
  tileIco: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileLbl: { fontSize: 11.5, color: colors.ink3, marginTop: 8, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  tileVal: { fontSize: 22, fontWeight: '600', marginTop: 2, color: colors.ink },
  tileSub: { fontSize: 11, color: colors.ink3, marginTop: 1 },

  card: { backgroundColor: colors.surface, borderRadius: 18, marginTop: 8, overflow: 'hidden' },
  pad: { padding: 14 },

  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heatLabel: { width: 90, fontSize: 11, color: colors.ink2, fontWeight: '500' },
  heatCells: { flex: 1, flexDirection: 'row', gap: 4 },
  heatCell: { flex: 1, height: 22, borderRadius: 6 },
  heatToday: { borderWidth: 1.5, borderColor: colors.ink },
  heatFuture: { opacity: 0.4 },

  tRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  noBorder: { borderBottomWidth: 0 },
  rest: { opacity: 0.5 },
  tDate: { width: 36, alignItems: 'center' },
  tDay: { fontSize: 10, color: colors.ink3, fontWeight: '600' },
  tNum: { fontSize: 16, fontWeight: '700', color: colors.ink },
  flex: { flex: 1 },
  tType: { fontSize: 14, fontWeight: '600', color: colors.ink },
  tMeta: { fontSize: 12, color: colors.ink3 },
  ring: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, borderColor: colors.ink4 },
});
