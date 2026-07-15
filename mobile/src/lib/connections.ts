/**
 * Contas vinculadas (Strava, intervals.icu) — leitura de estado e filtro
 * preventivo do sync HealthKit.
 *
 * Quando uma ponte Garmin está conectada, os treinos que o Garmin Connect
 * escreve no HealthKit (stubs sem rota, FC só mín/máx) são DESCARTADOS no sync
 * — mas SÓ os que estão dentro da janela que o ingest server-side cobre
 * (INITIAL_IMPORT_DAYS antes do vínculo em diante). Stubs mais antigos que a
 * cobertura continuam sincronizando pelo HealthKit: são a única fonte deles.
 * O filtro é otimização: o dedupe do ingest é quem garante a unicidade.
 */
import { isGarminSource, type LinkedAccount } from '@vitale/shared';
import { supabase } from './supabase';
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';
import type { WorkoutItem } from './workout-types';

/**
 * Janela de backfill do ingest server-side, em dias — DEVE casar com
 * INITIAL_IMPORT_DAYS em supabase/functions/_shared/ingest.ts.
 */
export const INGEST_COVERAGE_DAYS = 90;

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

const COVERAGE_CACHE_KEY = 'vitale:garmin-bridge-coverage-ms';
const COVERAGE_TTL_MS = 5 * 60_000;
const DAY_MS = 24 * 3600_000;

let memo: { value: number | null; at: number } | null = null;

/** Força a releitura na próxima chamada (após vincular/desvincular). */
export function invalidateBridgeCache(): void {
  memo = null;
}

/**
 * Início (epoch ms) da cobertura do ingest server-side, ou null sem ponte
 * conectada. Cobertura = INITIAL_IMPORT_DAYS antes do vínculo mais antigo em
 * diante. Memo de 5 min + último valor em disco como fallback offline — o sync
 * roda em background e não pode depender de rede para decidir o filtro.
 */
export async function garminBridgeCoverageStartMs(store: KVStore = asyncStore): Promise<number | null> {
  if (memo && Date.now() - memo.at < COVERAGE_TTL_MS) return memo.value;
  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('connected_at')
      .eq('status', 'connected');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { connected_at: string | null }[];
    let value: number | null = null;
    if (rows.length > 0) {
      // connected_at nulo (linha antiga) ⇒ assume agora: cobertura menor = mantém mais stubs.
      const earliest = Math.min(
        ...rows.map((r) => (r.connected_at ? Date.parse(r.connected_at) : Date.now())),
      );
      value = earliest - INGEST_COVERAGE_DAYS * DAY_MS;
    }
    memo = { value, at: Date.now() };
    await setJSON(COVERAGE_CACHE_KEY, value, store);
    return value;
  } catch {
    const cached = await getJSON<number | null>(COVERAGE_CACHE_KEY, store);
    return cached ?? null;
  }
}

/**
 * Predicado puro do filtro (testável): true = manter o treino no sync HK.
 * Descarta apenas stubs Garmin cujo início cai dentro da cobertura do ingest.
 */
export function makeStubKeepPredicate(
  coverageStartMs: number | null,
): (w: Pick<WorkoutItem, 'sourceId' | 'sourceName' | 'start'>) => boolean {
  if (coverageStartMs === null) return () => true;
  return (w) => !(isGarminHkStub(w) && Date.parse(w.start) >= coverageStartMs);
}

/** Predicado do filtro preventivo já resolvido contra o estado das pontes. */
export async function garminStubKeepFilter(
  store: KVStore = asyncStore,
): Promise<(w: Pick<WorkoutItem, 'sourceId' | 'sourceName' | 'start'>) => boolean> {
  return makeStubKeepPredicate(await garminBridgeCoverageStartMs(store));
}
