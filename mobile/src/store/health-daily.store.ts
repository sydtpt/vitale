import { create } from 'zustand';
import type { HealthDaily } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/planned-match';
import { useAuthStore } from './auth.store';

/** Janela analítica (~1 ano), alinhada ao backfill do sync. */
const RANGE_DAYS = 365;

interface DbRow {
  day: string;
  metric: string;
  value: number | string | null;
  min_value: number | string | null;
  max_value: number | string | null;
  count: number | string | null;
  extra: Record<string, unknown> | null;
}

function num(v: number | string | null): number | undefined {
  return v == null ? undefined : Number(v);
}

function toRow(userId: string, r: DbRow): HealthDaily {
  return {
    userId,
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
    minValue: num(r.min_value),
    maxValue: num(r.max_value),
    count: num(r.count),
    extra: r.extra ?? undefined,
  };
}

interface HealthDailyState {
  rows: HealthDaily[];
  loading: boolean;
  loaded: boolean;

  load: (force?: boolean) => Promise<void>;
  seriesFor: (metric: string) => HealthDaily[];
  valuesByDay: (metric: string) => Map<string, number>;
}

/**
 * Lê os agregados diários de saúde do Supabase (`health_daily`) — a mesma tabela
 * que o sync do mobile escreve. Espelha o `HealthStore` do web: expõe séries por
 * métrica e mapas dia→valor para a seção Recuperação (tendências 30/90d, etc.).
 * Distinto do `health.store` (resumos de 7d para os cards da aba Saúde).
 */
export const useHealthDailyStore = create<HealthDailyState>((set, get) => ({
  rows: [],
  loading: false,
  loaded: false,

  load: async (force = false) => {
    const { loading, loaded } = get();
    if (loading || (loaded && !force)) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ loading: true });
    const since = localDateStr(new Date(Date.now() - (RANGE_DAYS - 1) * 86400000));

    const { data, error } = await supabase
      .from('health_daily')
      .select('day,metric,value,min_value,max_value,count,extra')
      .gte('day', since)
      .order('day', { ascending: true });

    if (error) {
      set({ loading: false });
      return;
    }

    set({
      rows: ((data ?? []) as DbRow[]).map((r) => toRow(userId, r)),
      loading: false,
      loaded: true,
    });
  },

  seriesFor: (metric) => get().rows.filter((r) => r.metric === metric),

  valuesByDay: (metric) => {
    const m = new Map<string, number>();
    for (const r of get().rows) if (r.metric === metric && r.value != null) m.set(r.day, r.value);
    return m;
  },
}));
