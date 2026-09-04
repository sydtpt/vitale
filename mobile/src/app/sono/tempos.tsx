import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  STAGE_LABEL,
  bucketFacts,
  bucketPeriods,
  filterByRange,
  nightFacts,
  periodSummary,
  rangeForm,
  stageFacts,
  type SonoRange,
  type StageKey,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { SONO_MARKERS } from '../../config/sono-markers';
import { SleepTimingChart } from '../../components/charts/SleepTimingChart';
import { SleepBucketsChart } from '../../components/charts/SleepBucketsChart';
import { SleepStagesWeeklyChart } from '../../components/charts/SleepStagesWeeklyChart';
import { PeriodNav } from '../../components/sono/PeriodNav';
import { PeriodAverages } from '../../components/sono/PeriodAverages';
import { FactsList } from '../../components/sono/FactsList';
import { Segmented } from '../../components/ui/Segmented';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, moduleColors, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';

type Mode = 'tempos' | 'estagios';
const MODES = [
  { key: 'tempos' as Mode, label: 'Tempos' },
  { key: 'estagios' as Mode, label: 'Estágios' },
];
const STAGE_ORDER: StageKey[] = ['deep', 'rem', 'core', 'unspecified'];

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
 * **Tempos** — a cama sem destaque, o sono mais leve, e cada despertar em
 * destaque: quando e por quanto tempo. **Estágios** — cada estágio na hora em
 * que ocorreu (posição real, de `stage_segments`); nos períodos longos vira
 * composição por semana, porque uma "noite típica" não tem hora para cada estágio.
 *
 * Embaixo, fatos: medianas, faixas, contagens. Nenhum vira nota. Estágios levam
 * o rótulo de incerteza — estimativa do aparelho, comparável com você mesmo.
 */
export default function SonoTemposScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mod = moduleColors('agua');
  const yellow = roleColors('yellow');
  const blue = roleColors('blue');
  const stageColors: Record<StageKey, string> = {
    deep: blue.text,
    rem: mod.accent,
    core: mod.tint,
    unspecified: colors.ink4,
  };

  const periods = useSonoStore((s) => s.periods);
  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const [range, setRange] = useState<SonoRange>('4s');
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<Mode>('tempos');
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const nights = useMemo(() => filterByRange(periods, range, new Date(), offset), [periods, range, offset]);
  const form = rangeForm(range);
  const summary = useMemo(() => periodSummary(nights), [nights]);
  const buckets = useMemo(() => (form === 'weeks' ? bucketPeriods(nights, 'week') : []), [nights, form]);
  const facts = useMemo(() => {
    if (mode === 'estagios') return stageFacts(nights);
    return form === 'weeks' ? bucketFacts(buckets, SONO_MARKERS) : nightFacts(nights);
  }, [mode, form, buckets, nights]);
  const days = useMemo(() => {
    if (form !== 'nights' || nights.length === 0) return [];
    if (range === 'ultima') return [nights[0].wakeDay];
    return calendarDays(nights[0].wakeDay, nights[nights.length - 1].wakeDay);
  }, [form, range, nights]);
  const hasSegments = nights.some((n) => n.stageSegments && n.stageSegments.length > 0);

  const chartW = Math.max(0, w - spacing.lg * 2);

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
            <View style={styles.center}><ActivityIndicator color={mod.accent} /></View>
          ) : nights.length === 0 ? (
            <Text style={styles.empty}>Sem noites neste período.</Text>
          ) : (
            <>
              {summary && <PeriodAverages summary={summary} accent={mod.accent} tint={mod.tint} awakeColor={yellow.accent} />}

              <View style={styles.modeRow}>
                <Segmented options={MODES} value={mode} onChange={setMode} />
              </View>

              <View style={styles.chartWrap}>
                {form === 'nights' ? (
                  <SleepTimingChart
                    days={days}
                    periods={nights}
                    width={chartW}
                    accent={mod.accent}
                    emphasis={mode === 'estagios' ? 'stages' : 'awake'}
                    awakeColor={yellow.accent}
                    awakeOutline={yellow.text}
                    tint={mod.tint}
                    stageColors={stageColors}
                  />
                ) : mode === 'estagios' ? (
                  <SleepStagesWeeklyChart buckets={buckets} width={chartW} stageColors={stageColors} />
                ) : (
                  <SleepBucketsChart
                    buckets={buckets}
                    markers={SONO_MARKERS}
                    width={chartW}
                    accent={mod.accent}
                    tint={mod.tint}
                    awakeColor={yellow.accent}
                    awakeOutline={yellow.text}
                  />
                )}
              </View>

              <View style={styles.legend}>
                {mode === 'estagios' ? (
                  STAGE_ORDER.map((k) => (
                    <LegendItem key={k} swatch={{ backgroundColor: stageColors[k] }} label={STAGE_LABEL[k]} styles={styles} />
                  ))
                ) : (
                  <>
                    <LegendItem swatch={{ backgroundColor: mod.tint }} label={form === 'nights' ? 'na cama' : 'faixa p25–p75'} styles={styles} />
                    <LegendItem swatch={{ backgroundColor: mod.accent, opacity: 0.7 }} label={form === 'nights' ? 'dormindo' : 'mediana apagar→acordar'} styles={styles} />
                    <LegendItem swatch={{ backgroundColor: yellow.accent, borderWidth: 1, borderColor: yellow.text }} label={form === 'nights' ? 'despertar' : 'min acordado/noite'} styles={styles} />
                  </>
                )}
              </View>

              <FactsList facts={facts} />

              {mode === 'estagios' && (
                <View style={styles.uncert}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.ink3} />
                  <Text style={styles.uncertText}>
                    Estimativa do seu relógio. Vale para comparar você com você mesmo — não é medida clínica.
                    {form === 'weeks' ? ' Nas semanas, o gráfico é composição (horas por estágio), não posição.' : ''}
                    {form === 'nights' && !hasSegments ? ' Estas noites ainda não têm os intervalos gravados — o próximo sync os traz.' : ''}
                  </Text>
                </View>
              )}
              {mode === 'tempos' && form === 'nights' && summary?.bedMeasuredShare === 0 && (
                <Text style={styles.hint}>
                  Seu relógio abre a janela na cama junto com o sono, por isso o fundo claro quase não aparece por fora do azul.
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;
function LegendItem({ swatch, label, styles }: { swatch: object; label: string; styles: Styles }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, swatch]} />
      <Text style={styles.legendText}>{label}</Text>
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
    chartWrap: { marginTop: spacing.md },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 11, height: 11, borderRadius: 3 },
    legendText: { fontSize: 11, color: colors.ink2, fontFamily: fonts.sans },
    hint: { marginTop: spacing.sm, fontSize: 11.5, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },
    uncert: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.md },
    uncertText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },
  });
