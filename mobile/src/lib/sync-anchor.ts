/**
 * Âncora incremental do HealthKit, persistida por usuário (FR-007).
 * Governa o delta para frente em `syncDelta`. Local ao dispositivo.
 */
import { healthSource } from './health-source/active';
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const keyFor = (userId: string) => `vitale:hk-anchor:${userId}`;
const sourceKeyFor = (userId: string) => `vitale:hk-anchor-source:${userId}`;

/**
 * A âncora é opaca (serializada por quem a gerou — cada `HealthSource` tem seu
 * próprio formato) e local ao dispositivo. Trocar de adaptador (ver
 * `health-source/active.ts`, ADR 0012) não garante que o novo consiga
 * decodificar uma âncora escrita pelo antigo — por isso ela é guardada junto
 * com o `id` de quem a escreveu. Se o `id` ativo mudou desde a última
 * escrita, a leitura descarta a âncora: `syncDelta` trata isso como cold
 * start (upsert idempotente, sem duplicar nem perder treino), em vez de
 * arriscar um delta calculado sobre uma âncora que a lib nova não entende.
 */
export async function readAnchor(userId: string, store: KVStore = asyncStore): Promise<string | null> {
  const [anchor, source] = await Promise.all([
    getJSON<string>(keyFor(userId), store),
    getJSON<string>(sourceKeyFor(userId), store),
  ]);
  if (anchor && source !== healthSource.id) return null;
  return anchor;
}

export async function writeAnchor(userId: string, anchor: string, store: KVStore = asyncStore): Promise<void> {
  await Promise.all([setJSON(keyFor(userId), anchor, store), setJSON(sourceKeyFor(userId), healthSource.id, store)]);
}
