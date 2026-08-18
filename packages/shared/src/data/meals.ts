/**
 * Acesso à tabela `meals` — dono único (AD-4).
 *
 * Refeição é registro de captura rápida: nome, tipo e macros opcionais. Os
 * macros vêm nulos na maioria das linhas porque o QuickAdd do mobile só pede
 * nome e tipo — quem quiser precisão preenche depois.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MealLog, MealType } from '../models';

const COLUMNS = 'id,meal_date,meal_type,name,kcal,protein,carbs,fat,logged_at';

export interface MealRow {
  id: string;
  meal_date: string;
  meal_type: MealType;
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  logged_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toMealLog(r: MealRow): MealLog {
  return {
    id: r.id,
    mealDate: r.meal_date,
    mealType: r.meal_type,
    name: r.name,
    kcal: r.kcal ?? undefined,
    protein: r.protein ?? undefined,
    carbs: r.carbs ?? undefined,
    fat: r.fat ?? undefined,
    loggedAt: r.logged_at,
  };
}

/** Refeições de um dia, na ordem em que foram registradas. */
export async function fetchMealsOnDay(
  db: SupabaseClient,
  userId: string,
  day: string,
): Promise<MealLog[]> {
  const { data, error } = await db
    .from('meals')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('meal_date', day)
    .order('logged_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as MealRow[]).map(toMealLog);
}

/** Registra uma refeição e devolve o modelo criado. */
export async function createMeal(
  db: SupabaseClient,
  userId: string,
  input: { mealDate: string; mealType: MealType; name: string; kcal?: number | null },
): Promise<MealLog> {
  const { data, error } = await db
    .from('meals')
    .insert({
      user_id: userId,
      meal_date: input.mealDate,
      meal_type: input.mealType,
      name: input.name,
      kcal: input.kcal ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toMealLog(data as MealRow);
}
