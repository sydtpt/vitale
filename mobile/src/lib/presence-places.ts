/**
 * Os lugares-âncora da fase 0, **só no aparelho**.
 *
 * Não há tabela `places` ainda e não haverá nesta fase: a fase 0 não escreve no
 * Supabase. Aqui mora o mínimo para registrar uma região no iOS — id, nome,
 * centro e raio — guardado em AsyncStorage. Quando a fase 1 criar a tabela, este
 * arquivo vira o cache local dela e o formato praticamente não muda.
 */
import { asyncStore, getJSON, setJSON, type KVStore } from './local-store';

export interface PresencePlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusM: number;
}

const KEY = 'vitale:presence-places';

/**
 * Teto do iOS: um app monitora no máximo 20 regiões ao mesmo tempo. Passar disso
 * não dá erro — o iOS simplesmente para de entregar as excedentes, calado. Na
 * fase 0 são três, mas a constante fica aqui porque é ela que vira o orçamento
 * dos alertas na fase 1.
 */
export const MAX_REGIONS = 20;

/**
 * Piso do raio. Abaixo de ~100 m o monitoramento de região do iOS fica pouco
 * confiável: a localização grosseira por célula e Wi-Fi tem erro dessa ordem, e
 * o resultado é entrar e sair repetidamente parado no mesmo lugar. 150 m é o
 * padrão porque a rua dele é calma e o comércio mais próximo está a 300 m — não
 * há o que colidir, e a folga compra estabilidade.
 */
export const MIN_RADIUS_M = 100;
export const DEFAULT_RADIUS_M = 150;

export async function readPresencePlaces(store: KVStore = asyncStore): Promise<PresencePlace[]> {
  return (await getJSON<PresencePlace[]>(KEY, store)) ?? [];
}

export async function writePresencePlaces(
  places: PresencePlace[],
  store: KVStore = asyncStore,
): Promise<void> {
  await setJSON(KEY, places.slice(0, MAX_REGIONS), store);
}

/** Acrescenta ou substitui pelo `id`. Devolve a lista resultante. */
export async function upsertPresencePlace(
  place: PresencePlace,
  store: KVStore = asyncStore,
): Promise<PresencePlace[]> {
  const current = await readPresencePlaces(store);
  const without = current.filter((p) => p.id !== place.id);
  const next = [...without, { ...place, radiusM: Math.max(MIN_RADIUS_M, place.radiusM) }];
  await writePresencePlaces(next, store);
  return next.slice(0, MAX_REGIONS);
}

export async function removePresencePlace(
  id: string,
  store: KVStore = asyncStore,
): Promise<PresencePlace[]> {
  const next = (await readPresencePlaces(store)).filter((p) => p.id !== id);
  await writePresencePlaces(next, store);
  return next;
}

/** Nome do lugar para exibição, com recuo para quando ele já foi removido. */
export function placeName(places: PresencePlace[], id: string): string {
  return places.find((p) => p.id === id)?.name ?? id;
}
