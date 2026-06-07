/**
 * Notificações locais (sem backend). Um digest diário no `dailyReminderTime`
 * que reúne prontidão + treino planejado + recomendação, e anexa overtraining,
 * tarefas atrasadas e hábitos pendentes quando houver.
 *
 * Conteúdo recalculado a cada foreground (AppState 'active') e reagendado como
 * gatilho DAILY — então a notificação dispara todo dia mesmo sem abrir o app,
 * com o conteúdo da última vez que ele esteve aberto. Sem push remoto.
 */
import { AppState, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  readinessAdvice,
  readinessInputsByDay,
  readinessSeries,
  activityDays,
  weeklyLoadVsRecovery,
  buildPeriodRecap,
  recapHeadline,
} from '@vitale/shared';
import { readinessFromSummaries } from '../lib/health-readiness';
import { localDateStr, isOverdue } from '../lib/todo-logic';
import { isMet } from '../lib/habit-logic';
import { useSettingsStore } from '../store/settings.store';
import { useHealthStore } from '../store/health.store';
import { useHealthDailyStore } from '../store/health-daily.store';
import { useActivitiesStore } from '../store/activities.store';
import { usePlannedWorkoutsStore } from '../store/planned-workouts.store';
import { useTodosStore } from '../store/todos.store';
import { useHabitsStore } from '../store/habits.store';

const DEFAULT_TIME = '08:00';
/** No máximo um refresh por minuto no foreground. */
const THROTTLE_MS = 60_000;

let appStateSub: { remove: () => void } | null = null;
let lastRefresh = 0;
let configured = false;

function configureHandler(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function parseTime(s: string | undefined): { hour: number; minute: number } {
  const [h, m] = (s ?? DEFAULT_TIME).split(':').map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}

/** Pede permissão (com prompt) — chamar só ao ativar nas Configurações. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Monta o conteúdo do digest a partir dos dados reais (ou null se nada a dizer). */
async function buildDigest(): Promise<{ title: string; body: string } | null> {
  await Promise.all([
    useHealthStore.getState().loadSummaries().catch(() => {}),
    usePlannedWorkoutsStore.getState().load().catch(() => {}),
    useTodosStore.getState().load().catch(() => {}),
    useHabitsStore.getState().load().catch(() => {}),
    useActivitiesStore.getState().load().catch(() => {}),
    useHealthDailyStore.getState().load().catch(() => {}),
  ]);

  const today = localDateStr();

  // Prontidão + treino do dia + recomendação
  const score = readinessFromSummaries(useHealthStore.getState().summaries);
  const hasReadiness = score.components.length > 0;
  const plan = usePlannedWorkoutsStore.getState().planned.find((p) => p.date === today);
  const advice = readinessAdvice(score.total, hasReadiness, plan?.kind ?? 'none', plan?.type ?? '');

  // Overtraining: dip da semana corrente (carga forte ↑ + recuperação ↓)
  const acts = useActivitiesStore.getState().activities();
  const hd = useHealthDailyStore.getState();
  const inputs = readinessInputsByDay({
    sono: hd.seriesFor('sono'),
    fcRepouso: hd.seriesFor('fcRepouso'),
    vfc: hd.seriesFor('vfc'),
    aneis: hd.seriesFor('aneis'),
  });
  const recByDay = new Map<string, number>();
  for (const p of readinessSeries(inputs, activityDays(acts), 63)) if (p.score != null) recByDay.set(p.date, p.score);
  const weeks = weeklyLoadVsRecovery(acts, recByDay, 8);
  const overtraining = weeks.length > 0 ? weeks[weeks.length - 1].dip : false;

  // Tarefas atrasadas
  const overdue = useTodosStore
    .getState()
    .occurrences.filter((o) => o.status === 'pending' && o.dueDate != null && isOverdue(o, today)).length;

  // Hábitos pendentes (meta de mínimo não batida, visíveis na Hoje)
  const habitsState = useHabitsStore.getState();
  const pendingHabits = habitsState.habits.filter(
    (h) =>
      h.active &&
      h.showOnHome &&
      h.target != null &&
      h.direction === 'at_least' &&
      !isMet(h, habitsState.todayLogs[h.id] ?? 0),
  ).length;

  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`;

  const title = hasReadiness
    ? `Prontidão ${score.total} · ${plan ? plan.type : 'sem treino hoje'}`
    : plan
      ? `Hoje: ${plan.type}`
      : 'Seu dia no Vitale';

  const parts: string[] = [];
  if (hasReadiness || plan) parts.push(advice.text);
  if (overtraining) parts.push('⚠️ Carga alta vs recuperação — considere aliviar.');
  if (overdue > 0) parts.push(`${plural(overdue, 'tarefa')} atrasada${overdue > 1 ? 's' : ''}.`);
  if (pendingHabits > 0) parts.push(`${plural(pendingHabits, 'hábito')} pendente${pendingHabits > 1 ? 's' : ''}.`);

  if (parts.length === 0) return null;
  return { title, body: parts.join(' ') };
}

/** Recap da última semana (treinos + prontidão vs semana anterior). */
async function buildWeeklyRecap(): Promise<{ title: string; body: string } | null> {
  await Promise.all([
    useActivitiesStore.getState().load().catch(() => {}),
    useHealthDailyStore.getState().load().catch(() => {}),
  ]);

  const acts = useActivitiesStore.getState().activities();
  const hd = useHealthDailyStore.getState();
  const inputs = readinessInputsByDay({
    sono: hd.seriesFor('sono'),
    fcRepouso: hd.seriesFor('fcRepouso'),
    vfc: hd.seriesFor('vfc'),
    aneis: hd.seriesFor('aneis'),
  });
  const recByDay = new Map<string, number>();
  for (const p of readinessSeries(inputs, activityDays(acts), 63)) if (p.score != null) recByDay.set(p.date, p.score);

  const recap = buildPeriodRecap(acts, recByDay, 7);
  if (recap.sessions.current === 0 && recap.avgReadiness.current === 0) return null;

  const bits: string[] = [];
  if (recap.distanceKm.deltaPct != null) {
    bits.push(`${recap.distanceKm.deltaPct >= 0 ? '↑' : '↓'}${Math.abs(Math.round(recap.distanceKm.deltaPct))}% vs semana anterior`);
  }
  if (recap.hardMin.current > 0) bits.push(`${recap.hardMin.current}min fortes`);

  const body = [recapHeadline(recap), bits.join(' · ')].filter(Boolean).join('. ');
  return { title: 'Recap da semana', body };
}

/** Cancela e reagenda o digest diário + recap semanal com conteúdo fresco. */
export async function refreshDailyDigest(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const prefs = useSettingsStore.getState().preferences;
    if (prefs && prefs.notificationsEnabled === false) return;

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;

    const { hour, minute } = parseTime(prefs?.dailyReminderTime);

    // Digest diário
    const digest = await buildDigest();
    if (digest) {
      await Notifications.scheduleNotificationAsync({
        content: { title: digest.title, body: digest.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }

    // Recap semanal — domingo 20h
    const recap = await buildWeeklyRecap();
    if (recap) {
      await Notifications.scheduleNotificationAsync({
        content: { title: recap.title, body: recap.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 20, minute: 0 },
      });
    }
  } catch (e) {
    console.warn('Falha ao agendar notificações:', e);
  }
}

function refreshThrottled(force = false): void {
  const now = Date.now();
  if (!force && now - lastRefresh < THROTTLE_MS) return;
  lastRefresh = now;
  void refreshDailyDigest();
}

/** Liga o ciclo: configura handler, agenda já e reagenda a cada foreground. */
export function startNotifications(): void {
  configureHandler();
  refreshThrottled(true);
  const handle = (s: AppStateStatus) => {
    if (s === 'active') refreshThrottled();
  };
  appStateSub = AppState.addEventListener('change', handle);
}

export function stopNotifications(): void {
  appStateSub?.remove();
  appStateSub = null;
}

/** Chamado ao ativar nas Configurações: pede permissão e agenda. */
export async function enableNotifications(): Promise<boolean> {
  configureHandler();
  const granted = await requestNotificationPermission();
  if (granted) await refreshDailyDigest();
  return granted;
}
