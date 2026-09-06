import { Injectable, computed, inject, signal } from '@angular/core';
import {
  dayHourCells,
  fetchHealthSeries,
  fetchSleepPeriodsSince,
  hourlyProfile,
  nightHeartRates,
  type HealthSeriesDay,
  type SleepPeriod,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr } from './health-format';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Janela da série: 60 dias. É o que a faixa típica e as noites precisam para
 * dizer algo, e o mapa dia × hora cabe na tela. A tira de dias mostra os 14
 * últimos desses 60.
 */
export const HEART_WINDOW_DAYS = 60;

/**
 * A série intradiária de FC (`health_series`, ADR 0033) e as janelas de sono
 * que a contextualizam. Um fetch da janela; perfil por hora, noites e células
 * derivam por computed() no núcleo puro (`series-derive.ts`).
 */
@Injectable({ providedIn: 'root' })
export class HeartSeriesStore {
  private readonly auth = inject(AuthService);

  private readonly _days = signal<HealthSeriesDay[]>([]);
  private readonly _periods = signal<SleepPeriod[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly days = this._days.asReadonly();
  readonly periods = this._periods.asReadonly();
  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = computed(() => this._state() === 'loaded');
  readonly hasData = computed(() => this._days().length > 0);

  readonly profile = computed(() => hourlyProfile(this._days()));
  readonly nights = computed(() => nightHeartRates(this._days(), this._periods()));
  readonly cells = computed(() => dayHourCells(this._days()));

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
    const since = localDateStr(new Date(Date.now() - (HEART_WINDOW_DAYS - 1) * 86400000));
    const today = localDateStr(new Date());
    try {
      const [days, periods] = await Promise.all([
        fetchHealthSeries(supabase, userId, 'fc', since, today),
        fetchSleepPeriodsSince(supabase, userId, since),
      ]);
      this._days.set(days);
      this._periods.set(periods);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }
    this._state.set('loaded');
  }
}
