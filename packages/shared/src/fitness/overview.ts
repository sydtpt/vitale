/**
 * Agregações puras da visão geral do Histórico de Treinos.
 *
 * ## Por que mora no núcleo
 *
 * Isto viveu duplicado em `web/.../data/overview.ts` (304 linhas) e
 * `mobile/src/lib/activity-overview.ts` (330) até 27/08/2026. As duas cópias
 * eram **98,5% idênticas** — normalizando comentários e espaço, a única
 * diferença real era a busca de metadados do tipo: `metaForActivity` na web,
 * `getActivityMeta` + `getActivityColor` no mobile. Essa diferença virou o
 * parâmetro `metaOf`, e o resto veio inteiro.
 *
 * Não é só economia de linhas: enquanto estavam separadas, toda regra nova
 * (como a comparação com o período anterior, logo abaixo) custava dobrado e as
 * duas divergiam em silêncio.
 *
 * Períodos são **janelas móveis**, não calendário — ver o spec do
 * historico-treinos §FR-003.
 */
import type { Activity } from '../models';
import {
  DEFAULT_WEEKLY_TARGET_MIN,
  effectiveSeconds,
  elapsedFraction,
  weeklyTargetSeconds,
  type BucketGranularity,
} from '../health/who-activity';
import { mondayOf } from '../week/recap';
import { DIAS_ABREV, MESES_ABREV } from '../date/ptbr';

export type Period = 'semana' | 'mes' | 'meses12' | 'ano' | 'sempre';
export type Metric = 'distance' | 'duration' | 'calories' | 'count';

/**
 * Como o app traduz um `activityId` em rótulo e cor. É o único ponto em que as
 * duas plataformas discordavam: o ícone é específico de cada uma (nomes do
 * MaterialCommunityIcons no mobile, do set próprio na web) e **não** entra
 * aqui, porque o agrupamento não usa ícone.
 */
export type ActivityMetaLookup = (activityId: number) => { label: string; color: string };

export interface TypeSegment {
  label: string;
  color: string;
  value: number;
}
export interface OverviewBucket {
  key: string;
  label: string;
  total: number;
  segments: TypeSegment[];
  /**
   * Segundos "de esforço" do bucket (duração ponderada por intensidade, nunca acima dela
   * — ver `effectiveSeconds`). Alimenta a linha de esforço do gráfico de
   * Duração. Ausente nas barras de comparação: a polilinha quebra ali.
   */
  effectiveS?: number;
  /** Barra de comparação (ex.: mesmo mês há um ano) — não entra nos totais. */
  comparison?: boolean;
  /** Barra em destaque (ex.: mês atual no período "Ano") — ganha mais espaço. */
  emphasis?: boolean;
}
export interface OverviewTotals {
  count: number;
  distanceM: number;
  durationS: number;
  calories: number;
}
export interface LegendItem {
  label: string;
  color: string;
}
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
   * Meu esforço médio por bucket (segundos de esforço), na mesma escala
   * de `targetS`. Usado no período "Semana", onde a linha do esforço é uma reta
   * (média diária) em vez de uma série dia a dia. Buckets de comparação ficam fora.
   */
  effortAvgS: number;
  /** Esforço total do período, para exibir o número cheio ao lado da média. */
  effortTotalS: number;
  /**
   * Os mesmos totais para a **janela imediatamente anterior**, do mesmo tamanho.
   * Alimenta a variação nos tiles: "127 atividades" contra o quê?
   *
   * `undefined` em "Sempre" — não existe um "antes de todo o histórico". Vem
   * zerado (não `undefined`) quando a janela anterior existe mas está vazia:
   * são coisas diferentes, e quem exibe precisa distinguir "não se aplica" de
   * "foi zero". Em ambos os casos a UI não deve inventar percentual — dividir
   * por zero não vira "↑ ∞".
   */
  previous?: OverviewTotals;
}

const WEEKDAYS = DIAS_ABREV.map((d) => d.toUpperCase());

export function metricValue(a: Activity, metric: Metric): number {
  switch (metric) {
    case 'distance':
      return a.distanceM ?? 0;
    case 'duration':
      return a.durationS;
    case 'calories':
      return a.calories;
    case 'count':
      return 1;
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

interface PlanBucket {
  key: string;
  label: string;
  comparison?: boolean;
  emphasis?: boolean;
}
interface BucketPlan {
  buckets: PlanBucket[];
  keyOf: (d: Date) => string;
  granularity: BucketGranularity;
  /** Quanto do ÚLTIMO bucket já decorreu (1 = fechado). Só ele pode estar em curso. */
  elapsed: number;
}

/** Semanas exibidas no período "mês" (semana atual + 4 anteriores). */
const MONTH_WEEKS = 5;

function bucketPlan(
  activities: Activity[],
  period: Period,
  now: Date,
  yearOffset: number,
  hiddenYears: ReadonlySet<string>,
): BucketPlan {
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
        label: MESES_ABREV[m],
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
      buckets.push({ key: monthKey(d), label: MESES_ABREV[d.getMonth()], emphasis: i === 0 });
    }
    // Comparação: mesmo mês do ano anterior, DEPOIS do mês atual (à direita) —
    // fora da sequência cronológica p/ não se confundir com os meses passados.
    // Marcada como `comparison`: NÃO soma nos totais.
    const cmp = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    buckets.push({
      key: monthKey(cmp),
      label: `${MESES_ABREV[cmp.getMonth()]} '${String(cmp.getFullYear()).slice(-2)}`,
      comparison: true,
    });
    const curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { buckets, keyOf: monthKey, granularity: 'month', elapsed: elapsedFraction(curStart, curEnd, now) };
  }

  // sempre — um bucket por ano com dados, menos os anos desmarcados nos botões.
  // Tirar o ano do plano já o remove das barras E dos totais: `buildOverview` só
  // considera atividades cuja chave cai em algum bucket.
  const buckets: PlanBucket[] = overviewYears(activities)
    .map((y) => `${y}`)
    .filter((key) => !hiddenYears.has(key))
    .map((key) => ({ key, label: key }));
  const lastYear = buckets.length ? Number(buckets[buckets.length - 1].key) : now.getFullYear();
  const yElapsed = lastYear === now.getFullYear()
    ? elapsedFraction(new Date(lastYear, 0, 1), new Date(lastYear + 1, 0, 1), now)
    : 1;
  return { buckets, keyOf: (d) => `${d.getFullYear()}`, granularity: 'year', elapsed: yElapsed };
}

interface Accumulated {
  totals: OverviewTotals;
  /** chave do bucket → (label do tipo → valor acumulado) */
  perBucket: Map<string, Map<string, number>>;
  /** chave do bucket → segundos de esforço (linha de esforço) */
  effectivePerBucket: Map<string, number>;
  /** label do tipo → cor + total (para legenda/ordenação) */
  typeAgg: Map<string, { color: string; total: number }>;
}

/**
 * Uma passada sobre as atividades que caem no plano. Extraída para que a janela
 * anterior (`previous`) reuse exatamente as mesmas regras — inclusive a de que
 * barra de comparação não soma nos totais. Reimplementar isso do lado de fora
 * seria a forma mais fácil de os dois números discordarem.
 */
function accumulate(
  activities: Activity[],
  plan: BucketPlan,
  metric: Metric,
  hidden: ReadonlySet<string>,
  metaOf: ActivityMetaLookup,
): Accumulated {
  const bucketKeys = new Set(plan.buckets.map((b) => b.key));
  const comparisonKeys = new Set(plan.buckets.filter((b) => b.comparison).map((b) => b.key));

  const totals: OverviewTotals = { count: 0, distanceM: 0, durationS: 0, calories: 0 };
  const perBucket = new Map<string, Map<string, number>>();
  const effectivePerBucket = new Map<string, number>();
  const typeAgg = new Map<string, { color: string; total: number }>();

  for (const a of activities) {
    const bk = plan.keyOf(new Date(a.startAt));
    // só atividades cuja chave cai nos buckets do período (janela móvel)
    if (!bucketKeys.has(bk)) continue;

    const { label, color } = metaOf(a.activityId);
    const value = metricValue(a, metric);

    // legenda sempre lista todos os tipos do período (ordem estável p/ reexibir)
    const t = typeAgg.get(label) ?? { color, total: 0 };
    t.total += value;
    typeAgg.set(label, t);

    // totais e barras refletem apenas os tipos habilitados
    if (hidden.has(label)) continue;

    // Barras de comparação alimentam o gráfico/legenda, mas não os totais.
    if (!comparisonKeys.has(bk)) {
      totals.count += 1;
      totals.distanceM += a.distanceM ?? 0;
      totals.durationS += a.durationS;
      totals.calories += a.calories;
    }

    const bucket = perBucket.get(bk) ?? new Map<string, number>();
    bucket.set(label, (bucket.get(label) ?? 0) + value);
    perBucket.set(bk, bucket);

    // Esforço ponderado: independe da métrica exibida, mas segue o mesmo filtro de
    // legenda das barras (o `continue` acima já excluiu os tipos ocultos).
    effectivePerBucket.set(bk, (effectivePerBucket.get(bk) ?? 0) + effectiveSeconds(a));
  }

  return { totals, perBucket, effectivePerBucket, typeAgg };
}

/**
 * Instante que produz a janela imediatamente anterior, do mesmo tamanho.
 *
 * `null` em "Sempre": não existe um "antes de todo o histórico", e inventar um
 * daria uma seta de variação contra o nada.
 */
function previousWindow(
  period: Period,
  now: Date,
  yearOffset: number,
): { now: Date; yearOffset: number } | null {
  switch (period) {
    case 'semana':
      return { now: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, now.getHours(), now.getMinutes()), yearOffset };
    case 'mes':
      // 5 barras semanais → recuar 5 semanas mantém o alinhamento em segunda.
      return { now: new Date(now.getFullYear(), now.getMonth(), now.getDate() - MONTH_WEEKS * 7, now.getHours(), now.getMinutes()), yearOffset };
    case 'meses12':
      return { now: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()), yearOffset };
    case 'ano':
      return { now, yearOffset: yearOffset - 1 };
    case 'sempre':
      return null;
  }
}

export interface BuildOverviewOptions {
  /** Como traduzir `activityId` em rótulo e cor. Obrigatório: é o que muda por app. */
  metaOf: ActivityMetaLookup;
  now?: Date;
  /** Rótulos de tipo desligados na legenda — saem das barras, dos totais e da média. */
  hidden?: ReadonlySet<string>;
  weeklyTargetMin?: number;
  /** 0 = ano corrente, negativo = anos anteriores (convenção de period/bounds). */
  yearOffset?: number;
  /**
   * Anos desmarcados nos botões do período "Sempre" (chave = `${ano}`). Ficam fora
   * das barras, dos totais e da legenda. Guardamos os DESMARCADOS, e não os
   * selecionados, para que um ano novo apareça sozinho quando surgir.
   */
  hiddenYears?: ReadonlySet<string>;
}

export function buildOverview(
  activities: Activity[],
  period: Period,
  metric: Metric,
  opts: BuildOverviewOptions,
): Overview {
  const {
    metaOf,
    now = new Date(),
    hidden = new Set<string>(),
    weeklyTargetMin = DEFAULT_WEEKLY_TARGET_MIN,
    yearOffset = 0,
    hiddenYears = new Set<string>(),
  } = opts;

  const plan = bucketPlan(activities, period, now, yearOffset, hiddenYears);
  const { totals, perBucket, effectivePerBucket, typeAgg } =
    accumulate(activities, plan, metric, hidden, metaOf);

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

  // A janela anterior roda o mesmo plano deslocado. Só os totais interessam —
  // barras, legenda e esforço de lá não vão para lugar nenhum.
  const prevAt = previousWindow(period, now, yearOffset);
  const previous = prevAt
    ? accumulate(
        activities,
        bucketPlan(activities, period, prevAt.now, prevAt.yearOffset, hiddenYears),
        metric,
        hidden,
        metaOf,
      ).totals
    : undefined;

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
    previous,
  };
}

/**
 * Variação relativa entre dois totais, em pontos percentuais arredondados.
 *
 * `null` quando não há base de comparação — sem período anterior, ou com ele
 * zerado. Crescer a partir de zero **não é** "↑ ∞" nem "↑ 100%": é uma conta
 * que não existe, e a UI mostra o número sozinho.
 */
export function totalsDelta(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
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

/**
 * Anos cobertos pelo período "Sempre" (do mais antigo ao mais recente, inclusive
 * os vazios no meio) — a mesma lista que vira barra no gráfico. Alimenta os botões
 * de ano acima do gráfico.
 */
export function overviewYears(activities: Activity[]): number[] {
  let min: number | undefined;
  let max: number | undefined;
  for (const a of activities) {
    const y = new Date(a.startAt).getFullYear();
    if (min === undefined || y < min) min = y;
    if (max === undefined || y > max) max = y;
  }
  if (min === undefined || max === undefined) return [];
  const years: number[] = [];
  for (let y = min; y <= max; y++) years.push(y);
  return years;
}
