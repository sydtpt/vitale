/**
 * Store das contas vinculadas (tela Configurações → Conexões).
 *
 * Estado vem de `linked_accounts` (RLS: só as do usuário). Vincular/sincronizar
 * passa pelas edge functions (`intervals-link`, `connections-ingest`,
 * `strava-oauth`) — o client nunca vê tokens. Desvincular: intervals é DELETE
 * direto (RLS + cascade nos secrets); Strava passa pela edge function para
 * também desautorizar o app na conta Strava.
 */
import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { ConnectionProvider, LinkedAccount } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { fetchLinkedAccounts, invalidateBridgeCache, unlinkProvider } from '../lib/connections';

WebBrowser.maybeCompleteAuthSession();

/** Retorno do OAuth — precisa casar com MOBILE_RETURN da edge fn strava-oauth. */
const STRAVA_RETURN_URL = 'vitale://configuracoes/conexoes';

type Busy = 'connecting' | 'syncing' | 'disconnecting';

interface ConnectionsState {
  accounts: LinkedAccount[];
  loading: boolean;
  /** Operação em andamento por provedor (desabilita botões do card). */
  busy: Partial<Record<ConnectionProvider, Busy>>;
  error: string | null;

  load: () => Promise<void>;
  linkIntervals: (apiKey: string, athleteId: string) => Promise<string | null>;
  connectStrava: () => Promise<string | null>;
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

  connectStrava: async () => {
    set((s) => ({ busy: { ...s.busy, strava: 'connecting' }, error: null }));
    try {
      const { data, error } = await supabase.functions.invoke('strava-oauth/authorize', {
        body: { platform: 'mobile' },
      });
      const err = await functionError(error, data);
      if (err) return err;
      const authUrl = (data as { url?: string })?.url;
      if (!authUrl) return 'Resposta inválida do servidor.';

      const result = await WebBrowser.openAuthSessionAsync(authUrl, STRAVA_RETURN_URL);
      if (result.type !== 'success') return 'Conexão cancelada.';

      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.status !== 'ok') {
        const reason = typeof queryParams?.reason === 'string' ? queryParams.reason : 'desconhecido';
        return `Strava recusou a conexão (${reason}).`;
      }
      invalidateBridgeCache();
      await get().load();
      return null;
    } catch (err) {
      return message(err, 'Falha ao conectar com a Strava.');
    } finally {
      set((s) => ({ busy: { ...s.busy, strava: undefined } }));
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
      if (provider === 'strava') {
        const { data, error } = await supabase.functions.invoke('strava-oauth/link', {
          method: 'DELETE',
        });
        const err = await functionError(error, data);
        if (err) return err;
      } else {
        await unlinkProvider(provider);
      }
      invalidateBridgeCache();
      await get().load();
      return null;
    } catch (err) {
      return message(err, 'Falha ao desvincular.');
    } finally {
      set((s) => ({ busy: { ...s.busy, [provider]: undefined } }));
    }
  },
}));
