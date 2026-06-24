/**
 * A lógica de recap semanal foi promovida ao pacote `@vitale/shared`
 * (`packages/shared/src/week/recap.ts`) para ser compartilhada com o mobile.
 * Este arquivo é apenas um reexport para não quebrar os imports relativos
 * existentes (`./weekly-recap`).
 */
export {
  mondayOf,
  weekBounds,
  weekLabel,
  activityRecap,
  metricRecap,
  countRecap,
} from '@vitale/shared';

export type {
  RecapValue,
  ActivityTotals,
  ActivityRecap,
  MetricWeekAvg,
  MetricRecap,
} from '@vitale/shared';
