import { create } from 'zustand';
import {
  fetchDailyRatingsSince,
  fetchSleepPeriodsSince,
  localDateStr,
  type SleepPeriod,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';

/**
 * Janela em memória, em dias. O timing chart usa 14, o relógio de vigília ~30,
 * e o par nota × medição quer o máximo que houver — 90 é a mesma janela de
 * análise da Retrospectiva (`ANALYSIS_WINDOW_DAYS`), pelo mesmo motivo: abaixo
 * disso o `n` por nota fica pequeno demais para mostrar.
 */
export const SONO_WINDOW_DAYS = 90;

interface SonoState {
  /** Períodos da janela, em ordem cronológica (mais antigo primeiro). */
  periods: SleepPeriod[];
  /** Nota 1–5 dada ao acordar, por dia de acordar. */
  sleepRatings: Record<string, number>;
  loading: boolean;
  loaded: boolean;
  error?: string;

  load: () => Promise<void>;
  /** O período de um dia de acordar — a chave de junção com a nota. */
  byDay: (wakeDay: string) => SleepPeriod | undefined;
}

function sinceDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return localDateStr(d);
}

export const useSonoStore = create<SonoState>((set, get) => ({
  periods: [],
  sleepRatings: {},
  loading: false,
  loaded: false,

  async load() {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    set({ loading: true, error: undefined });
    try {
      // Períodos: o histórico inteiro — as subviews navegam por ano e por
      // 12 meses, e a tabela tem no máximo o backfill de 500 dias (~1 linha/dia).
      // Notas: só a janela de análise; o par nota × medição do /sono usa 90 dias.
      const [periods, ratings] = await Promise.all([
        fetchSleepPeriodsSince(supabase, userId, '2000-01-01'),
        fetchDailyRatingsSince(supabase, userId, sinceDay(SONO_WINDOW_DAYS)),
      ]);
      const sleepRatings: Record<string, number> = {};
      for (const r of ratings) if (r.sleepQuality != null) sleepRatings[r.day] = r.sleepQuality;
      set({ periods, sleepRatings, loading: false, loaded: true });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar o sono.' });
    }
  },

  byDay(wakeDay) {
    // Mais recente primeiro: num dia com dois períodos, o que acordou por último
    // é a "noite" que a tela chama pelo dia.
    return [...get().periods].reverse().find((p) => p.wakeDay === wakeDay);
  },
}));
