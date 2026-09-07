/**
 * A semântica de cor de uma célula de hábito — a **regra**, sem cor nenhuma.
 *
 * Nasceu em `web/.../habit-cell-color.ts` com um aviso no topo: "escrita duas
 * vezes, é questão de tempo até um dos painéis passar a pintar 'acima do
 * limite' de outro jeito". O detalhe no celular seria a segunda cópia — e a
 * terceira, o heatmap do ano — então a regra subiu para cá antes disso.
 *
 * O que fica em cada app é só a tradução para cor: a web resolve em
 * `color-mix(... , var(--surface))`, o mobile em `mix()` sobre o token
 * resolvido. A porcentagem, o "acima do limite" e o "dia limpo" são daqui.
 */

/** O que a célula é, antes de virar cor. */
export type HabitCellLevel =
  /** Sem registro — o cinza de fundo. */
  | { kind: 'empty' }
  /** Passou do limite de um hábito `at_most`, ou recaída num hábito ruim. */
  | { kind: 'over' }
  /** Acento diluído: `pct`% de acento sobre a superfície. */
  | { kind: 'fill'; pct: number };

/** Só o que a regra precisa saber do hábito. */
export interface HabitCellShape {
  bad: boolean;
  target?: number;
  direction: 'at_least' | 'at_most';
}

/**
 * Intensidade de um dia.
 *
 * Com meta, a escala é **adesão**: quanto do alvo o dia cumpriu. Sem meta, o
 * hábito não tem "quanto é muito" — aí ou se usa `scaleMax` (o maior dia da
 * grade, que é a leitura do heatmap anual: "quando foi mais forte neste ano"),
 * ou todo dia com registro fica no mesmo tom, que é o que a faixa de 84 dias
 * da web sempre fez.
 */
export function habitCellLevel(
  habit: HabitCellShape,
  value: number,
  opts: { scaleMax?: number } = {},
): HabitCellLevel {
  // Hábito ruim: qualquer dia com registro é uma recaída; dia limpo fica vazio.
  if (habit.bad) return value > 0 ? { kind: 'over' } : { kind: 'empty' };
  if (!(value > 0)) return { kind: 'empty' };

  if (habit.target == null || habit.target <= 0) {
    const max = opts.scaleMax;
    if (max == null || max <= 0) return { kind: 'fill', pct: 45 };
    return { kind: 'fill', pct: 25 + Math.min(1, value / max) * 60 };
  }

  if (habit.direction === 'at_least') {
    return { kind: 'fill', pct: 25 + Math.min(1, value / habit.target) * 60 };
  }
  // at_most: dentro do limite preenche suave; acima vira o vermelho da marca.
  if (value > habit.target) return { kind: 'over' };
  return { kind: 'fill', pct: 25 + (value / habit.target) * 55 };
}
