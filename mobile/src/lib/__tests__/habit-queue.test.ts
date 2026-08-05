import { describe, it, expect } from '@jest/globals';
import {
  enqueueDelta,
  readHabitQueue,
  clearHabitQueue,
  drainHabitQueue,
  type HabitDelta,
} from '../habit-queue';
import type { KVStore } from '../local-store';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

function delta(opId: string, delta: number): HabitDelta {
  return { opId, habitId: 'h1', date: '2026-05-20', delta };
}

describe('habit-queue', () => {
  it('enfileira e deduplica por opId', async () => {
    const s = memStore();
    await enqueueDelta(delta('op1', 0.25), s);
    await enqueueDelta(delta('op1', 0.25), s); // duplicata ignorada
    await enqueueDelta(delta('op2', -0.25), s);
    expect(await readHabitQueue(s)).toHaveLength(2);
  });

  it('drena os confirmados e mantém os que falharam', async () => {
    const s = memStore();
    await enqueueDelta(delta('op1', 0.25), s);
    await enqueueDelta(delta('op2', 0.5), s);
    // flush: op1 ok, op2 falha (volta)
    const drained = await drainHabitQueue(async (items) => items.filter((i) => i.opId === 'op2'), s);
    expect(drained).toBe(1);
    const left = await readHabitQueue(s);
    expect(left).toHaveLength(1);
    expect(left[0].opId).toBe('op2');
  });

  it('não reenvia um delta que já está em voo (toques rápidos)', async () => {
    const s = memStore();
    const sent: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const flush = async (items: HabitDelta[]) => {
      sent.push(...items.map((i) => i.opId));
      await gate; // segura o "envio" como uma rpc lenta
      return [];
    };

    await enqueueDelta(delta('op1', 0.25), s);
    const first = drainHabitQueue(flush, s); // fica no ar com op1
    const second = (async () => {
      await enqueueDelta(delta('op2', 0.25), s);
      await drainHabitQueue(flush, s);
    })();

    await new Promise((r) => setTimeout(r, 0)); // dá tempo do 2º toque chegar à fila
    release();
    await Promise.all([first, second]);

    expect(sent).toEqual(['op1', 'op2']); // op1 uma única vez
    expect(await readHabitQueue(s)).toHaveLength(0);
  });

  it('enqueues concorrentes não se sobrescrevem', async () => {
    const s = memStore();
    await Promise.all([
      enqueueDelta(delta('op1', 0.25), s),
      enqueueDelta(delta('op2', 0.25), s),
      enqueueDelta(delta('op3', 0.25), s),
    ]);
    expect(await readHabitQueue(s)).toHaveLength(3);
  });

  it('clear esvazia a fila', async () => {
    const s = memStore();
    await enqueueDelta(delta('op1', 1), s);
    await clearHabitQueue(s);
    expect(await readHabitQueue(s)).toHaveLength(0);
  });
});
