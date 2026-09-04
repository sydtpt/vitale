/**
 * Sincronização push-only de saúde (Apple Health → Supabase), por janela de datas.
 *
 * O mobile agrega as amostras do HealthKit em valores DIÁRIOS (cumulativas = soma;
 * discretas = média/min/max) e envia via RPC idempotente `sync_upsert_health_daily`.
 * Re-sincroniza sempre os últimos dias (cobre "hoje ainda mudando" + dados que
 * chegam atrasados do relógio); o primeiro sync — ou um bump de `AGG_VERSION` —
 * dispara um backfill maior que recorrige o histórico automaticamente.
 *
 * Espelha a infra de `activity-sync.ts`: lotes, fila offline e cursor local.
 */
import { supabase } from '../lib/supabase';
import { METRICS, sleepRawFetch, type Range } from '../config/health-metrics';
import { toHealthDailyRows, localDay, type HealthDailyRow } from '../lib/health-aggregate';
import { aggregateSleepPeriods } from '../lib/health-buckets';
import { toSleepDailyRows, toSleepPeriodRows, type SleepPeriodRow } from '../lib/sleep-rows';
import { enqueue, drainQueue, type QueueItem } from '../lib/sync-queue';
import { readHealthCursor, writeHealthCursor } from '../lib/health-sync-cursor';

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
/** Métricas de altíssima frequência (FC): caras de puxar cruas — limitadas no backfill. */
const HEAVY_METRICS = new Set(['fc']);
const HEAVY_MAX_DAYS = 60;
/**
 * Versão da lógica de agregação. Incrementar força um re-backfill único em todos
 * os dispositivos (recorrige o histórico já gravado). v1 = correção do sono
 * (união de fontes + priorização de estágios + atribuição ao dia de despertar).
 * v2 = dedupe por fonte nas cumulativas (passos/distância/andares/energia vinham
 * somando iPhone + relógio, dobrando a contagem).
 * v3 = detalhamento do sono por estágio (deep/rem/core/unspecified/awake) no
 * `extra`; o backfill recupera o hipnograma do histórico já gravado, porque as
 * amostras cruas seguem no HealthKit do aparelho.
 * v4 = tempo na cama e latência para pegar no sono (`inbed`/`onset`), que o
 * INBED do HealthKit permitia calcular mas era descartado na agregação.
 * v5 = piso de 1 min para aceitar a latência (`MIN_ONSET_MS`). O Garmin abre o
 * `INBED` 1 s antes do sono, gerando `onset` ≈ 0 que se disfarçava de "apagou na
 * hora"; o backfill reescreve essas linhas sem a chave falsa (o upsert troca o
 * `extra` inteiro, não faz merge).
 * v6 = sono passa a gravar `sleep_periods` (instantes, vigílias individuais,
 * janela na cama crua) e a linha diária vira DERIVADA dos períodos — uma fonte,
 * duas formas. Três correções entram no mesmo backfill: o AWAKE em segmentos
 * encostados (Garmin) deixa de ser descartado (36 de 38 noites vinham zeradas);
 * a janela na cama vira a união das INBED, nunca menor que o sono (14 noites do
 * histórico tinham eficiência > 100%); e `value` fica idêntico ao de antes,
 * por teste de paridade. Ver docs/specs/sono/.
 * v7 = onset truncado ao minuto NO CLIENTE, antes de derivar a janela na cama.
 * No v6 só a RPC truncava, e um INBED começando no mesmo minuto ficava até 57 s
 * DEPOIS do onset — 57 noites violando `in_bed_at <= onset_at`. Mesma chave,
 * mesmas linhas: o backfill só corrige o `in_bed_at`.
 * v8 = `stage_segments`: os intervalos por estágio na posição real, que o
 * agregador já fatiava e não emitia. É o dado da Opção 2 da CAP-7 (estágios na
 * barra do timing chart) e do detalhe da noite. Mesma chave, mesmas linhas; só a
 * coluna nova se preenche.
 */
const AGG_VERSION = 8;

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

/** Reprocessa a fila: tenta os itens de saúde e de sono; preserva os de outro tipo. */
async function flushItems(items: QueueItem[]): Promise<QueueItem[]> {
  const health = items.filter((i): i is Extract<QueueItem, { kind: 'health' }> => i.kind === 'health');
  const sleep = items.filter((i): i is Extract<QueueItem, { kind: 'sleep' }> => i.kind === 'sleep');
  const others = items.filter((i) => i.kind !== 'health' && i.kind !== 'sleep');
  const res = await pushHealthDaily(health.map((i) => i.row));
  const resSleep = await pushSleepPeriods(sleep.map((i) => i.row));
  return [...others, ...res.failed, ...resSleep.failed];
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
    const needsBackfill = cursor.lastDay == null || cursor.version < AGG_VERSION;
    const baseWindow = daysBack ?? (needsBackfill ? BACKFILL_DAYS : SYNC_DAYS);

    // Para agregados diários sempre queremos granularidade de dia (period 1440),
    // logo passamos 'month' ao fetch (qualquer período != 'day'). FC (cara) é
    // limitada no backfill para não puxar amostras cruas de um ano inteiro.
    const rows: HealthDailyRow[] = [];
    for (const metric of METRICS) {
      if (metric.id === 'sono') continue; // caminho próprio, abaixo
      const window = HEAVY_METRICS.has(metric.id) ? Math.min(baseWindow, HEAVY_MAX_DAYS) : baseWindow;
      const samples = await metric.fetch(rangeForDays(window), 'month');
      rows.push(...toHealthDailyRows({ id: metric.id, kind: metric.kind }, samples, userId));
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
    const allFailed = [...failed, ...sleepRes.failed];
    if (allFailed.length) await enqueue(allFailed);

    // Só avança o cursor (e marca a versão) se tudo subiu; senão re-tenta no próximo ciclo.
    if (allFailed.length === 0) {
      await writeHealthCursor(userId, { lastDay: localDay(new Date().toISOString()), version: AGG_VERSION });
    }

    return {
      pushed: pushed + sleepRes.pushed,
      queued: allFailed.length,
      ok: true,
      error: error ?? sleepRes.error,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[health-sync] syncHealth falhou:', message);
    return { pushed: 0, queued: 0, ok: false, error: message };
  }
}
