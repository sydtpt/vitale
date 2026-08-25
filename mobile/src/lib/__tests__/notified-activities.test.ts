/**
 * BARREIRA — a mesma atividade nunca é anunciada duas vezes.
 *
 * O sync reenvia treinos já enviados de propósito (upsert idempotente): a âncora
 * só avança quando o ciclo inteiro sobe, e sem âncora o delta relê os últimos
 * dias inteiros. Notificar por `pushed` — a contagem de linhas enviadas —
 * transforma cada reenvio num anúncio novo, que foi o sintoma relatado.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { claimUnnotified, clearNotifiedActivities } from '../notified-activities';
import type { KVStore } from '../local-store';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

describe('notified-activities', () => {
  let store: KVStore;
  beforeEach(() => {
    store = memStore();
  });

  it('a primeira vez de um id é inédita', async () => {
    expect(await claimUnnotified(['a', 'b'], store)).toEqual(['a', 'b']);
  });

  it('o mesmo id não volta num ciclo seguinte', async () => {
    await claimUnnotified(['a', 'b'], store);
    expect(await claimUnnotified(['a', 'b'], store)).toEqual([]);
  });

  it('num reenvio parcial, só o que é novo passa', async () => {
    await claimUnnotified(['a'], store);
    expect(await claimUnnotified(['a', 'b'], store)).toEqual(['b']);
  });

  it('id repetido DENTRO do mesmo lote conta uma vez só', async () => {
    expect(await claimUnnotified(['a', 'a'], store)).toEqual(['a']);
  });

  it('lote vazio não escreve nada', async () => {
    expect(await claimUnnotified([], store)).toEqual([]);
    expect(await store.getItem('vitale:notified-activities')).toBeNull();
  });

  // Dois ciclos podem se cruzar (observer em background + volta ao primeiro
  // plano). Sem serialização os dois leem o mesmo estado e ambos anunciam.
  it('claims concorrentes do mesmo id não anunciam os dois', async () => {
    const [first, second] = await Promise.all([
      claimUnnotified(['a'], store),
      claimUnnotified(['a'], store),
    ]);
    expect([...first, ...second]).toEqual(['a']);
  });

  it('o registro é limitado, mantendo os mais recentes', async () => {
    const many = Array.from({ length: 600 }, (_, i) => `id-${i}`);
    await claimUnnotified(many, store);
    const kept = JSON.parse((await store.getItem('vitale:notified-activities')) ?? '[]');
    expect(kept).toHaveLength(500);
    expect(kept).toContain('id-599');
    expect(kept).not.toContain('id-0');
  });

  it('limpar o registro faz tudo voltar a ser inédito', async () => {
    await claimUnnotified(['a'], store);
    await clearNotifiedActivities(store);
    expect(await claimUnnotified(['a'], store)).toEqual(['a']);
  });
});
