/**
 * Períodos de sono → as duas escritas do sync.
 *
 * Uma fonte, duas formas, no mesmo ciclo: `sleep_periods` (o evento com
 * instantes) e a linha `sono` de `health_daily` (a grandeza diária, DERIVADA dos
 * períodos pelo núcleo). É o que impede a mesma noite de dizer duas coisas em
 * duas tabelas — o padrão de reclamação nº 5 da pesquisa competitiva.
 *
 * Puro, sem dependência nativa: `aggregateSleepPeriods` entrega os períodos e
 * este módulo só os veste para o Postgres.
 */
import { deriveSleepDays, type SleepPeriod } from '@vitale/shared';
import type { HealthDailyRow } from './health-aggregate';

/** Linha de `sleep_periods` (snake_case, como a RPC `sync_upsert_sleep_periods` lê). */
export interface SleepPeriodRow {
  user_id: string;
  onset_at: string;
  wake_at: string;
  in_bed_at: string | null;
  in_bed_end: string | null;
  tz_offset: number;
  wake_day: string;
  asleep_h: number;
  /**
   * Vai como JSON `null` quando a fonte não reporta — a RPC converte para SQL
   * NULL com `nullif`. `[]` é outro estado e chega como array vazio.
   */
  awakenings: { from: string; to: string }[] | null;
  stages: Record<string, number> | null;
  source: string | null;
}

export function toSleepPeriodRows(periods: readonly SleepPeriod[]): SleepPeriodRow[] {
  return periods.map((p) => ({
    user_id: p.userId,
    onset_at: p.onsetAt,
    wake_at: p.wakeAt,
    in_bed_at: p.inBedAt,
    in_bed_end: p.inBedEnd,
    tz_offset: p.tzOffset,
    wake_day: p.wakeDay,
    asleep_h: p.asleepH,
    awakenings: p.awakenings,
    stages: p.stages,
    source: p.source ?? null,
  }));
}

/**
 * A linha diária, derivada — não calculada em paralelo. `deriveSleepDays` já
 * devolve `extra` no formato que prontidão, retrospectiva e destaques leem.
 */
export function toSleepDailyRows(periods: readonly SleepPeriod[], userId: string): HealthDailyRow[] {
  return deriveSleepDays(periods).map((d) => ({
    user_id: userId,
    day: d.day,
    metric: 'sono',
    value: d.value,
    count: d.count,
    extra: d.extra,
  }));
}
