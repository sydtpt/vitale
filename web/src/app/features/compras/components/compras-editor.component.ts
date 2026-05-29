import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHOP_CATS, type ShopCat, type TodoRecurrence, type TodoOverduePolicy, type TodoCancelPolicy, type TodoTemplate } from '@vitale/shared';
import { TodosStore, type NewTodo } from '../../tasks/data/todos.store';

type Kind = Extract<TodoRecurrence['kind'], 'none' | 'monthly' | 'weekly' | 'yearly' | 'after_completion'>;

const KINDS: { key: Kind; label: string }[] = [
  { key: 'none', label: 'Avulso' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
  { key: 'after_completion', label: 'Após comprar' },
  { key: 'yearly', label: 'Anual' },
];

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

@Component({
  selector: 'rt-compras-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './compras-editor.component.html',
  styleUrl: './compras-editor.component.scss',
})
export class ComprasEditorComponent implements OnInit {
  private readonly store = inject(TodosStore);
  readonly template = input<TodoTemplate | null>(null);
  readonly close = output<void>();
  readonly saved = output<void>();

  protected readonly kinds = KINDS;
  protected readonly weekdays = WEEKDAYS;
  protected readonly shopCats: readonly ShopCat[] = SHOP_CATS;

  protected readonly saving = signal(false);
  protected name = '';
  protected kind: Kind = 'none';
  protected monthlyDay = 1;
  protected selectedDays: number[] = [];
  protected yearMonth = 1;
  protected yearDay = 1;
  protected intervalDays = 14;
  protected overdue: TodoOverduePolicy = 'carry';
  protected cancelPolicy: TodoCancelPolicy = 'manual';
  // Campos de compras
  protected qty = '';
  protected cat: ShopCat = 'Outros';
  protected price: number | null = null;

  ngOnInit(): void {
    const t = this.template();
    if (!t) return;
    this.name = t.name;
    const k = t.recurrence.kind;
    if (k === 'none' || k === 'monthly' || k === 'weekly' || k === 'yearly' || k === 'after_completion') {
      this.kind = k;
    }
    const r = t.recurrence;
    if (r.kind === 'monthly') this.monthlyDay = r.day;
    if (r.kind === 'weekly') this.selectedDays = [...r.weekdays];
    if (r.kind === 'yearly') { this.yearMonth = r.month; this.yearDay = r.day; }
    if (r.kind === 'after_completion') this.intervalDays = r.intervalDays;
    this.overdue = t.overdue;
    this.cancelPolicy = t.cancelPolicy;
    const m = t.meta ?? {};
    if (m['qty']) this.qty = String(m['qty']);
    if (m['cat']) this.cat = m['cat'] as ShopCat;
    if (m['price'] != null) this.price = Number(m['price']);
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
    }
  }

  protected valid(): boolean {
    return this.name.trim() !== '' && this.buildRecurrence() != null;
  }

  protected async onSave(): Promise<void> {
    const recurrence = this.buildRecurrence();
    if (!this.name.trim() || !recurrence || this.saving()) return;
    const meta: Record<string, unknown> = { cat: this.cat };
    if (this.qty.trim()) meta['qty'] = this.qty.trim();
    if (this.price != null && this.price > 0) meta['price'] = this.price;

    const t = this.template();
    this.saving.set(true);
    try {
      if (t) {
        await this.store.updateTemplate(t.id, {
          name: this.name.trim(),
          icon: 'cart-outline',
          color: 'compras',
          module: 'compras',
          recurrence,
          overdue: this.overdue,
          cancel_policy: this.cancelPolicy,
          meta,
        });
      } else {
        const value: NewTodo = {
          name: this.name.trim(),
          icon: 'cart-outline',
          color: 'compras',
          module: 'compras',
          recurrence,
          overdue: this.overdue,
          cancelPolicy: this.cancelPolicy,
          meta,
        };
        await this.store.createTemplate(value);
      }
      this.saved.emit();
    } catch (e) {
      console.error('Erro ao salvar item de compras:', e);
    } finally {
      this.saving.set(false);
    }
  }
}
