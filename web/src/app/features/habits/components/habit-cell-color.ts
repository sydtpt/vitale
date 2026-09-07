import { MOD, habitCellLevel, type CounterHabit } from '@vitale/shared';

/**
 * A cor de uma célula de hábito na web.
 *
 * A **regra** (vazio / acima do limite / quanto do alvo) mora em
 * `habits/cell.ts` no núcleo, dividida com o detalhe do celular. Aqui fica só a
 * tradução para CSS — que é onde web e mobile realmente divergem.
 */
const EMPTY = 'var(--surface-mute)';

/** Acento do hábito, do vocabulário-base de módulos. */
export function habitAccent(habit: CounterHabit): string {
  return (MOD as Record<string, { accent: string }>)[habit.color]?.accent ?? MOD.habito.accent;
}

/**
 * Cor da célula para um valor.
 *
 * A mistura é contra `--surface` e não contra `white`: no escuro, clarear em
 * direção ao branco devolve um bloco luminoso sobre um card preto — a célula
 * fraca ficava mais visível que a forte.
 */
export function habitCellColor(habit: CounterHabit, value: number): string {
  const level = habitCellLevel(habit, value);
  if (level.kind === 'empty') return EMPTY;
  if (level.kind === 'over') return 'var(--primary-deep)';
  return `color-mix(in srgb, ${habitAccent(habit)} ${Math.round(level.pct)}%, var(--surface))`;
}

/** O tom de "nada aqui" — exposto para a legenda desenhar o mesmo cinza. */
export const HABIT_CELL_EMPTY = EMPTY;
