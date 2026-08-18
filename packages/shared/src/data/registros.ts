/**
 * Acesso às tabelas `registros` e `registro_logs` — dono único (AD-4).
 *
 * Registro é marcação binária de um dia: aconteceu ou não. Diferente de hábito
 * (`habits`), que acumula valor. Por isso `registro_logs` não tem coluna de
 * valor, e marcar/desmarcar é upsert/delete em vez de RPC — não há concorrência
 * a resolver quando o estado é a própria existência da linha.
 *
 * As duas tabelas moram no mesmo módulo porque `registro_logs` não tem sentido
 * sem `registros`: é a mesma entidade em duas formas, série e ocorrência.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Registro, RegistroLog, TodoModule } from '../models';

const REGISTRO_COLUMNS = 'id,name,icon,color,module,active,sort,created_at';

export interface RegistroRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  module: TodoModule;
  active: boolean;
  sort: number;
  created_at: string;
}

export interface RegistroLogRow {
  id: string;
  registro_id: string;
  log_date: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toRegistro(r: RegistroRow): Registro {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? '',
    module: r.module,
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

export function toRegistroLog(r: RegistroLogRow): RegistroLog {
  return { id: r.id, registroId: r.registro_id, logDate: r.log_date };
}

/** Todos os registros do usuário, ativos e arquivados, ordenados por `sort`. */
export async function fetchRegistros(db: SupabaseClient, userId: string): Promise<Registro[]> {
  const { data, error } = await db
    .from('registros')
    .select(REGISTRO_COLUMNS)
    .eq('user_id', userId)
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RegistroRow[]).map(toRegistro);
}

/** Registros em forma reduzida — usado pela retrospectiva, que só rotula. */
export async function fetchRegistroSummaries(
  db: SupabaseClient,
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await db.from('registros').select('id,name').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; name: string }>;
}

/** Campos aceitos na criação. `sort` é calculado pelo chamador. */
export interface NewRegistro {
  name: string;
  icon: string;
  color: string;
  module: TodoModule;
  sort: number;
}

/** Cria um registro e devolve o id gerado. */
export async function createRegistro(
  db: SupabaseClient,
  userId: string,
  input: NewRegistro,
): Promise<string> {
  const { data, error } = await db
    .from('registros')
    .insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      module: input.module,
      sort: input.sort,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Atualiza campos de um registro. */
export async function updateRegistro(
  db: SupabaseClient,
  id: string,
  patch: Partial<RegistroRow>,
): Promise<void> {
  const { error } = await db.from('registros').update(patch).eq('id', id);
  if (error) throw error;
}

/** Arquiva ou reativa um registro. */
export async function setRegistroActive(
  db: SupabaseClient,
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await db.from('registros').update({ active }).eq('id', id);
  if (error) throw error;
}

/** Marcações desde `since`, em ordem cronológica. */
export async function fetchRegistroLogsSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<RegistroLog[]> {
  const { data, error } = await db
    .from('registro_logs')
    .select('id,registro_id,log_date')
    .eq('user_id', userId)
    .gte('log_date', since)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as RegistroLogRow[]).map(toRegistroLog);
}

/** Todas as datas marcadas de um registro — base do heatmap completo. */
export async function fetchRegistroLogDates(
  db: SupabaseClient,
  userId: string,
  registroId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from('registro_logs')
    .select('log_date')
    .eq('user_id', userId)
    .eq('registro_id', registroId);
  if (error) throw error;
  return ((data ?? []) as Array<{ log_date: string }>).map((r) => r.log_date);
}

/**
 * Marca ou desmarca um dia. O estado É a existência da linha, então marcar é
 * upsert idempotente e desmarcar é delete — sem coluna de valor para conciliar.
 */
export async function setRegistroMark(
  db: SupabaseClient,
  userId: string,
  registroId: string,
  date: string,
  marked: boolean,
): Promise<RegistroLog | null> {
  if (!marked) {
    const { error } = await db
      .from('registro_logs')
      .delete()
      .eq('user_id', userId)
      .eq('registro_id', registroId)
      .eq('log_date', date);
    if (error) throw error;
    return null;
  }
  const { data, error } = await db
    .from('registro_logs')
    .upsert(
      { registro_id: registroId, user_id: userId, log_date: date },
      { onConflict: 'registro_id,log_date' },
    )
    .select('id,registro_id,log_date')
    .single();
  if (error) throw error;
  return toRegistroLog(data as RegistroLogRow);
}
