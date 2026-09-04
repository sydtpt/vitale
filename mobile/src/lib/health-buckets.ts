/**
 * Agregação de amostras do Apple Health em buckets por período, para a tab Saúde.
 * Renomeado de `health-format`: 300 das 309 linhas agregam, não formatam — e o nome
 * antigo colidia com `web/.../health-format.ts`, que de fato só formata datas.
 * Normaliza amostras do Apple Health em buckets por Dia/Semana/Mês e calcula stats.
 */
import { DIAS_ABREV, localDateStr, type SleepPeriod } from '@vitale/shared';

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
  /** Detalhamento em horas por estágio (só no sono — ver `aggregateSleepNights`). */
  stages?: Record<string, number>;
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
      const label = period === 'week' ? DIAS_ABREV[d.getDay()] : String(d.getDate());
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

/** Remove de `list` todo trecho coberto por `cut`, devolvendo o que sobrou. */
function subtractIntervals(list: Interval[], cut: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const iv of list) {
    let parts: Interval[] = [{ ...iv }];
    for (const c of cut) {
      const next: Interval[] = [];
      for (const p of parts) {
        if (c.end <= p.start || c.start >= p.end) {
          next.push(p); // disjuntos: o corte não toca esta parte
          continue;
        }
        if (c.start > p.start) next.push({ start: p.start, end: c.start });
        if (c.end < p.end) next.push({ start: c.end, end: p.end });
      }
      parts = next;
    }
    out.push(...parts);
  }
  return out;
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
 * Ordem em que os estágios reivindicam o tempo dormido. Fontes sobrepostas podem
 * marcar o mesmo minuto com estágios diferentes; o mais específico ganha, para que
 * a soma dos estágios feche com o total da noite em vez de estourá-lo.
 */
const STAGE_PRIORITY = ['DEEP', 'REM', 'CORE'] as const;

/**
 * Piso para aceitar uma latência como MEDIDA de fato.
 *
 * Nem toda fonte separa "na cama" de "dormindo": o Garmin abre o `INBED` **1
 * segundo** antes do sono, sempre — não é medida imprecisa, é constante. O Apple
 * Watch, que mede a janela real, nunca desceu de 90s em 41 noites do histórico.
 * Um corte em 1 min separa os dois casos sem descartar medida legítima: ninguém
 * adormece em menos de um minuto ao deitar.
 *
 * Abaixo do piso não gravamos `onset` — e a ausência dele COM `inbed` presente é
 * o que distingue "a fonte não mede" de "não havia dado de cama". Gravar zero
 * seria pior que não gravar: um zero se disfarça de "apagou na hora".
 */
const MIN_ONSET_MS = 60_000;

/**
 * Consolida amostras de estágios de sono em UM período por noite (`SleepPeriod`
 * do núcleo, com instantes). `aggregateSleepNights`, abaixo, projeta a forma
 * antiga — uma `Sample` por noite — a partir daqui.
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
 *
 * Cada noite também sai com `stages`, o detalhamento em horas:
 *  - `deep`/`rem`/`core` — estágios detalhados, fatiados por prioridade para não
 *    contar o mesmo minuto duas vezes quando fontes se sobrepõem;
 *  - `unspecified` — dormido sem hipnograma (fonte que só grava ASLEEP genérico);
 *  - `awake` — despertares DENTRO da janela da noite. Fora do total, não somado:
 *    `deep + rem + core + unspecified = value`, e `awake` é métrica à parte.
 *  - a janela na cama sai como INSTANTES (`inBedAt`/`inBedEnd`), crua; na
 *    projeção antiga vira `inbed`/`onset` em horas. `onset` é o único sinal de
 *    insônia de INÍCIO: sem ele, duas horas rolando na cama viram apenas "uma
 *    noite curta", indistinguível de ter deitado tarde. Só existe se a fonte
 *    gravar `INBED` (o Watch grava). `inbed` sem `onset` significa que a FONTE
 *    não separa cama de sono (ver `MIN_ONSET_MS`) — estado distinto de não
 *    haver dado de cama nenhum.
 *  - `awakenings` — os despertares INDIVIDUAIS, dentro do vão da noite. `null`
 *    quando a fonte não reporta vigília, `[]` quando reporta e não houve.
 */
export function aggregateSleepPeriods(samples: Sample[], userId = ''): SleepPeriod[] {
  const detailed = mergeIntervals(toIntervals(samples, (st) => DETAILED_STAGES.has(st)));
  const awake = mergeIntervals(toIntervals(samples, (st) => st === 'AWAKE'));
  // ASLEEP genérico: mantém só os trechos sem nenhum estágio detalhado por baixo.
  const generic = mergeIntervals(toIntervals(samples, (st) => st === 'ASLEEP')).filter(
    (iv) => overlapMs(iv, detailed) === 0,
  );

  const asleep = mergeIntervals([...detailed, ...generic]);
  const inbed = mergeIntervals(toIntervals(samples, (st) => st === 'INBED'));

  // Fatia o tempo por estágio: cada um leva só o que os anteriores (e o AWAKE,
  // que não é sono) não reivindicaram. O resto do tempo dormido é `unspecified`.
  let claimed = awake;
  const byStage = new Map<string, Interval[]>();
  for (const stage of STAGE_PRIORITY) {
    const own = subtractIntervals(
      mergeIntervals(toIntervals(samples, (st) => st === stage)),
      claimed,
    );
    byStage.set(stage.toLowerCase(), own);
    claimed = mergeIntervals([...claimed, ...own]);
  }

  const byWakeDay = new Map<
    string,
    { hours: number; wake: number; onset: number; stages: Record<string, number>; bed: Interval | null }
  >();
  for (const iv of asleep) {
    const awakeMs = overlapMs(iv, awake);
    const net = iv.end - iv.start - awakeMs;
    if (net <= 0) continue;
    const key = localDayKey(iv.end); // dia em que acordou
    const cur = byWakeDay.get(key) ?? { hours: 0, wake: iv.end, onset: iv.start, stages: {}, bed: null };
    cur.hours += net / HOUR;
    cur.wake = Math.max(cur.wake, iv.end);
    cur.onset = Math.min(cur.onset, iv.start); // primeiro instante dormindo da noite

    let staged = 0;
    for (const [stage, list] of byStage) {
      const ms = overlapMs(iv, list);
      if (ms <= 0) continue;
      staged += ms;
      cur.stages[stage] = (cur.stages[stage] ?? 0) + ms / HOUR;
    }
    // O que sobrou de sono sem estágio detalhado por baixo.
    const rest = net - staged;
    if (rest > 0) cur.stages.unspecified = (cur.stages.unspecified ?? 0) + rest / HOUR;
    // `awake` NÃO é somado aqui, por intervalo: é creditado uma vez por noite,
    // pelo vão da noite inteira — ver o `return` abaixo e o porquê.

    byWakeDay.set(key, cur);
  }

  // Tempo na cama e latência para pegar no sono: ancora no trecho INBED que
  // cobre o instante em que se apagou (`>=` no fim para as fontes que gravam
  // INBED só até o adormecer, sem se estender pela noite).
  // A janela na cama vai CRUA para o período: a duração dela é grandeza real
  // mesmo quando o instante não é (o Garmin abre o INBED junto com o sono em 41
  // de 42 noites). Quem decide se o instante vira "hora que deitou" é
  // `bedtimeMeasured()` no núcleo; `inbed`/`onset` em horas saem de lá também.
  for (const night of byWakeDay.values()) {
    night.bed = inbed.find((b) => b.start <= night.onset && b.end >= night.onset) ?? null;
  }

  // Vigília creditada UMA vez por noite, pelo vão de [onset, wake] — não pela
  // sobreposição com cada intervalo dormindo. Fonte em camadas (Apple Watch,
  // AWAKE por cima do envelope) dá o mesmo resultado de antes; fonte em
  // segmentos encostados (Garmin, CORE·AWAKE·CORE) deixa de perder tudo — o
  // diagnóstico de 04/09/2026 achou 36 de 38 noites zeradas por isso. O que
  // fica ANTES do onset não é despertar, é latência, e mora no `onset`.
  //
  // `null` ≠ `[]`: se a janela inteira não tem UMA amostra AWAKE, a fonte não
  // reporta vigília e a noite recebe `null`; se tem, a noite sem despertar
  // recebe `[]`. A diferença chega até a tela ("não sei" vs "dormiu direto").
  const reportsAwake = samples.some((s) => (s.label ?? '').toUpperCase() === 'AWAKE');

  return [...byWakeDay.values()]
    .sort((a, b) => a.wake - b.wake)
    .map((n): SleepPeriod => {
      const holes = awake
        .map((a) => ({ start: Math.max(a.start, n.onset), end: Math.min(a.end, n.wake) }))
        .filter((h) => h.end > h.start);
      const awakeH = holes.reduce((s, h) => s + (h.end - h.start), 0) / HOUR;
      const stages: Record<string, number> = { ...n.stages };
      if (awakeH > 0) stages.awake = awakeH;

      return {
        userId,
        onsetAt: new Date(n.onset).toISOString(),
        wakeAt: new Date(n.wake).toISOString(),
        inBedAt: n.bed ? new Date(n.bed.start).toISOString() : null,
        inBedEnd: n.bed ? new Date(n.bed.end).toISOString() : null,
        // Sinal invertido de propósito: o JS devolve minutos ATRÁS do UTC
        // (Bruxelas no verão = −120); o esquema guarda minutos vs UTC (+120).
        // É o fuso do aparelho NAQUELE instante — cobre o horário de verão, não
        // cobre viagem: o provider não expõe o fuso da amostra do HealthKit.
        tzOffset: -new Date(n.onset).getTimezoneOffset(),
        wakeDay: localDateStr(new Date(n.wake)),
        asleepH: n.hours,
        awakenings: reportsAwake
          ? holes.map((h) => ({
              from: new Date(h.start).toISOString(),
              to: new Date(h.end).toISOString(),
            }))
          : null,
        stages: Object.keys(stages).length > 0 ? stages : null,
      };
    });
}

/**
 * A forma antiga — uma `Sample` por noite, `start`/`end` no instante de acordar,
 * `stages` com `inbed`/`onset` em horas — projetada dos períodos. É o que a aba
 * Saúde e o diagnóstico consomem; o sync não passa mais por aqui.
 *
 * Projeção, não reimplementação: se os dois caminhos divergirem, o teste de
 * paridade em `health-sleep.test.ts` acusa antes do backfill.
 */
export function aggregateSleepNights(samples: Sample[]): Sample[] {
  return aggregateSleepPeriods(samples).map((p) => {
    const stages: Record<string, number> = { ...(p.stages ?? {}) };
    if (p.inBedAt && p.inBedEnd) {
      const bedStart = new Date(p.inBedAt).getTime();
      stages.inbed = (new Date(p.inBedEnd).getTime() - bedStart) / HOUR;
      const latency = new Date(p.onsetAt).getTime() - bedStart;
      if (latency >= MIN_ONSET_MS) stages.onset = latency / HOUR;
    }
    return { value: p.asleepH, start: p.wakeAt, end: p.wakeAt, label: 'ASLEEP', stages };
  });
}

/**
 * Quanto da vigília o agregador **credita**, contra quanto dela **existe**.
 *
 * A regra de `aggregateSleepNights` é que `AWAKE` só conta onde ele se sobrepõe a
 * um intervalo dormindo (`overlapMs(iv, awake)`). Isso é correto quando a fonte
 * escreve camadas que se cobrem — o Apple Watch faz isso —, e é uma armadilha
 * quando a fonte escreve segmentos **encostados**: `CORE`, `AWAKE`, `CORE`. Aí o
 * `AWAKE` preenche o buraco *entre* os intervalos de sono em vez de cair *dentro*
 * deles, a sobreposição dá zero, e a vigília some sem deixar rastro.
 *
 * Motivo de existir: `health_daily` tem `awake` em 233 das 270 noites da era
 * Apple Watch e em **0 das 42** da era Garmin. Duas explicações cabem no mesmo
 * silêncio — a fonte não escreve, ou nós descartamos — e elas levam a decisões
 * opostas. Esta função separa as duas usando a construção **idêntica** à do
 * agregador; um diagnóstico que reimplementasse a regra não provaria nada.
 *
 * Leitura do resultado: `totalMin > 0 && keptMin === 0` é o caso ruim — o dado
 * está no HealthKit e o app o joga fora.
 *
 * O caso ruim FOI o caso: o diagnóstico de 04/09/2026 achou 36 de 38 noites
 * assim, e `aggregateSleepPeriods` passou a creditar pelo vão da noite. O
 * `keptMin` mede o que o agregador credita HOJE — se uma fonte nova quebrar a
 * regra de novo, é aqui que aparece.
 */
export interface AwakeAudit {
  /** Amostras rotuladas `AWAKE` na noite. */
  samples: number;
  /** Minutos que essas amostras cobrem (união, sem contar sobreposição). */
  totalMin: number;
  /** Minutos que a agregação de fato credita como vigília. */
  keptMin: number;
}

export function auditAwake(samples: Sample[]): AwakeAudit {
  const awake = mergeIntervals(toIntervals(samples, (st) => st === 'AWAKE'));
  // O que o agregador credita, pelo agregador de verdade — não uma simulação.
  const keptH = aggregateSleepPeriods(samples).reduce((s, p) => s + (p.stages?.awake ?? 0), 0);

  return {
    samples: samples.filter((s) => (s.label ?? '').toUpperCase() === 'AWAKE').length,
    totalMin: awake.reduce((a, iv) => a + (iv.end - iv.start), 0) / 60_000,
    keptMin: keptH * 60,
  };
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
