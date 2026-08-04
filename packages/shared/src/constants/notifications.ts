/**
 * Preferências de notificações locais (client-side, sem push remoto).
 *
 * Persistidas como um único jsonb `user_preferences.notification_prefs`, então
 * o objeto é resolvido defensivamente sobre os defaults (`resolveNotificationPrefs`):
 * chaves ausentes ou versões antigas do app nunca quebram — só herdam o default.
 * Adicionar um tipo novo = acrescentar aqui, sem migration nova.
 *
 * Cada retrospectiva tem agenda própria (dia + horário configuráveis). A
 * "disponibilidade" real do período é cálculo puro (`latestAvailableOffset` em
 * `period/bounds`): semana fecha domingo 20h, mês no dia 1, ano em 1º/jan — os
 * defaults de agenda apontam logo após esses marcos.
 */

/** Agenda de uma notificação de retrospectiva. Campos usados variam por período. */
export interface RetroSchedule {
  enabled: boolean;
  /** 0–6 (JS getDay: 0=Dom) — só semanal. */
  weekday?: number;
  /** 1–28 — só mensal. */
  day?: number;
  /** 0–23. */
  hour: number;
  /** 0–59. */
  minute: number;
}

export interface NotificationPrefs {
  /** Digest diário existente (prontidão + treino + tarefas + hábitos). */
  dailyDigest: boolean;
  /** Atividades sincronizadas (HealthKit → Supabase). */
  activitySync: boolean;
  /** Tarefas automáticas recém-criadas (recorrências / geradas por sync). */
  autoTasks: boolean;
  weeklyRetro: RetroSchedule;
  monthlyRetro: RetroSchedule;
  /** 1º/jan fixo; só `hour`/`minute` são usados. */
  yearlyRetro: RetroSchedule;
}

/** Preferências aplicadas quando o usuário ainda não configurou nada. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyDigest: true,
  activitySync: true,
  autoTasks: true,
  weeklyRetro: { enabled: true, weekday: 1, hour: 8, minute: 0 }, // segunda 8h (semana fechou domingo 20h)
  monthlyRetro: { enabled: true, day: 1, hour: 9, minute: 0 }, // dia 1 do mês seguinte
  yearlyRetro: { enabled: false, hour: 10, minute: 0 }, // 1º/jan
};

function resolveSchedule(raw: unknown, fallback: RetroSchedule): RetroSchedule {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, def: number | undefined): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : def;
  // Acesso por colchete: `r` é jsonb arbitrário (index signature), e o tsconfig da
  // web recusa acesso por ponto nesse caso (noPropertyAccessFromIndexSignature).
  return {
    enabled: typeof r['enabled'] === 'boolean' ? (r['enabled'] as boolean) : fallback.enabled,
    weekday: num(r['weekday'], fallback.weekday),
    day: num(r['day'], fallback.day),
    hour: num(r['hour'], fallback.hour) as number,
    minute: num(r['minute'], fallback.minute) as number,
  };
}

/**
 * Resolve as preferências de notificação a partir do jsonb (possivelmente vazio,
 * parcial ou inválido), fazendo merge sobre os defaults.
 */
export function resolveNotificationPrefs(raw: unknown): NotificationPrefs {
  const d = DEFAULT_NOTIFICATION_PREFS;
  if (!raw || typeof raw !== 'object') return { ...d, weeklyRetro: { ...d.weeklyRetro }, monthlyRetro: { ...d.monthlyRetro }, yearlyRetro: { ...d.yearlyRetro } };
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
  return {
    dailyDigest: bool(r['dailyDigest'], d.dailyDigest),
    activitySync: bool(r['activitySync'], d.activitySync),
    autoTasks: bool(r['autoTasks'], d.autoTasks),
    weeklyRetro: resolveSchedule(r['weeklyRetro'], d.weeklyRetro),
    monthlyRetro: resolveSchedule(r['monthlyRetro'], d.monthlyRetro),
    yearlyRetro: resolveSchedule(r['yearlyRetro'], d.yearlyRetro),
  };
}
