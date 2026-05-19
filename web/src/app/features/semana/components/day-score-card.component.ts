import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'rt-day-score-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-score-card.component.html',
  styleUrl: './day-score-card.component.scss',
})
export class DayScoreCardComponent {
  protected readonly rows = [
    { color: '#F25C2B', label: 'Movimento', sub: 'treino + caminhada', cur: '72%' },
    { color: '#F5B946', label: 'Nutrição',  sub: '3 de 5 refeições',  cur: '64%' },
    { color: '#6FA86A', label: 'Mente',     sub: '1 hábito hoje',     cur: '50%' },
  ];

  dash(val: number, r: number): string {
    const C = 2 * Math.PI * r;
    return `${(val / 100) * C} ${C}`;
  }
}
