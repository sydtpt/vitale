import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Period } from '../data/overview';

@Component({
  selector: 'rt-period-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './period-selector.component.html',
  styleUrl: './period-selector.component.scss',
})
export class PeriodSelectorComponent {
  readonly value = input.required<Period>();
  readonly select = output<Period>();

  protected readonly options: { value: Period; label: string }[] = [
    { value: 'semana', label: '7d' },
    { value: 'mes', label: '4s' },
    { value: 'meses12', label: '12 meses' },
    { value: 'ano', label: 'Ano' },
    { value: 'sempre', label: 'Sempre' },
  ];
}
