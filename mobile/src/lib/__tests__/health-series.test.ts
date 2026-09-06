import { describe, it, expect } from '@jest/globals';
import { bucketSeriesByMinute } from '@vitale/shared';
import { toHealthSeriesRows } from '../health-series-rows';
import { enqueue, readQueue, type QueueItem } from '../sync-queue';
import type { KVStore } from '../local-store';
import type { Sample } from '../health-buckets';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

const local = (h: number, mi: number, s = 0): string => new Date(2026, 8, 4, h, mi, s).toISOString();

describe('health-series-rows', () => {
  it('o Sample do HealthKit entra direto no núcleo e sai como linha da RPC', () => {
    const samples: Sample[] = [
      { value: 58, start: local(7, 30), end: local(7, 30) },
      { value: 61, start: local(7, 32, 10), end: local(7, 32, 10) },
      { value: 64, start: local(7, 32, 40), end: local(7, 32, 40) }, // mesmo minuto → 62,5 → 63
    ];
    const rows = toHealthSeriesRows(bucketSeriesByMinute(samples, { userId: 'u1', metric: 'fc' }));
    expect(rows).toEqual([
      {
        user_id: 'u1',
        day: '2026-09-04',
        metric: 'fc',
        tz_offset: -new Date(2026, 8, 4).getTimezoneOffset(),
        minutes: [450, 452],
        readings: [58, 63],
      },
    ]);
  });

  it('a fila deduplica a série por (usuário, dia, métrica) — reenvio do dia substitui, não acumula', async () => {
    const store = memStore();
    const row = { user_id: 'u1', day: '2026-09-04', metric: 'fc', tz_offset: 120, minutes: [1], readings: [50] };
    const item: QueueItem = { kind: 'series', row };
    await enqueue([item], store);
    await enqueue([{ kind: 'series', row: { ...row, minutes: [1, 2], readings: [50, 51] } }], store);
    const q = await readQueue(store);
    expect(q).toHaveLength(1);
  });
});
