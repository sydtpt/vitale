import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MOD, HABIT_ICONS, type TodoTemplate, type TodoOccurrence } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { daysLate, isOverdue } from '../data/todo-logic';
import { describeRecurrence, dueLabel } from '../data/todo-format';

const HABIT_ICON_SET: ReadonlySet<string> = new Set(HABIT_ICONS);

/** Mapeia ícones legados de tarefa (nomes Ionicons) para o set do `rt-icon` do web. */
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
  templateUrl: './todo-card.component.html',
  styleUrl: './todo-card.component.scss',
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
    const name = this.template().icon;
    // Ícones canônicos (HABIT_ICONS) já são nomes do `rt-icon`; legados são Ionicons.
    return HABIT_ICON_SET.has(name) ? name : (ICON_MAP[name] ?? 'check');
  }
  protected subtitle(): string {
    const o = this.occurrence();
    if (this.overdue()) return `Atrasada há ${daysLate(o)}d`;
    return `${dueLabel(o.dueDate)} · ${describeRecurrence(this.template().recurrence)}`;
  }
}
