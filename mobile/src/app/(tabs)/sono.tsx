import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  awakeMinOf,
  awakeSeries,
  bedtimeMeasured,
  clockLabel,
  efficiency,
  localDateStr,
  type SleepPeriod,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { useAuthStore } from '../../store/auth.store';
import { formatHoursMin } from '../../lib/health-buckets';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import { SleepTimingChart } from '../../components/charts/SleepTimingChart';
import { AwakeningsClock } from '../../components/charts/AwakeningsClock';
import { SleepLegend, SwDashed, SwGap, SwSolid } from '../../components/sono/SleepLegend';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

/** Noites no timing chart — o que cabe legível na largura de um telefone. */
const TIMING_NIGHTS = 14;
/** Noites no relógio de vigília e na série de tempo acordado. */
const AWAKE_NIGHTS = 30;

/** Os N dias de acordar terminando em `last`, inclusive — com os sem noite. */
function lastDays(last: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(`${last}T12:00:00`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(localDateStr(x));
  }
  return out;
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * A tela de sono. Quatro peças, nessa ordem — spec docs/specs/sono/spec.md:
 * ① os relógios (o fato), ② o timing chart (a forma), ③ os despertares,
 * ④ a nota contra a medição. Sem score, sem streak, sem seta.
 *
 * É uma **aba** da barra desde 05/09/2026 — entrou no lugar de Compras, que
 * passou ao Mais. Por isso não tem botão de voltar e respeita a pílula: o
 * `paddingBottom` vem de `useTabBarHeight` e o scroll a colapsa como as outras.
 * As subviews (`/sono/tempos`, `/sono/despertares`, `/sono/[day]`) continuam na
 * pilha raiz, empilhadas por cima da aba.
 *
 * Sono usa a cor da água por decisão (ADR 0031): é categoria de Saúde, não módulo —
 * ter aba própria não muda isso. As cores vêm de `sleepColors()` — azul é sono,
 * amarelo é vigília, em toda tela.
 */
export default function SonoScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const tabBarScroll = useTabBarScroll();
  const router = useRouter();
  const sc = sleepColors();

  const periods = useSonoStore((s) => s.periods);
  const sleepRatings = useSonoStore((s) => s.sleepRatings);
  const loading = useSonoStore((s) => s.loading);
  const loaded = useSonoStore((s) => s.loaded);
  const load = useSonoStore((s) => s.load);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  const [chartW, setChartW] = useState(0);
  const onChartLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  const last = periods[periods.length - 1];
  const timingDays = useMemo(() => (last ? lastDays(last.wakeDay, TIMING_NIGHTS) : []), [last]);
  const recent = useMemo(() => periods.slice(-AWAKE_NIGHTS), [periods]);
  const series = useMemo(() => awakeSeries(recent).slice(-TIMING_NIGHTS), [recent]);

  // ④ Nota × medição: por nota, o intervalo e a média das horas dormidas.
  const groups = useMemo(() => {
    const by = new Map<number, number[]>();
    for (const p of periods) {
      const nota = sleepRatings[p.wakeDay];
      if (nota == null) continue;
      const arr = by.get(nota) ?? [];
      arr.push(p.asleepH);
      by.set(nota, arr);
    }
    return [1, 2, 3, 4, 5]
      .filter((n) => by.has(n))
      .map((n) => {
        const hs = by.get(n)!;
        return {
          nota: n,
          n: hs.length,
          min: Math.min(...hs),
          max: Math.max(...hs),
          mean: hs.reduce((a, b) => a + b, 0) / hs.length,
        };
      });
  }, [periods, sleepRatings]);

  if (!loaded && loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header styles={styles} />
        <View style={styles.center}>
          <ActivityIndicator color={sc.sleep} />
        </View>
      </View>
    );
  }

  if (!last) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header styles={styles} />
        <View style={styles.center}>
          <Ionicons name="moon-outline" size={36} color={colors.ink4} />
          <Text style={styles.emptyText}>Nenhuma noite sincronizada ainda.</Text>
          <Text style={styles.emptySub}>O sync de Saúde traz as noites do seu relógio para cá.</Text>
        </View>
      </View>
    );
  }

  const bedOk = bedtimeMeasured(last);
  const eff = efficiency(last);
  const lastAwake = awakeMinOf(last);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Header styles={styles} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight }]}
        showsVerticalScrollIndicator={false}
        {...tabBarScroll}
      >
        {/* ① Os relógios — a frase que o usuário pediu, sem a subtração. */}
        <Pressable
          onPress={() => router.push({ pathname: '/sono/[day]', params: { day: last.wakeDay } })}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <Text style={styles.eyebrow}>{dayLabel(last.wakeDay)}</Text>
          <View style={styles.clocks}>
            <Clock label="Deitou" value={bedOk ? clockLabel(last.inBedAt!, last.tzOffset) : '--:--'} muted={!bedOk} styles={styles} />
            <Clock label="Apagou" value={clockLabel(last.onsetAt, last.tzOffset)} styles={styles} />
            <Clock label="Acordou" value={clockLabel(last.wakeAt, last.tzOffset)} styles={styles} />
          </View>
          <View style={styles.rule} />
          <Text style={styles.dur}>
            <Text style={styles.durStrong}>{formatHoursMin(last.asleepH)}</Text> dormindo
            {eff != null && last.inBedAt && last.inBedEnd ? (
              <>
                {' · '}
                <Text style={styles.durStrong}>
                  {formatHoursMin((new Date(last.inBedEnd).getTime() - new Date(last.inBedAt).getTime()) / 3_600_000)}
                </Text>{' '}
                na cama
              </>
            ) : null}
            {lastAwake != null && lastAwake > 0 ? (
              <>
                {' · '}
                <Text style={styles.durStrong}>{Math.round(lastAwake)} min</Text> acordado
              </>
            ) : null}
          </Text>
          {!bedOk && (
            <View style={[styles.absent, { borderColor: colors.ink4 }]}>
              <Text style={styles.absentText}>
                <Text style={styles.absentStrong}>Seu relógio não registra a hora de deitar.</Text> Ele começa a contar
                quando você já apagou.
              </Text>
            </View>
          )}
        </Pressable>

        {/* ② O timing chart — a regularidade aparece na forma, não num índice.
            Tocar abre /sono/tempos: períodos navegáveis, despertares em destaque, fatos. */}
        <Pressable
          onPress={() => router.push('/sono/tempos')}
          onLayout={onChartLayout}
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Últimas {TIMING_NIGHTS} noites</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.ink4} />
          </View>
          <SleepTimingChart
            days={timingDays}
            periods={periods}
            width={Math.max(0, chartW - spacing.lg * 2)}
            palette={sc}
            emphasis="sleep"
          />
          <SleepLegend
            items={[
              { swatch: <SwSolid color={sc.sleep} />, label: 'dormindo' },
              { swatch: <SwGap />, label: 'despertar (o vão)' },
              { swatch: <SwDashed color={sc.sleep} />, label: 'na cama' },
              { swatch: <SwDashed color={colors.line} />, label: 'sem dado' },
            ]}
          />
        </Pressable>

        {/* ③ Despertares — quando a noite quebra, não quantas vezes na média.
            Tocar abre /sono/despertares: quando, quanto, por dia da semana. */}
        <Pressable onPress={() => router.push('/sono/despertares')} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Despertares</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.ink4} />
          </View>
          <Text style={styles.cardSub}>últimas {recent.length} noites, sobrepostas na hora do dia</Text>
          <AwakeningsClock periods={recent} width={Math.max(0, chartW - spacing.lg * 2)} color={sc.awake} />
          <View style={styles.seriesRow}>
            {series.map((s) => (
              <View key={s.wakeDay} style={styles.seriesCol}>
                <View style={styles.seriesTrack}>
                  {s.awakeMin == null ? (
                    <View style={[styles.seriesUnknown, { borderColor: colors.line }]} />
                  ) : (
                    <View
                      style={[
                        styles.seriesBar,
                        { backgroundColor: sc.awake, height: Math.max(2, Math.min(40, (s.awakeMin / 60) * 40)) },
                      ]}
                    />
                  )}
                </View>
                <Text style={styles.seriesLabel}>{s.wakeDay.slice(8)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardNote}>Minutos acordado por noite. Sem meta — a série existe para você ver, não para bater um alvo.</Text>
        </Pressable>

        {/* ④ Nota × medição — o par que só o Orbe tem. Sem seta, sem "melhorou". */}
        {groups.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Como você acordou</Text>
            <Text style={styles.cardSub}>
              {groups.reduce((a, g) => a + g.n, 0)} noites com nota e medição
            </Text>
            {groups.map((g) => (
              <View key={g.nota} style={styles.pairRow}>
                <Text style={styles.pips}>
                  <Text style={{ color: sc.sleep }}>{'●'.repeat(g.nota)}</Text>
                  <Text style={{ color: colors.ink4 }}>{'●'.repeat(5 - g.nota)}</Text>
                </Text>
                <View style={styles.rangeWrap}>
                  <View
                    style={[
                      styles.rangeBar,
                      { backgroundColor: sc.bed, left: `${(g.min / 12) * 100}%`, right: `${100 - (g.max / 12) * 100}%` },
                    ]}
                  />
                  <View style={[styles.rangeDot, { backgroundColor: sc.sleep, left: `${(g.mean / 12) * 100}%` }]} />
                </View>
                <View style={styles.pairN}>
                  <Text style={styles.pairMean}>{formatHoursMin(g.mean)}</Text>
                  <Text style={styles.pairCount}>{g.n} {g.n === 1 ? 'noite' : 'noites'}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.cardNote}>
              Barra = do mínimo ao máximo dormido; ponto = média. Se a medição discordar do corpo, quem está certo é o corpo.
            </Text>
          </View>
        )}

        {/* Noites — cada uma abre o detalhe. */}
        <Text style={styles.sectionTitle}>Noites</Text>
        <View style={styles.listCard}>
          {[...recent].reverse().map((p, i, arr) => (
            <NightRow key={p.onsetAt} p={p} nota={sleepRatings[p.wakeDay]} last={i === arr.length - 1} accent={sc.sleep} styles={styles} onPress={() => router.push({ pathname: '/sono/[day]', params: { day: p.wakeDay } })} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

/** O cabeçalho de aba — o mesmo desenho do de Compras e do Mais: título serifado, sem voltar. */
function Header({ styles }: { styles: Styles }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Sono</Text>
    </View>
  );
}

function Clock({ label, value, muted, styles }: { label: string; value: string; muted?: boolean; styles: Styles }) {
  return (
    <View style={styles.clock}>
      <Text style={styles.clockLabel}>{label}</Text>
      <Text style={[styles.clockValue, muted && styles.clockMuted]}>{value}</Text>
    </View>
  );
}

function NightRow({
  p, nota, last, accent, styles, onPress,
}: { p: SleepPeriod; nota?: number; last: boolean; accent: string; styles: Styles; onPress: () => void }) {
  const awake = awakeMinOf(p);
  const n = p.awakenings?.length ?? 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, last && styles.noBorder, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowDay}>{dayLabel(p.wakeDay)}</Text>
        <Text style={styles.rowSub}>
          {clockLabel(p.onsetAt, p.tzOffset)} → {clockLabel(p.wakeAt, p.tzOffset)}
          {awake == null ? '' : n > 0 ? ` · ${n} ${n === 1 ? 'despertar' : 'despertares'}` : ' · sem despertar'}
        </Text>
      </View>
      <Text style={[styles.rowHours, { color: accent }]}>{formatHoursMin(p.asleepH)}</Text>
      {nota != null && <Text style={styles.rowNota}>{nota}/5</Text>}
      <Ionicons name="chevron-forward" size={16} color={colors.ink4} />
    </Pressable>
  );
}

const createStyles = () =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    // O respiro de baixo é a altura da pílula, aplicado no render.
    scroll: { padding: spacing.lg, gap: spacing.md },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center' },
    headerTitle: { fontSize: 28, fontFamily: fonts.serif, color: colors.ink },
    pressed: { opacity: 0.7 },
    flex: { flex: 1 },

    card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, ...shadows.card },
    listCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
    eyebrow: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink3, fontFamily: fonts.sansSemiBold, marginBottom: spacing.md },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTitle: { fontSize: 15, fontFamily: fonts.sansBold, color: colors.ink, marginBottom: 2 },
    cardSub: { fontSize: 12, color: colors.ink3, fontFamily: fonts.sans, marginBottom: spacing.sm },
    cardNote: { fontSize: 12, lineHeight: 17, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },
    sectionTitle: { fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink2, marginTop: spacing.sm, marginLeft: 4 },

    clocks: { flexDirection: 'row', gap: spacing.md },
    clock: { flex: 1 },
    clockLabel: { fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink3, fontFamily: fonts.sansSemiBold },
    clockValue: { fontSize: 30, fontFamily: fonts.mono, color: colors.ink, letterSpacing: -1, marginTop: 2 },
    clockMuted: { color: colors.ink4 },
    rule: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
    dur: { fontSize: 13.5, color: colors.ink2, fontFamily: fonts.sans },
    durStrong: { color: colors.ink, fontFamily: fonts.sansSemiBold },
    absent: { marginTop: spacing.md, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderStyle: 'dashed' },
    absentText: { fontSize: 12, lineHeight: 17, color: colors.ink2, fontFamily: fonts.sans },
    absentStrong: { color: colors.ink, fontFamily: fonts.sansSemiBold },

    seriesRow: { flexDirection: 'row', gap: 3, marginTop: spacing.md, alignItems: 'flex-end' },
    seriesCol: { flex: 1, alignItems: 'center' },
    seriesTrack: { height: 40, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    seriesBar: { width: '70%', borderRadius: 2 },
    seriesUnknown: { width: '70%', height: 40, borderRadius: 2, borderWidth: 1, borderStyle: 'dashed' },
    seriesLabel: { fontSize: 8.5, color: colors.ink4, fontFamily: fonts.mono, marginTop: 4 },

    pairRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
    pips: { width: 62, fontSize: 12, letterSpacing: 1 },
    rangeWrap: { flex: 1, height: 20, position: 'relative' },
    rangeBar: { position: 'absolute', top: 8, height: 4, borderRadius: 2 },
    rangeDot: { position: 'absolute', top: 4, width: 12, height: 12, borderRadius: 6, marginLeft: -6, borderWidth: 2, borderColor: colors.surface },
    pairN: { width: 70, alignItems: 'flex-end' },
    pairMean: { fontSize: 13, fontFamily: fonts.mono, color: colors.ink },
    pairCount: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans },

    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
    noBorder: { borderBottomWidth: 0 },
    rowDay: { fontSize: 14, fontFamily: fonts.sansSemiBold, color: colors.ink, textTransform: 'capitalize' },
    rowSub: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono, marginTop: 2 },
    rowHours: { fontSize: 15, fontFamily: fonts.mono },
    rowNota: { fontSize: 12, color: colors.ink3, fontFamily: fonts.mono },

    emptyText: { fontSize: 15, fontFamily: fonts.sansSemiBold, color: colors.ink2, textAlign: 'center' },
    emptySub: { fontSize: 13, color: colors.ink3, fontFamily: fonts.sans, textAlign: 'center' },
  });
