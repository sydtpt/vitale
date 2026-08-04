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
import { router } from 'expo-router';
import {
  readinessAdvice,
  readinessInputsByDay,
  readinessSeries,
  activityDays,
  weeklyLoadVsRecovery,
  buildPeriodRecap,
  recapHeadline,
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPrefs,
} from '@vitale/shared';
import { readinessFromSummaries } from '../lib/health-readiness';
import { getJSON, setJSON } from '../lib/local-store';
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
let responseSub: { remove: () => void } | null = null;
let lastRefresh = 0;
let configured = false;

/** Última resposta de notificação já tratada (evita renavegar em relaunches). */
const HANDLED_NOTIF_KEY = 'vitale.lastHandledNotif';

/**
 * Navega para o deep-link da notificação tocada, com dedupe por
 * `identifier:date` — `getLastNotificationResponseAsync` devolve a mesma resposta
 * em relaunches "limpos"; a data separa disparos distintos de um agendamento
 * recorrente (cujo identifier é estável).
 */
async function handleNotificationRoute(response: Notifications.NotificationResponse | null): Promise<void> {
  const route = response?.notification.request.content.data?.route;
  if (typeof route !== 'string' || route.length === 0) return;
  const key = `${response!.notification.request.identifier}:${response!.notification.date}`;
  const last = await getJSON<string>(HANDLED_NOTIF_KEY).catch(() => null);
  if (last === key) return;
  await setJSON(HANDLED_NOTIF_KEY, key).catch(() => {});
  try {
    router.push(route as never);
  } catch (e) {
    console.warn('Falha ao abrir rota da notificação:', e);
  }
}

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

/** Prefs de notificação atuais (com fallback nos defaults se ainda não carregou). */
function notifPrefs(): NotificationPrefs {
  return useSettingsStore.getState().preferences?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;
}

/** Master ligado? (notificationsEnabled só é falso quando o usuário desliga tudo). */
function masterOn(): boolean {
  return useSettingsStore.getState().preferences?.notificationsEnabled !== false;
}

/**
 * Dispara uma notificação imediata (trigger null) para um evento, se o master e a
 * flag do tipo estiverem ligados e houver permissão. `route` vira o deep-link ao tocar.
 * Imediatas não são afetadas por `cancelAllScheduledNotificationsAsync`.
 */
async function notifyImmediate(
  enabled: boolean,
  content: { title: string; body: string },
  route: string,
): Promise<void> {
  try {
    if (!enabled || !masterOn()) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { ...content, data: { route } },
      trigger: null,
    });
  } catch (e) {
    console.warn('Falha ao notificar evento:', e);
  }
}

/** "N treinos sincronizados" — chamado pelo sync incremental quando há novos. */
export async function notifyActivitySync(pushed: number): Promise<void> {
  if (pushed <= 0) return;
  const body = pushed === 1 ? '1 treino sincronizado.' : `${pushed} treinos sincronizados.`;
  await notifyImmediate(notifPrefs().activitySync, { title: 'Atividades sincronizadas', body }, '/fitness');
}

/** "N novas tarefas automáticas" — chamado quando o sync cria ocorrências novas. */
export async function notifyAutoTasks(created: number): Promise<void> {
  if (created <= 0) return;
  const body =
    created === 1 ? '1 nova tarefa criada automaticamente.' : `${created} novas tarefas criadas automaticamente.`;
  await notifyImmediate(notifPrefs().autoTasks, { title: 'Novas tarefas automáticas', body }, '/tarefas/automaticas');
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
      : 'Seu dia no Orbe';

  const parts: string[] = [];
  if (hasReadiness || plan) parts.push(advice.text);
  if (overtraining) parts.push('⚠️ Carga alta vs recuperação — considere aliviar.');
  if (overdue > 0) parts.push(`${plural(overdue, 'tarefa')} atrasada${overdue > 1 ? 's' : ''}.`);
  if (pendingHabits > 0) parts.push(`${plural(pendingHabits, 'hábito')} pendente${pendingHabits > 1 ? 's' : ''}.`);

  if (parts.length === 0) return null;
  return { title, body: parts.join(' ') };
}

/** Corpo do recap da última semana (treinos + prontidão vs semana anterior), ou null. */
async function buildWeeklyRecap(): Promise<string | null> {
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
  return body || null;
}

/** Deep-link para abrir a Retrospectiva no período tocado. */
const RETRO_ROUTE = '/retrospectiva';

/** Agenda as 3 retrospectivas (semana/mês/ano) conforme a agenda configurada. */
async function scheduleRetros(prefs: NotificationPrefs): Promise<void> {
  const data = { route: RETRO_ROUTE };

  // Semanal — corpo enriquecido com o recap (treinos + prontidão vs semana anterior).
  const w = prefs.weeklyRetro;
  if (w.enabled) {
    const recap = await buildWeeklyRecap().catch(() => null);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Retrospectiva da semana',
        body: recap ?? 'Sua retrospectiva da semana está pronta — toque para ver.',
        data,
      },
      // expo usa weekday 1=Dom; nosso RetroSchedule usa 0=Dom (JS getDay) → +1.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: (w.weekday ?? 1) + 1,
        hour: w.hour,
        minute: w.minute,
      },
    });
  }

  // Mensal — dispara no dia configurado do mês (default 1, quando o mês anterior fechou).
  const m = prefs.monthlyRetro;
  if (m.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Retrospectiva do mês',
        body: 'Sua retrospectiva do mês está pronta — toque para ver.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: m.day ?? 1,
        hour: m.hour,
        minute: m.minute,
      },
    });
  }

  // Anual — 1º de janeiro (ano anterior fechou).
  const y = prefs.yearlyRetro;
  if (y.enabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Retrospectiva do ano',
        body: 'Sua retrospectiva do ano está pronta — toque para ver.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: 1,
        day: 1,
        hour: y.hour,
        minute: y.minute,
      },
    });
  }
}

/** Cancela e reagenda o digest diário + as retrospectivas com conteúdo fresco. */
export async function refreshDailyDigest(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const prefs = useSettingsStore.getState().preferences;
    if (prefs && prefs.notificationsEnabled === false) return;

    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;

    const notif = prefs?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;
    const { hour, minute } = parseTime(prefs?.dailyReminderTime);

    // Digest diário
    if (notif.dailyDigest) {
      const digest = await buildDigest();
      if (digest) {
        await Notifications.scheduleNotificationAsync({
          content: { title: digest.title, body: digest.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
      }
    }

    // Retrospectivas semana/mês/ano (agenda configurável)
    await scheduleRetros(notif);
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

  // Deep-link ao tocar a notificação (app aberto/background) + cold start.
  responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationRoute);
  void Notifications.getLastNotificationResponseAsync().then(handleNotificationRoute);
}

export function stopNotifications(): void {
  appStateSub?.remove();
  appStateSub = null;
  responseSub?.remove();
  responseSub = null;
}

/** Chamado ao ativar nas Configurações: pede permissão e agenda. */
export async function enableNotifications(): Promise<boolean> {
  configureHandler();
  const granted = await requestNotificationPermission();
  if (granted) await refreshDailyDigest();
  return granted;
}
