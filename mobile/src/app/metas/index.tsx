import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Goal, GoalProgress } from '@vitale/shared';
import {
  useGoalsStore,
  buildGoalContext,
  computeProgress,
} from '../../store/goals.store';
import { useActivitiesStore } from '../../store/activities.store';
import { useHabitsStore } from '../../store/habits.store';
import { useAuthStore } from '../../store/auth.store';
import { familyLabel, goalValueText, goalPct } from '../../lib/goal-format';
import { colors, spacing, radii, shadows, moduleColors, useThemedStyles } from '../../theme';

interface GoalVM {
  goal: Goal;
  family: string;
  value: string;
  pct: number;
  achieved: boolean;
}

function vm(goal: Goal, p: GoalProgress | undefined): GoalVM {
  return {
    goal,
    family: familyLabel(goal.family),
    value: p ? goalValueText(goal, p) : '—',
    pct: p ? goalPct(p) : 0,
    achieved: p?.achieved ?? false,
  };
}

export default function MetasScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const goals = useGoalsStore((s) => s.goals);
  const doneOccurrences = useGoalsStore((s) => s.doneOccurrences);
  const habitLogs = useGoalsStore((s) => s.habitLogs);
  const loading = useGoalsStore((s) => s.loading);
  const loaded = useGoalsStore((s) => s.loaded);
  const load = useGoalsStore((s) => s.load);
  const deleteGoal = useGoalsStore((s) => s.deleteGoal);
  const user = useAuthStore((s) => s.user);

  // Assina as fontes que vivem em outros stores para re-renderizar quando carregam.
  const activitiesRaw = useActivitiesStore((s) => s._all);
  const habitDefs = useHabitsStore((s) => s.habits);

  const [selectedCat, setSelectedCat] = useState<string>('todas');

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.active).sort((a, b) => a.sort - b.sort),
    [goals],
  );

  const progress = useMemo(() => {
    const ctx = buildGoalContext({ doneOccurrences, habitLogs });
    return computeProgress(activeGoals, ctx);
    // activitiesRaw/habitDefs entram como deps para reavaliar quando carregam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoals, doneOccurrences, habitLogs, activitiesRaw, habitDefs]);

  const categories = useMemo(
    () => [...new Set(activeGoals.map((g) => g.cat))].sort(),
    [activeGoals],
  );

  const filtered = useMemo(
    () =>
      activeGoals
        .filter((g) => selectedCat === 'todas' || g.cat === selectedCat)
        .map((g) => vm(g, progress.get(g.id))),
    [activeGoals, selectedCat, progress],
  );

  const subtitle = useMemo(() => {
    if (activeGoals.length === 0) return 'Nenhuma meta ainda';
    const avg = Math.round(
      activeGoals.reduce((s, g) => s + (progress.get(g.id)?.pct ?? 0), 0) / activeGoals.length,
    );
    const noun = activeGoals.length === 1 ? 'meta ativa' : 'metas ativas';
    return `${activeGoals.length} ${noun} · média ${avg}%`;
  }, [activeGoals, progress]);

  const confirmRemove = (m: GoalVM) => {
    Alert.alert('Remover meta', `Remover a meta "${m.goal.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void deleteGoal(m.goal.id) },
    ]);
  };

  const Card = ({ m }: { m: GoalVM }) => {
    const mc = moduleColors(m.goal.cat);
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/metas/editor', params: { id: m.goal.id } })}
        onLongPress={() => confirmRemove(m)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.dot, { backgroundColor: mc.accent }]} />
          <View style={styles.flex}>
            <Text style={styles.name}>{m.goal.title}</Text>
            <Text style={styles.sub}>
              {m.family} · {m.goal.year}
            </Text>
          </View>
          {m.achieved && (
            <View style={[styles.badge, { backgroundColor: colors.greenSoft }]}>
              <Ionicons name="checkmark" size={13} color={colors.green} />
              <Text style={[styles.badgeText, { color: colors.green }]}>concluída</Text>
            </View>
          )}
          <Pressable
            onPress={() => confirmRemove(m)}
            hitSlop={10}
            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={17} color={colors.ink3} />
          </Pressable>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.value}>{m.value}</Text>
          <Text style={styles.pct}>{m.pct}%</Text>
        </View>

        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${m.pct}%`, backgroundColor: m.achieved ? colors.green : mc.accent },
            ]}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Metas</Text>
        <Pressable
          onPress={() => router.push('/metas/editor')}
          hitSlop={12}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={24} color={colors.ink} />
        </Pressable>
      </View>

      {loading && goals.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loaded && activeGoals.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="golf-outline" size={40} color={colors.ink4} />
          <Text style={styles.emptyTitle}>Nenhuma meta ativa</Text>
          <Text style={styles.emptyText}>
            Crie metas anuais para acompanhar o progresso do ano.
          </Text>
          <Pressable
            onPress={() => router.push('/metas/editor')}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.ctaText}>Nova meta</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {['todas', ...categories].map((c) => {
                const on = selectedCat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setSelectedCat(c)}
                    style={({ pressed }) => [
                      styles.chip,
                      on && styles.chipOn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {c === 'todas' ? 'Todas' : c}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma meta nesta categoria.</Text>
          ) : (
            filtered.map((m) => <Card key={m.goal.id} m={m} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
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
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 20,
      fontFamily: 'InstrumentSerif',
      color: colors.ink,
    },

    scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    subtitle: { fontSize: 13.5, color: colors.ink3, marginBottom: spacing.md, marginLeft: 2 },

    chips: { gap: spacing.sm, paddingBottom: spacing.md, paddingRight: spacing.lg },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 13, fontWeight: '600', color: colors.ink2, textTransform: 'capitalize' },
    chipTextOn: { color: colors.bg },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radii['2xl'],
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.card,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    flex: { flex: 1 },
    name: { fontSize: 15.5, fontWeight: '700', color: colors.ink },
    sub: { fontSize: 12.5, color: colors.ink3, marginTop: 2, textTransform: 'capitalize' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    badgeText: { fontSize: 11.5, fontWeight: '700' },
    removeBtn: { width: 30, height: 30, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },

    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    value: { fontSize: 14, fontWeight: '600', color: colors.ink2, fontFamily: 'GeistMono' },
    pct: { fontSize: 13, fontWeight: '700', color: colors.ink3, fontFamily: 'GeistMono' },

    track: {
      height: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMute,
      marginTop: spacing.sm,
      overflow: 'hidden',
    },
    fill: { height: 8, borderRadius: radii.pill },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: spacing.sm },
    emptyText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 19 },
    cta: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.pill, marginTop: spacing.md },
    ctaText: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
  });
