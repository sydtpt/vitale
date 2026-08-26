import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CounterHabit } from '@vitale/shared';
import { useHabitsStore } from '../../store/habits.store';
import { MonthCalendar } from '../../components/MonthCalendar';
import { HabitStepper } from '../../components/cards/HabitStepper';
import { colors, fonts, radii, shadows, spacing, useThemedStyles } from '../../theme';
import { HeaderSpacer } from '../../components/ui/HeaderSpacer';

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function EditarDiaScreen() {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const habits = useHabitsStore((s) => s.habits);
  const windowByHabit = useHabitsStore((s) => s.windowByHabit);
  const loaded = useHabitsStore((s) => s.loaded);
  const load = useHabitsStore((s) => s.load);
  const loadMonthValues = useHabitsStore((s) => s.loadMonthValues);
  const setLogForDate = useHabitsStore((s) => s.setLogForDate);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const active = useMemo(() => habits.filter((h) => h.active), [habits]);

  useEffect(() => {
    if (!loaded) void load();
    const now = new Date();
    void loadMonthValues(now.getFullYear(), now.getMonth());
  }, [loaded, load, loadMonthValues]);

  const marked = useMemo(() => {
    const set = new Set<string>();
    for (const byDate of Object.values(windowByHabit)) {
      for (const [date, value] of Object.entries(byDate)) if (value > 0) set.add(date);
    }
    return set;
  }, [windowByHabit]);

  const originalFor = (habitId: string, date: string) => windowByHabit[habitId]?.[date] ?? 0;

  const rebuildDraft = (date: string) => {
    const next: Record<string, number> = {};
    for (const h of active) next[h.id] = originalFor(h.id, date);
    setDraft(next);
  };

  const pickDay = (date: string) => {
    setSelected(date);
    rebuildDraft(date);
  };

  const onMonthChange = async (year: number, monthIdx: number) => {
    await loadMonthValues(year, monthIdx);
    if (selected) rebuildDraft(selected);
  };

  const setValue = (habit: CounterHabit, next: number) => {
    const v = Math.max(0, Math.round(next * 1000) / 1000);
    setDraft((d) => ({ ...d, [habit.id]: v }));
  };

  const dirty = useMemo(() => {
    if (!selected) return false;
    return active.some((h) => (draft[h.id] ?? 0) !== originalFor(h.id, selected));
  }, [selected, draft, active, windowByHabit]);

  const cancel = () => {
    setSelected(null);
    setDraft({});
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      for (const h of active) {
        const next = draft[h.id] ?? 0;
        if (next !== originalFor(h.id, selected)) {
          await setLogForDate(h.id, selected, next);
        }
      }
      router.back();
    } catch (e) {
      console.error('Erro ao salvar dia:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Editar dia</Text>
        <HeaderSpacer />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <MonthCalendar selected={selected} marked={marked} onSelect={pickDay} onMonthChange={onMonthChange} />

        {selected ? (
          <>
            <Text style={styles.dayTitle}>{DATE_FMT.format(new Date(`${selected}T00:00:00`))}</Text>
            {active.length === 0 ? (
              <Text style={styles.hint}>Nenhum hábito ativo para editar.</Text>
            ) : (
              active.map((h) => (
                <HabitStepper
                  key={h.id}
                  habit={h}
                  value={draft[h.id] ?? 0}
                  streak={null}
                  onIncrement={() => setValue(h, (draft[h.id] ?? 0) + h.step)}
                  onDecrement={() => setValue(h, (draft[h.id] ?? 0) - h.step)}
                  onReset={() => setValue(h, 0)}
                />
              ))
            )}

            <View style={styles.footer}>
              <Pressable onPress={cancel} disabled={saving} style={({ pressed }) => [styles.btn, styles.ghost, pressed && styles.pressed]}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={!dirty || saving}
                style={({ pressed }) => [styles.btn, styles.primary, (!dirty || saving) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{saving ? 'Salvando…' : 'Salvar'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={[styles.hint, styles.pickHint]}>Selecione um dia no calendário para editar os valores.</Text>
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
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: fonts.serif, color: colors.ink },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: spacing.sm },
  dayTitle: { fontSize: 14, fontFamily: fonts.sansBold, color: colors.ink, textTransform: 'capitalize', marginTop: spacing.md },
  hint: { fontSize: 13, fontFamily: fonts.sans, color: colors.ink3, marginTop: spacing.sm },
  pickHint: { textAlign: 'center', marginTop: spacing.xl },

  footer: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, paddingVertical: 13, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  ghostText: { fontSize: 14.5, fontFamily: fonts.sansSemiBold, color: colors.ink2 },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontSize: 14.5, fontFamily: fonts.sansBold, color: colors.onPrimary },
  disabled: { opacity: 0.5 },
});
