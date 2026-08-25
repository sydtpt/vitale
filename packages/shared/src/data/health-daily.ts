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

/**
 * Tamanho da página. O PostgREST tem um teto **implícito** de 1000 linhas por
 * resposta: passar dele não dá erro — os registros excedentes simplesmente não
 * vêm, em ordem indefinida. `health_daily` grava ~9 linhas por dia (uma por
 * métrica), então 111 dias já bastam para estourar.
 *
 * Foi assim que a Retrospectiva no modo Estação (≈147 dias ⇒ ~1400 linhas) passou
 * a mostrar buraco onde havia dado. Paginar é obrigatório aqui, não otimização.
 */
const PAGE = 1000;

/**
 * Busca todas as páginas de uma consulta por intervalo.
 *
 * Ordenação estável é parte do contrato: sem `order`, duas páginas podem repetir
 * ou pular linhas. Para quando `page` volta com menos que o tamanho da página —
 * é a única condição de parada confiável, já que não há contagem total.
 */
async function fetchAllPages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

/** Agregados diários desde `since`, em ordem cronológica. */
export async function fetchHealthDailySince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<HealthDaily[]> {
  const rows = await fetchAllPages<HealthDailyRow>((lo, hi) =>
    db
      .from('health_daily')
      .select(COLUMNS)
      .eq('user_id', userId)
      .gte('day', since)
      .order('day', { ascending: true })
      .order('metric', { ascending: true })
      .range(lo, hi),
  );
  return rows.map((r) => toHealthDaily(r, userId));
}

/** Só dia, métrica e valor — para agregados que não precisam de min/max/extra. */
export async function fetchHealthDailyValues(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<Array<{ day: string; metric: string; value: number | null }>> {
  const rows = await fetchAllPages<{ day: string; metric: string; value: number | string | null }>(
    (lo, hi) =>
      db
        .from('health_daily')
        .select('day,metric,value')
        .eq('user_id', userId)
        .gte('day', since)
        .order('day', { ascending: true })
        .order('metric', { ascending: true })
        .range(lo, hi),
  );
  return rows.map((r) => ({
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
  }));
}
