/**
 * Wrapper fino sobre AsyncStorage para JSON tipado.
 * A interface KVStore permite injetar um storage fake nos testes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface KVStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const asyncStore: KVStore = AsyncStorage;

export async function getJSON<T>(key: string, store: KVStore = asyncStore): Promise<T | null> {
  const raw = await store.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON<T>(key: string, value: T, store: KVStore = asyncStore): Promise<void> {
  await store.setItem(key, JSON.stringify(value));
}
