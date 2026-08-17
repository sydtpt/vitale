/**
 * Impacto de um gatilho/evento categórico sobre uma métrica de saúde.
 * Derivação pura, sem I/O — compartilhada por web e mobile. Ver
 * docs/specs/correlacoes-gatilho/.
 *
 * Distinto do `correlate` (Pearson entre duas séries contínuas): aqui o gatilho
 * é um EVENTO por dia (um hábito-ruim, um Registro, ou "dia seguinte a treino
 * forte") e comparamos a MÉDIA da métrica nos dias COM evento vs nos dias SEM.
 *
 * Aviso estatístico: é observacional e de amostra pequena — associação, não
 * causa. Por isso exigimos um mínimo de dias de cada lado antes de concluir.
 */
import { mean } from './trends';

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
 * aos dias `>= sinceDate`, para não comparar com período em que o gatilho nem existia.
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
