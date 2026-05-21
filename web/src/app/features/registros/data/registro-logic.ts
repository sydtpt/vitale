/**
 * Derivações puras de Registros (sem persistência).
 * Marca binária por dia: um Set de datas 'YYYY-MM-DD' dos dias marcados.
 * Espelha a regra de [data-model §3](.claude/specs/registros/data-model.md).
 */
import type { RegistroLog } from '@vitale/shared';

/** Data local 'YYYY-MM-DD' (não UTC) — base do reset diário. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
