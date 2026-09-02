/**
 * Transições de estado do toggle de um dia (SPEC-registros CAP-7, web).
 *
 * O clique no heatmap anual vive em dois caches ao mesmo tempo: o histórico
 * completo da página de detalhe (`string[]` de datas) e a janela de ~12
 * semanas do store da lista (`RegistroLog[]`). As duas transições são funções
 * puras aqui — o otimista, o revert e a coerência da janela são a MESMA conta
 * nos dois lados, e é ela que os testes seguram (`toggle.test.ts`).
 */
import type { RegistroLog } from '../models';

/**
 * Histórico de datas com a marca de `date` alternada.
 *
 * Idempotente nos dois sentidos: marcar um dia já presente não duplica,
 * desmarcar um ausente não muda nada — é o que faz o revert do otimista
 * (`toggleDateIn(next, date, !marked)`) devolver o estado original.
 */
export function toggleDateIn(dates: string[], date: string, marked: boolean): string[] {
  if (marked) return dates.includes(date) ? dates : [...dates, date];
  return dates.filter((d) => d !== date);
}

/**
 * Janela em cache do store com a escrita de um dia aplicada.
 *
 * - `date < since` é no-op: o dia não pertence à janela, e o caller não
 *   precisa refazer a conta do recorte.
 * - Marcar exige o `log` que o upsert devolveu (sem ele não há linha para
 *   inserir); dia já presente não duplica.
 * - Desmarcar remove exatamente o par `(registroId, date)` — logs de outros
 *   registros no mesmo dia ficam.
 */
export function applyMarkToWindow(
  logs: RegistroLog[],
  since: string,
  registroId: string,
  date: string,
  marked: boolean,
  log?: RegistroLog,
): RegistroLog[] {
  if (date < since) return logs;
  if (marked) {
    if (!log) return logs;
    return logs.some((l) => l.registroId === registroId && l.logDate === date)
      ? logs
      : [...logs, log];
  }
  return logs.filter((l) => !(l.registroId === registroId && l.logDate === date));
}
