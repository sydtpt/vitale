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
import { gapAt, trackGaps } from './gaps';
import type { ActivityRoutePoint } from '../models';

/** O mínimo que uma foto precisa ter para ser agrupada. */
export interface TimedPhoto {
  takenAtMs: number;
}

export interface StopGroup<T extends TimedPhoto> {
  stop: RouteStop;
  photos: T[];
}

/**
 * Fotos num trecho em que o **traçado não gravou**.
 *
 * Não são "em movimento": ali não se sabe se a bicicleta andou. E doze fotos em
 * seis minutos no mesmo lugar são a prova de uma parada que o GPS não viu — a
 * evidência vem das fotos, não do track.
 */
export interface SilentGroup<T extends TimedPhoto> {
  photos: T[];
  firstMs: number;
  lastMs: number;
  /** Quanto tempo separa a primeira da última — a duração que as fotos provam. */
  spanS: number;
}

export interface GroupedPhotos<T extends TimedPhoto> {
  /** Só as paradas que têm foto, na ordem do percurso. */
  stops: StopGroup<T>[];
  /** Fotos onde o traçado é silencioso, agrupadas por proximidade no tempo. */
  silent: SilentGroup<T>[];
  /** As fotos fora de qualquer parada, em ordem cronológica. */
  moving: T[];
}

/**
 * Quanto tempo separa duas fotos que ainda contam como o mesmo momento.
 *
 * Dez minutos: acima do intervalo entre fotos de uma mesma parada (as doze do
 * parque cabem em 6,5 min) e abaixo do que separa duas paradas distintas.
 */
export const SILENT_CLUSTER_S = 600;

/**
 * Distribui as fotos entre as paradas.
 *
 * Paradas sem foto não aparecem no resultado: o cartão lista lugares onde houve
 * foto, não o histórico de paradas da pedalada.
 */
export function groupByStop<T extends TimedPhoto>(
  photos: readonly T[],
  stops: readonly RouteStop[],
  /** O traçado, para saber onde ele é silencioso. Ausente ⇒ nenhum buraco. */
  points: readonly ActivityRoutePoint[] = [],
): GroupedPhotos<T> {
  const sorted = [...photos].sort((a, b) => a.takenAtMs - b.takenAtMs);
  const gaps = trackGaps(points);
  const buckets = new Map<number, T[]>();
  const moving: T[] = [];
  const silentPhotos: T[] = [];

  for (const photo of sorted) {
    const idx = stops.findIndex(
      (s) => photo.takenAtMs >= s.startMs && photo.takenAtMs <= s.endMs,
    );
    if (idx === -1) {
      // A parada vence o buraco: se o traçado ficou parado ali, ele sabe.
      if (gapAt(gaps, photo.takenAtMs)) silentPhotos.push(photo);
      else moving.push(photo);
      continue;
    }
    const bucket = buckets.get(idx);
    if (bucket) bucket.push(photo);
    else buckets.set(idx, [photo]);
  }

  /** Fotos vizinhas no tempo são o mesmo momento — ver SILENT_CLUSTER_S. */
  const silent: SilentGroup<T>[] = [];
  for (const photo of silentPhotos) {
    const last = silent[silent.length - 1];
    if (last && photo.takenAtMs - last.lastMs <= SILENT_CLUSTER_S * 1000) {
      last.photos.push(photo);
      last.lastMs = photo.takenAtMs;
      last.spanS = (last.lastMs - last.firstMs) / 1000;
    } else {
      silent.push({
        photos: [photo],
        firstMs: photo.takenAtMs,
        lastMs: photo.takenAtMs,
        spanS: 0,
      });
    }
  }

  const grouped: StopGroup<T>[] = [];
  stops.forEach((stop, idx) => {
    const photosHere = buckets.get(idx);
    if (photosHere?.length) grouped.push({ stop, photos: photosHere });
  });

  return { stops: grouped, silent, moving };
}
