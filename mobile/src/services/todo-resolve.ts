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
import type { TodoTemplate, TodoStatus } from '@vitale/shared';
import { nextDueDate, localDateStr } from '../lib/todo-logic';
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

/**
 * Insere ocorrência; ignora violação de unicidade (idempotente por template+data).
 * Retorna `true` se criou uma linha nova, `false` se já existia (23505).
 */
export async function insertOccurrence(
  userId: string,
  templateId: string,
  dueDate: string | null,
): Promise<boolean> {
  const { error } = await supabase.from('todo_occurrences').insert({
    template_id: templateId,
    user_id: userId,
    due_date: dueDate,
    status: 'pending',
  });
  if (error) {
    if (error.code === '23505') return false;
    throw error;
  }
  return true;
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
 * Encadeamento por conclusão: ao concluir `parent`, instancia ocorrências das
 * séries-filhas declaradas em `parent.onComplete`. Cada filha mantém sua própria
 * recorrência — esta é só a porta de criação. A ocorrência criada nasce com
 * `dueDate = triggerDay` (filha que é avulsa/sem prazo recebe o dia do gatilho).
 * `ifPending: 'ignore'` pula se já existe pendente; 'duplicate' sempre cria.
 * Retorna quantas ocorrências-filhas novas foram criadas.
 */
export async function fireOnComplete(
  userId: string,
  parent: Pick<TodoTemplate, 'onComplete'>,
  triggerDay: string,
): Promise<number> {
  const rules = parent.onComplete ?? [];
  let created = 0;
  for (const r of rules) {
    if (r.ifPending === 'ignore' && (await hasPendingOccurrence(r.templateId))) continue;
    if (await insertOccurrence(userId, r.templateId, triggerDay)) created++;
  }
  return created;
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
 *  3. em 'done', dispara encadeamento (template.onComplete) — instancia filhas;
 *  4. gera a próxima ocorrência (nextDueDate); null para none/usage/event/stock.
 *
 * Retorna quantas ocorrências novas (filhas + próxima) foram criadas — usado para
 * notificar "novas tarefas automáticas".
 */
export async function resolveAndAdvance(args: ResolveArgs): Promise<number> {
  const { userId, template, occId, occDueDate } = args;
  const status = args.status ?? 'done';
  const completedAt = args.completedAt ?? localDateStr();

  await enqueueResolve({ opId: genOpId(), occId, status, meta: args.meta ?? null });
  await drainTodoQueue(flushResolves);

  let created = 0;
  if (status === 'done') {
    if (template.recurrence.kind === 'usage') {
      await supabase
        .from('todo_templates')
        .update({ meter_at_last_done: template.meter ?? 0 })
        .eq('id', template.id);
    }
    created += await fireOnComplete(userId, template, completedAt);
  }

  const next = nextDueDate(template.recurrence, occDueDate, completedAt);
  if (next != null && (await insertOccurrence(userId, template.id, next))) created++;
  return created;
}
