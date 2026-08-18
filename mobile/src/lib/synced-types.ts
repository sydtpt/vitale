/**
 * Inscrição de tipos de treino (opt-in). O acesso à tabela vive em
 * `@vitale/shared` (`data/synced-activity-types`); aqui fica só a resolução da
 * sessão, que é do app. O cache em memória vive na fitness store.
 */
import {
  fetchSyncedTypes,
  subscribeActivityType,
  unsubscribeActivityType,
} from '@vitale/shared';
import { supabase } from './supabase';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Conjunto de labels inscritos do usuário atual (vazio se sem sessão/erro). */
export async function loadSyncedTypes(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  try {
    return await fetchSyncedTypes(supabase, uid);
  } catch {
    return new Set();
  }
}

/** Inscreve um tipo (idempotente). */
export async function subscribeType(label: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error('Sem sessão para inscrever o tipo.');
  await subscribeActivityType(supabase, uid, label);
}

/** Remove a inscrição de um tipo (não apaga os treinos já enviados). */
export async function unsubscribeType(label: string): Promise<void> {
  const uid = await currentUserId();
  if (!uid) return;
  await unsubscribeActivityType(supabase, uid, label);
}
