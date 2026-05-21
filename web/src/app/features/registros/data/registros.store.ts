import { Injectable, computed, inject, signal } from '@angular/core';
import type { Registro, RegistroLog, TodoModule } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr } from './registro-logic';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela do heatmap/análise: ~12 semanas. */
export const RANGE_DAYS = 84;

interface DbRegistroRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  module: TodoModule;
  active: boolean;
  sort: number;
  created_at: string;
}

interface DbLogRow {
  id: string;
  registro_id: string;
  log_date: string;
}

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

    const [registrosRes, logsRes] = await Promise.all([
      supabase
        .from('registros')
        .select('id,name,icon,color,module,active,sort,created_at')
        .eq('user_id', userId)
        .order('sort', { ascending: true }),
      supabase
        .from('registro_logs')
        .select('id,registro_id,log_date')
        .eq('user_id', userId)
        .gte('log_date', since)
        .order('log_date', { ascending: true }),
    ]);

    if (registrosRes.error || logsRes.error) {
      this._error.set(registrosRes.error?.message ?? logsRes.error?.message ?? 'Erro ao carregar.');
      this._state.set('error');
      return;
    }

    this._registros.set(((registrosRes.data ?? []) as DbRegistroRow[]).map(mapRegistro));
    this._logs.set(((logsRes.data ?? []) as DbLogRow[]).map(mapLog));
    this._state.set('loaded');
  }

  /** Marca hoje (idempotente) e atualiza o estado local. */
  async markToday(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const today = localDateStr();
    if (this.isDoneToday(id)) return;

    const res = await supabase
      .from('registro_logs')
      .upsert({ registro_id: id, user_id: userId, log_date: today }, { onConflict: 'registro_id,log_date' })
      .select('id,registro_id,log_date')
      .single();

    if (res.error) throw new Error(res.error.message);
    this._logs.update((l) => [...l, mapLog(res.data as DbLogRow)]);
  }

  /** Desmarca hoje e atualiza o estado local. */
  async unmarkToday(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');
    const today = localDateStr();

    const res = await supabase
      .from('registro_logs')
      .delete()
      .eq('registro_id', id)
      .eq('log_date', today);

    if (res.error) throw new Error(res.error.message);
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
    const res = await supabase
      .from('registros')
      .insert({
        user_id: userId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        module: data.module,
        active: true,
        sort: maxSort + 1,
      })
      .select('id,name,icon,color,module,active,sort,created_at')
      .single();

    if (res.error) throw new Error(res.error.message);
    this._registros.update((r) => [...r, mapRegistro(res.data as DbRegistroRow)]);
  }

  async updateRegistro(id: string, data: {
    name: string;
    icon: string;
    color: string;
    module: TodoModule;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const res = await supabase
      .from('registros')
      .update({ name: data.name, icon: data.icon, color: data.color, module: data.module })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id,name,icon,color,module,active,sort,created_at')
      .single();

    if (res.error) throw new Error(res.error.message);
    const updated = mapRegistro(res.data as DbRegistroRow);
    this._registros.update((r) => r.map((x) => (x.id === id ? updated : x)));
  }

  async archiveRegistro(id: string, active: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const res = await supabase
      .from('registros')
      .update({ active })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id,name,icon,color,module,active,sort,created_at')
      .single();

    if (res.error) throw new Error(res.error.message);
    const updated = mapRegistro(res.data as DbRegistroRow);
    this._registros.update((r) => r.map((x) => (x.id === id ? updated : x)));
  }
}

function mapRegistro(r: DbRegistroRow): Registro {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? '',
    module: r.module,
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

function mapLog(r: DbLogRow): RegistroLog {
  return { id: r.id, registroId: r.registro_id, logDate: r.log_date };
}
