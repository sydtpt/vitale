import { create } from 'zustand';
import { createMeal, fetchMealsOnDay } from '@vitale/shared';
import type { MealLog, MealType } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { localDateStr } from '@vitale/shared';

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
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    const todayMeals = await fetchMealsOnDay(supabase, userId, localDateStr());
    set({ todayMeals, todayKcal: sumKcal(todayMeals), loading: false, loaded: true });
  },

  createMeal: async (input) => {
    const userId = currentUserId();
    if (!userId) return false;

    let meal;
    try {
      meal = await createMeal(supabase, userId, {
        mealDate: localDateStr(),
        mealType: input.mealType,
        name: input.name.trim(),
        kcal: input.kcal,
      });
    } catch {
      return false;
    }

    // append otimista (sem recarregar tudo): a refeição é de hoje por definição
    set((s) => {
      const todayMeals = [...s.todayMeals, meal];
      return { todayMeals, todayKcal: sumKcal(todayMeals) };
    });
    return true;
  },
}));
