/**
 * Monta o `ReadinessInput` (score de prontidão) a partir das summaries em memória
 * da health store (janela de 7 dias). Reusa os agregadores diários e a fórmula
 * pura do `@vitale/shared`. Sem dependência nativa — testável.
 *
 * A VFC tem um fallback para `health_daily`: o Garmin não escreve HRV no Apple
 * Health, mas a ponte do intervals.icu grava a dele na tabela (ADR 0026). Só
 * entra quando o HealthKit não tem `'vfc'` na janela — o HealthKit vence.
 */
import {
  computeReadiness,
  localDateStr,
  rollingBaseline,
  type HealthDaily,
  type ReadinessInput,
  type ReadinessScore,
} from '@vitale/shared';
import type { Sample } from './health-buckets';
import { aggregateCumulative, aggregateDiscrete } from './health-aggregate';

/** Janela das summaries do HealthKit (`periodRange('week')`): hoje e os 6 dias anteriores. */
const WINDOW_DAYS = 7;

interface LatestAndBaseline {
  latest: number | null;
  baseline: number | null;
}

/** Valores diários (cronológicos) de uma métrica a partir das amostras da janela. */
function dailyValues(samples: Sample[], id: string, kind: 'cumulative' | 'discrete'): number[] {
  const rows = kind === 'cumulative'
    ? aggregateCumulative(samples, id, 'x')
    : aggregateDiscrete(samples, id, 'x');
  return rows.map((r) => r.value ?? 0);
}

/** Último valor + baseline (média móvel de 7 excluindo o dia corrente). */
function latestAndBaselineOf(vals: number[]): LatestAndBaseline {
  if (vals.length === 0) return { latest: null, baseline: null };
  const latest = vals[vals.length - 1];
  const baseline = vals.length > 1 ? rollingBaseline(vals.slice(0, -1), 7) : latest;
  return { latest, baseline };
}

/** Último valor diário + baseline a partir das amostras do HealthKit. */
function latestAndBaseline(samples: Sample[], id: string): LatestAndBaseline {
  return latestAndBaselineOf(dailyValues(samples, id, 'discrete'));
}

/**
 * A mesma regra sobre linhas de `health_daily`, com duas diferenças que a
 * revisão cobrou:
 *
 * **A baseline só usa leituras do mesmo tipo de medida.** O Apple Health grava
 * SDNN e o Garmin grava RMSSD (ADR 0026), em escalas diferentes. Uma janela em
 * que o relógio mediu um dia e a ponte mediu os outros produziria uma baseline
 * SDNN contra um valor RMSSD — a prontidão leria a troca de unidade como queda
 * fisiológica. `extra.kind` diz qual é qual; ausente em ambos também casa.
 *
 * **Uma leitura só não vira baseline.** Com `baseline === latest` o componente
 * marca exatamente 50 e ainda assim entra com peso cheio, e `coverage` sobe para
 * 1 — o número que existe justamente para avisar que falta informação. Sem
 * baseline o componente fica de fora, que é a resposta honesta na primeira noite.
 *
 * @param metric Quando dado, só linhas desta métrica contam. A store expõe
 *   `rows` e `seriesFor` lado a lado, e passar a lista inteira montaria uma
 *   baseline de VFC com passos e peso.
 */
export function latestAndBaselineFromRows(rows: HealthDaily[], metric?: string): LatestAndBaseline {
  const usable = rows
    .filter((r) => (metric == null || r.metric === metric) && r.value != null && Number.isFinite(r.value))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (usable.length === 0) return { latest: null, baseline: null };

  const last = usable[usable.length - 1];
  const kindOf = (r: HealthDaily): unknown => r.extra?.['kind'] ?? null;
  const sameKind = usable.slice(0, -1).filter((r) => kindOf(r) === kindOf(last));
  return {
    latest: last.value as number,
    baseline: sameKind.length > 0 ? rollingBaseline(sameKind.map((r) => r.value as number), 7) : null,
  };
}

/** Séries de `health_daily` que suprem o que o HealthKit não tem. */
export interface ReadinessFallback {
  /** Linhas `'vfc'` (qualquer fonte); só as da janela de 7 dias contam. */
  vfc?: HealthDaily[];
}

export function buildReadinessInput(
  summaries: Record<string, Sample[]>,
  fallback?: ReadinessFallback,
  now: Date = new Date(),
): ReadinessInput {
  const sono = dailyValues(summaries['sono'] ?? [], 'sono', 'cumulative');
  const fc = latestAndBaseline(summaries['fcRepouso'] ?? [], 'fcRepouso');
  let vfc = latestAndBaseline(summaries['vfc'] ?? [], 'vfc');
  if (vfc.latest == null && fallback?.vfc) {
    // Mesma janela das summaries: uma linha velha não vira "VFC de hoje". O teto
    // é hoje porque o ingest busca até amanhã, por causa do fuso do atleta.
    const today = localDateStr(now);
    const since = localDateStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (WINDOW_DAYS - 1)));
    vfc = latestAndBaselineFromRows(
      fallback.vfc.filter((r) => r.day >= since && r.day <= today),
      'vfc',
    );
  }
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

export function readinessFromSummaries(
  summaries: Record<string, Sample[]>,
  fallback?: ReadinessFallback,
  now: Date = new Date(),
): ReadinessScore {
  return computeReadiness(buildReadinessInput(summaries, fallback, now));
}
