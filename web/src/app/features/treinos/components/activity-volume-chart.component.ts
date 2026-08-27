import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { VolumeChartComponent } from '@shared/components/volume-chart/volume-chart.component';
import { buildWeeklyVolume, type VolumeMetric } from '@vitale/shared';

/**
 * Volume semanal de **um `activityId`** sincronizado — o painel da página de
 * Treinos.
 *
 * Aqui mora só a ligação com a store; o desenho é do `rt-volume-chart`, que a
 * página de tipo do Histórico também usa. A separação existe porque as duas
 * telas escolhem as atividades de formas diferentes (id aqui, rótulo lá) e
 * concordam em tudo o mais — manter dois gráficos por causa disso seria repetir
 * a história das duas cópias do `StackedBarChart`.
 */
@Component({
  selector: 'rt-activity-volume-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VolumeChartComponent],
  template: `
    <rt-volume-chart [buckets]="weeks()" [unit]="unit()" [color]="color()"
      [emptyLabel]="emptyLabel()" />
  `,
})
export class ActivityVolumeChartComponent {
  private readonly activitiesStore = inject(ActivitiesStore);

  readonly activityId = input.required<number>();
  readonly metric = input.required<VolumeMetric>();
  readonly unit = input.required<string>();
  readonly color = input('var(--primary)');
  readonly emptyLabel = input('Sem dados sincronizados');

  constructor() {
    void this.activitiesStore.load();
  }

  protected readonly weeks = computed(() =>
    buildWeeklyVolume(this.activitiesStore.activities(), this.activityId(), this.metric(), 6),
  );
}
