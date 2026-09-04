/**
 * Noites → colunas por semana ou por mês, para os períodos longos.
 *
 * Cada coluna é uma **noite típica**: a mediana de apagar e de acordar vira a
 * barra, o miolo p25–p75 vira a faixa em volta. A dispersão aparece como
 * largura da faixa — a regularidade continua sendo forma, não índice (spec §2).
 *
 * Tudo em coordenada de eixo (`axisPosition`, origem 18h), pelo `tzOffset` de
 * cada noite: uma semana com uma viagem no meio não tem as noites reescritas
 * pelo fuso do aparelho.
 *
 * O tempo acordado entra como média por noite. É comparável dentro de uma
 * fonte e **não** entre fontes — o Apple Watch reportava 11,8 despertares por
 * noite, o Garmin reporta 2,6–3,4. Por isso `facts.ts` separa as eras quando o
 * período cruza um marcador.
 */

import type { SleepPeriod } from '../models';
import { axisPosition } from './timing';
import { awakeMinOf } from './derive';

export type BucketKind = 'week' | 'month';

export interface SleepBucket {
  /** 'YYYY-MM-DD' da segunda-feira (semana) ou do dia 1 (mês). */
  key: string;
  kind: BucketKind;
  nights: number;
  /** Apagar, em horas de eixo: mediana e quartis. */
  onset: { median: number; p25: number; p75: number };
  /** Acordar, idem. */
  wake: { median: number; p25: number; p75: number };
  asleepH: number;
  /** Média de minutos acordado nas noites que reportam; `null` se nenhuma. */
  awakeMin: number | null;
  /** Noites com hora de deitar medida — alimenta a regra dos 80%. */
  bedMeasured: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Segunda-feira da semana de um 'YYYY-MM-DD'. */
export function weekKey(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  const back = (d.getDay() + 6) % 7; // dom=0 → 6 dias atrás; seg=1 → 0
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthKey(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function median(xs: readonly number[]): number {
  return quantile(xs, 0.5);
}

/** Quantil por interpolação linear — o mesmo que o `percentile_cont` do Postgres. */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

export function bucketPeriods(periods: readonly SleepPeriod[], kind: BucketKind): SleepBucket[] {
  const groups = new Map<string, SleepPeriod[]>();
  for (const p of periods) {
    const key = kind === 'week' ? weekKey(p.wakeDay) : monthKey(p.wakeDay);
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ps]) => {
      const on = ps.map((p) => axisPosition(p.onsetAt, p.tzOffset));
      const wk = ps.map((p) => axisPosition(p.wakeAt, p.tzOffset));
      const aw = ps.map(awakeMinOf).filter((m): m is number => m !== null);
      return {
        key,
        kind,
        nights: ps.length,
        onset: { median: median(on), p25: quantile(on, 0.25), p75: quantile(on, 0.75) },
        wake: { median: median(wk), p25: quantile(wk, 0.25), p75: quantile(wk, 0.75) },
        asleepH: ps.reduce((s, p) => s + p.asleepH, 0) / ps.length,
        awakeMin: aw.length ? aw.reduce((a, b) => a + b, 0) / aw.length : null,
        bedMeasured: ps.filter(
          (p) => p.inBedAt !== null && new Date(p.onsetAt).getTime() - new Date(p.inBedAt).getTime() >= 60_000,
        ).length,
      };
    });
}
