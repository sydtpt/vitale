import { MOD, type CounterHabit } from '@vitale/shared';

/**
 * A semântica de cor de uma célula de hábito, num lugar só.
 *
 * Dois painéis desenham a mesma grade com a mesma regra — a análise de 84 dias
 * na tela de Hábitos e a semana na tela Semana. Escrita duas vezes, é questão de
 * tempo até um deles passar a pintar "acima do limite" de outro jeito, e aí a
 * mesma cor significa coisas diferentes em telas vizinhas.
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
  // Hábito ruim: qualquer dia com registro é uma recaída; dia limpo fica vazio.
  if (habit.bad) return value > 0 ? 'var(--primary-deep)' : EMPTY;

  const acc = habitAccent(habit);
  const mix = (pct: number) => `color-mix(in srgb, ${acc} ${Math.round(pct)}%, var(--surface))`;
  if (value <= 0) return EMPTY;
  if (habit.target == null || habit.target <= 0) return mix(45);
  if (habit.direction === 'at_least') {
    const p = Math.min(1, value / habit.target);
    return mix(25 + p * 60);
  }
  // at_most: dentro do limite preenche suave; acima vira vermelho.
  if (value > habit.target) return 'var(--primary-deep)';
  const p = value / habit.target;
  return mix(25 + p * 55);
}

/** O tom de "nada aqui" — exposto para a legenda desenhar o mesmo cinza. */
export const HABIT_CELL_EMPTY = EMPTY;
