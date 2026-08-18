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
import { fetchDoneTodoOccurrencesSince, fetchHabitLogsSince } from '@vitale/shared';
import { createGoal, deleteGoal, fetchGoals, setGoalActive, updateGoal } from '@vitale/shared';

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

    let goals: Goal[];
    try {
      goals = await fetchGoals(supabase, userId);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao carregar as metas' });
      return;
    }

    // Janela das fontes: 1º de janeiro do menor ano entre as metas (ou ano atual).
    const minYear = goals.length ? Math.min(...goals.map((g) => g.year)) : new Date().getFullYear();
    const since = `${minYear}-01-01`;

    let occs: TodoOccurrence[];
    let logs: HabitLog[];
    try {
      [occs, logs] = await Promise.all([
        fetchDoneTodoOccurrencesSince(supabase, userId, since),
        fetchHabitLogsSince(supabase, userId, since),
      ]);
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Falha ao carregar as fontes' });
      return;
    }

    set({
      goals,
      doneOccurrences: occs,
      habitLogs: logs,
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
    await createGoal(supabase, userId, input, sort);
    await get().load(true);
  },

  updateGoal: async (id, input) => {
    await updateGoal(supabase, id, input);
    await get().load(true);
  },

  archiveGoal: async (id, active) => {
    await setGoalActive(supabase, id, active);
    await get().load(true);
  },

  deleteGoal: async (id) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await deleteGoal(supabase, userId, id);
    await get().load(true);
  },
}));

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
