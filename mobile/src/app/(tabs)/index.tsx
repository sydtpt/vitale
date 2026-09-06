import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, spacing, useThemedStyles } from '../../theme';
import { MoonBadge } from '../../components/MoonBadge';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { HabitStepper } from '../../components/cards/HabitStepper';
import { SleepRatingCard } from '../../components/cards/SleepRatingCard';
import { DayRatingCard } from '../../components/cards/DayRatingCard';
import { TodayBodyCard } from '../../components/cards/TodayBodyCard';
import { TodoItem } from '../../components/cards/TodoItem';
import { useHabitsStore, HABIT_WINDOW_DAYS } from '../../store/habits.store';
import { useTodosStore } from '../../store/todos.store';
import { useMealsStore } from '../../store/meals.store';
import { useAuthStore } from '../../store/auth.store';
import { useSettingsStore } from '../../store/settings.store';
import { useHealthStore } from '../../store/health.store';
import { useActivitiesStore } from '../../store/activities.store';
import { useDailyRatingsStore, dayRatingDate } from '../../store/daily-ratings.store';
import { useSonoStore } from '../../store/sono.store';
import { useRefreshOnForeground } from '../../hooks/useRefreshOnForeground';
import { useTabBarHeight } from '../../hooks/useTabBarHeight';
import { useTabBarScroll } from '../../lib/tab-bar-scroll';
import type { CounterHabit } from '@vitale/shared';
import type { User } from '@supabase/supabase-js';
import { cleanStreak, daysInclusive, isOverdue, isStarted, isVisibleNow, localDateStr, todoDayStr, todoTimeStr, streak } from '@vitale/shared';

function getGreeting(name: string): string {
  const h = new Date().getHours();
  const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return name ? `${period}, ${name}.` : `${period}.`;
}

/**
 * Data do cabeçalho: "qui, 21 de maio".
 *
 * Vinha chumbada da fixture do protótipo (`hoje-fixtures`), então exibia a mesma
 * data para sempre. Segue o calendário, como refeições e hábitos — tarefas é que
 * usam o dia lógico, que vira às 02h.
 */
function formatToday(d: Date): string {
  // pt-BR abrevia o dia da semana com ponto ("qui."); o cabeçalho vai em caixa
  // alta e sem pontuação.
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace(/\./g, '');
}

/** Posição do dia na semana, começando na segunda (domingo = 7). */
function weekPosition(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
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
  const tabBarScroll = useTabBarScroll();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  // Nome de exibição definido em Configurações › Perfil tem prioridade; senão
  // cai para o nome derivado do login (metadata/e-mail).
  const displayName = useSettingsStore(s => s.profile?.name);
  const firstName = displayName ? firstNameOf(displayName) : getFirstName(user);

  // Refeições logadas hoje — persistidas no Supabase; alimentam o anel de comida.
  const todayMeals = useMealsStore(s => s.todayMeals);
  const loadMeals = useMealsStore(s => s.load);
  useEffect(() => { loadMeals(); }, [loadMeals, user?.id]);

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

  // Saúde (Apple Health): inicializa cedo para os demais consumidores (aba Saúde,
  // notificações). Em quem já concedeu acesso, é silencioso.
  const healthStatus = useHealthStore(s => s.permissionStatus);
  const requestHealth = useHealthStore(s => s.requestPermission);
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

  // A noite medida, ao lado da nota (spec Sono CAP-8): só a que acordou hoje —
  // o histórico é da aba Sono. Seleciona a fatia crua e deriva no `useMemo`;
  // `byDay()` da store é função, e função em seletor trava o render
  // (barreira `store-selector-stability`).
  const sonoPeriods = useSonoStore(s => s.periods);
  const loadTonight = useSonoStore(s => s.loadToday);
  useEffect(() => { loadTonight(); }, [loadTonight, user?.id]);
  const todayStr = localDateStr();
  const lastNight = useMemo(
    () => [...sonoPeriods].reverse().find(p => p.wakeDay === todayStr) ?? null,
    [sonoPeriods, todayStr],
  );

  // "Como foi seu dia?" abre na janela noturna (22h–04h59). Na madrugada o card
  // avalia/mostra o dia anterior, então o valor vem da janela pelo dia resolvido.
  const dayRatingDay = dayRatingDate();
  const showDayRating = dayRatingDay !== null;
  const dayRating = dayRatingDay ? ratingsWindow[dayRatingDay] : null;

  // Atividades (Supabase, via Conexões): alimentam a curva de forma. O núcleo
  // ignora as ocultas, então o dataset completo basta. Ao contrário dos demais
  // stores desta tela, `load()` sem `force` é no-op depois de carregado — por
  // isso `true`, como Histórico e Semana: sem ele, uma atividade que chegou do
  // servidor enquanto o app estava em background (ou a troca de conta) nunca
  // alcança o cartão, e o selo "sem sincronizar" não limpa ao voltar de Conexões.
  const allActs = useActivitiesStore(s => s._all);
  const actsLoaded = useActivitiesStore(s => s.loaded);
  const loadActs = useActivitiesStore(s => s.load);
  useEffect(() => { loadActs(true); }, [loadActs, user?.id]);

  // Ao retomar o app (background → active), a tela segue montada, então
  // recarrega o que pode ter mudado desde a última vez.
  useRefreshOnForeground(() => { loadCounters(); loadTodos(); loadRatings(); loadMeals(); loadActs(true); loadTonight(); });

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
  // Tarefas usam o dia lógico (vira às 02h, a madrugada fecha o dia anterior);
  // hábitos e refeições seguem a data do calendário, por isso os dois "hoje".
  const todoToday = todoDayStr();
  const nowTime = todoTimeStr();
  const tplById = new Map(todoTemplates.map(t => [t.id, t]));
  const todayTasks = todoOccurrences.filter(o =>
    o.status === 'pending' &&
    tplById.has(o.templateId) &&
    tplById.get(o.templateId)!.module !== 'compras' &&
    isStarted(tplById.get(o.templateId)!, todoToday) &&
    (isOverdue(o, todoToday) || o.dueDate === null || o.dueDate <= todoToday) &&
    isVisibleNow(tplById.get(o.templateId)!, o, todoToday, nowTime)
  );

  const MEAL_TARGET = 4;
  const mealsLogged = todayMeals.length;

  // Uma leitura só do relógio para os dois textos do cabeçalho, senão eles
  // podem discordar se o render cruzar a meia-noite. `useRefreshOnForeground`
  // acima já reavalia isto quando o app volta do background.
  const now = new Date();

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight }]} {...tabBarScroll} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greet}>
          <View style={styles.greetText}>
            <Text style={styles.date}>{formatToday(now).toUpperCase()}</Text>
            <Text style={styles.greeting}>{getGreeting(firstName)}</Text>
            <Text style={styles.sub}>Dia {weekPosition(now)} de 7 · {Math.max(0, MEAL_TARGET - mealsLogged)} refeições a registrar</Text>
          </View>
          <MoonBadge date={now} size={42} />
        </View>

        {/* O corpo hoje — carrossel de altura fixa: saldo de forma, de onde ele
            vem, e a prontidão. Cada página entra se tiver dado; o bloco some se
            nenhuma tiver. */}
        <TodayBodyCard activities={allActs} loaded={actsLoaded} />

        {/* Sono percebido — só a partir das 06h; colapsa em chip depois de preenchido,
            e aí a noite medida entra à direita (nunca antes da nota). */}
        {showSleepRating && (
          <SleepRatingCard
            value={todayRating?.sleepQuality ?? null}
            onSelect={setSleep}
            night={lastNight}
            onNightPress={() => { if (lastNight) router.push({ pathname: '/sono/[day]', params: { day: lastNight.wakeDay } }); }}
          />
        )}

        {/* Hábitos com valor hoje */}
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
    </>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: 54 },
  // A lua ganha faixa própria e o texto encolhe. O contrário — deixar a lua
  // ceder — faria ela mudar de tamanho conforme o comprimento do nome.
  //
  // O `paddingRight` soma ao `spacing.lg` da tela: a lua fica a 28 pt da borda,
  // não a 16. Colada na margem do conteúdo ela lia como parte do bloco de
  // texto; com o respiro, lê como o que é — um objeto à parte.
  greet: {
    paddingVertical: spacing.lg,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  greetText: { flex: 1, minWidth: 0 },
  date: { fontSize: 13, color: colors.ink3, letterSpacing: 0.9, fontFamily: fonts.sansSemiBold },
  // lineHeight 36 cortava o acento: o nome vem do usuário e a saudação será
  // traduzida, então "Begoña" ou "À bientôt" precisam de 39.6px de caixa.
  greeting: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 42, marginTop: 4, color: colors.ink },
  sub: { fontSize: 14, fontFamily: fonts.sans, color: colors.ink2, marginTop: 4 },
});
