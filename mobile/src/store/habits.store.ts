import { create } from 'zustand';
import type { CounterHabit, HabitDirection } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/habit-logic';
import {
  enqueueDelta,
  drainHabitQueue,
  type HabitDelta,
} from '../lib/habit-queue';
import { useAuthStore } from './auth.store';

export interface NewHabit {
  name: string;
  icon: string;
  color: string;
  unit: string;
  step: number;
  target?: number;
  direction: HabitDirection;
}

/** Campos editáveis de um hábito. `target: null` limpa a meta. */
export interface HabitPatch {
  name?: string;
  icon?: string;
  color?: string;
  unit?: string;
  step?: number;
  target?: number | null;
  direction?: HabitDirection;
  active?: boolean;
  sort?: number;
}

interface HabitsState {
  habits: CounterHabit[]; // ativos, ordenados por `sort` (para captura)
  allHabits: CounterHabit[]; // todos (ativos + arquivados) — para a tela de gestão
  todayLogs: Record<string, number>; // habitId → valor de hoje
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  loadAll: () => Promise<void>;
  increment: (id: string) => Promise<void>;
  decrement: (id: string) => Promise<void>;
  resetToday: (id: string) => Promise<void>;

  createHabit: (input: NewHabit) => Promise<void>;
  updateHabit: (id: string, patch: HabitPatch) => Promise<void>;
  archiveHabit: (id: string, active: boolean) => Promise<void>;
}

type HabitRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  unit: string;
  step: number | string;
  target: number | string | null;
  direction: HabitDirection;
  active: boolean;
  sort: number;
};

function toHabit(row: HabitRow): CounterHabit {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? '',
    color: row.color ?? '',
    unit: row.unit,
    step: Number(row.step),
    target: row.target == null ? undefined : Number(row.target),
    direction: row.direction,
    active: row.active,
    sort: row.sort,
  };
}

function genOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** Envia cada delta pendente via rpc; devolve os que falharam (a manter na fila). */
async function flushDeltas(items: HabitDelta[]): Promise<HabitDelta[]> {
  const failed: HabitDelta[] = [];
  for (const it of items) {
    const { error } = await supabase.rpc('habit_log_add', {
      p_habit: it.habitId,
      p_date: it.date,
      p_delta: it.delta,
    });
    if (error) failed.push(it);
  }
  return failed;
}

/** Hábito-semente: substitui a água mock por um contador real (spec §9). */
async function seedDefaults(userId: string): Promise<void> {
  await supabase.from('habits').insert({
    user_id: userId,
    name: 'Água',
    icon: 'water',
    color: 'agua',
    unit: 'L',
    step: 0.25,
    target: 4,
    direction: 'at_least',
    sort: 0,
  });
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  allHabits: [],
  todayLogs: {},
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    // 1) drenar deltas offline pendentes antes de ler o estado do servidor
    await drainHabitQueue(flushDeltas);

    // 2) semear defaults se o usuário nunca criou nenhum hábito
    const { count } = await supabase
      .from('habits')
      .select('id', { count: 'exact', head: true });
    if ((count ?? 0) === 0) {
      await seedDefaults(userId);
    }

    // 3) hábitos ativos
    const { data: rows } = await supabase
      .from('habits')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    const habits = (rows ?? []).map(toHabit);

    // 4) logs de hoje
    const today = localDateStr();
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id, value')
      .eq('log_date', today);
    const todayLogs: Record<string, number> = {};
    for (const l of logs ?? []) todayLogs[l.habit_id as string] = Number(l.value);

    set({ habits, todayLogs, loading: false, loaded: true });
  },

  // Carrega todos os hábitos (ativos + arquivados) para a tela de gestão;
  // de quebra, mantém a lista de captura (`habits`) coerente.
  loadAll: async () => {
    if (!currentUserId()) return;
    const { data } = await supabase
      .from('habits')
      .select('*')
      .order('sort', { ascending: true });
    const all = (data ?? []).map(toHabit);
    set({ allHabits: all, habits: all.filter((h) => h.active) });
  },

  increment: async (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const today = localDateStr();
    const next = (get().todayLogs[id] ?? 0) + habit.step;
    set((s) => ({ todayLogs: { ...s.todayLogs, [id]: next } }));
    await enqueueDelta({ opId: genOpId(), habitId: id, date: today, delta: habit.step });
    await drainHabitQueue(flushDeltas);
  },

  decrement: async (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const current = get().todayLogs[id] ?? 0;
    if (current <= 0) return; // já no piso: ignora
    const today = localDateStr();
    const next = Math.max(0, current - habit.step);
    set((s) => ({ todayLogs: { ...s.todayLogs, [id]: next } }));
    await enqueueDelta({ opId: genOpId(), habitId: id, date: today, delta: -habit.step });
    await drainHabitQueue(flushDeltas);
  },

  resetToday: async (id) => {
    const current = get().todayLogs[id] ?? 0;
    if (current <= 0) return;
    const today = localDateStr();
    set((s) => ({ todayLogs: { ...s.todayLogs, [id]: 0 } }));
    await enqueueDelta({ opId: genOpId(), habitId: id, date: today, delta: -current });
    await drainHabitQueue(flushDeltas);
  },

  createHabit: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const list = get().allHabits.length ? get().allHabits : get().habits;
    const sort = list.reduce((max, h) => Math.max(max, h.sort), -1) + 1;
    await supabase.from('habits').insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      unit: input.unit,
      step: input.step,
      target: input.target ?? null,
      direction: input.direction,
      sort,
    });
    await get().loadAll();
  },

  updateHabit: async (id, patch) => {
    await supabase.from('habits').update(patch).eq('id', id);
    await get().loadAll();
  },

  archiveHabit: async (id, active) => {
    await supabase.from('habits').update({ active }).eq('id', id);
    await get().loadAll();
  },
}));
