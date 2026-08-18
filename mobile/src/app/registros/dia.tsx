import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Registro } from '@vitale/shared';
import { useRegistrosStore } from '../../store/registros.store';
import { useAuthStore } from '../../store/auth.store';
import { MonthCalendar } from '../../components/MonthCalendar';
import { habitIconToIonicon } from '../../lib/habit-icons';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radii, shadows, MOD, useThemedStyles } from '../../theme';
import { localDateStr } from '@vitale/shared';

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

function modColor(key: string): { tint: string; accent: string } {
  return (MOD as Record<string, { tint: string; accent: string }>)[key] ?? MOD.habito;
}

export default function EditarDiaRegistrosScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const registros = useRegistrosStore((s) => s.registros);
  const loaded = useRegistrosStore((s) => s.loaded);
  const load = useRegistrosStore((s) => s.load);
  const setRegistroMark = useRegistrosStore((s) => s.setRegistroMark);
  const user = useAuthStore((s) => s.user);

  const [selected, setSelected] = useState<string | null>(null);
  const [marksByRegistro, setMarksByRegistro] = useState<Record<string, Set<string>>>({});
  const [monthLoading, setMonthLoading] = useState(false);

  const active = useMemo(() => registros.filter((r) => r.active), [registros]);

  const loadMonth = useCallback(async (year: number, monthIdx: number) => {
    if (!user?.id) return;
    setMonthLoading(true);
    const from = localDateStr(new Date(year, monthIdx, 1));
    const to = localDateStr(new Date(year, monthIdx + 1, 0));

    const { data } = await supabase
      .from('registro_logs')
      .select('registro_id, log_date')
      .gte('log_date', from)
      .lte('log_date', to);

    setMarksByRegistro((prev) => {
      const next: Record<string, Set<string>> = { ...prev };
      // limpa o intervalo do mês carregado
      for (const id of Object.keys(next)) {
        next[id] = new Set([...next[id]].filter((d) => d < from || d > to));
      }
      for (const l of data ?? []) {
        const id = l.registro_id as string;
        next[id] = new Set(next[id] ?? []);
        next[id].add(l.log_date as string);
      }
      return next;
    });
    setMonthLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!loaded) void load();
    const now = new Date();
    void loadMonth(now.getFullYear(), now.getMonth());
  }, [loaded, load, loadMonth]);

  const calMarked = useMemo(() => {
    const set = new Set<string>();
    for (const dates of Object.values(marksByRegistro)) {
      for (const d of dates) set.add(d);
    }
    return set;
  }, [marksByRegistro]);

  const onMonthChange = (year: number, monthIdx: number) => {
    setSelected(null);
    void loadMonth(year, monthIdx);
  };

  const isMarked = (registroId: string, date: string) =>
    marksByRegistro[registroId]?.has(date) ?? false;

  const toggle = async (r: Registro, date: string) => {
    const was = isMarked(r.id, date);
    setMarksByRegistro((prev) => {
      const set = new Set(prev[r.id] ?? []);
      if (was) set.delete(date);
      else set.add(date);
      return { ...prev, [r.id]: set };
    });
    const ok = await setRegistroMark(r.id, date, !was);
    if (!ok) {
      setMarksByRegistro((prev) => {
        const set = new Set(prev[r.id] ?? []);
        if (was) set.add(date);
        else set.delete(date);
        return { ...prev, [r.id]: set };
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Editar dias</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MonthCalendar
          selected={selected}
          marked={calMarked}
          onSelect={setSelected}
          onMonthChange={onMonthChange}
        />

        {monthLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : selected ? (
          <>
            <Text style={styles.dayTitle}>{DATE_FMT.format(new Date(`${selected}T00:00:00`))}</Text>
            {active.length === 0 ? (
              <Text style={styles.hint}>Nenhum registro ativo para editar.</Text>
            ) : (
              <View style={styles.card}>
                {active.map((r, i) => {
                  const mod = modColor(r.color);
                  const done = isMarked(r.id, selected);
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => toggle(r, selected)}
                      style={({ pressed }) => [
                        styles.row,
                        i === active.length - 1 && styles.noBorder,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.iconBox, { backgroundColor: mod.tint }]}>
                        <Ionicons name={habitIconToIonicon(r.icon)} size={18} color={mod.accent} />
                      </View>
                      <Text style={[styles.name, done && { color: mod.accent }]}>{r.name}</Text>
                      <View style={[styles.check, done && { backgroundColor: mod.accent, borderColor: mod.accent }]}>
                        {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.hint, styles.pickHint]}>
            Selecione um dia no calendário para editar os registros.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
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
    width: 36, height: 36, borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, ...shadows.card,
  },
  pressed: { opacity: 0.7 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'InstrumentSerif', color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.sm },
  loader: { marginTop: spacing.lg },
  dayTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, textTransform: 'capitalize', marginTop: spacing.md },
  hint: { fontSize: 13, color: colors.ink3, marginTop: spacing.sm },
  pickHint: { textAlign: 'center', marginTop: spacing.xl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    ...shadows.card,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  noBorder: { borderBottomWidth: 0 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
