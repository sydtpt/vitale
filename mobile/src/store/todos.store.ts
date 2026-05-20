import { create } from 'zustand';
import type {
  TodoTemplate,
  TodoOccurrence,
  TodoModule,
  TodoRecurrence,
  TodoOverduePolicy,
  TodoCancelPolicy,
  TodoStatus,
} from '@vitale/shared';
import { supabase } from '../lib/supabase';
import {
  localDateStr,
  firstDueDate,
  nextDueDate,
  dueUsage,
  reconcileTemplate,
} from '../lib/todo-logic';
import {
  enqueueResolve,
  drainTodoQueue,
  type TodoResolveOp,
} from '../lib/todo-queue';
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

type TemplateRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoOverduePolicy;
  cancel_policy: TodoCancelPolicy;
  meter: number | string | null;
  meter_at_last_done: number | string | null;
  active: boolean;
  sort: number;
  created_at: string;
};

type OccRow = {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoStatus;
  done_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

function toTemplate(r: TemplateRow): TodoTemplate {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon ?? '',
    color: r.color ?? 'tarefa',
    module: r.module,
    recurrence: r.recurrence,
    overdue: r.overdue,
    cancelPolicy: r.cancel_policy,
    meter: r.meter == null ? undefined : Number(r.meter),
    meterAtLastDone: r.meter_at_last_done == null ? undefined : Number(r.meter_at_last_done),
    active: r.active,
    sort: r.sort,
    createdAt: r.created_at,
  };
}

function toOcc(r: OccRow): TodoOccurrence {
  return {
    id: r.id,
    templateId: r.template_id,
    dueDate: r.due_date,
    status: r.status,
    doneAt: r.done_at ?? undefined,
    meta: r.meta ?? undefined,
    createdAt: r.created_at,
  };
}

function genOpId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function currentUserId(): string | undefined {
  return useAuthStore.getState().user?.id;
}

/** Resolve cada item via rpc; devolve os que falharam (a manter na fila). */
async function flushResolves(items: TodoResolveOp[]): Promise<TodoResolveOp[]> {
  const failed: TodoResolveOp[] = [];
  for (const it of items) {
    const { error } = await supabase.rpc('todo_resolve', {
      p_occ: it.occId,
      p_status: it.status,
      p_meta: it.meta ?? null,
    });
    if (error) failed.push(it);
  }
  return failed;
}

/** Insere ocorrência; ignora violação de unicidade (idempotente por template+data). */
async function insertOccurrence(
  userId: string,
  templateId: string,
  dueDate: string | null,
): Promise<void> {
  const { error } = await supabase.from('todo_occurrences').insert({
    template_id: templateId,
    user_id: userId,
    due_date: dueDate,
    status: 'pending',
  });
  if (error && error.code !== '23505') throw error;
}

/** Busca pendentes (qualquer data) + resolvidas dentro da janela. */
async function fetchOccurrences(since: string): Promise<TodoOccurrence[]> {
  const { data } = await supabase
    .from('todo_occurrences')
    .select('*')
    .or(`status.eq.pending,due_date.gte.${since}`)
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
        sort,
      })
      .select('id')
      .single();
    if (error || !data) return;

    // ocorrência inicial: 'none' aparece sem data (até concluir); calendário/after_completion
    // ganham a primeira data; usage/event/stock esperam um gatilho.
    if (input.recurrence.kind === 'none') {
      await insertOccurrence(userId, data.id, null);
    } else {
      const due = firstDueDate(input.recurrence, localDateStr());
      if (due != null) await insertOccurrence(userId, data.id, due);
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
    await enqueueResolve({ opId: genOpId(), occId, status, meta: meta ?? null });
    await drainTodoQueue(flushResolves);

    // gerar próxima ocorrência conforme a recorrência
    const t = get().templates.find((x) => x.id === occ.templateId);
    if (t && userId) {
      if (t.recurrence.kind === 'usage' && status === 'done') {
        await supabase
          .from('todo_templates')
          .update({ meter_at_last_done: t.meter ?? 0 })
          .eq('id', t.id);
      }
      const next = nextDueDate(t.recurrence, occ.dueDate, localDateStr());
      if (next != null) await insertOccurrence(userId, t.id, next);
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
