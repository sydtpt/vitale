/**
 * Fila offline de incrementos de hábitos (deltas). Persistida via AsyncStorage.
 * Cada item é uma operação identificada por `opId` (dedup). O backend SOMA o
 * delta (rpc `habit_log_add`), então cada item deve ser aplicado uma única vez:
 * só sai da fila depois que o servidor confirma.
 * Modelado em [sync-queue.ts](./sync-queue.ts).
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

export interface HabitDelta {
  opId: string; // id único da operação (dedup)
  habitId: string;
  date: string; // 'YYYY-MM-DD' local
  delta: number; // +step | -step
}

const KEY = 'vitale:habit-queue';

export async function readHabitQueue(store: KVStore = asyncStore): Promise<HabitDelta[]> {
  return (await getJSON<HabitDelta[]>(KEY, store)) ?? [];
}

/** Acrescenta um delta à fila, deduplicando por `opId`. */
export async function enqueueDelta(item: HabitDelta, store: KVStore = asyncStore): Promise<void> {
  const current = await readHabitQueue(store);
  if (current.some((d) => d.opId === item.opId)) return;
  await setJSON(KEY, [...current, item], store);
}

export async function clearHabitQueue(store: KVStore = asyncStore): Promise<void> {
  await setJSON<HabitDelta[]>(KEY, [], store);
}

/**
 * Envia tudo via `flush` (FIFO), que devolve os deltas que FALHARAM (a manter).
 * Persiste os que sobraram e retorna quantos drenaram.
 */
export async function drainHabitQueue(
  flush: (items: HabitDelta[]) => Promise<HabitDelta[]>,
  store: KVStore = asyncStore
): Promise<number> {
  const items = await readHabitQueue(store);
  if (items.length === 0) return 0;
  const failed = await flush(items);
  await setJSON(KEY, failed, store);
  return items.length - failed.length;
}
