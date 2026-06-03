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

/** Janela de histórico carregada para derivar sequências (streaks) no mobile. */
export const HABIT_WINDOW_DAYS = 90;

export interface NewHabit {
  name: string;
  icon: string;
  color: string;
  unit: string;
  step: number;
  target?: number;
  direction: HabitDirection;
  bad: boolean;
  showOnHome: boolean;
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
  bad?: boolean;
  show_on_home?: boolean;
  active?: boolean;
  sort?: number;
}

interface HabitsState {
  habits: CounterHabit[]; // ativos, ordenados por `sort` (para captura)
  allHabits: CounterHabit[]; // todos (ativos + arquivados) — para a tela de gestão
  todayLogs: Record<string, number>; // habitId → valor de hoje
  windowByHabit: Record<string, Record<string, number>>; // habitId → (data → valor) da janela; base do streak
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  /** Implementação interna do load; chame `load()`, que serializa concorrência. */
  _load: () => Promise<void>;
  loadAll: () => Promise<void>;
  increment: (id: string) => Promise<void>;
  decrement: (id: string) => Promise<void>;
  resetToday: (id: string) => Promise<void>;

  createHabit: (input: NewHabit) => Promise<void>;
  updateHabit: (id: string, patch: HabitPatch) => Promise<void>;
  archiveHabit: (id: string, active: boolean) => Promise<void>;

  // Edição de passado
  loadMonthValues: (
    year: number,
    monthIdx: number,
  ) => Promise<Record<string, Record<string, number>>>;
  setLogForDate: (habitId: string, date: string, value: number) => Promise<void>;
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
  bad: boolean | null;
  show_on_home: boolean | null;
  active: boolean;
  sort: number;
  created_at: string;
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
    bad: row.bad ?? false,
    showOnHome: row.show_on_home ?? true,
    active: row.active,
    sort: row.sort,
    createdAt: row.created_at,
  };
}

function genOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Trava de concorrência: garante um único `load()` em voo por vez. Sem ela,
 * duas chamadas paralelas leem count=0 e ambas semeiam → "Água" duplicada. */
let loadInFlight: Promise<void> | null = null;

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
    bad: false,
    show_on_home: true,
    sort: 0,
  });
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  allHabits: [],
  todayLogs: {},
  windowByHabit: {},
  loading: false,
  loaded: false,

  load: async () => {
    // Reusa o load em voo: evita semeadura dupla por chamadas concorrentes.
    if (loadInFlight) return loadInFlight;
    loadInFlight = get()._load();
    try {
      await loadInFlight;
    } finally {
      loadInFlight = null;
    }
  },

  _load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    // 1) drenar deltas offline pendentes antes de ler o estado do servidor
    await drainHabitQueue(flushDeltas);

    // 2) semear defaults só se a leitura tiver sucesso E não houver nenhum
    //    hábito. Em erro, `count` vem null; semear nesse caso duplicaria a Água.
    const { count, error: countError } = await supabase
      .from('habits')
      .select('id', { count: 'exact', head: true });
    if (!countError && count === 0) {
      await seedDefaults(userId);
    }

    // 3) hábitos ativos
    const { data: rows } = await supabase
      .from('habits')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    const habits = (rows ?? []).map(toHabit);

    // 4) logs da janela (base do streak); o valor de hoje sai da mesma leitura
    const today = localDateStr();
    const since = localDateStr(
      new Date(Date.now() - (HABIT_WINDOW_DAYS - 1) * 86400000),
    );
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, value')
      .gte('log_date', since);

    const windowByHabit: Record<string, Record<string, number>> = {};
    const todayLogs: Record<string, number> = {};
    for (const l of logs ?? []) {
      const hid = l.habit_id as string;
      const date = l.log_date as string;
      const value = Number(l.value);
      (windowByHabit[hid] ??= {})[date] = value;
      if (date === today) todayLogs[hid] = value;
    }

    set({ habits, todayLogs, windowByHabit, loading: false, loaded: true });
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
      bad: input.bad,
      show_on_home: input.showOnHome,
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

  // Valores de um mês: habitId → (data → valor). Também mescla na janela em cache
  // (windowByHabit) para o que estiver dentro dela. Caminho online direto.
  loadMonthValues: async (year, monthIdx) => {
    if (!currentUserId()) return {};
    const from = localDateStr(new Date(year, monthIdx, 1));
    const to = localDateStr(new Date(year, monthIdx + 1, 0));
    const { data } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, value')
      .gte('log_date', from)
      .lte('log_date', to);

    const byHabit: Record<string, Record<string, number>> = {};
    for (const l of data ?? []) {
      const hid = l.habit_id as string;
      (byHabit[hid] ??= {})[l.log_date as string] = Number(l.value);
    }

    set((s) => {
      const merged: Record<string, Record<string, number>> = { ...s.windowByHabit };
      for (const [hid, byDate] of Object.entries(byHabit)) {
        merged[hid] = { ...(merged[hid] ?? {}), ...byDate };
      }
      return { windowByHabit: merged };
    });
    return byHabit;
  },

  // Fixa o valor absoluto de um dia (edição de passado) via rpc compartilhada.
  setLogForDate: async (habitId, date, value) => {
    await supabase.rpc('habit_log_set', {
      p_habit: habitId,
      p_date: date,
      p_value: value,
    });
    const today = localDateStr();
    set((s) => ({
      windowByHabit: {
        ...s.windowByHabit,
        [habitId]: { ...(s.windowByHabit[habitId] ?? {}), [date]: value },
      },
      todayLogs: date === today ? { ...s.todayLogs, [habitId]: value } : s.todayLogs,
    }));
  },
}));
