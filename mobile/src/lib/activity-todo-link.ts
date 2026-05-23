/**
 * Decisão pura do vínculo Treino → Tarefa (sem IO, sem RN/HealthKit).
 * Dado um treino (já no dia local) e as ocorrências de uma série vinculada,
 * decide concluir uma ocorrência aberta, criar+concluir a do dia, ou pular
 * (já registrado). O serviço `services/activity-todo-link.ts` aplica a ação.
 */
import type { TodoStatus } from '@vitale/shared';

export interface LinkOcc {
  id: string;
  dueDate: string | null;
  status: TodoStatus;
}

export type LinkAction =
  | { kind: 'resolve'; occId: string } // conclui uma ocorrência aberta existente
  | { kind: 'create-resolve'; dueDate: string } // cria a ocorrência do dia e conclui
  | { kind: 'skip' }; // já há ocorrência concluída no dia → idempotente, nada a fazer

/**
 * - há ocorrência ABERTA (pending, sem data ou due ≤ dia) → conclui a mais recente;
 * - já há ocorrência CONCLUÍDA nesse dia → skip (não duplica);
 * - senão → cria ocorrência no dia e conclui ("gerar e finalizar").
 */
export function planLink(occs: LinkOcc[], day: string): LinkAction {
  const openable = occs
    .filter((o) => o.status === 'pending' && (o.dueDate == null || o.dueDate <= day))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  if (openable.length) return { kind: 'resolve', occId: openable[openable.length - 1].id };

  const doneToday = occs.some((o) => o.dueDate === day && o.status === 'done');
  if (doneToday) return { kind: 'skip' };

  return { kind: 'create-resolve', dueDate: day };
}

/**
 * Ícone Ionicons para a série auto-criada de um tipo de treino (a lista de
 * tarefas usa Ionicons; getActivityMeta usa MaterialCommunityIcons). Cosmético
 * e editável depois. Default genérico de exercício.
 */
const TODO_ICON_BY_ACTIVITY: Record<number, string> = {
  13: 'bicycle-outline', // Ciclismo
  24: 'trail-sign-outline', // Trilha
  46: 'water-outline', // Natação
  52: 'walk-outline', // Caminhada
  57: 'body-outline', // Yoga
  66: 'body-outline', // Pilates
};

export function activityTodoIcon(activityId: number): string {
  return TODO_ICON_BY_ACTIVITY[activityId] ?? 'barbell-outline';
}
