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
import { useSettingsStore } from '../../store/settings.store';
import { useRefreshOnForeground } from '../../hooks/useRefreshOnForeground';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import { latestAvailableOffset, referenceLineColors, resolveWeeklyTargetMin } from '@vitale/shared';
import { buildOverview, earliestActivityYear, overviewYears, type Period, type Metric } from '../../lib/activity-overview';
import { getJSON, setJSON } from '../../lib/local-store';
import { buildTypeSummaries } from '../../lib/activity-type-summary';
import { formatDuration, formatDistance } from '../../lib/workout-format';
import { StackedBarChart } from '../../components/charts/StackedBarChart';
import { remapChartColor } from '../../lib/chart-palettes';
import { useChartPaletteStore } from '../../store/chart-palette.store';
import { colors, spacing, radii, shadows, MOD, themed, useTheme } from '../../theme';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'semana', label: '7d' },
  { key: 'mes', label: '4s' },
  // "12m" e não "12 meses": com 5 opções o segmented não cabe num celular estreito.
  { key: 'meses12', label: '12m' },
  { key: 'ano', label: 'Ano' },
  { key: 'sempre', label: 'Sempre' },
];

/**
 * Anos desmarcados nos botões do período "Sempre". Preferência local do aparelho
 * (como a paleta dos gráficos). Guardamos os DESMARCADOS, e não os selecionados,
 * para que um ano novo apareça sozinho quando surgir.
 */
const YEARS_KEY = 'vitale.historyYearsOff';

/** Rótulo do prorrateio da meta da OMS, por granularidade das barras. */
const WHO_PER: Record<string, string> = {
  day: 'por dia',
  week: 'por semana',
  month: 'por mês',
  year: 'por ano',
};

/** Nome do bucket, para "mês a mês" / "ano a ano" na legenda da progressão. */
const BUCKET_WORD: Record<string, string> = {
  day: 'dia',
  week: 'semana',
  month: 'mês',
  year: 'ano',
};

function fmtGoal(s: number): string {
  const min = Math.round(s / 60);
  return min < 60 ? `${min} min` : `${(s / 3600).toFixed(1)}h`;
}

const METRICS: { key: Metric; label: string }[] = [
  { key: 'count', label: 'Nº' },
  { key: 'duration', label: 'Duração' },
  { key: 'calories', label: 'Calorias' },
  { key: 'distance', label: 'Distância' },
];

/**
 * Amostra da linha na legenda. Com três referências no gráfico (meta tracejada,
 * média pontilhada, esforço sólido), diferenciar só por cor não basta — o traço
 * precisa aparecer. RN não desenha `borderStyle: 'dotted'` de forma confiável numa
 * View de 2px, então o tracejo é montado com segmentos.
 */
function LineMark({ variant, color }: { variant: 'solid' | 'dashed' | 'dotted'; color?: string }) {
  if (variant === 'solid') {
    return <View style={[styles.markBar, styles.markSolid, color ? { backgroundColor: color } : null]} />;
  }
  const dashed = variant === 'dashed';
  const segStyle = dashed ? styles.markSegDashed : styles.markSegDotted;
  return (
    <View style={styles.markRow}>
      {Array.from({ length: dashed ? 3 : 5 }, (_, i) => (
        <View key={i} style={[segStyle, color ? { backgroundColor: color } : null]} />
      ))}
    </View>
  );
}

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
  const { scheme } = useTheme();
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
  // Navegação do período "Ano": 0 = ano corrente, negativo = anos anteriores.
  const [yearOffset, setYearOffset] = useState(0);
  // Anos desligados no período "Sempre"; hidrata do armazenamento local no mount.
  const [hiddenYears, setHiddenYears] = useState<Set<string>>(new Set());
  const paletteId = useChartPaletteStore((s) => s.paletteId);
  // Meta semanal configurável em Ajustes → Objetivos; cai no padrão se não definida.
  const preferences = useSettingsStore((s) => s.preferences);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const weeklyTargetMin = resolveWeeklyTargetMin(preferences?.weeklyActivityTargetMin);
  // O passo da cor depende do tema: um violeta escuro dá 10.6:1 sobre a superfície
  // clara e 1.6:1 sobre a escura. Ver `reference-lines.ts`.
  const refLines = referenceLineColors(preferences?.referenceLineScheme, scheme);

  const toggleType = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  useEffect(() => {
    load();
    // O store de settings não hidrata sozinho: sem isso a meta configurada nunca
    // chegaria aqui e o gráfico ficaria preso no padrão.
    if (!preferences) loadSettings();
    void getJSON<{ off: string[] }>(YEARS_KEY).then((v) => {
      if (Array.isArray(v?.off)) setHiddenYears(new Set(v.off));
    });
  }, [load]);
  // force=true: o store ignora load() repetido depois de carregado.
  useRefreshOnForeground(() => { load(true); });

  const activities = useMemo(() => _all.filter((a) => !a.hidden), [_all]);
  const isEmpty = loaded && activities.length === 0;

  // Capturado uma vez: âncora do gráfico e da navegação por ano.
  const now = useMemo(() => new Date(), []);
  const isYear = period === 'ano';
  const shownYear = now.getFullYear() + yearOffset;
  const firstYear = useMemo(() => earliestActivityYear(activities), [activities]);
  const canNextYear = yearOffset < latestAvailableOffset(now, 'year');
  const canPrevYear = firstYear !== undefined && shownYear > firstYear;

  const changePeriod = (p: Period) => {
    setPeriod(p);
    setYearOffset(0); // volta ao ano corrente ao trocar de período
  };

  // Botões de ano do período "Sempre": todos os anos com histórico continuam
  // listados; os desligados só saem do gráfico.
  const isAll = period === 'sempre';
  const years = useMemo(() => overviewYears(activities), [activities]);

  const toggleYear = (year: number) => {
    const key = `${year}`;
    const next = new Set(hiddenYears);
    if (next.has(key)) next.delete(key);
    // Desligar o último ano ligado deixaria o gráfico e os totais vazios: no-op.
    else if (years.some((y) => y !== year && !next.has(`${y}`))) next.add(key);
    else return;
    setHiddenYears(next);
    void setJSON(YEARS_KEY, { off: [...next] });
  };

  // `hidden` entra na agregação (igual ao web): barras, totais e a série de esforço
  // ponderado precisam do mesmo filtro, e o esforço não dá para refiltrar depois.
  const overview = useMemo(
    () => buildOverview(activities, period, metric, now, hidden, weeklyTargetMin, yearOffset, hiddenYears),
    [activities, period, metric, now, hidden, weeklyTargetMin, yearOffset, hiddenYears],
  );
  const isDuration = metric === 'duration';
  // No período "Semana" as barras são diárias: as duas linhas viram retas na média
  // diária, para comparar com a meta sem estourar o eixo. Nos demais períodos cada
  // barra já é um ciclo fechado, então o esforço progride barra a barra.
  const isDaily = overview.granularity === 'day';
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
          <Segmented options={PERIODS} value={period} onChange={changePeriod} />

          {isYear && (
            <View style={styles.yearNav}>
              <Pressable
                onPress={() => canPrevYear && setYearOffset((o) => o - 1)}
                disabled={!canPrevYear}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Ano anterior"
                style={styles.navBtn}
              >
                <Ionicons name="chevron-back" size={18} color={canPrevYear ? colors.ink : colors.ink4} />
              </Pressable>
              <Text style={styles.navLabel}>{shownYear}</Text>
              <Pressable
                onPress={() => canNextYear && setYearOffset((o) => o + 1)}
                disabled={!canNextYear}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Próximo ano"
                style={styles.navBtn}
              >
                <Ionicons name="chevron-forward" size={18} color={canNextYear ? colors.ink : colors.ink4} />
              </Pressable>
            </View>
          )}

          <View style={styles.statsRow}>
            <StatTile value={String(overview.totals.count)} label="atividades" />
            <StatTile value={formatDuration(overview.totals.durationS)} label="duração" />
            <StatTile value={`${Math.round(overview.totals.calories)}`} label="kcal" />
            <StatTile value={formatDistance(overview.totals.distanceM) ?? '—'} label="distância" />
          </View>

          <View style={styles.chartGroup}>
            {isAll && years.length > 0 && (
              <View style={styles.yearChips}>
                {years.map((y) => {
                  const on = !hiddenYears.has(`${y}`);
                  return (
                    <Pressable
                      key={y}
                      onPress={() => toggleYear(y)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Ano ${y}`}
                      style={({ pressed }) => [
                        styles.yearChip,
                        on && styles.yearChipOn,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.yearChipText, on && styles.yearChipTextOn]}>{y}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <View style={styles.chartWrap}>
              <StackedBarChart
                buckets={overview.buckets}
                metric={metric}
                width={chartWidth}
                noScroll={period === 'meses12' || isYear}
                animationKey={`${period}-${metric}-${yearOffset}-${[...hiddenYears].sort().join('.')}`}
                goal={isDuration ? overview.targetS : undefined}
                goalLabel="OMS"
                goalUnit={`/${BUCKET_WORD[overview.granularity]}`}
                currentGoal={isDuration ? overview.currentTargetS : undefined}
                showEffort={isDuration && !isDaily}
                effortFlat={isDuration ? overview.effortAvgS : undefined}
                effortFlatLabel="Você"
                effortFlatColor={refLines.average}
                effortColor={refLines.series}
              />
            </View>

            {isDuration && (
              <View style={styles.refLegend}>
                <View style={styles.refRow}>
                  <LineMark variant="dashed" />
                  <Text style={styles.refText}>
                    OMS · {fmtGoal(overview.targetS)} {WHO_PER[overview.granularity]}
                    {isDaily && <Text style={styles.refHint}>  ({weeklyTargetMin} min/semana)</Text>}
                    {overview.currentTargetS !== undefined && (
                      <Text style={styles.refHint}>
                        {`  · ${BUCKET_WORD[overview.granularity]} em curso: ${fmtGoal(overview.currentTargetS)}`}
                      </Text>
                    )}
                  </Text>
                </View>
                <View style={styles.refRow}>
                  <LineMark variant="dotted" color={refLines.average} />
                  <Text style={styles.refText}>
                    Você · {fmtGoal(overview.effortAvgS)} {WHO_PER[overview.granularity]}
                    <Text style={styles.refHint}>  ({fmtGoal(overview.effortTotalS)} no total)</Text>
                  </Text>
                </View>
                {!isDaily && (
                  <View style={styles.refRow}>
                    <LineMark variant="solid" color={refLines.series} />
                    <Text style={styles.refText}>
                      Você, {BUCKET_WORD[overview.granularity]} a {BUCKET_WORD[overview.granularity]}
                    </Text>
                  </View>
                )}
                <Text style={styles.refHint}>
                  Minutos de esforço: a barra é o tempo no relógio, a linha é quanto dele
                  contou. Cada treino é pesado pela intensidade — pelo tempo em zonas de FC
                  quando há batimentos, senão pelo tipo. Um minuto vigoroso conta inteiro; um
                  moderado, metade; yoga e leves contam menos. A FC só acrescenta: nenhum
                  treino cai abaixo do que o seu tipo já vale, então um pedal longo e fácil
                  não é zerado por ter ficado em z1.
                </Text>
              </View>
            )}

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

  // Botões de ano do período "Sempre" — ligam/desligam cada barra do gráfico.
  yearChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  yearChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'transparent',
  },
  yearChipOn: { backgroundColor: colors.surfaceMute, borderColor: colors.lineDeep },
  yearChipText: { fontSize: 12, fontFamily: 'GeistMono', color: colors.ink4 },
  yearChipTextOn: { color: colors.ink },

  refLegend: {
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.bg,
  },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  // Navegação por ano — mesmo padrão visual da Retrospectiva. O estado desabilitado
  // é sinalizado pela cor do ícone, não por opacidade.
  yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.sm },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  navLabel: { fontSize: 15, fontWeight: '600', color: colors.ink, minWidth: 56, textAlign: 'center' },

  markRow: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 18 },
  markBar: { width: 18, height: 2, borderRadius: 1 },
  markSolid: { backgroundColor: colors.ink2, opacity: 0.85 },
  markSegDashed: { width: 4, height: 2, borderRadius: 1, backgroundColor: colors.ink3, opacity: 0.7 },
  markSegDotted: { width: 2, height: 2, borderRadius: 1, backgroundColor: colors.ink2, opacity: 0.8 },
  refText: { fontSize: 11.5, fontWeight: '600', color: colors.ink2 },
  refHint: { fontSize: 10.5, lineHeight: 15, color: colors.ink3 },

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
