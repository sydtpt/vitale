import { Injectable, computed, inject, signal } from '@angular/core';
import type { PlannedWorkout } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { ActivitiesStore } from '../../workout-history/data/activities.store';
import { autoMatch, localDateStr, weekDatesOf } from '@vitale/shared';
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  fetchPlannedWorkouts,
  updatePlannedWorkout,
} from '@vitale/shared';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface PlannedDay {
  date: string;
  /** 'SEG'…'DOM' */
  label: string;
  isToday: boolean;
  workouts: PlannedWorkout[];
}

/**
 * Fonte única do planner de treinos no web. Carrega os treinos planejados da
 * semana corrente; `done`/`doneActivityId` derivam por auto-match contra as
 * atividades sincronizadas (`ActivitiesStore`). Espelha a estratégia de
 * `HabitsStore` (signals + computed; mutação local após escrever no Supabase).
 */
@Injectable({ providedIn: 'root' })
export class PlannedWorkoutsStore {
  private readonly auth = inject(AuthService);
  private readonly activitiesStore = inject(ActivitiesStore);

  private readonly _planned = signal<PlannedWorkout[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');

  /** Treinos planejados da semana com `done` resolvido pelo auto-match. */
  readonly planned = computed(() =>
    autoMatch(this._planned(), this.activitiesStore.activities()),
  );

  private static readonly DOW = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

  /** Grade seg→dom da semana corrente, cada dia com seus treinos. */
  readonly week = computed<PlannedDay[]>(() => {
    const today = localDateStr();
    const byDate = new Map<string, PlannedWorkout[]>();
    for (const p of this.planned()) {
      const arr = byDate.get(p.date);
      if (arr) arr.push(p);
      else byDate.set(p.date, [p]);
    }
    return weekDatesOf().map((date, i) => ({
      date,
      label: PlannedWorkoutsStore.DOW[i],
      isToday: date === today,
      workouts: (byDate.get(date) ?? []).sort((a, b) => a.sort - b.sort),
    }));
  });

  /** Primeiro treino planejado para hoje (alimenta o readiness). */
  readonly today = computed<PlannedWorkout | undefined>(() => {
    const today = localDateStr();
    return this.planned().find(p => p.date === today);
  });

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

    const week = weekDatesOf();
    let planned: PlannedWorkout[];
    try {
      [planned] = await Promise.all([
        fetchPlannedWorkouts(supabase, userId, week[0], week[6]),
        this.activitiesStore.load(),
      ]);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Erro ao carregar.');
      this._state.set('error');
      return;
    }

    this._planned.set(planned);
    this._state.set('loaded');
  }

  async create(data: {
    date: string;
    type: string;
    kind: PlannedWorkout['kind'];
    durMin: number;
    distKm?: number;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const sameDay = this._planned().filter(p => p.date === data.date);
    const maxSort = Math.max(0, ...sameDay.map(p => p.sort));

    const created = await createPlannedWorkout(supabase, userId, {
      date: data.date,
      type: data.type,
      kind: data.kind,
      durMin: data.durMin,
      distKm: data.distKm,
      sort: maxSort + 1,
    });
    this._planned.update(list => [...list, created]);
  }

  async update(id: string, data: {
    type: string;
    kind: PlannedWorkout['kind'];
    durMin: number;
    distKm?: number;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const updated = await updatePlannedWorkout(supabase, userId, id, {
      type: data.type,
      kind: data.kind,
      durMin: data.durMin,
      distKm: data.distKm,
    });
    this._planned.update(list => list.map(p => (p.id === id ? updated : p)));
  }

  async remove(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    await deletePlannedWorkout(supabase, userId, id);
    this._planned.update(list => list.filter(p => p.id !== id));
  }
}

