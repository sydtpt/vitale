/**
 * Fila offline de escritas pendentes (FR-010). Persistida via AsyncStorage.
 * Em falha de rede, as linhas ficam enfileiradas e são reprocessadas no
 * próximo ciclo de sync (foreground/observer) até drenarem.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';
import type { ActivityRow, ActivityRouteRow } from './activity-map';

export type QueueItem =
  | { kind: 'activity'; row: ActivityRow }
  | { kind: 'route'; row: ActivityRouteRow };

const KEY = 'vitale:sync-queue';

export async function readQueue(store: KVStore = asyncStore): Promise<QueueItem[]> {
  return (await getJSON<QueueItem[]>(KEY, store)) ?? [];
}

/** Acrescenta itens à fila, deduplicando por (kind, id). */
export async function enqueue(items: QueueItem[], store: KVStore = asyncStore): Promise<void> {
  if (items.length === 0) return;
  const current = await readQueue(store);
  const seen = new Set(current.map(keyOf));
  const merged = [...current];
  for (const item of items) {
    const k = keyOf(item);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(item);
    }
  }
  await setJSON(KEY, merged, store);
}

export async function clearQueue(store: KVStore = asyncStore): Promise<void> {
  await setJSON<QueueItem[]>(KEY, [], store);
}

/**
 * Tenta enviar tudo via `flush`, que devolve os itens que FALHARAM (a manter).
 * Persiste os que sobraram e retorna quantos foram drenados.
 */
export async function drainQueue(
  flush: (items: QueueItem[]) => Promise<QueueItem[]>,
  store: KVStore = asyncStore
): Promise<number> {
  const items = await readQueue(store);
  if (items.length === 0) return 0;
  const failed = await flush(items);
  await setJSON(KEY, failed, store);
  return items.length - failed.length;
}

function keyOf(item: QueueItem): string {
  return item.kind === 'activity' ? `a:${item.row.id}` : `r:${item.row.activity_id}`;
}
