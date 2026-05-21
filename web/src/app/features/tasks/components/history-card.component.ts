import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MOD, type TodoTemplate, type TodoOccurrence } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';

const ICON_MAP: Record<string, string> = {
  'checkbox-outline': 'check', home: 'home', 'cash-outline': 'wallet',
  'cart-outline': 'cart', 'trash-outline': 'broom', water: 'droplet',
  'call-outline': 'bell', 'medkit-outline': 'flag', 'car-outline': 'bike',
  'paw-outline': 'leaf', 'document-text-outline': 'book', 'calendar-outline': 'calendar',
};

const STATUS_LABELS: Record<string, string> = {
  done: 'Feita',
  skipped: 'Pulada',
  canceled: 'Cancelada',
  expired: 'Expirada',
};

@Component({
  selector: 'rt-history-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './history-card.component.html',
  styleUrl: './history-card.component.scss',
})
export class HistoryCardComponent {
  readonly template = input.required<TodoTemplate>();
  readonly occurrence = input.required<TodoOccurrence>();

  protected accent(): string {
    return (MOD as Record<string, { accent: string }>)[this.template().color]?.accent ?? MOD.tarefa.accent;
  }
  protected tint(): string {
    return `color-mix(in srgb, ${this.accent()} 14%, white)`;
  }
  protected icon(): string {
    return ICON_MAP[this.template().icon] ?? 'check';
  }
  protected date(): string {
    const o = this.occurrence();
    const d = o.doneAt ?? o.dueDate ?? o.createdAt;
    return d ? new Date(d).toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' }) : '—';
  }
  protected statusLabel(): string {
    return STATUS_LABELS[this.occurrence().status] ?? this.occurrence().status;
  }
  protected module(): string {
    const mod = this.template().module;
    return mod.charAt(0).toUpperCase() + mod.slice(1);
  }
}
