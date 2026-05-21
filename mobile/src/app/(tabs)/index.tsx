import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing } from '../../theme';
import { DayRingCard } from '../../components/cards/DayRingCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { HabitStepper } from '../../components/cards/HabitStepper';
import { TodoItem } from '../../components/cards/TodoItem';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';
import { useHabitsStore, HABIT_WINDOW_DAYS } from '../../store/habits.store';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { progress, streak, cleanStreak, daysInclusive, localDateStr } from '../../lib/habit-logic';
import { isOverdue } from '../../lib/todo-logic';
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
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const firstName = getFirstName(user);

  // Use local state for prototype (store can be wired later)
  const [meals] = useState(HOJE.meals);
  const [habits] = useState(HOJE.habits);
  const [treinoDone] = useState(false);

  // Hábitos contadores (água, etc.) — persistidos no Supabase
  const counters = useHabitsStore(s => s.habits);
  const counterLogs = useHabitsStore(s => s.todayLogs);
  const counterWindow = useHabitsStore(s => s.windowByHabit);
  const loadCounters = useHabitsStore(s => s.load);
  const incHabit = useHabitsStore(s => s.increment);
  const decHabit = useHabitsStore(s => s.decrement);
  const resetHabit = useHabitsStore(s => s.resetToday);
  // Recarrega quando o usuário fica disponível: no boot, a home monta antes de
  // o auth resolver, então o primeiro load() aborta por falta de userId.
  useEffect(() => { loadCounters(); }, [loadCounters, user?.id]);

  // Tarefas (to-do) — pendentes/atrasadas de hoje
  const todoTemplates = useTodosStore(s => s.templates);
  const todoOccurrences = useTodosStore(s => s.occurrences);
  const loadTodos = useTodosStore(s => s.load);
  const resolveTodo = useTodosStore(s => s.resolve);
  useEffect(() => { loadTodos(); }, [loadTodos, user?.id]);

  // Contribuição da água ao score vem do hábito contador "Água" (litros)
  const aguaHabit = counters.find(h => h.unit === 'L' && h.direction === 'at_least');
  const waterRatio = aguaHabit ? progress(aguaHabit, counterLogs[aguaHabit.id] ?? 0) : 0;

  // Só os hábitos marcados como "Mostrar na home" viram steppers aqui; os demais
  // ficam restritos à tela de hábitos. (O anel da água acima usa a lista completa.)
  const homeHabits = counters.filter(h => h.showOnHome);

  // Hábitos com algum valor registrado hoje ficam logo abaixo dos anéis; os
  // ainda zerados descem para a lista "Hábitos" no fim da página.
  const startedHabits = homeHabits.filter(h => (counterLogs[h.id] ?? 0) > 0);
  const pendingHabits = homeHabits.filter(h => (counterLogs[h.id] ?? 0) <= 0);

  // Sequência por hábito: bom → dias cumprindo a meta; ruim → dias sem fazer.
  // Bom sem meta não tem sequência a exibir (null). Combina histórico + valor de hoje.
  const today = localDateStr();
  const streakFor = (h: CounterHabit): { value: number; bad: boolean } | null => {
    const win = counterWindow[h.id] ?? {};
    const byDate = new Map<string, number>(Object.entries(win));
    byDate.set(today, counterLogs[h.id] ?? win[today] ?? 0);
    if (h.bad) {
      const age = h.createdAt
        ? daysInclusive(localDateStr(new Date(h.createdAt)), today)
        : HABIT_WINDOW_DAYS;
      return { value: cleanStreak(byDate, today, Math.min(HABIT_WINDOW_DAYS, age)), bad: true };
    }
    if (h.target == null) return null;
    return { value: streak(h, byDate, today, HABIT_WINDOW_DAYS), bad: false };
  };

  const renderStepper = (h: CounterHabit) => {
    const info = streakFor(h);
    return (
      <HabitStepper
        key={h.id}
        habit={h}
        value={counterLogs[h.id] ?? 0}
        streak={info?.value ?? null}
        streakBad={info?.bad ?? false}
        onIncrement={() => incHabit(h.id)}
        onDecrement={() => decHabit(h.id)}
        onReset={() => resetHabit(h.id)}
      />
    );
  };

  // Tarefas a fazer hoje: atrasadas, do dia ou sem prazo
  const tplById = new Map(todoTemplates.map(t => [t.id, t]));
  const todayTasks = todoOccurrences.filter(o =>
    o.status === 'pending' &&
    tplById.has(o.templateId) &&
    (isOverdue(o, today) || o.dueDate === null || o.dueDate <= today)
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

        {/* Hábitos com valor hoje — logo abaixo dos anéis */}
        {startedHabits.map(renderStepper)}

        {/* To-do — atrasadas e do dia */}
        {todayTasks.length > 0 && (
          <>
            <SectionLabel>To-do</SectionLabel>
            {todayTasks.map(o => (
              <TodoItem
                key={o.id}
                template={tplById.get(o.templateId)!}
                occurrence={o}
                onDone={() => resolveTodo(o.id, 'done')}
                onMore={() => router.push('/tarefas')}
              />
            ))}
          </>
        )}

        {/* Hábitos sem valor hoje — empurrados para o fim da página */}
        {pendingHabits.length > 0 && (
          <>
            <SectionLabel>Hábitos</SectionLabel>
            {pendingHabits.map(renderStepper)}
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
