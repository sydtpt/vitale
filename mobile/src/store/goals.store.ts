import { create } from 'zustand';
import type {
  Goal,
  GoalFamily,
  GoalPeriodKind,
  GoalProgress,
  GoalSource,
  HabitLog,
  TodoOccurrence,
} from '@vitale/shared';
import { evaluateGoal, type GoalContext } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { useActivitiesStore } from './activities.store';
import { useHabitsStore } from './habits.store';

/** Payload de criação/edição de uma meta (sem id/sort/createdAt/active). */
export interface NewGoal {
  year: number;
  title: string;
  cat: string;
  family: GoalFamily;
  source: GoalSource;
  period?: GoalPeriodKind | null;
  perPeriodTarget?: number | null;
  target: number;
  unit?: string | null;
  manualCurrent?: number | null;
}

interface DbGoalRow {
  id: string;
  year: number;
  title: string;
  cat: string | null;
  family: GoalFamily;
  source: GoalSource;
  period: GoalPeriodKind | null;
  per_period_target: number | string | null;
  target: number | string;
  unit: string | null;
  manual_current: number | string | null;
  active: boolean;
  sort: number;
  created_at: string;
}

interface DbOccRow {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoOccurrence['status'];
  done_at: string | null;
  created_at: string;
}

interface DbHabitLogRow {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | string | null;
}

interface GoalsState {
  goals: Goal[]; // todas (ativas + arquivadas), ordenadas por sort
  doneOccurrences: TodoOccurrence[];
  habitLogs: HabitLog[];
  loading: boolean;
  loaded: boolean;
  error: string | null;

  load: (force?: boolean) => Promise<void>;
  createGoal: (input: NewGoal) => Promise<void>;
  updateGoal: (id: string, input: NewGoal) => Promise<void>;
  archiveGoal: (id: string, active: boolean) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

/**
 * Fonte das Metas no mobile — espelha a store web (client-side, progresso DERIVADO
 * por `evaluateGoal`). Faz o fetch das metas + fontes que vivem só aqui (ocorrências
 * concluídas e logs de hábito do ano); atividades e definições de hábito reusam os
 * stores existentes. Nunca persiste valor calculado. Leitura apenas nesta fase.
 */
export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  doneOccurrences: [],
  habitLogs: [],
  loading: false,
  loaded: false,
  error: null,

  load: async (force = false) => {
    const { loading, loaded } = get();
    if (loading || (loaded && !force)) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) {
      set({ error: 'Sessão não encontrada.', loading: false });
      return;
    }
    set({ loading: true, error: null });

    const gRes = await supabase.from('goals').select('*').eq('user_id', userId).order('sort');
    if (gRes.error) {
      set({ loading: false, error: gRes.error.message });
      return;
    }
    const goals = ((gRes.data ?? []) as DbGoalRow[]).map(mapGoal);

    // Janela das fontes: 1º de janeiro do menor ano entre as metas (ou ano atual).
    const minYear = goals.length ? Math.min(...goals.map((g) => g.year)) : new Date().getFullYear();
    const since = `${minYear}-01-01`;

    const [occRes, logRes] = await Promise.all([
      supabase
        .from('todo_occurrences')
        .select('id,template_id,due_date,status,done_at,created_at')
        .eq('user_id', userId)
        .eq('status', 'done')
        .gte('done_at', `${since}T00:00:00`),
      supabase
        .from('habit_logs')
        .select('id,habit_id,log_date,value')
        .eq('user_id', userId)
        .gte('log_date', since),
    ]);
    if (occRes.error) {
      set({ loading: false, error: occRes.error.message });
      return;
    }
    if (logRes.error) {
      set({ loading: false, error: logRes.error.message });
      return;
    }

    set({
      goals,
      doneOccurrences: ((occRes.data ?? []) as DbOccRow[]).map(mapOcc),
      habitLogs: ((logRes.data ?? []) as DbHabitLogRow[]).map(mapLog),
      loading: false,
      loaded: true,
    });

    // Fontes que vivem nos stores existentes (histórico completo em memória).
    void useActivitiesStore.getState().load();
    void useHabitsStore.getState().load();
  },

  createGoal: async (input) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const sort = get().goals.reduce((m, g) => Math.max(m, g.sort), -1) + 1;
    const { error } = await supabase.from('goals').insert({ user_id: userId, ...toRow(input), sort });
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().load(true);
  },

  updateGoal: async (id, input) => {
    const { error } = await supabase.from('goals').update(toRow(input)).eq('id', id);
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().load(true);
  },

  archiveGoal: async (id, active) => {
    const { error } = await supabase.from('goals').update({ active }).eq('id', id);
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().load(true);
  },

  deleteGoal: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().load(true);
  },
}));

function toRow(input: NewGoal): Record<string, unknown> {
  return {
    year: input.year,
    title: input.title,
    cat: input.cat,
    family: input.family,
    source: input.source,
    period: input.period ?? null,
    per_period_target: input.perPeriodTarget ?? null,
    target: input.target,
    unit: input.unit ?? null,
    manual_current: input.manualCurrent ?? null,
  };
}

function mapGoal(r: DbGoalRow): Goal {
  return {
    id: r.id,
    year: r.year,
    title: r.title,
    cat: r.cat ?? 'geral',
    family: r.family,
    source: r.source,
    period: r.period ?? undefined,
    perPeriodTarget: r.per_period_target == null ? undefined : Number(r.per_period_target),
    target: Number(r.target),
    unit: r.unit ?? undefined,
    manualCurrent: r.manual_current == null ? undefined : Number(r.manual_current),
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

function mapOcc(r: DbOccRow): TodoOccurrence {
  return {
    id: r.id,
    templateId: r.template_id,
    dueDate: r.due_date,
    status: r.status,
    doneAt: r.done_at ?? undefined,
    createdAt: r.created_at,
  };
}

function mapLog(r: DbHabitLogRow): HabitLog {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, value: Number(r.value ?? 0) };
}

/** Contexto de avaliação a partir das fontes carregadas. Chamar no render. */
export function buildGoalContext(state: {
  doneOccurrences: TodoOccurrence[];
  habitLogs: HabitLog[];
}): GoalContext {
  return {
    activities: useActivitiesStore.getState().activities(),
    doneOccurrences: state.doneOccurrences,
    habitLogs: state.habitLogs,
    habits: useHabitsStore
      .getState()
      .habits.map((h) => ({ id: h.id, direction: h.direction, target: h.target })),
    now: new Date(),
  };
}

/** Progresso de todas as metas (derivado). */
export function computeProgress(
  goals: Goal[],
  ctx: GoalContext,
): Map<string, GoalProgress> {
  const map = new Map<string, GoalProgress>();
  for (const g of goals) map.set(g.id, evaluateGoal(g, ctx));
  return map;
}
