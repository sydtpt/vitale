import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MOD, HABIT_ICONS, type TodoModule, type TodoRecurrence, type TodoOverduePolicy, type TodoCancelPolicy, type TodoSpawnRule, type TodoTemplate } from '@vitale/shared';
import { metaForActivity } from '@core/models/activity-types';
import { IconComponent } from '@core/services/icon.component';
import { isValidTime } from '../data/todo-logic';
import { TodosStore, type NewTodo } from '../data/todos.store';

/** Ícone padrão de uma nova tarefa (nome canônico de HABIT_ICONS). */
const DEFAULT_TODO_ICON = 'flag';

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
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

@Component({
  selector: 'rt-todo-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
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
  protected readonly icons = HABIT_ICONS;
  protected readonly colors = [
    { key: 'tarefa', accent: MOD.tarefa.accent },
    { key: 'casa', accent: MOD.casa.accent },
    { key: 'financas', accent: MOD.financas.accent },
    { key: 'compras', accent: MOD.compras.accent },
    { key: 'habito', accent: MOD.habito.accent },
    { key: 'treino', accent: MOD.treino.accent },
  ];

  protected readonly saving = signal(false);
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
  protected workoutOn = false;
  protected triggerActivityId: number | null = null;
  protected dueInDays: number | null = null;
  protected overdue: TodoOverduePolicy = 'carry';
  protected cancelPolicy: TodoCancelPolicy = 'manual';
  protected startTime = '';
  protected endTime = '';
  protected color = 'tarefa';
  protected icon = DEFAULT_TODO_ICON;
  protected spawn: TodoSpawnRule[] = [];
  protected triggerOnly = false;

  protected readonly activityOptions = ACTIVITY_IDS.map((id) => ({ id, label: metaForActivity(id).label }));

  /** Filhas elegíveis: outras séries ativas (exceto a própria). */
  protected spawnOptions(): TodoTemplate[] {
    const selfId = this.template()?.id;
    return this.store.templates().filter((t) => t.id !== selfId);
  }

  /** Pais que apontam para esta tarefa via onComplete (read-only). */
  protected parentsOf(): TodoTemplate[] {
    const selfId = this.template()?.id;
    if (!selfId) return [];
    return this.store.allTemplates().filter((t) =>
      (t.onComplete ?? []).some((r) => r.templateId === selfId),
    );
  }

  protected isSpawnActive(id: string): boolean {
    return this.spawn.some((s) => s.templateId === id);
  }

  protected spawnRule(id: string): TodoSpawnRule | undefined {
    return this.spawn.find((s) => s.templateId === id);
  }

  protected toggleSpawn(id: string): void {
    this.spawn = this.isSpawnActive(id)
      ? this.spawn.filter((s) => s.templateId !== id)
      : [...this.spawn, { templateId: id, ifPending: 'ignore' }];
  }

  protected toggleSpawnDuplicate(id: string): void {
    this.spawn = this.spawn.map((s) =>
      s.templateId === id
        ? { ...s, ifPending: s.ifPending === 'ignore' ? 'duplicate' : 'ignore' }
        : s,
    );
  }

  ngOnInit(): void {
    const t = this.template();
    if (!t) return;
    this.name = t.name;
    this.mod = t.module;
    const r = t.recurrence;
    // on_workout saiu das chips de Recorrência — vira o bloco "Criar/completar um treino".
    this.kind = r.kind === 'on_workout' ? 'none' : r.kind;
    if (r.kind === 'monthly') this.monthlyDay = r.day;
    if (r.kind === 'weekly') this.selectedDays = [...r.weekdays];
    if (r.kind === 'yearly') { this.yearMonth = r.month; this.yearDay = r.day; }
    if (r.kind === 'after_completion') this.intervalDays = r.intervalDays;
    if (r.kind === 'usage') { this.meterUnit = r.meterUnit; this.every = r.every; }
    if (r.kind === 'event') this.eventLabel = r.label;
    if (r.kind === 'stock') this.stockRef = r.shopItemRef ?? '';
    if (r.kind === 'on_workout') {
      this.triggerActivityId = r.activityId ?? null;
      this.dueInDays = r.dueInDays ?? null;
      this.workoutOn = true;
    }
    this.overdue = t.overdue;
    this.cancelPolicy = t.cancelPolicy;
    this.startTime = t.startTime ?? '';
    this.endTime = t.endTime ?? '';
    this.color = t.color || 'tarefa';
    this.icon = t.icon || DEFAULT_TODO_ICON;
    this.spawn = t.onComplete ? [...t.onComplete] : [];
    // on_workout implica nascer só por gatilho (normalização inócua para templates legados).
    this.triggerOnly = (t.triggerOnly ?? false) || r.kind === 'on_workout';
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
    // "Criar/completar um treino": o gatilho de treino vence o picker de Recorrência.
    if (this.triggerOnly && this.workoutOn) {
      return { kind: 'on_workout', activityId: this.triggerActivityId ?? undefined, dueInDays: this.dueInDays ?? undefined };
    }
    switch (this.kind) {
      case 'none': return { kind: 'none' };
      case 'monthly': return this.monthlyDay >= 1 && this.monthlyDay <= 31 ? { kind: 'monthly', day: Number(this.monthlyDay) } : null;
      case 'weekly': return this.selectedDays.length ? { kind: 'weekly', weekdays: [...this.selectedDays].sort((a, b) => a - b) } : null;
      case 'yearly': return this.yearMonth >= 1 && this.yearMonth <= 12 && this.yearDay >= 1 && this.yearDay <= 31 ? { kind: 'yearly', month: Number(this.yearMonth), day: Number(this.yearDay) } : null;
      case 'after_completion': return this.intervalDays > 0 ? { kind: 'after_completion', intervalDays: Math.round(Number(this.intervalDays)) } : null;
      case 'usage': return this.meterUnit.trim() && this.every > 0 ? { kind: 'usage', meterUnit: this.meterUnit.trim(), every: Number(this.every) } : null;
      case 'event': return this.eventLabel.trim() ? { kind: 'event', label: this.eventLabel.trim() } : null;
      case 'stock': return { kind: 'stock', shopItemRef: this.stockRef.trim() || undefined };
      // Inalcançável: on_workout só nasce pelo bloco de treino (guarda acima), nunca pelo picker.
      case 'on_workout': return null;
    }
  }

  /** Janela de horário só vale para recorrências com data (não triggerOnly). */
  protected get hasDateRecurrence(): boolean {
    return !this.triggerOnly && ['monthly', 'weekly', 'yearly', 'after_completion'].includes(this.kind);
  }

  private timesValid(): boolean {
    const s = this.startTime.trim();
    const e = this.endTime.trim();
    if (s !== '' && !isValidTime(s)) return false;
    if (e !== '' && !isValidTime(e)) return false;
    if (s !== '' && e !== '' && e <= s) return false;
    return true;
  }

  protected valid(): boolean {
    return this.name.trim() !== '' && this.buildRecurrence() != null && this.timesValid();
  }

  protected async onSave(): Promise<void> {
    const recurrence = this.buildRecurrence();
    if (!this.name.trim() || !recurrence || this.saving()) return;
    const t = this.template();
    const onComplete = this.spawn.length ? this.spawn : null;
    // Janela de horário só persiste em recorrências com data; limpa caso contrário.
    const startTime = this.hasDateRecurrence && this.startTime.trim() ? this.startTime.trim() : null;
    const endTime = this.hasDateRecurrence && this.endTime.trim() ? this.endTime.trim() : null;
    this.saving.set(true);
    try {
      if (t) {
        await this.store.updateTemplate(t.id, {
          name: this.name.trim(),
          icon: this.icon,
          color: this.color,
          module: this.mod,
          recurrence,
          overdue: this.overdue,
          cancel_policy: this.cancelPolicy,
          on_complete: onComplete,
          trigger_only: this.triggerOnly,
          start_time: startTime,
          end_time: endTime,
        });
      } else {
        const value: NewTodo = {
          name: this.name.trim(),
          icon: this.icon,
          color: this.color,
          module: this.mod,
          recurrence,
          overdue: this.overdue,
          cancelPolicy: this.cancelPolicy,
          meter: this.kind === 'usage' ? 0 : undefined,
          onComplete: onComplete ?? undefined,
          triggerOnly: this.triggerOnly,
          startTime,
          endTime,
        };
        await this.store.createTemplate(value);
      }
      this.saved.emit();
    } catch (e) {
      console.error('Erro ao salvar tarefa:', e);
    } finally {
      this.saving.set(false);
    }
  }
}
