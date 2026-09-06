/**
 * As fotos agrupadas por parada — o que o cartão Fotos e o mapa desenham.
 *
 * O agrupamento é **por tempo**, não por distância: a parada é um intervalo, e
 * a foto pertence a ela se foi tirada enquanto ela durava. Usar a coordenada
 * aqui juntaria a foto tirada na ida com a parada da volta no mesmo lugar, que
 * é justamente o erro que o dono não quer ver num mapa.
 *
 * O que não cai em nenhuma parada é "em movimento", e no mapa vira ponto
 * pequeno em vez de marcador com contagem.
 */

import type { RouteStop } from './stops';

/** O mínimo que uma foto precisa ter para ser agrupada. */
export interface TimedPhoto {
  takenAtMs: number;
}

export interface StopGroup<T extends TimedPhoto> {
  stop: RouteStop;
  photos: T[];
}

export interface GroupedPhotos<T extends TimedPhoto> {
  /** Só as paradas que têm foto, na ordem do percurso. */
  stops: StopGroup<T>[];
  /** As fotos fora de qualquer parada, em ordem cronológica. */
  moving: T[];
}

/**
 * Distribui as fotos entre as paradas.
 *
 * Paradas sem foto não aparecem no resultado: o cartão lista lugares onde houve
 * foto, não o histórico de paradas da pedalada.
 */
export function groupByStop<T extends TimedPhoto>(
  photos: readonly T[],
  stops: readonly RouteStop[],
): GroupedPhotos<T> {
  const sorted = [...photos].sort((a, b) => a.takenAtMs - b.takenAtMs);
  const buckets = new Map<number, T[]>();
  const moving: T[] = [];

  for (const photo of sorted) {
    const idx = stops.findIndex(
      (s) => photo.takenAtMs >= s.startMs && photo.takenAtMs <= s.endMs,
    );
    if (idx === -1) {
      moving.push(photo);
      continue;
    }
    const bucket = buckets.get(idx);
    if (bucket) bucket.push(photo);
    else buckets.set(idx, [photo]);
  }

  const grouped: StopGroup<T>[] = [];
  stops.forEach((stop, idx) => {
    const photosHere = buckets.get(idx);
    if (photosHere?.length) grouped.push({ stop, photos: photosHere });
  });

  return { stops: grouped, moving };
}
