/**
 * As médias do topo da subview — e a regra de quando "na cama" pode aparecer.
 *
 * Medido em 05/09/2026: em última noite, 7d e 4s, **0%** das noites têm hora de
 * deitar — o Garmin abre a janela na cama junto com o sono. Uma média "na cama
 * 7h21" ali seria repetir "dormindo" com outro nome. A decisão: a média na cama
 * só aparece quando pelo menos 80% das noites do período medem a cama de
 * verdade (`bedtimeMeasured`); senão o segundo número vira **tempo acordado**,
 * que é o que a fonte atual reporta bem.
 *
 * Nada aqui é nota. São médias de grandezas que existem.
 */

import type { SleepPeriod } from '../models';
import { bedtimeMeasured } from './timing';
import { awakeMinOf } from './derive';

/** Fração mínima de noites com cama medida para a média "na cama" ser honesta. */
export const BED_AVG_MIN_SHARE = 0.8;

export type SecondaryAverage =
  | { kind: 'bed'; hours: number; share: number }
  | { kind: 'awake'; minutes: number; share: number };

export interface PeriodSummary {
  nights: number;
  /** Média de horas dormidas. */
  asleepH: number;
  /** O segundo número: cama, quando medida o bastante; senão, acordado. */
  secondary: SecondaryAverage | null;
  /** Fração das noites em que a cama foi medida de verdade. */
  bedMeasuredShare: number;
  /** Média de minutos acordado nas noites que reportam vigília; `null` se nenhuma reporta. */
  awakeMin: number | null;
}

const MS_H = 3_600_000;

export function periodSummary(periods: readonly SleepPeriod[]): PeriodSummary | null {
  if (periods.length === 0) return null;

  const asleepH = periods.reduce((s, p) => s + p.asleepH, 0) / periods.length;

  const measured = periods.filter(bedtimeMeasured);
  const share = measured.length / periods.length;
  const bedH =
    measured.length > 0
      ? measured.reduce(
          (s, p) => s + (new Date(p.inBedEnd!).getTime() - new Date(p.inBedAt!).getTime()) / MS_H,
          0,
        ) / measured.length
      : null;

  const reporting = periods.map(awakeMinOf).filter((m): m is number => m !== null);
  const awakeMin = reporting.length > 0 ? reporting.reduce((a, b) => a + b, 0) / reporting.length : null;

  let secondary: SecondaryAverage | null = null;
  if (share >= BED_AVG_MIN_SHARE && bedH !== null) secondary = { kind: 'bed', hours: bedH, share };
  else if (awakeMin !== null) secondary = { kind: 'awake', minutes: awakeMin, share };

  return { nights: periods.length, asleepH, secondary, bedMeasuredShare: share, awakeMin };
}
