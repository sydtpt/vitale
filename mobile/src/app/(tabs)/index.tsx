import React, { useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, useThemedStyles } from '../../theme';
import { DayRingCard } from '../../components/cards/DayRingCard';
import { ReadinessCard } from '../../components/cards/ReadinessCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { HabitStepper } from '../../components/cards/HabitStepper';
import { SleepRatingCard } from '../../components/cards/SleepRatingCard';
import { DayRatingCard } from '../../components/cards/DayRatingCard';
import { TodoItem } from '../../components/cards/TodoItem';
import { QuickAddSheet } from '../../components/sheets/QuickAddSheet';
import { useHabitsStore, HABIT_WINDOW_DAYS } from '../../store/habits.store';
import { useTodosStore } from '../../store/todos.store';
import { useAuthStore } from '../../store/auth.store';
import { useSettingsStore } from '../../store/settings.store';
import { useHealthStore } from '../../store/health.store';
import { useDailyRatingsStore, dayRatingDate } from '../../store/daily-ratings.store';
import { useRefreshOnForeground } from '../../hooks/useRefreshOnForeground';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { progress, streak, cleanStreak, daysInclusive, localDateStr } from '../../lib/habit-logic';
import { readinessFromSummaries } from '../../lib/health-readiness';
import { isOverdue, isVisibleNow, isStarted, localTimeStr } from '../../lib/todo-logic';
import { HOJE } from '../../services/mock-data';
import type { CounterHabit } from '@vitale/shared';
import type { User } from '@supabase/supabase-js';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return name ? `${period}, ${name}.` : `${period}.`;
}

function firstNameOf(raw: string): string {
  const first = String(raw).trim().split(/[\s.]+/)[0] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}

function getFirstName(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const raw = meta.full_name || meta.name || user.email?.split('@')[0] || '';
  return firstNameOf(raw);
}

export default function HojeScreen() {
  const styles = useThemedStyles(createStyles);
  const tabBarHeight = useTabBarHeight();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [cardPage, setCardPage] = useState(0);
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardW = screenWidth - spacing.lg * 2;
  const user = useAuthStore(s => s.user);
  // Nome de exibição definido em Configurações › Perfil tem prioridade; senão
  // cai para o nome derivado do login (metadata/e-mail).
  const displayName = useSettingsStore(s => s.profile?.displayName);
  const firstName = displayName ? firstNameOf(displayName) : getFirstName(user);

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

  // Saúde (Apple Health): inicializa para alimentar o card de prontidão.
  // Em quem já concedeu acesso, é silencioso; mantém a mesma porta da aba Saúde.
  const healthStatus = useHealthStore(s => s.permissionStatus);
  const requestHealth = useHealthStore(s => s.requestPermission);
  const healthSummaries = useHealthStore(s => s.summaries);
  const hasReadiness = readinessFromSummaries(healthSummaries).components.length > 0;
  useEffect(() => { if (healthStatus === 'unknown') requestHealth(); }, [healthStatus, requestHealth]);

  // Tarefas (to-do) — pendentes/atrasadas de hoje
  const todoTemplates = useTodosStore(s => s.templates);
  const todoOccurrences = useTodosStore(s => s.occurrences);
  const loadTodos = useTodosStore(s => s.load);
  const resolveTodo = useTodosStore(s => s.resolve);
  useEffect(() => { loadTodos(); }, [loadTodos, user?.id]);

  // Ratings subjetivos do dia (sono ao acordar, dia na janela noturna)
  const todayRating = useDailyRatingsStore(s => s.today);
  const ratingsWindow = useDailyRatingsStore(s => s.window);
  const loadRatings = useDailyRatingsStore(s => s.load);
  const setSleep = useDailyRatingsStore(s => s.setSleep);
  const setDay = useDailyRatingsStore(s => s.setDay);
  useEffect(() => { loadRatings(); }, [loadRatings, user?.id]);

  // Sono só aparece depois de realmente acordar (a partir das 06h).
  const showSleepRating = new Date().getHours() >= 6;

  // "Como foi seu dia?" abre na janela noturna (22h–04h59). Na madrugada o card
  // avalia/mostra o dia anterior, então o valor vem da janela pelo dia resolvido.
  const dayRatingDay = dayRatingDate();
  const showDayRating = dayRatingDay !== null;
  const dayRating = dayRatingDay ? ratingsWindow[dayRatingDay] : null;

  // Ao retomar o app (background → active), a tela segue montada, então
  // recarrega o que pode ter mudado desde a última vez.
  useRefreshOnForeground(() => { loadCounters(); loadTodos(); loadRatings(); });

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

  // Tarefas a fazer hoje: atrasadas, do dia ou sem prazo. startTime esconde a do
  // dia antes do horário (só aparece a partir dele).
  const nowTime = localTimeStr();
  const tplById = new Map(todoTemplates.map(t => [t.id, t]));
  const todayTasks = todoOccurrences.filter(o =>
    o.status === 'pending' &&
    tplById.has(o.templateId) &&
    tplById.get(o.templateId)!.module !== 'compras' &&
    isStarted(tplById.get(o.templateId)!, today) &&
    (isOverdue(o, today) || o.dueDate === null || o.dueDate <= today) &&
    isVisibleNow(tplById.get(o.templateId)!, o, today, nowTime)
  );

  const mealsDone = meals.filter(m => m.done).length;
  const habitsDone = habits.filter(h => h.done).length;
  const activity = treinoDone ? 100 : 60;
  const food = meals.length > 0 ? Math.round((mealsDone / meals.length) * 70 + waterRatio * 30) : 0;
  const mind = habits.length > 0 ? Math.round((habitsDone / habits.length) * 100) : 0;
  const overall = Math.round((activity + food + mind) / 3);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]}>
        {/* Greeting */}
        <View style={styles.greet}>
          <Text style={styles.date}>{HOJE.date.toUpperCase()}</Text>
          <Text style={styles.greeting}>{getGreeting(firstName)}</Text>
          <Text style={styles.sub}>{HOJE.weekDay} · {4 - mealsDone} checks pendentes</Text>
        </View>

        {/* Sono percebido — só a partir das 06h; colapsa em chip depois de preenchido */}
        {showSleepRating && (
          <SleepRatingCard value={todayRating?.sleepQuality ?? null} onSelect={setSleep} />
        )}

        {/* Carousel: Ring + Prontidão lado a lado com scroll horizontal */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={({ nativeEvent }) =>
            setCardPage(Math.round(nativeEvent.contentOffset.x / cardW))
          }
          scrollEventThrottle={16}
          style={styles.hScroll}
        >
          <View style={{ width: cardW }}>
            <DayRingCard activity={activity} food={food} mind={mind} overall={overall} />
          </View>
          {hasReadiness && (
            <View style={{ width: cardW }}>
              <ReadinessCard />
            </View>
          )}
        </ScrollView>

        {/* Dots de paginação — só aparece quando há card de prontidão */}
        {hasReadiness && (
          <View style={styles.dots}>
            <View style={[styles.dot, cardPage === 0 && styles.dotActive]} />
            <View style={[styles.dot, cardPage === 1 && styles.dotActive]} />
          </View>
        )}

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

        {/* Como foi o dia? — janela noturna (22h–04h59); na madrugada avalia ontem */}
        {showDayRating && (
          <>
            <SectionLabel>{dayRatingDay === today ? 'Fim do dia' : 'Como foi ontem?'}</SectionLabel>
            <DayRatingCard
              value={dayRating?.dayQuality ?? null}
              note={dayRating?.dayNote ?? null}
              onSubmit={setDay}
            />
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <QuickAddSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  greet: { paddingVertical: spacing.lg },
  date: { fontSize: 13, color: colors.ink3, letterSpacing: 0.4, fontWeight: '600' },
  greeting: { fontFamily: 'InstrumentSerif', fontSize: 34, lineHeight: 36, marginTop: 4, color: colors.ink },
  sub: { fontSize: 14, color: colors.ink2, marginTop: 4 },
  hScroll: { marginTop: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: spacing.md },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { width: 14, backgroundColor: colors.primary },
});
