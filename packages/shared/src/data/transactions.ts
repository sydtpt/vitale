/**
 * Acesso à tabela `transactions` — dono único (AD-4).
 *
 * `amount` é `numeric` no Postgres e chega como **string** pelo supabase-js —
 * por isso a conversão fica aqui, uma vez. Somar sem converter concatena.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinanceTransaction } from '../models';
import { fetchAllPages } from './paginate';

const COLUMNS = 'id, tx_date, description, category, amount';

export interface TransactionRow {
  id: string;
  tx_date: string;
  description: string;
  category: string | null;
  amount: number | string;
}

/** Linha do Postgres → modelo de domínio. Único lugar onde essa tradução existe. */
export function toFinanceTransaction(r: TransactionRow): FinanceTransaction {
  return {
    id: r.id,
    date: r.tx_date,
    description: r.description,
    category: r.category ?? '',
    amount: Number(r.amount),
  };
}

/** Transações desde `since`, da mais recente para a mais antiga. */
export async function fetchTransactionsSince(
  db: SupabaseClient,
  userId: string,
  since: string,
): Promise<FinanceTransaction[]> {
  const data = await fetchAllPages<TransactionRow>((lo, hi) =>
    db
      .from('transactions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .gte('tx_date', since)
      .order('tx_date', { ascending: false })
      .range(lo, hi),
  );
  return data.map(toFinanceTransaction);
}

/** Registra uma transação e devolve o modelo criado. */
export async function createTransaction(
  db: SupabaseClient,
  userId: string,
  input: { date: string; description: string; category: string; amount: number },
): Promise<FinanceTransaction> {
  const { data, error } = await db
    .from('transactions')
    .insert({
      user_id: userId,
      tx_date: input.date,
      description: input.description,
      category: input.category,
      amount: input.amount,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toFinanceTransaction(data as TransactionRow);
}
