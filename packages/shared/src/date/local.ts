/**
 * Data local como string — fonte única.
 *
 * Todo o Orbe usa a data do **dispositivo**, nunca UTC: um treino às 22h de
 * terça pertence a terça para quem treinou, mesmo que já seja quarta em UTC.
 * Estas funções são a única forma de derivar 'YYYY-MM-DD' no projeto.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' local de uma `Date`. */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 'YYYY-MM-DD' local de um instante ISO. */
export function localDateOf(iso: string): string {
  return localDateStr(new Date(iso));
}

/**
 * Valida 'YYYY-MM-DD' — calendário real, não só formato: `2026-02-30` e
 * `2026-13-01` têm a forma e não são dias.
 *
 * Mora aqui, com as outras datas locais, e não em quem a usa: as tarefas
 * (`todo/logic.ts`, que a reexporta) e a revista (`ia/`, que valida a data da
 * lápide e a de criação de hábito) fazem a mesma pergunta, e duas regexes
 * divergiriam no dia em que uma mudasse.
 */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && localDateStr(d) === s;
}
