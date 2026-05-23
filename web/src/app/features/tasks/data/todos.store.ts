import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  TodoTemplate,
  TodoOccurrence,
  TodoModule,
  TodoRecurrence,
  TodoOverduePolicy,
  TodoCancelPolicy,
  TodoStatus,
} from '@vitale/shared';
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import {
  localDateStr,
  firstDueDate,
  nextDueDate,
  triggeredDueDate,
  dueUsage,
  reconcileTemplate,
} from './todo-logic';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

/** Janela de tarefas resolvidas carregada (dias). */
export const TODO_WINDOW_DAYS = 30;

export interface NewTodo {
  name: string;
  icon: string;
  color: string;
  module: TodoModule;
  recurrence: TodoRecurrence;
  overdue: TodoOverduePolicy;
  cancelPolicy: TodoCancelPolicy;
  meter?: number;
  meta?: Record<string, unknown>;
}

interface DbTemplateRow {
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
  meta: Record<string, unknown> | null;
  active: boolean;
  sort: number;
  created_at: string;
}

interface DbOccRow {
  id: string;
  template_id: string;
  due_date: string | null;
  status: TodoStatus;
  done_at: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Fonte única das tarefas no web. Espelha a estratégia client-side dos habitos:
 * um fetch das séries + um das ocorrências; reconciliação roda no `load`.
 */
@Injectable({ providedIn: 'root' })
export class TodosStore {
  private readonly auth = inject(AuthService);

  private readonly _templates = signal<TodoTemplate[]>([]);
  private readonly _occurrences = signal<TodoOccurrence[]>([]);
  private readonly _state = signal<LoadState>('idle');
  private readonly _error = signal<string | null>(null);

  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loading = computed(() => this._state() === 'loading' || this._state() === 'idle');

  /** Todas as séries (ativas + arquivadas), ordenadas. */
  readonly allTemplates = computed(() =>
    [...this._templates()].sort((a, b) => Number(b.active) - Number(a.active) || a.sort - b.sort),
  );
  readonly templates = computed(() => this.allTemplates().filter((t) => t.active));
  readonly occurrences = this._occurrences.asReadonly();

  readonly isEmpty = computed(
    () =>
      this._state() === 'loaded' &&
      this._occurrences().filter((o) => o.status === 'pending').length === 0 &&
      this.templates().length === 0,
  );

  /** Ocorrências resolvidas (últimos 30 dias), ordenadas do mais recente. */
  readonly historyOccurrences = computed(() =>
    [...this._occurrences()]
      .filter((o) => o.status !== 'pending')
      .sort((a, b) => (b.doneAt ?? b.createdAt).localeCompare(a.doneAt ?? a.createdAt)),
  );

  templateById(id: string): TodoTemplate | undefined {
    return this._templates().find((t) => t.id === id);
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

    const today = localDateStr();
    const since = localDateStr(new Date(Date.now() - (TODO_WINDOW_DAYS - 1) * 86400000));

    const tRes = await supabase.from('todo_templates').select('*').eq('user_id', userId).order('sort');
    if (tRes.error) return this.fail(tRes.error.message);
    const templates = ((tRes.data ?? []) as DbTemplateRow[]).map(mapTemplate);

    let occurrences = await this.fetchOccurrences(userId, since);

    // reconciliação por série
    const byTemplate = new Map<string, TodoOccurrence[]>();
    for (const o of occurrences) {
      const arr = byTemplate.get(o.templateId) ?? [];
      arr.push(o);
      byTemplate.set(o.templateId, arr);
    }
    const expires: string[] = [];
    const creates: { templateId: string; dueDate: string | null }[] = [];
    for (const t of templates.filter((x) => x.active)) {
      for (const a of reconcileTemplate(t, byTemplate.get(t.id) ?? [], today)) {
        if (a.type === 'expire') expires.push(a.occId);
        else creates.push({ templateId: a.templateId, dueDate: a.dueDate });
      }
    }
    if (expires.length || creates.length) {
      for (const id of expires) await supabase.rpc('todo_resolve', { p_occ: id, p_status: 'expired', p_meta: null });
      for (const c of creates) await this.insertOccurrence(userId, c.templateId, c.dueDate);
      occurrences = await this.fetchOccurrences(userId, since);
    }

    this._templates.set(templates);
    this._occurrences.set(occurrences);
    this._state.set('loaded');
  }

  async createTemplate(input: NewTodo): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const sort = this.allTemplates().reduce((m, t) => Math.max(m, t.sort), -1) + 1;
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
        meta: input.meta ?? null,
        sort,
      })
      .select('id')
      .single();
    if (error || !data) return;
    if (input.recurrence.kind === 'none') {
      await this.insertOccurrence(userId, data.id, null);
    } else {
      const due = firstDueDate(input.recurrence, localDateStr());
      if (due != null) await this.insertOccurrence(userId, data.id, due);
    }
    await this.load(true);
  }

  async updateTemplate(id: string, patch: Record<string, unknown>): Promise<void> {
    await supabase.from('todo_templates').update(patch).eq('id', id);
    await this.load(true);
  }

  async archiveTemplate(id: string, active: boolean): Promise<void> {
    await supabase.from('todo_templates').update({ active }).eq('id', id);
    await this.load(true);
  }

  async resolve(occId: string, status: TodoStatus = 'done', meta?: Record<string, unknown>): Promise<void> {
    const occ = this._occurrences().find((o) => o.id === occId);
    if (!occ) return;
    const userId = this.auth.user()?.id;
    await supabase.rpc('todo_resolve', { p_occ: occId, p_status: status, p_meta: meta ?? null });

    const t = this.templateById(occ.templateId);
    if (t && userId) {
      if (status === 'done') {
        if (t.recurrence.kind === 'usage') {
          await supabase.from('todo_templates').update({ meter_at_last_done: t.meter ?? 0 }).eq('id', t.id);
        }
        // Encadeamento: séries on_task que dependem desta criam sua ocorrência.
        await this.fireTaskChains(userId, t.id, localDateStr());
      }
      const next = nextDueDate(t.recurrence, occ.dueDate, localDateStr());
      if (next != null) await this.insertOccurrence(userId, t.id, next);
    }
    await this.load(true);
  }

  /** Séries on_task que apontam para `sourceTemplateId` criam sua ocorrência (1 por vez). */
  private async fireTaskChains(userId: string, sourceTemplateId: string, triggerDay: string): Promise<void> {
    const { data } = await supabase
      .from('todo_templates')
      .select('id, recurrence')
      .eq('user_id', userId)
      .eq('active', true)
      .eq('recurrence->>kind', 'on_task')
      .eq('recurrence->>sourceTemplateId', sourceTemplateId);
    for (const t of (data ?? []) as { id: string; recurrence: TodoRecurrence }[]) {
      const { data: pend } = await supabase
        .from('todo_occurrences')
        .select('id')
        .eq('template_id', t.id)
        .eq('status', 'pending')
        .limit(1);
      if (pend && pend.length) continue;
      await this.insertOccurrence(userId, t.id, triggeredDueDate(t.recurrence, triggerDay));
    }
  }

  skip(occId: string): Promise<void> {
    return this.resolve(occId, 'skipped');
  }
  cancel(occId: string): Promise<void> {
    return this.resolve(occId, 'canceled');
  }

  async deleteOccurrence(occId: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    await supabase.from('todo_occurrences').delete().eq('id', occId).eq('user_id', userId);
    await this.load(true);
  }

  async updateMeter(templateId: string, meter: number): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    await supabase.from('todo_templates').update({ meter }).eq('id', templateId);
    const t = this.templateById(templateId);
    const pending = this._occurrences().some((o) => o.templateId === templateId && o.status === 'pending');
    if (t && dueUsage({ ...t, meter }) && !pending) {
      await this.insertOccurrence(userId, templateId, localDateStr());
    }
    await this.load(true);
  }

  async trigger(templateId: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const pending = this._occurrences().some((o) => o.templateId === templateId && o.status === 'pending');
    if (!pending) await this.insertOccurrence(userId, templateId, localDateStr());
    await this.load(true);
  }

  private async fetchOccurrences(userId: string, since: string): Promise<TodoOccurrence[]> {
    const { data } = await supabase
      .from('todo_occurrences')
      .select('*')
      .eq('user_id', userId)
      .or(`status.eq.pending,due_date.gte.${since},done_at.gte.${since}`)
      .order('due_date', { ascending: true });
    return ((data ?? []) as DbOccRow[]).map(mapOcc);
  }

  private async insertOccurrence(userId: string, templateId: string, dueDate: string | null): Promise<void> {
    const { error } = await supabase
      .from('todo_occurrences')
      .insert({ template_id: templateId, user_id: userId, due_date: dueDate, status: 'pending' });
    if (error && error.code !== '23505') throw error;
  }

  private fail(message: string): void {
    this._error.set(message);
    this._state.set('error');
  }
}

function mapTemplate(r: DbTemplateRow): TodoTemplate {
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
    meta: r.meta ?? undefined,
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
    meta: r.meta ?? undefined,
    createdAt: r.created_at,
  };
}
