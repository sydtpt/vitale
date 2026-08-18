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
