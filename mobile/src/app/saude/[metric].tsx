import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHealthStore } from '../../store/health.store';
import { metricById, categoryMeta } from '../../config/health-metrics';
import {
  bucketize,
  computeStats,
  formatDayLabel,
  Period,
  Sample,
} from '../../lib/health-buckets';
import { BarChart, LineChart, ActivityRings, MacroDonut } from '../../components/charts';
import { colors, spacing, radii, shadows, themed, useTheme } from '../../theme';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
];

const RING_META = [
  { color: colors.primary, label: 'Mover', unit: 'kcal' },
  { color: colors.green, label: 'Exercício', unit: 'min' },
  { color: colors.blue, label: 'Em pé', unit: 'h' },
];
const MACRO_COLORS = [colors.rose, colors.yellow, colors.blue];

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <View style={styles.segment}>
      {PERIODS.map((p) => {
        const active = p.id === value;
        return (
          <Pressable
            key={p.id}
            onPress={() => onChange(p.id)}
            style={[styles.segmentBtn, active && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({ value, caption, color }: { value: string; caption: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

export default function MetricDetailScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { metric: metricId = '' } = useLocalSearchParams<{ metric: string }>();

  const metric = useMemo(() => metricById(metricId), [metricId]);
  const period = useHealthStore((s) => s.period);
  const setPeriod = useHealthStore((s) => s.setPeriod);
  const loadMetric = useHealthStore((s) => s.loadMetric);
  const data = useHealthStore((s) => s.detail[metricId]) ?? [];
  const loading = useHealthStore((s) => s.detailLoading[metricId]) ?? false;

  const [chartW, setChartW] = useState(0);
  const onChartLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  const kind = metric?.kind ?? 'discrete';
  const buckets = useMemo(() => bucketize(data, period, kind), [data, period, kind]);
  const stats = useMemo(() => computeStats(data, buckets, kind), [data, buckets, kind]);

  useEffect(() => {
    if (metric) loadMetric(metric.id);
  }, [metric, period, loadMetric]);

  if (!metric) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Header title="Saúde" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Métrica não encontrada</Text>
        </View>
      </View>
    );
  }

  const cat = categoryMeta(metric.category);
  const special = metric.chart === 'rings' || metric.chart === 'donut';
  const hasData = special ? data.length > 0 : data.some((s) => Number.isFinite(s.value));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title={metric.label} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {!special && <PeriodSelector value={period} onChange={setPeriod} />}

        {/* Hero / stats */}
        {!special && (
          <View style={styles.heroRow}>
            <Stat
              value={hasData ? metric.format(metric.kind === 'cumulative' ? stats.total : stats.latest) : '—'}
              caption={metric.kind === 'cumulative' ? 'total no período' : 'mais recente'}
              color={cat.accent}
            />
          </View>
        )}

        {/* Gráfico */}
        <View style={styles.chartCard} onLayout={onChartLayout}>
          {loading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={cat.accent} />
            </View>
          ) : !hasData ? (
            <View style={styles.chartLoading}>
              <Ionicons name="cloud-offline-outline" size={28} color={colors.ink4} />
              <Text style={styles.emptyText}>Sem dados no período</Text>
            </View>
          ) : metric.chart === 'rings' ? (
            <RingsBody data={data} />
          ) : metric.chart === 'donut' ? (
            <DonutBody data={data} format={metric.format} />
          ) : metric.chart === 'line' ? (
            <LineChart buckets={buckets} width={Math.max(0, chartW - spacing.lg * 2)} color={cat.accent} />
          ) : (
            <BarChart buckets={buckets} width={Math.max(0, chartW - spacing.lg * 2)} color={cat.accent} />
          )}
        </View>

        {/* Estatísticas */}
        {!special && hasData && (
          <View style={styles.statsCard}>
            {metric.kind === 'cumulative' ? (
              <>
                <Stat value={metric.format(stats.avg)} caption={period === 'day' ? 'média/hora' : 'média/dia'} color={colors.ink} />
                <Stat value={metric.format(stats.max)} caption="máximo" color={colors.ink} />
                <Stat value={metric.format(stats.total)} caption="total" color={colors.ink} />
              </>
            ) : (
              <>
                <Stat value={metric.format(stats.avg)} caption="média" color={colors.ink} />
                <Stat value={metric.format(stats.min)} caption="mínimo" color={colors.ink} />
                <Stat value={metric.format(stats.max)} caption="máximo" color={colors.ink} />
              </>
            )}
          </View>
        )}

        {/* Lista de amostras */}
        {!special && hasData && (
          <>
            <Text style={styles.sectionTitle}>Amostras ({stats.count})</Text>
            <View style={styles.listCard}>
              {[...data]
                .reverse()
                .slice(0, 60)
                .map((s, i, arr) => (
                  <SampleRow key={`${s.start}-${i}`} sample={s} metric={metric} last={i === arr.length - 1} />
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.backBtn} />
    </View>
  );
}

function RingsBody({ data }: { data: Sample[] }) {
  const rings = data.map((s, i) => ({ value: s.value, goal: s.extra ?? 0, color: RING_META[i]?.color ?? colors.primary }));
  return (
    <View style={styles.ringsBody}>
      <ActivityRings rings={rings} size={150} strokeWidth={15} />
      <View style={styles.ringsLegend}>
        {data.map((s, i) => (
          <View key={i} style={styles.ringRow}>
            <View style={[styles.legendDot, { backgroundColor: RING_META[i]?.color }]} />
            <Text style={styles.ringLabel}>{RING_META[i]?.label}</Text>
            <Text style={styles.ringValue}>
              {Math.round(s.value)}/{Math.round(s.extra ?? 0)} {RING_META[i]?.unit}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DonutBody({ data, format }: { data: Sample[]; format: (v: number) => string }) {
  const total = data.reduce((a, s) => a + s.value, 0);
  const segments = data.map((s, i) => ({ value: s.value, color: MACRO_COLORS[i] ?? colors.ink3 }));
  return (
    <View style={styles.ringsBody}>
      <MacroDonut segments={segments} size={150} strokeWidth={22} />
      <View style={styles.ringsLegend}>
        {data.map((s, i) => (
          <View key={i} style={styles.ringRow}>
            <View style={[styles.legendDot, { backgroundColor: MACRO_COLORS[i] }]} />
            <Text style={styles.ringLabel}>{s.label}</Text>
            <Text style={styles.ringValue}>
              {format(s.value)} · {total > 0 ? Math.round((s.value / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SampleRow({ sample, metric, last }: { sample: Sample; metric: ReturnType<typeof metricById>; last: boolean }) {
  const period = useHealthStore((s) => s.period);
  const d = new Date(sample.start);
  const when =
    period === 'day'
      ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : `${formatDayLabel(d.getTime())} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const value =
    metric?.id === 'pressao' && sample.extra !== undefined
      ? `${Math.round(sample.value)}/${Math.round(sample.extra)} mmHg`
      : metric?.format(sample.value) ?? `${sample.value}`;

  return (
    <View style={[styles.listRow, !last && styles.listRowBorder]}>
      <Text style={styles.listWhen}>{when}</Text>
      <Text style={styles.listValue}>{value}</Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMute,
    borderRadius: radii.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: radii.pill, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { fontSize: 13.5, color: colors.ink3, fontWeight: '500' },
  segmentTextActive: { color: colors.ink, fontWeight: '700' },

  heroRow: { alignItems: 'center', marginBottom: spacing.md },

  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.lg,
    minHeight: 180,
    justifyContent: 'center',
    ...shadows.card,
  },
  chartLoading: { height: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },

  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    ...shadows.card,
  },
  stat: { alignItems: 'center', gap: 3 },
  statValue: { fontSize: 18, fontWeight: '700', fontFamily: 'GeistMono' },
  statCaption: { fontSize: 11, color: colors.ink3 },

  ringsBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.sm },
  ringsLegend: { flex: 1, gap: spacing.md },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  ringLabel: { flex: 1, fontSize: 13.5, color: colors.ink2 },
  ringValue: { fontSize: 13, color: colors.ink, fontFamily: 'GeistMono' },

  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink2,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listCard: { backgroundColor: colors.surface, borderRadius: radii['2xl'], paddingHorizontal: spacing.lg, ...shadows.card },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listWhen: { fontSize: 13.5, color: colors.ink2 },
  listValue: { fontSize: 13.5, color: colors.ink, fontFamily: 'GeistMono' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { fontSize: 14, color: colors.ink3 },
}));
