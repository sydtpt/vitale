/**
 * Lembretes das tarefas com hora — derivação pura do que agendar.
 *
 * A hora vem do `startTime` da série (o mesmo horário em que a ocorrência do dia
 * vira acionável, ver `isVisibleNow`): o lembrete chega exatamente quando a
 * tarefa passa a valer. Uma notificação por ocorrência pendente com data, do
 * instante mais próximo em diante.
 *
 * O agendamento em si é local (expo-notifications no mobile), então o teto
 * importa: o iOS mantém no máximo 64 notificações locais pendentes por app e
 * descarta o excedente em silêncio. Por isso a lista sai ordenada por horário e
 * cortada em `TASK_REMINDER_LIMIT` — as mais próximas ganham, e as demais entram
 * no próximo reagendamento.
 */
import type { TodoOccurrence, TodoTemplate } from '../models';
import { isValidTime } from './logic';

/** Um lembrete a agendar. `at` é o instante local do disparo. */
export interface TaskReminder {
  occId: string;
  templateId: string;
  /** Texto da tarefa — vira o corpo da notificação. */
  name: string;
  at: Date;
}

/**
 * Teto de lembretes agendados de uma vez. Folga confortável dentro das 64 do
 * iOS, já descontados o digest diário e as três retrospectivas.
 */
export const TASK_REMINDER_LIMIT = 32;

/**
 * Lembretes a agendar, do mais próximo ao mais distante.
 *
 * Entram só ocorrências **pendentes com data** cuja série está ativa e tem
 * `startTime` válido, e só se o horário ainda **não passou** — reagendar algo no
 * passado dispararia na hora, transformando cada foreground num alarme falso.
 */
export function buildTaskReminders(
  templates: Pick<TodoTemplate, 'id' | 'name' | 'active' | 'startTime'>[],
  occurrences: Pick<TodoOccurrence, 'id' | 'templateId' | 'dueDate' | 'status'>[],
  now: Date = new Date(),
  limit: number = TASK_REMINDER_LIMIT,
): TaskReminder[] {
  const withTime = new Map(
    templates.filter((t) => t.active && t.startTime && isValidTime(t.startTime)).map((t) => [t.id, t]),
  );

  const out: TaskReminder[] = [];
  const seen = new Set<string>();
  for (const o of occurrences) {
    if (o.status !== 'pending' || o.dueDate == null || seen.has(o.id)) continue;
    const t = withTime.get(o.templateId);
    if (!t) continue;
    // 'YYYY-MM-DDTHH:MM:00' sem sufixo de fuso = horário LOCAL (o mesmo critério
    // de `localDateStr`/`localTimeStr`), então o lembrete respeita o fuso do device.
    const at = new Date(`${o.dueDate}T${t.startTime}:00`);
    if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
    seen.add(o.id);
    out.push({ occId: o.id, templateId: t.id, name: t.name, at });
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime());
  return out.slice(0, limit);
}
