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
  /** ISO da criação. Ausente nos lugares gravados antes deste campo existir. */
  createdAt?: string;
  /**
   * ISO da última mudança de **geometria** — centro ou raio.
   *
   * Existe porque mexer no raio no meio da observação troca o instrumento: as
   * passagens e colagens contadas antes vieram de outro círculo, e somá-las às
   * de depois produz um número que não mede nada. O carimbo não impede a
   * mudança; ele impede que ela seja silenciosa.
   *
   * Renomear **não** carimba: o nome não muda o que o iOS vigia.
   */
  geometryChangedAt?: string;
}

/** Mudou o que o iOS vigia? Nome não conta; centro e raio contam. */
export function geometryDiffers(a: PresencePlace, b: PresencePlace): boolean {
  return a.lat !== b.lat || a.lon !== b.lon || a.radiusM !== b.radiusM;
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
 * Piso do raio, e a razão dele é a margem de erro — não o gosto.
 *
 * O raio tem de ser **maior que o erro típico de posição**, senão o fix cai fora
 * do círculo com o usuário dentro dele (saída falsa) ou dentro com ele fora. O
 * monitoramento de região do iOS se apoia em torre de celular e Wi-Fi, com erro
 * da ordem de 100 m — é justamente isso que o torna barato de bateria. Abaixo
 * desse piso os eventos param de ser sobre movimento e passam a ser sobre
 * flutuação do sinal, com o aparelho entrando e saindo parado no mesmo lugar.
 *
 * O padrão é o próprio piso: o menor raio que ainda mede movimento. A troca que
 * vem junto é a nitidez da **saída** — o iOS aplica histerese antes de disparar
 * o `exit`, e quanto menor o raio, maior essa folga em proporção. Se a fase 0
 * mostrar saídas atrasadas ou perdidas, é aqui que se sobe.
 *
 * `medianAccuracyM` no resumo da fase 0 é a evidência para revisar este número
 * com dado do aparelho dele, em vez de com a média de ninguém.
 */
export const MIN_RADIUS_M = 100;
export const DEFAULT_RADIUS_M = 100;

export async function readPresencePlaces(store: KVStore = asyncStore): Promise<PresencePlace[]> {
  return (await getJSON<PresencePlace[]>(KEY, store)) ?? [];
}

export async function writePresencePlaces(
  places: PresencePlace[],
  store: KVStore = asyncStore,
): Promise<void> {
  await setJSON(KEY, places.slice(0, MAX_REGIONS), store);
}

/**
 * Acrescenta ou substitui pelo `id`. Devolve a lista resultante.
 *
 * Lança quando um lugar **novo** estouraria o teto do iOS, em vez de aceitar e
 * descartar no corte. O descarte silencioso seria a pior falha possível aqui: o
 * lugar apareceria na lista, nunca entregaria evento, e o buraco só apareceria
 * semanas depois como "esse lugar não registra nada". Substituir um lugar que
 * já existe nunca estoura, então continua permitido no teto.
 */
export async function upsertPresencePlace(
  place: PresencePlace,
  store: KVStore = asyncStore,
): Promise<PresencePlace[]> {
  const current = await readPresencePlaces(store);
  const jaExiste = current.some((p) => p.id === place.id);
  if (!jaExiste && current.length >= MAX_REGIONS) {
    throw new Error(
      `O iOS vigia no máximo ${MAX_REGIONS} regiões por app. Apague um lugar antes de criar outro.`,
    );
  }
  const anterior = current.find((p) => p.id === place.id);
  const normalizado: PresencePlace = {
    ...place,
    radiusM: Math.max(MIN_RADIUS_M, place.radiusM),
    createdAt: anterior?.createdAt ?? place.createdAt ?? new Date().toISOString(),
  };
  // O carimbo é herdado, e só é reposto quando a geometria de fato mudou —
  // salvar a tela sem mexer no mapa nem no slider não pode inventar uma troca.
  normalizado.geometryChangedAt = anterior
    ? geometryDiffers(anterior, normalizado)
      ? new Date().toISOString()
      : anterior.geometryChangedAt
    : undefined;

  // Preserva a ordem: um lugar editado não deve pular para o fim da lista.
  const next = anterior
    ? current.map((p) => (p.id === place.id ? normalizado : p))
    : [...current, normalizado];
  await writePresencePlaces(next, store);
  return next;
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
