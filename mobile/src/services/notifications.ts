/**
 * Notificações locais (sem backend). Um digest diário no `dailyReminderTime`
 * que reúne prontidão + treino planejado + recomendação, e anexa overtraining,
 * tarefas atrasadas e hábitos pendentes quando houver.
 *
 * Conteúdo recalculado a cada foreground (AppState 'active') e reagendado como
 * gatilho DAILY — então a notificação dispara todo dia mesmo sem abrir o app,
 * com o conteúdo da última vez que ele esteve aberto. Sem push remoto.
 *
 * Além do digest, cada tarefa com hora (`startTime`) ganha um lembrete próprio no
 * instante marcado (gatilho DATE, um por ocorrência) — ver `scheduleTaskReminders`.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { activityDays, buildPeriodRecap, buildTaskReminders, DEFAULT_NOTIFICATION_PREFS, isMet, isOverdue, latestAvailableOffset, localDateStr, todoDayStr, readinessAdvice, readinessInputsByDay, readinessSeries, recapHeadline, type NotificationPrefs, type PeriodKind, weeklyLoadVsRecovery } from '@vitale/shared';
import { readinessFromSummaries } from '../lib/health-readiness';
import { activitySyncNotice } from '../lib/activity-sync-notice';
import { claimUnnotified } from '../lib/notified-activities';
import { getJSON, setJSON } from '../lib/local-store';
import type { SyncedActivity } from './activity-sync';
import { useSettingsStore } from '../store/settings.store';
import { useHealthStore } from '../store/health.store';
import { useHealthDailyStore } from '../store/health-daily.store';
import { useActivitiesStore } from '../store/activities.store';
import { useRetroStore, retroSince } from '../store/retro.store';
import { usePlannedWorkoutsStore } from '../store/planned-workouts.store';
import { useTodosStore } from '../store/todos.store';
import { useHabitsStore } from '../store/habits.store';

const DEFAULT_TIME = '08:00';
/** No máximo um refresh por minuto no foreground. */
const THROTTLE_MS = 60_000;
/** Canal Android — 'default' é o mesmo que o expo usa como fallback (inclui trigger null). */
const ANDROID_CHANNEL_ID = 'default';
/** Teto de espera pelas prefs no boot; passado isso, agenda com o que houver. */
const PREFS_WAIT_MS = 4_000;

/**
 * Prefixo do identifier dos lembretes de tarefa (`todo:<occId>`). Serve a dois
 * propósitos: reagendar só eles sem tocar no digest/retros, e tornar o
 * agendamento idempotente — reagendar o mesmo occId substitui, não duplica.
 */
const TASK_PREFIX = 'todo:';
/** Deep-link ao tocar o lembrete de uma tarefa. */
const TAREFAS_ROUTE = '/tarefas';
/** Janela de coalescência das mudanças na store de tarefas (concluir → reagendar). */
const TASK_DEBOUNCE_MS = 400;

let appStateSub: { remove: () => void } | null = null;
let responseSub: { remove: () => void } | null = null;
let settingsUnsub: (() => void) | null = null;
let todosUnsub: (() => void) | null = null;
let taskDebounce: ReturnType<typeof setTimeout> | null = null;
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

/**
 * Canal Android. Sem ele o Android 8+ usa um canal implícito sem som/importância
 * definidos. O id 'default' casa com o fallback do expo, então vale também para
 * as imediatas (`trigger: null`, que não aceitam `channelId`).
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Lembretes do Orbe',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F25C2B',
    });
  } catch (e) {
    console.warn('Falha ao criar canal de notificação:', e);
  }
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

/**
 * Garante o prompt na primeira execução. Todo agendamento aqui checa `granted`
 * antes de agendar, então sem esta chamada nada era agendado e nenhum prompt
 * aparecia — o master das Configurações já nasce ligado, então ninguém o
 * "ativa" e `enableNotifications` nunca rodava.
 *
 * Só perguntamos com status `undetermined`: quem já negou não é reperguntado
 * (no iOS o prompt nem reaparece; a saída é o botão de abrir os Ajustes).
 */
async function ensurePermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.status !== 'undetermined' || !current.canAskAgain) return false;
    if (!masterOn()) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch (e) {
    console.warn('Falha ao pedir permissão de notificação:', e);
    return false;
  }
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

/**
 * Deep-link da notificação de sync: a tab Histórico, onde a atividade aparece —
 * e não `/fitness`, que é o painel de sync (uma lista de TIPOS com botões).
 *
 * Qualificado pelo grupo, como o `/(auth)/login` do `_layout`: o destino é uma
 * tab, e `app/historico/` continua existindo por causa de `[label]`. Um
 * `/historico` cru voltaria a ficar ambíguo no dia em que alguém criasse um
 * `historico/index.tsx` ali dentro — foi exatamente o que existia até este
 * commit, uma versão órfã e antiga da mesma tela que ninguém alcançava.
 */
const HISTORICO_ROUTE = '/(tabs)/historico';

/**
 * "Atividade de Yoga sincronizada" — chamado pelo sync incremental.
 *
 * Recebe as atividades enviadas no ciclo (não a contagem): o TIPO nomeia a
 * atividade no corpo, e o ID filtra o que já foi anunciado antes. O upsert é
 * idempotente e a âncora nem sempre avança, então "enviada" e "inédita" são
 * coisas diferentes — sem o filtro, o mesmo treino notifica a cada ciclo.
 */
export async function notifyActivitySync(activities: readonly SyncedActivity[]): Promise<void> {
  if (activities.length === 0) return;

  const fresh = new Set(await claimUnnotified(activities.map((a) => a.id)));
  if (fresh.size === 0) return;

  const notice = activitySyncNotice(
    activities.filter((a) => fresh.has(a.id)).map((a) => a.activityId),
  );
  if (!notice) return;
  await notifyImmediate(notifPrefs().activitySync, notice, HISTORICO_ROUTE);
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

  // Tarefas atrasadas — pelo dia lógico das tarefas (vira às 02h), não pelo calendário.
  const todoToday = todoDayStr();
  const overdue = useTodosStore
    .getState()
    .occurrences.filter((o) => o.status === 'pending' && o.dueDate != null && isOverdue(o, todoToday)).length;

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

/**
 * Corpo da notificação a partir da **manchete** da Retrospectiva (spec v2 §3.1).
 *
 * A manchete tem três frases e o usuário lê sempre no celular — então ela cabe
 * numa notificação, e abrir o app vira o passo opcional em vez do requisito.
 * Duas frases: notificação não é a tela, e o SO trunca o resto.
 *
 * Devolve `null` quando não houve material (`lede.thin`), e aí quem chama decide
 * o fallback — nunca uma frase vazia.
 */
async function buildRetroLedeBody(kind: PeriodKind): Promise<string | null> {
  const now = new Date();
  const offset = latestAvailableOffset(now, kind);
  await useRetroStore.getState().ensure(retroSince(now, kind, offset)).catch(() => {});
  const lede = useRetroStore.getState().lede(now, kind, offset);
  if (lede.thin) return null;
  return lede.sentences.slice(0, 2).join(' ') || null;
}

/** Deep-link para abrir a Retrospectiva no período tocado. */
const RETRO_ROUTE = '/retrospectiva';

/** Agenda as 3 retrospectivas (semana/mês/ano) conforme a agenda configurada. */
async function scheduleRetros(prefs: NotificationPrefs): Promise<void> {
  const data = { route: RETRO_ROUTE };

  // Semanal — a manchete primeiro. O recap de treino+prontidão vira fallback: é
  // estatística de volume, e o insight cruzado vale mais que ela (spec v2 §2.2).
  const w = prefs.weeklyRetro;
  if (w.enabled) {
    const lede = await buildRetroLedeBody('week').catch(() => null);
    const recap = lede ?? await buildWeeklyRecap().catch(() => null);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Sua semana fechou',
        body: recap ?? 'Sua retrospectiva da semana está pronta — toque para ver.',
        data,
      },
      // expo usa weekday 1=Dom; nosso RetroSchedule usa 0=Dom (JS getDay) → +1.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: ANDROID_CHANNEL_ID,
        weekday: (w.weekday ?? 1) + 1,
        hour: w.hour,
        minute: w.minute,
      },
    });
  }

  // Mensal — dispara no dia configurado do mês (default 1, quando o mês anterior fechou).
  const m = prefs.monthlyRetro;
  if (m.enabled) {
    const body = await buildRetroLedeBody('month').catch(() => null);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Seu mês fechou',
        body: body ?? 'Sua retrospectiva do mês está pronta — toque para ver.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        channelId: ANDROID_CHANNEL_ID,
        day: m.day ?? 1,
        hour: m.hour,
        minute: m.minute,
      },
    });
  }

  // Anual — 1º de janeiro (ano anterior fechou).
  const y = prefs.yearlyRetro;
  if (y.enabled) {
    const body = await buildRetroLedeBody('year').catch(() => null);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Seu ano fechou',
        body: body ?? 'Sua retrospectiva do ano está pronta — toque para ver.',
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        channelId: ANDROID_CHANNEL_ID,
        // `month` segue o range do Date do JS (0 = janeiro).
        month: 0,
        day: 1,
        hour: y.hour,
        minute: y.minute,
      },
    });
  }
}

/**
 * Um lembrete por tarefa com hora: título fixo "Lembrete", corpo = o texto da
 * tarefa. Gatilho DATE no instante `dueDate + startTime`, então dispara com o app
 * fechado — é o que separa isto do `setTimeout` de fronteira da store, que só
 * vale enquanto o app está aberto.
 *
 * Espera que a store de tarefas já esteja carregada (quem chama garante isso).
 * O identifier `todo:<occId>` é estável, então reagendar substitui o anterior.
 */
async function scheduleTaskReminders(): Promise<void> {
  if (!notifPrefs().taskReminders) return;
  const { templates, occurrences } = useTodosStore.getState();
  for (const r of buildTaskReminders(templates, occurrences)) {
    await Notifications.scheduleNotificationAsync({
      identifier: `${TASK_PREFIX}${r.occId}`,
      content: { title: 'Lembrete', body: r.name, data: { route: TAREFAS_ROUTE } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        channelId: ANDROID_CHANNEL_ID,
        date: r.at,
      },
    });
  }
}

/**
 * Reagenda só os lembretes de tarefa, sem mexer no digest nem nas retrospectivas
 * — concluir, criar, arquivar ou mudar a hora de uma tarefa reflete na hora, sem
 * esperar o próximo foreground. Cancelar antes é o que apaga o lembrete de uma
 * ocorrência que deixou de ser pendente (o identifier dela some da lista nova).
 */
export async function refreshTaskReminders(): Promise<void> {
  try {
    if (!masterOn()) return;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier.startsWith(TASK_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
    await scheduleTaskReminders();
  } catch (e) {
    console.warn('Falha ao agendar lembretes de tarefa:', e);
  }
}

/** Cancela e reagenda o digest diário + as retrospectivas com conteúdo fresco. */
async function runRefresh(): Promise<void> {
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
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            channelId: ANDROID_CHANNEL_ID,
            hour,
            minute,
          },
        });
      }
    }

    // Retrospectivas semana/mês/ano (agenda configurável)
    await scheduleRetros(notif);

    // Lembretes das tarefas com hora. O `buildDigest` acima já recarrega as
    // tarefas; sem digest ligado, ninguém carregou — daí o load condicional.
    if (notif.taskReminders) {
      if (!notif.dailyDigest) await useTodosStore.getState().load().catch(() => {});
      await scheduleTaskReminders();
    }
  } catch (e) {
    console.warn('Falha ao agendar notificações:', e);
  }
}

let refreshing: Promise<void> | null = null;
let rerunQueued = false;

/**
 * Reagenda tudo, serializando chamadas concorrentes. Cada passada começa com
 * `cancelAllScheduledNotificationsAsync`, então duas em paralelo se atropelariam
 * (uma cancelando o que a outra acabou de agendar) — a tela de Configurações e o
 * listener de prefs disparam quase juntos. Uma chamada durante um refresh em voo
 * enfileira uma passada final com o estado mais novo.
 */
export function refreshDailyDigest(): Promise<void> {
  if (refreshing) {
    rerunQueued = true;
    return refreshing;
  }
  refreshing = (async () => {
    try {
      do {
        rerunQueued = false;
        await runRefresh();
      } while (rerunQueued);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function refreshThrottled(force = false): void {
  const now = Date.now();
  if (!force && now - lastRefresh < THROTTLE_MS) return;
  lastRefresh = now;
  void refreshDailyDigest();
}

/** Aguarda `loadSettings` hidratar as prefs (cache local ou rede) antes do 1º agendamento. */
function waitForPreferences(): Promise<void> {
  if (useSettingsStore.getState().preferences) return Promise.resolve();
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      unsub();
      resolve();
    };
    const timer = setTimeout(done, PREFS_WAIT_MS);
    const unsub = useSettingsStore.subscribe((s) => {
      if (s.preferences) done();
    });
  });
}

/** Só os campos que mudam o agendamento — evita reagendar por tema/wallpaper. */
function prefsSignature(): string {
  const p = useSettingsStore.getState().preferences;
  if (!p) return '';
  return JSON.stringify([p.notificationsEnabled, p.dailyReminderTime, p.notificationPrefs]);
}

/**
 * Só o que muda os lembretes de tarefa. Sem isso, o `loading` da própria store
 * (que o reagendamento pode disparar) realimentaria o ciclo.
 */
function tasksSignature(): string {
  const { templates, occurrences } = useTodosStore.getState();
  const withTime = new Map(
    templates.filter((t) => t.active && t.startTime).map((t) => [t.id, `${t.startTime}|${t.name}`]),
  );
  const parts: string[] = [];
  for (const o of occurrences) {
    if (o.status !== 'pending' || o.dueDate == null) continue;
    const t = withTime.get(o.templateId);
    if (t) parts.push(`${o.id}|${o.dueDate}|${t}`);
  }
  return parts.sort().join(';');
}

/** Liga o ciclo: configura handler, agenda já e reagenda a cada foreground. */
export function startNotifications(): void {
  configureHandler();

  void (async () => {
    await ensureAndroidChannel();
    // O agendamento lê as prefs; sem esperar, o 1º passe usaria os defaults
    // (08:00) e ignoraria um master desligado.
    await waitForPreferences();
    await ensurePermission();
    refreshThrottled(true);
  })();

  const handle = (s: AppStateStatus) => {
    if (s === 'active') refreshThrottled();
  };
  appStateSub = AppState.addEventListener('change', handle);

  // Reagenda quando as prefs mudam (inclusive a carga tardia do `loadSettings`,
  // caso ela chegue depois do teto de espera acima).
  let lastSignature = prefsSignature();
  settingsUnsub = useSettingsStore.subscribe(() => {
    const sig = prefsSignature();
    if (sig === lastSignature) return;
    lastSignature = sig;
    refreshThrottled(true);
  });

  // Reagenda os lembretes quando as tarefas mudam (concluir, criar, editar a
  // hora, arquivar). Debounce porque um `load` mexe na store várias vezes.
  let lastTasks = tasksSignature();
  todosUnsub = useTodosStore.subscribe(() => {
    const sig = tasksSignature();
    if (sig === lastTasks) return;
    lastTasks = sig;
    if (taskDebounce) clearTimeout(taskDebounce);
    taskDebounce = setTimeout(() => {
      taskDebounce = null;
      void refreshTaskReminders();
    }, TASK_DEBOUNCE_MS);
  });

  // Deep-link ao tocar a notificação (app aberto/background) + cold start.
  responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationRoute);
  void Notifications.getLastNotificationResponseAsync().then(handleNotificationRoute);
}

export function stopNotifications(): void {
  appStateSub?.remove();
  appStateSub = null;
  responseSub?.remove();
  responseSub = null;
  settingsUnsub?.();
  settingsUnsub = null;
  todosUnsub?.();
  todosUnsub = null;
  if (taskDebounce) {
    clearTimeout(taskDebounce);
    taskDebounce = null;
  }
}

/** Chamado ao ativar nas Configurações: pede permissão e agenda. */
export async function enableNotifications(): Promise<boolean> {
  configureHandler();
  const granted = await requestNotificationPermission();
  if (granted) await refreshDailyDigest();
  return granted;
}
