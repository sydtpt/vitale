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
 * A **meia-noite local** de um dia 'YYYY-MM-DD' — o inverso de
 * {@link localDateStr}.
 *
 * Existe porque a forma errada é a curta: `new Date('2026-08-01')` é lido como
 * meia-noite **UTC** e volta 31/07 em todo fuso a oeste. O `T00:00:00` sem fuso
 * é o que faz o motor ler no relógio local, e essa distinção é fácil demais de
 * perder ao copiar uma linha.
 *
 * Mora aqui, e não em quem a usa: a revista (rótulo da edição, título da capa),
 * a rota e o `isValidDate` abaixo fazem a mesma conversão, e três cópias
 * divergem no dia em que uma delas ganhar uma guarda.
 *
 * Devolve `Invalid Date` para o que não é um dia — quem precisa recusar usa
 * {@link isValidDate} antes.
 */
export function localDateAt(dia: string): Date {
  return new Date(`${dia}T00:00:00`);
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
  const d = localDateAt(s);
  return !Number.isNaN(d.getTime()) && localDateStr(d) === s;
}
