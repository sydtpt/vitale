import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  readinessInputsByDay,
  readinessSeries,
  activityDays,
  weeklyLoadVsRecovery,
  wellnessSummary,
  sportHealthCorrelations,
  buildPeriodRecap,
  type RecapStat,
} from '@vitale/shared';
import type { Bucket } from '../../lib/health-buckets';
import { useHealthDailyStore } from '../../store/health-daily.store';
import { useActivitiesStore } from '../../store/activities.store';
import { useAuthStore } from '../../store/auth.store';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { colors, spacing, radii, shadows, MOD, useThemedStyles } from '../../theme';

const CHART_W = Dimensions.get('window').width - spacing.lg * 2 - 28;

/** Nome legível de cada componente, para nomear o que faltou. */
const CAT_LABEL: Record<string, string> = {
  sono: 'sono', fcRepouso: 'FC de repouso', vfc: 'VFC', aneis: 'anéis',
};

const CAT_COLOR: Record<string, string> = {
  sono: MOD.agua.accent,
  fcRepouso: MOD.compras.accent,
  vfc: MOD.habito.accent,
  aneis: MOD.treino.accent,
};
const TONE_COLOR: Record<string, string> = {
  good: MOD.habito.accent,
  bad: MOD.compras.accent,
  neutral: colors.ink3,
};
const LOAD_COLOR: Record<string, string> = {
  baixa: MOD.habito.accent,
  moderada: MOD.food.accent,
  alta: MOD.treino.accent,
};

function parseMs(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function fmtDelta(s: RecapStat): { txt: string; tone: 'up' | 'down' | 'flat' } {
  if (s.deltaPct == null) return { txt: '—', tone: 'flat' };
  const r = Math.round(s.deltaPct);
  if (r === 0) return { txt: '0%', tone: 'flat' };
  return { txt: `${r > 0 ? '↑' : '↓'}${Math.abs(r)}%`, tone: r > 0 ? 'up' : 'down' };
}

function fmtDur(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const DELTA_COLOR = { up: MOD.habito.accent, down: MOD.compras.accent, flat: '' };

export default function RecuperacaoScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [range, setRange] = useState<30 | 90>(30);

  const rows = useHealthDailyStore((s) => s.rows);
  const seriesFor = useHealthDailyStore((s) => s.seriesFor);
  const valuesByDay = useHealthDailyStore((s) => s.valuesByDay);
  const loadHealth = useHealthDailyStore((s) => s.load);
  const loadingHealth = useHealthDailyStore((s) => s.loading);
  const allActs = useActivitiesStore((s) => s._all);
  const loadActs = useActivitiesStore((s) => s.load);
  const user = useAuthStore((s) => s.user);

  // Força o reload a cada foco — pega os dados frescos após um sync da Saúde,
  // em vez de manter um cache vazio carregado antes do sync terminar.
  useFocusEffect(
    useCallback(() => {
      void loadHealth(true);
      void loadActs(true);
    }, [loadHealth, loadActs]),
  );

  const visible = useMemo(() => allActs.filter((a) => !a.hidden), [allActs]);

  const inputsByDay = useMemo(
    () =>
      readinessInputsByDay({
        sono: seriesFor('sono'),
        fcRepouso: seriesFor('fcRepouso'),
        vfc: seriesFor('vfc'),
        aneis: seriesFor('aneis'),
      }),
    [rows, seriesFor],
  );

  const actDays = useMemo(() => activityDays(visible), [visible]);
  const series = useMemo(() => readinessSeries(inputsByDay, actDays, range), [inputsByDay, actDays, range]);

  const readinessByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of readinessSeries(inputsByDay, actDays, 63)) if (p.score != null) map.set(p.date, p.score);
    return map;
  }, [inputsByDay, actDays]);

  const loadRecovery = useMemo(() => weeklyLoadVsRecovery(visible, readinessByDay, 8), [visible, readinessByDay]);
  const monthRecap = useMemo(() => buildPeriodRecap(visible, readinessByDay, 30), [visible, readinessByDay]);
  const wellness = useMemo(() => wellnessSummary(inputsByDay, visible), [inputsByDay, visible]);
  const insights = useMemo(
    () => sportHealthCorrelations(visible, { vfc: valuesByDay('vfc'), fcRepouso: valuesByDay('fcRepouso'), sono: valuesByDay('sono') }),
    [visible, valuesByDay, rows],
  );

  // buckets para os gráficos reusados
  const loadBuckets: Bucket[] = loadRecovery.map((w) => ({ label: w.label, date: parseMs(w.week), value: w.hardMin, count: 0, empty: false }));
  const recoveryBuckets: Bucket[] = loadRecovery.map((w) => ({ label: w.label, date: parseMs(w.week), value: w.recovery ?? 0, count: 0, empty: w.recovery == null }));
  const trendBuckets: Bucket[] = series.map((p) => ({ label: p.label, date: parseMs(p.date), value: p.score ?? 0, count: 0, empty: p.score == null }));

  const loadEmpty = loadRecovery.every((w) => w.hardMin === 0 && w.recovery == null);
  const trendCount = trendBuckets.filter((b) => !b.empty).length;
  const treinos = series.filter((p) => p.hasActivity).length;

  const recapTiles = [
    { label: 'Distância', value: `${monthRecap.distanceKm.current.toFixed(1).replace('.', ',')} km`, ...fmtDelta(monthRecap.distanceKm) },
    { label: 'Treinos', value: `${monthRecap.sessions.current}`, ...fmtDelta(monthRecap.sessions) },
    { label: 'Tempo', value: fmtDur(monthRecap.durationMin.current), ...fmtDelta(monthRecap.durationMin) },
    { label: 'Carga forte', value: `${monthRecap.hardMin.current} min`, ...fmtDelta(monthRecap.hardMin) },
    { label: 'Prontidão', value: `${monthRecap.avgReadiness.current}`, ...fmtDelta(monthRecap.avgReadiness) },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Recuperação</Text>
        <View style={styles.iconBtn} />
      </View>

      {loadingHealth && rows.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Como o treino afeta a recuperação — carga, prontidão e bem-estar.</Text>

          {/* 0. Resumo do mês */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Resumo do mês · 30 dias</Text>
            {monthRecap.sessions.current === 0 ? (
              <Text style={styles.empty}>Sem treinos nos últimos 30 dias.</Text>
            ) : (
              <View style={styles.recapTiles}>
                {recapTiles.map((t) => (
                  <View key={t.label} style={styles.recapTile}>
                    <Text style={styles.recapLbl}>{t.label}</Text>
                    <Text style={styles.recapVal}>{t.value}</Text>
                    <Text style={[styles.recapDelta, t.tone !== 'flat' && { color: DELTA_COLOR[t.tone] }]}>{t.txt}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* 1. Carga vs Recuperação */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Carga vs recuperação · 8 semanas</Text>
            {loadEmpty ? (
              <Text style={styles.empty}>Sem carga de FC ou prontidão suficiente.</Text>
            ) : (
              <>
                <Text style={styles.sub}>Carga forte (min em Z4+Z5)</Text>
                <BarChart buckets={loadBuckets} width={CHART_W} height={110} color={MOD.treino.accent} />
                <Text style={styles.sub}>Prontidão média (0–100)</Text>
                <LineChart buckets={recoveryBuckets} width={CHART_W} height={110} color={MOD.habito.accent} />
              </>
            )}
          </View>

          {/* 2. Índice de bem-estar */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Índice de bem-estar</Text>
            {wellness.overall == null ? (
              <Text style={styles.empty}>Sincronize a Saúde para ver o índice.</Text>
            ) : (
              <>
                <View style={styles.wellHead}>
                  <View>
                    <Text style={styles.big}>{wellness.overall}</Text>
                    <Text style={styles.cap}>prontidão · dia recente</Text>
                  </View>
                  <View style={styles.sportBox}>
                    <Text style={styles.sportLine}><Text style={styles.sv}>{wellness.sport.sessions}</Text> treinos/semana</Text>
                    <Text style={styles.sportLine}>
                      carga <Text style={[styles.tag, { color: LOAD_COLOR[wellness.sport.loadLabel] }]}>{wellness.sport.loadLabel}</Text>
                    </Text>
                  </View>
                </View>
                {wellness.categories.map((c) => (
                  <View key={c.key} style={styles.barRow}>
                    <Text style={styles.barLbl}>{c.label}</Text>
                    <View style={styles.track}><View style={[styles.fill, { width: `${c.score}%`, backgroundColor: CAT_COLOR[c.key] ?? colors.primary }]} /></View>
                    <Text style={styles.barVal}>{c.score}</Text>
                  </View>
                ))}
                {/* Score parcial precisa se declarar: renormalizado sobre menos
                    sinais, ele parece tão confiável quanto um completo. */}
                {wellness.coverage < 1 && wellness.missing.length > 0 && (
                  <Text style={styles.parcial}>
                    Score parcial — {Math.round(wellness.coverage * 100)}% dos sinais.
                    Sem dado de {wellness.missing.map((m) => CAT_LABEL[m] ?? m).join(', ')}.
                  </Text>
                )}
              </>
            )}
          </View>

          {/* 3. Tendência de prontidão */}
          <View style={styles.card}>
            <View style={styles.trendHead}>
              <Text style={styles.cardTitle}>Tendência de prontidão</Text>
              <View style={styles.seg}>
                {([30, 90] as const).map((r) => (
                  <Pressable key={r} onPress={() => setRange(r)} style={[styles.segBtn, range === r && styles.segOn]}>
                    <Text style={[styles.segTxt, range === r && styles.segTxtOn]}>{r}d</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {trendCount < 2 ? (
              <Text style={styles.empty}>Sem prontidão suficiente no período.</Text>
            ) : (
              <>
                <LineChart buckets={trendBuckets} width={CHART_W} height={150} color={MOD.agua.accent} />
                <Text style={styles.sub}>{treinos} dias com treino no período</Text>
              </>
            )}
          </View>

          {/* 4. Insights Saúde × Esporte */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Treino forte → recuperação (dia seguinte)</Text>
            {insights.map((r) => (
              <View key={r.key} style={[styles.insight, { borderLeftColor: TONE_COLOR[r.tone] }]}>
                <Text style={styles.insightText}>{r.text}</Text>
                {r.enough && <Text style={styles.insightMeta}>r = {r.r.toFixed(2)} · {r.n} pares</Text>}
              </View>
            ))}
            <Text style={styles.disc}>Associação observacional (amostra pequena) — não é causa.</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  intro: { fontSize: 13, color: colors.ink3, lineHeight: 18, marginBottom: spacing.md, marginTop: 2 },

  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: 14, marginBottom: 12, ...shadows.card },
  cardTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 11.5, color: colors.ink3, marginTop: 8, marginBottom: 2 },
  empty: { fontSize: 13, color: colors.ink3, paddingVertical: 14 },

  recapTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  recapTile: { flexBasis: '31%', flexGrow: 1, backgroundColor: colors.surfaceMute, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  recapLbl: { fontSize: 10.5, color: colors.ink3 },
  recapVal: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 2, fontFamily: 'GeistMono' },
  recapDelta: { fontSize: 11, color: colors.ink3, marginTop: 1 },

  wellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10, marginBottom: 12 },
  big: { fontSize: 38, fontWeight: '600', color: colors.ink, lineHeight: 40 },
  cap: { fontSize: 11, color: colors.ink3 },
  sportBox: { alignItems: 'flex-end' },
  sportLine: { fontSize: 12, color: colors.ink2, marginTop: 2 },
  sv: { fontWeight: '700', color: colors.ink },
  tag: { fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  barLbl: { width: 120, fontSize: 12.5, color: colors.ink2 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surfaceMute, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  parcial: { fontSize: 11.5, color: colors.ink3, marginTop: 8, lineHeight: 16 },
  barVal: { width: 26, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: colors.ink, fontFamily: 'GeistMono' },

  trendHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: colors.line, borderRadius: 8, overflow: 'hidden' },
  segBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  segOn: { backgroundColor: colors.primary },
  segTxt: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
  segTxtOn: { color: '#fff' },

  insight: { backgroundColor: colors.surfaceMute, borderLeftWidth: 3, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  insightText: { fontSize: 13, color: colors.ink },
  insightMeta: { fontSize: 11, color: colors.ink3, marginTop: 2, fontFamily: 'GeistMono' },
  disc: { fontSize: 11, color: colors.ink3, marginTop: 10 },
});
