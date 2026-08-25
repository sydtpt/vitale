import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { describeRecurrence, isOverdue, todoDayStr, SHOP_CATS, type ShopCat, type TodoOccurrence, type TodoTemplate } from '@vitale/shared';
import { TodosStore } from '../../tasks/data/todos.store';
import { ComprasEditorComponent } from '../components/compras-editor.component';

interface Row { o: TodoOccurrence; t: TodoTemplate; }

@Component({
  selector: 'rt-compras-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, ComprasEditorComponent],
  templateUrl: './compras-page.component.html',
  styleUrl: './compras-page.component.scss',
})
export class ComprasPageComponent {
  protected readonly store = inject(TodosStore);
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<TodoTemplate | null>(null);
  /** Dia lógico das tarefas (vira às 02h) — mesma virada da lista de tarefas. */
  private get today(): string { return this.store.day(); }

  protected readonly comprasTemplates = computed(() =>
    this.store.templates().filter((t) => t.module === 'compras'),
  );

  private readonly pending = computed(() => {
    const ids = new Set(this.comprasTemplates().map((t) => t.id));
    return this.store.occurrences().filter((o) => o.status === 'pending' && ids.has(o.templateId));
  });

  protected readonly doneToday = computed(() => {
    const ids = new Set(this.comprasTemplates().map((t) => t.id));
    return this.store.occurrences().filter(
      (o) => o.status === 'done' && o.doneAt != null &&
        todoDayStr(new Date(o.doneAt)) === this.today && ids.has(o.templateId),
    );
  });

  /** Agrupa pendentes por categoria (ordem de SHOP_CATS). */
  protected readonly grouped = computed(() => {
    const tplById = new Map(this.comprasTemplates().map((t) => [t.id, t]));
    const bycat = new Map<ShopCat | 'Outros', Row[]>();
    for (const o of this.pending()) {
      const t = tplById.get(o.templateId);
      if (!t) continue;
      const cat = (t.meta?.['cat'] as ShopCat | undefined) ?? 'Outros';
      if (!bycat.has(cat)) bycat.set(cat, []);
      bycat.get(cat)!.push({ o, t });
    }
    return SHOP_CATS
      .filter((c) => bycat.has(c))
      .map((c) => ({ cat: c, rows: bycat.get(c)! }));
  });

  protected readonly totalEstimate = computed(() =>
    this.pending().reduce((sum, o) => {
      const t = this.store.templateById(o.templateId);
      return sum + ((t?.meta?.['price'] as number | undefined) ?? 0);
    }, 0),
  );

  protected readonly empty = computed(
    () => this.pending().length === 0 && this.doneToday().length === 0,
  );

  constructor() {
    void this.store.load();
  }

  protected openNew(): void {
    this.editing.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(t: TodoTemplate): void {
    this.editing.set(t);
    this.editorOpen.set(true);
  }

  protected onDone(o: TodoOccurrence): void {
    void this.store.resolve(o.id, 'done');
  }

  protected onSkip(o: TodoOccurrence): void {
    void this.store.skip(o.id);
  }

  protected metaQty(t: TodoTemplate): string {
    return (t.meta?.['qty'] as string | undefined) ?? '';
  }

  protected metaCat(t: TodoTemplate): string {
    return (t.meta?.['cat'] as string | undefined) ?? 'Outros';
  }

  protected metaPrice(t: TodoTemplate): string {
    const p = t.meta?.['price'] as number | undefined;
    return p != null ? `R$ ${p.toFixed(2).replace('.', ',')}` : '';
  }

  protected recLabel(t: TodoTemplate): string {
    return describeRecurrence(t.recurrence);
  }

  protected isOverdue(o: TodoOccurrence): boolean {
    return isOverdue(o, this.today);
  }

  protected templateById(id: string): TodoTemplate | undefined {
    return this.store.templateById(id);
  }
}
