/**
 * Acesso à tabela `synced_activity_types` — dono único (AD-4).
 *
 * Inscrição opt-in por tipo de treino: só os tipos aqui listados são enviados
 * ao Supabase pelo sync. Tabela só do mobile hoje, mas o contrato vive no
 * núcleo como qualquer outro — é o que impede a web de inventar o seu quando
 * precisar da mesma informação.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Labels de tipo inscritos pelo usuário. Conjunto vazio quando não há nenhum. */
export async function fetchSyncedTypes(db: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from('synced_activity_types')
    .select('type_key')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.type_key as string));
}

/** Inscreve um tipo. Idempotente pela chave (user_id, type_key). */
export async function subscribeActivityType(
  db: SupabaseClient,
  userId: string,
  typeKey: string,
): Promise<void> {
  const { error } = await db
    .from('synced_activity_types')
    .upsert({ user_id: userId, type_key: typeKey }, { onConflict: 'user_id,type_key' });
  if (error) throw error;
}

/** Remove a inscrição. Não apaga os treinos já enviados. */
export async function unsubscribeActivityType(
  db: SupabaseClient,
  userId: string,
  typeKey: string,
): Promise<void> {
  const { error } = await db
    .from('synced_activity_types')
    .delete()
    .eq('user_id', userId)
    .eq('type_key', typeKey);
  if (error) throw error;
}
