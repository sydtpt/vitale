import { Injectable, computed, inject, signal } from '@angular/core';
import type { DailyRating } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr } from '@features/saude/data/health-format';
import { fetchDailyRatingsSince } from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela: ~90 dias — cobre o recap semanal e a tendência de 30 dias. */
export const RANGE_DAYS = 90;

export type RatingKind = 'sleep' | 'day';

interface DbRow {
  day: string;
  sleep_quality: number | string | null;
  day_quality: number | string | null;
  day_note: string | null;
}

/**
 * Fonte única dos ratings subjetivos diários no web. Um fetch da janela; médias
 * do recap e séries do gráfico de tendência derivam por computed(). Espelha a
 * estratégia client-side de `health.store` / `registros.store`.
 */
@Injectable({ providedIn: 'root' })
export class DailyRatingsStore {
  private readonly auth = inject(AuthService);

  private readonly _rows = signal<DailyRating[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  /** Ratings da janela, ordenados por dia ascendente. */
  readonly rows = computed(() => [...this._rows()].sort((a, b) => a.day.localeCompare(b.day)));

  /** Mapa dia → valor (1–5) de um tipo, para alimentar metricRecap. */
  valuesByDay(kind: RatingKind): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of this._rows()) {
      const v = kind === 'sleep' ? r.sleepQuality : r.dayQuality;
      if (v != null) m.set(r.day, v);
    }
    return m;
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

    try {
      this._rows.set(await fetchDailyRatingsSince(supabase, userId, since));
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }
    this._state.set('loaded');
  }
}

function num(v: number | string | null): number | null {
  return v == null ? null : Number(v);
}

function mapRow(r: DbRow): DailyRating {
  return {
    day: r.day,
    sleepQuality: num(r.sleep_quality),
    dayQuality: num(r.day_quality),
    dayNote: r.day_note,
  };
}
