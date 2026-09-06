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
import type { Gear, GearKind, GearStyle } from '../models';
import type { GearWindowChange } from '../gear/assign';

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
  style: string | null;
}

const COLUMNS = 'id,user_id,kind,name,active_from,active_to,activity_types,external_ids,notes,style';

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
    style: (r.style as GearStyle | null) ?? undefined,
  };
}

export interface GearInput {
  name: string;
  activeFrom: string;
  activeTo?: string | null;
  style?: GearStyle;
  notes?: string;
  /** Ids HealthKit que herdam esta bicicleta pela data. Padrão: ciclismo. */
  activityTypes?: number[];
}

/** Cadastra uma bicicleta e devolve a linha criada. */
export async function createGear(
  db: SupabaseClient,
  userId: string,
  input: GearInput,
): Promise<Gear> {
  const { data, error } = await db
    .from('gear')
    .insert({
      user_id: userId,
      kind: 'bike',
      name: input.name.trim(),
      active_from: input.activeFrom,
      active_to: input.activeTo ?? null,
      activity_types: input.activityTypes ?? [13],
      style: input.style ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toGear(data as GearRow);
}

/** Edita nome, estilo, notas ou a janela de uma bicicleta. */
export async function updateGear(
  db: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<GearInput>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row['name'] = patch.name.trim();
  if (patch.activeFrom !== undefined) row['active_from'] = patch.activeFrom;
  if (patch.activeTo !== undefined) row['active_to'] = patch.activeTo;
  if (patch.style !== undefined) row['style'] = patch.style ?? null;
  if (patch.notes !== undefined) row['notes'] = patch.notes?.trim() || null;
  if (Object.keys(row).length === 0) return;
  const { error } = await db.from('gear').update(row).eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Aplica as mudanças de janela que `planDefaultGear` calculou.
 *
 * Uma a uma, e não em lote, porque são poucas (uma ou duas) e porque a ordem
 * importa menos que a clareza: se a segunda falhar, a primeira já vale e o
 * estado continua legível — uma bicicleta a mais aberta, que a própria tela
 * mostra e o usuário corrige.
 */
export async function applyGearWindows(
  db: SupabaseClient,
  userId: string,
  changes: readonly GearWindowChange[],
): Promise<void> {
  for (const c of changes) {
    const row: Record<string, unknown> = { active_to: c.activeTo };
    if (c.activeFrom !== undefined) row['active_from'] = c.activeFrom;
    const { error } = await db.from('gear').update(row).eq('id', c.id).eq('user_id', userId);
    if (error) throw error;
  }
}

/** Apaga uma bicicleta. As pedaladas voltam à herança por data (o `gear_id` vira nulo). */
export async function deleteGear(db: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await db.from('gear').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
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
