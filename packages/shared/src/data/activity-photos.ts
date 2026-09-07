/**
 * Acesso à tabela `activity_photos` — dono único (AD-4). Ver ADR 0037.
 *
 * O que trafega aqui é **o fato, nunca a imagem**: quando a foto foi tirada,
 * onde, e em que ponto do traçado isso cai. O arquivo fica na biblioteca do
 * iPhone e é resolvido lá pelo `expo-media-library`, a partir do `assetId`.
 * A web lê estas mesmas linhas e desenha pin, trecho e contagem sem nunca ter
 * um pixel — por isso toda leitura daqui precisa bastar para uma tela em texto.
 *
 * Paginado por obrigação (ver `paginate.ts`): uma pedalada tem dezenas de
 * fotos, mas um período inteiro passa fácil do teto de 1000 linhas do
 * PostgREST, que corta **sem erro**.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityPhoto } from '../models';
import { fetchAllPages } from './paginate';

/** Linha como o PostgREST a devolve. */
export interface ActivityPhotoRecord {
  id: string;
  activity_id: string;
  asset_id: string | null;
  taken_at: string;
  lat: number | string | null;
  lng: number | string | null;
  media_type: string;
  duration_s: number | string | null;
  route_index: number | null;
  route_distance_m: number | string | null;
  offset_m: number | string | null;
  on_route: boolean;
  state: string;
  is_cover: boolean;
}

const COLUMNS =
  'id,activity_id,asset_id,taken_at,lat,lng,media_type,duration_s,route_index,route_distance_m,offset_m,on_route,state,is_cover';

/** `numeric` do Postgres chega como string no PostgREST; nulo continua nulo. */
function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toActivityPhoto(r: ActivityPhotoRecord): ActivityPhoto {
  return {
    id: r.id,
    activityId: r.activity_id,
    assetId: r.asset_id,
    takenAt: Date.parse(r.taken_at),
    lat: num(r.lat),
    lng: num(r.lng),
    mediaType: r.media_type === 'video' ? 'video' : 'photo',
    durationS: num(r.duration_s),
    routeIndex: r.route_index ?? null,
    routeDistanceM: num(r.route_distance_m),
    offsetM: num(r.offset_m),
    onRoute: r.on_route,
    state: r.state === 'dismissed' ? 'dismissed' : 'linked',
    isCover: r.is_cover,
  };
}

/**
 * As fotos de uma atividade, em ordem cronológica.
 *
 * Traz **todos** os estados por padrão, `dismissed` incluído: a varredura
 * precisa saber o que o dono já desligou para não sugerir de novo (ADR 0037 §5).
 * Quem só quer desenhar tela passa `linkedOnly`.
 */
export async function fetchActivityPhotos(
  db: SupabaseClient,
  userId: string,
  activityId: string,
  opts: { linkedOnly?: boolean } = {},
): Promise<ActivityPhoto[]> {
  const rows = await fetchAllPages<ActivityPhotoRecord>((lo, hi) => {
    let q = db
      .from('activity_photos')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('activity_id', activityId);
    if (opts.linkedOnly) q = q.eq('state', 'linked');
    return q.order('taken_at', { ascending: true }).range(lo, hi);
  });
  return rows.map(toActivityPhoto);
}

/**
 * As fotos ligadas de várias atividades — o que a Retrospectiva e o mapa de
 * período consomem. Só `linked`: o jornal não conta o que foi desligado.
 */
export async function fetchPhotosForActivities(
  db: SupabaseClient,
  userId: string,
  activityIds: readonly string[],
): Promise<ActivityPhoto[]> {
  if (activityIds.length === 0) return [];
  const rows = await fetchAllPages<ActivityPhotoRecord>((lo, hi) =>
    db
      .from('activity_photos')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('state', 'linked')
      .in('activity_id', [...activityIds])
      .order('taken_at', { ascending: true })
      .range(lo, hi),
  );
  return rows.map(toActivityPhoto);
}

/** Quantas fotos e quantos vídeos uma atividade tem. */
export interface ActivityMediaCount {
  photos: number;
  videos: number;
}

/**
 * A contagem de mídia por atividade — o que o selo do cartão do Histórico lê.
 *
 * Vem agrupada do banco, pela função `activity_media_counts()` (migration
 * `20260907120000`), e não de `fetchPhotosForActivities`. As duas saídas
 * óbvias não servem: contar no cliente transportaria todas as fotos para
 * desenhar um número de dois dígitos, e filtrar por `in (<ids>)` estoura a URL
 * — o Histórico de Ciclismo tem 338 atividades de id textual.
 *
 * **Atividade sem mídia não volta.** O mapa devolvido responde `undefined` para
 * ela, e é o que o cartão quer: sem selo, sem vão.
 */
export async function fetchMediaCounts(
  db: SupabaseClient,
): Promise<Map<string, ActivityMediaCount>> {
  const out = new Map<string, ActivityMediaCount>();
  const { data, error } = await db.rpc('activity_media_counts');
  if (error) throw error;
  for (const r of (data ?? []) as { activity_id: string; photos: number; videos: number }[]) {
    out.set(r.activity_id, { photos: r.photos, videos: r.videos });
  }
  return out;
}

/* ─────────────────────── Escrita ───────────────────────
 * Toda query da tabela mora aqui, e não no serviço do mobile: é a AD-4, e o
 * `architecture.test.ts` a cobra. O serviço decide *o quê* gravar; este módulo
 * sabe *como* a tabela é.
 */

/** Uma linha pronta para gravar — a forma do Postgres, não a do domínio. */
export interface ActivityPhotoWrite {
  user_id: string;
  activity_id: string;
  asset_id: string | null;
  taken_at: string;
  lat: number | null;
  lng: number | null;
  media_type: 'photo' | 'video';
  duration_s: number | null;
  route_index: number | null;
  route_distance_m: number | null;
  offset_m: number | null;
  on_route: boolean;
  state: 'linked' | 'dismissed';
}

/**
 * Os instantes já decididos numa atividade — ligados **e** desligados.
 *
 * A varredura precisa dos dois: sem os `dismissed`, a foto que o dono recusou
 * voltaria como sugestão a cada abertura da atividade.
 */
export async function fetchDecidedInstants(
  db: SupabaseClient,
  userId: string,
  activityId: string,
): Promise<number[]> {
  const rows = await fetchAllPages<{ taken_at: string }>((lo, hi) =>
    db
      .from('activity_photos')
      .select('taken_at')
      .eq('user_id', userId)
      .eq('activity_id', activityId)
      .order('taken_at', { ascending: true })
      .range(lo, hi),
  );
  return rows.map((r) => Date.parse(r.taken_at));
}

/** Grava as decisões da folha. Conflita pela chave de cura, então reenviar substitui. */
export async function upsertActivityPhotos(
  db: SupabaseClient,
  rows: readonly ActivityPhotoWrite[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await db
    .from('activity_photos')
    .upsert([...rows], { onConflict: 'user_id,activity_id,taken_at' });
  if (error) throw error;
}

/**
 * Desliga várias fotos de uma vez.
 *
 * Existe porque a curadoria acontece **depois**: numa pedalada com muitas
 * fotos não dá para julgar uma a uma na folha de confirmação, então liga-se
 * tudo e limpa-se em seguida — e limpar de uma em uma, com rajadas de fotos
 * quase iguais, é castigo.
 *
 * Nunca apaga arquivo: o app não é dono dele (ADR 0037).
 */
export async function setPhotosDismissed(
  db: SupabaseClient,
  userId: string,
  photoIds: readonly string[],
): Promise<void> {
  if (photoIds.length === 0) return;
  const { error } = await db
    .from('activity_photos')
    .update({ state: 'dismissed', is_cover: false })
    .in('id', [...photoIds])
    .eq('user_id', userId);
  if (error) throw error;
}

/** Desliga uma foto. Nunca apaga o arquivo — o app não é dono dele. */
export async function setPhotoDismissed(
  db: SupabaseClient,
  userId: string,
  photoId: string,
): Promise<void> {
  const { error } = await db
    .from('activity_photos')
    .update({ state: 'dismissed', is_cover: false })
    .eq('id', photoId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Define a capa da atividade.
 *
 * Limpa a anterior antes: o índice parcial `activity_photos_cover_uq` garante
 * uma capa por atividade, e sem limpar o segundo update bateria em 23505.
 */
export async function setPhotoCover(
  db: SupabaseClient,
  userId: string,
  activityId: string,
  photoId: string,
): Promise<void> {
  await db
    .from('activity_photos')
    .update({ is_cover: false })
    .eq('user_id', userId)
    .eq('activity_id', activityId)
    .eq('is_cover', true);
  const { error } = await db
    .from('activity_photos')
    .update({ is_cover: true })
    .eq('id', photoId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Reendereça o ponteiro de uma foto (a cura da ADR 0037 §2). */
export async function setPhotoAssetId(
  db: SupabaseClient,
  userId: string,
  photoId: string,
  assetId: string,
): Promise<void> {
  const { error } = await db
    .from('activity_photos')
    .update({ asset_id: assetId })
    .eq('id', photoId)
    .eq('user_id', userId);
  if (error) throw error;
}
