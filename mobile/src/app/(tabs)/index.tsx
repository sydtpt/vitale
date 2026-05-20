import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';
import { DayRingCard } from '../../components/cards/DayRingCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { HabitStepper } from '../../components/cards/HabitStepper';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';
import { useHabitsStore } from '../../store/habits.store';
import { useAuthStore } from '../../store/auth.store';
import { progress } from '../../lib/habit-logic';
import { HOJE } from '../../services/mock-data';
import type { CounterHabit } from '@vitale/shared';
import type { User } from '@supabase/supabase-js';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return name ? `${period}, ${name}.` : `${period}.`;
}

function getFirstName(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const raw = meta.full_name || meta.name || user.email?.split('@')[0] || '';
  const first = String(raw).trim().split(/[\s.]+/)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

export default function HojeScreen() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const user = useAuthStore(s => s.user);
  const firstName = getFirstName(user);

  // Use local state for prototype (store can be wired later)
  const [meals] = useState(HOJE.meals);
  const [habits] = useState(HOJE.habits);
  const [treinoDone] = useState(false);

  // Hábitos contadores (água, etc.) — persistidos no Supabase
  const counters = useHabitsStore(s => s.habits);
  const counterLogs = useHabitsStore(s => s.todayLogs);
  const loadCounters = useHabitsStore(s => s.load);
  const incHabit = useHabitsStore(s => s.increment);
  const decHabit = useHabitsStore(s => s.decrement);
  const resetHabit = useHabitsStore(s => s.resetToday);
  useEffect(() => { loadCounters(); }, [loadCounters]);

  // Contribuição da água ao score vem do hábito contador "Água" (litros)
  const aguaHabit = counters.find(h => h.unit === 'L' && h.direction === 'at_least');
  const waterRatio = aguaHabit ? progress(aguaHabit, counterLogs[aguaHabit.id] ?? 0) : 0;

  // Demais contadores: já iniciados (algo registrado hoje) sobem para o topo,
  // logo abaixo dos rings; os ainda zerados descem para o fim da página.
  const otherCounters = counters.filter(h => h.id !== aguaHabit?.id);
  const startedCounters = otherCounters.filter(h => (counterLogs[h.id] ?? 0) > 0);
  const pendingCounters = otherCounters.filter(h => (counterLogs[h.id] ?? 0) <= 0);

  const renderStepper = (h: CounterHabit) => (
    <HabitStepper
      key={h.id}
      habit={h}
      value={counterLogs[h.id] ?? 0}
      onIncrement={() => incHabit(h.id)}
      onDecrement={() => decHabit(h.id)}
      onReset={() => resetHabit(h.id)}
    />
  );

  const mealsDone = meals.filter(m => m.done).length;
  const habitsDone = habits.filter(h => h.done).length;
  const activity = treinoDone ? 100 : 60;
  const food = meals.length > 0 ? Math.round((mealsDone / meals.length) * 70 + waterRatio * 30) : 0;
  const mind = habits.length > 0 ? Math.round((habitsDone / habits.length) * 100) : 0;
  const overall = Math.round((activity + food + mind) / 3);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Greeting */}
        <View style={styles.greet}>
          <Text style={styles.date}>{HOJE.date.toUpperCase()}</Text>
          <Text style={styles.greeting}>{getGreeting(firstName)}</Text>
          <Text style={styles.sub}>{HOJE.weekDay} · {4 - mealsDone} checks pendentes</Text>
        </View>

        {/* Day Ring Card */}
        <DayRingCard activity={activity} food={food} mind={mind} overall={overall} />

        {/* Água + contadores já iniciados — logo abaixo dos rings */}
        {aguaHabit && renderStepper(aguaHabit)}
        {startedCounters.map(renderStepper)}

        {/* Contadores ainda não iniciados — empurrados para o fim da página */}
        {pendingCounters.length > 0 && (
          <>
            <SectionLabel>Contadores</SectionLabel>
            {pendingCounters.map(renderStepper)}
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <QuickAddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  date: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontWeight: '600' },
  greeting: { fontFamily: 'InstrumentSerif', fontSize: 34, lineHeight: 36, marginTop: 4, color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, marginTop: 4 },
});
