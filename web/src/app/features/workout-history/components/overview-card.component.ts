import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivitiesStore } from '../data/activities.store';
import { buildOverview, type Metric, type Period } from '../data/overview';
import { PeriodSelectorComponent } from './period-selector.component';
import { StackedBarChartComponent } from './stacked-bar-chart.component';
import { ChartPaletteService } from '@core/services/chart-palette.service';

@Component({
  selector: 'rt-overview-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PeriodSelectorComponent, StackedBarChartComponent],
  templateUrl: './overview-card.component.html',
  styleUrl: './overview-card.component.scss',
})
export class OverviewCardComponent {
  private readonly store = inject(ActivitiesStore);
  protected readonly palette = inject(ChartPaletteService);

  protected readonly period = signal<Period>('ano');
  protected readonly metric = signal<Metric>('count');
  /** Tipos ocultados via clique na legenda. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());

  /** Totais, barras e legenda já excluem os tipos ocultos (legenda mantém todos). */
  protected readonly overview = computed(() =>
    buildOverview(this.store.activities(), this.period(), this.metric(), new Date(), this.hidden()),
  );

  protected isHidden(label: string): boolean {
    return this.hidden().has(label);
  }

  protected toggleType(label: string): void {
    this.hidden.update((set) => {
      const next = new Set(set);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  protected readonly metrics: { value: Metric; label: string }[] = [
    { value: 'count', label: 'Atividades' },
    { value: 'duration', label: 'Duração' },
    { value: 'calories', label: 'Calorias' },
    { value: 'distance', label: 'Distância' },
  ];

  protected fmtDistance(m: number): string {
    return `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
  }

  protected fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }

  protected fmtCalories(c: number): string {
    return `${Math.round(c).toLocaleString('pt-BR')} kcal`;
  }
}
