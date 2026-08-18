import { create } from 'zustand';
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  fetchPlannedWorkouts,
  patchPlannedWorkout,
} from '@vitale/shared';
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

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

const SELECT = 'id,plan_date,type,kind,dur_min,dist_km,sort,created_at';

export const usePlannedWorkoutsStore = create<PlannedWorkoutsState>((set, get) => ({
  planned: [],
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    const week = weekDatesOf();
    const [planned] = await Promise.all([
      fetchPlannedWorkouts(supabase, userId, week[0], week[6]),
      useActivitiesStore.getState().load(), // base do auto-match
    ]);

    set({
      planned,
      loading: false,
      loaded: true,
    });
  },

  createWorkout: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const sameDay = get().planned.filter((p) => p.date === input.date);
    const sort = sameDay.reduce((max, p) => Math.max(max, p.sort), 0) + 1;

    await createPlannedWorkout(supabase, userId, {
      date: input.date,
      type: input.type,
      kind: input.kind,
      durMin: input.durMin,
      distKm: input.distKm,
      sort,
    });
    await get().load();
  },

  updateWorkout: async (id, patch) => {
    const userId = currentUserId();
    if (!userId) return;
    await patchPlannedWorkout(supabase, userId, id, patch);
    await get().load();
  },

  removeWorkout: async (id) => {
    const uidD = currentUserId();
    if (uidD) await deletePlannedWorkout(supabase, uidD, id);
    set((s) => ({ planned: s.planned.filter((p) => p.id !== id) }));
  },
}));
