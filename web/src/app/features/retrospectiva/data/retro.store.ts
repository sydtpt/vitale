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
import type { HabitLog, RegistroLog } from '@vitale/shared';
import {
  fetchDailyRatingScores,
  fetchDoneTodoOccurrencesSince,
  fetchHabitLogsSince,
  fetchHabitSummaries,
  fetchHealthDailyValues,
  fetchRegistroLogsSince,
  fetchRegistroSummaries,
  fetchTodoTemplateSummaries,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Métricas de saúde incluídas no recap, com polaridade e formatação. */
const HEALTH_SPECS: Omit<RetroHealthMetric, 'valuesByDay'>[] = [
  { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
  { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
];


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

  private readonly _health = signal<Array<{ day: string; metric: string; value: number | null }>>([]);
  private readonly _ratings = signal<Array<{ day: string; sleepQuality: number | null; dayQuality: number | null }>>([]);
  private readonly _habits = signal<Array<{ id: string; name: string; bad: boolean; unit: string }>>([]);
  private readonly _habitLogs = signal<HabitLog[]>([]);
  private readonly _registros = signal<Array<{ id: string; name: string }>>([]);
  private readonly _registroLogs = signal<RegistroLog[]>([]);
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

    let health, ratings, habits, habitLogs, registros, registroLogs, templates, occs;
    try {
      [health, ratings, habits, habitLogs, registros, registroLogs, templates, occs] =
        await Promise.all([
          fetchHealthDailyValues(supabase, userId, since),
          fetchDailyRatingScores(supabase, userId, since),
          fetchHabitSummaries(supabase, userId),
          fetchHabitLogsSince(supabase, userId, since),
          fetchRegistroSummaries(supabase, userId),
          fetchRegistroLogsSince(supabase, userId, since),
          fetchTodoTemplateSummaries(supabase, userId),
          fetchDoneTodoOccurrencesSince(supabase, userId, since),
        ]);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar a retrospectiva.');
      this._state.set('error');
      return;
    }

    this._health.set(health);
    this._ratings.set(ratings);
    this._habits.set(habits);
    this._habitLogs.set(habitLogs);
    this._registros.set(registros);
    this._registroLogs.set(registroLogs);

    const tmplById = new Map(templates.map((t) => [t.id, t]));
    const tasks: { doneDay: string; module: string }[] = [];
    const purchases: { doneDay: string; cat?: string; price?: number; name: string }[] = [];
    for (const o of occs) {
      if (!o.doneAt) continue;
      const tmpl = tmplById.get(o.templateId);
      if (!tmpl) continue;
      const doneDay = localDateStr(new Date(o.doneAt));
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
      if (r.sleepQuality != null) sleepMap.set(r.day, r.sleepQuality);
      if (r.dayQuality != null) dayMap.set(r.day, r.dayQuality);
    }

    const logsByHabit = new Map<string, Map<string, number>>();
    for (const l of this._habitLogs()) {
      let m = logsByHabit.get(l.habitId);
      if (!m) { m = new Map(); logsByHabit.set(l.habitId, m); }
      m.set(l.logDate, l.value);
    }
    const daysByRegistro = new Map<string, string[]>();
    for (const l of this._registroLogs()) {
      const arr = daysByRegistro.get(l.registroId) ?? [];
      arr.push(l.logDate);
      daysByRegistro.set(l.registroId, arr);
    }

    return {
      now, kind, offset,
      activities: this.activitiesStore.activities(),
      health: HEALTH_SPECS.map((s) => ({ ...s, valuesByDay: byMetric.get(s.metric) ?? new Map() })),
      floorsByDay: byMetric.get('andares'),
      stepsByDay: byMetric.get('passos'),
      ratingsSleep: sleepMap,
      ratingsDay: dayMap,
      habits: this._habits().map((h) => ({ id: h.id, name: h.name, bad: h.bad, unit: h.unit, logsByDay: logsByHabit.get(h.id) ?? new Map() })),
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
