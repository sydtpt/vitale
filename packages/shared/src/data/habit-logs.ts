/**
 * Acesso à tabela `habit_logs` — dono único (AD-4).
 *
 * Escrever **não** passa por aqui: vai pelas RPCs `habit_log_add` (incremento do
 * dia) e `habit_log_set` (fixar valor, edição de passado), que resolvem
 * concorrência no banco. Este módulo é de leitura.
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

/** Registros num intervalo fechado de datas — base do heatmap mensal. */
export async function fetchHabitLogsBetween(
  db: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<HabitLog[]> {
  const { data, error } = await db
    .from('habit_logs')
    .select('id,habit_id,log_date,value')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to);
  if (error) throw error;
  return ((data ?? []) as HabitLogRow[]).map(toHabitLog);
}

/** Registros desde `since`, em ordem cronológica. */
export async function fetchHabitLogsSinceOrdered(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HabitLog[]> {
  const { data, error } = await db
    .from('habit_logs')
    .select('id,habit_id,log_date,value')
    .eq('user_id', userId)
    .gte('log_date', since)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as HabitLogRow[]).map(toHabitLog);
}
