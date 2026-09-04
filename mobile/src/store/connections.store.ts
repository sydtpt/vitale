/**
 * Store das contas vinculadas (tela Configurações → Conexões).
 *
 * Estado vem de `linked_accounts` (RLS: só as do usuário). Vincular/sincronizar
 * passa pelas edge functions (`intervals-link`, `connections-ingest`) — o
 * client nunca vê tokens. Desvincular é DELETE direto (RLS + cascade nos
 * secrets).
 */
import { create } from 'zustand';
import type { ConnectionProvider, LinkedAccount } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { fetchLinkedAccounts, invalidateBridgeCache, unlinkProvider } from '../lib/connections';

type Busy = 'connecting' | 'syncing' | 'disconnecting';

interface ConnectionsState {
  accounts: LinkedAccount[];
  loading: boolean;
  /** Operação em andamento por provedor (desabilita botões do card). */
  busy: Partial<Record<ConnectionProvider, Busy>>;
  error: string | null;

  load: () => Promise<void>;
  linkIntervals: (apiKey: string, athleteId: string) => Promise<string | null>;
  syncNow: (provider: ConnectionProvider) => Promise<string | null>;
  disconnect: (provider: ConnectionProvider) => Promise<string | null>;
}

function message(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Mensagem de erro do corpo da resposta de uma edge function (se houver). */
async function functionError(error: unknown, data: unknown): Promise<string | null> {
  if (!error) {
    const bodyErr = (data as { error?: string } | null)?.error;
    return bodyErr ?? null;
  }
  // FunctionsHttpError expõe a resposta original com o JSON de erro da função.
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // corpo não-JSON — cai na mensagem genérica
    }
  }
  return message(error, 'Falha na conexão.');
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  accounts: [],
  loading: false,
  busy: {},
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const accounts = await fetchLinkedAccounts();
      set({ accounts, loading: false });
    } catch (err) {
      set({ loading: false, error: message(err, 'Não foi possível carregar as conexões.') });
    }
  },

  linkIntervals: async (apiKey, athleteId) => {
    set((s) => ({ busy: { ...s.busy, intervals: 'connecting' }, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke('intervals-link', {
        body: { apiKey, athleteId },
      });
      const err = await functionError(error, data);
      if (err) return err;
      invalidateBridgeCache();
      await get().load();
      return null;
    } catch (err) {
      return message(err, 'Falha ao vincular intervals.icu.');
    } finally {
      set((s) => ({ busy: { ...s.busy, intervals: undefined } }));
    }
  },

  syncNow: async (provider) => {
    set((s) => ({ busy: { ...s.busy, [provider]: 'syncing' }, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke('connections-ingest', {
        body: { provider },
      });
      const err = await functionError(error, data);
      if (err) return err;
      await get().load();
      return null;
    } catch (err) {
      return message(err, 'Falha ao sincronizar.');
    } finally {
      set((s) => ({ busy: { ...s.busy, [provider]: undefined } }));
    }
  },

  disconnect: async (provider) => {
    set((s) => ({ busy: { ...s.busy, [provider]: 'disconnecting' }, error: null }));
    try {
      await unlinkProvider(provider);      invalidateBridgeCache();
      await get().load();
      return null;
    } catch (err) {
      return message(err, 'Falha ao desvincular.');
    } finally {
      set((s) => ({ busy: { ...s.busy, [provider]: undefined } }));
    }
  },
}));
