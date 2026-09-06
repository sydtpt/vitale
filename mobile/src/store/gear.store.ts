import { create } from 'zustand';
import {
  applyGearWindows,
  createGear,
  deleteGear,
  fetchGear,
  planDefaultGear,
  updateGear,
  type Gear,
  type GearInput,
} from '@vitale/shared';
import { useAuthStore } from './auth.store';
import { supabase } from '../lib/supabase';

/**
 * As bicicletas do usuário (ADR 0034). Poucas linhas, lidas uma vez por sessão;
 * a pergunta "de qual bike foi esta pedalada" não fica aqui — é
 * `gearForActivity` do shared, que a tela chama com `gears` + a atividade.
 *
 * "Padrão" não é um campo: é a bicicleta com a janela aberta. Quem escolhe uma
 * padrão fecha a das outras no dia anterior, e é `planDefaultGear` (puro,
 * testado) quem decide o que muda — a store só aplica e recarrega.
 */
interface GearState {
  gears: Gear[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
  /** Cadastra; com `asDefault`, fecha a janela das outras a partir de `activeFrom`. */
  add: (input: GearInput, asDefault: boolean) => Promise<void>;
  edit: (id: string, patch: Partial<GearInput>) => Promise<void>;
  /** Torna esta a bicicleta em uso a partir de hoje (ou de `from`). */
  setDefault: (id: string, from?: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function today(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' + m : m}-${day < 10 ? '0' + day : day}`;
}

function requireUser(): string {
  const id = useAuthStore.getState().user?.id;
  if (!id) throw new Error('Sessão não encontrada.');
  return id;
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

  add: async (input, asDefault) => {
    const userId = requireUser();
    const created = await createGear(supabase, userId, input);
    if (asDefault) {
      // Com a nova já na lista: senão o plano não a enxerga e não reabre nada.
      const changes = planDefaultGear([...get().gears, created], created.id, input.activeFrom);
      await applyGearWindows(supabase, userId, changes);
    }
    await get().load(true);
  },

  edit: async (id, patch) => {
    const userId = requireUser();
    await updateGear(supabase, userId, id, patch);
    await get().load(true);
  },

  setDefault: async (id, from) => {
    const userId = requireUser();
    const changes = planDefaultGear(get().gears, id, from ?? today());
    if (changes.length === 0) return;
    await applyGearWindows(supabase, userId, changes);
    await get().load(true);
  },

  remove: async (id) => {
    const userId = requireUser();
    await deleteGear(supabase, userId, id);
    await get().load(true);
  },
}));
