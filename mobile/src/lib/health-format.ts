/**
 * Helpers de agregação e formatação para a tab Saúde.
 * Normaliza amostras do Apple Health em buckets por Dia/Semana/Mês e calcula stats.
 */

export type Period = 'day' | 'week' | 'month';

/** Amostra normalizada vinda do HealthKit. */
export interface Sample {
  value: number;
  start: string; // ISO
  end: string; // ISO
  /** Rótulo para métricas categóricas (ex.: macro do nutriente). */
  label?: string;
  /** Valor secundário (ex.: diastólica na pressão arterial). */
  extra?: number;
  /** Bundle id da fonte que escreveu (só nas cumulativas multi-fonte). */
  source?: string;
}

/** Como agregar valores dentro de um bucket. */
export type MetricKind = 'cumulative' | 'discrete';

export interface Bucket {
  label: string;
  date: number; // ms — início do bucket
  value: number;
  count: number;
  empty: boolean;
}

export interface Stats {
  avg: number;
  min: number;
  max: number;
  total: number;
  latest: number;
  count: number;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Intervalo ISO coberto pelo período selecionado. */
export function periodRange(period: Period, now = new Date()): { startDate: string; endDate: string } {
  const end = new Date(now);
  const start = startOfDay(now);
  if (period === 'week') start.setDate(start.getDate() - 6);
  else if (period === 'month') start.setDate(start.getDate() - 29);
  // 'day' = só hoje (00:00 → agora)
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Quantos dias o período cobre (1 para 'day'). */
export function periodDays(period: Period): number {
  return period === 'day' ? 1 : period === 'week' ? 7 : 30;
}

/** Cria buckets vazios cobrindo todo o período (eixo X consistente). */
function emptyBuckets(period: Period, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  if (period === 'day') {
    const base = startOfDay(now).getTime();
    for (let h = 0; h < 24; h++) {
      buckets.push({
        label: `${String(h).padStart(2, '0')}h`,
        date: base + h * HOUR,
        value: 0,
        count: 0,
        empty: true,
      });
    }
  } else {
    const days = periodDays(period);
    const base = startOfDay(now);
    base.setDate(base.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const label = period === 'week' ? WEEKDAYS[d.getDay()] : String(d.getDate());
      buckets.push({ label, date: d.getTime(), value: 0, count: 0, empty: true });
    }
  }
  return buckets;
}

/** Distribui amostras nos buckets e agrega (soma para cumulative, média para discrete). */
export function bucketize(
  samples: Sample[],
  period: Period,
  kind: MetricKind,
  now = new Date()
): Bucket[] {
  const buckets = emptyBuckets(period, now);
  if (buckets.length === 0) return buckets;
  const origin = buckets[0].date;
  const step = period === 'day' ? HOUR : DAY;

  for (const s of samples) {
    const t = new Date(s.start).getTime();
    const idx = Math.floor((t - origin) / step);
    if (idx < 0 || idx >= buckets.length) continue;
    const b = buckets[idx];
    b.value += s.value;
    b.count += 1;
    b.empty = false;
  }

  if (kind === 'discrete') {
    for (const b of buckets) if (b.count > 0) b.value = b.value / b.count;
  }
  return buckets;
}

/** Estatísticas do período. Cumulative usa buckets diários; discrete usa amostras brutas. */
export function computeStats(samples: Sample[], buckets: Bucket[], kind: MetricKind): Stats {
  const values = samples.map((s) => s.value);
  const total = values.reduce((a, b) => a + b, 0);

  let avg = 0;
  let min = 0;
  let max = 0;

  if (kind === 'cumulative') {
    const filled = buckets.filter((b) => !b.empty).map((b) => b.value);
    if (filled.length > 0) {
      avg = filled.reduce((a, b) => a + b, 0) / filled.length;
      min = Math.min(...filled);
      max = Math.max(...filled);
    }
  } else if (values.length > 0) {
    avg = total / values.length;
    min = Math.min(...values);
    max = Math.max(...values);
  }

  // samples chegam ordenadas ascendentes → última é a mais recente
  const latest = samples.length > 0 ? samples[samples.length - 1].value : 0;
  return { avg, min, max, total, latest, count: values.length };
}

/** Formata número com separador de milhar pt-BR. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatHoursMin(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  const today = startOfDay(new Date()).getTime();
  const diff = Math.round((today - startOfDay(d).getTime()) / DAY);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/* ───────────────────────── Sono ───────────────────────── */

interface Interval { start: number; end: number }

/** Funde intervalos sobrepostos/contíguos numa lista disjunta (ordenada). */
function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }
  return merged;
}

/** Soma da sobreposição de `a` com cada intervalo de `list` (ms). */
function overlapMs(a: Interval, list: Interval[]): number {
  let ov = 0;
  for (const w of list) {
    const lo = Math.max(a.start, w.start);
    const hi = Math.min(a.end, w.end);
    if (hi > lo) ov += hi - lo;
  }
  return ov;
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toIntervals(samples: Sample[], match: (stage: string) => boolean): Interval[] {
  return samples
    .filter((s) => match((s.label ?? '').toUpperCase()))
    .map((s) => ({ start: new Date(s.start).getTime(), end: new Date(s.end).getTime() }))
    .filter((iv) => Number.isFinite(iv.start) && Number.isFinite(iv.end) && iv.end > iv.start);
}

/** Estágios de sono "dormindo" detalhados (Apple Watch, watchOS 9+/iOS 16+). */
const DETAILED_STAGES = new Set(['CORE', 'DEEP', 'REM']);

/**
 * Consolida amostras de estágios de sono em UMA linha por noite.
 *
 * O Apple Health junta várias fontes (Watch com estágios + iPhone/relógio com um
 * "ASLEEP" genérico + apps de terceiros) que se SOBREPÕEM no mesmo período.
 * Somar as durações conta o mesmo tempo várias vezes (causava ~2× o real).
 *
 * Estratégia (alinhada ao app Saúde da Apple):
 *  1. Prioriza a fonte detalhada: onde há estágios CORE/DEEP/REM, o ASLEEP
 *     genérico que os sobrepõe é DESCARTADO (o relógio é autoritativo). O genérico
 *     só entra onde não há estágios (relógio fora do pulso / aparelho antigo).
 *  2. Une os intervalos restantes (remove sobreposição entre fontes).
 *  3. Subtrai os trechos "acordado" (AWAKE).
 *  4. Atribui cada noite ao dia em que se ACORDOU (fim do trecho).
 * O `value` de cada amostra de saída é o total de horas dormidas da noite.
 */
export function aggregateSleepNights(samples: Sample[]): Sample[] {
  const detailed = mergeIntervals(toIntervals(samples, (st) => DETAILED_STAGES.has(st)));
  const awake = mergeIntervals(toIntervals(samples, (st) => st === 'AWAKE'));
  // ASLEEP genérico: mantém só os trechos sem nenhum estágio detalhado por baixo.
  const generic = mergeIntervals(toIntervals(samples, (st) => st === 'ASLEEP')).filter(
    (iv) => overlapMs(iv, detailed) === 0,
  );

  const asleep = mergeIntervals([...detailed, ...generic]);

  const byWakeDay = new Map<string, { hours: number; wake: number }>();
  for (const iv of asleep) {
    const net = iv.end - iv.start - overlapMs(iv, awake);
    if (net <= 0) continue;
    const key = localDayKey(iv.end); // dia em que acordou
    const cur = byWakeDay.get(key) ?? { hours: 0, wake: iv.end };
    cur.hours += net / HOUR;
    cur.wake = Math.max(cur.wake, iv.end);
    byWakeDay.set(key, cur);
  }

  return [...byWakeDay.values()]
    .sort((a, b) => a.wake - b.wake)
    .map((n) => ({
      value: n.hours,
      start: new Date(n.wake).toISOString(),
      end: new Date(n.wake).toISOString(),
      label: 'ASLEEP',
    }));
}

/* ───────────────────────── Fontes concorrentes ───────────────────────── */

/**
 * Elege UMA fonte por dia nas cumulativas (passos, distância, andares, energia).
 *
 * Mesmo problema do sono, outra métrica: o HealthKit deixa várias fontes
 * escreverem o mesmo tipo (iPhone + Apple Watch + Garmin Connect) e as
 * `HKStatisticsCollectionQuery` da lib devolvem `sumQuantity`, que é a soma de
 * TODAS elas. O app Saúde da Apple faz o contrário — deduplica por prioridade de
 * fonte —, então o app mostrava bem mais passos que o Saúde.
 *
 * Estratégia: por dia local, soma o total de cada fonte e mantém só as amostras
 * da fonte com o maior total (na prática o relógio, que registra mais que o
 * celular no bolso). Mantém as amostras CRUAS, então os buckets por hora da tela
 * de detalhe continuam funcionando.
 *
 * Limite conhecido: se duas fontes cobrirem trechos disjuntos do dia (relógio só
 * de manhã, celular à tarde), o total sai subestimado — ainda assim erra bem
 * menos que somar tudo.
 */
export function dedupeBySource(samples: Sample[]): Sample[] {
  const byDay = new Map<string, Map<string, Sample[]>>();
  for (const s of samples) {
    const day = localDayKey(new Date(s.start).getTime());
    let sources = byDay.get(day);
    if (!sources) byDay.set(day, (sources = new Map()));
    const key = s.source ?? '';
    const group = sources.get(key);
    if (group) group.push(s);
    else sources.set(key, [s]);
  }

  const kept: Sample[] = [];
  for (const sources of byDay.values()) {
    let winner: Sample[] | undefined;
    let best = -Infinity;
    for (const group of sources.values()) {
      const total = group.reduce((a, s) => a + s.value, 0);
      if (total > best) {
        best = total;
        winner = group;
      }
    }
    if (winner) kept.push(...winner);
  }
  return kept.sort((a, b) => a.start.localeCompare(b.start));
}
