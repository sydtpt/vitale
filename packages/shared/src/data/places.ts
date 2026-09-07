/**
 * Acesso à tabela `places` — dono único (AD-4).
 *
 * Um lugar é uma janela de datas com coordenada. Quem quer saber "qual era a
 * casa nesta pedalada" não pergunta aqui: pergunta a `ancoraEm` em
 * `routes/anchor.ts`, que resolve pela vigência. Este módulo só traz as linhas.
 *
 * Mesmo desenho do `data/gear.ts`, e pela mesma razão (ADR 0034 → 0041): é uma
 * tabela de poucas linhas por usuário — duas hoje —, muito abaixo do teto de
 * 1000 do PostgREST, então não há paginação.
 *
 * As linhas são **derivadas**, não cadastradas: quem as escreve é o passe, a
 * partir dos extremos das rotas. `derived = false` marca a linha que o dono
 * corrigiu à mão, e essa o passe não toca.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HomeAnchor } from '../routes/types';

/** Linha como o PostgREST a devolve (snake_case). */
export interface PlaceRow {
  id: string;
  user_id: string;
  kind: string;
  label: string | null;
  lat: number | string;
  lng: number | string;
  radius_m: number;
  active_from: string;
  active_to: string | null;
  derived: boolean;
}

const COLUMNS = 'id,user_id,kind,label,lat,lng,radius_m,active_from,active_to,derived';

/**
 * `numeric` do Postgres chega como **string** no PostgREST — é o mesmo cuidado
 * que `distance_m` já exige em `data/activities.ts`. Sem o `Number()`, a
 * haversine recebe texto e devolve `NaN` sem reclamar, e toda pedalada vira
 * "A → B" em silêncio.
 */
export function toHomeAnchor(r: PlaceRow): HomeAnchor {
  return {
    lat: Number(r.lat),
    lng: Number(r.lng),
    radiusM: r.radius_m,
    activeFrom: r.active_from,
    activeTo: r.active_to ?? null,
  };
}

/** As casas do usuário, em ordem de vigência. */
export async function fetchHomeAnchors(
  db: SupabaseClient,
  userId: string,
): Promise<HomeAnchor[]> {
  const { data, error } = await db
    .from('places')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('kind', 'home')
    .order('active_from', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toHomeAnchor(r as PlaceRow));
}
