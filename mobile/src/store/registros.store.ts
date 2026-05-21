import { create } from 'zustand';
import type { Registro, TodoModule } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/habit-logic';
import { useAuthStore } from './auth.store';

export interface NewRegistro {
  name: string;
  icon: string;
  color: string;
  module: TodoModule;
}

/** Campos editáveis de um registro. */
export interface RegistroPatch {
  name?: string;
  icon?: string;
  color?: string;
  module?: TodoModule;
  active?: boolean;
  sort?: number;
}

interface RegistrosState {
  registros: Registro[];                 // todos (ativos + arquivados), ordenados por `sort`
  todayMarks: Record<string, boolean>;   // registroId → marcado hoje
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  toggleToday: (id: string) => Promise<void>;

  /** Datas (YYYY-MM-DD) já marcadas de um registro — para a tela de marcação retroativa. */
  fetchRegistroLogs: (id: string) => Promise<string[]>;
  /** Marca/desmarca um dia específico (passado ou hoje). Retorna `true` em sucesso. */
  setRegistroMark: (id: string, date: string, done: boolean) => Promise<boolean>;

  createRegistro: (input: NewRegistro) => Promise<void>;
  updateRegistro: (id: string, patch: RegistroPatch) => Promise<void>;
  archiveRegistro: (id: string, active: boolean) => Promise<void>;
}

type RegistroRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  module: TodoModule;
  active: boolean;
  sort: number;
  created_at: string;
};

function toRegistro(row: RegistroRow): Registro {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon ?? '',
    color: row.color ?? '',
    module: row.module,
    active: row.active,
    sort: row.sort,
    createdAt: row.created_at,
  };
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useRegistrosStore = create<RegistrosState>((set, get) => ({
  registros: [],
  todayMarks: {},
  loading: false,
  loaded: false,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const today = localDateStr();
    const [regsRes, logsRes] = await Promise.all([
      supabase.from('registros').select('*').order('sort', { ascending: true }),
      supabase.from('registro_logs').select('registro_id').eq('log_date', today),
    ]);

    const registros = (regsRes.data ?? []).map(toRegistro);
    const todayMarks: Record<string, boolean> = {};
    for (const l of logsRes.data ?? []) todayMarks[l.registro_id as string] = true;

    set({ registros, todayMarks, loading: false, loaded: true });
  },

  toggleToday: async (id) => {
    const userId = currentUserId();
    if (!userId) return;
    const today = localDateStr();
    const wasDone = get().todayMarks[id] ?? false;

    // otimista
    set((s) => {
      const next = { ...s.todayMarks };
      if (wasDone) delete next[id];
      else next[id] = true;
      return { todayMarks: next };
    });

    const { error } = wasDone
      ? await supabase.from('registro_logs').delete().eq('registro_id', id).eq('log_date', today)
      : await supabase
          .from('registro_logs')
          .upsert({ registro_id: id, user_id: userId, log_date: today }, { onConflict: 'registro_id,log_date' });

    if (error) {
      // reverte em caso de falha
      set((s) => {
        const next = { ...s.todayMarks };
        if (wasDone) next[id] = true;
        else delete next[id];
        return { todayMarks: next };
      });
    }
  },

  fetchRegistroLogs: async (id) => {
    if (!currentUserId()) return [];
    const { data } = await supabase
      .from('registro_logs')
      .select('log_date')
      .eq('registro_id', id);
    return (data ?? []).map((l) => l.log_date as string);
  },

  setRegistroMark: async (id, date, done) => {
    const userId = currentUserId();
    if (!userId) return false;

    const { error } = done
      ? await supabase
          .from('registro_logs')
          .upsert({ registro_id: id, user_id: userId, log_date: date }, { onConflict: 'registro_id,log_date' })
      : await supabase.from('registro_logs').delete().eq('registro_id', id).eq('log_date', date);

    if (error) return false;

    // mantém o estado de "hoje" coerente caso o dia marcado seja o de hoje
    if (date === localDateStr()) {
      set((s) => {
        const next = { ...s.todayMarks };
        if (done) next[id] = true;
        else delete next[id];
        return { todayMarks: next };
      });
    }
    return true;
  },

  createRegistro: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const sort = get().registros.reduce((max, r) => Math.max(max, r.sort), -1) + 1;
    await supabase.from('registros').insert({
      user_id: userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      module: input.module,
      sort,
    });
    await get().load();
  },

  updateRegistro: async (id, patch) => {
    await supabase.from('registros').update(patch).eq('id', id);
    await get().load();
  },

  archiveRegistro: async (id, active) => {
    await supabase.from('registros').update({ active }).eq('id', id);
    await get().load();
  },
}));
