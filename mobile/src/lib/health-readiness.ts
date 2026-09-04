/**
 * Monta o `ReadinessInput` (score de prontidão) a partir do que o app tem em
 * memória. Reusa os agregadores diários e a fórmula pura do `@vitale/shared`.
 * Sem dependência nativa — testável.
 *
 * ## Duas fontes, e por que as duas são necessárias
 *
 * As **summaries** do HealthKit são a janela de 7 dias que a aba Saúde carrega:
 * têm o dado mais fresco, inclusive o que ainda não subiu para o servidor. As
 * linhas de **`health_daily`** cobrem 365 dias, e são o que o próprio app
 * escreveu a partir do mesmo HealthKit.
 *
 * Sete dias não formam a baseline de 90 que o núcleo pede — com elas a "baseline
 * longa" seria a mesma média curta com outro nome. Por isso os dois lados entram
 * num mapa dia → valor, com o HealthKit vencendo empate de dia: o valor de hoje
 * sai do relógio, e o habitual sai do histórico.
 *
 * A VFC tem uma diferença que sobrevive a isso: o Garmin não escreve HRV no Apple
 * Health, e a ponte do intervals.icu grava a dele na tabela (ADR 0026). Só que a
 * medida de lá é RMSSD e a do relógio é SDNN, em escalas diferentes — então a
 * baseline da VFC só usa leituras do **mesmo tipo** da mais recente. Sem esse
 * cuidado a prontidão leria a troca de unidade como queda fisiológica.
 *
 * ## A idade viaja junto
 *
 * Cada sinal sai daqui com `ageDays`, e é o núcleo que decide o que fazer com
 * ela. Não há mais recorte de "só a janela de 7 dias": uma leitura de dez dias
 * atrás **entra**, marcada, e o núcleo a tira do peso — que é o único jeito de a
 * tela poder dizer "anéis, de 18 dias atrás" em vez de simplesmente não mostrar
 * nada. O corte fica em `MAX_AGE_DAYS`, onde a leitura deixa de ser velha e passa
 * a ser ausente.
 */
import {
  READINESS_BASELINE_DAYS,
  READINESS_BASELINE_SHORT_DAYS,
  computeReadiness,
  localDateStr,
  rollingBaseline,
  type HealthDaily,
  type ReadinessInput,
  type ReadinessScore,
} from '@vitale/shared';
import type { Sample } from './health-buckets';
import { aggregateCumulative, aggregateDiscrete, localDay } from './health-aggregate';

/**
 * Idade máxima (dias) de uma leitura para ela ainda aparecer no cartão.
 *
 * Acima de um mês o sinal não é "velho", é ausente: mostrá-lo apagado sugeriria
 * que há algo a recuperar ali. Fica bem acima do corte de frescor do núcleo, que
 * é o que decide o que pontua — este só decide o que existe.
 */
const MAX_AGE_DAYS = 30;

/** Uma leitura diária, já datada. `kind` só existe na VFC (SDNN × RMSSD). */
interface Reading {
  day: string;
  value: number;
  kind: unknown;
}

/** O que o núcleo precisa saber de um sinal. */
export interface SignalInput {
  latest: number | null;
  baseline: number | null;
  baselineShort: number | null;
  /** Dias entre a leitura mais recente e hoje; `null` quando não há leitura. */
  ageDays: number | null;
}

const EMPTY_SIGNAL: SignalInput = { latest: null, baseline: null, baselineShort: null, ageDays: null };

/** Distância em dias entre duas chaves 'YYYY-MM-DD'. Negativa vira 0. */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const ms = new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Leituras diárias vindas das summaries do HealthKit (sem `kind`). */
function readingsFromSamples(samples: Sample[], id: string, kind: 'cumulative' | 'discrete'): Reading[] {
  const rows = kind === 'cumulative'
    ? aggregateCumulative(samples, id, 'x')
    : aggregateDiscrete(samples, id, 'x');
  return rows
    .filter((r) => r.value != null && Number.isFinite(r.value))
    .map((r) => ({ day: r.day, value: r.value as number, kind: null }));
}

/** Leituras diárias vindas de `health_daily`, de uma métrica só. */
function readingsFromRows(rows: HealthDaily[], metric: string): Reading[] {
  return rows
    .filter((r) => r.metric === metric && r.value != null && Number.isFinite(r.value))
    .map((r) => ({ day: r.day, value: r.value as number, kind: r.extra?.['kind'] ?? null }));
}

/**
 * Junta as duas fontes num sinal só.
 *
 * O HealthKit vence empate de dia porque é a fonte primária — a tabela é cópia
 * dele para sono e FC. Linha datada no futuro é descartada: o ingest busca até
 * amanhã por causa do fuso do atleta, e uma dessas não pode passar à frente da
 * leitura de hoje.
 *
 * **Uma leitura só não vira baseline.** Com `baseline === latest` o componente
 * marcaria exatamente 50 com peso cheio e a cobertura iria a 1 — o número que
 * existe justamente para avisar que falta informação. Na primeira noite a
 * resposta honesta é não pontuar.
 */
function signalOf(primary: Reading[], secondary: Reading[], now: Date): SignalInput {
  const today = localDateStr(now);
  const byDay = new Map<string, Reading>();
  for (const r of secondary) if (r.day <= today) byDay.set(r.day, r);
  for (const r of primary) if (r.day <= today) byDay.set(r.day, r);

  const sorted = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1];
  if (!last) return EMPTY_SIGNAL;

  const ageDays = daysBetween(last.day, today);
  if (ageDays > MAX_AGE_DAYS) return EMPTY_SIGNAL;

  // A baseline compara com o passado do MESMO tipo de medida — ver o cabeçalho.
  const prior = sorted.slice(0, -1).filter((r) => r.kind === last.kind);
  if (prior.length === 0) return { latest: last.value, baseline: null, baselineShort: null, ageDays };

  // `rollingBaseline` conta LEITURAS, não dias — e as duas coisas só coincidem
  // numa série sem buracos. Com um mês sem sincronizar no meio, uma janela de
  // "90" alcançaria o ano passado, e a "de 14 dias" alcançaria o trimestre. Como
  // aqui a data de cada leitura existe, o recorte é feito em dias, contados a
  // partir da própria leitura mais recente: a baseline é o que era normal ANTES
  // dela, não antes de hoje.
  const within = (days: number): number[] =>
    prior.filter((r) => daysBetween(r.day, last.day) <= days).map((r) => r.value);

  return {
    latest: last.value,
    baseline: rollingBaseline(within(READINESS_BASELINE_DAYS), READINESS_BASELINE_DAYS),
    baselineShort: rollingBaseline(within(READINESS_BASELINE_SHORT_DAYS), READINESS_BASELINE_SHORT_DAYS),
    ageDays,
  };
}

/**
 * Último valor + baselines a partir de linhas de `health_daily`.
 *
 * @param metric Quando dado, só linhas desta métrica contam. A store expõe
 *   `rows` e `seriesFor` lado a lado, e passar a lista inteira montaria uma
 *   baseline de VFC com passos e peso.
 */
export function latestAndBaselineFromRows(
  rows: HealthDaily[],
  metric?: string,
  now: Date = new Date(),
): SignalInput {
  const usable = metric == null
    ? rows.filter((r) => r.value != null && Number.isFinite(r.value))
        .map((r) => ({ day: r.day, value: r.value as number, kind: r.extra?.['kind'] ?? null }))
    : readingsFromRows(rows, metric);
  return signalOf([], usable, now);
}

/**
 * Séries de `health_daily` e derivados que o HealthKit não dá.
 *
 * As linhas não são só fallback: são o histórico longo de onde sai a baseline de
 * 90 dias, que as summaries de 7 dias não conseguem formar.
 */
export interface ReadinessSources {
  /** Linhas `'vfc'` (qualquer fonte). */
  vfc?: HealthDaily[];
  /** Linhas `'fcRepouso'` — mesma medida das summaries, só que com histórico. */
  fcRepouso?: HealthDaily[];
  /** Linhas `'sono'`, idem. */
  sono?: HealthDaily[];
  /**
   * ACWR desacoplado de `buildTrainingLoad`, para o componente de carga. Quem
   * já montou a curva de forma tem este número de graça; quem não montou passa
   * `null` e fica com quatro sinais.
   */
  acwr?: number | null;
}

export function buildReadinessInput(
  summaries: Record<string, Sample[]>,
  sources?: ReadinessSources,
  now: Date = new Date(),
): ReadinessInput {
  const sono = signalOf(
    readingsFromSamples(summaries['sono'] ?? [], 'sono', 'cumulative'),
    readingsFromRows(sources?.sono ?? [], 'sono'),
    now,
  );
  const fc = signalOf(
    readingsFromSamples(summaries['fcRepouso'] ?? [], 'fcRepouso', 'discrete'),
    readingsFromRows(sources?.fcRepouso ?? [], 'fcRepouso'),
    now,
  );
  const vfc = signalOf(
    readingsFromSamples(summaries['vfc'] ?? [], 'vfc', 'discrete'),
    readingsFromRows(sources?.vfc ?? [], 'vfc'),
    now,
  );
  const aneis = ringsOf(summaries['aneis'] ?? [], now);

  return {
    sleepHours: sono.latest,
    restingHr: fc.latest,
    restingHrBaseline: fc.baseline,
    restingHrBaselineShort: fc.baselineShort,
    hrv: vfc.latest,
    hrvBaseline: vfc.baseline,
    hrvBaselineShort: vfc.baselineShort,
    ringsPct: aneis.pcts,
    acwr: sources?.acwr ?? null,
    ageDays: {
      sono: sono.ageDays,
      fcRepouso: fc.ageDays,
      vfc: vfc.ageDays,
      aneis: aneis.ageDays,
      // A carga sai da curva de forma, que sempre termina hoje.
      carga: sources?.acwr == null ? null : 0,
    },
  };
}

/**
 * Frações dos anéis do **dia mais recente**, e a idade desse dia.
 *
 * Antes isto varria a janela inteira e devolvia até 21 frações — sete dias de
 * três anéis —, que o núcleo então mediava como se fossem os anéis de hoje. Um
 * domingo cheio segurava a nota da quarta-feira parada. Agora é um dia só, e o
 * dia diz de quando é.
 */
function ringsOf(samples: Sample[], now: Date): { pcts: number[]; ageDays: number | null } {
  const today = localDateStr(now);
  let day: string | null = null;
  for (const s of samples) {
    const d = localDay(s.start);
    if (d <= today && (day === null || d > day)) day = d;
  }
  if (day === null) return { pcts: [], ageDays: null };

  const ageDays = daysBetween(day, today);
  if (ageDays > MAX_AGE_DAYS) return { pcts: [], ageDays: null };

  const pcts = samples
    .filter((s) => localDay(s.start) === day)
    .map((s) => (s.extra && s.extra > 0 ? s.value / s.extra : 0));
  return { pcts, ageDays };
}

export function readinessFromSummaries(
  summaries: Record<string, Sample[]>,
  sources?: ReadinessSources,
  now: Date = new Date(),
): ReadinessScore {
  return computeReadiness(buildReadinessInput(summaries, sources, now));
}
