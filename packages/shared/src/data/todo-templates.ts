/**
 * Acesso à tabela `todo_templates` — dono único (AD-4).
 *
 * O mapeamento linha→domínio vive aqui, e não em cada app, porque era ele que
 * divergia: o mapeador da web não copiava `linked_activity_id`, então os
 * `TodoTemplate` dela nasciam sem o campo que sustenta o vínculo Treino→Tarefa
 * (ADR 0008). Ninguém na web lia o campo ainda, o que fazia a falha ser latente
 * em vez de visível — a pior espécie.
 *
 * `fetchTemplates` traz **todas** as séries, ativas e arquivadas, ordenadas por
 * `sort`. Filtrar por `active` é decisão de tela e se faz em memória: o mobile
 * consultava só as ativas num caminho e todas noutro, e essa foi a segunda
 * divergência desta tabela.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TodoModule,
  TodoRecurrence,
  TodoSpawnRule,
  TodoTemplate,
} from '../models';

export interface TodoTemplateRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoTemplate['overdue'];
  cancel_policy: TodoTemplate['cancelPolicy'];
  meter: number | string | null;
  meter_at_last_done: number | string | null;
  linked_activity_id: number | null;
  on_complete: TodoSpawnRule[] | null;
  trigger_only: boolean | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  meta: Record<string, unknown> | null;
  active: boolean;
  sort: number;
  created_at: string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toTodoTemplate(r: TodoTemplateRow): TodoTemplate {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? 'tarefa',
    module: r.module,
    recurrence: r.recurrence,
    overdue: r.overdue,
    cancelPolicy: r.cancel_policy,
    meter: r.meter == null ? undefined : Number(r.meter),
    meterAtLastDone: r.meter_at_last_done == null ? undefined : Number(r.meter_at_last_done),
    linkedActivityId: r.linked_activity_id ?? undefined,
    onComplete: r.on_complete ?? undefined,
    triggerOnly: r.trigger_only ?? undefined,
    startDate: r.start_date ?? undefined,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    meta: r.meta ?? undefined,
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

/** Todas as séries do usuário, ativas e arquivadas, ordenadas por `sort`. */
export async function fetchTodoTemplates(
  db: SupabaseClient,
  userId: string,
): Promise<TodoTemplate[]> {
  const { data, error } = await db
    .from('todo_templates')
    .select('*')
    .eq('user_id', userId)
    .order('sort', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as TodoTemplateRow[]).map(toTodoTemplate);
}

/** Campos que uma série aceita na criação. `sort` é calculado pelo chamador. */
export interface NewTodoTemplate {
  name: string;
  icon: string;
  color: string;
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoTemplate['overdue'];
  cancelPolicy: TodoTemplate['cancelPolicy'];
  sort: number;
  meter?: number | null;
  linkedActivityId?: number | null;
  onComplete?: TodoSpawnRule[];
  triggerOnly?: boolean;
  /** `null` é aceito além de ausente: o editor limpa um campo pondo null. */
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Cria uma série e devolve o id gerado. */
export async function createTodoTemplate(
  db: SupabaseClient,
  userId: string,
  input: NewTodoTemplate,
): Promise<string> {
  const { data, error } = await db
    .from('todo_templates')
    .insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      module: input.module,
      recurrence: input.recurrence,
      overdue: input.overdue,
      cancel_policy: input.cancelPolicy,
      sort: input.sort,
      meter: input.meter ?? null,
      linked_activity_id: input.linkedActivityId ?? null,
      on_complete: input.onComplete ?? null,
      trigger_only: input.triggerOnly ?? null,
      start_date: input.startDate ?? null,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      meta: input.meta ?? null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * Atualiza campos de uma série. O patch é em **nomes de coluna** de propósito:
 * o editor monta o conjunto dinamicamente, e traduzir aqui exigiria um mapa
 * domínio→linha que só serviria a este caso. `Partial<TodoTemplateRow>` mantém
 * o nome das colunas conferido pelo compilador.
 */
export async function updateTodoTemplate(
  db: SupabaseClient,
  id: string,
  patch: Partial<TodoTemplateRow>,
): Promise<void> {
  const { error } = await db.from('todo_templates').update(patch).eq('id', id);
  if (error) throw error;
}

/** Arquiva ou reativa uma série. */
export async function setTodoTemplateActive(
  db: SupabaseClient,
  id: string,
  active: boolean,
): Promise<void> {
  const { error } = await db.from('todo_templates').update({ active }).eq('id', id);
  if (error) throw error;
}

/** Fixa o medidor no valor da última conclusão (recorrência por uso). */
export async function setTodoTemplateMeterAtLastDone(
  db: SupabaseClient,
  id: string,
  meter: number,
): Promise<void> {
  const { error } = await db
    .from('todo_templates')
    .update({ meter_at_last_done: meter })
    .eq('id', id);
  if (error) throw error;
}

/** Atualiza o medidor de uso da série (recorrência por uso). */
export async function setTodoTemplateMeter(
  db: SupabaseClient,
  id: string,
  meter: number,
): Promise<void> {
  const { error } = await db.from('todo_templates').update({ meter }).eq('id', id);
  if (error) throw error;
}

/** Resumo de série, para agregados que não precisam do modelo inteiro. */
export interface TodoTemplateSummary {
  id: string;
  name: string;
  module: TodoModule;
  meta?: Record<string, unknown>;
}

/** Séries em forma reduzida — para agregados que só rotulam, como a retrospectiva. */
export async function fetchTodoTemplateSummaries(
  db: SupabaseClient,
  userId: string,
): Promise<TodoTemplateSummary[]> {
  const { data, error } = await db
    .from('todo_templates')
    .select('id,name,module,meta')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    name: string;
    module: TodoModule;
    meta: Record<string, unknown> | null;
  }>).map((r) => ({ id: r.id, name: r.name, module: r.module, meta: r.meta ?? undefined }));
}

/** Séries ativas disparadas por treino (`recurrence.kind === 'on_workout'`). */
export async function fetchOnWorkoutTemplates(
  db: SupabaseClient,
  userId: string,
): Promise<Array<{ id: string; recurrence: TodoRecurrence }>> {
  const { data, error } = await db
    .from('todo_templates')
    .select('id, recurrence')
    .eq('user_id', userId)
    .eq('active', true)
    .eq('recurrence->>kind', 'on_workout');
  if (error) throw error;
  return (data ?? []) as Array<{ id: string; recurrence: TodoRecurrence }>;
}

/**
 * Séries vinculadas a estes tipos de atividade — **ativas e inativas**. Inativa
 * sinaliza opt-out do usuário e precisa ser vista, senão o sync auto-cria outra.
 * Devolve a linha crua porque o chamador precisa de `linked_activity_id`, que o
 * modelo expõe como `linkedActivityId` mas o índice único usa em forma de coluna.
 */
export async function fetchTemplatesByLinkedActivity(
  db: SupabaseClient,
  userId: string,
  activityIds: number[],
): Promise<TodoTemplateRow[]> {
  const { data, error } = await db
    .from('todo_templates')
    .select('*')
    .eq('user_id', userId)
    .in('linked_activity_id', activityIds);
  if (error) throw error;
  return (data ?? []) as TodoTemplateRow[];
}

/** Série vinculada a um tipo específico; `null` quando não existe. */
export async function fetchTemplateByLinkedActivity(
  db: SupabaseClient,
  userId: string,
  activityId: number,
): Promise<TodoTemplateRow | null> {
  const { data, error } = await db
    .from('todo_templates')
    .select('*')
    .eq('user_id', userId)
    .eq('linked_activity_id', activityId)
    .maybeSingle();
  if (error) throw error;
  return (data as TodoTemplateRow | null) ?? null;
}

/**
 * Cria a série de um tipo de treino e devolve a linha. Corrida com outro sync
 * viola o índice único parcial (user_id, linked_activity_id) com o código
 * `23505`; nesse caso devolve a linha que já existe, em vez de propagar o erro.
 */
export async function createLinkedActivityTemplate(
  db: SupabaseClient,
  userId: string,
  activityId: number,
  fields: { name: string; icon: string; color: string; module: TodoModule },
): Promise<TodoTemplateRow | null> {
  const insert = await db
    .from('todo_templates')
    .insert({
      user_id: userId,
      name: fields.name,
      icon: fields.icon,
      color: fields.color,
      module: fields.module,
      recurrence: { kind: 'event', label: fields.name },
      overdue: 'expire',
      cancel_policy: 'manual',
      linked_activity_id: activityId,
    })
    .select('*')
    .single();
  if (insert.data) return insert.data as TodoTemplateRow;
  if (insert.error?.code === '23505') {
    return fetchTemplateByLinkedActivity(db, userId, activityId);
  }
  return null;
}
