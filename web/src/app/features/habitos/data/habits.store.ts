import { Injectable, computed, inject, signal } from '@angular/core';
import type { CounterHabit, HabitLog } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { lastNDates, localDateStr } from './habit-logic';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela do heatmap/análise: ~12 semanas. */
export const RANGE_DAYS = 84;

interface DbHabitRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  unit: string;
  step: number | string;
  target: number | string | null;
  direction: 'at_least' | 'at_most';
  active: boolean;
  sort: number;
}

interface DbLogRow {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | string;
}

/**
 * Fonte única dos hábitos contadores no web. Um fetch dos hábitos + um dos
 * logs da janela; valor de hoje, streak, média e heatmap derivam por computed().
 * Espelha a estratégia client-side de historico-treinos.
 */
@Injectable({ providedIn: 'root' })
export class HabitsStore {
  private readonly auth = inject(AuthService);

  private readonly _habits = signal<CounterHabit[]>([]);
  private readonly _logs = signal<HabitLog[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._habits().length === 0);

  /** Hábitos ordenados: ativos primeiro, depois por `sort`. */
  readonly habits = computed(() =>
    [...this._habits()].sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort),
  );

  /** Datas da janela (mais antiga → hoje), base do heatmap. */
  readonly windowDates = computed(() => lastNDates(RANGE_DAYS));

  private readonly _logsByHabit = computed(() => {
    const map = new Map<string, HabitLog[]>();
    for (const l of this._logs()) {
      const arr = map.get(l.habitId);
      if (arr) arr.push(l);
      else map.set(l.habitId, [l]);
    }
    return map;
  });

  /** Logs (da janela) de um hábito. */
  logsFor(habitId: string): HabitLog[] {
    return this._logsByHabit().get(habitId) ?? [];
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

    const [habitsRes, logsRes] = await Promise.all([
      supabase
        .from('habits')
        .select('id,name,icon,color,unit,step,target,direction,active,sort')
        .eq('user_id', userId)
        .order('sort', { ascending: true }),
      supabase
        .from('habit_logs')
        .select('id,habit_id,log_date,value')
        .eq('user_id', userId)
        .gte('log_date', since)
        .order('log_date', { ascending: true }),
    ]);

    if (habitsRes.error || logsRes.error) {
      this._error.set(habitsRes.error?.message ?? logsRes.error?.message ?? 'Erro ao carregar.');
      this._state.set('error');
      return;
    }

    this._habits.set(((habitsRes.data ?? []) as DbHabitRow[]).map(mapHabit));
    this._logs.set(((logsRes.data ?? []) as DbLogRow[]).map(mapLog));
    this._state.set('loaded');
  }
}

function mapHabit(r: DbHabitRow): CounterHabit {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? '',
    unit: r.unit,
    step: Number(r.step),
    target: r.target == null ? undefined : Number(r.target),
    direction: r.direction,
    active: r.active,
    sort: r.sort,
  };
}

function mapLog(r: DbLogRow): HabitLog {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, value: Number(r.value) };
}
