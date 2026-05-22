/**
 * Monta o `ReadinessInput` (score de prontidão) a partir das summaries em memória
 * da health store (janela de 7 dias). Reusa os agregadores diários e a fórmula
 * pura do `@vitale/shared`. Sem dependência nativa — testável.
 */
import {
  computeReadiness,
  rollingBaseline,
  type ReadinessInput,
  type ReadinessScore,
} from '@vitale/shared';
import type { Sample } from './health-format';
import { aggregateCumulative, aggregateDiscrete } from './health-aggregate';

/** Valores diários (cronológicos) de uma métrica a partir das amostras da janela. */
function dailyValues(samples: Sample[], id: string, kind: 'cumulative' | 'discrete'): number[] {
  const rows = kind === 'cumulative'
    ? aggregateCumulative(samples, id, 'x')
    : aggregateDiscrete(samples, id, 'x');
  return rows.map((r) => r.value ?? 0);
}

/** Último valor diário + baseline (média móvel excluindo o dia corrente). */
function latestAndBaseline(samples: Sample[], id: string): { latest: number | null; baseline: number | null } {
  const vals = dailyValues(samples, id, 'discrete');
  if (vals.length === 0) return { latest: null, baseline: null };
  const latest = vals[vals.length - 1];
  const baseline = vals.length > 1 ? rollingBaseline(vals.slice(0, -1), 7) : latest;
  return { latest, baseline };
}

export function buildReadinessInput(summaries: Record<string, Sample[]>): ReadinessInput {
  const sono = dailyValues(summaries['sono'] ?? [], 'sono', 'cumulative');
  const fc = latestAndBaseline(summaries['fcRepouso'] ?? [], 'fcRepouso');
  const vfc = latestAndBaseline(summaries['vfc'] ?? [], 'vfc');
  const ringsPct = (summaries['aneis'] ?? []).map((s) => (s.extra && s.extra > 0 ? s.value / s.extra : 0));

  return {
    sleepHours: sono.length > 0 ? sono[sono.length - 1] : null,
    restingHr: fc.latest,
    restingHrBaseline: fc.baseline,
    hrv: vfc.latest,
    hrvBaseline: vfc.baseline,
    ringsPct,
  };
}

export function readinessFromSummaries(summaries: Record<string, Sample[]>): ReadinessScore {
  return computeReadiness(buildReadinessInput(summaries));
}
