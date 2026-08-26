import React, { useCallback, useMemo } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activityDays, activityRecap, buildPeriodRecap, buildWeek, buildWeekHighlights, countRecap, localDateStr, metricRecap, readinessInputsByDay, readinessSeries, type HealthHighlightInput, type HighlightIcon, weekDatesOf, wellnessSummary } from '@vitale/shared';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useActivitiesStore } from '../../store/activities.store';
import { useHabitsStore } from '../../store/habits.store';
import { useHealthDailyStore } from '../../store/health-daily.store';
import { usePlannedWorkoutsStore } from '../../store/planned-workouts.store';
import { useRegistrosStore } from '../../store/registros.store';
import { useDailyRatingsStore } from '../../store/daily-ratings.store';

const DOW = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const HEAT_OPACITY = [0, 0.25, 0.45, 0.7, 1];

/** Métricas de saúde no recap + polaridade/formatação. */
const HEALTH_METRICS: { metric: string; higherIsWorse: boolean; icon: HighlightIcon; decimals: number; unit: string }[] = [
  { metric: 'sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'fcRepouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
  { metric: 'vfc', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
];

/** Ícone neutro do shared → nome do Ionicons. */
const ICON_MAP: Record<HighlightIcon, string> = {
  workout: 'barbell-outline', distance: 'walk-outline', sleep: 'moon-outline', heart: 'heart-outline',
  hrv: 'pulse-outline', habit: 'checkmark-circle-outline', warning: 'warning-outline', money: 'wallet-outline',
};

const LOAD_LABEL: Record<string, string> = { baixa: 'Carga baixa', moderada: 'Carga moderada', alta: 'Carga alta' };

/** Nível 0–4 de intensidade do heatmap a partir do valor vs alvo do hábito. */
function heatLevel(value: number, target?: number): number {
  if (value <= 0) return 0;
  const ratio = target && target > 0 ? Math.min(1, value / target) : 1;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  if (ratio < 1) return 3;
  return 4;
}

export default function SemanaScreen() {
  const styles = useThemedStyles(createStyles);
  const tabBarHeight = useTabBarHeight();
  const tabBarScroll = useTabBarScroll();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const allActs = useActivitiesStore((s) => s._all);
  const loadActs = useActivitiesStore((s) => s.load);
  const habits = useHabitsStore((s) => s.habits);
  const windowByHabit = useHabitsStore((s) => s.windowByHabit);
  const loadHabits = useHabitsStore((s) => s.load);
  const rows = useHealthDailyStore((s) => s.rows);
  const seriesFor = useHealthDailyStore((s) => s.seriesFor);
  const valuesByDay = useHealthDailyStore((s) => s.valuesByDay);
  const loadHealth = useHealthDailyStore((s) => s.load);
  const planned = usePlannedWorkoutsStore((s) => s.planned);
  const loadPlanned = usePlannedWorkoutsStore((s) => s.load);
  const registros = useRegistrosStore((s) => s.registros);
  const registroLogs = useRegistrosStore((s) => s.recentLogs);
  const loadRegistros = useRegistrosStore((s) => s.load);
  const ratingsWindow = useDailyRatingsStore((s) => s.window);
  const ratingsValuesByDay = useDailyRatingsStore((s) => s.valuesByDay);
  const loadRatings = useDailyRatingsStore((s) => s.load);

  useFocusEffect(
    useCallback(() => {
      void loadActs(true);
      void loadHabits();
      void loadHealth(true);
      void loadPlanned();
      void loadRegistros();
      void loadRatings();
    }, [loadActs, loadHabits, loadHealth, loadPlanned, loadRegistros, loadRatings]),
  );

  const now = useMemo(() => new Date(), []);
  const weekDates = useMemo(() => weekDatesOf(), []);
  const todayStr = localDateStr();
  const todayIdx = weekDates.indexOf(todayStr);

  const visible = useMemo(() => allActs.filter((a) => !a.hidden), [allActs]);

  const inputsByDay = useMemo(
    () => readinessInputsByDay({
      sono: seriesFor('sono'), fcRepouso: seriesFor('fcRepouso'),
      vfc: seriesFor('vfc'), aneis: seriesFor('aneis'),
    }),
    [rows, seriesFor],
  );
  const actDays = useMemo(() => activityDays(visible), [visible]);
  const readinessByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of readinessSeries(inputsByDay, actDays, 63)) if (p.score != null) map.set(p.date, p.score);
    return map;
  }, [inputsByDay, actDays]);

  const weekRecap = useMemo(() => buildPeriodRecap(visible, readinessByDay, 7, now), [visible, readinessByDay, now]);
  const wellness = useMemo(() => wellnessSummary(inputsByDay, visible, now), [inputsByDay, visible, now]);
  const actRecap = useMemo(() => activityRecap(visible, now), [visible, now]);
  const week = useMemo(() => buildWeek(planned, visible), [planned, visible]);

  const goodHabits = useMemo(() => habits.filter((h) => !h.bad), [habits]);
  const badHabits = useMemo(() => habits.filter((h) => h.bad), [habits]);

  /** Dias (YYYY-MM-DD) com valor > 0 de um hábito, a partir da janela em memória. */
  const daysWithValue = useCallback(
    (habitId: string) => Object.entries(windowByHabit[habitId] ?? {}).filter(([, v]) => v > 0).map(([d]) => d),
    [windowByHabit],
  );

  // Check-ins de hábitos bons na semana corrente / possíveis (bons × 7).
  const habitCheckins = useMemo(() => {
    const inWeek = new Set(weekDates);
    let n = 0;
    for (const h of goodHabits) for (const d of daysWithValue(h.id)) if (inWeek.has(d)) n += 1;
    return { done: n, total: goodHabits.length * 7 };
  }, [goodHabits, daysWithValue, weekDates]);

  const treinos = useMemo(() => {
    const total = planned.filter((p) => p.kind !== 'rest').length;
    const done = week.reduce((acc, d) => acc + d.workouts.filter((w) => w.done).length, 0);
    return { done, total };
  }, [planned, week]);

  const highlights = useMemo(() => {
    const health: HealthHighlightInput[] = HEALTH_METRICS.map((m) => ({
      metric: m.metric,
      label: m.metric === 'sono' ? 'Sono' : m.metric === 'fcRepouso' ? 'FC repouso' : 'VFC',
      recap: metricRecap(valuesByDay(m.metric), now),
      higherIsWorse: m.higherIsWorse,
      icon: m.icon,
      decimals: m.decimals,
      unit: m.unit,
    }));
    // Ratings subjetivos (1–5): subir é bom; entram como métricas de bem-estar.
    health.push(
      { metric: 'sleepPerc', label: 'Sono (percebido)', recap: metricRecap(ratingsValuesByDay('sleep'), now), higherIsWorse: false, icon: 'sleep', decimals: 1, unit: '/5' },
      { metric: 'dayPerc', label: 'Dia (percebido)', recap: metricRecap(ratingsValuesByDay('day'), now), higherIsWorse: false, icon: 'heart', decimals: 1, unit: '/5' },
    );
    return buildWeekHighlights({
      activities: actRecap,
      health,
      goodHabits: goodHabits.map((h) => ({ name: h.name, recap: countRecap(daysWithValue(h.id), now) })),
      badHabits: [
        ...badHabits.map((h) => ({ name: h.name, recap: countRecap(daysWithValue(h.id), now) })),
        ...registros.map((r) => ({ name: r.name, recap: countRecap(registroLogs[r.id] ?? [], now) })),
      ],
    }).slice(0, 5);
  }, [actRecap, valuesByDay, goodHabits, badHabits, registros, registroLogs, daysWithValue, ratingsValuesByDay, ratingsWindow, now]);

  const readiness = weekRecap.avgReadiness.current;
  const distKm = actRecap.distanceM.current / 1000;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Semana</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]} {...tabBarScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.greet}>
          <Text style={styles.eyebrow}>{weekRangeLabel(weekDates)}</Text>
          <Text style={styles.title}>Sua semana</Text>
        </View>

        {/* Mini week strip */}
        <View style={styles.strip}>
          {weekDates.map((date, i) => (
            <View key={date} style={[styles.day, i === todayIdx && styles.dayActive, i < todayIdx && styles.dayPast]}>
              <Text style={[styles.dayLabel, i === todayIdx && styles.dayLabelActive]}>{DOW[i]}</Text>
              <Text style={[styles.dayNum, i === todayIdx && styles.dayNumActive]}>{Number(date.slice(8, 10))}</Text>
            </View>
          ))}
        </View>

        {/* Stat tiles */}
        <View style={styles.grid}>
          <StatTile icon="barbell-outline" iconBg="#F25C2B22" iconColor="#F25C2B" label="Treinos"
            value={treinos.total > 0 ? `${treinos.done}/${treinos.total}` : `${treinos.done}`}
            sub={treinos.total > 0 ? `${Math.round((treinos.done / treinos.total) * 100)}% concluído` : 'na semana'} />
          <StatTile icon="checkmark-circle-outline" iconBg="#6FA86A22" iconColor="#6FA86A" label="Hábitos"
            value={habitCheckins.total > 0 ? `${habitCheckins.done}/${habitCheckins.total}` : '—'}
            sub={habitCheckins.total > 0 ? `${Math.round((habitCheckins.done / habitCheckins.total) * 100)}%` : 'sem hábitos'} />
          <StatTile icon="pulse-outline" iconBg="#6E8CC922" iconColor="#6E8CC9" label="Prontidão"
            value={readiness > 0 ? `${readiness}` : '—'} sub="média da semana" />
          <StatTile icon="walk-outline" iconBg="#1F1B1622" iconColor="#1F1B16" label="Distância"
            value={distKm > 0 ? `${distKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : '—'} sub="percorrida" />
        </View>

        {/* Destaques da semana (recap automático) */}
        {highlights.length > 0 && (
          <>
            <SectionLabel>Destaques da semana</SectionLabel>
            <View style={[styles.card, styles.pad]}>
              {highlights.map((h, i) => (
                <View key={h.id} style={[styles.hlRow, i === highlights.length - 1 && styles.noBorder]}>
                  <View style={[styles.hlIco, h.tone === 'good' && styles.hlIcoGood, h.tone === 'bad' && styles.hlIcoBad]}>
                    <Ionicons name={ICON_MAP[h.icon] as any} size={15}
                      color={h.tone === 'good' ? colors.green : h.tone === 'bad' ? colors.red : colors.ink2} />
                  </View>
                  <Text style={styles.hlText}>{h.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Heatmap de hábitos */}
        {goodHabits.length > 0 && (
          <>
            <SectionLabel>Hábitos da semana</SectionLabel>
            <View style={[styles.card, styles.pad]}>
              {goodHabits.map((h) => (
                <View key={h.id} style={styles.heatRow}>
                  <Text style={styles.heatLabel} numberOfLines={1}>{h.name}</Text>
                  <View style={styles.heatCells}>
                    {weekDates.map((date, i) => {
                      const v = windowByHabit[h.id]?.[date] ?? 0;
                      const level = heatLevel(v, h.target);
                      return (
                        <View key={date} style={[
                          styles.heatCell,
                          { backgroundColor: level === 0 ? colors.surfaceMute : `rgba(242, 92, 43, ${HEAT_OPACITY[level]})` },
                          i === todayIdx && styles.heatToday,
                          i > todayIdx && styles.heatFuture,
                        ]} />
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Treinos planejados */}
        <SectionLabel>Treinos planejados</SectionLabel>
        <View style={styles.card}>
          {week.map((d, i) => {
            const w = d.workouts[0];
            const isRest = !w || w.kind === 'rest';
            return (
              <View key={d.date} style={[styles.tRow, i === week.length - 1 && styles.noBorder, isRest && styles.rest]}>
                <View style={styles.tDate}>
                  <Text style={styles.tDay}>{d.label}</Text>
                  <Text style={styles.tNum}>{Number(d.date.slice(8, 10))}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.tType}>{w ? w.type : 'Descanso'}</Text>
                  <Text style={styles.tMeta}>
                    {!w ? 'Sem treino' : w.kind === 'rest' ? 'Descanso ativo'
                      : w.distKm ? `${w.distKm}km · ${w.durMin}min`
                      : `${w.durMin}min`}
                  </Text>
                </View>
                {w?.done ? <Ionicons name="checkmark" size={18} color="#6FA86A" /> :
                  isRest ? <Ionicons name="moon-outline" size={18} color={colors.ink3} /> :
                  <View style={styles.ring} />}
              </View>
            );
          })}
        </View>

        {/* Insight de saúde — carga vs prontidão */}
        {(wellness.overall != null || readiness > 0) && (
          <>
            <SectionLabel>Saúde & carga</SectionLabel>
            <View style={[styles.card, styles.pad, styles.insight]}>
              <View style={styles.insightCol}>
                <Text style={styles.insightVal}>{wellness.overall ?? '—'}</Text>
                <Text style={styles.insightLbl}>Prontidão hoje</Text>
              </View>
              <View style={styles.insightCol}>
                <Text style={styles.insightVal}>{wellness.sport.sessions}</Text>
                <Text style={styles.insightLbl}>Treinos · {wellness.sport.hardMin}min fortes</Text>
              </View>
              <View style={styles.insightCol}>
                <Text style={styles.insightVal}>{LOAD_LABEL[wellness.sport.loadLabel].split(' ')[1]}</Text>
                <Text style={styles.insightLbl}>Carga da semana</Text>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

/** "18 — 24 mai" a partir das datas seg–dom. */
function weekRangeLabel(weekDates: string[]): string {
  if (weekDates.length === 0) return '';
  const start = new Date(`${weekDates[0]}T00:00:00`);
  const end = new Date(`${weekDates[weekDates.length - 1]}T00:00:00`);
  const month = end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return `${start.getDate()} — ${end.getDate()} ${month}`.toUpperCase();
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm },
  greet: { paddingVertical: spacing.lg },
  eyebrow: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontFamily: fonts.sansSemiBold },
  title: { fontFamily: fonts.serif, fontSize: 32, marginTop: 4, color: colors.ink },

  strip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 18, padding: 12, paddingHorizontal: 8, marginBottom: 16 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12 },
  dayActive: { backgroundColor: colors.primary },
  dayPast: { opacity: 0.5 },
  dayLabel: { fontSize: 10, color: colors.ink3, letterSpacing: 0.6, fontFamily: fonts.sansSemiBold },
  dayLabelActive: { color: colors.primarySoft },
  dayNum: { fontSize: 18, fontFamily: fonts.sansSemiBold, color: colors.ink },
  dayNumActive: { color: '#fff' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 12 },
  tileIco: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tileLbl: { fontSize: 11.5, color: colors.ink3, marginTop: 8, fontFamily: fonts.sansSemiBold, letterSpacing: 0.8, textTransform: 'uppercase' },
  tileVal: { fontSize: 22, fontFamily: fonts.sansSemiBold, marginTop: 2, color: colors.ink },
  tileSub: { fontSize: 11, fontFamily: fonts.sans, color: colors.ink3, marginTop: 1 },

  card: { backgroundColor: colors.surface, borderRadius: 18, marginTop: 8, overflow: 'hidden' },
  pad: { padding: 14 },

  hlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  hlIco: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMute },
  hlIcoGood: { backgroundColor: '#6FA86A22' },
  hlIcoBad: { backgroundColor: '#D9491B22' },
  hlText: { flex: 1, fontSize: 13.5, color: colors.ink, fontFamily: fonts.sansMedium, lineHeight: 18 },

  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heatLabel: { width: 90, fontSize: 11, color: colors.ink2, fontFamily: fonts.sansMedium },
  heatCells: { flex: 1, flexDirection: 'row', gap: 4 },
  heatCell: { flex: 1, height: 22, borderRadius: 6 },
  heatToday: { borderWidth: 1.5, borderColor: colors.ink },
  heatFuture: { opacity: 0.4 },

  tRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  noBorder: { borderBottomWidth: 0 },
  rest: { opacity: 0.5 },
  tDate: { width: 36, alignItems: 'center' },
  tDay: { fontSize: 10, color: colors.ink3, fontFamily: fonts.sansSemiBold },
  tNum: { fontSize: 16, fontFamily: fonts.sansBold, color: colors.ink },
  flex: { flex: 1 },
  tType: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink },
  tMeta: { fontSize: 12, fontFamily: fonts.sans, color: colors.ink3 },
  ring: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, borderColor: colors.ink4 },

  insight: { flexDirection: 'row', justifyContent: 'space-between' },
  insightCol: { flex: 1, alignItems: 'center' },
  insightVal: { fontSize: 22, fontFamily: fonts.sansBold, color: colors.ink },
  insightLbl: { fontSize: 10.5, fontFamily: fonts.sans, color: colors.ink3, marginTop: 2, textAlign: 'center' },
});
