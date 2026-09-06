/**
 * A varredura da biblioteca e o vínculo foto ↔ atividade (ADR 0037).
 *
 * O contrato com o resto do app: **a imagem nunca sai daqui**. Este módulo
 * descobre quais fotos existem na janela da pedalada, onde elas caem no traçado
 * e grava só isso. Quem desenha resolve o arquivo pelo `assetId`, no aparelho.
 *
 * ## Por que a API nova (`Query`/`Asset`), e não a `expo-media-library/legacy`
 *
 * O `expo-media-library` 57 mudou: `getAssetsAsync`/`getAssetInfoAsync` viraram
 * `legacy`, e o import padrão é um builder de consulta. Vale migrar agora, e
 * não por gosto de novidade — a API nova resolve um risco que a antiga só
 * deixava contornar:
 *
 * - `exeForMetadata()` lê os campos baratos do media store **sem resolver
 *   caminho de arquivo nem decodificar imagem**. Com a antiga, descobrir a data
 *   de 40 fotos passava por `getAssetInfoAsync`, que baixa do iCloud por padrão.
 * - `getIsInCloud()` permite **detectar** a foto que mora só no iCloud, em vez
 *   de adivinhar por timeout. É o risco nº 2 do spec, e aqui ele vira dado.
 * - `getLocation()` traz a coordenada por asset, sem carregar o resto.
 *
 * ## O que o iOS impõe e o código trata
 *
 * **Acesso limitado** (o "Selecionar fotos…" do iOS 14+) quebra a consulta por
 * janela: a biblioteca responde só o que foi escolhido à mão. `PhotoAccess`
 * distingue isso de "negado" para a tela poder explicar — silenciar produziria
 * "não achei foto nenhuma" numa pedalada cheia delas.
 *
 * **`localIdentifier` não é estável.** É ponteiro, não chave — ver `healPointers`.
 */

import {
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';
import {
  type ActivityPhoto,
  type ActivityPhotoWrite,
  type ActivityRoutePoint,
  fetchDecidedInstants,
  markPhotosChecked,
  photoWindow,
  setPhotoAssetId,
  setPhotoCover as setPhotoCoverRow,
  setPhotoDismissed,
  upsertActivityPhotos,
} from '@vitale/shared';
import {
  type PhotoCandidate,
  type RawMedia,
  classifyMedia,
  planHealing,
} from '../lib/activity-photos';
import { supabase } from '../lib/supabase';

/** Teto de mídia lida por varredura. Uma pedalada de 40 fotos passa longe disto. */
const SCAN_LIMIT = 400;

export type PhotoAccess = 'full' | 'limited' | 'denied';

function toAccess(res: { granted: boolean; accessPrivileges?: string }): PhotoAccess {
  if (!res.granted) return 'denied';
  return res.accessPrivileges === 'limited' ? 'limited' : 'full';
}

/**
 * Pede acesso à biblioteca e diz **qual** acesso foi dado.
 *
 * `limited` não é sucesso: com ele a consulta por janela não enxerga a
 * biblioteca inteira, e a feature não funciona como desenhada.
 */
export async function requestPhotoAccess(): Promise<PhotoAccess> {
  return toAccess(await requestPermissionsAsync());
}

/** Acesso atual, sem provocar o prompt do sistema. */
export async function currentPhotoAccess(): Promise<PhotoAccess> {
  return toAccess(await getPermissionsAsync());
}

/** O que a folha de confirmação recebe. */
export interface ScanResult {
  windowFromMs: number;
  windowToMs: number;
  candidates: PhotoCandidate[];
  /** Instantes já decididos — ligados ou desligados. Não voltam como sugestão. */
  knownCount: number;
}

/** A mídia da janela, com coordenada e situação de nuvem. */
async function readWindow(fromMs: number, toMs: number): Promise<RawMedia[]> {
  const metas = await new Query()
    .gte(AssetField.CREATION_TIME, fromMs)
    .lte(AssetField.CREATION_TIME, toMs)
    .within(AssetField.MEDIA_TYPE, [MediaType.IMAGE, MediaType.VIDEO])
    .orderBy(AssetField.CREATION_TIME)
    .limit(SCAN_LIMIT)
    .exeForMetadata();

  const out: RawMedia[] = [];
  for (const meta of metas) {
    if (meta.creationTime == null) continue; // sem instante não há chave, nem lugar
    const asset = new Asset(meta.id);
    let lat: number | null = null;
    let lng: number | null = null;
    let inCloud = false;
    try {
      const loc = await asset.getLocation();
      if (loc) {
        lat = loc.latitude;
        lng = loc.longitude;
      }
    } catch {
      // Sem coordenada é só uma foto sem pin, não um erro de varredura: ela
      // ainda casa pelo instante, que é exato.
    }
    try {
      inCloud = await asset.getIsInCloud();
    } catch {
      inCloud = false;
    }
    out.push({
      assetId: meta.id,
      takenAtMs: meta.creationTime,
      lat,
      lng,
      mediaType: meta.mediaType === MediaType.VIDEO ? 'video' : 'photo',
      durationS: meta.duration && meta.duration > 0 ? meta.duration : null,
      inCloud,
    });
  }
  return out;
}

/**
 * Varre a biblioteca na janela da atividade.
 *
 * `points` pode vir vazio (atividade sem rota): as fotos ainda são encontradas
 * e agrupadas por tempo; elas só não ganham lugar no mapa.
 */
export async function scanActivity(
  activity: { id: string; startAtMs: number; endAtMs: number; distanceM?: number },
  points: readonly ActivityRoutePoint[],
  userId: string,
): Promise<ScanResult | null> {
  const w = photoWindow(activity.startAtMs, activity.endAtMs);
  if (!w) return null;

  const known = await fetchKnownInstants(userId, activity.id);
  const media = await readWindow(w.fromMs, w.toMs);

  return {
    windowFromMs: w.fromMs,
    windowToMs: w.toMs,
    candidates: classifyMedia(media, points, activity, known),
    knownCount: known.size,
  };
}

/** Os instantes já decididos nesta atividade — ligados **e** desligados. */
async function fetchKnownInstants(userId: string, activityId: string): Promise<Set<number>> {
  try {
    return new Set(await fetchDecidedInstants(supabase, userId, activityId));
  } catch {
    return new Set();
  }
}

/**
 * Grava o resultado da folha: o que o dono ligou vira `linked`, o que ele
 * deixou de fora vira `dismissed`.
 *
 * O `dismissed` é o ponto sutil da ADR: sem gravá-lo, a foto recusada voltaria
 * na próxima abertura da atividade e o dono a desligaria para sempre.
 */
export async function saveDecisions(
  userId: string,
  activityId: string,
  accepted: readonly PhotoCandidate[],
  rejected: readonly PhotoCandidate[],
): Promise<{ linked: number; dismissed: number }> {
  const row = (c: PhotoCandidate, state: 'linked' | 'dismissed'): ActivityPhotoWrite => ({
    user_id: userId,
    activity_id: activityId,
    asset_id: c.assetId,
    taken_at: new Date(c.takenAtMs).toISOString(),
    lat: c.lat,
    lng: c.lng,
    media_type: c.mediaType,
    duration_s: c.durationS,
    route_index: c.match?.routeIndex ?? null,
    route_distance_m: c.match?.routeDistanceM ?? null,
    offset_m: c.match?.offsetM ?? null,
    on_route: c.match?.onRoute ?? false,
    state,
  });

  /**
   * Duas mídias no MESMO instante colidem na chave de cura — e o upsert manda
   * tudo num `INSERT ... ON CONFLICT` só, onde o Postgres recusa a operação
   * inteira ("cannot affect row a second time"). Uma rajada ou o par de uma
   * Live Photo produz exatamente isso, e derrubava a gravação de TODA a folha.
   *
   * Fica a primeira de cada instante: são a mesma foto para o modelo, que é a
   * premissa da chave (ADR 0037 §2).
   */
  const seen = new Set<number>();
  const rows: ActivityPhotoWrite[] = [];
  for (const [list, state] of [
    [accepted, 'linked'],
    [rejected, 'dismissed'],
  ] as const) {
    for (const c of list) {
      if (seen.has(c.takenAtMs)) continue;
      seen.add(c.takenAtMs);
      rows.push(row(c, state));
    }
  }

  await upsertActivityPhotos(supabase, rows);
  await markPhotosChecked(supabase, userId, activityId);

  return { linked: accepted.length, dismissed: rejected.length };
}

/** Desliga uma foto já ligada. Nunca apaga o arquivo — o app não é dono dele. */
export async function dismissPhoto(userId: string, photoId: string): Promise<void> {
  await setPhotoDismissed(supabase, userId, photoId);
}

/** Define a capa da atividade — a foto que o cartão de compartilhar abre. */
export async function setCover(userId: string, activityId: string, photoId: string): Promise<void> {
  await setPhotoCoverRow(supabase, userId, activityId, photoId);
}

/**
 * A cura do ponteiro.
 *
 * O `localIdentifier` muda em Quick Start, restore de backup e às vezes em
 * atualização do iOS. Quando ele não resolve, a foto **não sumiu** — só o
 * endereço dela mudou. Aqui a janela é varrida de novo e o instante, que é
 * imutável e vem do mesmo relógio dos dois lados, reencontra a mídia.
 *
 * Silenciosa por design: nenhuma tela precisa saber que aconteceu. Devolve
 * quantas linhas foram reendereçadas, para o log.
 */
export async function healPointers(
  userId: string,
  activity: { startAtMs: number; endAtMs: number },
  photos: readonly ActivityPhoto[],
): Promise<number> {
  const resolved = new Map<string, boolean>();
  for (const p of photos) {
    if (!p.assetId) continue;
    try {
      await new Asset(p.assetId).getCreationTime();
      resolved.set(p.assetId, true);
    } catch {
      resolved.set(p.assetId, false);
    }
  }
  const resolves = (id: string | null) => (id ? (resolved.get(id) ?? false) : false);
  if (photos.every((p) => resolves(p.assetId))) return 0;

  const w = photoWindow(activity.startAtMs, activity.endAtMs);
  if (!w) return 0;
  const media = await readWindow(w.fromMs, w.toMs);
  const plan = planHealing(photos, media, resolves);

  let healed = 0;
  for (const step of plan) {
    try {
      await setPhotoAssetId(supabase, userId, step.id, step.assetId);
      healed += 1;
    } catch {
      // Uma cura que falha não invalida as outras.
    }
  }
  return healed;
}
