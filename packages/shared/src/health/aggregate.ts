/**
 * Agregações Saúde × Esporte — derivações puras, sem I/O. Base da seção
 * "Recuperação" (web + mobile). Reúsa `computeReadiness`/`rollingBaseline`
 * (readiness.ts), `correlate` (trends.ts), `triggerImpact` (trigger-impact.ts)
 * e `HR_ZONES` (hr-zones.ts). Cada plataforma extrai os mapas dia→valor do seu
 * store e passa para cá; a UI só desenha o resultado.
 */
import type { Activity, HealthDaily } from '../models';
import { localDateStr } from '../date/local';
import { computeReadiness, rollingBaseline, type ReadinessScore } from './readiness';
import { correlate } from './trends';
import { triggerImpact } from './trigger-impact';

/** Zonas fortes de FC (limiar + máximo) — base da "carga forte". */
const HARD_ZONE_KEYS = ['z4', 'z5'];
/** Minutos em zona forte num dia para ele contar como "treino forte". */
const HARD_DAY_MIN = 15;

// ─────────────────────────────────────────────────────────────
// Helpers de data (locais, sem UTC)
// ─────────────────────────────────────────────────────────────

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(s: string, n: number): string {
  const d = parseDate(s);
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Segunda-feira (chave 'YYYY-MM-DD') da semana que contém `s`. */
function mondayKey(s: string): string {
  const d = parseDate(s);
  const dow = (d.getDay() + 6) % 7; // 0 = segunda
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow));
}

function shortLabel(s: string): string {
  const d = parseDate(s);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** Últimas `days` datas terminando em `now` (mais antiga → recente). */
function datesEndingAt(days: number, now: Date): string[] {
  const end = localDateStr(now);
  return Array.from({ length: days }, (_, i) => addDays(end, -(days - 1 - i)));
}

// ─────────────────────────────────────────────────────────────
// Extração de entradas de saúde por dia
// ─────────────────────────────────────────────────────────────

/** Valores brutos de prontidão de um dia. */
export interface ReadinessDayInput {
  sono?: number;
  restingHr?: number;
  hrv?: number;
  /** Frações 0..1 dos anéis (mover/exercício/em pé). */
  ringsPct?: number[];
}

/** Frações 0..1 dos anéis a partir do `extra` de uma linha `aneis`. */
export function ringsPctFromExtra(extra: Record<string, unknown> | undefined): number[] | undefined {
  if (!extra) return undefined;
  const out = ['move', 'exercise', 'stand'].map((k) => {
    const ring = extra[k] as { value?: number; goal?: number } | undefined;
    return ring?.goal ? (ring.value ?? 0) / ring.goal : 0;
  });
  return out;
}

/**
 * Monta o mapa dia → entradas de prontidão a partir das séries de `health_daily`.
 * Usado igualmente por web e mobile (mesma forma `HealthDaily`).
 */
export function readinessInputsByDay(series: {
  sono: HealthDaily[];
  fcRepouso: HealthDaily[];
  vfc: HealthDaily[];
  aneis: HealthDaily[];
}): Map<string, ReadinessDayInput> {
  const map = new Map<string, ReadinessDayInput>();
  const ensure = (day: string): ReadinessDayInput => {
    let v = map.get(day);
    if (!v) { v = {}; map.set(day, v); }
    return v;
  };
  for (const r of series.sono) if (r.value != null) ensure(r.day).sono = r.value;
  for (const r of series.fcRepouso) if (r.value != null) ensure(r.day).restingHr = r.value;
  for (const r of series.vfc) if (r.value != null) ensure(r.day).hrv = r.value;
  for (const r of series.aneis) {
    const pct = ringsPctFromExtra(r.extra);
    if (pct) ensure(r.day).ringsPct = pct;
  }
  return map;
}

/** Prontidão de um dia, com baselines de FC/VFC a partir dos dias anteriores. */
export function dayReadiness(
  inputsByDay: ReadonlyMap<string, ReadinessDayInput>,
  date: string,
): ReadinessScore {
  const today = inputsByDay.get(date);
  const prior = [...inputsByDay.keys()].filter((d) => d < date).sort();
  const restingPrior = prior.map((d) => inputsByDay.get(d)?.restingHr).filter((v): v is number => v != null);
  const hrvPrior = prior.map((d) => inputsByDay.get(d)?.hrv).filter((v): v is number => v != null);
  return computeReadiness({
    sleepHours: today?.sono ?? null,
    restingHr: today?.restingHr ?? null,
    restingHrBaseline: rollingBaseline(restingPrior, 7),
    hrv: today?.hrv ?? null,
    hrvBaseline: rollingBaseline(hrvPrior, 7),
    ringsPct: today?.ringsPct ?? null,
  });
}

// ─────────────────────────────────────────────────────────────
// 1. Carga diária forte (esporte como série)
// ─────────────────────────────────────────────────────────────

/** Minutos em zonas fortes (Z4+Z5) por dia local, a partir das atividades. */
export function dailyHardLoad(activities: Activity[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of activities) {
    if (a.hidden || !a.hrZones) continue;
    const secs = HARD_ZONE_KEYS.reduce((s, k) => s + (a.hrZones?.[k] ?? 0), 0);
    if (secs <= 0) continue;
    const day = localDateStr(new Date(a.startAt));
    map.set(day, (map.get(day) ?? 0) + secs / 60);
  }
  return map;
}

/** Dias com qualquer atividade visível (para marcar no gráfico de prontidão). */
export function activityDays(activities: Activity[]): Set<string> {
  const set = new Set<string>();
  for (const a of activities) if (!a.hidden) set.add(localDateStr(new Date(a.startAt)));
  return set;
}

// ─────────────────────────────────────────────────────────────
// 2. Tendência de prontidão (Card 3)
// ─────────────────────────────────────────────────────────────

export interface ReadinessPoint {
  date: string;
  label: string;
  /** 0–100, ou null quando não há dado de saúde no dia. */
  score: number | null;
  hasActivity: boolean;
}

/** Série diária de prontidão nos últimos `days`, com marcação de treino. */
export function readinessSeries(
  inputsByDay: ReadonlyMap<string, ReadinessDayInput>,
  actDays: ReadonlySet<string>,
  days = 30,
  now: Date = new Date(),
): ReadinessPoint[] {
  return datesEndingAt(days, now).map((date) => {
    const r = dayReadiness(inputsByDay, date);
    return {
      date,
      label: shortLabel(date),
      score: r.components.length > 0 ? r.total : null,
      hasActivity: actDays.has(date),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Carga vs Recuperação por semana (Card 1)
// ─────────────────────────────────────────────────────────────

export interface LoadRecoveryWeek {
  week: string;   // segunda 'YYYY-MM-DD'
  label: string;  // 'dd/mm'
  hardMin: number;
  /** Média de prontidão da semana (0–100), ou null sem dado. */
  recovery: number | null;
  /** true quando a recuperação caiu após uma semana de carga forte. */
  dip: boolean;
}

/**
 * Junta a carga forte semanal (Z4+Z5) com a prontidão média da semana, nas
 * últimas `weeks` semanas. `readinessByDay` é o mapa data→score (de `readinessSeries`).
 */
export function weeklyLoadVsRecovery(
  activities: Activity[],
  readinessByDay: ReadonlyMap<string, number>,
  weeks = 8,
  now: Date = new Date(),
): LoadRecoveryWeek[] {
  const hardByDay = dailyHardLoad(activities);
  const currentMonday = mondayKey(localDateStr(now));

  // chaves das `weeks` segundas (antiga → atual)
  const mondays: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) mondays.push(addDays(currentMonday, -i * 7));

  const hardByWeek = new Map<string, number>();
  for (const [day, min] of hardByDay) hardByWeek.set(mondayKey(day), (hardByWeek.get(mondayKey(day)) ?? 0) + min);

  const recoveryByWeek = new Map<string, number[]>();
  for (const [day, score] of readinessByDay) {
    const wk = mondayKey(day);
    const arr = recoveryByWeek.get(wk);
    if (arr) arr.push(score);
    else recoveryByWeek.set(wk, [score]);
  }

  const rows: LoadRecoveryWeek[] = mondays.map((week) => {
    const scores = recoveryByWeek.get(week);
    const recovery = scores && scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { week, label: shortLabel(week), hardMin: Math.round(hardByWeek.get(week) ?? 0), recovery, dip: false };
  });

  // dip: recuperação caiu vs semana anterior, que teve carga acima da média
  const avgHard = rows.reduce((a, r) => a + r.hardMin, 0) / (rows.length || 1);
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (cur.recovery != null && prev.recovery != null && cur.recovery < prev.recovery && prev.hardMin > avgHard) {
      cur.dip = true;
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────
// 4. Índice de bem-estar (Card 2)
// ─────────────────────────────────────────────────────────────

export type LoadTone = 'baixa' | 'moderada' | 'alta';

export interface WellnessSummary {
  /** 0–100 (prontidão do dia mais recente com dado); null se nada. */
  overall: number | null;
  /** Componentes de prontidão como categorias (Sono, FC, VFC, Anéis). */
  categories: { key: string; label: string; score: number }[];
  sport: {
    /** Treinos na semana corrente. */
    sessions: number;
    hardMin: number;
    loadLabel: LoadTone;
  };
}

function loadTone(hardMin: number): LoadTone {
  if (hardMin < 30) return 'baixa';
  if (hardMin < 90) return 'moderada';
  return 'alta';
}

/** Resumo agregado: bem-estar (prontidão recente) + faixa de esporte da semana. */
export function wellnessSummary(
  inputsByDay: ReadonlyMap<string, ReadinessDayInput>,
  activities: Activity[],
  now: Date = new Date(),
): WellnessSummary {
  // dia mais recente (até 7 dias atrás) com componentes de prontidão
  let score: ReadinessScore | null = null;
  for (const date of datesEndingAt(7, now).reverse()) {
    const r = dayReadiness(inputsByDay, date);
    if (r.components.length > 0) { score = r; break; }
  }

  const monday = mondayKey(localDateStr(now));
  const hardByDay = dailyHardLoad(activities);
  let weekHard = 0;
  for (const [day, min] of hardByDay) if (mondayKey(day) === monday) weekHard += min;

  const sessions = activities.filter(
    (a) => !a.hidden && mondayKey(localDateStr(new Date(a.startAt))) === monday,
  ).length;

  return {
    overall: score ? score.total : null,
    categories: (score?.components ?? []).map((c) => ({ key: c.key, label: c.label, score: Math.round(c.score) })),
    sport: { sessions, hardMin: Math.round(weekHard), loadLabel: loadTone(weekHard) },
  };
}

// ─────────────────────────────────────────────────────────────
// 5. Correlações Saúde × Esporte com defasagem de 1 dia (Card 4)
// ─────────────────────────────────────────────────────────────

export type InsightTone = 'good' | 'bad' | 'neutral';

export interface SportHealthInsight {
  key: string;
  label: string;
  /** Pearson do treino-forte(dia) × métrica(dia+1). */
  r: number;
  n: number;
  /** Frase pronta (ou de amostra insuficiente). */
  text: string;
  tone: InsightTone;
  enough: boolean;
}

/** Métricas de recuperação avaliadas e sua polaridade (↑ é bom?). */
const RECOVERY_METRICS: { key: 'vfc' | 'fcRepouso' | 'sono'; label: string; unit: string; upIsGood: boolean }[] = [
  { key: 'vfc', label: 'VFC', unit: ' ms', upIsGood: true },
  { key: 'fcRepouso', label: 'FC repouso', unit: ' bpm', upIsGood: false },
  { key: 'sono', label: 'Sono', unit: ' h', upIsGood: true },
];

/**
 * Para cada métrica de recuperação, mede o efeito do treino forte no DIA
 * SEGUINTE: trata "dia após treino forte" como evento (`triggerImpact`) e calcula
 * o Pearson defasado (`correlate`). `valuesByDay` traz o mapa data→valor de cada métrica.
 */
export function sportHealthCorrelations(
  activities: Activity[],
  valuesByDay: { vfc: Map<string, number>; fcRepouso: Map<string, number>; sono: Map<string, number> },
  _now: Date = new Date(),
): SportHealthInsight[] {
  const hardByDay = dailyHardLoad(activities);

  // evento = dia SEGUINTE a um treino forte; série defasada para o Pearson
  const eventDays = new Set<string>();
  const shiftedHard = new Map<string, number>();
  for (const [day, min] of hardByDay) {
    const next = addDays(day, 1);
    shiftedHard.set(next, min);
    if (min >= HARD_DAY_MIN) eventDays.add(next);
  }

  return RECOVERY_METRICS.map((m) => {
    const values = valuesByDay[m.key];
    const impact = triggerImpact(m.key, eventDays, values);
    const { coefficient: r, n } = correlate(shiftedHard, values);

    if (!impact.enough || impact.delta == null) {
      return { key: m.key, label: m.label, r, n, text: `${m.label}: dados insuficientes`, tone: 'neutral' as InsightTone, enough: false };
    }

    const delta = impact.delta;
    const sign = delta >= 0 ? '+' : '−';
    const abs = Math.abs(delta);
    const decimals = m.key === 'sono' ? 1 : 0;
    const pct = impact.deltaPct != null ? ` (${impact.deltaPct >= 0 ? '+' : '−'}${Math.abs(impact.deltaPct).toFixed(0)}%)` : '';
    const text = `Após treino forte: ${m.label} ${sign}${abs.toFixed(decimals)}${m.unit}${pct}`;

    // tom: melhora/piora conforme a polaridade da métrica
    const better = m.upIsGood ? delta > 0 : delta < 0;
    const tone: InsightTone = Math.abs(impact.deltaPct ?? 0) < 2 ? 'neutral' : better ? 'good' : 'bad';

    return { key: m.key, label: m.label, r, n, text, tone, enough: true };
  });
}

// ─────────────────────────────────────────────────────────────
// 6. Recap por período (push semanal + card mensal)
// ─────────────────────────────────────────────────────────────

/** Valor atual × período anterior de mesmo tamanho, com variação relativa. */
export interface RecapStat {
  current: number;
  prev: number;
  /** (current − prev) / prev × 100; null quando prev = 0. */
  deltaPct: number | null;
}

export interface PeriodRecap {
  days: number;
  sessions: RecapStat;
  distanceKm: RecapStat;
  durationMin: RecapStat;
  hardMin: RecapStat;
  /** Prontidão média do período (0–100). */
  avgReadiness: RecapStat;
  /** Maior distância única (km) no período atual. */
  longestKm: number;
}

function stat(current: number, prev: number): RecapStat {
  return { current, prev, deltaPct: prev > 0 ? ((current - prev) / prev) * 100 : null };
}

function meanIn(byDay: ReadonlyMap<string, number>, start: string, end: string): number {
  const vals: number[] = [];
  for (const [day, v] of byDay) if (day >= start && day <= end) vals.push(v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/**
 * Resumo do período (janela móvel de `days`) vs o período anterior de mesmo
 * tamanho. `readinessByDay` é o mapa data→score (de `readinessSeries`). Usado no
 * push semanal (days=7) e no card mensal da Recuperação (days=30).
 */
export function buildPeriodRecap(
  activities: Activity[],
  readinessByDay: ReadonlyMap<string, number>,
  days = 7,
  now: Date = new Date(),
): PeriodRecap {
  const end = localDateStr(now);
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const cur = { sessions: 0, meters: 0, secs: 0 };
  const prev = { sessions: 0, meters: 0, secs: 0 };
  let longest = 0;

  for (const a of activities) {
    if (a.hidden) continue;
    const day = localDateStr(new Date(a.startAt));
    const bucket = day >= start && day <= end ? cur : day >= prevStart && day <= prevEnd ? prev : null;
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.meters += a.distanceM ?? 0;
    bucket.secs += a.durationS ?? 0;
    if (bucket === cur) longest = Math.max(longest, a.distanceM ?? 0);
  }

  const hardByDay = dailyHardLoad(activities);
  let curHard = 0;
  let prevHard = 0;
  for (const [day, min] of hardByDay) {
    if (day >= start && day <= end) curHard += min;
    else if (day >= prevStart && day <= prevEnd) prevHard += min;
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    days,
    sessions: stat(cur.sessions, prev.sessions),
    distanceKm: stat(round1(cur.meters / 1000), round1(prev.meters / 1000)),
    durationMin: stat(Math.round(cur.secs / 60), Math.round(prev.secs / 60)),
    hardMin: stat(Math.round(curHard), Math.round(prevHard)),
    avgReadiness: stat(
      Math.round(meanIn(readinessByDay, start, end)),
      Math.round(meanIn(readinessByDay, prevStart, prevEnd)),
    ),
    longestKm: round1(longest / 1000),
  };
}

/** Texto curto do recap para a notificação (ex.: "32,4 km · 4 treinos · prontidão 74"). */
export function recapHeadline(r: PeriodRecap): string {
  const parts: string[] = [];
  if (r.distanceKm.current > 0) parts.push(`${r.distanceKm.current.toFixed(1).replace('.', ',')} km`);
  if (r.sessions.current > 0) parts.push(`${r.sessions.current} treino${r.sessions.current > 1 ? 's' : ''}`);
  if (r.avgReadiness.current > 0) parts.push(`prontidão ${r.avgReadiness.current}`);
  return parts.join(' · ');
}
