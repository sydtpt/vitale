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
