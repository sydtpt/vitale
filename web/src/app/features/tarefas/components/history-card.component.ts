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
  template: `
    <div class="card">
      <span class="ico" [style.background]="tint()">
        <rt-icon [name]="icon()" [size]="16" [color]="accent()" [strokeWidth]="1.9" />
      </span>

      <div class="body">
        <div class="name">{{ template().name }}</div>
        <div class="sub">{{ date() }} · {{ module() }}</div>
      </div>

      <div class="status" [class]="occurrence().status">
        <span class="badge">{{ statusLabel() }}</span>
      </div>
    </div>
  `,
  styles: [`
    .card {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--line);
      border-radius: 14px; padding: 10px 14px; box-shadow: var(--shadow-card);
    }
    .ico {
      width: 30px; height: 30px; border-radius: 9px; flex: 0 0 auto;
      display: flex; align-items: center; justify-content: center;
    }
    .body { flex: 1; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; color: var(--ink); }
    .sub { font-size: 12px; color: var(--ink-3); margin-top: 1px; }
    .status { flex: 0 0 auto; }
    .badge {
      display: inline-block; font-size: 11px; font-weight: 600; padding: 4px 10px;
      border-radius: 12px; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .status.done .badge { background: #E8F5E9; color: #2E7D32; }
    .status.skipped .badge { background: #FFF3E0; color: #E65100; }
    .status.canceled .badge { background: #F5F5F5; color: #616161; }
    .status.expired .badge { background: #F5F5F5; color: #757575; }
  `],
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
