import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MOD, type TodoTemplate, type TodoOccurrence } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { daysLate, isOverdue } from '../data/todo-logic';
import { describeRecurrence, dueLabel } from '../data/todo-format';

/** Mapeia o ícone do mobile (Ionicons) para o set do `rt-icon` do web. */
const ICON_MAP: Record<string, string> = {
  'checkbox-outline': 'check', home: 'home', 'cash-outline': 'wallet',
  'cart-outline': 'cart', 'trash-outline': 'broom', water: 'droplet',
  'call-outline': 'bell', 'medkit-outline': 'flag', 'car-outline': 'bike',
  'paw-outline': 'leaf', 'document-text-outline': 'book', 'calendar-outline': 'calendar',
};

@Component({
  selector: 'rt-todo-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="card" [class.overdue]="overdue()">
      <button class="check" [style.border-color]="accent()" (click)="done.emit()" title="Concluir">
        <rt-icon name="check" [size]="18" [color]="accent()" [strokeWidth]="2.4" />
      </button>

      <span class="ico" [style.background]="tint()">
        <rt-icon [name]="icon()" [size]="16" [color]="accent()" [strokeWidth]="1.9" />
      </span>

      <div class="body">
        <div class="name">{{ template().name }}</div>
        <div class="sub" [class.late]="overdue()">{{ subtitle() }}</div>
      </div>

      <div class="actions">
        <button class="ghost" (click)="skip.emit()" title="Pular esta">Pular</button>
        <button class="ghost" (click)="cancel.emit()" title="Cancelar">Cancelar</button>
        <button class="ghost" (click)="edit.emit()" title="Editar série">Editar</button>
      </div>
    </div>
  `,
  styles: [`
    .card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 14px; padding: 10px 14px; box-shadow: var(--shadow-card);
    }
    .card.overdue { border-color: var(--primary-deep); }
    .check {
      width: 34px; height: 34px; border-radius: 50%; border: 2px solid;
      display: flex; align-items: center; justify-content: center; flex: 0 0 auto;
      background: transparent; cursor: pointer; opacity: 0.65; transition: opacity 0.15s;
    }
    .check:hover { opacity: 1; }
    .ico {
      width: 30px; height: 30px; border-radius: 9px; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
    }
    .body { flex: 1; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; color: var(--ink); }
    .sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
    .sub.late { color: var(--primary-deep); font-weight: 600; }
    .actions { display: flex; gap: 4px; flex: 0 0 auto; }
    .ghost {
      border: none; background: transparent; color: var(--ink-3);
      font-size: 12px; padding: 5px 8px; border-radius: 8px; cursor: pointer;
    }
    .ghost:hover { background: var(--surface-mute); color: var(--ink); }
  `],
})
export class TodoCardComponent {
  readonly template = input.required<TodoTemplate>();
  readonly occurrence = input.required<TodoOccurrence>();

  readonly done = output<void>();
  readonly skip = output<void>();
  readonly cancel = output<void>();
  readonly edit = output<void>();

  protected readonly overdue = computed(() => isOverdue(this.occurrence()));

  protected accent(): string {
    return (MOD as Record<string, { accent: string }>)[this.template().color]?.accent ?? MOD.tarefa.accent;
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, white)`;
  }
  protected icon(): string {
    return ICON_MAP[this.template().icon] ?? 'check';
  }
  protected subtitle(): string {
    const o = this.occurrence();
    if (this.overdue()) return `Atrasada há ${daysLate(o)}d`;
    return `${dueLabel(o.dueDate)} · ${describeRecurrence(this.template().recurrence)}`;
  }
}
