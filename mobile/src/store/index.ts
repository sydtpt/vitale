import { create } from 'zustand';
import type { Meal, Habit, Chore, ShopItem } from '@vitale/shared';

interface VitaleState {
  // Day state
  meals: Meal[];
  habits: Habit[];
  casa: Chore[];
  compras: ShopItem[];
  water: number;
  treinoDone: boolean;

  // Derived (computed on access)
  mealsDone: () => number;
  habitsDone: () => number;
  casaDone: () => number;
  comprasDone: () => number;
  activityScore: () => number;
  foodScore: () => number;
  mindScore: () => number;
  overallScore: () => number;

  // Actions
  toggleMeal: (id: string) => void;
  toggleHabit: (id: string) => void;
  toggleCasa: (id: string) => void;
  toggleCompra: (id: string) => void;
  setWater: (n: number) => void;
  toggleTreino: () => void;
  loadDay: (data: {
    meals: Meal[];
    habits: Habit[];
    casa: Chore[];
    compras: ShopItem[];
    water: number;
  }) => void;
}

export const useVitaleStore = create<VitaleState>((set, get) => ({
  meals: [],
  habits: [],
  casa: [],
  compras: [],
  water: 0,
  treinoDone: false,

  // Derived
  mealsDone: () => get().meals.filter(m => m.done).length,
  habitsDone: () => get().habits.filter(h => h.done).length,
  casaDone: () => get().casa.filter(c => c.done).length,
  comprasDone: () => get().compras.filter(c => c.done).length,

  activityScore: () => (get().treinoDone ? 100 : 60),
  foodScore: () => {
    const { meals, water } = get();
    if (meals.length === 0) return 0;
    return Math.round(
      (meals.filter(x => x.done).length / meals.length) * 70 +
      (water / 8) * 30
    );
  },
  mindScore: () => {
    const habits = get().habits;
    if (habits.length === 0) return 0;
    return Math.round((habits.filter(x => x.done).length / habits.length) * 100);
  },
  overallScore: () => {
    const s = get();
    return Math.round((s.activityScore() + s.foodScore() + s.mindScore()) / 3);
  },

  // Actions
  toggleMeal: (id) =>
    set(s => ({ meals: s.meals.map(x => (x.id === id ? { ...x, done: !x.done } : x)) })),
  toggleHabit: (id) =>
    set(s => ({ habits: s.habits.map(x => (x.id === id ? { ...x, done: !x.done } : x)) })),
  toggleCasa: (id) =>
    set(s => ({ casa: s.casa.map(x => (x.id === id ? { ...x, done: !x.done } : x)) })),
  toggleCompra: (id) =>
    set(s => ({ compras: s.compras.map(x => (x.id === id ? { ...x, done: !x.done } : x)) })),
  setWater: (n) =>
    set({ water: Math.max(0, Math.min(8, n)) }),
  toggleTreino: () =>
    set(s => ({ treinoDone: !s.treinoDone })),
  loadDay: (data) =>
    set({
      meals: structuredClone(data.meals),
      habits: structuredClone(data.habits),
      casa: structuredClone(data.casa),
      compras: structuredClone(data.compras),
      water: data.water,
      treinoDone: false,
    }),
}));
