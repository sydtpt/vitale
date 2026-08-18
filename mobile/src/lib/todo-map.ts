/**
 * Mapeamento linha→domínio de OCORRÊNCIAS. O de séries mudou para
 * `@vitale/shared` (`data/todo-templates`), junto do acesso à tabela.
 * Mapeamento de Tarefas.
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

export type OccRow = {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoStatus;
  done_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

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
