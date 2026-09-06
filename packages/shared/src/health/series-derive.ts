/**
 * Derivações da série intradiária — o que as telas de "FC ao longo do dia"
 * desenham, em núcleo puro e testado (`series-derive.test.ts`).
 *
 * Spec: docs/specs/fc-serie/spec.md §5–6 · proposta aprovada em 05/09/2026.
 *
 * Quatro leituras saem de `HealthSeriesDay`:
 * - a linha do dia, quebrada em trechos onde há buraco (`heartLineRuns`);
 * - a faixa típica por hora, p25–p75 sobre todos os dias (`hourlyProfile`);
 * - a noite, cruzando a série com a janela de `sleep_periods` (`nightHeartRates`);
 * - o mapa dia × hora (`dayHourCells`).
 *
 * E duas projeções de instantes no minuto local de um dia, para sombrear o sono
 * e marcar o treino no mesmo eixo da série (`sleepSpansOnDay`, `activitySpansOnDay`).
 * O minuto local segue a regra da migration: `Date.UTC(dia) − tz_offset·60 s`.
 */
import type { HealthSeriesDay, SleepPeriod } from '../models';
import { expandSeriesDay } from './series';

/** Escala fixa do gráfico do dia: um dia calmo parece calmo ao lado de um dia de pedal. */
export const HEART_DAY_MIN_BPM = 40;
export const HEART_DAY_MAX_BPM = 170;
/** Buraco maior que isto quebra a linha em vez de ser interpolado: a ausência é dado. */
export const HEART_GAP_MINUTES = 10;
/** Menos pontos que isto dentro da janela de sono não é uma noite medida (≈1 h a cada 2 min). */
export const NIGHT_MIN_POINTS = 30;

/** Intervalo em minutos locais do dia, já recortado a [0, 1440]. */
export interface MinuteSpan {
  from: number;
  to: number;
}

export interface DaySeriesPoint {
  minute: number;
  value: number;
}

/** A série do dia em trechos contínuos: um buraco maior que `gapMinutes` recomeça o traço. */
export function heartLineRuns(
  minutes: readonly number[],
  readings: readonly number[],
  gapMinutes = HEART_GAP_MINUTES,
): DaySeriesPoint[][] {
  const runs: DaySeriesPoint[][] = [];
  let cur: DaySeriesPoint[] = [];
  for (let i = 0; i < minutes.length; i++) {
    const p = { minute: minutes[i], value: readings[i] };
    if (cur.length > 0 && p.minute - cur[cur.length - 1].minute > gapMinutes) {
      runs.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length > 0) runs.push(cur);
  return runs;
}

/** Percentil com interpolação linear, como o `percentile_cont` do Postgres. */
function percentile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface HourlyProfilePoint {
  hour: number;
  p25: number;
  p50: number;
  p75: number;
  n: number;
}

/**
 * A faixa típica: p25/p50/p75 de cada hora do dia sobre todos os dias dados.
 * Horas sem amostra ficam de fora. Diz "para você, 14h costuma ser entre 63 e 83".
 */
export function hourlyProfile(days: readonly HealthSeriesDay[]): HourlyProfilePoint[] {
  const byHour: number[][] = Array.from({ length: 24 }, () => []);
  for (const d of days) {
    for (let i = 0; i < d.minutes.length; i++) {
      byHour[Math.min(23, Math.floor(d.minutes[i] / 60))].push(d.readings[i]);
    }
  }
  const out: HourlyProfilePoint[] = [];
  byHour.forEach((vals, hour) => {
    if (vals.length === 0) return;
    const s = [...vals].sort((a, b) => a - b);
    out.push({
      hour,
      p25: Math.round(percentile(s, 0.25)),
      p50: Math.round(percentile(s, 0.5)),
      p75: Math.round(percentile(s, 0.75)),
      n: s.length,
    });
  });
  return out;
}

export interface DayHourCell {
  day: string;
  hour: number;
  value: number;
  n: number;
}

/** Média por (dia, hora) — as células do mapa de calor, em ordem de dia e hora. */
export function dayHourCells(days: readonly HealthSeriesDay[]): DayHourCell[] {
  const out: DayHourCell[] = [];
  for (const d of [...days].sort((a, b) => a.day.localeCompare(b.day))) {
    const sums = new Array<number>(24).fill(0);
    const counts = new Array<number>(24).fill(0);
    for (let i = 0; i < d.minutes.length; i++) {
      const h = Math.min(23, Math.floor(d.minutes[i] / 60));
      sums[h] += d.readings[i];
      counts[h] += 1;
    }
    for (let h = 0; h < 24; h++) {
      if (counts[h] > 0) out.push({ day: d.day, hour: h, value: Math.round(sums[h] / counts[h]), n: counts[h] });
    }
  }
  return out;
}

/** Instante ISO → ms. Aceita o `+00` sem minutos que o editor SQL devolve. */
export function parseInstant(iso: string): number {
  const s = iso.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  return Date.parse(s);
}

export interface NightHeartRate {
  wakeDay: string;
  onsetAt: string;
  wakeAt: string;
  /** Média da série dentro da janela dormindo, inteira. */
  mean: number;
  min: number;
  /** Instante (ms UTC) da mínima. */
  minAtMs: number;
  n: number;
}

/**
 * A FC de cada noite: os pontos da série cujo instante cai entre dormir e
 * acordar. Uma noite atravessa dois dias da tabela; por isso a busca é por
 * instante, não por dia. Noite com menos de `NIGHT_MIN_POINTS` pontos fica de
 * fora — é buraco de medição, não noite calma.
 */
export function nightHeartRates(
  days: readonly HealthSeriesDay[],
  periods: readonly SleepPeriod[],
): NightHeartRate[] {
  const expanded = days.map((d) => expandSeriesDay(d)).filter((p) => p.length > 0);
  const out: NightHeartRate[] = [];
  for (const p of periods) {
    const onset = parseInstant(p.onsetAt);
    const wake = parseInstant(p.wakeAt);
    if (!(wake > onset)) continue;
    let sum = 0;
    let n = 0;
    let min = Infinity;
    let minAt = 0;
    for (const pts of expanded) {
      if (pts[pts.length - 1].atMs < onset || pts[0].atMs > wake) continue;
      for (const q of pts) {
        if (q.atMs < onset || q.atMs > wake) continue;
        sum += q.value;
        n += 1;
        if (q.value < min) {
          min = q.value;
          minAt = q.atMs;
        }
      }
    }
    if (n < NIGHT_MIN_POINTS) continue;
    out.push({ wakeDay: p.wakeDay, onsetAt: p.onsetAt, wakeAt: p.wakeAt, mean: Math.round(sum / n), min, minAtMs: minAt, n });
  }
  return out.sort((a, b) => parseInstant(a.onsetAt) - parseInstant(b.onsetAt));
}

/**
 * Minuto local de um instante, no eixo de um dia com deslocamento `tzOffset`.
 * Pode sair de [0, 1440): negativo é "antes deste dia", maior é "depois".
 */
export function localMinuteOf(iso: string, day: string, tzOffset: number): number {
  const [y, m, d] = day.split('-').map(Number);
  const midnightMs = Date.UTC(y, m - 1, d) - tzOffset * 60_000;
  return (parseInstant(iso) - midnightMs) / 60_000;
}

function clipToDay(from: number, to: number): MinuteSpan | null {
  const a = Math.max(0, from);
  const b = Math.min(1440, to);
  return b > a ? { from: a, to: b } : null;
}

/**
 * As janelas dormindo que tocam o dia, no minuto local. Uma noite que atravessa
 * a meia-noite aparece em dois dias: até acordar num, desde dormir no outro.
 */
export function sleepSpansOnDay(
  day: string,
  tzOffset: number,
  periods: readonly SleepPeriod[],
): MinuteSpan[] {
  const out: MinuteSpan[] = [];
  for (const p of periods) {
    const span = clipToDay(localMinuteOf(p.onsetAt, day, tzOffset), localMinuteOf(p.wakeAt, day, tzOffset));
    if (span) out.push(span);
  }
  return out.sort((a, b) => a.from - b.from);
}

export interface ActivitySpanInput {
  startAt: string;
  endAt: string;
  name?: string;
}

export interface ActivitySpan extends MinuteSpan {
  name: string;
}

/** Os treinos que tocam o dia, no minuto local, com o rótulo curto da marca. */
export function activitySpansOnDay(
  day: string,
  tzOffset: number,
  activities: readonly ActivitySpanInput[],
): ActivitySpan[] {
  const out: ActivitySpan[] = [];
  for (const a of activities) {
    const span = clipToDay(localMinuteOf(a.startAt, day, tzOffset), localMinuteOf(a.endAt, day, tzOffset));
    if (span) out.push({ ...span, name: a.name ?? 'Treino' });
  }
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Rótulo curto para a marca de treino no topo do gráfico: o lugar, quando o
 * nome vem da Strava/intervals ("Schaarbeek Cycling" → "Schaarbeek"), e o tipo
 * quando o nome é genérico ("Treino"). Com os dois, "Schaarbeek · Ciclismo".
 */
export function activityMarkLabel(activityName: string | undefined, typeLabel?: string): string {
  const raw = (activityName ?? '').trim();
  const generic = raw === '' || /^(treino|workout|atividade)$/i.test(raw);
  if (generic) return typeLabel ?? 'Treino';
  const place = raw.replace(/\s+(cycling|running|ride|run|walk|walking|hike|swim|swimming)$/i, '');
  return typeLabel && place !== raw ? `${place} · ${typeLabel}` : place;
}
