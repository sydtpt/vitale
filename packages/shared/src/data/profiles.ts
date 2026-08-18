/**
 * Acesso à tabela `profiles` — dono único (AD-4).
 *
 * Nenhum app escreve query para esta tabela; todos chamam daqui, passando o seu
 * próprio `SupabaseClient` (o adaptador de storage difere entre web e mobile,
 * a query não). Devolve modelo de domínio, nunca linha crua do Postgres.
 *
 * `name` e `birthdate` são `NOT NULL` no banco, então criar um perfil exige os
 * dois — é o que o fluxo de setup da web coleta. Atualização parcial existe
 * separada (`patchProfile`) justamente para que uma tela que só edita o avatar
 * não precise reenviar campos que não conhece. Ver ADR 0011.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../models';

const COLUMNS = 'id, name, birthdate, avatar_url, updated_at';

interface ProfileRow {
  id: string;
  name: string;
  birthdate: string;
  avatar_url: string | null;
  updated_at: string | null;
}

function toDomain(row: ProfileRow): Profile {
  return {
    userId: row.id,
    name: row.name,
    birthdate: row.birthdate,
    avatarUrl: row.avatar_url ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

/** Perfil do usuário; `null` quando ainda não foi criado. */
export async function fetchProfile(db: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await db.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data as ProfileRow) : null;
}

/** Cria ou substitui o perfil por inteiro. Exige `name` e `birthdate`. */
export async function saveProfile(
  db: SupabaseClient,
  p: Pick<Profile, 'userId' | 'name' | 'birthdate'> & { avatarUrl?: string | null },
): Promise<void> {
  const { error } = await db.from('profiles').upsert({
    id: p.userId,
    name: p.name,
    birthdate: p.birthdate,
    avatar_url: p.avatarUrl ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Atualiza campos soltos de um perfil **existente**. Não cria: um `update` sem
 * linha correspondente é no-op, o que é o comportamento certo para uma tela de
 * edição — criar perfil é trabalho do setup, que coleta os obrigatórios.
 */
export async function patchProfile(
  db: SupabaseClient,
  userId: string,
  patch: { name?: string; avatarUrl?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row['name'] = patch.name;
  if (patch.avatarUrl !== undefined) row['avatar_url'] = patch.avatarUrl;
  const { error } = await db.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}
