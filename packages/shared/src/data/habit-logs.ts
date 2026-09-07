/**
 * Acesso à tabela `habit_logs` — dono único (AD-4).
 *
 * Escrever **não** passa por aqui: vai pelas RPCs `habit_log_add` (incremento do
 * dia) e `habit_log_set` (fixar valor, edição de passado), que resolvem
 * concorrência no banco. Este módulo é de leitura.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HabitLog } from '../models';
import { fetchAllPages } from './paginate';

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
  const data = await fetchAllPages<HabitLogRow>((lo, hi) =>
    db
      .from('habit_logs')
      .select('id,habit_id,log_date,value')
      .eq('user_id', userId)
      .gte('log_date', since)
      .order('log_date', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  return data.map(toHabitLog);
}

/** Registros num intervalo fechado de datas — base do heatmap mensal. */
export async function fetchHabitLogsBetween(
  db: SupabaseClient,
  userId: string,
  from: string,
  to: string,
): Promise<HabitLog[]> {
  const data = await fetchAllPages<HabitLogRow>((lo, hi) =>
    db
      .from('habit_logs')
      .select('id,habit_id,log_date,value')
      .eq('user_id', userId)
      .gte('log_date', from)
      .lte('log_date', to)
      .order('log_date', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  return data.map(toHabitLog);
}

/**
 * Histórico completo de **um** hábito, em ordem cronológica.
 *
 * As demais leituras deste módulo trazem todos os hábitos numa janela (90 dias
 * no mobile) porque é o que a captura precisa. O detalhe pergunta outra coisa —
 * "quanto, desde sempre" — e uma janela responderia errado no período 'sempre'
 * e em qualquer ano navegado para trás. Por hábito e sem piso de data, porque o
 * recorte é a coluna `habit_id`, não o tempo.
 */
export async function fetchHabitLogHistory(
  db: SupabaseClient,
  userId: string,
  habitId: string,
): Promise<HabitLog[]> {
  const data = await fetchAllPages<HabitLogRow>((lo, hi) =>
    db
      .from('habit_logs')
      .select('id,habit_id,log_date,value')
      .eq('user_id', userId)
      .eq('habit_id', habitId)
      .order('log_date', { ascending: true })
      .range(lo, hi),
  );
  return data.map(toHabitLog);
}

/** Registros desde `since`, em ordem cronológica. */
export async function fetchHabitLogsSinceOrdered(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HabitLog[]> {
  const data = await fetchAllPages<HabitLogRow>((lo, hi) =>
    db
      .from('habit_logs')
      .select('id,habit_id,log_date,value')
      .eq('user_id', userId)
      .gte('log_date', since)
      .order('log_date', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  return data.map(toHabitLog);
}
