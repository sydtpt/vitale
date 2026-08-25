import { create } from 'zustand';
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
import {
  localDateStr,
  buildRetrospective,
  buildRetroHighlights,
  buildRetroLede,
  buildHeatmap,
  buildYearByMonth,
  retroSince as retroSinceDate,
  type PeriodKind,
  type RetroLede,
  type Heatmap,
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


interface RetroState {
  loading: boolean;
  loaded: boolean;
  loadedSince: string | null;

  health: Array<{ day: string; metric: string; value: number | null }>;
  ratings: Array<{ day: string; sleepQuality: number | null; dayQuality: number | null }>;
  habits: Array<{ id: string; name: string; bad: boolean; unit: string }>;
  habitLogs: HabitLog[];
  registros: Array<{ id: string; name: string }>;
  registroLogs: RegistroLog[];
  tasks: { doneDay: string; module: string }[];
  purchases: { doneDay: string; cat?: string; price?: number; name: string }[];

  ensure: (since: string) => Promise<void>;
  summary: (now: Date, kind: PeriodKind, offset: number) => RetroSummary;
  highlights: (now: Date, kind: PeriodKind, offset: number) => WeekHighlight[];
  /** A manchete do período — o parágrafo de abertura (spec v2 §3). */
  lede: (now: Date, kind: PeriodKind, offset: number) => RetroLede;
  /** Uma célula por dia do período exibido — genérico em N (spec v2 §4). */
  heatmap: (now: Date, kind: PeriodKind, offset: number, metric: string) => Heatmap | null;
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
      if (r.sleepQuality != null) sleepMap.set(r.day, r.sleepQuality);
      if (r.dayQuality != null) dayMap.set(r.day, r.dayQuality);
    }

    const logsByHabit = new Map<string, Map<string, number>>();
    for (const l of s.habitLogs) {
      let m = logsByHabit.get(l.habitId);
      if (!m) { m = new Map(); logsByHabit.set(l.habitId, m); }
      m.set(l.logDate, l.value);
    }
    const daysByRegistro = new Map<string, string[]>();
    for (const l of s.registroLogs) {
      const arr = daysByRegistro.get(l.registroId) ?? [];
      arr.push(l.logDate);
      daysByRegistro.set(l.registroId, arr);
    }

    return {
      now, kind, offset,
      activities: useActivitiesStore.getState().activities(),
      health: HEALTH_SPECS.map((spec) => ({ ...spec, valuesByDay: byMetric.get(spec.metric) ?? new Map() })),
      floorsByDay: byMetric.get('andares'),
      stepsByDay: byMetric.get('passos'),
      ratingsSleep: sleepMap,
      ratingsDay: dayMap,
      habits: s.habits.map((h) => ({ id: h.id, name: h.name, bad: h.bad, unit: h.unit, logsByDay: logsByHabit.get(h.id) ?? new Map() })),
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
      const userId = currentUserId();
      if (!userId) return;

      set({ loading: true });
      void useActivitiesStore.getState().load();

      const [health, ratings, habits, habitLogs, registros, registroLogs, templates, occs] =
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

      set({
        health,
        ratings,
        habits,
        habitLogs,
        registros,
        registroLogs,
        tasks, purchases,
        loading: false, loaded: true, loadedSince: since,
      });
    },

    summary: (now, kind, offset) => buildRetrospective(buildInput(now, kind, offset)),
    highlights: (now, kind, offset) => {
      const input = buildInput(now, kind, offset);
      return buildRetroHighlights(buildRetrospective(input), input);
    },
    lede: (now, kind, offset) => {
      const input = buildInput(now, kind, offset);
      return buildRetroLede(buildRetroHighlights(buildRetrospective(input), input));
    },
    heatmap: (now, kind, offset, metric) => buildHeatmap(buildInput(now, kind, offset), metric),
    yearByMonth: (now, offset) => buildYearByMonth(buildInput(now, 'year', offset)),
  };
});

/**
 * Início do fetch necessário p/ o período selecionado.
 *
 * Delega a regra ao shared (`retroSinceDate`), que cobre tanto o período anterior
 * — exigido pelos deltas — quanto a janela de análise de 90 dias, exigida pelos
 * insights cruzados. Ver docs/specs/retrospectiva/v2-jornal.md §2.1.
 */
export function retroSince(now: Date, kind: PeriodKind, offset: number): string {
  return localDateStr(retroSinceDate(now, kind, offset));
}
