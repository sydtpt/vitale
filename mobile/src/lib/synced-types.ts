/**
 * Inscrição de tipos de treino (opt-in) persistida na tabela
 * `synced_activity_types` do Supabase. Fonte da verdade da inscrição;
 * o cache em memória vive na fitness store.
 */
import { supabase } from './supabase';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Conjunto de labels inscritos do usuário atual (vazio se sem sessão/erro). */
export async function loadSyncedTypes(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  const { data, error } = await supabase
    .from('synced_activity_types')
    .select('type_key')
    .eq('user_id', uid);
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.type_key as string));
}

/** Inscreve um tipo (idempotente). */
export async function subscribeType(label: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Sem sessão para inscrever o tipo.');
  const { error } = await supabase
    .from('synced_activity_types')
    .upsert({ user_id: uid, type_key: label }, { onConflict: 'user_id,type_key' });
  if (error) throw new Error(error.message);
}

/** Remove a inscrição de um tipo (não apaga os treinos já enviados). */
export async function unsubscribeType(label: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await supabase
    .from('synced_activity_types')
    .delete()
    .eq('user_id', uid)
    .eq('type_key', label);
}
