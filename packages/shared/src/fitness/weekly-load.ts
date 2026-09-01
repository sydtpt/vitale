/**
 * Carga semanal: o tempo em zonas de FC, semana a semana.
 *
 * ## De onde veio
 *
 * Nasceu em `web/.../workout-history/data/weekly-load.ts` (spec em
 * `docs/specs/carga-semanal/`), pura desde o começo — e por isso mesmo presa na
 * pasta de uma feature, invisível para o mobile. É a feature que responde
 * "estou treinando leve demais ou forte demais?", e o Sydnei olha isso no
 * celular, depois de correr. *"Se não tem no mobile, eu não vejo."* Subiu sem
 * mudar uma regra; o card da web virou adaptador.
 *
 * ## O que calcula
 *
 * Soma `activity.hrZones[z]` (segundos) por semana (seg–dom, hora local) numa
 * janela móvel de N semanas, e deriva a **polarização** da semana atual (leve
 * Z1–Z2 contra forte Z4–Z5) e um **alerta de carga**: forte da semana acima de
 * 1,5× a média das anteriores, com pelo menos duas de base. Os buckets são
 * estruturalmente `OverviewBucket` — entram direto no gráfico empilhado dos
 * dois apps.
 */
import type { Activity } from '../models';
import { HR_ZONES } from '../health/hr-zones';
import { localDateStr } from '../date/local';
import { mondayOf } from '../week/recap';

/** Uma semana da janela, pronta para o gráfico de barras empilhadas. */
export interface WeekLoadBucket {
  /** 'YYYY-MM-DD' da segunda-feira. */
  key: string;
  /** 'dd/mm' da segunda. */
  label: string;
  /** Segundos em todas as zonas na semana. */
  total: number;
  /** Z1..Z5 com `value > 0`, na ordem das zonas. */
  segments: { label: string; color: string; value: number }[];
}

/** Distribuição leve/forte de uma semana. */
export interface Polarization {
  /** Z1 + Z2, em segundos. */
  easyS: number;
  /** Z4 + Z5, em segundos. */
  hardS: number;
  /** Todas as zonas. */
  totalS: number;
  /** `easyS / totalS × 100`; 0 quando `totalS` é 0. */
  easyPct: number;
}

export interface WeeklyLoad {
  /** N buckets, da semana mais antiga à atual. */
  buckets: WeekLoadBucket[];
  /** Da semana atual. */
  polarization: Polarization;
  /** Z4+Z5 da semana atual acima de 1,5× a média das anteriores (≥ 2 com dado). */
  highLoadAlert: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fator sobre o baseline que dispara o alerta de carga forte. */
export const HIGH_LOAD_FACTOR = 1.5;
/** Mínimo de semanas com dado para o baseline ser confiável. */
export const MIN_BASELINE_WEEKS = 2;

const EASY_KEYS = ['z1', 'z2'];
const HARD_KEYS = ['z4', 'z5'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function labelOf(monday: Date): string {
  return `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
}

function sumKeys(zones: Record<string, number> | undefined, keys: string[]): number {
  if (!zones) return 0;
  return keys.reduce((sum, k) => sum + (zones[k] ?? 0), 0);
}

export function buildWeeklyLoad(
  activities: readonly Activity[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyLoad {
  const currentMonday = mondayOf(now);

  // chave da segunda → (chave da zona → segundos acumulados)
  const perWeek = new Map<string, Map<string, number>>();
  for (const a of activities) {
    const z = a.hrZones;
    if (!z) continue;
    const wk = localDateStr(mondayOf(new Date(a.startAt)));
    const agg = perWeek.get(wk) ?? new Map<string, number>();
    for (const def of HR_ZONES) {
      const secs = z[def.key];
      if (typeof secs === 'number' && secs > 0) {
        agg.set(def.key, (agg.get(def.key) ?? 0) + secs);
      }
    }
    perWeek.set(wk, agg);
  }

  // janela móvel: `weeks` semanas terminando na atual (antiga → atual)
  const buckets: WeekLoadBucket[] = [];
  const hardByWeek: number[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday.getTime() - i * 7 * DAY_MS);
    const wk = localDateStr(monday);
    const agg = perWeek.get(wk);
    const segments = HR_ZONES.map((def) => ({
      label: def.label,
      color: def.color,
      value: agg?.get(def.key) ?? 0,
    })).filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    buckets.push({ key: wk, label: labelOf(monday), total, segments });
    hardByWeek.push(sumKeys(agg ? Object.fromEntries(agg) : undefined, HARD_KEYS));
  }

  const current = perWeek.get(localDateStr(currentMonday));
  const currentZones = current ? Object.fromEntries(current) : undefined;
  const easyS = sumKeys(currentZones, EASY_KEYS);
  const hardS = sumKeys(currentZones, HARD_KEYS);
  const totalS = HR_ZONES.reduce((sum, def) => sum + (current?.get(def.key) ?? 0), 0);
  const polarization: Polarization = {
    easyS,
    hardS,
    totalS,
    easyPct: totalS > 0 ? (easyS / totalS) * 100 : 0,
  };

  // baseline = média de Z4+Z5 das semanas anteriores (exclui a atual) com carga forte > 0
  const priorHard = hardByWeek.slice(0, -1).filter((v) => v > 0);
  const baseline = priorHard.length ? priorHard.reduce((a, b) => a + b, 0) / priorHard.length : 0;
  const highLoadAlert = priorHard.length >= MIN_BASELINE_WEEKS && hardS > baseline * HIGH_LOAD_FACTOR;

  return { buckets, polarization, highLoadAlert };
}
