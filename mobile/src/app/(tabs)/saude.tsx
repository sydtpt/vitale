import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHealthStore } from '../../store/health.store';
import { useRefreshOnForeground } from '../../hooks/useRefreshOnForeground';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import {
  CATEGORIES,
  categoryMeta,
  metricsByCategory,
  MetricDef,
} from '../../config/health-metrics';
import { bucketize, Sample } from '../../lib/health-buckets';
import { Sparkline, ActivityRings, MacroDonut } from '../../components/charts';
import { colors, spacing, radii, MOD, shadows, themed, useTheme } from '../../theme';

const RING_COLORS = [colors.primary, colors.green, colors.blue]; // mover · exercício · em pé
const MACRO_COLORS = [colors.rose, colors.yellow, colors.blue]; // proteína · carbo · gordura

/** Deriva o número-chave e o sparkline (últimos 7 dias) de uma métrica. */
function deriveSummary(metric: MetricDef, samples: Sample[]): { value: number | null; spark: number[] } {
  const buckets = bucketize(samples, 'week', metric.kind);
  const spark = buckets.map((b) => b.value);
  let value: number | null = null;
  if (metric.kind === 'cumulative') {
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (!buckets[i].empty) {
        value = buckets[i].value;
        break;
      }
    }
  } else {
    value = samples.length > 0 ? samples[samples.length - 1].value : null;
  }
  return { value, spark };
}

function MetricCard({ metric, onPress }: { metric: MetricDef; onPress: () => void }) {
  const samples = useHealthStore((s) => s.summaries[metric.id]) ?? [];
  const cat = categoryMeta(metric.category);

  let right: React.ReactNode;
  if (metric.chart === 'rings') {
    const rings = samples.map((s, i) => ({ value: s.value, goal: s.extra ?? 0, color: RING_COLORS[i] ?? cat.accent }));
    right = rings.length > 0 ? <ActivityRings rings={rings} size={46} strokeWidth={5} /> : <Empty />;
  } else if (metric.chart === 'donut') {
    const segs = samples.map((s, i) => ({ value: s.value, color: MACRO_COLORS[i] ?? cat.accent }));
    const total = segs.reduce((a, s) => a + s.value, 0);
    right = total > 0 ? <MacroDonut segments={segs} size={46} strokeWidth={8} /> : <Empty />;
  } else {
    const { value, spark } = deriveSummary(metric, samples);
    right = (
      <View style={styles.rightCol}>
        <Text style={styles.cardValue}>{value === null ? '—' : metric.format(value)}</Text>
        <Sparkline values={spark} color={cat.accent} mode={metric.kind === 'cumulative' ? 'bar' : 'line'} />
      </View>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={[styles.iconBox, { backgroundColor: cat.tint }]}>
        <Ionicons name={metric.icon} size={20} color={cat.accent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{metric.label}</Text>
        {!!metric.caption && <Text style={styles.cardCaption}>{metric.caption}</Text>}
      </View>
      {right}
      <Ionicons name="chevron-forward" size={16} color={colors.ink4} />
    </Pressable>
  );
}

function Empty() {
  return <Text style={styles.emptyMini}>sem dados</Text>;
}

function ProfileCard() {
  const profile = useHealthStore((s) => s.profile);
  if (!profile || (!profile.biologicalSex && !profile.bloodType && !profile.age)) return null;
  const items = [
    profile.age !== undefined ? { label: 'Idade', value: `${profile.age}` } : null,
    profile.biologicalSex ? { label: 'Sexo', value: profile.biologicalSex } : null,
    profile.bloodType ? { label: 'Sangue', value: profile.bloodType } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={styles.profileCard}>
      {items.map((it) => (
        <View key={it.label} style={styles.profileItem}>
          <Text style={styles.profileValue}>{it.value}</Text>
          <Text style={styles.profileLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  return (
    <View style={styles.permCenter}>
      <View style={styles.permIconWrap}>
        <Ionicons name="heart-outline" size={40} color={colors.rose} />
      </View>
      <Text style={styles.permTitle}>Explore sua Saúde</Text>
      <Text style={styles.permDesc}>
        O Orbe lê seus dados do Apple Health — atividade, coração, corpo, sono e nutrição — para montar seus gráficos.
      </Text>
      <Pressable style={styles.permBtn} onPress={onRequest}>
        <Text style={styles.permBtnText}>Permitir Acesso</Text>
      </Pressable>
      <Text style={styles.permNote}>Resumos diários ficam protegidos na sua conta.</Text>
    </View>
  );
}

function UnavailableScreen() {
  return (
    <View style={styles.permCenter}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.ink3} />
      <Text style={styles.permTitle}>Não disponível</Text>
      <Text style={styles.permDesc}>O Apple Health só está disponível em dispositivos iOS.</Text>
    </View>
  );
}

export default function HealthScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const tabBarScroll = useTabBarScroll();
  const router = useRouter();
  const { permissionStatus, summaryLoading, syncing, requestPermission, loadSummaries, syncToCloud } =
    useHealthStore();
  const busy = summaryLoading || syncing;

  useEffect(() => {
    if (permissionStatus === 'unknown') requestPermission();
  }, [permissionStatus, requestPermission]);

  // Retomar o app: recarrega os cards exibidos (o sync ao Supabase já é feito
  // pelo healthkit-observer no AppState 'active').
  useRefreshOnForeground(() => { void loadSummaries(); });

  // Botão de sync: recarrega os cards E sobe os agregados diários ao Supabase.
  const onSync = useCallback(() => {
    void loadSummaries();
    void syncToCloud();
  }, [loadSummaries, syncToCloud]);

  const openMetric = useCallback(
    (id: string) => router.push({ pathname: '/saude/[metric]', params: { metric: id } }),
    [router]
  );

  if (Platform.OS !== 'ios' || permissionStatus === 'unavailable') {
    return <UnavailableScreen />;
  }

  if (permissionStatus === 'denied') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.cardPressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.headerTitle}>Saúde</Text>
          <View style={styles.backBtn} />
        </View>
        <PermissionScreen onRequest={requestPermission} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.cardPressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Saúde</Text>
        <Pressable
          onPress={onSync}
          disabled={busy}
          hitSlop={8}
          style={({ pressed }) => [styles.syncBtn, pressed && styles.cardPressed, busy && styles.syncDisabled]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.rose} />
          ) : (
            <Ionicons name="sync-outline" size={18} color={colors.rose} />
          )}
        </Pressable>
      </View>

      {summaryLoading && Object.keys(useHealthStore.getState().summaries).length === 0 ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight }]} showsVerticalScrollIndicator={false} {...tabBarScroll}>
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionDot, { backgroundColor: cat.accent }]} />
                <Text style={styles.sectionTitle}>{cat.label}</Text>
              </View>
              {metricsByCategory(cat.id).map((m) => (
                <MetricCard key={m.id} metric={m} onPress={() => openMetric(m.id)} />
              ))}
              {cat.id === 'corpo' && <ProfileCard />}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 24, fontFamily: 'InstrumentSerif', color: colors.ink },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  syncBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncDisabled: { opacity: 0.5 },

  scroll: { paddingHorizontal: spacing.lg },

  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, marginLeft: 2 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    ...shadows.card,
  },
  cardPressed: { opacity: 0.7 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardCaption: { fontSize: 12, color: colors.ink3, marginTop: 1 },
  rightCol: { alignItems: 'flex-end', gap: 3 },
  cardValue: { fontSize: 15, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
  emptyMini: { fontSize: 11, color: colors.ink4, fontFamily: 'GeistMono' },

  profileCard: {
    backgroundColor: colors.surfaceMute,
    borderRadius: radii['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 2,
  },
  profileItem: { alignItems: 'center', gap: 2 },
  profileValue: { fontSize: 16, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },
  profileLabel: { fontSize: 11, color: colors.ink3, textTransform: 'uppercase', letterSpacing: 0.4 },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  permCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.lg,
  },
  permIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.roseSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  permTitle: { fontSize: 22, fontFamily: 'InstrumentSerif', color: colors.ink, textAlign: 'center' },
  permDesc: { fontSize: 14.5, color: colors.ink2, textAlign: 'center', lineHeight: 22 },
  permBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  permNote: { fontSize: 12, color: colors.ink4, textAlign: 'center' },
}));
