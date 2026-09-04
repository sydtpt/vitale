/**
 * Acesso à tabela `sleep_periods` — dono único (AD-4).
 *
 * Um período de sono é um EVENTO com instantes; a linha diária de `health_daily`
 * é derivada dele (`sleep/derive.ts`). Quem quer horas por dia lê `health_daily`;
 * quem quer a noite — a que horas, com que buracos — lê aqui.
 *
 * Paginado por obrigação, não por otimização (ver `paginate.ts`). A ordenação
 * por `onset_at` é TOTAL: a PK é `(user_id, onset_at)` e toda leitura fixa o
 * `user_id`, então não há empate para desempatar.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Awakening, SleepPeriod } from '../models';
import { fetchAllPages } from './paginate';

/** Linha como o PostgREST a devolve (snake_case; `numeric` chega como string). */
export interface SleepPeriodRecord {
  user_id: string;
  onset_at: string;
  wake_at: string;
  in_bed_at: string | null;
  in_bed_end: string | null;
  tz_offset: number;
  wake_day: string;
  asleep_h: number | string;
  awakenings: Awakening[] | null;
  stages: Record<string, number> | null;
  source: string | null;
}

const COLUMNS =
  'user_id,onset_at,wake_at,in_bed_at,in_bed_end,tz_offset,wake_day,asleep_h,awakenings,stages,source';

export function toSleepPeriod(r: SleepPeriodRecord): SleepPeriod {
  return {
    userId: r.user_id,
    onsetAt: r.onset_at,
    wakeAt: r.wake_at,
    inBedAt: r.in_bed_at,
    inBedEnd: r.in_bed_end,
    tzOffset: Number(r.tz_offset),
    wakeDay: r.wake_day,
    asleepH: Number(r.asleep_h),
    // Os três estados chegam intactos do jsonb: null, [] ou [...]. Não normalizar.
    awakenings: r.awakenings,
    stages: r.stages,
    source: r.source ?? undefined,
  };
}

/** Períodos cujo dia de acordar é `since` ou depois, em ordem cronológica. */
export async function fetchSleepPeriodsSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<SleepPeriod[]> {
  const rows = await fetchAllPages<SleepPeriodRecord>((lo, hi) =>
    db
      .from('sleep_periods')
      .select(COLUMNS)
      .eq('user_id', userId)
      .gte('wake_day', since)
      .order('onset_at', { ascending: true })
      .range(lo, hi),
  );
  return rows.map(toSleepPeriod);
}
