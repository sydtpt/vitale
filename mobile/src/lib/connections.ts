/**
 * Contas vinculadas (Strava, intervals.icu) — leitura de estado e filtro
 * preventivo do sync HealthKit.
 *
 * Quando uma ponte Garmin está conectada, os treinos que o Garmin Connect
 * escreve no HealthKit (stubs sem rota, FC só mín/máx) são DESCARTADOS no sync
 * — a versão rica do mesmo treino chega pela ingestão server-side. O filtro é
 * otimização: o dedupe do ingest é quem garante a unicidade (stubs que passarem
 * são mesclados/varridos lá).
 */
import { isGarminSource, type LinkedAccount } from '@vitale/shared';
import { supabase } from './supabase';
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';
import type { WorkoutItem } from './workout-types';

/** Treino do HealthKit escrito pelo Garmin Connect (stub da ponte). */
export function isGarminHkStub(w: Pick<WorkoutItem, 'sourceId' | 'sourceName'>): boolean {
  return isGarminSource(w.sourceId, w.sourceName);
}

interface DbLinkedAccount {
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

export function mapLinkedAccount(r: DbLinkedAccount): LinkedAccount {
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

/** Contas vinculadas do usuário logado (RLS limita às próprias). */
export async function fetchLinkedAccounts(): Promise<LinkedAccount[]> {
  const { data, error } = await supabase
    .from('linked_accounts')
    .select('user_id,provider,status,athlete_id,athlete_name,backfill_done,last_sync_at,last_error,connected_at')
    .order('provider');
  if (error) throw new Error(error.message);
  return ((data ?? []) as DbLinkedAccount[]).map(mapLinkedAccount);
}

const BRIDGE_CACHE_KEY = 'vitale:garmin-bridge-active';
const BRIDGE_TTL_MS = 5 * 60_000;

let memo: { value: boolean; at: number } | null = null;

/** Força a releitura na próxima chamada (após vincular/desvincular). */
export function invalidateBridgeCache(): void {
  memo = null;
}

/**
 * Há ponte Garmin conectada (Strava OU intervals.icu)? Memo de 5 min +
 * último valor em disco como fallback offline — o sync roda em background e
 * não pode depender de rede para decidir o filtro.
 */
export async function hasActiveGarminBridge(store: KVStore = asyncStore): Promise<boolean> {
  if (memo && Date.now() - memo.at < BRIDGE_TTL_MS) return memo.value;
  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('provider')
      .eq('status', 'connected')
      .limit(1);
    if (error) throw new Error(error.message);
    const value = (data ?? []).length > 0;
    memo = { value, at: Date.now() };
    await setJSON(BRIDGE_CACHE_KEY, value, store);
    return value;
  } catch {
    const cached = await getJSON<boolean>(BRIDGE_CACHE_KEY, store);
    return cached ?? false;
  }
}
