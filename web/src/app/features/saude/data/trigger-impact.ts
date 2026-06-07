/**
 * Impacto de um gatilho comportamental sobre uma métrica de saúde.
 * Derivação pura, sem Angular/DOM — testável isoladamente. Ver
 * .claude/specs/correlacoes-gatilho/.
 *
 * Distinto do `correlate` do shared (Pearson entre duas séries contínuas):
 * aqui o gatilho é um EVENTO categórico por dia (um hábito-ruim registrado,
 * um Registro marcado) e comparamos a MÉDIA da métrica nos dias COM evento vs
 * nos dias SEM evento. Responde "dias com álcool: FC repouso +6 bpm".
 *
 * Aviso estatístico: é observacional e de amostra pequena — associação, não
 * causa. Por isso exigimos um mínimo de dias de cada lado antes de concluir.
 */
import { mean } from '@vitale/shared';

/** Mínimo de dias COM e SEM evento para a diferença ser exibível. */
export const MIN_DAYS_PER_SIDE = 3;

export interface MetricImpact {
  /** id da métrica (`fcRepouso`, `vfc`, `sono`…). */
  metric: string;
  /** Média nos dias com evento; null se amostra insuficiente. */
  withMean: number | null;
  /** Média nos dias sem evento; null se amostra insuficiente. */
  withoutMean: number | null;
  /** withMean − withoutMean; null se insuficiente. */
  delta: number | null;
  /** delta relativo à média sem evento (%); null se insuficiente ou base 0. */
  deltaPct: number | null;
  nWith: number;
  nWithout: number;
  /** true quando há dias suficientes dos dois lados (≥ MIN_DAYS_PER_SIDE). */
  enough: boolean;
}

/**
 * Compara a média de uma métrica entre dias COM e SEM o gatilho.
 * Universo = dias que têm valor da métrica; quando `sinceDate` é dado, restringe
 * aos dias `>= sinceDate` (idade do gatilho), para não comparar com período em
 * que o hábito nem existia.
 */
export function triggerImpact(
  metric: string,
  eventDays: ReadonlySet<string>,
  valuesByDay: ReadonlyMap<string, number>,
  sinceDate?: string,
): MetricImpact {
  const withVals: number[] = [];
  const withoutVals: number[] = [];

  for (const [day, value] of valuesByDay) {
    if (sinceDate && day < sinceDate) continue;
    if (eventDays.has(day)) withVals.push(value);
    else withoutVals.push(value);
  }

  const nWith = withVals.length;
  const nWithout = withoutVals.length;
  const enough = nWith >= MIN_DAYS_PER_SIDE && nWithout >= MIN_DAYS_PER_SIDE;

  if (!enough) {
    return { metric, withMean: null, withoutMean: null, delta: null, deltaPct: null, nWith, nWithout, enough };
  }

  const withMean = mean(withVals);
  const withoutMean = mean(withoutVals);
  const delta = withMean - withoutMean;
  const deltaPct = withoutMean !== 0 ? (delta / withoutMean) * 100 : null;

  return { metric, withMean, withoutMean, delta, deltaPct, nWith, nWithout, enough };
}
