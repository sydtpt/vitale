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

/** Janela (em dias) de logs mantida em memória — cobre semana atual + anterior do recap. */
const WINDOW_DAYS = 21;

interface RegistrosState {
  registros: Registro[];                 // todos (ativos + arquivados), ordenados por `sort`
  todayMarks: Record<string, boolean>;   // registroId → marcado hoje
  recentLogs: Record<string, string[]>;  // registroId → datas (YYYY-MM-DD) dos últimos WINDOW_DAYS
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  toggleToday: (id: string) => Promise<void>;

  /** Datas (YYYY-MM-DD) marcadas de um registro na janela em memória — síncrono, p/ o recap. */
  logDatesFor: (id: string) => string[];

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

type MarkState = Pick<RegistrosState, 'todayMarks' | 'recentLogs'>;

/** Aplica/retira a marca de um registro num dia, mantendo todayMarks + recentLogs coerentes. */
function applyMark(s: MarkState, id: string, date: string, done: boolean): MarkState {
  const todayMarks = { ...s.todayMarks };
  if (date === localDateStr()) {
    if (done) todayMarks[id] = true;
    else delete todayMarks[id];
  }
  const cur = s.recentLogs[id] ?? [];
  const recentLogs = {
    ...s.recentLogs,
    [id]: done ? (cur.includes(date) ? cur : [...cur, date]) : cur.filter((d) => d !== date),
  };
  return { todayMarks, recentLogs };
}

export const useRegistrosStore = create<RegistrosState>((set, get) => ({
  registros: [],
  todayMarks: {},
  recentLogs: {},
  loading: false,
  loaded: false,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const today = localDateStr();
    const since = localDateStr(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));
    const [regsRes, logsRes] = await Promise.all([
      supabase.from('registros').select('*').order('sort', { ascending: true }),
      supabase.from('registro_logs').select('registro_id, log_date').gte('log_date', since),
    ]);

    const registros = (regsRes.data ?? []).map(toRegistro);
    const todayMarks: Record<string, boolean> = {};
    const recentLogs: Record<string, string[]> = {};
    for (const l of logsRes.data ?? []) {
      const rid = l.registro_id as string;
      const date = l.log_date as string;
      (recentLogs[rid] ??= []).push(date);
      if (date === today) todayMarks[rid] = true;
    }

    set({ registros, todayMarks, recentLogs, loading: false, loaded: true });
  },

  logDatesFor: (id) => get().recentLogs[id] ?? [],

  toggleToday: async (id) => {
    const userId = currentUserId();
    if (!userId) return;
    const today = localDateStr();
    const wasDone = get().todayMarks[id] ?? false;

    // otimista
    set((s) => applyMark(s, id, today, !wasDone));

    const { error } = wasDone
      ? await supabase.from('registro_logs').delete().eq('registro_id', id).eq('log_date', today)
      : await supabase
          .from('registro_logs')
          .upsert({ registro_id: id, user_id: userId, log_date: today }, { onConflict: 'registro_id,log_date' });

    if (error) {
      // reverte em caso de falha
      set((s) => applyMark(s, id, today, wasDone));
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

    // mantém todayMarks + a janela em memória coerentes após a escrita
    set((s) => applyMark(s, id, date, done));
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
