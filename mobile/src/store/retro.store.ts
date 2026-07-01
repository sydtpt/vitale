import { create } from 'zustand';
import {
  localDateStr,
  buildRetrospective,
  buildRetroHighlights,
  buildYearByMonth,
  periodBounds,
  type PeriodKind,
  type RetroInput,
  type RetroSummary,
  type RetroHealthMetric,
  type WeekHighlight,
  type MonthBucket,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth.store';
import { useActivitiesStore } from './activities.store';

/** Métricas de saúde no recap + polaridade e formatação. */
const HEALTH_SPECS: Omit<RetroHealthMetric, 'valuesByDay'>[] = [
  { metric: 'sono', label: 'Sono', higherIsWorse: false, icon: 'sleep', decimals: 1, unit: 'h' },
  { metric: 'vfc', label: 'VFC', higherIsWorse: false, icon: 'hrv', decimals: 0, unit: ' ms' },
  { metric: 'fcRepouso', label: 'FC repouso', higherIsWorse: true, icon: 'heart', decimals: 0, unit: ' bpm' },
];

type DbHealthRow = { day: string; metric: string; value: number | null };
type DbRatingRow = { day: string; sleep_quality: number | null; day_quality: number | null };
type DbHabitRow = { id: string; name: string; bad: boolean };
type DbHabitLogRow = { habit_id: string; log_date: string; value: number | null };
type DbRegistroRow = { id: string; name: string };
type DbRegistroLogRow = { registro_id: string; log_date: string };
type DbTemplateRow = { id: string; name: string; module: string; meta: Record<string, unknown> | null };
type DbOccRow = { template_id: string; done_at: string | null };

interface RetroState {
  loading: boolean;
  loaded: boolean;
  loadedSince: string | null;

  health: DbHealthRow[];
  ratings: DbRatingRow[];
  habits: DbHabitRow[];
  habitLogs: DbHabitLogRow[];
  registros: DbRegistroRow[];
  registroLogs: DbRegistroLogRow[];
  tasks: { doneDay: string; module: string }[];
  purchases: { doneDay: string; cat?: string; price?: number; name: string }[];

  ensure: (since: string) => Promise<void>;
  summary: (now: Date, kind: PeriodKind, offset: number) => RetroSummary;
  highlights: (now: Date, kind: PeriodKind, offset: number) => WeekHighlight[];
  yearByMonth: (now: Date, offset: number) => MonthBucket[];
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

export const useRetroStore = create<RetroState>((set, get) => {
  function buildInput(now: Date, kind: PeriodKind, offset: number): RetroInput {
    const s = get();

    const byMetric = new Map<string, Map<string, number>>();
    for (const r of s.health) {
      if (r.value == null) continue;
      let m = byMetric.get(r.metric);
      if (!m) { m = new Map(); byMetric.set(r.metric, m); }
      m.set(r.day, Number(r.value));
    }

    const sleepMap = new Map<string, number>();
    const dayMap = new Map<string, number>();
    for (const r of s.ratings) {
      if (r.sleep_quality != null) sleepMap.set(r.day, Number(r.sleep_quality));
      if (r.day_quality != null) dayMap.set(r.day, Number(r.day_quality));
    }

    const logsByHabit = new Map<string, Map<string, number>>();
    for (const l of s.habitLogs) {
      let m = logsByHabit.get(l.habit_id);
      if (!m) { m = new Map(); logsByHabit.set(l.habit_id, m); }
      m.set(l.log_date, Number(l.value ?? 0));
    }
    const daysByRegistro = new Map<string, string[]>();
    for (const l of s.registroLogs) {
      const arr = daysByRegistro.get(l.registro_id) ?? [];
      arr.push(l.log_date);
      daysByRegistro.set(l.registro_id, arr);
    }

    return {
      now, kind, offset,
      activities: useActivitiesStore.getState().activities(),
      health: HEALTH_SPECS.map((spec) => ({ ...spec, valuesByDay: byMetric.get(spec.metric) ?? new Map() })),
      floorsByDay: byMetric.get('andares'),
      ratingsSleep: sleepMap,
      ratingsDay: dayMap,
      habits: s.habits.map((h) => ({ id: h.id, name: h.name, bad: h.bad, logsByDay: logsByHabit.get(h.id) ?? new Map() })),
      registros: s.registros.map((r) => ({ id: r.id, name: r.name, days: daysByRegistro.get(r.id) ?? [] })),
      tasks: s.tasks,
      purchases: s.purchases,
    };
  }

  return {
    loading: false,
    loaded: false,
    loadedSince: null,
    health: [], ratings: [], habits: [], habitLogs: [], registros: [], registroLogs: [], tasks: [], purchases: [],

    ensure: async (since) => {
      const { loading, loaded, loadedSince } = get();
      if (loading) return;
      if (loaded && loadedSince && loadedSince <= since) return;
      if (!currentUserId()) return;

      set({ loading: true });
      void useActivitiesStore.getState().load();

      const [health, ratings, habits, habitLogs, registros, registroLogs, templates, occs] = await Promise.all([
        supabase.from('health_daily').select('day,metric,value').gte('day', since),
        supabase.from('daily_ratings').select('day,sleep_quality,day_quality').gte('day', since),
        supabase.from('habits').select('id,name,bad'),
        supabase.from('habit_logs').select('habit_id,log_date,value').gte('log_date', since),
        supabase.from('registros').select('id,name'),
        supabase.from('registro_logs').select('registro_id,log_date').gte('log_date', since),
        supabase.from('todo_templates').select('id,name,module,meta'),
        supabase.from('todo_occurrences').select('template_id,done_at').eq('status', 'done').gte('done_at', `${since}T00:00:00`),
      ]);

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

      set({
        health: (health.data ?? []) as DbHealthRow[],
        ratings: (ratings.data ?? []) as DbRatingRow[],
        habits: (habits.data ?? []) as DbHabitRow[],
        habitLogs: (habitLogs.data ?? []) as DbHabitLogRow[],
        registros: (registros.data ?? []) as DbRegistroRow[],
        registroLogs: (registroLogs.data ?? []) as DbRegistroLogRow[],
        tasks, purchases,
        loading: false, loaded: true, loadedSince: since,
      });
    },

    summary: (now, kind, offset) => buildRetrospective(buildInput(now, kind, offset)),
    highlights: (now, kind, offset) => {
      const input = buildInput(now, kind, offset);
      return buildRetroHighlights(buildRetrospective(input), input);
    },
    yearByMonth: (now, offset) => buildYearByMonth(buildInput(now, 'year', offset)),
  };
});

/** Início do fetch necessário p/ o período selecionado (período anterior incluso). */
export function retroSince(now: Date, kind: PeriodKind, offset: number): string {
  return localDateStr(periodBounds(now, kind, offset - 1).start);
}
