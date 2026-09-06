import { describe, it, expect } from '@jest/globals';
import {
  DEFAULT_RADIUS_M,
  MAX_REGIONS,
  MIN_RADIUS_M,
  placeName,
  readPresencePlaces,
  removePresencePlace,
  upsertPresencePlace,
  writePresencePlaces,
  type PresencePlace,
} from '../presence-places';
import type { KVStore } from '../local-store';

function memStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    removeItem: async (k) => void map.delete(k),
  };
}

function place(id: string, over: Partial<PresencePlace> = {}): PresencePlace {
  return { id, name: id, lat: 50.85, lon: 4.35, radiusM: DEFAULT_RADIUS_M, ...over };
}

describe('presence-places', () => {
  it('acrescenta e substitui pelo id em vez de duplicar', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1', { name: 'Casa' }), s);
    await upsertPresencePlace(place('p1', { name: 'Casa nova' }), s);
    const list = await readPresencePlaces(s);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Casa nova');
  });

  it('eleva raio abaixo do piso — o iOS não vigia raio pequeno com confiança', async () => {
    const s = memStore();
    const [p] = await upsertPresencePlace(place('p1', { radiusM: 30 }), s);
    expect(p.radiusM).toBe(MIN_RADIUS_M);
  });

  it('corta no teto de regiões do iOS, que falha calado quando estourado', async () => {
    const s = memStore();
    const muitos = Array.from({ length: MAX_REGIONS + 4 }, (_, i) => place(`p${i}`));
    await writePresencePlaces(muitos, s);
    expect(await readPresencePlaces(s)).toHaveLength(MAX_REGIONS);
  });

  it('remove pelo id', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1'), s);
    await upsertPresencePlace(place('p2'), s);
    const restantes = await removePresencePlace('p1', s);
    expect(restantes.map((p) => p.id)).toEqual(['p2']);
  });

  it('devolve o id quando o lugar já não existe, em vez de "undefined" na tela', () => {
    expect(placeName([place('p1', { name: 'Casa' })], 'p1')).toBe('Casa');
    expect(placeName([], 'p9')).toBe('p9');
  });
});
