import { create } from 'zustand';
import { fetchHealthSeries, localDateStr, type HealthSeriesDay } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';

/**
 * Janela em memória da série de FC (`health_series`): 60 dias, os mesmos que a
 * web usa para a faixa típica e as noites. O detalhe de Freq. cardíaca lê daqui
 * só o que o HealthKit não tem — o perfil por hora e a noite —; a curva do dia
 * continua vindo do HealthKit, que está no aparelho e é mais fresco.
 */
export const HEART_WINDOW_DAYS = 60;

interface HeartSeriesState {
  days: HealthSeriesDay[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  load: (force?: boolean) => Promise<void>;
}

function sinceDay(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return localDateStr(d);
}

export const useHeartSeriesStore = create<HeartSeriesState>((set, get) => ({
  days: [],
  loading: false,
  loaded: false,

  async load(force = false) {
    if (!force && (get().loaded || get().loading)) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    set({ loading: true, error: undefined });
    try {
      const days = await fetchHealthSeries(supabase, userId, 'fc', sinceDay(HEART_WINDOW_DAYS), localDateStr());
      set({ days, loading: false, loaded: true });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar a série.' });
    }
  },
}));
