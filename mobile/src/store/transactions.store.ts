import { create } from 'zustand';
import { createTransaction, fetchTransactionsSince } from '@vitale/shared';
import type { FinanceTransaction } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { localDateStr } from '@vitale/shared';

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

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  recent: [],
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    const since = localDateStr(new Date(Date.now() - (WINDOW_DAYS - 1) * 86_400_000));
    const recent = await fetchTransactionsSince(supabase, userId, since);

    set({ recent, loading: false, loaded: true });
  },

  createTransaction: async (input) => {
    const userId = currentUserId();
    if (!userId) return false;

    let tx;
    try {
      tx = await createTransaction(supabase, userId, {
        date: localDateStr(),
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
      });
    } catch {
      return false;
    }

    set((s) => ({ recent: [tx, ...s.recent] }));
    return true;
  },
}));
