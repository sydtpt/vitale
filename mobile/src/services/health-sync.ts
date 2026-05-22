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
import { METRICS, type Range } from '../config/health-metrics';
import { toHealthDailyRows, localDay, type HealthDailyRow } from '../lib/health-aggregate';
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
/** Janela do backfill (primeiro sync do dispositivo OU recorreção por versão). */
const BACKFILL_DAYS = 365;
/** Métricas de altíssima frequência (FC): caras de puxar cruas — limitadas no backfill. */
const HEAVY_METRICS = new Set(['fc']);
const HEAVY_MAX_DAYS = 60;
/**
 * Versão da lógica de agregação. Incrementar força um re-backfill único em todos
 * os dispositivos (recorrige o histórico já gravado). v1 = correção do sono
 * (união de fontes + priorização de estágios + atribuição ao dia de despertar).
 */
const AGG_VERSION = 1;

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

/** Reprocessa a fila: tenta os itens de saúde; preserva os de outro tipo. */
async function flushItems(items: QueueItem[]): Promise<QueueItem[]> {
  const health = items.filter((i): i is Extract<QueueItem, { kind: 'health' }> => i.kind === 'health');
  const others = items.filter((i) => i.kind !== 'health');
  const res = await pushHealthDaily(health.map((i) => i.row));
  return [...others, ...res.failed];
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
      const window = HEAVY_METRICS.has(metric.id) ? Math.min(baseWindow, HEAVY_MAX_DAYS) : baseWindow;
      const samples = await metric.fetch(rangeForDays(window), 'month');
      rows.push(...toHealthDailyRows({ id: metric.id, kind: metric.kind }, samples, userId));
    }

    const { pushed, failed, error } = await pushHealthDaily(rows);
    if (failed.length) await enqueue(failed);

    // Só avança o cursor (e marca a versão) se tudo subiu; senão re-tenta no próximo ciclo.
    if (failed.length === 0) {
      await writeHealthCursor(userId, { lastDay: localDay(new Date().toISOString()), version: AGG_VERSION });
    }

    return { pushed, queued: failed.length, ok: true, error };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro no sync.';
    console.warn('[health-sync] syncHealth falhou:', message);
    return { pushed: 0, queued: 0, ok: false, error: message };
  }
}
