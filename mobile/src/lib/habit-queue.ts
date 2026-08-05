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

/**
 * Trava de concorrência da fila. Toda leitura-modificação-escrita (enqueue) e
 * todo drain rodam em série. Sem ela, dois toques rápidos no "+" se cruzam:
 * o drain do 1º ainda está no ar (não limpou a fila) quando o 2º lê `[d1, d2]`
 * e reenvia `d1` — como o backend SOMA o delta, o valor dobra no servidor.
 */
let queueLock: Promise<unknown> = Promise.resolve();

function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = queueLock.then(fn, fn);
  queueLock = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export async function readHabitQueue(store: KVStore = asyncStore): Promise<HabitDelta[]> {
  return (await getJSON<HabitDelta[]>(KEY, store)) ?? [];
}

/** Acrescenta um delta à fila, deduplicando por `opId`. */
export async function enqueueDelta(item: HabitDelta, store: KVStore = asyncStore): Promise<void> {
  return withQueueLock(async () => {
    const current = await readHabitQueue(store);
    if (current.some((d) => d.opId === item.opId)) return;
    await setJSON(KEY, [...current, item], store);
  });
}

export async function clearHabitQueue(store: KVStore = asyncStore): Promise<void> {
  await setJSON<HabitDelta[]>(KEY, [], store);
}

/**
 * Envia tudo via `flush` (FIFO), que devolve os deltas que FALHARAM (a manter).
 * Persiste os que sobraram e retorna quantos drenaram.
 *
 * Roda sob a trava: um drain concorrente espera o anterior terminar e só então
 * lê a fila — nunca reenvia um delta que já está em voo.
 */
export async function drainHabitQueue(
  flush: (items: HabitDelta[]) => Promise<HabitDelta[]>,
  store: KVStore = asyncStore
): Promise<number> {
  return withQueueLock(async () => {
    const items = await readHabitQueue(store);
    if (items.length === 0) return 0;
    const failed = await flush(items);
    await setJSON(KEY, failed, store);
    return items.length - failed.length;
  });
}
