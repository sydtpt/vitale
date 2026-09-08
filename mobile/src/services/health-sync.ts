/**
 * Sincronização push-only de saúde (Apple Health → Supabase), por janela de datas.
 *
 * O mobile agrega as amostras do HealthKit em valores DIÁRIOS (cumulativas = soma;
 * discretas = média/min/max) e envia via RPC idempotente `sync_upsert_health_daily`.
 * Para a FC, as mesmas amostras viram também a SÉRIE do dia (minuto → bpm) em
 * `health_series`, pela RPC irmã `sync_upsert_health_series` (ADR 0033).
 * Re-sincroniza sempre os últimos dias (cobre "hoje ainda mudando" + dados que
 * chegam atrasados do relógio); o primeiro sync — ou um bump de `AGG_VERSION` —
 * dispara um backfill maior que recorrige o histórico automaticamente.
 *
 * Espelha a infra de `activity-sync.ts`: lotes, fila offline e cursor local.
 */
// `AGG_VERSION` mora no núcleo (dono único): packages/shared/src/constants/agg-version.ts,
// onde vive também a história v1→v9 que este arquivo guardava.
import { AGG_VERSION, bucketSeriesByMinute, SERIES_METRICS } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { METRICS, chunkRange, sleepRawFetch, type MetricDef, type Range } from '../config/health-metrics';
import { toHealthDailyRows, localDay, type HealthDailyRow } from '../lib/health-aggregate';
import { aggregateSleepPeriods, type Sample } from '../lib/health-buckets';
import { toSleepDailyRows, toSleepPeriodRows, type SleepPeriodRow } from '../lib/sleep-rows';
import { toHealthSeriesRows, type HealthSeriesRow } from '../lib/health-series-rows';
import { enqueue, drainQueue, type QueueItem } from '../lib/sync-queue';
import { precisaBackfill, readHealthCursor, writeHealthCursor } from '../lib/health-sync-cursor';

export interface HealthSyncResult {
  pushed: number;
  queued: number;
  ok: boolean;
  error?: string;
}

/** Tamanho do lote de upsert. */
const BATCH = 200;
/** Janela re-sincronizada a cada ciclo incremental. */
const SYNC_DAYS = 14;
/**
 * Janela do backfill (primeiro sync do dispositivo OU recorreção por versão).
 * Maior que um ano de propósito: a recorreção precisa alcançar o começo do
 * histórico já gravado, senão sobra um trecho antigo com a agregação velha.
 */
const BACKFILL_DAYS = 500;
/** Métricas de altíssima frequência (FC): caras de puxar cruas — fatiadas e limitadas no backfill. */
const HEAVY_METRICS = new Set(['fc']);
/**
 * Teto do backfill das pesadas. Era 60; subiu para 200 quando a FC passou a
 * gravar a série intradiária (v9): cobre a era Garmin inteira (desde 18/07/2026)
 * com folga e um trecho do Watch. Um ano de FC crua (~1.300 amostras/dia no
 * Watch, 5.700 em dia de treino) continua caro demais para um ciclo — e a ponte
 * nativa devolve a janela inteira num array só, por isso a janela é fatiada em
 * `HEAVY_CHUNK_DAYS`. Para ir mais fundo, chame `syncHealth(dias)` à mão.
 */
const HEAVY_MAX_DAYS = 200;
const HEAVY_CHUNK_DAYS = 30;
/** Lote da série: cada linha carrega até 1440 pares, então o lote é menor. */
const SERIES_BATCH = 50;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Intervalo ISO cobrindo os últimos `daysBack` dias (00:00 do primeiro → agora). */
function rangeForDays(daysBack: number): Range {
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (daysBack - 1));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Upsert de linhas diárias em lotes. Devolve os lotes que falharam (para a fila). */
async function pushHealthDaily(
  rows: HealthDailyRow[]
): Promise<{ pushed: number; failed: QueueItem[]; error?: string }> {
  let pushed = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await supabase.rpc('sync_upsert_health_daily', { rows: chunk });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[health-sync] upsert falhou:', res.error.message);
      failed.push(...chunk.map((row) => ({ kind: 'health' as const, row })));
    } else {
      pushed += chunk.length;
    }
  }
  return { pushed, failed, error };
}

/**
 * Upsert de períodos de sono em lotes, na RPC irmã da diária. A identidade
 * (user, onset ao minuto) é resolvida no servidor — ver a migration.
 */
async function pushSleepPeriods(
  rows: SleepPeriodRow[]
): Promise<{ pushed: number; failed: QueueItem[]; error?: string }> {
  let pushed = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await supabase.rpc('sync_upsert_sleep_periods', { rows: chunk });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[health-sync] upsert de sleep_periods falhou:', res.error.message);
      failed.push(...chunk.map((row) => ({ kind: 'sleep' as const, row })));
    } else {
      pushed += chunk.length;
    }
  }
  return { pushed, failed, error };
}

/**
 * Upsert da série intradiária em lotes menores (linhas gordas). A identidade é
 * (user, dia, métrica) e o dia inteiro é substituído — nunca mesclado.
 */
async function pushHealthSeries(
  rows: HealthSeriesRow[]
): Promise<{ pushed: number; failed: QueueItem[]; error?: string }> {
  let pushed = 0;
  const failed: QueueItem[] = [];
  let error: string | undefined;
  for (let i = 0; i < rows.length; i += SERIES_BATCH) {
    const chunk = rows.slice(i, i + SERIES_BATCH);
    const res = await supabase.rpc('sync_upsert_health_series', { rows: chunk });
    if (res.error) {
      if (!error) error = res.error.message;
      console.warn('[health-sync] upsert de health_series falhou:', res.error.message);
      failed.push(...chunk.map((row) => ({ kind: 'series' as const, row })));
    } else {
      pushed += chunk.length;
    }
  }
  return { pushed, failed, error };
}

/** Reprocessa a fila: tenta os itens de saúde, sono e série; preserva os de outro tipo. */
async function flushItems(items: QueueItem[]): Promise<QueueItem[]> {
  const health = items.filter((i): i is Extract<QueueItem, { kind: 'health' }> => i.kind === 'health');
  const sleep = items.filter((i): i is Extract<QueueItem, { kind: 'sleep' }> => i.kind === 'sleep');
  const series = items.filter((i): i is Extract<QueueItem, { kind: 'series' }> => i.kind === 'series');
  const others = items.filter((i) => i.kind !== 'health' && i.kind !== 'sleep' && i.kind !== 'series');
  const res = await pushHealthDaily(health.map((i) => i.row));
  const resSleep = await pushSleepPeriods(sleep.map((i) => i.row));
  const resSeries = await pushHealthSeries(series.map((i) => i.row));
  return [...others, ...res.failed, ...resSleep.failed, ...resSeries.failed];
}

/**
 * As pesadas vêm cruas (uma amostra por leitura) e a ponte nativa devolve a
 * janela inteira num array só: fatiar em blocos evita atravessar 200 dias de
 * FC de uma vez. Mesmas amostras, só em várias idas.
 */
async function fetchInChunks(metric: MetricDef, range: Range): Promise<Sample[]> {
  const out: Sample[] = [];
  for (const window of chunkRange(range, HEAVY_CHUNK_DAYS)) {
    out.push(...(await metric.fetch(window, 'month')));
  }
  return out;
}

/**
 * Sincroniza os agregados diários da janela informada (ou decide pelo cursor:
 * backfill na primeira vez, incremental nas seguintes).
 */
export async function syncHealth(daysBack?: number): Promise<HealthSyncResult> {
  const userId = await currentUserId();
  if (!userId) return { pushed: 0, queued: 0, ok: false, error: 'Sem sessão.' };

  try {
    // Drena pendências antes do novo ciclo.
    await drainQueue(flushItems);

    // Backfill quando: nunca sincronizou OU a versão da agregação avançou
    // (recorrige o histórico já gravado, ex.: correção do sono).
    const cursor = await readHealthCursor(userId);
    const needsBackfill = precisaBackfill(cursor);
    const baseWindow = daysBack ?? (needsBackfill ? BACKFILL_DAYS : SYNC_DAYS);

    // Para agregados diários sempre queremos granularidade de dia (period 1440),
    // logo passamos 'month' ao fetch (qualquer período != 'day'). FC (cara) é
    // limitada no backfill e fatiada, para não puxar amostras cruas de um ano inteiro.
    const rows: HealthDailyRow[] = [];
    const seriesRows: HealthSeriesRow[] = [];
    for (const metric of METRICS) {
      if (metric.id === 'sono') continue; // caminho próprio, abaixo
      const heavy = HEAVY_METRICS.has(metric.id);
      const range = rangeForDays(heavy ? Math.min(baseWindow, HEAVY_MAX_DAYS) : baseWindow);
      const samples = heavy ? await fetchInChunks(metric, range) : await metric.fetch(range, 'month');
      rows.push(...toHealthDailyRows({ id: metric.id, kind: metric.kind }, samples, userId));
      // FC: uma fonte, duas formas. As mesmas amostras que viram média/mín/máx
      // acima viram a série por minuto — nunca uma segunda leitura do HealthKit,
      // senão as duas tabelas podem discordar sobre o mesmo dia.
      if (SERIES_METRICS.has(metric.id)) {
        seriesRows.push(...toHealthSeriesRows(bucketSeriesByMinute(samples, { userId, metric: metric.id })));
      }
    }

    // Sono: uma fonte, duas formas. Os estágios crus viram PERÍODOS (instantes,
    // vigília individual, janela na cama) e a linha diária é DERIVADA deles —
    // nunca calculada em paralelo, senão as duas tabelas discordam sobre a
    // mesma noite. As duas escritas saem do mesmo ciclo.
    const periods = aggregateSleepPeriods(await sleepRawFetch(rangeForDays(baseWindow)), userId);
    rows.push(...toSleepDailyRows(periods, userId));
    const sleepRows = toSleepPeriodRows(periods);

    const { pushed, failed, error } = await pushHealthDaily(rows);
    const sleepRes = await pushSleepPeriods(sleepRows);
    const seriesRes = await pushHealthSeries(seriesRows);
    const allFailed = [...failed, ...sleepRes.failed, ...seriesRes.failed];
    if (allFailed.length) await enqueue(allFailed);

    // Só avança o cursor (e marca a versão) se tudo subiu; senão re-tenta no próximo ciclo.
    if (allFailed.length === 0) {
      await writeHealthCursor(userId, { lastDay: localDay(new Date().toISOString()), version: AGG_VERSION });
    }

    return {
      pushed: pushed + sleepRes.pushed + seriesRes.pushed,
      queued: allFailed.length,
      ok: true,
      error: error ?? sleepRes.error ?? seriesRes.error,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[health-sync] syncHealth falhou:', message);
    return { pushed: 0, queued: 0, ok: false, error: message };
  }
}
