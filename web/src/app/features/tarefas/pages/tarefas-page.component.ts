import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import type { TodoOccurrence, TodoTemplate } from '@vitale/shared';
import { TodosStore } from '../data/todos.store';
import { localDateStr, isOverdue } from '../data/todo-logic';
import { describeRecurrence } from '../data/todo-format';
import { TodoCardComponent } from '../components/todo-card.component';
import { TodoEditorComponent } from '../components/todo-editor.component';
import { HistoryViewComponent } from '../components/history-view.component';

interface Row { o: TodoOccurrence; t: TodoTemplate; }

@Component({
  selector: 'rt-tarefas-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, TodoCardComponent, TodoEditorComponent, HistoryViewComponent],
  template: `
    <div class="page">
      <rt-page-header
        [eyebrow]="showHistory() ? 'Histórico' : 'Tarefas'"
        [title]="showHistory() ? 'Últimos 30 dias' : (pending().length + (pending().length === 1 ? ' pendente' : ' pendentes'))"
        [subtitle]="showHistory() ? '' : 'To-do e recorrências — atrasadas, do dia e em breve'"
      >
        @if (!showHistory()) {
          <button class="new" (click)="openNew()"><rt-icon name="plus" [size]="16" color="#fff" [strokeWidth]="2.2" /> Nova tarefa</button>
        }
        <button [class.active]="showHistory()" (click)="showHistory.set(!showHistory())" class="toggle" [title]="showHistory() ? 'Voltar para tarefas' : 'Ver histórico'">
          <rt-icon name="book" [size]="16" [color]="showHistory() ? '#fff' : 'var(--ink-2)'" [strokeWidth]="2" />
          <span class="label">{{ showHistory() ? 'Tarefas' : 'Histórico' }}</span>
        </button>
      </rt-page-header>

      @if (store.loading()) {
        <div class="state">Carregando tarefas…</div>
      } @else if (store.error()) {
        <div class="state error">Não foi possível carregar: {{ store.error() }}</div>
      } @else if (showHistory()) {
        <rt-history-view [occurrences]="store.historyOccurrences()" [templates]="store.templates()" />
      } @else if (store.isEmpty()) {
        <div class="empty">
          <h2 class="empty-title">Nenhuma tarefa ainda</h2>
          <p class="empty-text">Crie tarefas recorrentes (aluguel, lixo, faxina…) ou avulsas com o botão <strong>Nova tarefa</strong>.</p>
        </div>
      } @else {
        @if (overdueRows().length) {
          <h3 class="section">Atrasadas</h3>
          <div class="list">
            @for (r of overdueRows(); track r.o.id) {
              <rt-todo-card [template]="r.t" [occurrence]="r.o"
                (done)="onDone(r.t, r.o)" (skip)="store.skip(r.o.id)"
                (cancel)="store.cancel(r.o.id)" (edit)="openEdit(r.t)" />
            }
          </div>
        }
        @if (todayRows().length) {
          <h3 class="section">A fazer</h3>
          <div class="list">
            @for (r of todayRows(); track r.o.id) {
              <rt-todo-card [template]="r.t" [occurrence]="r.o"
                (done)="onDone(r.t, r.o)" (skip)="store.skip(r.o.id)"
                (cancel)="store.cancel(r.o.id)" (edit)="openEdit(r.t)" />
            }
          </div>
        }
        @if (upcomingRows().length) {
          <h3 class="section">Em breve</h3>
          <div class="list">
            @for (r of upcomingRows(); track r.o.id) {
              <rt-todo-card [template]="r.t" [occurrence]="r.o"
                (done)="onDone(r.t, r.o)" (skip)="store.skip(r.o.id)"
                (cancel)="store.cancel(r.o.id)" (edit)="openEdit(r.t)" />
            }
          </div>
        }
        @if (triggers().length) {
          <h3 class="section">Gatilhos manuais</h3>
          <div class="list">
            @for (t of triggers(); track t.id) {
              <div class="trigger">
                <div class="body">
                  <div class="name">{{ t.name }}</div>
                  <div class="sub">{{ describe(t) }}{{ meterText(t) }}</div>
                </div>
                @if (t.recurrence.kind === 'usage') {
                  <button class="ghost" (click)="onUsage(t)">Atualizar</button>
                } @else {
                  <button class="ghost" (click)="store.trigger(t.id)">Registrar</button>
                }
                <button class="ghost" (click)="openEdit(t)">Editar</button>
              </div>
            }
          </div>
        }
      }
    </div>

    @if (editorOpen()) {
      <rt-todo-editor [template]="editing()" (close)="editorOpen.set(false)" (saved)="editorOpen.set(false)" />
    }
  `,
  styles: [`
    .page { padding: 24px 32px 48px; max-width: 900px; }
    .new { display: inline-flex; align-items: center; gap: 6px; border: none; background: var(--primary); color: #fff; font-size: 13.5px; font-weight: 600; padding: 9px 16px; border-radius: 999px; cursor: pointer; }
    .toggle { border: 1px solid var(--line); background: var(--surface); padding: 8px 12px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; font-size: 13px; font-weight: 600; color: var(--ink-2); }
    .toggle.active { background: var(--primary); border-color: var(--primary); color: #fff; }
    .toggle .label { font-size: 12px; font-weight: 600; }
    .section { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-2); margin: 26px 0 10px; }
    .list { display: flex; flex-direction: column; gap: 8px; }
    .trigger { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; box-shadow: var(--shadow-card); }
    .trigger .body { flex: 1; min-width: 0; }
    .trigger .name { font-size: 14px; font-weight: 600; color: var(--ink); }
    .trigger .sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
    .ghost { border: none; background: var(--surface-mute); color: var(--ink-2); font-size: 12.5px; padding: 6px 12px; border-radius: 8px; cursor: pointer; }
    .ghost:hover { color: var(--ink); }
    .state { padding: 48px 0; text-align: center; font-size: 14px; color: var(--ink-2); }
    .state.error { color: var(--primary-deep); }
    .empty { max-width: 460px; margin: 80px auto 0; text-align: center; }
    .empty-title { font-size: 19px; font-weight: 650; color: var(--ink); margin-bottom: 10px; }
    .empty-text { font-size: 14px; line-height: 1.6; color: var(--ink-2); }
    .empty-text strong { color: var(--ink); font-weight: 600; }
  `],
})
export class TarefasPageComponent {
  protected readonly store = inject(TodosStore);
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<TodoTemplate | null>(null);
  protected readonly showHistory = signal(false);
  private readonly today = localDateStr();

  protected readonly pending = computed(() => {
    const ids = new Set(this.store.templates().map((t) => t.id));
    return this.store.occurrences().filter((o) => o.status === 'pending' && ids.has(o.templateId));
  });

  protected readonly overdueRows = computed(() => this.rows(this.pending().filter((o) => isOverdue(o, this.today))));
  protected readonly todayRows = computed(() =>
    this.rows(this.pending().filter((o) => !isOverdue(o, this.today) && (o.dueDate === null || o.dueDate <= this.today))),
  );
  protected readonly upcomingRows = computed(() =>
    this.rows(this.pending().filter((o) => o.dueDate !== null && o.dueDate > this.today)),
  );

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
