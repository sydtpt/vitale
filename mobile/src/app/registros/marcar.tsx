import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRegistrosStore } from '../../store/registros.store';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { colors, spacing, radii, shadows, MOD, themed, useTheme } from '../../theme';
import { localDateStr } from '@vitale/shared';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.habito;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function RegistroMarcarScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const registros = useRegistrosStore((s) => s.registros);
  const load = useRegistrosStore((s) => s.load);
  const fetchRegistroLogs = useRegistrosStore((s) => s.fetchRegistroLogs);
  const setRegistroMark = useRegistrosStore((s) => s.setRegistroMark);

  const registro = useMemo(() => registros.find((r) => r.id === id), [registros, id]);

  const today = useMemo(() => localDateStr(), []);
  const now = useMemo(() => new Date(), []);

  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  useEffect(() => {
    if (!registro) load();
  }, [registro, load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!id) return;
      const dates = await fetchRegistroLogs(id);
      if (alive) {
        setMarked(new Set(dates));
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, fetchRegistroLogs]);

  const { accent, tint } = modColor(registro?.color ?? 'habito');
  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();

  // células do mês: offset inicial (nulls) + dias 1..N
  const cells = useMemo(() => {
    const startOffset = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [view]);

  const goPrev = () =>
    setView((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }));

  const goNext = () => {
    if (isCurrentMonth) return; // não navega para o futuro
    setView((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }));
  };

  const onToggle = async (day: number) => {
    const key = dateKey(view.year, view.month, day);
    if (key > today) return; // dia futuro: bloqueado
    const wasMarked = marked.has(key);

    // otimista
    setMarked((prev) => {
      const next = new Set(prev);
      if (wasMarked) next.delete(key);
      else next.add(key);
      return next;
    });

    const ok = await setRegistroMark(id!, key, !wasMarked);
    if (!ok) {
      // reverte em caso de falha
      setMarked((prev) => {
        const next = new Set(prev);
        if (wasMarked) next.add(key);
        else next.delete(key);
        return next;
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Marcar dias</Text>
        <View style={styles.iconBtn} />
      </View>

      {registro && (
        <View style={styles.regRow}>
          <View style={[styles.iconBox, { backgroundColor: tint }]}>
            <Ionicons name={habitIconToIonicon(registro.icon)} size={20} color={accent} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.regName}>{registro.name}</Text>
            <Text style={styles.regHint}>Toque num dia passado para marcar como feito</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <View style={styles.calCard}>
          <View style={styles.calHeader}>
            <Pressable onPress={goPrev} hitSlop={10} style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={20} color={colors.ink2} />
            </Pressable>
            <Text style={styles.calTitle}>
              {MONTHS[view.month]} {view.year}
            </Text>
            <Pressable
              onPress={goNext}
              hitSlop={10}
              disabled={isCurrentMonth}
              style={({ pressed }) => [styles.navBtn, pressed && styles.pressed, isCurrentMonth && styles.navDisabled]}
            >
              <Ionicons name="chevron-forward" size={20} color={colors.ink2} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day == null) return <View key={`e${i}`} style={styles.cell} />;
              const key = dateKey(view.year, view.month, day);
              const isFuture = key > today;
              const isMarked = marked.has(key);
              const isToday = key === today;
              return (
                <View key={key} style={styles.cell}>
                  <Pressable
                    onPress={() => onToggle(day)}
                    disabled={isFuture}
                    style={({ pressed }) => [
                      styles.dayBtn,
                      isMarked && { backgroundColor: accent },
                      isToday && !isMarked && { borderWidth: 1.5, borderColor: accent },
                      pressed && !isFuture && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.dayText, isMarked && styles.dayTextMarked, isFuture && styles.dayTextFuture]}>{day}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  regRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  regName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  regHint: { fontSize: 12.5, color: colors.ink3, marginTop: 2 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  calCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing.md,
    ...shadows.card,
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  navBtn: { width: 36, height: 36, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMute },
  navDisabled: { opacity: 0.3 },
  calTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },

  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.ink3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  dayBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14.5, color: colors.ink, fontWeight: '600' },
  dayTextMarked: { color: '#fff', fontWeight: '700' },
  dayTextFuture: { color: colors.ink4 },
}));
