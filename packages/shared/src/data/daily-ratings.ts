/**
 * Acesso à tabela `daily_ratings` — dono único (AD-4).
 *
 * Avaliação subjetiva do dia: sono ao acordar e o dia como um todo, 1..5. Uma
 * linha por (usuário, dia), com upsert parcial — o sono é registrado de manhã e
 * o dia à noite, então cada escrita toca só a sua coluna e não pode zerar a
 * outra.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DailyRating } from '../models';

const COLUMNS = 'day,sleep_quality,day_quality,day_note';

export interface DailyRatingRow {
  day: string;
  sleep_quality: number | null;
  day_quality: number | null;
  day_note?: string | null;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toDailyRating(r: DailyRatingRow): DailyRating {
  return {
    day: r.day,
    sleepQuality: r.sleep_quality,
    dayQuality: r.day_quality,
    dayNote: r.day_note ?? null,
  };
}

/** Avaliações desde `since`, em ordem cronológica. */
export async function fetchDailyRatingsSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<DailyRating[]> {
  const { data, error } = await db
    .from('daily_ratings')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('day', since)
    .order('day', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DailyRatingRow[]).map(toDailyRating);
}

/** Só as duas notas — para agregados que não precisam da anotação. */
export async function fetchDailyRatingScores(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<Array<{ day: string; sleepQuality: number | null; dayQuality: number | null }>> {
  const { data, error } = await db
    .from('daily_ratings')
    .select('day,sleep_quality,day_quality')
    .eq('user_id', userId)
    .gte('day', since);
  if (error) throw error;
  return ((data ?? []) as DailyRatingRow[]).map((r) => ({
    day: r.day,
    sleepQuality: r.sleep_quality,
    dayQuality: r.day_quality,
  }));
}

/**
 * Grava a nota do sono do dia. Upsert parcial: não toca `day_quality`, porque
 * o sono é avaliado de manhã e o dia só à noite.
 */
export async function setSleepRating(
  db: SupabaseClient,
  userId: string,
  day: string,
  value: number | null,
): Promise<void> {
  const { error } = await db
    .from('daily_ratings')
    .upsert({ user_id: userId, day, sleep_quality: value }, { onConflict: 'user_id,day' });
  if (error) throw error;
}

/** Grava a nota do dia e a anotação. Não toca `sleep_quality`. */
export async function setDayRating(
  db: SupabaseClient,
  userId: string,
  day: string,
  value: number | null,
  note: string | null,
): Promise<void> {
  const { error } = await db
    .from('daily_ratings')
    .upsert(
      { user_id: userId, day, day_quality: value, day_note: note },
      { onConflict: 'user_id,day' },
    );
  if (error) throw error;
}
