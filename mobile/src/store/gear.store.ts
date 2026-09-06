import { create } from 'zustand';
import { fetchGear } from '@vitale/shared';
import type { Gear } from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { supabase } from '../lib/supabase';

/**
 * As bicicletas do usuário (ADR 0034). Poucas linhas, lidas uma vez por sessão;
 * a pergunta "de qual bike foi esta pedalada" não fica aqui — é
 * `gearForActivity` do shared, que a tela chama com `gears` + a atividade.
 */
interface GearState {
  gears: Gear[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
}

export const useGearStore = create<GearState>((set, get) => ({
  gears: [],
  loaded: false,
  loading: false,
  error: null,

  load: async (force = false) => {
    if ((get().loaded && !force) || get().loading) return;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    set({ loading: true, error: null });
    try {
      const gears = await fetchGear(supabase, userId);
      set({ gears, loaded: true, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Erro ao carregar.' });
    }
  },
}));
