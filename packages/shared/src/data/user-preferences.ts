/**
 * Acesso à tabela `user_preferences` — dono único (AD-4).
 *
 * **`select('*')` é deliberado aqui, não descuido.** Esta é a tabela que mais
 * ganha coluna, e listar colunas explicitamente faz o PostgREST rejeitar a
 * query INTEIRA quando uma migration recente ainda não foi aplicada — o app
 * perderia até `map_style` por causa de um campo novo que nem usa. É exceção
 * consciente à regra de colunas explícitas, que vale para tabelas de payload
 * grande como `activity_routes`, não para esta.
 *
 * Devolve a linha crua de propósito: cada app resolve os defaults com os seus
 * `resolve*` (mapStyle, wallpaper, notificationPrefs), que dependem de
 * constantes de plataforma. O que é comum — a leitura e a escrita — mora aqui.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Linha crua de preferências; as colunas variam com as migrations aplicadas. */
export type UserPreferencesRow = Record<string, unknown> & { id: string };

/** Preferências do usuário; `null` quando ainda não foram gravadas. */
export async function fetchUserPreferencesRow(
  db: SupabaseClient,
  userId: string,
): Promise<UserPreferencesRow | null> {
  const { data, error } = await db
    .from('user_preferences')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserPreferencesRow | null) ?? null;
}

/** Grava as preferências por inteiro. O `id` é o do usuário. */
export async function upsertUserPreferences(
  db: SupabaseClient,
  userId: string,
  row: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from('user_preferences').upsert({ ...row, id: userId });
  if (error) throw error;
}
