/**
 * Acesso à tabela `gear` — dono único (AD-4).
 *
 * Uma bicicleta é uma janela de datas com nome. Quem quer saber "de qual bike
 * foi esta pedalada" não pergunta aqui: pergunta a `gearForActivity` em
 * `gear/assign.ts`, que combina o override explícito (`activities.gear_id`) com a
 * herança pela data. Este módulo só traz as linhas.
 *
 * Sem paginação de propósito: é uma tabela de poucas linhas por usuário (duas
 * hoje), muito abaixo do teto de 1000 do PostgREST.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Gear, GearKind } from '../models';

/** Linha como o PostgREST a devolve (snake_case). */
export interface GearRow {
  id: string;
  user_id: string;
  kind: string;
  name: string;
  active_from: string;
  active_to: string | null;
  activity_types: number[] | null;
  external_ids: Record<string, string> | null;
  notes: string | null;
}

const COLUMNS = 'id,user_id,kind,name,active_from,active_to,activity_types,external_ids,notes';

export function toGear(r: GearRow): Gear {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind as GearKind,
    name: r.name,
    activeFrom: r.active_from,
    activeTo: r.active_to ?? null,
    activityTypes: r.activity_types ?? [],
    externalIds: r.external_ids ?? undefined,
    notes: r.notes ?? undefined,
  };
}

/** Todo o gear do usuário, da vigência mais antiga para a mais recente. */
export async function fetchGear(db: SupabaseClient, userId: string): Promise<Gear[]> {
  const { data, error } = await db
    .from('gear')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('active_from', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GearRow[]).map(toGear);
}
