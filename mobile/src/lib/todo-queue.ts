/**
 * Fila offline de resoluções de tarefas (marcar feita/pulada/cancelada/expirada).
 * Persistida via AsyncStorage. Cada item é identificado por `opId` (dedup) e
 * aplicado via rpc `todo_resolve` (set de status idempotente por ocorrência).
 * Modelada em [habit-queue.ts](./habit-queue.ts).
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';
import type { TodoStatus } from '@vitale/shared';

export interface TodoResolveOp {
  opId: string; // id único da operação (dedup)
  occId: string;
  status: TodoStatus;
  meta?: Record<string, unknown> | null;
}

const KEY = 'vitale:todo-queue';

export async function readTodoQueue(store: KVStore = asyncStore): Promise<TodoResolveOp[]> {
  return (await getJSON<TodoResolveOp[]>(KEY, store)) ?? [];
}

/** Acrescenta uma resolução à fila, deduplicando por `opId`. */
export async function enqueueResolve(item: TodoResolveOp, store: KVStore = asyncStore): Promise<void> {
  const current = await readTodoQueue(store);
  if (current.some((d) => d.opId === item.opId)) return;
  await setJSON(KEY, [...current, item], store);
}

export async function clearTodoQueue(store: KVStore = asyncStore): Promise<void> {
  await setJSON<TodoResolveOp[]>(KEY, [], store);
}

/**
 * Envia tudo via `flush` (FIFO), que devolve os itens que FALHARAM (a manter).
 * Persiste os que sobraram e retorna quantos drenaram.
 */
export async function drainTodoQueue(
  flush: (items: TodoResolveOp[]) => Promise<TodoResolveOp[]>,
  store: KVStore = asyncStore,
): Promise<number> {
  const items = await readTodoQueue(store);
  if (items.length === 0) return 0;
  const failed = await flush(items);
  await setJSON(KEY, failed, store);
  return items.length - failed.length;
}
