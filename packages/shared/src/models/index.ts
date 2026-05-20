/**
 * Vitale — Domain Models
 * Shared across web & mobile.
 */

export interface Meal {
  id: string;
  name: string;
  time: string;
  kcal: number;
  done: boolean;
  emoji: string;
  items: string;
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  done: boolean;
  streak: number;
}

export interface Chore {
  id: string;
  name: string;
  done: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  qty: string;
  done: boolean;
  cat: string;
}

export interface Treino {
  day: string;
  date: number;
  type: string;
  dur: number;
  vol: number;
  done: boolean;
  rest: boolean;
  planned: boolean;
  run: { dist: number; pace: string } | null;
}

export interface Lift {
  name: string;
  sets: string;
  current: number;
  history: number[];
}

export interface RunWeek {
  week: string;
  km: number;
  runs: number;
}

export interface FinancaCategory {
  cat: string;
  amount: number;
  color: string;
  icon: string;
}

export interface Transaction {
  id: number;
  date: string;
  name: string;
  cat: string;
  amount: number;
}

export interface RecurringItem {
  name: string;
  every: string;
  last: string;
  due: string;
}

export interface CasaTarefa {
  name: string;
  every: string;
  when: string;
}

export interface Meta {
  name: string;
  cat: string;
  progress: number;
  target: string;
  current: string;
}

export interface DayData {
  date: string;
  greeting: string;
  weekDay: string;
  treino: {
    name: string;
    time: string;
    duration: string;
    exercises: number;
    location: string;
  };
  meals: Meal[];
  water: { current: number; goal: number };
  habits: Habit[];
  casa: Chore[];
  compras: ShopItem[];
}

export type WeekDay = 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SÁB' | 'DOM';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

/**
 * Treino sincronizado do HealthKit (push-only). Identidade = ID do HealthKit.
 * Mapeia a tabela `activities` do Supabase.
 */
export interface Activity {
  id: string;
  userId: string;
  activityId: number;
  activityName?: string;
  calories: number;
  startAt: string;
  endAt: string;
  durationS: number;
  distanceM?: number;
  sourceName?: string;
  sourceId?: string;
  device?: string;
  tracked?: boolean;
  hasRoute: boolean;
  metadata?: Record<string, unknown>;
}

export interface ActivityRoutePoint {
  lat: number;
  lng: number;
  alt?: number;
}

/** Rota GPS de um treino outdoor. Mapeia a tabela `activity_routes`. */
export interface ActivityRoute {
  activityId: string;
  points: ActivityRoutePoint[];
  pointCount: number;
}
