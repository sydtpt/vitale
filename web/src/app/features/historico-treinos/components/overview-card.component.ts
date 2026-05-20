import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivitiesStore } from '../data/activities.store';
import { buildOverview, type Metric, type OverviewBucket, type Period } from '../data/overview';
import { PeriodSelectorComponent } from './period-selector.component';
import { StackedBarChartComponent } from './stacked-bar-chart.component';

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

  protected readonly period = signal<Period>('ano');
  protected readonly metric = signal<Metric>('count');
  /** Tipos ocultados via clique na legenda. */
  protected readonly hidden = signal<ReadonlySet<string>>(new Set());

  protected readonly overview = computed(() =>
    buildOverview(this.store.activities(), this.period(), this.metric()),
  );

  /** Buckets sem os tipos ocultos, com totais recalculados para o gráfico. */
  protected readonly chartBuckets = computed<OverviewBucket[]>(() => {
    const hidden = this.hidden();
    const buckets = this.overview().buckets;
    if (!hidden.size) return buckets;
    return buckets.map((b) => {
      const segments = b.segments.filter((s) => !hidden.has(s.label));
      const total = segments.reduce((sum, s) => sum + s.value, 0);
      return { ...b, segments, total };
    });
  });

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
    { value: 'distance', label: 'Distância' },
    { value: 'duration', label: 'Duração' },
    { value: 'calories', label: 'Calorias' },
    { value: 'count', label: 'Atividades' },
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
