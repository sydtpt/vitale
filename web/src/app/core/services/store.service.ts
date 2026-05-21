import { Injectable, computed, signal } from '@angular/core';
import type { Meal, Habit, Chore, ShopItem } from '@vitale/shared';

/**
 * VitaleStore — Signal-based reactive store.
 *
 * Mobile (future PWA) writes here; web reads derived computed signals.
 * One source of truth for the day's check-ins.
 * Replace with a real backend later (Supabase, Firebase, etc).
 */
@Injectable({ providedIn: 'root' })
export class VitaleStore {
  // ─── Day state ─────────────────────────────────
  readonly meals = signal<Meal[]>([]);
  readonly habits = signal<Habit[]>([]);
  readonly home = signal<Chore[]>([]);
  readonly shopping = signal<ShopItem[]>([]);
  readonly water = signal<number>(0);
  readonly workoutDone = signal<boolean>(false);

  // ─── Derived counts ────────────────────────────
  readonly mealsDone = computed(() => this.meals().filter(m => m.done).length);
  readonly habitsDone = computed(() => this.habits().filter(h => h.done).length);
  readonly homeDone = computed(() => this.home().filter(c => c.done).length);
  readonly shoppingDone = computed(() => this.shopping().filter(c => c.done).length);

  // ─── Day score (0–100) ─────────────────────────
  readonly activityScore = computed(() => (this.workoutDone() ? 100 : 60));

  readonly foodScore = computed(() => {
    const m = this.meals();
    if (m.length === 0) return 0;
    return Math.round(
      (m.filter(x => x.done).length / m.length) * 70 +
      (this.water() / 8) * 30
    );
  });

  readonly mindScore = computed(() => {
    const h = this.habits();
    if (h.length === 0) return 0;
    return Math.round((h.filter(x => x.done).length / h.length) * 100);
  });

  readonly overallScore = computed(() =>
    Math.round(
      (this.activityScore() + this.foodScore() + this.mindScore()) / 3
    )
  );

  // ─── Mutations ─────────────────────────────────
  toggleMeal(id: string) {
    this.meals.update(arr =>
      arr.map(x => (x.id === id ? { ...x, done: !x.done } : x))
    );
  }

  toggleHabit(id: string) {
    this.habits.update(arr =>
      arr.map(x => (x.id === id ? { ...x, done: !x.done } : x))
    );
  }

  toggleHome(id: string) {
    this.home.update(arr =>
      arr.map(x => (x.id === id ? { ...x, done: !x.done } : x))
    );
  }

  toggleShopping(id: string) {
    this.shopping.update(arr =>
      arr.map(x => (x.id === id ? { ...x, done: !x.done } : x))
    );
  }

  setWater(n: number) {
    this.water.set(Math.max(0, Math.min(8, n)));
  }

  toggleWorkout() {
    this.workoutDone.update(v => !v);
  }

  // ─── Initialization ────────────────────────────
  loadDay(data: {
    meals: Meal[];
    habits: Habit[];
    home: Chore[];
    shopping: ShopItem[];
    water: number;
  }) {
    this.meals.set(structuredClone(data.meals));
    this.habits.set(structuredClone(data.habits));
    this.home.set(structuredClone(data.home));
    this.shopping.set(structuredClone(data.shopping));
    this.water.set(data.water);
    this.workoutDone.set(false);
  }
}
