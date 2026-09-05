import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SONO_MARKERS,
  STAGE_LABEL,
  bucketFacts,
  bucketPeriods,
  filterByRange,
  nightFacts,
  periodSummary,
  rangeForm,
  stageFacts,
  type SonoRange,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { SleepTimingChart } from '../../components/charts/SleepTimingChart';
import { SleepBucketsChart } from '../../components/charts/SleepBucketsChart';
import { SleepStagesStackChart } from '../../components/charts/SleepStagesStackChart';
import { PeriodNav } from '../../components/sono/PeriodNav';
import { PeriodAverages } from '../../components/sono/PeriodAverages';
import { FactsList } from '../../components/sono/FactsList';
import { SleepLegend, SwGapTick, SwHatch, SwSolid, type LegendEntry } from '../../components/sono/SleepLegend';
import { Segmented } from '../../components/ui/Segmented';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

type Mode = 'tempos' | 'estagios';
const MODES = [
  { key: 'tempos' as Mode, label: 'Tempos' },
  { key: 'estagios' as Mode, label: 'Estágios' },
];
/** As duas leituras do Estágios nas noites: onde cada estágio cai, ou quanto de cada. */
type StageView = 'hora' | 'total';
const VIEWS = [
  { key: 'hora' as StageView, label: 'na hora' },
  { key: 'total' as StageView, label: 'total' },
];

/** Os dias de acordar entre a primeira e a última noite, incluindo os sem noite. */
function calendarDays(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T12:00:00`);
  const end = new Date(`${last}T12:00:00`);
  for (; d <= end; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

/**
 * /sono/tempos — a subview que abre ao tocar no gráfico das 14 noites (CAP-7).
 * Médias no topo, o período navegável, e duas leituras do mesmo gráfico:
 *
 * **Tempos** — a cama como lavagem de fundo, o sono como barra, e cada despertar
 * como o vão com a marca amarela ao lado: quando e por quanto tempo acordou.
 * **Estágios** — em duas leituras: **na hora** (cada estágio na posição em que
 * ocorreu, de `stage_segments`) e **total** (horas por estágio, uma coluna por
 * noite, a vigília no topo). Nos períodos longos só existe o total, porque uma
 * "noite típica" não tem hora para cada estágio.
 *
 * As cores vêm de `sleepColors()` — uma cor, um significado, em toda tela de
 * sono. Embaixo, fatos: medianas, faixas, contagens. Nenhum vira nota. Estágios
 * levam o rótulo de incerteza — estimativa do aparelho, comparável com você mesmo.
 */
export default function SonoTemposScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sc = sleepColors();

  const periods = useSonoStore((s) => s.periods);
  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const [range, setRange] = useState<SonoRange>('4s');
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<Mode>('tempos');
  const [view, setView] = useState<StageView>('hora');
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const nights = useMemo(() => filterByRange(periods, range, new Date(), offset), [periods, range, offset]);
  const form = rangeForm(range);
  const summary = useMemo(() => periodSummary(nights), [nights]);
  const weekBuckets = useMemo(() => (form === 'weeks' ? bucketPeriods(nights, 'week') : []), [nights, form]);
  const nightBuckets = useMemo(() => (form === 'nights' ? bucketPeriods(nights, 'night') : []), [nights, form]);
  const facts = useMemo(() => {
    if (mode === 'estagios') return stageFacts(nights);
    return form === 'weeks' ? bucketFacts(weekBuckets, SONO_MARKERS) : nightFacts(nights);
  }, [mode, form, weekBuckets, nights]);
  const days = useMemo(() => {
    if (form !== 'nights' || nights.length === 0) return [];
    if (range === 'ultima') return [nights[0].wakeDay];
    return calendarDays(nights[0].wakeDay, nights[nights.length - 1].wakeDay);
  }, [form, range, nights]);
  const hasSegments = nights.some((n) => n.stageSegments && n.stageSegments.length > 0);
  const composition = mode === 'estagios' && (form === 'weeks' || view === 'total');

  const chartW = Math.max(0, w - spacing.lg * 2);

  const legend: LegendEntry[] =
    mode === 'estagios'
      ? [
          { swatch: <SwSolid color={sc.rem} />, label: STAGE_LABEL.rem },
          { swatch: <SwSolid color={sc.light} />, label: STAGE_LABEL.core },
          { swatch: <SwSolid color={sc.deep} />, label: STAGE_LABEL.deep },
          { swatch: <SwHatch color={sc.unknown} id="legend-hatch-tempos" />, label: STAGE_LABEL.unspecified },
          { swatch: composition ? <SwSolid color={sc.awake} /> : <SwGapTick awake={sc.awake} />, label: 'despertar' },
        ]
      : form === 'nights'
        ? [
            { swatch: <SwSolid color={sc.bed} />, label: 'na cama' },
            { swatch: <SwSolid color={sc.sleep} />, label: 'dormindo' },
            { swatch: <SwGapTick awake={sc.awake} />, label: 'despertar' },
          ]
        : [
            { swatch: <SwSolid color={sc.bed} />, label: 'faixa p25–p75' },
            { swatch: <SwSolid color={sc.sleep} />, label: 'mediana apagar→acordar' },
            { swatch: <SwSolid color={sc.awake} />, label: 'min acordado/noite' },
          ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Tempos</Text>
        <HeaderSpacer />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card} onLayout={onLayout}>
          <PeriodNav range={range} offset={offset} periods={periods} nights={nights} onRange={setRange} onOffset={setOffset} />

          {!loaded ? (
            <View style={styles.center}><ActivityIndicator color={sc.sleep} /></View>
          ) : nights.length === 0 ? (
            <Text style={styles.empty}>Sem noites neste período.</Text>
          ) : (
            <>
              {summary && <PeriodAverages summary={summary} palette={sc} />}

              <View style={styles.modeRow}>
                <Segmented options={MODES} value={mode} onChange={setMode} />
              </View>
              {mode === 'estagios' && form === 'nights' && (
                <View style={styles.subRow}>
                  <View style={styles.subSeg}>
                    <Segmented options={VIEWS} value={view} onChange={setView} />
                  </View>
                </View>
              )}

              <View style={styles.chartWrap}>
                {form === 'nights' ? (
                  composition ? (
                    <SleepStagesStackChart buckets={nightBuckets} width={chartW} palette={sc} />
                  ) : (
                    <SleepTimingChart
                      days={days}
                      periods={nights}
                      width={chartW}
                      palette={sc}
                      emphasis={mode === 'estagios' ? 'stages' : 'awake'}
                    />
                  )
                ) : mode === 'estagios' ? (
                  <SleepStagesStackChart buckets={weekBuckets} width={chartW} palette={sc} />
                ) : (
                  <SleepBucketsChart buckets={weekBuckets} markers={SONO_MARKERS} width={chartW} palette={sc} />
                )}
              </View>

              <SleepLegend items={legend} />

              <FactsList facts={facts} />

              {mode === 'estagios' && (
                <View style={styles.uncert}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.ink3} />
                  <Text style={styles.uncertText}>
                    Estimativa do seu relógio. Vale para comparar você com você mesmo — não é medida clínica.
                    {composition ? ' Em total, a coluna é composição (horas por estágio), não posição; a altura é a noite inteira, sono mais vigília.' : ''}
                    {form === 'nights' && !hasSegments ? ' Estas noites ainda não têm os intervalos gravados — o próximo sync os traz.' : ''}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    pressed: { opacity: 0.7 },
    card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, ...shadows.card },
    center: { paddingVertical: spacing.xl, alignItems: 'center' },
    empty: { paddingVertical: spacing.xl, textAlign: 'center', color: colors.ink3, fontFamily: fonts.sans, fontSize: 13 },
    modeRow: { marginTop: spacing.md },
    subRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm },
    subSeg: { width: 168 },
    chartWrap: { marginTop: spacing.md },
    uncert: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.md },
    uncertText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },
  });
