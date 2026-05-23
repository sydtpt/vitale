/**
 * Seam ÚNICO de conclusão de tarefas: marca a ocorrência (idempotente, com fila
 * offline) e aplica TODOS os efeitos colaterais — atualizar o contador de 'usage'
 * e gerar a próxima ocorrência conforme a recorrência.
 *
 * Todo gatilho de conclusão passa por aqui: a UI (todos.store), o sync de
 * atividades (activity-todo-link) e, no futuro, encadeamento ("concluir X gera Y")
 * e challenges. Mantê-lo num só lugar evita que essas fontes divirjam.
 *
 * Não depende de Zustand (chamável em background, com a store fria).
 */
import { supabase } from '../lib/supabase';
import type { TodoTemplate, TodoRecurrence, TodoStatus } from '@vitale/shared';
import { nextDueDate, triggeredDueDate, localDateStr } from '../lib/todo-logic';
import { enqueueResolve, drainTodoQueue, type TodoResolveOp } from '../lib/todo-queue';

export function genOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Resolve cada item via rpc; devolve os que falharam (a manter na fila). */
export async function flushResolves(items: TodoResolveOp[]): Promise<TodoResolveOp[]> {
  const failed: TodoResolveOp[] = [];
  for (const it of items) {
    const { error } = await supabase.rpc('todo_resolve', {
      p_occ: it.occId,
      p_status: it.status,
      p_meta: it.meta ?? null,
    });
    if (error) failed.push(it);
  }
  return failed;
}

/** Insere ocorrência; ignora violação de unicidade (idempotente por template+data). */
export async function insertOccurrence(
  userId: string,
  templateId: string,
  dueDate: string | null,
): Promise<void> {
  const { error } = await supabase.from('todo_occurrences').insert({
    template_id: templateId,
    user_id: userId,
    due_date: dueDate,
    status: 'pending',
  });
  if (error && error.code !== '23505') throw error;
}

/** Há ocorrência pendente da série? Dedup dos gatilhos de criação (1 por vez). */
export async function hasPendingOccurrence(templateId: string): Promise<boolean> {
  const { data } = await supabase
    .from('todo_occurrences')
    .select('id')
    .eq('template_id', templateId)
    .eq('status', 'pending')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Encadeamento: para cada série `on_task` que aponta para `sourceTemplateId`,
 * cria sua ocorrência ao concluir a fonte. 1 por vez (pula se já houver pendente).
 */
export async function fireTaskChains(
  userId: string,
  sourceTemplateId: string,
  triggerDay: string,
): Promise<void> {
  const { data } = await supabase
    .from('todo_templates')
    .select('id, recurrence')
    .eq('active', true)
    .eq('recurrence->>kind', 'on_task')
    .eq('recurrence->>sourceTemplateId', sourceTemplateId);
  for (const t of (data ?? []) as { id: string; recurrence: TodoRecurrence }[]) {
    if (await hasPendingOccurrence(t.id)) continue;
    await insertOccurrence(userId, t.id, triggeredDueDate(t.recurrence, triggerDay));
  }
}

export interface ResolveArgs {
  userId: string;
  template: TodoTemplate;
  occId: string;
  occDueDate: string | null;
  status?: TodoStatus;
  meta?: Record<string, unknown> | null;
  /** Data local da conclusão (âncora de after_completion). Default: hoje. */
  completedAt?: string;
}

/**
 * Resolve UMA ocorrência e avança a série. Ponto único de conclusão:
 *  1. enfileira a resolução (offline-safe) e drena via rpc todo_resolve;
 *  2. em 'done' de 'usage', registra meter_at_last_done;
 *  3. gera a próxima ocorrência (nextDueDate); null para none/usage/event/stock.
 *  [FUTURO] regras de encadeamento ("concluir X gera Y") entram no passo 2.
 */
export async function resolveAndAdvance(args: ResolveArgs): Promise<void> {
  const { userId, template, occId, occDueDate } = args;
  const status = args.status ?? 'done';
  const completedAt = args.completedAt ?? localDateStr();

  await enqueueResolve({ opId: genOpId(), occId, status, meta: args.meta ?? null });
  await drainTodoQueue(flushResolves);

  if (status === 'done') {
    if (template.recurrence.kind === 'usage') {
      await supabase
        .from('todo_templates')
        .update({ meter_at_last_done: template.meter ?? 0 })
        .eq('id', template.id);
    }
    // Encadeamento: séries on_task que dependem desta criam sua ocorrência.
    await fireTaskChains(userId, template.id, completedAt);
  }

  const next = nextDueDate(template.recurrence, occDueDate, completedAt);
  if (next != null) await insertOccurrence(userId, template.id, next);
}
