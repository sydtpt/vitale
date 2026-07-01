import { Injectable, computed, inject, signal } from '@angular/core';
import {
  localDateStr,
  buildRetrospective,
  buildRetroHighlights,
  buildYearByMonth,
  type PeriodKind,
  type RetroInput,
  type RetroSummary,
  type RetroHealthMetric,
  type WeekHighlight,
  type MonthBucket,
  type HighlightIcon,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Métricas de saúde incluídas no recap, com polaridade e formatação. */
const HEALTH_SPECS: Omit<RetroHealthMetric, 'valuesByDay'>[] = [
  { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
  { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
];

interface DbHealthRow { day: string; metric: string; value: number | string | null }
interface DbRatingRow { day: string; sleep_quality: number | string | null; day_quality: number | string | null }
interface DbHabitRow { id: string; name: string; bad: boolean }
interface DbHabitLogRow { habit_id: string; log_date: string; value: number | string | null }
interface DbRegistroRow { id: string; name: string }
interface DbRegistroLogRow { registro_id: string; log_date: string }
interface DbTemplateRow { id: string; name: string; module: string; meta: Record<string, unknown> | null }
interface DbOccRow { template_id: string; done_at: string | null }

/**
 * Fonte de dados read-only da Retrospectiva. Busca, para um intervalo amplo
 * (a partir de `since`), tudo que as seções agregam, e deriva o `RetroSummary`
 * via funções puras do shared. Atividades reusam `ActivitiesStore` (histórico
 * completo já em memória). Refaz o fetch só quando o período pedido precisa de
 * dados mais antigos que os já carregados.
 */
@Injectable({ providedIn: 'root' })
export class RetroStore {
  private readonly auth = inject(AuthService);
  private readonly activitiesStore = inject(ActivitiesStore);

  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _loadedSince = signal<string | null>(null);

  private readonly _health = signal<DbHealthRow[]>([]);
  private readonly _ratings = signal<DbRatingRow[]>([]);
  private readonly _habits = signal<DbHabitRow[]>([]);
  private readonly _habitLogs = signal<DbHabitLogRow[]>([]);
  private readonly _registros = signal<DbRegistroRow[]>([]);
  private readonly _registroLogs = signal<DbRegistroLogRow[]>([]);
  private readonly _tasks = signal<{ doneDay: string; module: string }[]>([]);
  private readonly _purchases = signal<{ doneDay: string; cat?: string; price?: number; name: string }[]>([]);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();

  /** Garante que há dados carregados a partir de `since` ('YYYY-MM-DD'). */
  async ensure(since: string): Promise<void> {
    const loaded = this._loadedSince();
    if (this._state() === 'loading') return;
    if (loaded && loaded <= since && this._state() === 'loaded') return;

    const userId = this.auth.user()?.id;
    if (!userId) {
      this._error.set('Sessão não encontrada.');
      this._state.set('error');
      return;
    }

    this._state.set('loading');
    this._error.set(null);

    const [health, ratings, habits, habitLogs, registros, registroLogs, templates, occs] = await Promise.all([
      supabase.from('health_daily').select('day,metric,value').eq('user_id', userId).gte('day', since),
      supabase.from('daily_ratings').select('day,sleep_quality,day_quality').eq('user_id', userId).gte('day', since),
      supabase.from('habits').select('id,name,bad').eq('user_id', userId),
      supabase.from('habit_logs').select('habit_id,log_date,value').eq('user_id', userId).gte('log_date', since),
      supabase.from('registros').select('id,name').eq('user_id', userId),
      supabase.from('registro_logs').select('registro_id,log_date').eq('user_id', userId).gte('log_date', since),
      supabase.from('todo_templates').select('id,name,module,meta').eq('user_id', userId),
      supabase.from('todo_occurrences').select('template_id,done_at').eq('user_id', userId).eq('status', 'done').gte('done_at', `${since}T00:00:00`),
    ]);

    const firstErr = [health, ratings, habits, habitLogs, registros, registroLogs, templates, occs].find((r) => r.error);
    if (firstErr?.error) {
      this._error.set(firstErr.error.message);
      this._state.set('error');
      return;
    }

    this._health.set((health.data ?? []) as DbHealthRow[]);
    this._ratings.set((ratings.data ?? []) as DbRatingRow[]);
    this._habits.set((habits.data ?? []) as DbHabitRow[]);
    this._habitLogs.set((habitLogs.data ?? []) as DbHabitLogRow[]);
    this._registros.set((registros.data ?? []) as DbRegistroRow[]);
    this._registroLogs.set((registroLogs.data ?? []) as DbRegistroLogRow[]);

    const tmplById = new Map((templates.data as DbTemplateRow[] ?? []).map((t) => [t.id, t]));
    const tasks: { doneDay: string; module: string }[] = [];
    const purchases: { doneDay: string; cat?: string; price?: number; name: string }[] = [];
    for (const o of (occs.data ?? []) as DbOccRow[]) {
      if (!o.done_at) continue;
      const tmpl = tmplById.get(o.template_id);
      if (!tmpl) continue;
      const doneDay = localDateStr(new Date(o.done_at));
      tasks.push({ doneDay, module: tmpl.module });
      if (tmpl.module === 'compras') {
        const meta = tmpl.meta ?? {};
        purchases.push({
          doneDay,
          cat: typeof meta['cat'] === 'string' ? (meta['cat'] as string) : undefined,
          price: typeof meta['price'] === 'number' ? (meta['price'] as number) : undefined,
          name: tmpl.name,
        });
      }
    }
    this._tasks.set(tasks);
    this._purchases.set(purchases);

    this._loadedSince.set(since);
    this._state.set('loaded');

    // Atividades vêm do histórico completo já mantido em memória.
    void this.activitiesStore.load();
  }

  /** Monta o RetroInput a partir do estado carregado. */
  private buildInput(now: Date, kind: PeriodKind, offset: number): RetroInput {
    const healthRows = this._health();
    const byMetric = new Map<string, Map<string, number>>();
    for (const r of healthRows) {
      if (r.value == null) continue;
      let m = byMetric.get(r.metric);
      if (!m) { m = new Map(); byMetric.set(r.metric, m); }
      m.set(r.day, Number(r.value));
    }

    const sleepMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    for (const r of this._ratings()) {
      if (r.sleep_quality != null) sleepMap.set(r.day, Number(r.sleep_quality));
      if (r.day_quality != null) dayMap.set(r.day, Number(r.day_quality));
    }

    const logsByHabit = new Map<string, Map<string, number>>();
    for (const l of this._habitLogs()) {
      let m = logsByHabit.get(l.habit_id);
      if (!m) { m = new Map(); logsByHabit.set(l.habit_id, m); }
      m.set(l.log_date, Number(l.value ?? 0));
    }
    const daysByRegistro = new Map<string, string[]>();
    for (const l of this._registroLogs()) {
      const arr = daysByRegistro.get(l.registro_id) ?? [];
      arr.push(l.log_date);
      daysByRegistro.set(l.registro_id, arr);
    }

    return {
      now, kind, offset,
      activities: this.activitiesStore.activities(),
      health: HEALTH_SPECS.map((s) => ({ ...s, valuesByDay: byMetric.get(s.metric) ?? new Map() })),
      floorsByDay: byMetric.get('andares'),
      ratingsSleep: sleepMap,
      ratingsDay: dayMap,
      habits: this._habits().map((h) => ({ id: h.id, name: h.name, bad: h.bad, logsByDay: logsByHabit.get(h.id) ?? new Map() })),
      registros: this._registros().map((r) => ({ id: r.id, name: r.name, days: daysByRegistro.get(r.id) ?? [] })),
      tasks: this._tasks(),
      purchases: this._purchases(),
    };
  }

  summary(now: Date, kind: PeriodKind, offset: number): RetroSummary {
    return buildRetrospective(this.buildInput(now, kind, offset));
  }

  highlights(now: Date, kind: PeriodKind, offset: number): WeekHighlight[] {
    const input = this.buildInput(now, kind, offset);
    return buildRetroHighlights(buildRetrospective(input), input);
  }

  yearByMonth(now: Date, offset: number): MonthBucket[] {
    return buildYearByMonth(this.buildInput(now, 'year', offset));
  }
}

export type { HighlightIcon };
