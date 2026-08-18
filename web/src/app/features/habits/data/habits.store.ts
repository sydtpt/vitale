import { Injectable, computed, inject, signal } from '@angular/core';
import type { CounterHabit, HabitLog, HabitDirection } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { lastNDates, localDateStr } from '@vitale/shared';
import {
  createHabit,
  fetchHabitLogsBetween,
  fetchHabitLogsSinceOrdered,
  fetchHabits,
  setHabitActive,
  updateHabit,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela do heatmap/análise: ~12 semanas. */
export const RANGE_DAYS = 84;

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

  /** Valor de um hábito num dia específico (0 se não houver log carregado). */
  valueOn(habitId: string, date: string): number {
    return this.logsFor(habitId).find(l => l.logDate === date)?.value ?? 0;
  }

  /**
   * Fixa o valor de um hábito num dia (edição de passado) via rpc `habit_log_set`.
   * Atualiza `_logs`: remove se 0, substitui se existir, insere se novo.
   */
  async setLog(habitId: string, date: string, value: number): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const { error } = await supabase.rpc('habit_log_set', {
      p_habit: habitId,
      p_date: date,
      p_value: value,
    });
    if (error) throw new Error(error.message);

    this._logs.update(logs => {
      const rest = logs.filter(l => !(l.habitId === habitId && l.logDate === date));
      if (value <= 0) return rest;
      const existing = logs.find(l => l.habitId === habitId && l.logDate === date);
      return [...rest, { id: existing?.id ?? `${habitId}:${date}`, habitId, logDate: date, value }];
    });
  }

  /**
   * Carrega os logs de um mês e os mescla em `_logs` (dedupe por habitId+data).
   * Necessário para editar/visualizar meses fora da janela padrão (`RANGE_DAYS`).
   */
  async loadMonth(year: number, monthIdx: number): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const from = localDateStr(new Date(year, monthIdx, 1));
    const to = localDateStr(new Date(year, monthIdx + 1, 0));

    const fetched = await fetchHabitLogsBetween(supabase, userId, from, to);
    this._logs.update(logs => {
      const keys = new Set(fetched.map(l => `${l.habitId}:${l.logDate}`));
      const kept = logs.filter(l => !keys.has(`${l.habitId}:${l.logDate}`));
      return [...kept, ...fetched];
    });
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

    let habits: CounterHabit[];
    let logs: HabitLog[];
    try {
      [habits, logs] = await Promise.all([
        fetchHabits(supabase, userId),
        fetchHabitLogsSinceOrdered(supabase, userId, since),
      ]);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }

    this._habits.set(habits);
    this._logs.set(logs);
    this._state.set('loaded');
  }

  async createHabit(data: {
    name: string;
    icon: string;
    color: string;
    unit: string;
    step: number;
    target?: number;
    direction: HabitDirection;
    bad?: boolean;
    showOnHome?: boolean;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const maxSort = Math.max(0, ...this._habits().map(h => h.sort));
    const id = await createHabit(supabase, userId, {
      name: data.name,
      icon: data.icon,
      color: data.color,
      unit: data.unit as CounterHabit['unit'],
      step: data.step,
      target: data.target,
      direction: data.direction,
      bad: data.bad,
      showOnHome: data.showOnHome,
      sort: maxSort + 1,
    });
    const habits = await fetchHabits(supabase, userId);
    this._habits.set(habits);
    void id;
  }

  async updateHabit(id: string, data: {
    name: string;
    icon: string;
    color: string;
    unit: string;
    step: number;
    target?: number;
    direction: HabitDirection;
    bad?: boolean;
    showOnHome?: boolean;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    await updateHabit(supabase, id, {
      name: data.name,
      icon: data.icon,
      color: data.color,
      unit: data.unit as CounterHabit['unit'],
      step: data.step,
      target: data.target ?? null,
      direction: data.direction,
      bad: data.bad ?? false,
      show_on_home: data.showOnHome ?? true,
    });
    this._habits.set(await fetchHabits(supabase, userId));
  }

  async archiveHabit(id: string, active: boolean): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    await setHabitActive(supabase, id, active);
    this._habits.set(await fetchHabits(supabase, userId));
  }
}

