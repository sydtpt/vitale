/**
 * A visão geral do Histórico **deste app** — os metadados de tipo amarrados.
 *
 * A agregação em si mora no núcleo (`@vitale/shared`, `fitness/overview`). Até
 * 27/08/2026 ela vivia aqui e, quase idêntica, em
 * `mobile/src/lib/activity-overview.ts`: 98,5% do código era o mesmo, e a única
 * diferença real era esta — de onde vêm o rótulo e a cor de um `activityId`.
 * Essa diferença virou o parâmetro `metaOf`, e é tudo o que sobrou daqui.
 *
 * A assinatura posicional foi preservada de propósito: os call sites e o
 * `overview.spec.ts` continuam valendo palavra por palavra, o que é o que torna
 * a mudança verificável.
 */
import type { Activity } from '@vitale/shared';
import {
  buildOverview as buildOverviewCore,
  type ActivityMetaLookup,
  type Metric,
  type Overview,
  type Period,
} from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

export type {
  LegendItem,
  Metric,
  Overview,
  OverviewBucket,
  OverviewTotals,
  Period,
  TypeSegment,
} from '@vitale/shared';
export { earliestActivityYear, metricValue, overviewYears, totalsDelta } from '@vitale/shared';

/** Ícone fica de fora: o agrupamento não usa, e o nome dele é próprio de cada app. */
const metaOf: ActivityMetaLookup = (activityId) => {
  const meta = metaForActivity(activityId);
  return { label: meta.label, color: meta.color };
};

export function buildOverview(
  activities: Activity[],
  period: Period,
  metric: Metric,
  now: Date = new Date(),
  hidden: ReadonlySet<string> = new Set(),
  weeklyTargetMin?: number,
  /** 0 = ano corrente, negativo = anos anteriores (convenção de period/bounds). */
  yearOffset: number = 0,
  /** Anos desmarcados nos botões do período "Sempre" (chave = `${ano}`). */
  hiddenYears: ReadonlySet<string> = new Set(),
): Overview {
  return buildOverviewCore(activities, period, metric, {
    metaOf,
    now,
    hidden,
    weeklyTargetMin,
    yearOffset,
    hiddenYears,
  });
}
