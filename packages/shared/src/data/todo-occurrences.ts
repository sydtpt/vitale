/**
 * Acesso à tabela `todo_occurrences` — dono único (AD-4).
 *
 * Ocorrência é uma instância de uma série (`todo_templates`): a tarefa de um
 * dia. Conclusão **não** passa por aqui — vai pela RPC `todo_resolve`, que é o
 * seam único da ADR 0008 e resolve, avança a série e dispara encadeamento numa
 * transação só.
 *
 * `insertTodoOccurrence` engole o código `23505`: o índice único impede duas
 * ocorrências pendentes da mesma série no mesmo dia, e tentar criar a segunda é
 * o comportamento normal de dois caminhos concorrentes (sync e tela), não erro.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TodoOccurrence, TodoStatus } from '../models';
import { fetchAllPages } from './paginate';

export interface TodoOccurrenceRow {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoStatus;
  done_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toTodoOccurrence(r: TodoOccurrenceRow): TodoOccurrence {
  return {
    id: r.id,
    templateId: r.template_id,
    dueDate: r.due_date,
    status: r.status,
    doneAt: r.done_at ?? undefined,
    meta: r.meta ?? undefined,
    createdAt: r.created_at,
  };
}

/**
 * Pendentes de qualquer data, mais as resolvidas dentro da janela que começa em
 * `since`. Pendente antiga não pode sumir da lista só por ser velha — é
 * justamente a que está atrasada.
 */
export async function fetchTodoOccurrences(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<TodoOccurrence[]> {
  const { data, error } = await db
    .from('todo_occurrences')
    .select('*')
    .eq('user_id', userId)
    .or(`status.eq.pending,due_date.gte.${since},done_at.gte.${since}`)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TodoOccurrenceRow[]).map(toTodoOccurrence);
}

/**
 * Cria uma ocorrência pendente. Devolve `false` quando o índice único barrou
 * (já existia) — colisão é fluxo esperado, não falha.
 */
export async function insertTodoOccurrence(
  db: SupabaseClient,
  userId: string,
  templateId: string,
  dueDate: string | null,
): Promise<boolean> {
  const { error } = await db
    .from('todo_occurrences')
    .insert({ template_id: templateId, user_id: userId, due_date: dueDate, status: 'pending' });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

/** Existe ocorrência pendente desta série? */
export async function hasPendingTodoOccurrence(
  db: SupabaseClient,
  userId: string,
  templateId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('todo_occurrences')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .eq('status', 'pending')
    .limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Apaga uma ocorrência. */
export async function deleteTodoOccurrence(
  db: SupabaseClient,
  userId: string,
  occId: string,
): Promise<void> {
  const { error } = await db
    .from('todo_occurrences')
    .delete()
    .eq('id', occId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Concluídas desde `since` — base do progresso das metas de cadência. */
export async function fetchDoneTodoOccurrencesSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<TodoOccurrence[]> {
  const data = await fetchAllPages<TodoOccurrenceRow>((lo, hi) =>
    db
      .from('todo_occurrences')
      .select('id,template_id,due_date,status,done_at,created_at')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('done_at', `${since}T00:00:00`)
      .order('done_at', { ascending: true })
      .order('id', { ascending: true })
      .range(lo, hi),
  );
  return data.map((r) =>
    toTodoOccurrence({ ...r, meta: null }),
  );
}

/** Ocorrências destas séries, em forma reduzida — usado pelo vínculo com treino. */
export async function fetchTodoOccurrencesByTemplates(
  db: SupabaseClient,
  userId: string,
  templateIds: string[],
): Promise<Array<{ id: string; templateId: string; dueDate: string | null; status: TodoStatus }>> {
  const { data, error } = await db
    .from('todo_occurrences')
    .select('id, template_id, due_date, status')
    .eq('user_id', userId)
    .in('template_id', templateIds);
  if (error) throw error;
  return ((data ?? []) as Array<Pick<TodoOccurrenceRow, 'id' | 'template_id' | 'due_date' | 'status'>>).map(
    (r) => ({ id: r.id, templateId: r.template_id, dueDate: r.due_date, status: r.status }),
  );
}

/** Ocorrência de uma série num dia específico; `null` quando não existe. */
export async function fetchTodoOccurrenceOnDay(
  db: SupabaseClient,
  userId: string,
  templateId: string,
  day: string,
): Promise<{ id: string } | null> {
  const { data, error } = await db
    .from('todo_occurrences')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .eq('due_date', day)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null) ?? null;
}
