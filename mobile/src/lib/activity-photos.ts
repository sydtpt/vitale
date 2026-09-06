/**
 * Fotos na pedalada — a parte pura (ADR 0037).
 *
 * Aqui não entra biblioteca de fotos nem Supabase: só a decisão de **quem entra
 * e onde cai**, e o plano de reendereçar ponteiros quebrados. O `services/`
 * homônimo faz o I/O e importa daqui.
 *
 * A separação não é cerimônia — é o que permite testar a classificação sem
 * simulador, sem permissão e sem foto nenhuma. As classes `Query` e `Asset` do
 * `expo-media-library` são nativas e nem sequer importam fora do aparelho.
 */

import {
  type ActivityPhoto,
  type ActivityRoutePoint,
  type CandidateGroup,
  type PhotoMatch,
  classifyCandidate,
  matchToRoute,
} from '@vitale/shared';

/** A mídia crua da biblioteca, antes de ganhar lugar no traçado. */
export interface RawMedia {
  assetId: string;
  takenAtMs: number;
  lat: number | null;
  lng: number | null;
  mediaType: 'photo' | 'video';
  durationS: number | null;
  /** Mora só no iCloud: a miniatura vai demorar, e a tela precisa avisar. */
  inCloud: boolean;
}

/** Um item da biblioteca já posicionado no traçado. */
export interface PhotoCandidate extends RawMedia {
  group: CandidateGroup;
  match: PhotoMatch | null;
}

/**
 * Dada a mídia e a rota, quem entra na folha de confirmação e onde cada uma cai.
 *
 * `knownInstants` são os instantes já decididos — ligados **ou** desligados.
 * Eles não voltam: sem isso, a foto que o dono recusou reapareceria a cada
 * abertura da atividade e ele a desligaria para sempre.
 */
export function classifyMedia(
  media: readonly RawMedia[],
  points: readonly ActivityRoutePoint[],
  activity: { startAtMs: number; endAtMs: number; distanceM?: number },
  knownInstants: ReadonlySet<number>,
): PhotoCandidate[] {
  const out: PhotoCandidate[] = [];
  for (const m of media) {
    if (knownInstants.has(m.takenAtMs)) continue;
    const match = matchToRoute(
      { takenAtMs: m.takenAtMs, lat: m.lat, lng: m.lng },
      points,
      { totalDistanceM: activity.distanceM },
    );
    out.push({ ...m, match, group: classifyCandidate(m.takenAtMs, match, activity) });
  }
  return out;
}

/**
 * Quais linhas precisam de `asset_id` novo (ADR 0037 §2).
 *
 * O `localIdentifier` muda em Quick Start, restore de backup e às vezes em
 * atualização do iOS. Quando ele não resolve, a foto não sumiu — só o endereço
 * dela mudou, e o instante da captura a reencontra.
 *
 * Foto que o instante **não** reencontra é foto apagada da biblioteca: fica
 * órfã de propósito, para a tela mostrar a lacuna em vez de sumir calada.
 */
export function planHealing(
  photos: readonly ActivityPhoto[],
  mediaInWindow: readonly { assetId: string; takenAtMs: number }[],
  resolves: (assetId: string | null) => boolean,
): Array<{ id: string; assetId: string }> {
  const byInstant = new Map<number, string>();
  for (const m of mediaInWindow) byInstant.set(m.takenAtMs, m.assetId);

  const plan: Array<{ id: string; assetId: string }> = [];
  for (const p of photos) {
    if (resolves(p.assetId)) continue;
    const found = byInstant.get(p.takenAt);
    if (found && found !== p.assetId) plan.push({ id: p.id, assetId: found });
  }
  return plan;
}
