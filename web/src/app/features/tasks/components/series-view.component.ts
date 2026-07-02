import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MOD, HABIT_ICONS, type TodoTemplate } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { describeRecurrence } from '../data/todo-format';
import { TodosStore } from '../data/todos.store';

const HABIT_ICON_SET: ReadonlySet<string> = new Set(HABIT_ICONS);

/** Mapeia ícones legados de tarefa (nomes Ionicons) para o set do `rt-icon` do web. */
const ICON_MAP: Record<string, string> = {
  'checkbox-outline': 'check', home: 'home', 'cash-outline': 'wallet',
  'cart-outline': 'cart', 'trash-outline': 'broom', water: 'droplet',
  'call-outline': 'bell', 'medkit-outline': 'flag', 'car-outline': 'bike',
  'paw-outline': 'leaf', 'document-text-outline': 'book', 'calendar-outline': 'calendar',
};

/**
 * Lista as séries recorrentes (recurrence.kind !== 'none') para gerência: editar,
 * arquivar/reativar. Ocorrências avulsas ficam de fora — só o que se repete.
 */
@Component({
  selector: 'rt-series-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './series-view.component.html',
  styleUrl: './series-view.component.scss',
})
export class SeriesViewComponent {
  private readonly store = inject(TodosStore);
  readonly templates = input.required<TodoTemplate[]>();
  readonly edit = output<TodoTemplate>();

  private readonly recurring = computed(() =>
    // Exclui avulsas e séries de treino (on_workout) — estas nascem de atividades físicas.
    this.templates().filter((t) => t.recurrence.kind !== 'none' && t.recurrence.kind !== 'on_workout'),
  );
  protected readonly active = computed(() => this.recurring().filter((t) => t.active));
  protected readonly archived = computed(() => this.recurring().filter((t) => !t.active));

  protected accent(t: TodoTemplate): string {
    return (MOD as Record<string, { accent: string }>)[t.color]?.accent ?? MOD.tarefa.accent;
  }
  protected tint(t: TodoTemplate): string {
    return `color-mix(in srgb, ${this.accent(t)} 14%, white)`;
  }
  protected icon(t: TodoTemplate): string {
    return HABIT_ICON_SET.has(t.icon) ? t.icon : (ICON_MAP[t.icon] ?? 'check');
  }
  protected describe(t: TodoTemplate): string {
    return describeRecurrence(t.recurrence);
  }

  protected archive(t: TodoTemplate, active: boolean): void {
    void this.store.archiveTemplate(t.id, active);
  }
}
