/**
 * Série intradiária de uma métrica de saúde — a FORMA do dia, não o resumo.
 *
 * `health_daily` resume o dia em média/mín/máx e descarta as amostras; esta
 * folha as guarda por minuto, um dia por linha (`health_series`, ADR 0033). É
 * o núcleo puro que o sync do mobile chama para transformar as amostras cruas
 * do HealthKit na linha do dia, e que qualquer leitor usa para reexpandir a
 * linha em instantes. Sem dependência nativa: testado em `series.test.ts`.
 *
 * Resolução: o MINUTO local. Amostras no mesmo minuto viram média. É de sobra
 * para a cadência do Garmin Connect (uma a cada 2 min) e achata de propósito o
 * Apple Watch em treino (uma a cada poucos segundos), cujo detalhe já vive nos
 * streams da atividade — aqui interessa o dia, não o intervalo.
 */
import type { HealthSeriesDay } from '../models';

/** A amostra mínima que o núcleo precisa — o `Sample` do mobile a satisfaz. */
export interface SeriesSample {
  /** ISO do instante da amostra. */
  start: string;
  value: number;
}

export const MINUTES_PER_DAY = 1440;

/**
 * Métricas cuja série intradiária o sync grava. Só a FC hoje: é a única que o
 * Apple Health recebe várias vezes por hora e que o resumo diário mutila.
 */
export const SERIES_METRICS: ReadonlySet<string> = new Set(['fc']);

export interface BucketSeriesOptions {
  userId: string;
  metric: string;
  /** Casas decimais da leitura média do minuto (0 = inteiro, o caso da FC). */
  decimals?: number;
}

/** 'YYYY-MM-DD' local de um Date (o dia do aparelho, não UTC). */
function localDayOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Deslocamento vs UTC, em minutos, à MEIA-NOITE local do dia — fixo por dia
 * de propósito. No dia em que o relógio muda, a metade do dia depois da virada
 * fica uma hora deslocada ao reexpandir; dois dias por ano, aceito e documentado
 * na migration.
 */
function tzOffsetAtMidnight(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return -new Date(y, m - 1, d, 0, 0, 0, 0).getTimezoneOffset();
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Amostras cruas → uma linha por dia local, com `minutes` crescente e
 * `readings` paralelo. Amostras sem instante válido ou sem valor finito são
 * descartadas; dia sem amostra não gera linha (a ausência é o dado). A ordem
 * de entrada não importa: a saída é ordenada por dia e por minuto.
 */
export function bucketSeriesByMinute(
  samples: readonly SeriesSample[],
  opts: BucketSeriesOptions,
): HealthSeriesDay[] {
  const decimals = opts.decimals ?? 0;
  const byDay = new Map<string, Map<number, { sum: number; n: number }>>();

  for (const s of samples) {
    if (!Number.isFinite(s.value)) continue;
    const d = new Date(s.start);
    const ms = d.getTime();
    if (!Number.isFinite(ms)) continue;
    const day = localDayOf(d);
    const minute = d.getHours() * 60 + d.getMinutes();
    let buckets = byDay.get(day);
    if (!buckets) {
      buckets = new Map();
      byDay.set(day, buckets);
    }
    const b = buckets.get(minute);
    if (b) {
      b.sum += s.value;
      b.n += 1;
    } else {
      buckets.set(minute, { sum: s.value, n: 1 });
    }
  }

  const out: HealthSeriesDay[] = [];
  for (const day of [...byDay.keys()].sort()) {
    const buckets = byDay.get(day)!;
    const minutes = [...buckets.keys()].sort((a, b) => a - b);
    out.push({
      userId: opts.userId,
      day,
      metric: opts.metric,
      tzOffset: tzOffsetAtMidnight(day),
      minutes,
      readings: minutes.map((m) => {
        const b = buckets.get(m)!;
        return roundTo(b.sum / b.n, decimals);
      }),
    });
  }
  return out;
}

/** Um ponto da série reexpandida: instante UTC em ms + leitura. */
export interface SeriesPoint {
  atMs: number;
  value: number;
}

/**
 * A linha do dia de volta a instantes, pela regra da migration:
 * `Date.UTC(dia) − tz_offset·60 s + minuto·60 s`. É o que um gráfico consome;
 * quem só quer "que horas" usa `minutes` direto.
 */
export function expandSeriesDay(day: HealthSeriesDay): SeriesPoint[] {
  const [y, m, d] = day.day.split('-').map(Number);
  const midnightUtcMs = Date.UTC(y, m - 1, d) - day.tzOffset * 60_000;
  return day.minutes.map((minute, i) => ({
    atMs: midnightUtcMs + minute * 60_000,
    value: day.readings[i],
  }));
}
