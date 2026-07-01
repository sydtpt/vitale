import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  Goal,
  GoalFamily,
  GoalPeriodKind,
  GoalProgress,
  GoalSource,
  HabitLog,
  TodoOccurrence,
} from '@vitale/shared';
import { evaluateGoal, type GoalContext } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { HabitsStore } from '@features/habits/data/habits.store';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Payload de criação/edição de uma meta (sem id/sort/createdAt/active). */
export interface NewGoal {
  year: number;
  title: string;
  cat: string;
  family: GoalFamily;
  source: GoalSource;
  period?: GoalPeriodKind | null;
  perPeriodTarget?: number | null;
  target: number;
  unit?: string | null;
  manualCurrent?: number | null;
}

interface DbGoalRow {
  id: string;
  year: number;
  title: string;
  cat: string | null;
  family: GoalFamily;
  source: GoalSource;
  period: GoalPeriodKind | null;
  per_period_target: number | string | null;
  target: number | string;
  unit: string | null;
  manual_current: number | string | null;
  active: boolean;
  sort: number;
  created_at: string;
}

interface DbOccRow {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoOccurrence['status'];
  done_at: string | null;
  created_at: string;
}

interface DbHabitLogRow {
  id: string;
  habit_id: string;
  log_date: string;
  value: number | string | null;
}

/**
 * Fonte única das Metas no web. Espelha a estratégia client-side de tarefas/hábitos:
 * um fetch das metas + fetch das fontes (ocorrências concluídas e logs de hábito do
 * ano); atividades e definições de hábito reusam os stores existentes. O progresso é
 * DERIVADO por `evaluateGoal` (shared) — a store nunca persiste valor calculado.
 */
@Injectable({ providedIn: 'root' })
export class GoalsStore {
  private readonly auth = inject(AuthService);
  private readonly activitiesStore = inject(ActivitiesStore);
  private readonly habitsStore = inject(HabitsStore);

  private readonly _goals = signal<Goal[]>([]);
  private readonly _doneOccurrences = signal<TodoOccurrence[]>([]);
  private readonly _habitLogs = signal<HabitLog[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');

  /** Todas as metas (ativas + arquivadas), ativas primeiro e por `sort`. */
  readonly allGoals = computed(() =>
    [...this._goals()].sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort),
  );
  readonly goals = computed(() => this.allGoals().filter((g) => g.active));
  readonly isEmpty = computed(() => this._state() === 'loaded' && this._goals().length === 0);

  /** Categorias distintas das metas ativas — base do filtro. */
  readonly categories = computed(() => [...new Set(this.goals().map((g) => g.cat))].sort());

  /** Contexto de avaliação montado a partir das fontes carregadas. */
  private readonly context = computed<GoalContext>(() => ({
    activities: this.activitiesStore.activities(),
    doneOccurrences: this._doneOccurrences(),
    habitLogs: this._habitLogs(),
    habits: this.habitsStore.habits().map((h) => ({ id: h.id, direction: h.direction, target: h.target })),
    now: new Date(),
  }));

  /** Progresso por meta (derivado). */
  readonly progressById = computed<Map<string, GoalProgress>>(() => {
    const ctx = this.context();
    const map = new Map<string, GoalProgress>();
    for (const g of this._goals()) map.set(g.id, evaluateGoal(g, ctx));
    return map;
  });

  progressFor(goalId: string): GoalProgress | undefined {
    return this.progressById().get(goalId);
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

    const gRes = await supabase.from('goals').select('*').eq('user_id', userId).order('sort');
    if (gRes.error) return this.fail(gRes.error.message);
    const goals = ((gRes.data ?? []) as DbGoalRow[]).map(mapGoal);

    // Janela das fontes: 1º de janeiro do menor ano entre as metas (ou ano atual).
    const minYear = goals.length ? Math.min(...goals.map((g) => g.year)) : new Date().getFullYear();
    const since = `${minYear}-01-01`;

    const [occRes, logRes] = await Promise.all([
      supabase
        .from('todo_occurrences')
        .select('id,template_id,due_date,status,done_at,created_at')
        .eq('user_id', userId)
        .eq('status', 'done')
        .gte('done_at', `${since}T00:00:00`),
      supabase
        .from('habit_logs')
        .select('id,habit_id,log_date,value')
        .eq('user_id', userId)
        .gte('log_date', since),
    ]);
    if (occRes.error) return this.fail(occRes.error.message);
    if (logRes.error) return this.fail(logRes.error.message);

    this._goals.set(goals);
    this._doneOccurrences.set(((occRes.data ?? []) as DbOccRow[]).map(mapOcc));
    this._habitLogs.set(((logRes.data ?? []) as DbHabitLogRow[]).map(mapLog));
    this._state.set('loaded');

    // Fontes que vivem nos stores existentes (histórico completo em memória).
    void this.activitiesStore.load();
    void this.habitsStore.load();
  }

  async createGoal(input: NewGoal): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const sort = this.allGoals().reduce((m, g) => Math.max(m, g.sort), -1) + 1;
    const { error } = await supabase.from('goals').insert({ user_id: userId, ...toRow(input), sort });
    if (error) return this.fail(error.message);
    await this.load(true);
  }

  async updateGoal(id: string, input: NewGoal): Promise<void> {
    const { error } = await supabase.from('goals').update(toRow(input)).eq('id', id);
    if (error) return this.fail(error.message);
    await this.load(true);
  }

  async archiveGoal(id: string, active: boolean): Promise<void> {
    const { error } = await supabase.from('goals').update({ active }).eq('id', id);
    if (error) return this.fail(error.message);
    await this.load(true);
  }

  async deleteGoal(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
    if (error) return this.fail(error.message);
    await this.load(true);
  }

  private fail(message: string): void {
    this._error.set(message);
    this._state.set('error');
  }
}

function toRow(input: NewGoal): Record<string, unknown> {
  return {
    year: input.year,
    title: input.title,
    cat: input.cat,
    family: input.family,
    source: input.source,
    period: input.period ?? null,
    per_period_target: input.perPeriodTarget ?? null,
    target: input.target,
    unit: input.unit ?? null,
    manual_current: input.manualCurrent ?? null,
  };
}

function mapGoal(r: DbGoalRow): Goal {
  return {
    id: r.id,
    year: r.year,
    title: r.title,
    cat: r.cat ?? 'geral',
    family: r.family,
    source: r.source,
    period: r.period ?? undefined,
    perPeriodTarget: r.per_period_target == null ? undefined : Number(r.per_period_target),
    target: Number(r.target),
    unit: r.unit ?? undefined,
    manualCurrent: r.manual_current == null ? undefined : Number(r.manual_current),
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

function mapOcc(r: DbOccRow): TodoOccurrence {
  return {
    id: r.id,
    templateId: r.template_id,
    dueDate: r.due_date,
    status: r.status,
    doneAt: r.done_at ?? undefined,
    createdAt: r.created_at,
  };
}

function mapLog(r: DbHabitLogRow): HabitLog {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, value: Number(r.value ?? 0) };
}
