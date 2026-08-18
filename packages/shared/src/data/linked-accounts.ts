/**
 * Acesso à tabela `linked_accounts` — dono único (AD-4).
 *
 * Uma linha por provedor vinculado (Strava, intervals.icu). O **vínculo** é
 * criado pelas edge functions, que detêm os segredos do OAuth — daqui só se lê
 * e se desvincula. Por isso não há `create`: criar exige token que o cliente
 * não tem nem deve ter (AD-6).
 *
 * `athlete_meta` fica de fora do SELECT de propósito: é payload do provedor e
 * carrega o `max_hr` default de 210 do intervals, que já causou a distorção
 * corrigida na ADR 0001. Quem precisa de FC máxima lê `user_preferences`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LinkedAccount } from '../models';

const COLUMNS =
  'user_id,provider,status,athlete_id,athlete_name,backfill_done,last_sync_at,last_error,connected_at';

export interface LinkedAccountRow {
  user_id: string;
  provider: string;
  status: string;
  athlete_id: string | null;
  athlete_name: string | null;
  backfill_done: boolean | null;
  last_sync_at: string | null;
  last_error: string | null;
  connected_at: string | null;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toLinkedAccount(r: LinkedAccountRow): LinkedAccount {
  return {
    userId: r.user_id,
    provider: r.provider as LinkedAccount['provider'],
    status: r.status as LinkedAccount['status'],
    athleteId: r.athlete_id ?? undefined,
    athleteName: r.athlete_name ?? undefined,
    backfillDone: r.backfill_done ?? false,
    lastSyncAt: r.last_sync_at ?? undefined,
    lastError: r.last_error ?? undefined,
    connectedAt: r.connected_at ?? undefined,
  };
}

/** Contas vinculadas do usuário, em ordem de provedor. */
export async function fetchLinkedAccounts(
  db: SupabaseClient,
  userId: string,
): Promise<LinkedAccount[]> {
  const { data, error } = await db
    .from('linked_accounts')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('provider');
  if (error) throw error;
  return ((data ?? []) as LinkedAccountRow[]).map(toLinkedAccount);
}

/** Provedores conectados e quando, para calcular janelas de cobertura. */
export async function fetchConnectedProviders(
  db: SupabaseClient,
  userId: string,
): Promise<Array<{ provider: string; connectedAt: string | null }>> {
  const { data, error } = await db
    .from('linked_accounts')
    .select('provider,connected_at')
    .eq('user_id', userId)
    .eq('status', 'connected');
  if (error) throw error;
  return ((data ?? []) as Array<{ provider: string; connected_at: string | null }>).map((r) => ({
    provider: r.provider,
    connectedAt: r.connected_at,
  }));
}

/** Desvincula um provedor. Os treinos já ingeridos permanecem. */
export async function deleteLinkedAccount(
  db: SupabaseClient,
  userId: string,
  provider: string,
): Promise<void> {
  const { error } = await db
    .from('linked_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
  if (error) throw error;
}
