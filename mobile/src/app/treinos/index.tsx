import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Activity, PlannedWorkout } from '@vitale/shared';
import { usePlannedWorkoutsStore } from '../../store/planned-workouts.store';
import { useActivitiesStore } from '../../store/activities.store';
import { useAuthStore } from '../../store/auth.store';
import { BarChart } from '../../components/charts/BarChart';
import { colors, fonts, moduleColors, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { ACTIVITY_CYCLING, ACTIVITY_RUNNING, ACTIVITY_YOGA, buildWeek, buildWeeklyVolume, type VolumeMetric } from '@vitale/shared';

const CHART_W = Dimensions.get('window').width - spacing.lg * 2 - 28;

// Função, não constante: as cores seguem tema e paleta. Chame no render.
function volumePanels(): { title: string; activityId: number; metric: VolumeMetric; unit: string; color: string }[] {
  return [
    { title: 'Corrida', activityId: ACTIVITY_RUNNING, metric: 'distance', unit: 'km', color: moduleColors('treino').accent },
    { title: 'Bicicleta', activityId: ACTIVITY_CYCLING, metric: 'distance', unit: 'km', color: moduleColors('agua').accent },
    { title: 'Yoga', activityId: ACTIVITY_YOGA, metric: 'duration', unit: 'min', color: moduleColors('habito').accent },
  ];
}

type Kind = PlannedWorkout['kind'];

const KIND_META: Record<Kind, { label: string; mod: string }> = {
  strength: { label: 'Força', mod: 'treino' },
  endurance: { label: 'Endurance', mod: 'agua' },
  easy: { label: 'Leve', mod: 'habito' },
  rest: { label: 'Descanso', mod: 'casa' },
};

function metaLine(w: PlannedWorkout): string {
  const kind = KIND_META[w.kind].label;
  if (w.kind === 'rest') return kind;
  if (w.kind === 'endurance' && w.distKm) return `${w.distKm}km · ${kind}`;
  return `${w.durMin}min · ${kind}`;
}

/** Painel de volume semanal (6 semanas) de um tipo de atividade real. */
function VolumePanel({
  visible,
  config,
  styles,
}: {
  visible: Activity[];
  config: ReturnType<typeof volumePanels>[number];
  styles: ReturnType<typeof createStyles>;
}) {
  const buckets = useMemo(
    () => buildWeeklyVolume(visible, config.activityId, config.metric, 6),
    [visible, config.activityId, config.metric],
  );
  const total = buckets.reduce((s, b) => s + b.value, 0);
  const isEmpty = total === 0;

  return (
    <View style={styles.volCard}>
      <View style={styles.volHead}>
        <Text style={styles.volTitle}>{config.title}</Text>
        <Text style={[styles.volTotal, { color: config.color }]}>
          {isEmpty ? '—' : `${Math.round(total * 10) / 10} ${config.unit}`}
        </Text>
      </View>
      {isEmpty ? (
        <Text style={styles.volEmpty}>Sem atividades sincronizadas</Text>
      ) : (
        <BarChart buckets={buckets} width={CHART_W} height={120} color={config.color} />
      )}
    </View>
  );
}

export default function TreinosPlannerScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const planned = usePlannedWorkoutsStore((s) => s.planned);
  const loading = usePlannedWorkoutsStore((s) => s.loading);
  const load = usePlannedWorkoutsStore((s) => s.load);
  const allActivities = useActivitiesStore((s) => s._all);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  const visible = useMemo(() => allActivities.filter((a) => !a.hidden), [allActivities]);
  const week = useMemo(() => buildWeek(planned, visible), [planned, visible]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Treinos</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading && planned.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Planeje a semana. Treinos viram “feito” ao casar com uma atividade sincronizada do mesmo dia.</Text>

          <Text style={styles.section}>Volume · 6 semanas</Text>
          {volumePanels().map((c) => (
            <VolumePanel key={c.title} visible={visible} config={c} styles={styles} />
          ))}

          <Text style={styles.section}>Semana</Text>
          {week.map((day) => (
            <View key={day.date} style={[styles.dayCard, day.isToday && styles.dayToday]}>
              <View style={styles.dayHead}>
                <View style={styles.dayHeadLeft}>
                  <Text style={[styles.dayLabel, day.isToday && styles.todayText]}>{day.label}</Text>
                  <Text style={[styles.dayNum, day.isToday && styles.todayText]}>{day.date.slice(8)}</Text>
                  {day.isToday && <View style={styles.todayDot} />}
                </View>
                <Pressable
                  onPress={() => router.push({ pathname: '/treinos/editor', params: { date: day.date } })}
                  hitSlop={8}
                  style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={20} color={colors.ink2} />
                </Pressable>
              </View>

              {day.workouts.length === 0 ? (
                <Text style={styles.dayEmpty}>—</Text>
              ) : (
                day.workouts.map((w) => {
                  const mc = moduleColors(KIND_META[w.kind].mod);
                  return (
                    <Pressable
                      key={w.id}
                      onPress={() => router.push({ pathname: '/treinos/editor', params: { id: w.id } })}
                      style={({ pressed }) => [styles.wk, pressed && styles.pressed]}
                    >
                      <View style={[styles.wkBar, { backgroundColor: mc.accent }]} />
                      <View style={styles.flex}>
                        <Text style={styles.wkType}>{w.type}</Text>
                        <Text style={styles.wkMeta}>{metaLine(w)}</Text>
                      </View>
                      {w.done && (
                        <View style={[styles.doneBadge, { backgroundColor: moduleColors('habito').tint }]}>
                          <Ionicons name="checkmark" size={15} color={moduleColors('habito').accent} />
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </View>
          ))}
        </ScrollView>
      )}
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  intro: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3, lineHeight: 18, marginBottom: spacing.sm, marginTop: 2 },
  section: {
    fontSize: 12.5,
    fontFamily: fonts.sansBold,
    color: colors.ink2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
  },

  volCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: 14, marginBottom: 10, ...shadows.card },
  volHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  volTitle: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  volTotal: { fontSize: 14, fontFamily: fonts.monoBold },
  volEmpty: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink4, paddingVertical: 12 },

  dayCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: 14, marginBottom: 10, ...shadows.card },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeadLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  dayLabel: { fontSize: 11, fontFamily: fonts.sansBold, letterSpacing: 0.5, color: colors.ink3 },
  dayNum: { fontSize: 18, fontFamily: fonts.sansBold, color: colors.ink },
  todayText: { color: colors.primary },
  todayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, alignSelf: 'center' },
  addBtn: { width: 32, height: 32, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMute },

  dayEmpty: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink4, marginTop: 8, marginLeft: 2 },
  flex: { flex: 1 },
  wk: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: colors.surfaceMute, borderRadius: radii.lg, padding: 10 },
  wkBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  wkType: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink },
  wkMeta: { fontSize: 12.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2 },
  doneBadge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
});
