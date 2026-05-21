import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CounterHabit } from '@vitale/shared';
import { useHabitsStore } from '../../store/habits.store';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { colors, spacing, radii, shadows, MOD } from '../../theme';

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.habito;
}

function summary(h: CounterHabit): string {
  const tag = h.bad ? 'A evitar · ' : '';
  const inc = `+${fmt(h.step)} ${h.unit}`;
  if (h.target == null) return `${tag}Contador · ${inc}`;
  const goal = h.direction === 'at_least' ? `Meta ${fmt(h.target)} ${h.unit}` : `Limite ${fmt(h.target)} ${h.unit}`;
  return `${tag}${goal} · ${inc}`;
}

export default function HabitosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const allHabits = useHabitsStore((s) => s.allHabits);
  const loading = useHabitsStore((s) => s.loading);
  const loadAll = useHabitsStore((s) => s.loadAll);
  const archiveHabit = useHabitsStore((s) => s.archiveHabit);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const active = allHabits.filter((h) => h.active);
  const archived = allHabits.filter((h) => !h.active);

  const Row = ({ h, last }: { h: CounterHabit; last?: boolean }) => {
    const mod = modColor(h.color);
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/habitos/editor', params: { id: h.id } })}
        style={({ pressed }) => [styles.row, last && styles.noBorder, pressed && styles.pressed]}
      >
        <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
          <Ionicons name={habitIconToIonicon(h.icon)} size={20} color={mod.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.name, !h.active && styles.muted]}>{h.name}</Text>
          <Text style={styles.summary}>{summary(h)}</Text>
        </View>
        <Pressable
          onPress={() => archiveHabit(h.id, !h.active)}
          hitSlop={10}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name={h.active ? 'archive-outline' : 'arrow-undo-outline'} size={20} color={colors.ink3} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Habitos</Text>
        <Pressable onPress={() => router.push('/habitos/editor')} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {loading && allHabits.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : allHabits.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="add-circle-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhum hábito ainda</Text>
          <Text style={styles.emptyText}>Crie um contador (água, cigarro…) para acompanhar no dia a dia.</Text>
          <Pressable onPress={() => router.push('/habitos/editor')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Novo hábito</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {active.length > 0 && (
            <>
              <Text style={styles.section}>Ativos</Text>
              <View style={styles.card}>
                {active.map((h, i) => (
                  <Row key={h.id} h={h} last={i === active.length - 1} />
                ))}
              </View>
            </>
          )}
          {archived.length > 0 && (
            <>
              <Text style={styles.section}>Arquivados</Text>
              <View style={styles.card}>
                {archived.map((h, i) => (
                  <Row key={h.id} h={h} last={i === archived.length - 1} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  section: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], overflow: 'hidden', ...shadows.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  noBorder: { borderBottomWidth: 0 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  muted: { color: colors.ink3 },
  summary: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  action: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm },
  emptyText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.pill, marginTop: spacing.md },
  ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
