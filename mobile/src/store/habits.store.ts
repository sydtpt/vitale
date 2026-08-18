import { create } from 'zustand';
import {
  countHabits,
  createHabit,
  fetchHabitLogsBetween,
  fetchHabitLogsSince,
  fetchHabits,
  setHabitActive,
  updateHabit,
} from '@vitale/shared';
import type { CounterHabit, HabitDirection } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import {
  enqueueDelta,
  drainHabitQueue,
  type HabitDelta,
} from '../lib/habit-queue';
import { useAuthStore } from './auth.store';
import { localDateStr } from '@vitale/shared';

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

function genOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Trava de concorrência: garante um único `load()` em voo por vez. Sem ela,
 * duas chamadas paralelas leem count=0 e ambas semeiam → "Água" duplicada. */
let loadInFlight: Promise<void> | null = null;

/** Relógio lógico de mutações locais (increment/decrement/reset) por hábito.
 * Um `load()` que começou a ler ANTES do toque não pode sobrescrever o valor
 * otimista — o servidor ainda não tinha o delta, e ver o valor "voltar" faz o
 * usuário tocar de novo, aí sim dobrando o total. */
let mutationSeq = 0;
const lastMutation = new Map<string, number>();

function markMutation(habitId: string): void {
  lastMutation.set(habitId, ++mutationSeq);
}

/** true se o hábito foi tocado depois de `seq` (leitura do servidor está velha). */
function mutatedSince(habitId: string, seq: number): boolean {
  return (lastMutation.get(habitId) ?? 0) > seq;
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** Envia os deltas pendentes via rpc; devolve os que falharam (a manter na fila).
 * Deltas do mesmo (hábito, dia) vão somados numa única chamada — uma sequência
 * rápida de toques custa um round-trip, não um por toque. */
async function flushDeltas(items: HabitDelta[]): Promise<HabitDelta[]> {
  const groups = new Map<string, HabitDelta[]>();
  for (const it of items) {
    const key = `${it.habitId}|${it.date}`;
    const group = groups.get(key);
    if (group) group.push(it);
    else groups.set(key, [it]);
  }

  const failed: HabitDelta[] = [];
  for (const group of groups.values()) {
    const total = group.reduce((sum, it) => sum + it.delta, 0);
    const { error } = await supabase.rpc('habit_log_add', {
      p_habit: group[0].habitId,
      p_date: group[0].date,
      p_delta: total,
    });
    if (error) failed.push(...group);
  }
  return failed;
}

/** Hábito-semente: substitui a água mock por um contador real (spec §9). */
async function seedDefaults(userId: string): Promise<void> {
  await createHabit(supabase, userId, {
    name: 'Água',
    icon: 'water',
    color: 'agua',
    unit: 'L',
    step: 0.25,
    target: 4,
    direction: 'at_least',
    bad: false,
    showOnHome: true,
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

    // Marca d'água tirada ANTES do drain: qualquer toque a partir daqui pode não
    // aparecer na leitura do servidor lá embaixo (ver o merge no fim).
    const readSeq = mutationSeq;

    // 1) drenar deltas offline pendentes antes de ler o estado do servidor
    await drainHabitQueue(flushDeltas);

    // 2) semear defaults só se a leitura tiver sucesso E não houver nenhum
    //    hábito. Em erro, `count` vem null; semear nesse caso duplicaria a Água.
    // Em erro a contagem lança; semear às cegas duplicaria a Água.
    try {
      if ((await countHabits(supabase, userId)) === 0) await seedDefaults(userId);
    } catch {
      /* leitura falhou: não semeia */
    }

    // 3) hábitos ativos
    const habits = (await fetchHabits(supabase, userId)).filter((h) => h.active);

    // 4) logs da janela (base do streak); o valor de hoje sai da mesma leitura
    const today = localDateStr();
    const since = localDateStr(
      new Date(Date.now() - (HABIT_WINDOW_DAYS - 1) * 86400000),
    );
    const logs = await fetchHabitLogsSince(supabase, userId, since);

    const windowByHabit: Record<string, Record<string, number>> = {};
    const todayLogs: Record<string, number> = {};
    for (const l of logs) {
      const hid = l.habitId;
      const date = l.logDate;
      const value = l.value;
      (windowByHabit[hid] ??= {})[date] = value;
      if (date === today) todayLogs[hid] = value;
    }

    // Hábitos tocados durante a leitura mantêm o valor otimista local; o delta
    // já está na fila e será confirmado pelo próximo drain.
    set((s) => {
      const merged = { ...todayLogs };
      for (const id of lastMutation.keys()) {
        if (mutatedSince(id, readSeq)) merged[id] = s.todayLogs[id] ?? merged[id] ?? 0;
      }
      return { habits, todayLogs: merged, windowByHabit, loading: false, loaded: true };
    });
  },

  // Carrega todos os hábitos (ativos + arquivados) para a tela de gestão;
  // de quebra, mantém a lista de captura (`habits`) coerente.
  loadAll: async () => {
    if (!currentUserId()) return;
    const uid0 = currentUserId();
    const all = uid0 ? await fetchHabits(supabase, uid0) : [];
    set({ allHabits: all, habits: all.filter((h) => h.active) });
  },

  increment: async (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const today = localDateStr();
    const next = (get().todayLogs[id] ?? 0) + habit.step;
    markMutation(id);
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
    markMutation(id);
    set((s) => ({ todayLogs: { ...s.todayLogs, [id]: next } }));
    await enqueueDelta({ opId: genOpId(), habitId: id, date: today, delta: -habit.step });
    await drainHabitQueue(flushDeltas);
  },

  resetToday: async (id) => {
    const current = get().todayLogs[id] ?? 0;
    if (current <= 0) return;
    const today = localDateStr();
    markMutation(id);
    set((s) => ({ todayLogs: { ...s.todayLogs, [id]: 0 } }));
    await enqueueDelta({ opId: genOpId(), habitId: id, date: today, delta: -current });
    await drainHabitQueue(flushDeltas);
  },

  createHabit: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const list = get().allHabits.length ? get().allHabits : get().habits;
    const sort = list.reduce((max, h) => Math.max(max, h.sort), -1) + 1;
    await createHabit(supabase, userId, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      unit: input.unit,
      step: input.step,
      target: input.target ?? null,
      direction: input.direction,
      bad: input.bad,
      showOnHome: input.showOnHome,
      sort,
    });
    await get().loadAll();
  },

  updateHabit: async (id, patch) => {
    await updateHabit(supabase, id, patch);
    await get().loadAll();
  },

  archiveHabit: async (id, active) => {
    await setHabitActive(supabase, id, active);
    await get().loadAll();
  },

  // Valores de um mês: habitId → (data → valor). Também mescla na janela em cache
  // (windowByHabit) para o que estiver dentro dela. Caminho online direto.
  loadMonthValues: async (year, monthIdx) => {
    if (!currentUserId()) return {};
    const from = localDateStr(new Date(year, monthIdx, 1));
    const to = localDateStr(new Date(year, monthIdx + 1, 0));
    const uidM = currentUserId();
    const data = uidM ? await fetchHabitLogsBetween(supabase, uidM, from, to) : [];

    const byHabit: Record<string, Record<string, number>> = {};
    for (const l of data) {
      (byHabit[l.habitId] ??= {})[l.logDate] = l.value;
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
