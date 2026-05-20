import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Period } from '../data/overview';

@Component({
  selector: 'rt-period-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="seg">
      @for (o of options; track o.value) {
        <button type="button" class="opt" [class.active]="o.value === value()"
          (click)="select.emit(o.value)">{{ o.label }}</button>
      }
    </div>
  `,
  styles: [`
    .seg {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--surface-mute);
      border-radius: 11px;
      border: 1px solid var(--line);
    }
    .opt {
      border: none;
      background: transparent;
      color: var(--ink-2);
      font-size: 12.5px;
      font-weight: 600;
      padding: 5px 14px;
      border-radius: 8px;
      transition: background 0.12s, color 0.12s;
    }
    .opt:hover { color: var(--ink); }
    .opt.active {
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-sm);
    }
  `],
})
export class PeriodSelectorComponent {
  readonly value = input.required<Period>();
  readonly select = output<Period>();

  protected readonly options: { value: Period; label: string }[] = [
    { value: 'semana', label: 'Semana' },
    { value: 'ano', label: 'Ano' },
    { value: 'sempre', label: 'Sempre' },
  ];
}
