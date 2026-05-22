import { Injectable, computed, inject, signal } from '@angular/core';
import type { HealthDaily } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr } from './health-format';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela analítica padrão (~1 ano), alinhada ao backfill do mobile. */
export const RANGE_DAYS = 365;

interface DbHealthDailyRow {
  day: string;
  metric: string;
  value: number | string | null;
  min_value: number | string | null;
  max_value: number | string | null;
  count: number | string | null;
  extra: Record<string, unknown> | null;
}

/**
 * Fonte única dos agregados diários de saúde no web. Um fetch da janela;
 * séries por métrica, último valor e mapas por dia derivam por computed().
 * Espelha a estratégia client-side de `habits.store` / histórico de treinos.
 */
@Injectable({ providedIn: 'root' })
export class HealthStore {
  private readonly auth = inject(AuthService);

  private readonly _rows = signal<HealthDaily[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._rows().length === 0);

  /** Séries por métrica (ordenadas por dia ascendente). */
  private readonly _byMetric = computed(() => {
    const map = new Map<string, HealthDaily[]>();
    for (const r of this._rows()) {
      const arr = map.get(r.metric);
      if (arr) arr.push(r);
      else map.set(r.metric, [r]);
    }
    return map;
  });

  /** Métricas presentes na janela carregada. */
  readonly metricsPresent = computed(() => new Set(this._byMetric().keys()));

  /** Série diária de uma métrica (mais antiga → recente). */
  seriesFor(metric: string): HealthDaily[] {
    return this._byMetric().get(metric) ?? [];
  }

  /** Último registro diário de uma métrica (ou null). */
  latestFor(metric: string): HealthDaily | null {
    const s = this.seriesFor(metric);
    return s.length > 0 ? s[s.length - 1] : null;
  }

  /** Mapa data → valor de uma métrica (para cruzar com outras séries). */
  valuesByDay(metric: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of this.seriesFor(metric)) if (r.value != null) m.set(r.day, r.value);
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

    const { data, error } = await supabase
      .from('health_daily')
      .select('day,metric,value,min_value,max_value,count,extra')
      .eq('user_id', userId)
      .gte('day', since)
      .order('day', { ascending: true });

    if (error) {
      this._error.set(error.message);
      this._state.set('error');
      return;
    }

    this._rows.set(((data ?? []) as DbHealthDailyRow[]).map((r) => mapRow(userId, r)));
    this._state.set('loaded');
  }
}

function num(v: number | string | null): number | undefined {
  return v == null ? undefined : Number(v);
}

function mapRow(userId: string, r: DbHealthDailyRow): HealthDaily {
  return {
    userId,
    day: r.day,
    metric: r.metric,
    value: r.value == null ? null : Number(r.value),
    minValue: num(r.min_value),
    maxValue: num(r.max_value),
    count: num(r.count),
    extra: r.extra ?? undefined,
  };
}
