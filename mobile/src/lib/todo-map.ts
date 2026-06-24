/**
 * Mapeamento linha do Supabase → modelo de domínio de Tarefas.
 * Extraído da store para ser reutilizável fora dela (ex.: sync de atividades em
 * background, onde a store Zustand está fria). Sem IO, sem estado.
 */
import type {
  TodoTemplate,
  TodoOccurrence,
  TodoModule,
  TodoRecurrence,
  TodoSpawnRule,
  TodoStatus,
} from '@vitale/shared';

export type TemplateRow = {
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
};

export type OccRow = {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoStatus;
  done_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export function toTemplate(r: TemplateRow): TodoTemplate {
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

export function toOcc(r: OccRow): TodoOccurrence {
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
