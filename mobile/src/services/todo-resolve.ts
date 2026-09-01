/**
 * Seam ÚNICO de conclusão de tarefas: marca a ocorrência (idempotente, com fila
 * offline) e aplica TODOS os efeitos colaterais — atualizar o contador de 'usage'
 * e gerar a próxima ocorrência conforme a recorrência.
 *
 * Todo gatilho de conclusão passa por aqui: a UI (todos.store), o sync de
 * atividades (activity-todo-link) e, no futuro, encadeamento ("concluir X gera Y")
 * e challenges. Mantê-lo num só lugar evita que essas fontes divirjam. O caminho
 * de volta (`reopenOccurrence`, para o toque errado) mora aqui pelo mesmo motivo:
 * desfazer é desfazer os efeitos colaterais, não só o status.
 *
 * Não depende de Zustand (chamável em background, com a store fria).
 */
import { supabase } from '../lib/supabase';
import type { TodoTemplate, TodoOccurrence, TodoStatus } from '@vitale/shared';
import { enqueueResolve, drainTodoQueue, type TodoResolveOp } from '../lib/todo-queue';
import { nextDueDate, spawnedByCompletion, todoDayStr } from '@vitale/shared';
import {
  deleteTodoOccurrence,
  hasPendingTodoOccurrence,
  insertTodoOccurrence,
  setTodoTemplateMeterAtLastDone,
} from '@vitale/shared';

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
  return insertTodoOccurrence(supabase, userId, templateId, dueDate);
}

/** Há ocorrência pendente da série? Dedup dos gatilhos de criação (1 por vez). */
export async function hasPendingOccurrence(userId: string, templateId: string): Promise<boolean> {
  return hasPendingTodoOccurrence(supabase, userId, templateId);
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
    if (r.ifPending === 'ignore' && (await hasPendingOccurrence(userId, r.templateId))) continue;
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
  const completedAt = args.completedAt ?? todoDayStr();

  await enqueueResolve({ opId: genOpId(), occId, status, meta: args.meta ?? null });
  await drainTodoQueue(flushResolves);

  let created = 0;
  if (status === 'done') {
    if (template.recurrence.kind === 'usage') {
      await setTodoTemplateMeterAtLastDone(supabase, template.id, template.meter ?? 0);
    }
    created += await fireOnComplete(userId, template, completedAt);
  }

  const next = nextDueDate(template.recurrence, occDueDate, completedAt);
  if (next != null && (await insertOccurrence(userId, template.id, next))) created++;
  return created;
}

export interface ReopenArgs {
  userId: string;
  template: TodoTemplate;
  /** A ocorrência concluída, como veio do servidor (precisa do `doneAt` real). */
  occ: TodoOccurrence;
  /** Ocorrências carregadas — onde estão as candidatas geradas pela conclusão. */
  occurrences: TodoOccurrence[];
}

/**
 * Desfaz UMA conclusão — o oposto de `resolveAndAdvance`, e no mesmo seam:
 *  1. devolve a ocorrência para 'pending' (a rpc limpa done_at e meta da conclusão);
 *  2. apaga o que aquela conclusão gerou — a próxima da série e as filhas do
 *     encadeamento —, enquanto ninguém mexeu nelas (`spawnedByCompletion`).
 *
 * O contador de 'usage' **não** volta: a conclusão sobrescreveu
 * `meter_at_last_done` e a leitura anterior não ficou guardada em lugar nenhum.
 * A tarefa reabre, mas o gatilho por uso só dispara de novo quando o contador
 * andar outro `every` — ajustável à mão pelo editor da série.
 *
 * Devolve os ids apagados.
 */
export async function reopenOccurrence(args: ReopenArgs): Promise<string[]> {
  const { userId, template, occ, occurrences } = args;
  const spawned = spawnedByCompletion(template, occ, occurrences);

  await enqueueResolve({ opId: genOpId(), occId: occ.id, status: 'pending', meta: null });
  await drainTodoQueue(flushResolves);

  const deleted: string[] = [];
  for (const id of spawned) {
    // Sem rede a reabertura fica na fila e o delete falha junto — os dois voltam
    // no próximo load. Falha isolada é benigna: concluir de novo reinsere a
    // mesma data (insert idempotente pelo índice único).
    try {
      await deleteTodoOccurrence(supabase, userId, id);
      deleted.push(id);
    } catch {
      /* segue: nada aqui justifica derrubar a reabertura */
    }
  }
  return deleted;
}
