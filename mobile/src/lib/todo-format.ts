/** Rótulos em pt-BR para tarefas (apresentação). Espelhado na web. */
import type { TodoRecurrence } from '@vitale/shared';
import { addDays, localDateStr } from '@vitale/shared';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Texto curto descrevendo a recorrência. */
export function describeRecurrence(rec: TodoRecurrence): string {
  switch (rec.kind) {
    case 'none': return 'Avulsa';
    case 'monthly': return `Todo dia ${rec.day}`;
    case 'weekly':
      return [...rec.weekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]).join('/') || 'Semanal';
    case 'yearly': return `Todo ano · ${rec.day}/${rec.month}`;
    case 'after_completion': return `${rec.intervalDays} dias após concluir`;
    case 'usage': return `A cada ${rec.every} ${rec.meterUnit}`;
    case 'event': return `Quando: ${rec.label}`;
    case 'stock': return 'Quando acabar';
    case 'on_workout': return 'Ao registrar treino';
  }
}

/** Rótulo relativo do prazo (Hoje / Amanhã / Qua / 24/05 / Sem prazo). */
export function dueLabel(due: string | null, today: string = localDateStr()): string {
  if (due == null) return 'Sem prazo';
  if (due === today) return 'Hoje';
  if (due === addDays(today, 1)) return 'Amanhã';
  const d = new Date(`${due}T00:00:00`);
  // dentro de uma semana à frente: nome do dia
  for (let i = 2; i <= 6; i++) {
    if (due === addDays(today, i)) return WEEKDAYS[d.getDay()];
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}
