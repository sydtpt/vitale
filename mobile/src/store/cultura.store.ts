import { create } from 'zustand';
import {
  createCulturaItem,
  datasAposTransicao,
  deleteCulturaItem,
  fetchCulturaItems,
  fetchIndicadores,
  findCulturaItemPorFonte,
  convergirIndicador,
  updateCulturaItem,
  type CulturaEstado,
  type CulturaItem,
  type CulturaPatch,
  type CulturaTipo,
  type NewCulturaItem,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';

interface CulturaState {
  itens: CulturaItem[];
  /** Indicadores já usados — base do autocomplete que converge grafias (CAP-11). */
  indicadores: string[];
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;

  /**
   * Item já na estante com o mesmo id de catálogo, ou `null`. A tela chama
   * antes de salvar para NAVEGAR ao existente em vez de estourar o unique
   * parcial do banco — encontrar o que você já tem é resposta útil.
   */
  jaNaEstante: (fonte: string, fonteId: string) => Promise<CulturaItem | null>;

  /** Cria e recarrega. Devolve o id, para a tela poder navegar até ele. */
  adicionar: (input: NewCulturaItem) => Promise<string>;

  /**
   * Move o item de estado na data informada (CAP-2). As datas resultantes vêm
   * de `datasAposTransicao` no núcleo — a tela não as calcula, senão a regra
   * de "reler usa a data nova" precisaria ser lembrada em cada chamador.
   */
  transitar: (item: CulturaItem, para: CulturaEstado, data: string) => Promise<void>;

  /** Edita campos do item (CAP-12). `tipo` não está entre eles, de propósito. */
  atualizar: (item: CulturaItem, patch: CulturaPatch) => Promise<void>;

  /** Deleção é a única saída da estante (CAP-10). */
  deletar: (id: string) => Promise<void>;

  /** Aplica a convergência de grafia sobre os indicadores em memória. */
  convergir: (digitado: string) => string;
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useCulturaStore = create<CulturaState>((set, get) => ({
  itens: [],
  indicadores: [],
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });
    try {
      const [itens, indicadores] = await Promise.all([
        fetchCulturaItems(supabase, userId),
        fetchIndicadores(supabase, userId),
      ]);
      set({ itens, indicadores, loading: false, loaded: true });
    } catch {
      set({ loading: false });
    }
  },

  jaNaEstante: async (fonte, fonteId) => {
    const userId = currentUserId();
    if (!userId) return null;
    // Confere primeiro em memória: evita ida ao banco no caso comum.
    const local = get().itens.find((i) => i.fonte === fonte && i.fonteId === fonteId);
    if (local) return local;
    return findCulturaItemPorFonte(supabase, userId, fonte, fonteId);
  },

  adicionar: async (input) => {
    const userId = currentUserId();
    if (!userId) throw new Error('sem usuário autenticado');
    const id = await createCulturaItem(supabase, userId, input);
    await get().load();
    return id;
  },

  transitar: async (item, para, data) => {
    const datas = datasAposTransicao(
      { iniciadoEm: item.iniciadoEm, concluidoEm: item.concluidoEm },
      para,
      data,
    );
    // `?? null` e não `?? undefined`: no patch, `undefined` significa "não
    // mexe" e `null` significa "limpa". Voltar para `quero` precisa LIMPAR as
    // datas — com undefined elas sobreviveriam e o item ficaria incoerente
    // com o próprio estado, batendo nos checks da migration.
    await updateCulturaItem(supabase, item, {
      estado: para,
      iniciadoEm: datas.iniciadoEm ?? null,
      concluidoEm: datas.concluidoEm ?? null,
    });
    await get().load();
  },

  atualizar: async (item, patch) => {
    await updateCulturaItem(supabase, item, patch);
    await get().load();
  },

  deletar: async (id) => {
    await deleteCulturaItem(supabase, id);
    await get().load();
  },

  convergir: (digitado) => convergirIndicador(digitado, get().indicadores),
}));

export type { CulturaEstado, CulturaItem, CulturaTipo };
