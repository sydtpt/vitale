/**
 * Acesso à tabela `habit_logs` — dono único (AD-4).
 *
 * **Parcial.** Hoje cobre só a leitura que as Metas usam; as demais chamadas
 * ainda vivem nos stores de hábitos e migram junto com elas. O módulo existe
 * desde já para que acesso novo tenha onde nascer.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HabitLog } from '../models';

export interface HabitLogRow {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | string | null;
}

/** Linha do Postgres → modelo de domínio. */
export function toHabitLog(r: HabitLogRow): HabitLog {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, value: Number(r.value ?? 0) };
}

/** Registros a partir de `since` (inclusive), em ordem natural do banco. */
export async function fetchHabitLogsSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HabitLog[]> {
  const { data, error } = await db
    .from('habit_logs')
    .select('id,habit_id,log_date,value')
    .eq('user_id', userId)
    .gte('log_date', since);
  if (error) throw error;
  return ((data ?? []) as HabitLogRow[]).map(toHabitLog);
}
