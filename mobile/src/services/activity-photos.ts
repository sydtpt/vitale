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
  fetchRoutePoints,
  markPhotosChecked,
  photoWindow,
  setPhotoAssetId,
  setPhotoCover as setPhotoCoverRow,
  setPhotoDismissed,
  setPhotosDismissed,
  upsertActivityPhotos,
} from '@vitale/shared';
import {
  type PhotoCandidate,
  type RawMedia,
  classifyMedia,
  planHealing,
  splitAutoLink,
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
      // A API **nova** devolve `Int(duration * 1000)` — milissegundos. A legada
      // devolvia segundos, e a coluna se chama `duration_s`, então o valor cru
      // entrava mil vezes maior sem que nada reclamasse: um clipe de 68 s
      // aparecia no crachá como `1137:15`. Conferido contra os 37 vídeos em
      // produção em 07/09/2026, todos entre 98 e 68 235 — ms, sem exceção.
      durationS: meta.duration && meta.duration > 0 ? meta.duration / 1000 : null,
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

/**
 * Liga sozinho o que está no corredor, e devolve o que ficou para o dono ver.
 *
 * Roda **uma vez por pedalada**, na primeira abertura do detalhe, guardada pelo
 * `photos_checked_at` — que o `saveDecisions` grava no fim. Sem essa guarda, o
 * app leria a biblioteca a cada abertura de uma pedalada antiga que ele quis só
 * conferir no mapa.
 *
 * **Não abre folha nenhuma.** Um modal saltando toda vez que se abre uma
 * pedalada antiga seria pior que o problema que ele resolve; o que sobrou vira
 * uma linha quieta no cartão, e quem decide se olha é ele.
 *
 * Devolve `null` quando não há o que fazer — sem permissão total, sem janela,
 * ou nada de novo na biblioteca —, e aí o cartão não muda de estado.
 */
export async function autoLinkCorridor(
  activity: { id: string; startAtMs: number; endAtMs: number; distanceM?: number },
  points: readonly ActivityRoutePoint[],
  userId: string,
): Promise<{ linked: number; rest: ScanResult } | null> {
  if ((await currentPhotoAccess()) !== 'full') return null;

  const scan = await scanActivity(activity, points, userId);
  if (!scan) return null;

  const { auto, pending } = splitAutoLink(scan.candidates);
  // `rejected` vazio, de propósito: o que não entrou continua indeciso e volta
  // na próxima varredura. Só o dono grava `dismissed`.
  await saveDecisions(userId, activity.id, auto, []);

  // O resto sai na forma que a folha consome — a janela junto, porque é ela que
  // a folha mostra quando não sobrou nada ("Nada entre 10:43 e 20:48").
  return { linked: auto.length, rest: { ...scan, candidates: pending } };
}

/** O andamento do lote, para a tela contar a verdade enquanto ele roda. */
export interface BackfillProgress {
  /** Quantas já foram processadas — inclui as puladas. */
  done: number;
  total: number;
  /** Fotos ligadas até aqui. */
  linked: number;
  /** Pedaladas em que sobrou algo fora do corredor. */
  withRest: number;
  /** Fotos que ficaram fora do corredor, somadas. */
  rest: number;
  /** Sem traçado no banco, apesar da marca — não dá para decidir corredor. */
  skipped: number;
}

/**
 * Liga o corredor em **todas** as pedaladas ainda não varridas.
 *
 * ## As decisões que a forma carrega
 *
 * **Uma rota por vez, e descartada em seguida.** São 31 MB de traçado nas 222
 * pedaladas pendentes com rota (medido em 07/09/2026); carregá-las no cache do
 * store deixaria isso tudo na memória para nada. Por isso `fetchRoutePoints`
 * direto, e não o `loadRoute` do store.
 *
 * **Nada de `route_overview`.** Ele guarda 1 ponto a cada 40 — segmentos de uns
 * 445 m. A corda reta que atravessa uma curva desse tamanho se afasta muito
 * mais que os 40 m do corredor, e a foto de qualquer curva cairia fora. Seria
 * trocar precisão por velocidade exatamente onde a precisão é a regra.
 *
 * **Retomável sem estado próprio.** Cada pedalada que termina grava
 * `photos_checked_at` (dentro do `saveDecisions`), então cancelar, perder rede
 * ou fechar o app não perde nada: rodar de novo continua de onde parou.
 *
 * **A mesma regra do automático — só o corredor.** Aproveitar o lote para ser
 * mais ousado produziria um histórico onde parte das ligações seguiu um
 * critério e parte seguiu outro, sem marca de qual foi qual.
 *
 * O que sobra fora do corredor **não** é gravado: continua indeciso, e o
 * caminho de volta é o "Procurar fotos de novo" de cada pedalada. O `rest` do
 * progresso existe para o relatório final dizer isso em números, em vez de
 * deixar a perda invisível.
 */
export async function backfillCorridor(
  activities: readonly { id: string; startAtMs: number; endAtMs: number; distanceM?: number }[],
  userId: string,
  onProgress: (p: BackfillProgress) => void,
  shouldStop: () => boolean,
): Promise<BackfillProgress> {
  const p: BackfillProgress = {
    done: 0,
    total: activities.length,
    linked: 0,
    withRest: 0,
    rest: 0,
    skipped: 0,
  };
  if ((await currentPhotoAccess()) !== 'full') return p;

  for (const a of activities) {
    if (shouldStop()) break;
    try {
      const points = (await fetchRoutePoints(supabase, userId, a.id)) ?? [];
      if (points.length === 0) {
        // Sem traçado não há corredor. Não marca como varrida: quem decide uma
        // pedalada sem rota é o dono, na folha.
        p.skipped += 1;
      } else {
        const scan = await scanActivity(a, points, userId);
        if (scan) {
          const { auto, pending } = splitAutoLink(scan.candidates);
          await saveDecisions(userId, a.id, auto, []);
          p.linked += auto.length;
          if (pending.length > 0) {
            p.withRest += 1;
            p.rest += pending.length;
          }
        }
      }
    } catch {
      // Uma pedalada que falha não derruba o lote: ela fica sem
      // `photos_checked_at` e entra de novo na próxima rodada.
    }
    p.done += 1;
    onProgress({ ...p });
  }
  return p;
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

/** Desliga várias fotos de uma vez — a limpeza depois da ligação em massa. */
export async function dismissPhotos(userId: string, photoIds: readonly string[]): Promise<void> {
  await setPhotosDismissed(supabase, userId, photoIds);
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
