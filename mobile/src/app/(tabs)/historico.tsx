import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivitiesStore } from '../../store/activities.store';
import { useRefreshOnForeground } from '../../hooks/useRefreshOnForeground';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import { buildOverview, type Period, type Metric } from '../../lib/activity-overview';
import { buildTypeSummaries } from '../../lib/activity-type-summary';
import { getActivityMeta } from '../../lib/workout-types';
import { formatDuration, formatDistance } from '../../lib/workout-format';
import { StackedBarChart } from '../../components/charts/StackedBarChart';
import { remapChartColor } from '../../lib/chart-palettes';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { colors, spacing, radii, shadows, MOD, themed, useTheme } from '../../theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'semana', label: 'Semana' },
  { key: 'ano', label: 'Ano' },
  { key: 'sempre', label: 'Sempre' },
];

const METRICS: { key: Metric; label: string }[] = [
  { key: 'count', label: 'Nº' },
  { key: 'duration', label: 'Duração' },
  { key: 'calories', label: 'Calorias' },
  { key: 'distance', label: 'Distância' },
];

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

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
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HistoricoTabScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const tabBarScroll = useTabBarScroll();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const _all = useActivitiesStore((s) => s._all);
  const loading = useActivitiesStore((s) => s.loading);
  const loaded = useActivitiesStore((s) => s.loaded);
  const error = useActivitiesStore((s) => s.error);
  const load = useActivitiesStore((s) => s.load);

  const [period, setPeriod] = useState<Period>('semana');
  const [metric, setMetric] = useState<Metric>('count');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const paletteId = useChartPaletteStore((s) => s.paletteId);

  const toggleType = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  useEffect(() => {
    load();
  }, [load]);
  // force=true: o store ignora load() repetido depois de carregado.
  useRefreshOnForeground(() => { load(true); });

  const activities = useMemo(() => _all.filter((a) => !a.hidden), [_all]);
  const isEmpty = loaded && activities.length === 0;

  const overview = useMemo(
    () => buildOverview(activities, period, metric),
    [activities, period, metric],
  );

  const chartBuckets = useMemo(() => {
    if (!hidden.size) return overview.buckets;
    return overview.buckets.map((b) => {
      const segments = b.segments.filter((s) => !hidden.has(s.label));
      const total = segments.reduce((sum, s) => sum + s.value, 0);
      return { ...b, segments, total };
    });
  }, [overview.buckets, hidden]);

  // Totais do topo respeitam os tipos ocultos na legenda (igual ao gráfico).
  const totals = useMemo(() => {
    if (!hidden.size) return overview.totals;
    const visible = activities.filter((a) => !hidden.has(getActivityMeta(a.activityId).label));
    return buildOverview(visible, period, metric).totals;
  }, [activities, hidden, period, metric, overview.totals]);
  const typeSummaries = useMemo(() => buildTypeSummaries(activities), [activities]);

  if (loading && !loaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Histórico</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={MOD.treino.accent} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Histórico</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Não foi possível carregar.</Text>
          <Pressable onPress={() => load(true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Histórico</Text>
        </View>
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: MOD.treino.tint }]}>
            <Ionicons name="barbell-outline" size={30} color={MOD.treino.accent} />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma atividade ainda</Text>
          <Text style={styles.emptyText}>
            Sincronize seus treinos pelo Sync de Atividades para ver o histórico aqui.
          </Text>
          <Pressable onPress={() => router.push('/fitness')} style={styles.cta}>
            <Ionicons name="sync-outline" size={16} color="#fff" />
            <Text style={styles.ctaText}>Ir para Sync de Atividades</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const chartWidth = width - spacing.lg * 2 - spacing.lg * 2;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false} {...tabBarScroll}>
        <View style={styles.card}>
          <Segmented options={PERIODS} value={period} onChange={setPeriod} />

          <View style={styles.statsRow}>
            <StatTile value={String(totals.count)} label="atividades" />
            <StatTile value={formatDuration(totals.durationS)} label="duração" />
            <StatTile value={`${Math.round(totals.calories)}`} label="kcal" />
            <StatTile value={formatDistance(totals.distanceM) ?? '—'} label="distância" />
          </View>

          <View style={styles.chartGroup}>
            <View style={styles.chartWrap}>
              <StackedBarChart
                buckets={chartBuckets}
                metric={metric}
                width={chartWidth}
                noScroll={period === 'ano'}
                animationKey={`${period}-${metric}`}
              />
            </View>

            <Segmented options={METRICS} value={metric} onChange={setMetric} />

            {overview.legend.length > 0 && (
              <View style={styles.legend}>
                {overview.legend.map((l) => {
                  const off = hidden.has(l.label);
                  return (
                    <Pressable key={l.label} onPress={() => toggleType(l.label)} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: off ? colors.line : remapChartColor(l.color, paletteId) }]} />
                      <Text style={[styles.legendText, off && styles.legendTextOff]}>{l.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Por tipo · histórico completo</Text>
        <View style={styles.typeGrid}>
          {typeSummaries.map((t) => {
            const detail = t.hasDistance
              ? formatDistance(t.totalDistanceM)
              : formatDuration(t.totalDurationS);
            return (
              <Pressable
                key={t.label}
                onPress={() =>
                  router.push({ pathname: '/historico/[label]', params: { label: t.label } })
                }
                style={({ pressed }) => [styles.typeCard, pressed && styles.pressed]}
              >
                <View style={[styles.typeIcon, { backgroundColor: `${t.color}22` }]}>
                  <MaterialCommunityIcons name={t.icon} size={20} color={t.color} />
                </View>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Text style={styles.typeMeta}>
                  {t.count} {t.count === 1 ? 'atv' : 'atvs'}
                  {detail ? ` · ${detail}` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: 28, fontFamily: 'InstrumentSerif', color: colors.ink },
  pressed: { opacity: 0.7 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.ink3, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: MOD.treino.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMute,
  },
  retryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },

  scroll: { paddingHorizontal: spacing.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.card,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.pill,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontSize: 12.5, color: colors.ink3, fontWeight: '600' },
  segmentTextActive: { color: colors.ink },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statTile: { alignItems: 'center', flex: 1, gap: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
  statLabel: { fontSize: 10.5, color: colors.ink3 },

  chartGroup: { gap: spacing.sm },
  chartWrap: { marginHorizontal: -spacing.xs },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 11.5, color: colors.ink2 },
  legendTextOff: { color: colors.ink4 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  typeMeta: { fontSize: 12, color: colors.ink3, fontFamily: 'GeistMono' },
}));
