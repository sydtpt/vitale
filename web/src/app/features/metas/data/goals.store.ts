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
import { fetchDoneTodoOccurrencesSince, fetchHabitLogsSince } from '@vitale/shared';
import { createGoal, deleteGoal, fetchGoals, setGoalActive, updateGoal } from '@vitale/shared';

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

    let goals: Goal[];
    try {
      goals = await fetchGoals(supabase, userId);
    } catch (e) {
      return this.fail(e instanceof Error ? e.message : 'Falha ao carregar as metas');
    }

    // Janela das fontes: 1º de janeiro do menor ano entre as metas (ou ano atual).
    const minYear = goals.length ? Math.min(...goals.map((g) => g.year)) : new Date().getFullYear();
    const since = `${minYear}-01-01`;

    let occs: TodoOccurrence[];
    let logs: HabitLog[];
    try {
      [occs, logs] = await Promise.all([
        fetchDoneTodoOccurrencesSince(supabase, userId, since),
        fetchHabitLogsSince(supabase, userId, since),
      ]);
    } catch (e) {
      return this.fail(e instanceof Error ? e.message : 'Falha ao carregar as fontes das metas');
    }

    this._goals.set(goals);
    this._doneOccurrences.set(occs);
    this._habitLogs.set(logs);
    this._state.set('loaded');

    // Fontes que vivem nos stores existentes (histórico completo em memória).
    void this.activitiesStore.load();
    void this.habitsStore.load();
  }

  async createGoal(input: NewGoal): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const sort = this.allGoals().reduce((m, g) => Math.max(m, g.sort), -1) + 1;
    await createGoal(supabase, userId, input, sort);
    await this.load(true);
  }

  async updateGoal(id: string, input: NewGoal): Promise<void> {
    await updateGoal(supabase, id, input);
    await this.load(true);
  }

  async archiveGoal(id: string, active: boolean): Promise<void> {
    await setGoalActive(supabase, id, active);
    await this.load(true);
  }

  async deleteGoal(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    await deleteGoal(supabase, userId, id);
    await this.load(true);
  }

  private fail(message: string): void {
    this._error.set(message);
    this._state.set('error');
  }
}

function mapLog(r: DbHabitLogRow): HabitLog {
  return { id: r.id, habitId: r.habit_id, logDate: r.log_date, value: Number(r.value ?? 0) };
}
