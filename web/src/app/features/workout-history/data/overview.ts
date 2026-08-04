/**
 * Agregações puras da visão geral do Histórico de Treinos.
 * Sem dependência de Angular/DOM — testável isoladamente.
 * Períodos = janelas móveis (ver .claude/specs/historico-treinos/spec.md §9).
 */
import type { Activity, BucketGranularity } from '@vitale/shared';
import { DEFAULT_WEEKLY_TARGET_MIN, effectiveSeconds, elapsedFraction, mondayOf, weeklyTargetSeconds } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';

export type Period = 'semana' | 'mes' | 'meses12' | 'ano' | 'sempre';
export type Metric = 'distance' | 'duration' | 'calories' | 'count';

export interface TypeSegment { label: string; color: string; value: number; }
export interface OverviewBucket {
  key: string;
  label: string;
  total: number;
  segments: TypeSegment[];
  /**
   * Segundos "moderados equivalentes" do bucket (duração ponderada por intensidade
   * — ver `effectiveSeconds` do shared). Alimenta a linha de esforço do gráfico de
   * Duração. Ausente nas barras de comparação: a polilinha quebra ali.
   */
  effectiveS?: number;
  /** Barra de comparação (ex.: mesmo mês há um ano) — não entra nos totais. */
  comparison?: boolean;
  /** Barra em destaque (ex.: mês atual no período "Ano") — ganha mais espaço. */
  emphasis?: boolean;
}
export interface OverviewTotals { count: number; distanceM: number; durationS: number; calories: number; }
export interface LegendItem { label: string; color: string; }
export interface Overview {
  buckets: OverviewBucket[];
  totals: OverviewTotals;
  legend: LegendItem[];
  /** Granularidade das barras do período — define o prorrateio da meta. */
  granularity: BucketGranularity;
  /** Meta semanal do usuário em segundos, já prorrateada para um bucket deste período. */
  targetS: number;
  /**
   * Meta do último bucket quando ele ainda está em curso (mês/semana/ano corrente),
   * proporcional aos dias decorridos. `undefined` quando o período está todo fechado
   * — aí a meta cheia vale para todas as barras.
   */
  currentTargetS?: number;
  /**
   * Meu esforço médio por bucket (segundos moderados equivalentes), na mesma escala
   * de `targetS`. Usado no período "Semana", onde a linha do esforço é uma reta
   * (média diária) em vez de uma série dia a dia. Buckets de comparação ficam fora.
   */
  effortAvgS: number;
  /** Esforço total do período, para exibir o número cheio ao lado da média. */
  effortTotalS: number;
}

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function metricValue(a: Activity, metric: Metric): number {
  switch (metric) {
    case 'distance': return a.distanceM ?? 0;
    case 'duration': return a.durationS;
    case 'calories': return a.calories;
    case 'count': return 1;
  }
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function ymd(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

interface PlanBucket { key: string; label: string; comparison?: boolean; emphasis?: boolean; }
interface BucketPlan {
  buckets: PlanBucket[];
  keyOf: (d: Date) => string;
  granularity: BucketGranularity;
  /** Quanto do ÚLTIMO bucket já decorreu (1 = fechado). Só ele pode estar em curso. */
  elapsed: number;
}

/** Semanas exibidas no período "mês" (semana atual + 4 anteriores). */
const MONTH_WEEKS = 5;

function bucketPlan(activities: Activity[], period: Period, now: Date, yearOffset: number): BucketPlan {
  if (period === 'semana') {
    const buckets: PlanBucket[] = [];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - i);
      buckets.push({ key: ymd(d), label: WEEKDAYS[d.getDay()] });
    }
    const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return { buckets, keyOf: (d) => ymd(d), granularity: 'day', elapsed: elapsedFraction(dayStart, dayEnd, now) };
  }

  if (period === 'mes') {
    // Barras semanais (seg–dom): a meta é semanal, então cada barra bate
    // exatamente com o alvo cheio — sem prorrateio.
    const thisMonday = mondayOf(now);
    const buckets: PlanBucket[] = [];
    for (let i = MONTH_WEEKS - 1; i >= 0; i--) {
      const m = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - i * 7);
      buckets.push({ key: ymd(m), label: `${pad2(m.getDate())}/${pad2(m.getMonth() + 1)}` });
    }
    const wEnd = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() + 7);
    return { buckets, keyOf: (d) => ymd(mondayOf(d)), granularity: 'week', elapsed: elapsedFraction(thisMonday, wEnd, now) };
  }

  if (period === 'ano') {
    // Ano civil, navegável. No ano corrente só emitimos os meses decorridos: barras
    // futuras vazias diluiriam `effortAvgS` (que divide pelo nº de buckets) e a reta
    // "Você" afundaria proporcionalmente aos meses que ainda não aconteceram.
    const year = now.getFullYear() + yearOffset;
    const isCurrentYear = year === now.getFullYear();
    const lastMonth = isCurrentYear ? now.getMonth() : 11;
    const buckets: PlanBucket[] = [];
    for (let m = 0; m <= lastMonth; m++) {
      buckets.push({
        key: `${year}-${m}`,
        label: MONTHS[m],
        emphasis: isCurrentYear && m === lastMonth,
      });
    }
    // Sem barra de comparação: navegar até o ano anterior já cumpre esse papel.
    const mStart = new Date(year, lastMonth, 1);
    const mEnd = new Date(year, lastMonth + 1, 1);
    return {
      buckets, keyOf: (d) => `${d.getFullYear()}-${d.getMonth()}`, granularity: 'month',
      elapsed: isCurrentYear ? elapsedFraction(mStart, mEnd, now) : 1,
    };
  }

  if (period === 'meses12') {
    const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    const buckets: PlanBucket[] = [];
    // 11 meses anteriores + mês atual (em destaque, i === 0).
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: MONTHS[d.getMonth()], emphasis: i === 0 });
    }
    // Comparação: mesmo mês do ano anterior, DEPOIS do mês atual (à direita) —
    // fora da sequência cronológica p/ não se confundir com os meses passados.
    // Marcada como `comparison`: NÃO soma nos totais.
    const cmp = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    buckets.push({
      key: monthKey(cmp),
      label: `${MONTHS[cmp.getMonth()]} '${String(cmp.getFullYear()).slice(-2)}`,
      comparison: true,
    });
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { buckets, keyOf: monthKey, granularity: 'month', elapsed: elapsedFraction(curStart, curEnd, now) };
  }

  // sempre — um bucket por ano com dados
  const years = activities.map((a) => new Date(a.startAt).getFullYear());
  const buckets: PlanBucket[] = [];
  if (years.length) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    for (let y = min; y <= max; y++) buckets.push({ key: `${y}`, label: `${y}` });
  }
  const lastYear = buckets.length ? Number(buckets[buckets.length - 1].key) : now.getFullYear();
  const yElapsed = lastYear === now.getFullYear()
    ? elapsedFraction(new Date(lastYear, 0, 1), new Date(lastYear + 1, 0, 1), now)
    : 1;
  return { buckets, keyOf: (d) => `${d.getFullYear()}`, granularity: 'year', elapsed: yElapsed };
}

export function buildOverview(
  activities: Activity[],
  period: Period,
  metric: Metric,
  now: Date = new Date(),
  hidden: ReadonlySet<string> = new Set(),
  weeklyTargetMin: number = DEFAULT_WEEKLY_TARGET_MIN,
  /** 0 = ano corrente, negativo = anos anteriores (convenção de period/bounds). */
  yearOffset: number = 0,
): Overview {
  const plan = bucketPlan(activities, period, now, yearOffset);
  const bucketKeys = new Set(plan.buckets.map((b) => b.key));
  // chaves de comparação: aparecem no gráfico, mas ficam fora dos totais.
  const comparisonKeys = new Set(plan.buckets.filter((b) => b.comparison).map((b) => b.key));

  // só atividades cuja chave cai nos buckets do período (janela móvel)
  const within = activities.filter((a) => bucketKeys.has(plan.keyOf(new Date(a.startAt))));

  const totals: OverviewTotals = { count: 0, distanceM: 0, durationS: 0, calories: 0 };
  // chave do bucket → (label do tipo → valor acumulado)
  const perBucket = new Map<string, Map<string, number>>();
  // chave do bucket → segundos moderados equivalentes (linha de esforço)
  const effectivePerBucket = new Map<string, number>();
  // label do tipo → cor + total (para legenda/ordenação)
  const typeAgg = new Map<string, { color: string; total: number }>();

  for (const a of within) {
    const meta = metaForActivity(a.activityId);
    const value = metricValue(a, metric);

    // legenda sempre lista todos os tipos do período (ordem estável p/ reexibir)
    const t = typeAgg.get(meta.label) ?? { color: meta.color, total: 0 };
    t.total += value;
    typeAgg.set(meta.label, t);

    // totais e barras refletem apenas os tipos habilitados
    if (hidden.has(meta.label)) continue;

    const bk = plan.keyOf(new Date(a.startAt));

    // Barras de comparação alimentam o gráfico/legenda, mas não os totais.
    if (!comparisonKeys.has(bk)) {
      totals.count += 1;
      totals.distanceM += a.distanceM ?? 0;
      totals.durationS += a.durationS;
      totals.calories += a.calories;
    }

    const bucket = perBucket.get(bk) ?? new Map<string, number>();
    bucket.set(meta.label, (bucket.get(meta.label) ?? 0) + value);
    perBucket.set(bk, bucket);

    // Esforço ponderado: independe da métrica exibida, mas segue o mesmo filtro de
    // legenda das barras (o `continue` acima já excluiu os tipos ocultos).
    effectivePerBucket.set(bk, (effectivePerBucket.get(bk) ?? 0) + effectiveSeconds(a));
  }

  const legend: LegendItem[] = [...typeAgg.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([label, { color }]) => ({ label, color }));

  const buckets: OverviewBucket[] = plan.buckets.map(({ key, label, comparison, emphasis }) => {
    const agg = perBucket.get(key);
    const segments: TypeSegment[] = legend
      .map((li) => ({ label: li.label, color: li.color, value: agg?.get(li.label) ?? 0 }))
      .filter((s) => s.value > 0);
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    // Barra de comparação fica fora da série de esforço (não é cronológica).
    const effectiveS = comparison ? undefined : effectivePerBucket.get(key) ?? 0;
    return { key, label, total, segments, effectiveS, comparison, emphasis };
  });

  // Média sobre TODOS os buckets do período (dias sem treino contam como 0) — é o
  // que torna a reta comparável com a meta prorrateada.
  const targetS = weeklyTargetSeconds(plan.granularity, now, weeklyTargetMin);
  const scored = buckets.filter((b) => !b.comparison);
  const effortTotalS = scored.reduce((sum, b) => sum + (b.effectiveS ?? 0), 0);

  return {
    buckets,
    totals,
    legend,
    granularity: plan.granularity,
    targetS,
    // Só faz sentido destacar quando o bucket em curso ainda não fechou.
    currentTargetS: plan.elapsed < 1 ? targetS * plan.elapsed : undefined,
    effortAvgS: scored.length ? effortTotalS / scored.length : 0,
    effortTotalS,
  };
}

/**
 * Ano da atividade mais antiga; `undefined` sem dados. Limita a navegação para trás
 * no período "Ano" — sem isso dá para navegar indefinidamente para anos vazios.
 * Reduce em vez de `Math.min(...anos)`: spread de array grande estoura o limite de
 * argumentos.
 */
export function earliestActivityYear(activities: Activity[]): number | undefined {
  let min: number | undefined;
  for (const a of activities) {
    const y = new Date(a.startAt).getFullYear();
    if (min === undefined || y < min) min = y;
  }
  return min;
}
