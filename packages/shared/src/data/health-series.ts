/**
 * Acesso à tabela `health_series` — dono único (AD-4).
 *
 * Uma linha por (dia local, métrica), com a série do dia em dois arrays
 * paralelos (ADR 0033). Escrever **não** passa por aqui: quem grava é o sync do
 * mobile, pela RPC `sync_upsert_health_series`, no mesmo ciclo e a partir das
 * mesmas amostras que produzem a linha diária de `health_daily`. Daqui só se lê.
 *
 * Paginado por obrigação (ver `paginate.ts`), embora um ano de FC sejam ~365
 * linhas: a regra vale para toda leitura por intervalo. Ordenação por `day` é
 * total porque `metric` e `user_id` estão fixos na consulta.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthSeriesDay } from '../models';
import { fetchAllPages } from './paginate';

/** Linha como o PostgREST a devolve (arrays nativos chegam como arrays JSON). */
export interface HealthSeriesRecord {
  day: string;
  metric: string;
  tz_offset: number;
  minutes: number[];
  readings: number[];
}

const COLUMNS = 'day,metric,tz_offset,minutes,readings';

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toHealthSeriesDay(r: HealthSeriesRecord, userId: string): HealthSeriesDay {
  return {
    userId,
    day: r.day,
    metric: r.metric,
    tzOffset: Number(r.tz_offset),
    minutes: r.minutes.map(Number),
    readings: r.readings.map(Number),
  };
}

/** Série de uma métrica entre `from` e `to` (dias locais, inclusive), em ordem cronológica. */
export async function fetchHealthSeries(
  db: SupabaseClient,
  userId: string,
  metric: string,
  from: string,
  to: string,
): Promise<HealthSeriesDay[]> {
  const rows = await fetchAllPages<HealthSeriesRecord>((lo, hi) =>
    db
      .from('health_series')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('metric', metric)
      .gte('day', from)
      .lte('day', to)
      .order('day', { ascending: true })
      .range(lo, hi),
  );
  return rows.map((r) => toHealthSeriesDay(r, userId));
}
