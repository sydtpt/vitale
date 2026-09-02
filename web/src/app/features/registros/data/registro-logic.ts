/**
 * Derivações puras de Registros (sem persistência).
 * Marca binária por dia: um Set de datas 'YYYY-MM-DD' dos dias marcados.
 * Espelha a regra de [data-model §3](docs/specs/registros/data-model.md).
 */
import { localDateStr, type RegistroLog, type TodoModule } from '@vitale/shared';

/**
 * Data local 'YYYY-MM-DD' (não UTC) — base do reset diário. Re-export da fonte
 * única do núcleo: este arquivo tinha uma cópia própria, byte a byte idêntica,
 * convivendo com a do `@vitale/shared` nos arquivos mais novos da feature.
 */
export { localDateStr };

/** Rótulo de módulo — fonte única da feature (lista, detalhe e card de análise). */
export const MODULE_LABEL: Record<TodoModule, string> = {
  geral: 'Geral',
  casa: 'Casa',
  financas: 'Finanças',
  compras: 'Compras',
  saude: 'Saúde',
};

/** Conjunto de datas marcadas a partir dos logs de UM registro. */
export function markedDates(logs: RegistroLog[]): Set<string> {
  return new Set(logs.map((l) => l.logDate));
}

/** Marcado hoje? */
export function doneToday(marked: Set<string>, today: string = localDateStr()): boolean {
  return marked.has(today);
}

/** Maior data marcada (mais recente) ou null. */
export function lastDone(marked: Set<string>): string | null {
  let max: string | null = null;
  for (const d of marked) if (max === null || d > max) max = d;
  return max;
}

/** Nº de dias inteiros entre duas datas 'YYYY-MM-DD' (b − a). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Últimas N datas locais (mais antiga → hoje). */
export function lastNDates(n: number, today: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}

/** Quantos dos últimos N dias estão marcados. */
export function countInWindow(marked: Set<string>, days: number): number {
  return lastNDates(days).reduce((acc, d) => acc + (marked.has(d) ? 1 : 0), 0);
}
