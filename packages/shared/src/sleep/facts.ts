/**
 * As análises das subviews — fatos, não notas.
 *
 * Cada linha sob um gráfico é uma mediana com faixa, uma contagem ou uma
 * diferença. Nenhuma vira índice, seta ou meta. Se uma delas parecer placar
 * disfarçado, ela sai — é o combinado com o usuário (05/09/2026).
 *
 * Os textos saem daqui prontos, para web e mobile escreverem a mesma coisa;
 * o cálculo é o dos módulos vizinhos, este só junta e formata.
 */

import type { SleepPeriod } from '../models';
import { SLEEP_AXIS_ORIGIN_H, axisPosition, awakeningMin } from './timing';
import { awakeMinOf } from './derive';
import { median, quantile, type SleepBucket } from './buckets';
import { awakeningsByHour } from './awakenings';

export interface Fact {
  label: string;
  value: string;
}

/**
 * Um instante no histórico em que a fonte mudou — o dado antes e depois não é
 * comparável em contagem de despertares. É dado do usuário, não lógica: o app
 * o fornece.
 */
export interface SleepMarker {
  /** Primeiro dia de acordar da nova fonte. */
  day: string;
  label: string;
}

/** "HH:MM" de uma posição no eixo de origem 18h. */
export function clockOfAxis(pos: number): string {
  const h = (SLEEP_AXIS_ORIGIN_H + pos) % 24;
  const hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  let hOut = hh;
  if (mm === 60) {
    mm = 0;
    hOut = (hh + 1) % 24;
  }
  return `${String(hOut).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "6h52" — horas decimais para o rótulo que o app usa. */
export function formatHm(hours: number): string {
  const m = Math.round(hours * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

function signedMin(min: number): string {
  const r = Math.round(Math.abs(min));
  return `${min >= 0 ? '+' : '−'}${r} min`;
}

/** Sábado ou domingo, pelo dia de acordar (já é data local). */
export function isFreeWakeDay(day: string): boolean {
  const w = new Date(`${day}T12:00:00`).getDay();
  return w === 0 || w === 6;
}

/** Fatos do período em forma de noites (última · 7d · 4s). */
export function nightFacts(periods: readonly SleepPeriod[]): Fact[] {
  if (periods.length === 0) return [];
  if (periods.length === 1) {
    const p = periods[0];
    const aw = awakeMinOf(p);
    return [
      {
        label: 'Apagou → acordou',
        value: `${clockOfAxis(axisPosition(p.onsetAt, p.tzOffset))} → ${clockOfAxis(axisPosition(p.wakeAt, p.tzOffset))}`,
      },
      {
        label: 'Despertares',
        value: aw === null ? 'a fonte não reporta' : `${p.awakenings?.length ?? 0} · ${Math.round(aw)} min`,
      },
    ];
  }

  const on = periods.map((p) => axisPosition(p.onsetAt, p.tzOffset));
  const wk = periods.map((p) => axisPosition(p.wakeAt, p.tzOffset));
  const facts: Fact[] = [
    {
      label: 'Apagou (mediana · p25–p75)',
      value: `${clockOfAxis(median(on))} · ${clockOfAxis(quantile(on, 0.25))}–${clockOfAxis(quantile(on, 0.75))}`,
    },
    {
      label: 'Acordou (mediana · p25–p75)',
      value: `${clockOfAxis(median(wk))} · ${clockOfAxis(quantile(wk, 0.25))}–${clockOfAxis(quantile(wk, 0.75))}`,
    },
  ];

  const free = periods.filter((p) => isFreeWakeDay(p.wakeDay));
  const work = periods.filter((p) => !isFreeWakeDay(p.wakeDay));
  if (free.length >= 2 && work.length >= 2) {
    const diff =
      (median(free.map((p) => axisPosition(p.onsetAt, p.tzOffset))) -
        median(work.map((p) => axisPosition(p.onsetAt, p.tzOffset)))) *
      60;
    facts.push({ label: 'Fim de semana vs semana (apagar)', value: signedMin(diff) });
  }

  const reporting = periods.filter((p) => p.awakenings !== null);
  if (reporting.length > 0) {
    const withAw = reporting.filter((p) => (p.awakenings?.length ?? 0) > 0).length;
    facts.push({ label: 'Noites com despertar', value: `${withAw} de ${reporting.length}` });
    const mins = reporting.map((p) => awakeMinOf(p) ?? 0);
    facts.push({ label: 'Acordado por noite (mediana)', value: `${Math.round(median(mins))} min` });
  }
  return facts;
}

/**
 * Fatos do período em colunas (12m · ano · sempre).
 *
 * Quando o período cruza um marcador de troca de fonte, o tempo acordado sai
 * **separado por era** — a contagem de despertares não é comparável entre
 * relógios, e uma média única mentiria.
 */
export function bucketFacts(buckets: readonly SleepBucket[], markers: readonly SleepMarker[] = []): Fact[] {
  if (buckets.length === 0) return [];
  const nights = buckets.reduce((s, b) => s + b.nights, 0);
  const facts: Fact[] = [
    { label: 'Noites no período', value: String(nights) },
    {
      label: 'Apagou · acordou (mediana das colunas)',
      value: `${clockOfAxis(median(buckets.map((b) => b.onset.median)))} · ${clockOfAxis(median(buckets.map((b) => b.wake.median)))}`,
    },
  ];

  const crossing = markers.find((m) => buckets[0].key < m.day && buckets[buckets.length - 1].key >= m.day);
  const awakeOf = (bs: SleepBucket[]): number | null => {
    const xs = bs.map((b) => b.awakeMin).filter((m): m is number => m !== null);
    return xs.length ? median(xs) : null;
  };
  if (crossing) {
    const before = awakeOf(buckets.filter((b) => b.key < crossing.day));
    const after = awakeOf(buckets.filter((b) => b.key >= crossing.day));
    if (before !== null && after !== null) {
      facts.push({
        label: `Acordado/noite — antes · depois de ${crossing.label}`,
        value: `${Math.round(before)} · ${Math.round(after)} min`,
      });
    }
  } else {
    const aw = awakeOf([...buckets]);
    if (aw !== null) facts.push({ label: 'Acordado por noite (mediana)', value: `${Math.round(aw)} min` });
  }

  if (buckets.length >= 4) {
    const half = Math.floor(buckets.length / 2);
    const early = median(buckets.slice(0, half).map((b) => b.onset.median));
    const late = median(buckets.slice(half).map((b) => b.onset.median));
    facts.push({ label: 'Apagar: 1ª metade → 2ª metade', value: `${clockOfAxis(early)} → ${clockOfAxis(late)}` });
  }
  return facts;
}

/**
 * Fatos da subview de despertares: quando, quanto, com que frequência.
 *
 * "Hora mais comum" vem com o *n* ao lado e só aparece quando se repete em
 * pelo menos duas noites — um pico de uma noite é uma noite, não um padrão.
 */
export function awakeFacts(periods: readonly SleepPeriod[]): Fact[] {
  const reporting = periods.filter((p) => p.awakenings !== null);
  if (reporting.length === 0) return [{ label: 'Despertares', value: 'a fonte não reporta' }];

  const all = reporting.flatMap((p) =>
    (p.awakenings ?? []).map((a) => ({ day: p.wakeDay, min: awakeningMin(a), from: axisPosition(a.from, p.tzOffset) })),
  );
  const facts: Fact[] = [
    { label: 'Despertares por noite (mediana)', value: String(median(reporting.map((p) => p.awakenings?.length ?? 0))) },
  ];
  if (all.length === 0) return facts;

  const peak = awakeningsByHour(reporting).reduce((m, b) => (b.nights > m.nights ? b : m));
  if (peak.nights >= 2) {
    facts.push({
      label: 'Hora mais comum',
      value: `${clockOfAxis(peak.from)}–${clockOfAxis(peak.from + 1)} · ${peak.nights} de ${reporting.length} noites`,
    });
  }
  const mins = all.map((a) => a.min);
  facts.push({ label: 'Duração (mediana · p90)', value: `${Math.round(median(mins))} · ${Math.round(quantile(mins, 0.9))} min` });
  const longest = all.reduce((m, a) => (a.min > m.min ? a : m));
  facts.push({
    label: 'Mais longo',
    value: `${Math.round(longest.min)} min · ${Number(longest.day.slice(8))}/${longest.day.slice(5, 7)} às ${clockOfAxis(longest.from)}`,
  });

  const free = reporting.filter((p) => isFreeWakeDay(p.wakeDay)).map((p) => awakeMinOf(p) ?? 0);
  const work = reporting.filter((p) => !isFreeWakeDay(p.wakeDay)).map((p) => awakeMinOf(p) ?? 0);
  if (free.length >= 2 && work.length >= 2) {
    facts.push({ label: 'Fim de semana vs semana (acordado)', value: signedMin(median(free) - median(work)) });
  }
  return facts;
}
