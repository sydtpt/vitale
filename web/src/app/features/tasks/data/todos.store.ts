import { Injectable, computed, inject, signal } from '@angular/core';
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
import { supabase } from '@core/supabase/supabase.client';
import { AuthService } from '@core/auth/auth.service';
import { localDateStr, localTimeStr, firstDueDate, nextDueDate, dueUsage, reconcileTemplate } from '@vitale/shared';

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
  onComplete?: TodoSpawnRule[];
  triggerOnly?: boolean;
  startDate?: string | null; // 'YYYY-MM-DD' — "a partir de": antes desse dia a série fica oculta (null = Agora)
  startTime?: string | null; // 'HH:MM' — a ocorrência do dia só aparece a partir desse horário
  endTime?: string | null; // 'HH:MM' — após esse horário no dia, cancela automaticamente
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
  on_complete: TodoSpawnRule[] | null;
  trigger_only: boolean | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
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
    const now = localTimeStr();
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
    const tplById = new Map(templates.map((t) => [t.id, t]));
    const expires: string[] = [];
    const creates: { templateId: string; dueDate: string | null }[] = [];
    const cancels: { occId: string; templateId: string; dueDate: string | null }[] = [];
    for (const t of templates.filter((x) => x.active)) {
      for (const a of reconcileTemplate(t, byTemplate.get(t.id) ?? [], today, now)) {
        if (a.type === 'expire') expires.push(a.occId);
        else if (a.type === 'cancel') cancels.push({ occId: a.occId, templateId: a.templateId, dueDate: a.dueDate });
        else creates.push({ templateId: a.templateId, dueDate: a.dueDate });
      }
    }
    if (expires.length || creates.length || cancels.length) {
      for (const id of expires) await supabase.rpc('todo_resolve', { p_occ: id, p_status: 'expired', p_meta: null });
      // cancelamento automático por endTime: marca cancelada e avança a próxima (nextDueDate),
      // espelhando o caminho não-'done' de resolveAndAdvance sem recarregar a store.
      for (const c of cancels) {
        await supabase.rpc('todo_resolve', { p_occ: c.occId, p_status: 'canceled', p_meta: { source: 'auto-end-time' } });
        const t = tplById.get(c.templateId);
        const next = t ? nextDueDate(t.recurrence, c.dueDate, today) : null;
        if (next != null) await this.insertOccurrence(userId, c.templateId, next);
      }
      for (const c of creates) await this.insertOccurrence(userId, c.templateId, c.dueDate);
      occurrences = await this.fetchOccurrences(userId, since);
    }

    this._templates.set(templates);
    this._occurrences.set(occurrences);
    this._state.set('loaded');
    this.scheduleBoundary(templates, occurrences);
  }

  /**
   * Timer enquanto a página está aberta: reconciliação só roda no load, então
   * reagenda um re-load no próximo limite de horário (startTime/endTime) de hoje.
   */
  private boundaryTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleBoundary(templates: TodoTemplate[], occurrences: TodoOccurrence[]): void {
    if (this.boundaryTimer) { clearTimeout(this.boundaryTimer); this.boundaryTimer = null; }
    const today = localDateStr();
    const now = localTimeStr();
    const tplById = new Map(templates.map((t) => [t.id, t]));
    const times: string[] = [];
    for (const o of occurrences) {
      if (o.status !== 'pending' || o.dueDate !== today) continue;
      const t = tplById.get(o.templateId);
      if (!t) continue;
      if (t.startTime && t.startTime > now) times.push(t.startTime);
      if (t.endTime && t.endTime > now) times.push(t.endTime);
    }
    if (times.length === 0) return;
    const nextAt = times.sort()[0];
    const [h, m] = nextAt.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const ms = target.getTime() - Date.now();
    if (ms <= 0) return;
    this.boundaryTimer = setTimeout(() => void this.load(true), ms);
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
        on_complete: input.onComplete ?? null,
        trigger_only: input.triggerOnly ?? false,
        start_date: input.startDate ?? null,
        start_time: input.startTime ?? null,
        end_time: input.endTime ?? null,
        meta: input.meta ?? null,
        sort,
      })
      .select('id')
      .single();
    if (error || !data) return;
    // triggerOnly nunca cria ocorrência inicial — só nasce por gatilho.
    if (!input.triggerOnly) {
      if (input.recurrence.kind === 'none') {
        await this.insertOccurrence(userId, data.id, null);
      } else {
        const due = firstDueDate(input.recurrence, localDateStr(), input.startDate);
        if (due != null) await this.insertOccurrence(userId, data.id, due);
      }
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
        await this.fireOnComplete(userId, t, localDateStr());
      }
      const next = nextDueDate(t.recurrence, occ.dueDate, localDateStr());
      if (next != null) await this.insertOccurrence(userId, t.id, next);
    }
    await this.load(true);
  }

  /**
   * Encadeamento por conclusão: instancia ocorrências das séries-filhas declaradas
   * em `parent.onComplete`. ifPending='ignore' pula se já houver pendente.
   */
  private async fireOnComplete(userId: string, parent: TodoTemplate, triggerDay: string): Promise<void> {
    const rules = parent.onComplete ?? [];
    for (const r of rules) {
      if (r.ifPending === 'ignore') {
        const { data } = await supabase
          .from('todo_occurrences')
          .select('id')
          .eq('template_id', r.templateId)
          .eq('status', 'pending')
          .limit(1);
        if (data && data.length) continue;
      }
      await this.insertOccurrence(userId, r.templateId, triggerDay);
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
    onComplete: r.on_complete ?? undefined,
    triggerOnly: r.trigger_only ?? undefined,
    startDate: r.start_date ?? undefined,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
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
