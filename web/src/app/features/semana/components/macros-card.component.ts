import { ChangeDetectionStrategy, Component } from '@angular/core';
import { T } from '@rotina/shared';

@Component({
  selector: 'rt-macros-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './macros-card.component.html',
  styleUrl: './macros-card.component.scss',
})
export class MacrosCardComponent {
  private readonly C = 2 * Math.PI * 46;
  protected readonly kcalDash = `${0.927 * this.C} ${this.C}`;

  protected readonly macros = [
    { label: 'Proteína',    cur: 132, goal: 140, unit: 'g', color: T.primary },
    { label: 'Carboidrato', cur: 196, goal: 240, unit: 'g', color: T.yellow },
    { label: 'Gordura',     cur: 62,  goal: 75,  unit: 'g', color: T.green },
  ];

  protected readonly dailySeries = [
    { d: 'Seg', kcal: 2120 }, { d: 'Ter', kcal: 1960 },
    { d: 'Qua', kcal: 2240 }, { d: 'Qui*', kcal: 1540 },
  ];
}
