import { describe, it, expect, beforeEach } from '@jest/globals';
import { enqueue, readQueue, clearQueue, drainQueue, type QueueItem } from '../sync-queue';
import type { KVStore } from '../local-store';
import type { ActivityRow } from '../activity-map';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

function activityItem(id: string): QueueItem {
  return { kind: 'activity', row: { id } as ActivityRow };
}

describe('sync-queue', () => {
  let store: KVStore;
  beforeEach(() => {
    store = memStore();
  });

  it('enfileira e lê itens', async () => {
    await enqueue([activityItem('a'), activityItem('b')], store);
    const q = await readQueue(store);
    expect(q.map((i) => (i.kind === 'activity' ? i.row.id : ''))).toEqual(['a', 'b']);
  });

  it('deduplica por (kind, id)', async () => {
    await enqueue([activityItem('a')], store);
    await enqueue([activityItem('a'), activityItem('c')], store);
    const q = await readQueue(store);
    expect(q).toHaveLength(2);
  });

  it('drena tudo em sucesso e zera a fila', async () => {
    await enqueue([activityItem('a'), activityItem('b')], store);
    const drained = await drainQueue(async () => [], store); // nada falhou
    expect(drained).toBe(2);
    expect(await readQueue(store)).toHaveLength(0);
  });

  it('mantém na fila o que falhou', async () => {
    await enqueue([activityItem('a'), activityItem('b')], store);
    const drained = await drainQueue(async (items) => items.slice(1), store); // 1º enviou, resto falhou
    expect(drained).toBe(1);
    const q = await readQueue(store);
    expect(q).toHaveLength(1);
    expect(q[0].kind === 'activity' && q[0].row.id).toBe('b');
  });

  it('clearQueue esvazia', async () => {
    await enqueue([activityItem('a')], store);
    await clearQueue(store);
    expect(await readQueue(store)).toHaveLength(0);
  });
});
