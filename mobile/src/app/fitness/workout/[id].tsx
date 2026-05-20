import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFitnessStore,
  getActivityMeta,
  hasGpsRoute,
  elevationGain,
} from '../../../store/fitness.store';
import { WorkoutMap } from '../../../components/WorkoutMap';
import {
  formatFullDate,
  formatTime,
  formatDuration,
  formatDistance,
  formatPace,
  formatElevation,
} from '../../../lib/workout-format';
import { colors, spacing, radii, MOD, shadows } from '../../../theme';

type InfoRow = { label: string; value: string };

function Stat({
  icon,
  value,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  caption: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={MOD.treino.accent} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

export default function WorkoutDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workouts = useFitnessStore((s) => s.workouts);
  const loadRoute = useFitnessStore((s) => s.loadRoute);
  const route = useFitnessStore((s) => s.routes[id]) ?? [];

  const workout = useMemo(() => workouts.find((w) => w.id === id), [workouts, id]);

  useEffect(() => {
    if (workout && hasGpsRoute(workout.activityId)) {
      loadRoute(workout.id);
    }
  }, [workout, loadRoute]);

  const rows = useMemo<InfoRow[]>(() => {
    if (!workout) return [];
    const meta = getActivityMeta(workout.activityId);
    const distance = formatDistance(workout.distance);
    const list: InfoRow[] = [
      { label: 'Tipo', value: meta.label },
      { label: 'Nome (Health)', value: workout.activityName || '—' },
      { label: 'Código da atividade', value: String(workout.activityId) },
      { label: 'Início', value: `${formatFullDate(workout.start)} · ${formatTime(workout.start)}` },
      { label: 'Fim', value: `${formatFullDate(workout.end)} · ${formatTime(workout.end)}` },
      { label: 'Duração', value: formatDuration(workout.duration) },
      { label: 'Calorias', value: workout.calories > 0 ? `${workout.calories} kcal` : '—' },
      { label: 'Distância', value: distance ?? '—' },
      { label: 'Fonte', value: workout.sourceName || '—' },
      { label: 'ID da fonte', value: workout.sourceId || '—' },
      { label: 'Dispositivo', value: workout.device || '—' },
      {
        label: 'Rastreado',
        value: workout.tracked === undefined ? '—' : workout.tracked ? 'Sim' : 'Não',
      },
      {
        label: 'Eventos',
        value: workout.workoutEventsCount !== undefined ? String(workout.workoutEventsCount) : '—',
      },
      { label: 'ID do treino', value: workout.id },
    ];

    if (workout.metadata) {
      for (const [key, val] of Object.entries(workout.metadata)) {
        list.push({
          label: key,
          value: typeof val === 'object' ? JSON.stringify(val) : String(val),
        });
      }
    }

    return list;
  }, [workout]);

  if (!workout) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Treino não encontrado</Text>
        </View>
      </View>
    );
  }

  const meta = getActivityMeta(workout.activityId);
  const distance = formatDistance(workout.distance);
  const pace = hasGpsRoute(workout.activityId)
    ? formatPace(workout.distance, workout.duration)
    : null;
  const elevation = formatElevation(elevationGain(route));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{meta.label}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: MOD.treino.tint }]}>
            <Ionicons name={meta.icon} size={28} color={MOD.treino.accent} />
          </View>
          <Text style={styles.heroDate}>{formatFullDate(workout.start)}</Text>
          <Text style={styles.heroTime}>
            {formatTime(workout.start)} – {formatTime(workout.end)}
          </Text>

          <View style={styles.statsRow}>
            <Stat icon="time-outline" value={formatDuration(workout.duration)} caption="duração" />
            {workout.calories > 0 && (
              <Stat icon="flame-outline" value={`${workout.calories}`} caption="kcal" />
            )}
            {distance && <Stat icon="map-outline" value={distance} caption="distância" />}
            {pace && <Stat icon="speedometer-outline" value={pace} caption="min/km" />}
            {elevation && (
              <Stat icon="trending-up-outline" value={elevation} caption="elevação" />
            )}
          </View>
        </View>

        {route.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Percurso</Text>
            <View style={styles.mapCard}>
              <WorkoutMap points={route} />
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Todos os dados</Text>
        <View style={styles.infoCard}>
          {rows.map((row, i) => (
            <View
              key={`${row.label}-${i}`}
              style={[styles.infoRow, i < rows.length - 1 && styles.infoRowBorder]}
            >
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue} selectable numberOfLines={3}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'InstrumentSerif',
    color: colors.ink,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    gap: 4,
    ...shadows.card,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  heroTime: {
    fontSize: 13,
    color: colors.ink3,
    fontFamily: 'GeistMono',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  stat: {
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'GeistMono',
  },
  statCaption: {
    fontSize: 11,
    color: colors.ink3,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.xs,
    ...shadows.card,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  infoLabel: {
    fontSize: 13.5,
    color: colors.ink3,
    flexShrink: 0,
    maxWidth: '45%',
  },
  infoValue: {
    fontSize: 13.5,
    color: colors.ink,
    fontFamily: 'GeistMono',
    flex: 1,
    textAlign: 'right',
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.ink3,
  },
});
