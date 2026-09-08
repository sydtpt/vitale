/**
 * Cursor de sincronização da saúde, persistido por usuário. Local ao dispositivo.
 * Guarda o último dia sincronizado e a VERSÃO da lógica de agregação já aplicada
 * — bump da versão força um re-backfill único (ex.: correção do sono), sem
 * intervenção manual.
 */
import { AGG_VERSION } from '@vitale/shared';
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const keyFor = (userId: string) => `vitale:health-cursor:${userId}`;

export interface HealthCursor {
  /** Último dia 'YYYY-MM-DD' sincronizado com sucesso (null = nunca). */
  lastDay: string | null;
  /** Versão da agregação já gravada para este dispositivo. */
  version: number;
}

/**
 * O ciclo tem que varrer o histórico, ou basta a janela recente?
 *
 * Extraída de `syncHealth` para poder ser medida sem HealthKit: a decisão é
 * pura, o resto do ciclo não é. Duas portas para o backfill — dispositivo que
 * nunca sincronizou, e agregação que avançou desde a última vez.
 *
 * A segunda porta é cara e dispara sozinha, em todos os dispositivos, no
 * primeiro ciclo depois de um bump de `AGG_VERSION`. Desde que a constante subiu
 * para o núcleo, quem a edita não está mais lendo este arquivo — por isso a
 * conta está escrita no teste que cobre esta função.
 */
export function precisaBackfill(cursor: HealthCursor): boolean {
  return cursor.lastDay == null || cursor.version < AGG_VERSION;
}

export async function readHealthCursor(userId: string, store: KVStore = asyncStore): Promise<HealthCursor> {
  const raw = await getJSON<HealthCursor | string>(keyFor(userId), store);
  if (raw == null) return { lastDay: null, version: 0 };
  // Compat: versões antigas guardavam só a string do último dia.
  if (typeof raw === 'string') return { lastDay: raw, version: 0 };
  return { lastDay: raw.lastDay ?? null, version: raw.version ?? 0 };
}

export async function writeHealthCursor(userId: string, cursor: HealthCursor, store: KVStore = asyncStore): Promise<void> {
  await setJSON(keyFor(userId), cursor, store);
}
