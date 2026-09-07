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
 * O que entra sozinho e o que espera o dono.
 *
 * ## Por que só o corredor
 *
 * A partilha não é palpite: em 07/09/2026, sobre as 707 decisões que ele já
 * tinha tomado à mão, a taxa de aceitação por grupo era
 *
 * | grupo          | ligou | recusou | aceita |
 * |----------------|-------|---------|--------|
 * | no corredor    |   549 |      69 |  89 %  |
 * | 40 a 250 m     |    15 |       7 |  68 %  |
 * | depois         |    10 |      26 |  28 %  |
 *
 * Ligar o corredor sozinho acerta 9 em 10. Ligar o que vem **depois** da
 * chegada erraria em quase 3 de 4 — é a janela de uma hora onde moram a foto
 * em casa e a do café, e ela não entra.
 *
 * A faixa de 40 a 250 m fica de fora por um motivo diferente: 68 % é bom
 * demais para descartar e ruim demais para automatizar. É onde caem as fotos
 * que ele edita no Lightroom (a exportação mexe na precisão da coordenada o
 * bastante para sair do corredor) e também as que o GPS não soube colocar,
 * porque o traçado tem buracos. As duas merecem um olhar, não um palpite.
 *
 * **Nada é recusado aqui.** O que não entra volta a ser oferecido na próxima
 * varredura — só o dono grava `dismissed`, porque só ele sabe dizer "esta não".
 */
export function splitAutoLink(candidates: readonly PhotoCandidate[]): {
  auto: PhotoCandidate[];
  pending: PhotoCandidate[];
} {
  const auto: PhotoCandidate[] = [];
  const pending: PhotoCandidate[] = [];
  for (const c of candidates) {
    if (c.group === 'on-route') auto.push(c);
    else pending.push(c);
  }
  return { auto, pending };
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
