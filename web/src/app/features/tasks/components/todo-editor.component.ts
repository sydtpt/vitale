import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MOD, type TodoModule, type TodoRecurrence, type TodoOverduePolicy, type TodoCancelPolicy, type TodoTemplate } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';
import { TodosStore, type NewTodo } from '../data/todos.store';

type Kind = TodoRecurrence['kind'];

/** Tipos de treino oferecidos no gatilho on_workout (mesma ordem do mobile). */
const ACTIVITY_IDS = [37, 13, 52, 24, 46, 50, 57, 66, 63, 73, 11, 20, 35, 16, 44, 59, 82];

const MODULES: { key: TodoModule; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'casa', label: 'Casa' },
  { key: 'financas', label: 'Finanças' },
  { key: 'compras', label: 'Compras' },
  { key: 'saude', label: 'Saúde' },
];

const KINDS: { key: Kind; label: string }[] = [
  { key: 'none', label: 'Avulsa' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'yearly', label: 'Anual' },
  { key: 'after_completion', label: 'Após concluir' },
  { key: 'usage', label: 'Por uso' },
  { key: 'event', label: 'Por evento' },
  { key: 'stock', label: 'Por estoque' },
  { key: 'on_workout', label: 'Após treino' },
  { key: 'on_task', label: 'Após tarefa' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

@Component({
  selector: 'rt-todo-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './todo-editor.component.html',
  styleUrl: './todo-editor.component.scss',
})
export class TodoEditorComponent implements OnInit {
  private readonly store = inject(TodosStore);
  readonly template = input<TodoTemplate | null>(null);
  readonly close = output<void>();
  readonly saved = output<void>();

  protected readonly modules = MODULES;
  protected readonly kinds = KINDS;
  protected readonly weekdays = WEEKDAYS;
  protected readonly colors = [
    { key: 'tarefa', accent: MOD.tarefa.accent },
    { key: 'casa', accent: MOD.casa.accent },
    { key: 'financas', accent: MOD.financas.accent },
    { key: 'compras', accent: MOD.compras.accent },
    { key: 'habito', accent: MOD.habito.accent },
    { key: 'treino', accent: MOD.treino.accent },
  ];

  protected name = '';
  protected mod: TodoModule = 'geral';
  protected kind: Kind = 'none';
  protected monthlyDay = 1;
  protected selectedDays: number[] = [];
  protected yearMonth = 1;
  protected yearDay = 1;
  protected intervalDays = 15;
  protected meterUnit = 'km';
  protected every = 5000;
  protected eventLabel = '';
  protected stockRef = '';
  protected triggerActivityId: number | null = null;
  protected sourceTemplateId = '';
  protected dueInDays: number | null = null;
  protected overdue: TodoOverduePolicy = 'carry';
  protected cancelPolicy: TodoCancelPolicy = 'manual';
  protected color = 'tarefa';

  protected readonly activityOptions = ACTIVITY_IDS.map((id) => ({ id, label: metaForActivity(id).label }));

  /**
   * Séries que podem disparar um encadeamento: recorrentes ativas + avulsas ainda
   * pendentes. Exclui a própria, outros on_task, arquivadas e avulsas concluídas.
   */
  protected sourceOptions(): TodoTemplate[] {
    const selfId = this.template()?.id;
    const occ = this.store.occurrences();
    return this.store.templates().filter(
      (t) =>
        t.id !== selfId &&
        t.recurrence.kind !== 'on_task' &&
        (t.recurrence.kind !== 'none' ||
          occ.some((o) => o.templateId === t.id && o.status === 'pending')),
    );
  }

  ngOnInit(): void {
    const t = this.template();
    if (!t) return;
    this.name = t.name;
    this.mod = t.module;
    this.kind = t.recurrence.kind;
    const r = t.recurrence;
    if (r.kind === 'monthly') this.monthlyDay = r.day;
    if (r.kind === 'weekly') this.selectedDays = [...r.weekdays];
    if (r.kind === 'yearly') { this.yearMonth = r.month; this.yearDay = r.day; }
    if (r.kind === 'after_completion') this.intervalDays = r.intervalDays;
    if (r.kind === 'usage') { this.meterUnit = r.meterUnit; this.every = r.every; }
    if (r.kind === 'event') this.eventLabel = r.label;
    if (r.kind === 'stock') this.stockRef = r.shopItemRef ?? '';
    if (r.kind === 'on_workout') { this.triggerActivityId = r.activityId ?? null; this.dueInDays = r.dueInDays ?? null; }
    if (r.kind === 'on_task') { this.sourceTemplateId = r.sourceTemplateId; this.dueInDays = r.dueInDays ?? null; }
    this.overdue = t.overdue;
    this.cancelPolicy = t.cancelPolicy;
    this.color = t.color || 'tarefa';
  }

  protected toggleDay(d: number): void {
    this.selectedDays = this.selectedDays.includes(d)
      ? this.selectedDays.filter((x) => x !== d)
      : [...this.selectedDays, d];
  }

  protected setCancel(c: TodoCancelPolicy): void {
    this.cancelPolicy = c;
    if (c === 'auto') this.overdue = 'expire';
  }

  private buildRecurrence(): TodoRecurrence | null {
    switch (this.kind) {
      case 'none': return { kind: 'none' };
      case 'monthly': return this.monthlyDay >= 1 && this.monthlyDay <= 31 ? { kind: 'monthly', day: Number(this.monthlyDay) } : null;
      case 'weekly': return this.selectedDays.length ? { kind: 'weekly', weekdays: [...this.selectedDays].sort((a, b) => a - b) } : null;
      case 'yearly': return this.yearMonth >= 1 && this.yearMonth <= 12 && this.yearDay >= 1 && this.yearDay <= 31 ? { kind: 'yearly', month: Number(this.yearMonth), day: Number(this.yearDay) } : null;
      case 'after_completion': return this.intervalDays > 0 ? { kind: 'after_completion', intervalDays: Math.round(Number(this.intervalDays)) } : null;
      case 'usage': return this.meterUnit.trim() && this.every > 0 ? { kind: 'usage', meterUnit: this.meterUnit.trim(), every: Number(this.every) } : null;
      case 'event': return this.eventLabel.trim() ? { kind: 'event', label: this.eventLabel.trim() } : null;
      case 'stock': return { kind: 'stock', shopItemRef: this.stockRef.trim() || undefined };
      case 'on_workout': return { kind: 'on_workout', activityId: this.triggerActivityId ?? undefined, dueInDays: this.dueInDays ?? undefined };
      case 'on_task': return this.sourceTemplateId ? { kind: 'on_task', sourceTemplateId: this.sourceTemplateId, dueInDays: this.dueInDays ?? undefined } : null;
    }
  }

  protected valid(): boolean {
    return this.name.trim() !== '' && this.buildRecurrence() != null;
  }

  protected async onSave(): Promise<void> {
    const recurrence = this.buildRecurrence();
    if (!this.name.trim() || !recurrence) return;
    const t = this.template();
    if (t) {
      await this.store.updateTemplate(t.id, {
        name: this.name.trim(),
        color: this.color,
        module: this.mod,
        recurrence,
        overdue: this.overdue,
        cancel_policy: this.cancelPolicy,
      });
    } else {
      const value: NewTodo = {
        name: this.name.trim(),
        icon: 'checkbox-outline',
        color: this.color,
        module: this.mod,
        recurrence,
        overdue: this.overdue,
        cancelPolicy: this.cancelPolicy,
        meter: this.kind === 'usage' ? 0 : undefined,
      };
      await this.store.createTemplate(value);
    }
    this.saved.emit();
  }
}
