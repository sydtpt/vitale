import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { awakeMinOf, bedtimeMeasured, clockLabel, type SleepPeriod } from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { formatHoursMin } from '../../lib/health-buckets';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, moduleColors, radii, roleColors, shadows, spacing, useThemedStyles } from '../../theme';

/** Estágios na ordem da faixa, com o rótulo que o usuário lê. */
const STAGES: { key: string; label: string }[] = [
  { key: 'deep', label: 'Profundo' },
  { key: 'rem', label: 'REM' },
  { key: 'core', label: 'Leve' },
  { key: 'unspecified', label: 'Sem estágio' },
];

function dayTitle(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * O detalhe de uma noite (CAP-4). Duas faixas, e a diferença entre elas é o que
 * o dado sustenta: a de cima é a LINHA DO TEMPO real — sono do apagar ao acordar,
 * com os despertares cortando nas posições em que ocorreram; a de baixo é a
 * composição por estágio em PROPORÇÃO, porque o que se grava são horas por
 * estágio, não os intervalos.
 *
 * O rótulo de incerteza não é rodapé: os aparelhos acertam "dormiu" e erram
 * "acordou" (especificidade sono/vigília entre 30% e 61% contra polissonografia).
 * A tela mostra e não conclui.
 */
export default function SonoDayScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { day = '' } = useLocalSearchParams<{ day: string }>();
  const mod = moduleColors('agua');
  const deep = roleColors('blue').text;

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
            <Timeline p={p} width={Math.max(0, w - spacing.lg * 2)} accent={mod.accent} styles={styles} />
            <AwakeLine p={p} styles={styles} />
          </View>

          {/* Estágios em proporção — textura, não conselho. */}
          {p.stages && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estágios</Text>
              <StageBar stages={p.stages} palette={{ deep, rem: mod.accent, core: mod.tint, unspecified: colors.ink4 }} styles={styles} />
              <View style={styles.stageKey}>
                {STAGES.filter((s) => (p.stages?.[s.key] ?? 0) > 0).map((s) => (
                  <View key={s.key} style={styles.keyItem}>
                    <View style={[styles.keySwatch, { backgroundColor: { deep, rem: mod.accent, core: mod.tint, unspecified: colors.ink4 }[s.key] }]} />
                    <Text style={styles.keyText}>
                      {s.label} {formatHoursMin(p.stages![s.key])}
                    </Text>
                  </View>
                ))}
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

/** Sono do apagar ao acordar; os despertares cortam nas posições reais. */
function Timeline({ p, width, accent, styles }: { p: SleepPeriod; width: number; accent: string; styles: Styles }) {
  if (width <= 0) return null;
  const start = new Date(p.onsetAt).getTime();
  const end = new Date(p.wakeAt).getTime();
  const span = Math.max(end - start, 1);
  const x = (iso: string) => ((new Date(iso).getTime() - start) / span) * width;
  return (
    <View style={[styles.timeline, { width }]}>
      <View style={[styles.timelineFill, { backgroundColor: accent }]} />
      {(p.awakenings ?? []).map((a, i) => (
        <View
          key={i}
          style={[
            styles.timelineHole,
            { left: x(a.from), width: Math.max(2, x(a.to) - x(a.from)), backgroundColor: colors.surface },
          ]}
        />
      ))}
      <Text style={[styles.timelineTick, { left: 0 }]}>{clockLabel(p.onsetAt, p.tzOffset)}</Text>
      <Text style={[styles.timelineTick, { right: 0 }]}>{clockLabel(p.wakeAt, p.tzOffset)}</Text>
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

function StageBar({
  stages, palette, styles,
}: { stages: Record<string, number>; palette: Record<string, string>; styles: Styles }) {
  const total = STAGES.reduce((a, s) => a + (stages[s.key] ?? 0), 0);
  if (total <= 0) return null;
  return (
    <View style={styles.stageBar}>
      {STAGES.filter((s) => (stages[s.key] ?? 0) > 0).map((s) => (
        <View key={s.key} style={{ flex: stages[s.key] / total, backgroundColor: palette[s.key] }} />
      ))}
    </View>
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

    timeline: { height: 22, borderRadius: 6, overflow: 'hidden', position: 'relative', marginTop: spacing.sm, marginBottom: 18 },
    timelineFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    timelineHole: { position: 'absolute', top: 0, bottom: 0 },
    timelineTick: { position: 'absolute', top: 24, fontSize: 10, fontFamily: fonts.mono, color: colors.ink3 },

    stageBar: { flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden' },
    stageKey: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, columnGap: spacing.md, marginTop: spacing.sm },
    keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    keySwatch: { width: 9, height: 9, borderRadius: 2 },
    keyText: { fontSize: 11, color: colors.ink2, fontFamily: fonts.sans },
    uncert: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.md },
    uncertText: { flex: 1, fontSize: 11, lineHeight: 16, color: colors.ink3, fontFamily: fonts.sans },

    emptyText: { fontSize: 14, color: colors.ink3, fontFamily: fonts.sans },
  });
