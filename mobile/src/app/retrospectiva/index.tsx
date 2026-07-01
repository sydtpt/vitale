import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  latestAvailableOffset,
  type PeriodKind,
  type RecapValue,
  type HighlightIcon,
  type RetroHealthRow,
} from '@vitale/shared';
import { colors, spacing, radii, shadows, useThemedStyles } from '../../theme';
import { useRetroStore, retroSince } from '../../store/retro.store';
import { useActivitiesStore } from '../../store/activities.store';

const KINDS: PeriodKind[] = ['week', 'month', 'year'];
const KIND_LABEL: Record<PeriodKind, string> = { week: 'Semana', month: 'Mês', year: 'Ano' };

const ICON_MAP: Record<HighlightIcon, keyof typeof Ionicons.glyphMap> = {
  workout: 'barbell-outline', distance: 'walk-outline', sleep: 'moon-outline', heart: 'heart-outline',
  hrv: 'pulse-outline', habit: 'checkmark-circle-outline', warning: 'warning-outline', money: 'wallet-outline',
};
const TONE_COLOR: Record<string, string> = { good: '#6FA86A', bad: '#D9491B', neutral: colors.ink3 };

function num(n: number, d = 0): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function km(m: number): string { return `${num(m / 1000, 1)} km`; }
function brl(v: number): string { return `R$ ${num(v)}`; }
function dur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}
function deltaVM(r: RecapValue, higherIsWorse: boolean): { text: string; tone: string } {
  if (r.delta === 0) return { text: '—', tone: 'neutral' };
  const worse = higherIsWorse ? r.delta > 0 : r.delta < 0;
  const sign = r.delta > 0 ? '+' : '−';
  const text = r.deltaPct != null ? `${sign}${num(Math.abs(r.deltaPct))}%` : `${sign}${num(Math.abs(r.delta))}`;
  return { text, tone: worse ? 'bad' : 'good' };
}

export default function RetrospectivaScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);

  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState<number>(() => latestAvailableOffset(now, 'week'));

  const ensure = useRetroStore((s) => s.ensure);
  const loaded = useRetroStore((s) => s.loaded);
  const summaryFn = useRetroStore((s) => s.summary);
  const highlightsFn = useRetroStore((s) => s.highlights);
  const yearFn = useRetroStore((s) => s.yearByMonth);
  const allActs = useActivitiesStore((s) => s._all);

  useFocusEffect(useCallback(() => {
    void ensure(retroSince(now, kind, offset));
  }, [ensure, now, kind, offset]));
  useEffect(() => { void ensure(retroSince(now, kind, offset)); }, [ensure, now, kind, offset]);

  const summary = useMemo(() => summaryFn(now, kind, offset), [summaryFn, now, kind, offset, loaded, allActs]);
  const highlights = useMemo(() => highlightsFn(now, kind, offset).slice(0, 6), [highlightsFn, now, kind, offset, loaded, allActs]);
  const buckets = useMemo(() => kind === 'year' ? yearFn(now, offset) : [], [yearFn, now, kind, offset, loaded, allActs]);
  const maxWorkouts = Math.max(1, ...buckets.map((b) => b.workouts));

  const canNext = offset < latestAvailableOffset(now, kind);
  const changeKind = (k: PeriodKind) => { setKind(k); setOffset(latestAvailableOffset(now, k)); };

  const kpis = [
    { icon: 'barbell-outline' as const, label: 'Treinos', value: `${summary.fitness.count.current}`, d: deltaVM(summary.fitness.count, false) },
    { icon: 'checkmark-done-outline' as const, label: 'Tarefas', value: `${summary.tasks.total.current}`, d: deltaVM(summary.tasks.total, false) },
    { icon: 'walk-outline' as const, label: 'Distância', value: km(summary.fitness.distanceM.current), d: deltaVM(summary.fitness.distanceM, false) },
    { icon: 'wallet-outline' as const, label: 'Compras', value: brl(summary.purchases.spend.current), d: deltaVM(summary.purchases.spend, true) },
  ];

  const healthValue = (h: RetroHealthRow) => h.recap.current == null ? '—' : `${num(h.recap.current, h.decimals)}${h.unit}`;
  const healthDelta = (h: RetroHealthRow) => {
    if (h.recap.current == null || h.recap.delta == null) return { text: '', tone: 'neutral' };
    const worse = h.higherIsWorse ? h.recap.delta > 0 : h.recap.delta < 0;
    const sign = h.recap.delta >= 0 ? '+' : '−';
    return { text: `${sign}${num(Math.abs(h.recap.delta), h.decimals)}${h.unit}`, tone: h.recap.delta === 0 ? 'neutral' : worse ? 'bad' : 'good' };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Retrospectiva</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}>
        {/* Controles */}
        <View style={styles.seg}>
          {KINDS.map((k) => (
            <Pressable key={k} onPress={() => changeKind(k)} style={[styles.segBtn, kind === k && styles.segOn]}>
              <Text style={[styles.segTxt, kind === k && styles.segTxtOn]}>{KIND_LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.nav}>
          <Pressable onPress={() => setOffset((o) => o - 1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.ink} />
          </Pressable>
          <Text style={styles.navLabel}>{summary.label}</Text>
          <Pressable onPress={() => canNext && setOffset((o) => o + 1)} disabled={!canNext} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color={canNext ? colors.ink : colors.ink3} />
          </Pressable>
        </View>

        {/* KPIs */}
        <View style={styles.kpis}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpi}>
              <Ionicons name={k.icon} size={18} color={colors.primary} />
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={[styles.kpiDelta, { color: TONE_COLOR[k.d.tone] }]}>{k.d.text}</Text>
            </View>
          ))}
        </View>

        {/* Destaques */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Destaques do período</Text>
          {highlights.length > 0 ? highlights.map((h) => (
            <View key={h.id} style={styles.hl}>
              <View style={[styles.hlIco, { backgroundColor: TONE_COLOR[h.tone] + '22' }]}>
                <Ionicons name={ICON_MAP[h.icon]} size={15} color={TONE_COLOR[h.tone]} />
              </View>
              <Text style={styles.hlText}>{h.text}</Text>
            </View>
          )) : <Text style={styles.empty}>Sem dados suficientes neste período ainda.</Text>}
        </View>

        {/* Tarefas */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Tarefas feitas</Text>
          <Text style={styles.big}>{summary.tasks.total.current}
            <Text style={[styles.bigDelta, { color: TONE_COLOR[deltaVM(summary.tasks.total, false).tone] }]}>  {deltaVM(summary.tasks.total, false).text}</Text>
          </Text>
          <View style={styles.chips}>
            {summary.tasks.byModule.map((m) => (
              <Text key={m.key} style={styles.chip}>{m.label} · {m.count}</Text>
            ))}
          </View>
        </View>

        {/* Treinos */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Treinos & atividade</Text>
          <View style={styles.miniGrid}>
            <Mini value={`${summary.fitness.count.current}`} label="sessões" />
            <Mini value={km(summary.fitness.distanceM.current)} label="distância" />
            <Mini value={dur(summary.fitness.durationS.current)} label="tempo" />
            <Mini value={`${num(summary.fitness.hardMin.current)}min`} label="carga dura" />
            <Mini value={`${num(summary.fitness.floors.current)}`} label="andares" />
          </View>
          {summary.fitness.byType.map((t) => (
            <Row key={t.key} l={t.label} r={`${t.count}× · ${km(t.sum || 0)}`} />
          ))}
        </View>

        {/* Saúde */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Saúde & bem-estar</Text>
          {summary.health.map((h) => (
            <View key={h.metric} style={styles.row}>
              <Text style={styles.rowL}>{h.label}</Text>
              <Text style={styles.rowR}>{healthValue(h)}  <Text style={{ color: TONE_COLOR[healthDelta(h).tone], fontSize: 12 }}>{healthDelta(h).text}</Text></Text>
            </View>
          ))}
          {summary.ratings.sleep?.current != null && <Row l="Sono percebido" r={`${num(summary.ratings.sleep.current, 1)}/5`} />}
          {summary.ratings.day?.current != null && <Row l="Dia percebido" r={`${num(summary.ratings.day.current, 1)}/5`} />}
        </View>

        {/* Compras */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Compras & gastos</Text>
          <Text style={styles.big}>{brl(summary.purchases.spend.current)}
            <Text style={[styles.bigDelta, { color: TONE_COLOR[deltaVM(summary.purchases.spend, true).tone] }]}>  {deltaVM(summary.purchases.spend, true).text}</Text>
          </Text>
          <Text style={styles.muted}>{summary.purchases.count.current} itens comprados</Text>
          {summary.purchases.byCat.map((c) => (
            <Row key={c.key} l={c.label} r={`${brl(c.sum || 0)} · ${c.count}`} />
          ))}
          <Text style={styles.note}>Gasto estimado a partir de Compras (sem módulo de transações).</Text>
        </View>

        {/* Hábitos */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Hábitos & registros</Text>
          {summary.habits.good.length === 0 && summary.habits.bad.length === 0 && <Text style={styles.empty}>Nenhum hábito registrado.</Text>}
          {summary.habits.good.map((h) => (
            <View key={h.id} style={styles.row}>
              <Text style={styles.rowL}>{h.name}</Text>
              <Text style={styles.rowR}>{h.recap.current}d  <Text style={{ color: TONE_COLOR[deltaVM(h.recap, false).tone], fontSize: 12 }}>{deltaVM(h.recap, false).text}</Text></Text>
            </View>
          ))}
          {summary.habits.bad.map((h) => (
            <View key={h.id} style={styles.row}>
              <Text style={styles.rowL}>{h.name}</Text>
              <Text style={styles.rowR}>{h.recap.current}d  <Text style={{ color: TONE_COLOR[deltaVM(h.recap, true).tone], fontSize: 12 }}>{deltaVM(h.recap, true).text}</Text></Text>
            </View>
          ))}
        </View>

        {/* Ano: barras por mês */}
        {kind === 'year' && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Treinos por mês — {summary.label}</Text>
            <View style={styles.yearGrid}>
              {buckets.map((b) => (
                <View key={b.month} style={styles.ybar}>
                  <View style={styles.ybarTrack}>
                    <View style={[styles.ybarFill, { height: `${Math.round((b.workouts / maxWorkouts) * 100)}%` }]} />
                  </View>
                  <Text style={styles.ybarLabel}>{b.label}</Text>
                  <Text style={styles.ybarVal}>{b.workouts}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Mini({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}
function Row({ l, r }: { l: string; r: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{l}</Text>
      <Text style={styles.rowR}>{r}</Text>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },
  content: { padding: spacing.lg, gap: spacing.md },

  seg: { flexDirection: 'row', backgroundColor: colors.surfaceMute, borderRadius: 12, padding: 3, gap: 2 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  segOn: { backgroundColor: colors.surface, ...shadows.card },
  segTxt: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  segTxtOn: { color: colors.ink },

  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  navBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, ...shadows.card },
  navLabel: { fontSize: 15, fontWeight: '600', color: colors.ink, minWidth: 130, textAlign: 'center' },

  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { width: '48%', backgroundColor: colors.surface, borderRadius: 16, padding: 14, gap: 2, ...shadows.card },
  kpiValue: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 4 },
  kpiLabel: { fontSize: 12, color: colors.ink3 },
  kpiDelta: { fontSize: 12, fontWeight: '600' },

  card: { backgroundColor: colors.surface, borderRadius: radii['2xl'], padding: spacing.lg, gap: spacing.sm, ...shadows.card },
  eyebrow: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.ink3, marginBottom: 4 },
  big: { fontSize: 28, fontWeight: '700', color: colors.ink },
  bigDelta: { fontSize: 13, fontWeight: '600' },
  muted: { fontSize: 13, color: colors.ink3 },
  note: { fontSize: 11, color: colors.ink3, fontStyle: 'italic', marginTop: 6 },
  empty: { fontSize: 13, color: colors.ink3 },

  hl: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  hlIco: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  hlText: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { fontSize: 12, fontWeight: '600', color: colors.ink2, backgroundColor: colors.surfaceMute, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowL: { fontSize: 14, color: colors.ink },
  rowR: { fontSize: 14, fontWeight: '600', color: colors.ink },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  mini: { width: '46%' },
  miniValue: { fontSize: 18, fontWeight: '700', color: colors.ink },
  miniLabel: { fontSize: 12, color: colors.ink3 },

  yearGrid: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 6 },
  ybar: { flex: 1, alignItems: 'center', gap: 4 },
  ybarTrack: { width: '100%', height: 90, backgroundColor: colors.surfaceMute, borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  ybarFill: { width: '100%', backgroundColor: colors.primary, borderRadius: 6, minHeight: 2 },
  ybarLabel: { fontSize: 9, color: colors.ink3 },
  ybarVal: { fontSize: 11, fontWeight: '600', color: colors.ink },
});
