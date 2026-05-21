import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@core/services/icon.component';
import type { TypeSummary } from '../data/type-summary';

@Component({
  selector: 'rt-activity-type-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './activity-type-card.component.html',
  styleUrl: './activity-type-card.component.scss',
})
export class ActivityTypeCardComponent {
  readonly s = input.required<TypeSummary>();

  protected tint(color: string): string {
    return `color-mix(in srgb, ${color} 14%, white)`;
  }

  protected fmtKm(m: number): string {
    return (m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  }

  protected fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }

  protected fmtKcal(c: number): string {
    return `${Math.round(c).toLocaleString('pt-BR')} kcal`;
  }
}
