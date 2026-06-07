import { Injectable, computed, inject, signal } from '@angular/core';
import type { PlannedWorkout } from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { ActivitiesStore } from '../../workout-history/data/activities.store';
import { autoMatch, localDateStr, weekDatesOf } from './planned-match';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface DbRow {
  id: string;
  plan_date: string;
  type: string;
  kind: PlannedWorkout['kind'];
  dur_min: number | string;
  dist_km: number | string | null;
  sort: number;
  created_at: string;
}

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
    const [res] = await Promise.all([
      supabase
        .from('planned_workouts')
        .select('id,plan_date,type,kind,dur_min,dist_km,sort,created_at')
        .eq('user_id', userId)
        .gte('plan_date', week[0])
        .lte('plan_date', week[6])
        .order('sort', { ascending: true }),
      this.activitiesStore.load(),
    ]);

    if (res.error) {
      this._error.set(res.error.message);
      this._state.set('error');
      return;
    }

    this._planned.set(((res.data ?? []) as DbRow[]).map(mapRow));
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

    const res = await supabase
      .from('planned_workouts')
      .insert({
        user_id: userId,
        plan_date: data.date,
        type: data.type,
        kind: data.kind,
        dur_min: data.durMin,
        dist_km: data.kind === 'endurance' ? data.distKm ?? null : null,
        sort: maxSort + 1,
      })
      .select('id,plan_date,type,kind,dur_min,dist_km,sort,created_at')
      .single();

    if (res.error) throw new Error(res.error.message);
    this._planned.update(list => [...list, mapRow(res.data as DbRow)]);
  }

  async update(id: string, data: {
    type: string;
    kind: PlannedWorkout['kind'];
    durMin: number;
    distKm?: number;
  }): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const res = await supabase
      .from('planned_workouts')
      .update({
        type: data.type,
        kind: data.kind,
        dur_min: data.durMin,
        dist_km: data.kind === 'endurance' ? data.distKm ?? null : null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id,plan_date,type,kind,dur_min,dist_km,sort,created_at')
      .single();

    if (res.error) throw new Error(res.error.message);
    const updated = mapRow(res.data as DbRow);
    this._planned.update(list => list.map(p => (p.id === id ? updated : p)));
  }

  async remove(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Sessão não encontrada.');

    const { error } = await supabase
      .from('planned_workouts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    this._planned.update(list => list.filter(p => p.id !== id));
  }
}

function mapRow(r: DbRow): PlannedWorkout {
  return {
    id: r.id,
    date: r.plan_date,
    type: r.type,
    kind: r.kind,
    durMin: Number(r.dur_min),
    distKm: r.dist_km == null ? undefined : Number(r.dist_km),
    done: false,
    sort: r.sort,
    createdAt: r.created_at,
  };
}
