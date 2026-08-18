import { create } from 'zustand';
import { fetchDailyRatingsSince, setDayRating, setSleepRating } from '@vitale/shared';
import type { DailyRating } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { localDateStr } from '@vitale/shared';

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

/**
 * Dia (YYYY-MM-DD) que o rating "do dia" avalia, conforme a janela noturna:
 * - 22h–23h59 → o próprio dia corrente;
 * - 00h–04h59 → o dia anterior (madrugada ainda é "o dia que terminou");
 * - fora disso → null (card não deve aparecer).
 */
export function dayRatingDate(now: Date = new Date()): string | null {
  const h = now.getHours();
  if (h >= 22) return localDateStr(now);
  if (h < 5) return localDateStr(new Date(now.getTime() - 86_400_000));
  return null;
}

export const useDailyRatingsStore = create<DailyRatingsState>((set, get) => ({
  today: null,
  window: {},
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    const today = localDateStr();
    const since = localDateStr(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));
    const ratings = await fetchDailyRatingsSince(supabase, userId, since);

    const window: Record<string, DailyRating> = {};
    for (const r of ratings) window[r.day] = r;

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

    try {
      await setSleepRating(supabase, userId, day, value);
    } catch {
      set({ today: prevToday, window: prevWindow });
    }
  },

  setDay: async (value, note) => {
    const userId = currentUserId();
    if (!userId) return;
    // Na madrugada (00h–04h59) o rating do dia pertence ao dia anterior, não ao
    // dia de calendário corrente; dayRatingDate resolve isso (fallback = hoje).
    const day = dayRatingDate() ?? localDateStr();
    const prevToday = get().today;
    const prevWindow = get().window;
    const cleanNote = note?.trim() ? note.trim() : null;

    // otimista — base vem da janela do dia avaliado (pode ser ontem na madrugada)
    const next = mergeToday(prevWindow[day] ?? null, day, { dayQuality: value, dayNote: cleanNote });
    const isToday = day === localDateStr();
    set({ today: isToday ? next : prevToday, window: { ...prevWindow, [day]: next } });

    try {
      await setDayRating(supabase, userId, day, value, cleanNote);
    } catch {
      set({ today: prevToday, window: prevWindow });
    }
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
