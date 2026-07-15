import { create } from 'zustand';
import type { MealLog, MealType } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/habit-logic';
import { useAuthStore } from './auth.store';

/** Campos de uma refeição nova capturada pelo QuickAddSheet. */
export interface NewMeal {
  mealType: MealType;
  name: string;
  kcal?: number;
}

interface MealsState {
  todayMeals: MealLog[];     // refeições logadas hoje (data local), ordenadas por horário
  loading: boolean;
  loaded: boolean;

  /** Total de kcal registrado hoje (0 quando ausente). */
  todayKcal: number;

  load: () => Promise<void>;
  createMeal: (input: NewMeal) => Promise<boolean>;
}

type MealRow = {
  id: string;
  meal_date: string;
  meal_type: MealType;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  logged_at: string;
};

function toMeal(row: MealRow): MealLog {
  return {
    id: row.id,
    mealDate: row.meal_date,
    mealType: row.meal_type,
    name: row.name,
    kcal: row.kcal ?? undefined,
    protein: row.protein ?? undefined,
    carbs: row.carbs ?? undefined,
    fat: row.fat ?? undefined,
    loggedAt: row.logged_at,
  };
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

function sumKcal(meals: MealLog[]): number {
  return meals.reduce((total, m) => total + (m.kcal ?? 0), 0);
}

export const useMealsStore = create<MealsState>((set, get) => ({
  todayMeals: [],
  loading: false,
  loaded: false,
  todayKcal: 0,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const today = localDateStr();
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('meal_date', today)
      .order('logged_at', { ascending: true });

    const todayMeals = (data ?? []).map(toMeal);
    set({ todayMeals, todayKcal: sumKcal(todayMeals), loading: false, loaded: true });
  },

  createMeal: async (input) => {
    const userId = currentUserId();
    if (!userId) return false;

    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        meal_date: localDateStr(),
        meal_type: input.mealType,
        name: input.name.trim(),
        kcal: input.kcal ?? null,
      })
      .select('*')
      .single();

    if (error || !data) return false;

    // append otimista (sem recarregar tudo): a refeição é de hoje por definição
    set((s) => {
      const todayMeals = [...s.todayMeals, toMeal(data as MealRow)];
      return { todayMeals, todayKcal: sumKcal(todayMeals) };
    });
    return true;
  },
}));
