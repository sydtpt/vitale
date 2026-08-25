import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import type { TodoOccurrence, TodoTemplate } from '@vitale/shared';
import { TodosStore } from '../data/todos.store';
import { TodoCardComponent } from '../components/todo-card.component';
import { TodoEditorComponent } from '../components/todo-editor.component';
import { HistoryViewComponent } from '../components/history-view.component';
import { SeriesViewComponent } from '../components/series-view.component';
import { describeRecurrence, isOverdue, isStarted, isVisibleNow, todoTimeStr } from '@vitale/shared';

interface Row { o: TodoOccurrence; t: TodoTemplate; }

type View = 'tasks' | 'history' | 'series';

@Component({
  selector: 'rt-tasks-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, TodoCardComponent, TodoEditorComponent, HistoryViewComponent, SeriesViewComponent],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
})
export class TasksPageComponent {
  protected readonly store = inject(TodosStore);
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<TodoTemplate | null>(null);
  protected readonly view = signal<View>('tasks');
  /** Dia lógico das tarefas (vira às 02h) — vem da store para acompanhar a virada. */
  private get today(): string { return this.store.day(); }

  protected toggleView(v: Exclude<View, 'tasks'>): void {
    this.view.update((cur) => (cur === v ? 'tasks' : v));
  }

  protected readonly pending = computed(() => {
    // isStarted: "a partir de" oculta a série inteira até o dia escolhido.
    const byId = new Map(this.store.templates().map((t) => [t.id, t]));
    return this.store.occurrences().filter((o) => {
      const t = byId.get(o.templateId);
      return o.status === 'pending' && t != null && isStarted(t, this.today);
    });
  });

  protected readonly overdueRows = computed(() => this.rows(this.pending().filter((o) => isOverdue(o, this.today))));
  protected readonly todayRows = computed(() =>
    this.rows(
      this.pending().filter(
        (o) => !isOverdue(o, this.today) && (o.dueDate === null || o.dueDate <= this.today) && this.visible(o),
      ),
    ),
  );
  protected readonly upcomingRows = computed(() =>
    // startTime: a tarefa do dia ainda fora do horário aparece em "Em breve" até a hora.
    this.rows(
      this.pending().filter(
        (o) => (o.dueDate !== null && o.dueDate > this.today) || (o.dueDate === this.today && !this.visible(o)),
      ),
    ),
  );

  private visible(o: TodoOccurrence): boolean {
    const t = this.store.templateById(o.templateId);
    return !t || isVisibleNow(t, o, this.today, todoTimeStr());
  }

  protected readonly triggers = computed(() => {
    const ids = new Set(this.pending().map((o) => o.templateId));
    return this.store.templates().filter(
      (t) => ['event', 'stock', 'usage'].includes(t.recurrence.kind) && !ids.has(t.id),
    );
  });

  constructor() {
    void this.store.load();
  }

  private rows(list: TodoOccurrence[]): Row[] {
    return list
      .map((o) => ({ o, t: this.store.templateById(o.templateId) }))
      .filter((r): r is Row => !!r.t);
  }

  protected openNew(): void {
    this.editing.set(null);
    this.editorOpen.set(true);
  }
  protected openEdit(t: TodoTemplate): void {
    this.editing.set(t);
    this.editorOpen.set(true);
  }

  protected describe(t: TodoTemplate): string {
    return describeRecurrence(t.recurrence);
  }
  protected meterText(t: TodoTemplate): string {
    return t.recurrence.kind === 'usage' && t.meter != null ? ` · ${t.meter} ${t.recurrence.meterUnit}` : '';
  }

  /** Conclusão rica: tarefas de Finanças capturam o valor pago em meta (sem backend de Finanças ainda). */
  protected onDone(t: TodoTemplate, o: TodoOccurrence): void {
    if (t.module === 'financas') {
      const v = window.prompt(`${t.name} — valor pago (opcional)`, '');
      if (v != null && v.trim() !== '') {
        const n = Number(v.replace(',', '.'));
        if (Number.isFinite(n) && n > 0) {
          void this.store.resolve(o.id, 'done', { amount: n });
          return;
        }
      }
    }
    void this.store.resolve(o.id, 'done');
  }

  protected onUsage(t: TodoTemplate): void {
    if (t.recurrence.kind !== 'usage') return;
    const v = window.prompt(`Leitura atual (${t.recurrence.meterUnit})`, t.meter != null ? String(t.meter) : '');
    if (v == null) return;
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n)) void this.store.updateMeter(t.id, n);
  }
}
