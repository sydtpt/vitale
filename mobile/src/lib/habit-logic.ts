/**
 * Derivações puras de hábitos contadores (sem persistência).
 * Espelha a regra de [data-model §4](.claude/specs/habitos/data-model.md).
 * Mantido fora de `@vitale/shared` (que é só modelos/tokens, sem lógica);
 * a web deve espelhar estas funções na F3.
 */
import type { CounterHabit, HabitLog } from '@vitale/shared';

type Goal = Pick<CounterHabit, 'direction' | 'target'>;

/** Data local 'YYYY-MM-DD' (não UTC) — base do reset diário. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Bateu a meta? at_least: value ≥ target; at_most: value ≤ target. Sem target ⇒ false. */
export function isMet(habit: Goal, value: number): boolean {
  if (habit.target == null) return false;
  return habit.direction === 'at_least' ? value >= habit.target : value <= habit.target;
}

/** Estourou o teto? Só at_most com target definido. */
export function isOver(habit: Goal, value: number): boolean {
  return habit.direction === 'at_most' && habit.target != null && value > habit.target;
}

/** Progresso 0..1 para anel/barra. Sem target ⇒ 0. */
export function progress(habit: Goal, value: number): number {
  if (!habit.target || habit.target <= 0) return 0;
  return Math.max(0, Math.min(1, value / habit.target));
}

/** Mapa data → valor a partir dos logs de UM hábito. */
export function logsByDate(logs: HabitLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) m.set(l.logDate, l.value);
  return m;
}

/** Dia anterior a 'YYYY-MM-DD'. */
function prevDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

/**
 * Streak: dias consecutivos (terminando hoje) cumprindo a meta.
 * Hoje ainda pendente NÃO quebra o streak (conta a partir de ontem).
 * at_most com dia sem log (0) cumpre o teto (ex.: "não fumei").
 *
 * `maxDays` limita a varredura à janela observada: como dias sem log contam
 * como dentro do teto em `at_most`, sem esse limite o laço caminharia pelo
 * passado indefinidamente e travaria a tela.
 */
export function streak(
  habit: Goal,
  byDate: Map<string, number>,
  today: string = localDateStr(),
  maxDays = 366
): number {
  if (habit.target == null) return 0;
  const valueOn = (d: string) => byDate.get(d) ?? 0;
  let date = today;
  if (!isMet(habit, valueOn(date))) date = prevDay(date); // hoje pendente: pula sem quebrar
  let count = 0;
  while (count < maxDays && isMet(habit, valueOn(date))) {
    count++;
    date = prevDay(date);
  }
  return count;
}

/**
 * Sequência de abstinência (hábito ruim): dias consecutivos, terminando hoje,
 * em que o hábito NÃO foi feito (value === 0) — "há quantos dias estou sem".
 * Diferente do `streak`, hoje conta: se já fez hoje (value > 0), volta a 0.
 *
 * `maxDays` limita a varredura (dias sem log contam como 0); passe a idade do
 * hábito (ver `daysInclusive`) para não exibir mais dias do que ele existe.
 */
export function cleanStreak(
  byDate: Map<string, number>,
  today: string = localDateStr(),
  maxDays = 366
): number {
  const valueOn = (d: string) => byDate.get(d) ?? 0;
  let date = today;
  let count = 0;
  while (count < maxDays && valueOn(date) === 0) {
    count++;
    date = prevDay(date);
  }
  return count;
}

/** Nº de dias no intervalo [from..today] inclusivo (criado hoje ⇒ 1). */
export function daysInclusive(from: string, today: string = localDateStr()): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${today}T00:00:00`).getTime();
  return Math.max(1, Math.floor((b - a) / 86400000) + 1);
}

/** Média simples de uma lista de valores diários. */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
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

export interface HeatCell {
  date: string;
  value: number;
  met: boolean;
}

/** Série de células para o heatmap: valor + flag de meta por dia. */
export function heatmap(habit: Goal, byDate: Map<string, number>, dates: string[]): HeatCell[] {
  return dates.map((date) => {
    const value = byDate.get(date) ?? 0;
    return { date, value, met: isMet(habit, value) };
  });
}
