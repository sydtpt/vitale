import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SLEEP_AXIS_ORIGIN_H,
  awakeByWeekday,
  awakeFacts,
  awakeningDurations,
  awakeningsByHour,
  filterByRange,
  periodSummary,
  type SonoRange,
} from '@vitale/shared';
import { useSonoStore } from '../../store/sono.store';
import { AwakeningsClock } from '../../components/charts/AwakeningsClock';
import { PeriodNav } from '../../components/sono/PeriodNav';
import { PeriodAverages } from '../../components/sono/PeriodAverages';
import { FactsList } from '../../components/sono/FactsList';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';
import { colors, fonts, radii, shadows, sleepColors, spacing, useThemedStyles } from '../../theme';

const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * /sono/despertares — a subview que abre ao tocar em Despertares (CAP-7). A
 * pergunta do usuário: *quando* tenho acordado e por *quanto* tempo. Quatro
 * leituras da mesma matéria-prima, no período navegável: a densidade por hora
 * (o relógio de vigília), em quantas noites por hora, a duração de cada
 * despertar, e por dia da semana. Embaixo, fatos com o *n* ao lado.
 *
 * Tudo aqui é vigília, e vigília é amarelo — uma cor só. O fim de semana é
 * rótulo em tinta forte, não cor de barra: cor por categoria num eixo que já
 * nomeia a categoria gasta o canal à toa.
 *
 * Sem score, sem índice de fragmentação: o par vigília × nota corre ao contrário
 * do que um score assumiria (spec §6). A tela mostra e não conclui.
 */
export default function SonoDespertaresScreen() {
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
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const nights = useMemo(() => filterByRange(periods, range, new Date(), offset), [periods, range, offset]);
  const summary = useMemo(() => periodSummary(nights), [nights]);
  const byHour = useMemo(() => awakeningsByHour(nights), [nights]);
  const durations = useMemo(() => awakeningDurations(nights), [nights]);
  const byDow = useMemo(() => awakeByWeekday(nights), [nights]);
  const facts = useMemo(() => awakeFacts(nights), [nights]);
  const reporting = nights.filter((n) => n.awakenings !== null).length;
  const chartW = Math.max(0, w - spacing.lg * 2);

  const maxNights = Math.max(1, ...byHour.map((b) => b.nights));
  const maxDur = Math.max(1, ...durations.map((d) => d.count));
  const maxDow = Math.max(1, ...byDow.map((d) => d.avgMin ?? 0));
  // Faixas de hora contíguas da primeira à última com despertar, para o eixo não pular.
  const hourBins = useMemo(() => {
    if (byHour.length === 0) return [];
    const from = byHour[0].from;
    const to = byHour[byHour.length - 1].from;
    const out: { from: number; nights: number }[] = [];
    for (let h = from; h <= to; h += 1) out.push({ from: h, nights: byHour.find((b) => b.from === h)?.nights ?? 0 });
    return out;
  }, [byHour]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Despertares</Text>
        <HeaderSpacer />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card} onLayout={onLayout}>
          <PeriodNav range={range} offset={offset} periods={periods} nights={nights} onRange={setRange} onOffset={setOffset} />

          {!loaded ? (
            <View style={styles.center}><ActivityIndicator color={sc.sleep} /></View>
          ) : nights.length === 0 ? (
            <Text style={styles.empty}>Sem noites neste período.</Text>
          ) : reporting === 0 ? (
            <Text style={styles.empty}>Seu relógio não reporta despertares nestas noites — não dá para saber.</Text>
          ) : (
            <>
              {summary && <PeriodAverages summary={summary} palette={sc} />}

              <Text style={styles.h}>Quando</Text>
              <Text style={styles.sub}>densidade por hora da noite · {reporting} noites</Text>
              <AwakeningsClock periods={nights} width={chartW} color={sc.awake} />

              {hourBins.length > 0 && (
                <>
                  <Text style={styles.sub2}>em quantas noites houve despertar em cada hora</Text>
                  <View style={styles.bars}>
                    {hourBins.map((b) => (
                      <View key={b.from} style={styles.col}>
                        <View style={styles.track}>
                          <View style={[styles.bar, { height: Math.max(2, (b.nights / maxNights) * 56), backgroundColor: sc.awake, opacity: b.nights ? 0.45 + 0.55 * (b.nights / maxNights) : 0.15 }]} />
                        </View>
                        <Text style={styles.xl}>{b.from % 2 === 0 ? `${String((SLEEP_AXIS_ORIGIN_H + b.from) % 24).padStart(2, '0')}h` : ''}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.h}>Quanto</Text>
              <Text style={styles.sub}>duração de cada despertar, em minutos</Text>
              <View style={styles.bars}>
                {durations.map((d) => (
                  <View key={d.label} style={styles.col}>
                    <View style={styles.track}>
                      <View style={[styles.bar, { height: Math.max(2, (d.count / maxDur) * 56), backgroundColor: sc.awake }]} />
                    </View>
                    <Text style={styles.xl}>{d.label}</Text>
                    <Text style={styles.xn}>{d.count}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.h}>Por dia da semana</Text>
              <Text style={styles.sub}>minutos acordado, média por noite · fim de semana em destaque</Text>
              <View style={styles.bars}>
                {byDow.map((d) => {
                  const fds = d.weekday === 0 || d.weekday === 6;
                  return (
                    <View key={d.weekday} style={styles.col}>
                      <View style={styles.track}>
                        {d.avgMin == null ? (
                          <View style={[styles.unknown, { borderColor: colors.line }]} />
                        ) : (
                          <View style={[styles.bar, { height: Math.max(2, (d.avgMin / maxDow) * 56), backgroundColor: sc.awake }]} />
                        )}
                      </View>
                      <Text style={[styles.xl, fds && styles.xlFds]}>{DOW[d.weekday]}</Text>
                      <Text style={styles.xn}>{d.avgMin == null ? '—' : Math.round(d.avgMin)}</Text>
                    </View>
                  );
                })}
              </View>

              <FactsList facts={facts} />
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
    h: { marginTop: spacing.lg, fontSize: 13, fontFamily: fonts.sansBold, color: colors.ink },
    sub: { fontSize: 11.5, color: colors.ink3, fontFamily: fonts.sans, marginBottom: 6 },
    sub2: { fontSize: 11, color: colors.ink3, fontFamily: fonts.sans, marginTop: spacing.sm },
    bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', marginTop: 6 },
    col: { flex: 1, alignItems: 'center' },
    track: { height: 56, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    bar: { width: '72%', borderRadius: 2 },
    unknown: { width: '72%', height: 56, borderRadius: 2, borderWidth: 1, borderStyle: 'dashed' },
    xl: { fontSize: 8.5, color: colors.ink4, fontFamily: fonts.mono, marginTop: 4 },
    xlFds: { color: colors.ink, fontFamily: fonts.monoSemiBold },
    xn: { fontSize: 9.5, color: colors.ink3, fontFamily: fonts.mono },
  });
