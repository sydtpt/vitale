/**
 * Contas vinculadas (Strava, intervals.icu) — leitura de estado e filtro
 * preventivo do sync HealthKit.
 *
 * Treinos que os apps de ponte escrevem no HealthKit (stubs sem rota, FC só
 * mín/máx) são DESCARTADOS no sync quando a versão rica chega pelo ingest
 * server-side — mas SÓ os que estão dentro da janela que o ingest cobre
 * (INITIAL_IMPORT_DAYS antes do vínculo em diante):
 *   - stub do Garmin Connect: qualquer ponte conectada traz o FIT rico;
 *   - cópia do app da Strava: só o vínculo Strava garante a versão rica.
 * Stubs mais antigos que a cobertura continuam sincronizando pelo HealthKit:
 * são a única fonte deles.
 * O filtro é otimização: o dedupe do ingest é quem garante a unicidade.
 */
import { isGarminSource, isStravaSource, type LinkedAccount } from '@vitale/shared';
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

/** Treino do HealthKit escrito pelo app da Strava (cópia sem rota). */
export function isStravaHkStub(w: Pick<WorkoutItem, 'sourceId' | 'sourceName'>): boolean {
  return isStravaSource(w.sourceId, w.sourceName);
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

const COVERAGE_CACHE_KEY = 'vitale:bridge-coverage-v2';
const COVERAGE_TTL_MS = 5 * 60_000;
const DAY_MS = 24 * 3600_000;

export interface BridgeCoverage {
  /** Stubs Garmin: min(connected_at de qualquer ponte) − 90d; null sem ponte. */
  anyStartMs: number | null;
  /** Cópias Strava-HK: connected_at do vínculo Strava − 90d; null sem Strava. */
  stravaStartMs: number | null;
}

const NO_COVERAGE: BridgeCoverage = { anyStartMs: null, stravaStartMs: null };

let memo: { value: BridgeCoverage; at: number } | null = null;

/** Força a releitura na próxima chamada (após vincular/desvincular). */
export function invalidateBridgeCache(): void {
  memo = null;
}

// connected_at nulo (linha antiga) ⇒ assume agora: cobertura menor = mantém mais stubs.
function coverageStart(rows: { connected_at: string | null }[]): number | null {
  if (rows.length === 0) return null;
  const earliest = Math.min(
    ...rows.map((r) => (r.connected_at ? Date.parse(r.connected_at) : Date.now())),
  );
  return earliest - INGEST_COVERAGE_DAYS * DAY_MS;
}

/**
 * Início (epoch ms) da cobertura do ingest server-side, por tipo de stub.
 * Cobertura = INITIAL_IMPORT_DAYS antes do vínculo em diante. Memo de 5 min +
 * último valor em disco como fallback offline — o sync roda em background e
 * não pode depender de rede para decidir o filtro.
 */
export async function bridgeCoverage(store: KVStore = asyncStore): Promise<BridgeCoverage> {
  if (memo && Date.now() - memo.at < COVERAGE_TTL_MS) return memo.value;
  try {
    const { data, error } = await supabase
      .from('linked_accounts')
      .select('provider,connected_at')
      .eq('status', 'connected');
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { provider: string; connected_at: string | null }[];
    const value: BridgeCoverage = {
      anyStartMs: coverageStart(rows),
      stravaStartMs: coverageStart(rows.filter((r) => r.provider === 'strava')),
    };
    memo = { value, at: Date.now() };
    await setJSON(COVERAGE_CACHE_KEY, value, store);
    return value;
  } catch {
    const cached = await getJSON<BridgeCoverage | null>(COVERAGE_CACHE_KEY, store);
    return cached ?? NO_COVERAGE;
  }
}

/**
 * Predicado puro do filtro (testável): true = manter o treino no sync HK.
 * Descarta stubs Garmin (qualquer ponte conectada) e cópias do app da Strava
 * (só com vínculo Strava) cujo início cai dentro da cobertura do ingest.
 */
export function makeStubKeepPredicate(
  coverage: BridgeCoverage,
): (w: Pick<WorkoutItem, 'sourceId' | 'sourceName' | 'start'>) => boolean {
  if (coverage.anyStartMs === null && coverage.stravaStartMs === null) return () => true;
  return (w) => {
    const startMs = Date.parse(w.start);
    if (coverage.anyStartMs !== null && isGarminHkStub(w) && startMs >= coverage.anyStartMs) {
      return false;
    }
    if (coverage.stravaStartMs !== null && isStravaHkStub(w) && startMs >= coverage.stravaStartMs) {
      return false;
    }
    return true;
  };
}

/** Predicado do filtro preventivo já resolvido contra o estado das pontes. */
export async function bridgeStubKeepFilter(
  store: KVStore = asyncStore,
): Promise<(w: Pick<WorkoutItem, 'sourceId' | 'sourceName' | 'start'>) => boolean> {
  return makeStubKeepPredicate(await bridgeCoverage(store));
}
