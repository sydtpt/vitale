/**
 * Âncora incremental do HealthKit, persistida por usuário (FR-007).
 * Governa o delta para frente em `syncDelta`. Local ao dispositivo.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

const keyFor = (userId: string) => `vitale:hk-anchor:${userId}`;

export async function readAnchor(userId: string, store: KVStore = asyncStore): Promise<string | null> {
  return getJSON<string>(keyFor(userId), store);
}

export async function writeAnchor(userId: string, anchor: string, store: KVStore = asyncStore): Promise<void> {
  await setJSON(keyFor(userId), anchor, store);
}
