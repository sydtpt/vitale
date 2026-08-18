import { Injectable, computed, inject, signal } from '@angular/core';
import type { Registro, RegistroLog, TodoModule } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr } from './registro-logic';
import {
  createRegistro,
  fetchRegistroLogsSince,
  fetchRegistros,
  setRegistroActive,
  setRegistroMark,
  updateRegistro,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela do heatmap/análise: ~12 semanas. */
export const RANGE_DAYS = 84;

/**
 * Fonte única dos registros no web. Um fetch dos registros + um dos logs da
 * janela; "feito hoje", contagem e heatmap derivam por computed(). Espelha a
 * estratégia client-side de habits.store.
 */
@Injectable({ providedIn: 'root' })
export class RegistrosStore {
  private readonly auth = inject(AuthService);

  private readonly _registros = signal<Registro[]>([]);
  private readonly _logs = signal<RegistroLog[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._registros().length === 0);

  /** Registros ordenados: ativos primeiro, depois por `sort`. */
  readonly registros = computed(() =>
    [...this._registros()].sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort),
  );

  private readonly _logsByRegistro = computed(() => {
    const map = new Map<string, RegistroLog[]>();
    for (const l of this._logs()) {
      const arr = map.get(l.registroId);
      if (arr) arr.push(l);
      else map.set(l.registroId, [l]);
    }
    return map;
  });

  /** Logs (da janela) de um registro. */
  logsFor(registroId: string): RegistroLog[] {
    return this._logsByRegistro().get(registroId) ?? [];
  }

  /** Marcado hoje? (deriva dos logs carregados) */
  isDoneToday(registroId: string): boolean {
    const today = localDateStr();
    return (this._logsByRegistro().get(registroId) ?? []).some((l) => l.logDate === today);
  }

  async load(force = false): Promise<void> {
    if (!force && (this._state() === 'loaded' || this._state() === 'loading')) return;

    const userId = this.auth.user()?.id;
    if (!userId) {
      this._error.set('Sessão não encontrada.');
      this._state.set('error');
      return;
    }

    this._state.set('loading');
    this._error.set(null);

    const since = localDateStr(new Date(Date.now() - (RANGE_DAYS - 1) * 86400000));

    let registros: Registro[];
    let logs: RegistroLog[];
    try {
      [registros, logs] = await Promise.all([
        fetchRegistros(supabase, userId),
        fetchRegistroLogsSince(supabase, userId, since),
      ]);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }

    this._registros.set(registros);
    this._logs.set(logs);
    this._state.set('loaded');
  }

  /** Marca hoje (idempotente) e atualiza o estado local. */
  async markToday(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const today = localDateStr();
    if (this.isDoneToday(id)) return;

    const log = await setRegistroMark(supabase, userId, id, today, true);
    if (log) this._logs.update((l) => [...l, log]);
  }

  /** Desmarca hoje e atualiza o estado local. */
  async unmarkToday(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const today = localDateStr();

    await setRegistroMark(supabase, userId, id, today, false);
    this._logs.update((l) => l.filter((x) => !(x.registroId === id && x.logDate === today)));
  }

  async toggleToday(id: string): Promise<void> {
    return this.isDoneToday(id) ? this.unmarkToday(id) : this.markToday(id);
  }

  async createRegistro(data: {
    name: string;
    icon: string;
    color: string;
    module: TodoModule;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const maxSort = Math.max(0, ...this._registros().map((r) => r.sort));
    await createRegistro(supabase, userId, {
      name: data.name,
      icon: data.icon,
      color: data.color,
      module: data.module,
      sort: maxSort + 1,
    });
    this._registros.set(await fetchRegistros(supabase, userId));
  }

  async updateRegistro(id: string, data: {
    name: string;
    icon: string;
    color: string;
    module: TodoModule;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    await updateRegistro(supabase, id, {
      name: data.name,
      icon: data.icon,
      color: data.color,
      module: data.module,
    });
    this._registros.set(await fetchRegistros(supabase, userId));
  }

  async archiveRegistro(id: string, active: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    await setRegistroActive(supabase, id, active);
    this._registros.set(await fetchRegistros(supabase, userId));
  }
}


