/**
 * Cursor de sincronização da saúde, persistido por usuário. Local ao dispositivo.
 * Guarda o último dia sincronizado e a VERSÃO da lógica de agregação já aplicada
 * — bump da versão força um re-backfill único (ex.: correção do sono), sem
 * intervenção manual.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const keyFor = (userId: string) => `vitale:health-cursor:${userId}`;

export interface HealthCursor {
  /** Último dia 'YYYY-MM-DD' sincronizado com sucesso (null = nunca). */
  lastDay: string | null;
  /** Versão da agregação já gravada para este dispositivo. */
  version: number;
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
