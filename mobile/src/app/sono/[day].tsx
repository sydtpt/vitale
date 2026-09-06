import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STAGE_LABEL, awakeMinOf, bedtimeMeasured, clockLabel, type SleepColors, type SleepPeriod, type StageKey } from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { formatHoursMin } from '../../lib/health-buckets';
import { SwGapTick, SwHatch, SwSolid } from '../../components/sono/SleepLegend';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

/** Estágios na ordem do hipnograma — a mesma da legenda e da pilha. */
const STAGES: StageKey[] = ['rem', 'core', 'deep', 'unspecified'];
const STRIP_H = 22;
/** A marca amarela do despertar, abaixo da faixa — o "ao lado" de uma faixa deitada. */
const TICK_H = 4;

function dayTitle(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function stageFill(k: StageKey, sc: SleepColors, hatchId: string): string {
  if (k === 'deep') return sc.deep;
  if (k === 'rem') return sc.rem;
  if (k === 'core') return sc.light;
  return `url(#${hatchId})`;
}

/**
 * O detalhe de uma noite (CAP-4). Duas faixas, e a diferença entre elas é o que
 * o dado sustenta: a de cima é a LINHA DO TEMPO real — sono do apagar ao acordar,
 * com os despertares cortando nas posições em que ocorreram; a de baixo são os
 * estágios — na posição real quando os intervalos existem, em proporção nas
 * noites gravadas antes da coluna.
 *
 * As cores vêm de `sleepColors()`: azul é sono, o rosa é REM, o amarelo é
 * vigília — o vão na faixa, com a marca embaixo. O rótulo de incerteza não é
 * rodapé: os aparelhos acertam "dormiu" e erram "acordou" (especificidade
 * sono/vigília entre 30% e 61% contra polissonografia). A tela mostra e não conclui.
 */
export default function SonoDayScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { day = '' } = useLocalSearchParams<{ day: string }>();
  const sc = sleepColors();

  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  const byDay = useSonoStore((s) => s.byDay);
  const nota = useSonoStore((s) => s.sleepRatings[day]);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const p: SleepPeriod | undefined = byDay(day);
  const stripW = Math.max(0, w - spacing.lg * 2);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Noite</Text>
        <HeaderSpacer />
      </View>

      {!p ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{loaded ? 'Noite não encontrada.' : 'Carregando…'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{dayTitle(p.wakeDay)}</Text>

          <View style={styles.card}>
            <View style={styles.clocks}>
              <Clock label="Deitou" value={bedtimeMeasured(p) ? clockLabel(p.inBedAt!, p.tzOffset) : '--:--'} muted={!bedtimeMeasured(p)} styles={styles} />
              <Clock label="Apagou" value={clockLabel(p.onsetAt, p.tzOffset)} styles={styles} />
              <Clock label="Acordou" value={clockLabel(p.wakeAt, p.tzOffset)} styles={styles} />
            </View>
            <Text style={styles.dur}>
              <Text style={styles.durStrong}>{formatHoursMin(p.asleepH)}</Text> dormindo
              {nota != null ? <> · acordou dando <Text style={styles.durStrong}>{nota}/5</Text></> : null}
            </Text>
          </View>

          {/* A linha do tempo: o sono, e os despertares onde ocorreram. */}
          <View style={styles.card} onLayout={onLayout}>
            <Text style={styles.cardTitle}>A noite</Text>
            <NightStrip p={p} width={stripW} sc={sc} mode="sleep" />
            <View style={styles.ticks}>
              <Text style={styles.tick}>{clockLabel(p.onsetAt, p.tzOffset)}</Text>
              <Text style={styles.tick}>{clockLabel(p.wakeAt, p.tzOffset)}</Text>
            </View>
            <AwakeLine p={p} styles={styles} />
          </View>

          {/* Estágios — na posição real quando os intervalos existem; em proporção
              nas noites gravadas antes da coluna. Textura, não conselho. */}
          {p.stages && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estágios</Text>
              <NightStrip p={p} width={stripW} sc={sc} mode="stages" />
              <View style={styles.stageKey}>
                {STAGES.filter((k) => (p.stages?.[k] ?? 0) > 0).map((k) => (
                  <View key={k} style={styles.keyItem}>
                    {k === 'unspecified' ? <SwHatch color={sc.unknown} id="day-hatch-key" /> : <SwSolid color={stageFill(k, sc, '')} />}
                    <Text style={styles.keyText}>
                      {STAGE_LABEL[k]} {formatHoursMin(p.stages![k])}
                    </Text>
                  </View>
                ))}
                {p.awakenings && p.awakenings.length > 0 && (
                  <View style={styles.keyItem}>
                    <SwGapTick awake={sc.awake} />
                    <Text style={styles.keyText}>despertar {Math.round(awakeMinOf(p) ?? 0)} min</Text>
                  </View>
                )}
              </View>
              <View style={styles.uncert}>
                <Ionicons name="alert-circle-outline" size={13} color={colors.ink3} />
                <Text style={styles.uncertText}>
                  Estimativa do seu relógio. Vale para comparar você com você mesmo — não é medida clínica.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Clock({ label, value, muted, styles }: { label: string; value: string; muted?: boolean; styles: Styles }) {
  return (
    <View style={styles.clock}>
      <Text style={styles.clockLabel}>{label}</Text>
      <Text style={[styles.clockValue, muted && styles.clockMuted]}>{value}</Text>
    </View>
  );
}

/**
 * A faixa da noite, do apagar ao acordar. `sleep`: o sono inteiro, furado pelos
 * despertares. `stages`: cada estágio na posição real — ou, sem intervalos, em
 * proporção — e o mesmo vão. Embaixo da faixa, a marca amarela de cada despertar:
 * o "ao lado" de uma barra deitada.
 */
function NightStrip({ p, width, sc, mode }: { p: SleepPeriod; width: number; sc: SleepColors; mode: 'sleep' | 'stages' }) {
  if (width <= 0) return null;
  const hatchId = `night-hatch-${mode}`;
  const start = new Date(p.onsetAt).getTime();
  const span = Math.max(new Date(p.wakeAt).getTime() - start, 1);
  const x = (iso: string) => ((new Date(iso).getTime() - start) / span) * width;
  const holes = p.awakenings ?? [];
  const segments = p.stageSegments ?? [];

  // Sem intervalos, a composição em proporção: cada estágio ocupa a fração das horas.
  const proportional: { stage: StageKey; from: number; to: number }[] = [];
  if (mode === 'stages' && segments.length === 0 && p.stages) {
    const total = STAGES.reduce((a, k) => a + (p.stages?.[k] ?? 0), 0);
    let acc = 0;
    for (const k of STAGES) {
      const h = p.stages[k] ?? 0;
      if (h <= 0 || total <= 0) continue;
      proportional.push({ stage: k, from: (acc / total) * width, to: ((acc + h) / total) * width });
      acc += h;
    }
  }

  return (
    <View>
      <Svg width={width} height={STRIP_H} style={{ borderRadius: 6, overflow: 'hidden' }}>
        <Defs>
          <Pattern id={hatchId} patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={5} stroke={sc.unknown} strokeWidth={1.3} />
          </Pattern>
        </Defs>
        {mode === 'sleep' ? (
          <Rect x={0} y={0} width={width} height={STRIP_H} rx={6} fill={sc.sleep} />
        ) : segments.length > 0 ? (
          segments.map((s, i) => (
            <Rect key={i} x={x(s.from)} y={0} width={Math.max(1, x(s.to) - x(s.from))} height={STRIP_H} fill={stageFill(s.stage, sc, hatchId)} />
          ))
        ) : (
          proportional.map((s, i) => (
            <Rect key={i} x={s.from} y={0} width={Math.max(1, s.to - s.from)} height={STRIP_H} fill={stageFill(s.stage, sc, hatchId)} />
          ))
        )}
        {(mode === 'sleep' || segments.length > 0) &&
          holes.map((a, i) => (
            <Rect key={`h${i}`} x={x(a.from)} y={0} width={Math.max(2, x(a.to) - x(a.from))} height={STRIP_H} fill={colors.surface} />
          ))}
      </Svg>
      {holes.length > 0 && (
        <Svg width={width} height={TICK_H} style={{ marginTop: 2 }}>
          {holes.map((a, i) => (
            <Rect key={i} x={x(a.from)} y={0} width={Math.max(3, x(a.to) - x(a.from))} height={TICK_H} rx={1} fill={sc.awake} />
          ))}
        </Svg>
      )}
    </View>
  );
}

function AwakeLine({ p, styles }: { p: SleepPeriod; styles: Styles }) {
  const min = awakeMinOf(p);
  if (min == null) return <Text style={styles.cardNote}>Seu relógio não reporta despertares nesta noite.</Text>;
  const n = p.awakenings?.length ?? 0;
  if (n === 0) return <Text style={styles.cardNote}>Sem despertar registrado.</Text>;
  return (
    <Text style={styles.cardNote}>
      {n} {n === 1 ? 'despertar' : 'despertares'} · {Math.round(min)} min acordado
    </Text>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: fonts.sansBold, color: colors.ink },
    pressed: { opacity: 0.7 },
    title: { fontSize: 20, fontFamily: fonts.sansBold, color: colors.ink, textTransform: 'capitalize', marginLeft: 4 },

    card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, ...shadows.card },
    cardTitle: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: spacing.sm },
    cardNote: { fontSize: 12, lineHeight: 17, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },

    clocks: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    clock: { flex: 1 },
    clockLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink3, fontFamily: fonts.sansSemiBold },
    clockValue: { fontSize: 28, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -1, marginTop: 2 },
    clockMuted: { color: colors.ink4 },
    dur: { fontSize: 13.5, color: colors.ink2, fontFamily: fonts.sans },
    durStrong: { color: colors.ink, fontFamily: fonts.sansSemiBold },

    ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    tick: { fontSize: 10, fontFamily: fonts.mono, color: colors.ink3 },

    stageKey: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, columnGap: spacing.md, marginTop: spacing.sm },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    keyText: { fontSize: 11, color: colors.ink2, fontFamily: fonts.sans },
    uncert: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.md },
    uncertText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },

    emptyText: { fontSize: 14, color: colors.ink3, fontFamily: fonts.sans },
  });
