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

  it('recusa lugar novo no teto em vez de descartar calado', async () => {
    const s = memStore();
    await writePresencePlaces(
      Array.from({ length: MAX_REGIONS }, (_, i) => place(`p${i}`)),
      s,
    );
    await expect(upsertPresencePlace(place('novo'), s)).rejects.toThrow(/máximo/);
    // E a lista não mudou: nada entrou, nada saiu.
    expect(await readPresencePlaces(s)).toHaveLength(MAX_REGIONS);
  });

  it('substituir no teto continua permitido — não estoura nada', async () => {
    const s = memStore();
    await writePresencePlaces(
      Array.from({ length: MAX_REGIONS }, (_, i) => place(`p${i}`)),
      s,
    );
    const lista = await upsertPresencePlace(place('p3', { name: 'Renomeado' }), s);
    expect(lista).toHaveLength(MAX_REGIONS);
    expect(lista.find((p) => p.id === 'p3')?.name).toBe('Renomeado');
  });

  it('aceita mais que três — o teto é o do iOS, não uma lista de nomes', async () => {
    const s = memStore();
    for (const nome of ['Casa', 'Escritório', 'Academia', 'Mercado', 'Casa da sogra']) {
      await upsertPresencePlace(place(nome, { name: nome }), s);
    }
    expect((await readPresencePlaces(s)).map((p) => p.name)).toEqual([
      'Casa',
      'Escritório',
      'Academia',
      'Mercado',
      'Casa da sogra',
    ]);
  });

  it('carimba quando o raio muda — vira outro instrumento', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1', { radiusM: 150 }), s);
    const [antes] = await readPresencePlaces(s);
    expect(antes.geometryChangedAt).toBeUndefined();

    const depois = await upsertPresencePlace(place('p1', { radiusM: 300 }), s);
    expect(depois[0].geometryChangedAt).toBeDefined();
  });

  it('carimba quando o centro muda', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1'), s);
    const depois = await upsertPresencePlace(place('p1', { lat: 50.86 }), s);
    expect(depois[0].geometryChangedAt).toBeDefined();
  });

  it('NÃO carimba ao renomear — o nome não muda o que o iOS vigia', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1', { name: 'Casa' }), s);
    const depois = await upsertPresencePlace(place('p1', { name: 'Casa nova' }), s);
    expect(depois[0].name).toBe('Casa nova');
    expect(depois[0].geometryChangedAt).toBeUndefined();
  });

  it('preserva o carimbo antigo quando nada geométrico muda', async () => {
    const s = memStore();
    await upsertPresencePlace(place('p1', { radiusM: 150 }), s);
    const [comCarimbo] = await upsertPresencePlace(place('p1', { radiusM: 300 }), s);
    const carimbo = comCarimbo.geometryChangedAt;
    const [semMudanca] = await upsertPresencePlace(
      place('p1', { radiusM: 300, name: 'Outro nome' }),
      s,
    );
    expect(semMudanca.geometryChangedAt).toBe(carimbo);
  });

  it('editar não joga o lugar para o fim da lista', async () => {
    const s = memStore();
    await upsertPresencePlace(place('a'), s);
    await upsertPresencePlace(place('b'), s);
    await upsertPresencePlace(place('c'), s);
    const lista = await upsertPresencePlace(place('a', { name: 'Editado' }), s);
    expect(lista.map((p) => p.id)).toEqual(['a', 'b', 'c']);
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
