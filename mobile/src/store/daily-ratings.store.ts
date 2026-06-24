import { create } from 'zustand';
import type { DailyRating } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/habit-logic';
import { useAuthStore } from './auth.store';

/** Janela (em dias) de ratings mantida em memória — cobre semana atual + anterior do recap. */
const WINDOW_DAYS = 21;

export type RatingKind = 'sleep' | 'day';

interface DailyRatingsState {
  today: DailyRating | null;             // rating de hoje (ou null se ainda não há linha)
  window: Record<string, DailyRating>;   // dia (YYYY-MM-DD) → rating, últimos WINDOW_DAYS
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  setSleep: (value: number) => Promise<void>;
  setDay: (value: number, note?: string | null) => Promise<void>;

  /** Mapa dia → valor (1–5) de um tipo, para alimentar metricRecap no recap da Semana. */
  valuesByDay: (kind: RatingKind) => Map<string, number>;
}

type DbRow = {
  day: string;
  sleep_quality: number | null;
  day_quality: number | null;
  day_note: string | null;
};

function toRating(row: DbRow): DailyRating {
  return {
    day: row.day,
    sleepQuality: row.sleep_quality,
    dayQuality: row.day_quality,
    dayNote: row.day_note,
  };
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** Funde patch no rating do dia, preservando os demais campos. */
function mergeToday(prev: DailyRating | null, day: string, patch: Partial<DailyRating>): DailyRating {
  const base: DailyRating = prev ?? { day, sleepQuality: null, dayQuality: null, dayNote: null };
  return { ...base, ...patch, day };
}

export const useDailyRatingsStore = create<DailyRatingsState>((set, get) => ({
  today: null,
  window: {},
  loading: false,
  loaded: false,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const today = localDateStr();
    const since = localDateStr(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));
    const { data } = await supabase
      .from('daily_ratings')
      .select('day, sleep_quality, day_quality, day_note')
      .gte('day', since);

    const window: Record<string, DailyRating> = {};
    for (const row of (data ?? []) as DbRow[]) {
      window[row.day] = toRating(row);
    }

    set({ window, today: window[today] ?? null, loading: false, loaded: true });
  },

  setSleep: async (value) => {
    const userId = currentUserId();
    if (!userId) return;
    const day = localDateStr();
    const prevToday = get().today;
    const prevWindow = get().window;

    // otimista
    const next = mergeToday(prevToday, day, { sleepQuality: value });
    set({ today: next, window: { ...prevWindow, [day]: next } });

    const { error } = await supabase
      .from('daily_ratings')
      .upsert({ user_id: userId, day, sleep_quality: value }, { onConflict: 'user_id,day' });

    if (error) set({ today: prevToday, window: prevWindow });
  },

  setDay: async (value, note) => {
    const userId = currentUserId();
    if (!userId) return;
    const day = localDateStr();
    const prevToday = get().today;
    const prevWindow = get().window;
    const cleanNote = note?.trim() ? note.trim() : null;

    // otimista
    const next = mergeToday(prevToday, day, { dayQuality: value, dayNote: cleanNote });
    set({ today: next, window: { ...prevWindow, [day]: next } });

    const { error } = await supabase
      .from('daily_ratings')
      .upsert({ user_id: userId, day, day_quality: value, day_note: cleanNote }, { onConflict: 'user_id,day' });

    if (error) set({ today: prevToday, window: prevWindow });
  },

  valuesByDay: (kind) => {
    const map = new Map<string, number>();
    for (const [day, r] of Object.entries(get().window)) {
      const v = kind === 'sleep' ? r.sleepQuality : r.dayQuality;
      if (v != null) map.set(day, v);
    }
    return map;
  },
}));
