/**
 * Acesso à tabela `health_daily` — dono único (AD-4).
 *
 * Uma linha por (dia, métrica). Escrever **não** passa por aqui: quem grava é o
 * sync do mobile, via upsert em lote com `AGG_VERSION` (ADR 0004) — recorrigir
 * agregação é bump de versão, não migration nem escrita avulsa. Daqui só se lê.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthDaily } from '../models';

const COLUMNS = 'day,metric,value,min_value,max_value,count,extra';

export interface HealthDailyRow {
  day: string;
  metric: string;
  value: number | string | null;
  min_value?: number | string | null;
  max_value?: number | string | null;
  count?: number | null;
  extra?: Record<string, unknown> | null;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toHealthDaily(r: HealthDailyRow, userId: string): HealthDaily {
  return {
    userId,
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
    minValue: r.min_value == null ? undefined : Number(r.min_value),
    maxValue: r.max_value == null ? undefined : Number(r.max_value),
    count: r.count ?? undefined,
    extra: r.extra ?? undefined,
  };
}

/** Agregados diários desde `since`, em ordem cronológica. */
export async function fetchHealthDailySince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HealthDaily[]> {
  const { data, error } = await db
    .from('health_daily')
    .select(COLUMNS)
    .eq('user_id', userId)
    .gte('day', since)
    .order('day', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as HealthDailyRow[]).map((r) => toHealthDaily(r, userId));
}

/** Só dia, métrica e valor — para agregados que não precisam de min/max/extra. */
export async function fetchHealthDailyValues(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<Array<{ day: string; metric: string; value: number | null }>> {
  const { data, error } = await db
    .from('health_daily')
    .select('day,metric,value')
    .eq('user_id', userId)
    .gte('day', since);
  if (error) throw error;
  return ((data ?? []) as Array<{ day: string; metric: string; value: number | string | null }>).map(
    (r) => ({ day: r.day, metric: r.metric, value: r.value == null ? null : Number(r.value) }),
  );
}
