import { create } from 'zustand';
import type { FinanceTransaction } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { localDateStr } from '../lib/habit-logic';
import { useAuthStore } from './auth.store';

/** Campos de uma despesa nova capturada pelo QuickAddSheet. */
export interface NewTransaction {
  amount: number;          // em reais (> 0)
  description: string;
  category: string;
}

/** Janela (em dias) de transações mantida em memória. */
const WINDOW_DAYS = 60;

interface TransactionsState {
  recent: FinanceTransaction[];   // transações recentes (janela), mais novas primeiro
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  createTransaction: (input: NewTransaction) => Promise<boolean>;
}

type TransactionRow = {
  id: string;
  tx_date: string;
  description: string;
  category: string | null;
  amount: number | string;   // numeric chega como string no supabase-js
};

function toTransaction(row: TransactionRow): FinanceTransaction {
  return {
    id: row.id,
    date: row.tx_date,
    description: row.description,
    category: row.category ?? '',
    amount: Number(row.amount),
  };
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  recent: [],
  loading: false,
  loaded: false,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const since = localDateStr(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));
    const { data } = await supabase
      .from('transactions')
      .select('id, tx_date, description, category, amount')
      .gte('tx_date', since)
      .order('tx_date', { ascending: false });

    set({ recent: (data ?? []).map(toTransaction), loading: false, loaded: true });
  },

  createTransaction: async (input) => {
    const userId = currentUserId();
    if (!userId) return false;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        tx_date: localDateStr(),
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
      })
      .select('id, tx_date, description, category, amount')
      .single();

    if (error || !data) return false;

    set((s) => ({ recent: [toTransaction(data as TransactionRow), ...s.recent] }));
    return true;
  },
}));
