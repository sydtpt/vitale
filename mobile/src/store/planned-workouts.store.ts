import { create } from 'zustand';
import type { PlannedWorkout } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { useActivitiesStore } from './activities.store';
import { weekDatesOf } from '@vitale/shared';

type Kind = PlannedWorkout['kind'];

export interface NewPlannedWorkout {
  date: string;
  type: string;
  kind: Kind;
  durMin: number;
  distKm?: number;
}

/** Campos editáveis de um treino planejado. */
export interface PlannedWorkoutPatch {
  type?: string;
  kind?: Kind;
  durMin?: number;
  distKm?: number;
}

interface PlannedWorkoutsState {
  /** Treinos planejados da semana corrente (sem `done` — derivado no auto-match). */
  planned: PlannedWorkout[];
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  createWorkout: (input: NewPlannedWorkout) => Promise<void>;
  updateWorkout: (id: string, patch: PlannedWorkoutPatch) => Promise<void>;
  removeWorkout: (id: string) => Promise<void>;
}

type Row = {
  id: string;
  plan_date: string;
  type: string;
  kind: Kind;
  dur_min: number | string;
  dist_km: number | string | null;
  sort: number;
  created_at: string;
};

function toWorkout(r: Row): PlannedWorkout {
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

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

const SELECT = 'id,plan_date,type,kind,dur_min,dist_km,sort,created_at';

export const usePlannedWorkoutsStore = create<PlannedWorkoutsState>((set, get) => ({
  planned: [],
  loading: false,
  loaded: false,

  load: async () => {
    if (!currentUserId()) return;
    set({ loading: true });

    const week = weekDatesOf();
    const [res] = await Promise.all([
      supabase
        .from('planned_workouts')
        .select(SELECT)
        .gte('plan_date', week[0])
        .lte('plan_date', week[6])
        .order('sort', { ascending: true }),
      useActivitiesStore.getState().load(), // base do auto-match
    ]);

    set({
      planned: ((res.data ?? []) as Row[]).map(toWorkout),
      loading: false,
      loaded: true,
    });
  },

  createWorkout: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const sameDay = get().planned.filter((p) => p.date === input.date);
    const sort = sameDay.reduce((max, p) => Math.max(max, p.sort), 0) + 1;

    await supabase.from('planned_workouts').insert({
      user_id: userId,
      plan_date: input.date,
      type: input.type,
      kind: input.kind,
      dur_min: input.kind === 'rest' ? 0 : input.durMin,
      dist_km: input.kind === 'endurance' ? input.distKm ?? null : null,
      sort,
    });
    await get().load();
  },

  updateWorkout: async (id, patch) => {
    const userId = currentUserId();
    if (!userId) return;
    const dbPatch: Record<string, unknown> = {};
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.kind !== undefined) {
      dbPatch.kind = patch.kind;
      // mantém coerência: descanso zera duração; fora de endurance limpa distância
      if (patch.kind === 'rest') dbPatch.dur_min = 0;
      if (patch.kind !== 'endurance') dbPatch.dist_km = null;
    }
    if (patch.durMin !== undefined) dbPatch.dur_min = patch.durMin;
    if (patch.distKm !== undefined) dbPatch.dist_km = patch.distKm;

    await supabase.from('planned_workouts').update(dbPatch).eq('id', id);
    await get().load();
  },

  removeWorkout: async (id) => {
    await supabase.from('planned_workouts').delete().eq('id', id);
    set((s) => ({ planned: s.planned.filter((p) => p.id !== id) }));
  },
}));
