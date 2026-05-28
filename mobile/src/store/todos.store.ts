import { create } from 'zustand';
import type {
  TodoTemplate,
  TodoOccurrence,
  TodoModule,
  TodoRecurrence,
  TodoOverduePolicy,
  TodoCancelPolicy,
  TodoSpawnRule,
  TodoStatus,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import {
  localDateStr,
  firstDueDate,
  dueUsage,
  reconcileTemplate,
} from '../lib/todo-logic';
import { drainTodoQueue } from '../lib/todo-queue';
import { toTemplate, toOcc } from '../lib/todo-map';
import { resolveAndAdvance, flushResolves, insertOccurrence } from '../services/todo-resolve';
import { useAuthStore } from './auth.store';

/** Janela de histórico carregada (dias) para listar concluídas/atrasadas recentes. */
export const TODO_WINDOW_DAYS = 30;

export interface NewTodo {
  name: string;
  icon: string;
  color: string;
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoOverduePolicy;
  cancelPolicy: TodoCancelPolicy;
  meter?: number; // estado inicial do contador (recurrence.kind === 'usage')
  linkedActivityId?: number | null; // activityId HealthKit que conclui a tarefa
  onComplete?: TodoSpawnRule[]; // encadeamento: ao concluir, instancia filhas
  triggerOnly?: boolean; // só nasce por gatilho (sem ocorrência inicial nem calendário)
  meta?: Record<string, unknown>; // dados extras por módulo (ex: ShopMeta para compras)
}

/** Campos editáveis de uma série. */
export interface TodoPatch {
  name?: string;
  icon?: string;
  color?: string;
  module?: TodoModule;
  recurrence?: TodoRecurrence;
  overdue?: TodoOverduePolicy;
  cancel_policy?: TodoCancelPolicy;
  meter?: number | null;
  linked_activity_id?: number | null;
  on_complete?: TodoSpawnRule[] | null;
  trigger_only?: boolean;
  meta?: Record<string, unknown> | null;
  active?: boolean;
  sort?: number;
}

interface TodosState {
  templates: TodoTemplate[]; // ativos, ordenados por `sort`
  allTemplates: TodoTemplate[]; // ativos + arquivados — tela de gestão
  occurrences: TodoOccurrence[]; // pendentes + janela recente
  loading: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  loadAll: () => Promise<void>;
  createTemplate: (input: NewTodo) => Promise<void>;
  updateTemplate: (id: string, patch: TodoPatch) => Promise<void>;
  archiveTemplate: (id: string, active: boolean) => Promise<void>;

  resolve: (occId: string, status?: TodoStatus, meta?: Record<string, unknown>) => Promise<void>;
  skip: (occId: string) => Promise<void>;
  cancel: (occId: string) => Promise<void>;

  updateMeter: (templateId: string, meter: number) => Promise<void>;
  trigger: (templateId: string) => Promise<void>; // event/stock manual
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** Busca pendentes (qualquer data) + resolvidas dentro da janela. */
async function fetchOccurrences(since: string): Promise<TodoOccurrence[]> {
  const { data } = await supabase
    .from('todo_occurrences')
    .select('*')
    .or(`status.eq.pending,due_date.gte.${since},done_at.gte.${since}`)
    .order('due_date', { ascending: true });
  return (data ?? []).map(toOcc);
}

export const useTodosStore = create<TodosState>((set, get) => ({
  templates: [],
  allTemplates: [],
  occurrences: [],
  loading: false,
  loaded: false,

  load: async () => {
    const userId = currentUserId();
    if (!userId) return;
    set({ loading: true });

    await drainTodoQueue(flushResolves);

    const { data: trows } = await supabase
      .from('todo_templates')
      .select('*')
      .eq('active', true)
      .order('sort', { ascending: true });
    const templates = (trows ?? []).map(toTemplate);

    const today = localDateStr();
    const since = localDateStr(new Date(Date.now() - (TODO_WINDOW_DAYS - 1) * 86400000));
    let occurrences = await fetchOccurrences(since);

    // reconciliação por série: expira vencidas (overdue=expire) e gera próximas de calendário
    const byTemplate = new Map<string, TodoOccurrence[]>();
    for (const o of occurrences) {
      const arr = byTemplate.get(o.templateId) ?? [];
      arr.push(o);
      byTemplate.set(o.templateId, arr);
    }
    const expires: string[] = [];
    const creates: { templateId: string; dueDate: string | null }[] = [];
    for (const t of templates) {
      for (const a of reconcileTemplate(t, byTemplate.get(t.id) ?? [], today)) {
        if (a.type === 'expire') expires.push(a.occId);
        else creates.push({ templateId: a.templateId, dueDate: a.dueDate });
      }
    }
    if (expires.length || creates.length) {
      for (const id of expires) {
        await supabase.rpc('todo_resolve', { p_occ: id, p_status: 'expired', p_meta: null });
      }
      for (const c of creates) await insertOccurrence(userId, c.templateId, c.dueDate);
      occurrences = await fetchOccurrences(since);
    }

    set({ templates, occurrences, loading: false, loaded: true });
  },

  loadAll: async () => {
    if (!currentUserId()) return;
    const { data } = await supabase
      .from('todo_templates')
      .select('*')
      .order('sort', { ascending: true });
    const all = (data ?? []).map(toTemplate);
    set({ allTemplates: all, templates: all.filter((t) => t.active) });
  },

  createTemplate: async (input) => {
    const userId = currentUserId();
    if (!userId) return;
    const list = get().allTemplates.length ? get().allTemplates : get().templates;
    const sort = list.reduce((max, t) => Math.max(max, t.sort), -1) + 1;
    const { data, error } = await supabase
      .from('todo_templates')
      .insert({
        user_id: userId,
        name: input.name,
        icon: input.icon,
        color: input.color,
        module: input.module,
        recurrence: input.recurrence,
        overdue: input.overdue,
        cancel_policy: input.cancelPolicy,
        meter: input.meter ?? null,
        linked_activity_id: input.linkedActivityId ?? null,
        on_complete: input.onComplete ?? null,
        trigger_only: input.triggerOnly ?? false,
        meta: input.meta ?? null,
        sort,
      })
      .select('id')
      .single();
    if (error || !data) return;

    // ocorrência inicial: 'none' aparece sem data (até concluir); calendário/after_completion
    // ganham a primeira data; usage/event/stock/on_workout esperam um gatilho.
    // triggerOnly nunca cria ocorrência inicial — só nasce por gatilho.
    if (!input.triggerOnly) {
      if (input.recurrence.kind === 'none') {
        await insertOccurrence(userId, data.id, null);
      } else {
        const due = firstDueDate(input.recurrence, localDateStr());
        if (due != null) await insertOccurrence(userId, data.id, due);
      }
    }
    await get().load();
  },

  updateTemplate: async (id, patch) => {
    await supabase.from('todo_templates').update(patch).eq('id', id);
    await get().loadAll();
  },

  archiveTemplate: async (id, active) => {
    await supabase.from('todo_templates').update({ active }).eq('id', id);
    await get().loadAll();
  },

  resolve: async (occId, status = 'done', meta) => {
    const occ = get().occurrences.find((o) => o.id === occId);
    if (!occ) return;
    const userId = currentUserId();

    // otimista
    set((s) => ({
      occurrences: s.occurrences.map((o) =>
        o.id === occId
          ? { ...o, status, doneAt: status === 'done' ? new Date().toISOString() : o.doneAt, meta: meta ?? o.meta }
          : o,
      ),
    }));

    // conclusão + geração da próxima passam pelo seam único (compartilhado com o sync)
    const t = get().templates.find((x) => x.id === occ.templateId);
    if (t && userId) {
      await resolveAndAdvance({
        userId,
        template: t,
        occId,
        occDueDate: occ.dueDate,
        status,
        meta: meta ?? null,
      });
    }
    await get().load();
  },

  skip: (occId) => get().resolve(occId, 'skipped'),
  cancel: (occId) => get().resolve(occId, 'canceled'),

  updateMeter: async (templateId, meter) => {
    const userId = currentUserId();
    if (!userId) return;
    await supabase.from('todo_templates').update({ meter }).eq('id', templateId);
    const t = get().templates.find((x) => x.id === templateId);
    const pending = get().occurrences.some(
      (o) => o.templateId === templateId && o.status === 'pending',
    );
    if (t && dueUsage({ ...t, meter }) && !pending) {
      await insertOccurrence(userId, templateId, localDateStr());
    }
    await get().load();
  },

  trigger: async (templateId) => {
    const userId = currentUserId();
    if (!userId) return;
    const pending = get().occurrences.some(
      (o) => o.templateId === templateId && o.status === 'pending',
    );
    if (!pending) await insertOccurrence(userId, templateId, localDateStr());
    await get().load();
  },
}));
