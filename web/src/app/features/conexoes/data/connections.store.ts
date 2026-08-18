import { Injectable, inject, signal } from '@angular/core';
import type { ConnectionProvider, LinkedAccount } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { deleteLinkedAccount, fetchLinkedAccounts } from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';
type Busy = 'connecting' | 'syncing' | 'disconnecting';

/** Mensagem de erro de uma edge function (corpo JSON do FunctionsHttpError). */
async function functionError(error: unknown, data: unknown): Promise<string | null> {
  if (!error) {
    const bodyErr = (data as { error?: string } | null)?.error;
    return bodyErr ?? null;
  }
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
    } catch {
      // corpo não-JSON — cai na mensagem genérica
    }
  }
  return error instanceof Error ? error.message : 'Falha na conexão.';
}

/**
 * Contas vinculadas (Strava, intervals.icu). Estado de `linked_accounts` (RLS);
 * vincular/sincronizar via edge functions — o client nunca vê tokens.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionsStore {
  private readonly auth = inject(AuthService);

  readonly accounts = signal<LinkedAccount[]>([]);
  readonly state = signal<LoadState>('idle');
  readonly busy = signal<Partial<Record<ConnectionProvider, Busy>>>({});
  readonly error = signal<string | null>(null);

  account(provider: ConnectionProvider): LinkedAccount | undefined {
    return this.accounts().find((a) => a.provider === provider);
  }

  async load(): Promise<void> {
    this.state.set('loading');
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.state.set('error');
      return;
    }
    try {
      this.accounts.set(await fetchLinkedAccounts(supabase, userId));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Falha ao carregar as conexões.');
      this.state.set('error');
      return;
    }
    this.state.set('loaded');
  }

  private setBusy(provider: ConnectionProvider, value: Busy | undefined): void {
    this.busy.update((b) => ({ ...b, [provider]: value }));
  }

  async linkIntervals(apiKey: string, athleteId: string): Promise<string | null> {
    this.setBusy('intervals', 'connecting');
    try {
      const { data, error } = await supabase.functions.invoke('intervals-link', {
        body: { apiKey, athleteId },
      });
      const err = await functionError(error, data);
      if (err) return err;
      await this.load();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Falha ao vincular intervals.icu.';
    } finally {
      this.setBusy('intervals', undefined);
    }
  }

  /** Inicia o OAuth da Strava — navega para a página de autorização. */
  async connectStrava(): Promise<string | null> {
    this.setBusy('strava', 'connecting');
    try {
      const { data, error } = await supabase.functions.invoke('strava-oauth/authorize', {
        body: { platform: 'web' },
      });
      const err = await functionError(error, data);
      if (err) return err;
      const url = (data as { url?: string })?.url;
      if (!url) return 'Resposta inválida do servidor.';
      window.location.assign(url); // volta em /conexoes?provider=strava&status=…
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Falha ao conectar com a Strava.';
    } finally {
      this.setBusy('strava', undefined);
    }
  }

  async syncNow(provider: ConnectionProvider): Promise<string | null> {
    this.setBusy(provider, 'syncing');
    try {
      const { data, error } = await supabase.functions.invoke('connections-ingest', {
        body: { provider },
      });
      const err = await functionError(error, data);
      if (err) return err;
      await this.load();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Falha ao sincronizar.';
    } finally {
      this.setBusy(provider, undefined);
    }
  }

  async disconnect(provider: ConnectionProvider): Promise<string | null> {
    this.setBusy(provider, 'disconnecting');
    try {
      if (provider === 'strava') {
        // Via edge function: além de apagar o vínculo, desautoriza o app na Strava.
        const { data, error } = await supabase.functions.invoke('strava-oauth/link', {
          method: 'DELETE',
        });
        const err = await functionError(error, data);
        if (err) return err;
      } else {
        const uid = this.auth.user()?.id;
        if (!uid) return 'Sessão não encontrada.';
        await deleteLinkedAccount(supabase, uid, provider);
      }
      await this.load();
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Falha ao desvincular.';
    } finally {
      this.setBusy(provider, undefined);
    }
  }
}
