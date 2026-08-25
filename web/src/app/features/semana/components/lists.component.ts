import { ChangeDetectionStrategy, Component, Input, computed, inject } from '@angular/core';
import { IconComponent } from '@core/services/icon.component';
import { FINANCAS, CASA_TAREFAS } from '@core/models/mock-data';
import { TodosStore } from '../../tasks/data/todos.store';
import { GoalsStore } from '../../metas/data/goals.store';
import { describeRecurrence, dueLabel, familyLabel, goalPct, goalValueText, isOverdue, todoDayStr } from '@vitale/shared';

const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Data ISO → 'dd mmm' em pt-BR (ex.: '08 mai'). */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_PT[d.getMonth()]}`;
}

interface RecurringVM {
  name: string;
  every: string;
  last: string;
  due: string;
  late: boolean;
}

@Component({
  selector: 'rt-spend-by-category',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './spend-by-category.component.html',
  styleUrl: './spend-by-category.component.scss',
})
export class SpendByCategoryComponent {
  protected readonly cats = FINANCAS.byCategory;
  private readonly total = this.cats.reduce((s, c) => s + c.amount, 0);
  percent(a: number) { return Math.round((a / this.total) * 100); }
}

@Component({
  selector: 'rt-recurring-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './recurring-list.component.html',
  styleUrl: './recurring-list.component.scss',
})
export class RecurringListComponent {
  private readonly store = inject(TodosStore);
  /** Dia lógico das tarefas (vira às 02h). */
  private readonly today = todoDayStr();

  constructor() {
    void this.store.load();
  }

  /** Compras recorrentes reais: templates `compras` com recorrência, próximo prazo + última compra. */
  protected readonly items = computed<RecurringVM[]>(() => {
    const templates = this.store
      .templates()
      .filter((t) => t.active && t.module === 'compras' && t.recurrence.kind !== 'none');
    const occ = this.store.occurrences();

    const rows = templates.map((t) => {
      const mine = occ.filter((o) => o.templateId === t.id);
      const pending = mine
        .filter((o) => o.status === 'pending' && o.dueDate != null)
        .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0];
      const lastDone = mine
        .filter((o) => o.status === 'done' && o.doneAt)
        .sort((a, b) => (a.doneAt! < b.doneAt! ? 1 : -1))[0];
      const late = pending ? isOverdue(pending, this.today) : false;
      return {
        name: t.name,
        every: describeRecurrence(t.recurrence),
        last: lastDone?.doneAt ? shortDate(lastDone.doneAt) : '—',
        due: late ? 'atrasado' : pending?.dueDate ? dueLabel(pending.dueDate, this.today) : '—',
        late,
        sortKey: pending?.dueDate ?? '9999',
      };
    });

    return rows
      .sort((a, b) => (a.late === b.late ? a.sortKey.localeCompare(b.sortKey) : a.late ? -1 : 1))
      .slice(0, 6)
      .map(({ sortKey, ...vm }) => vm);
  });
}

@Component({
  selector: 'rt-casa-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './casa-list.component.html',
  styleUrl: './casa-list.component.scss',
})
export class CasaListComponent {
  protected readonly items = CASA_TAREFAS;
}

interface MetaVM {
  name: string;
  cat: string;
  value: string;
  progress: number;
}

@Component({
  selector: 'rt-metas-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './metas-list.component.html',
  styleUrl: './metas-list.component.scss',
})
export class MetasListComponent {
  @Input() compact = false;
  private readonly store = inject(GoalsStore);

  constructor() {
    void this.store.load();
  }

  /** Metas ativas com progresso real, ordenadas pelas mais próximas do alvo. */
  protected readonly items = computed<MetaVM[]>(() => {
    const progress = this.store.progressById();
    return this.store
      .goals()
      .map((g) => {
        const p = progress.get(g.id);
        return {
          name: g.title,
          cat: familyLabel(g.family),
          value: p ? goalValueText(g, p) : '—',
          progress: p ? goalPct(p) : 0,
        };
      })
      .sort((a, b) => b.progress - a.progress);
  });
}
