import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  readinessInputsByDay,
  readinessSeries,
  activityDays,
  weeklyLoadVsRecovery,
  wellnessSummary,
  sportHealthCorrelations,
  buildPeriodRecap,
} from '@vitale/shared';
import { HealthStore } from '@features/saude/data/health.store';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { LoadRecoveryCardComponent } from '../components/load-recovery-card.component';
import { WellnessIndexCardComponent } from '../components/wellness-index-card.component';
import { ReadinessTrendCardComponent } from '../components/readiness-trend-card.component';
import { SportHealthInsightsCardComponent } from '../components/sport-health-insights-card.component';
import { PeriodRecapCardComponent } from '../components/period-recap-card.component';

@Component({
  selector: 'rt-recuperacao-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    LoadRecoveryCardComponent,
    WellnessIndexCardComponent,
    ReadinessTrendCardComponent,
    SportHealthInsightsCardComponent,
    PeriodRecapCardComponent,
  ],
  templateUrl: './recuperacao-page.component.html',
  styleUrl: './recuperacao-page.component.scss',
})
export class RecuperacaoPageComponent {
  private readonly health = inject(HealthStore);
  private readonly activitiesStore = inject(ActivitiesStore);

  protected readonly loading = computed(() => this.health.loading() || this.activitiesStore.loading());

  constructor() {
    void this.health.load();
    void this.activitiesStore.load();
  }

  private readonly activities = computed(() => this.activitiesStore.activities());

  private readonly inputsByDay = computed(() =>
    readinessInputsByDay({
      sono: this.health.seriesFor('sono'),
      fcRepouso: this.health.seriesFor('fcRepouso'),
      vfc: this.health.seriesFor('vfc'),
      aneis: this.health.seriesFor('aneis'),
    }),
  );

  private readonly actDays = computed(() => activityDays(this.activities()));

  protected readonly series30 = computed(() => readinessSeries(this.inputsByDay(), this.actDays(), 30));
  protected readonly series90 = computed(() => readinessSeries(this.inputsByDay(), this.actDays(), 90));

  /** Mapa data→score (últimos ~60 dias) para a junção semanal. */
  private readonly readinessByDay = computed(() => {
    const map = new Map<string, number>();
    for (const p of readinessSeries(this.inputsByDay(), this.actDays(), 63)) {
      if (p.score != null) map.set(p.date, p.score);
    }
    return map;
  });

  protected readonly loadRecovery = computed(() =>
    weeklyLoadVsRecovery(this.activities(), this.readinessByDay(), 8),
  );

  protected readonly monthRecap = computed(() =>
    buildPeriodRecap(this.activities(), this.readinessByDay(), 30),
  );

  protected readonly wellness = computed(() => wellnessSummary(this.inputsByDay(), this.activities()));

  protected readonly insights = computed(() =>
    sportHealthCorrelations(this.activities(), {
      vfc: this.health.valuesByDay('vfc'),
      fcRepouso: this.health.valuesByDay('fcRepouso'),
      sono: this.health.valuesByDay('sono'),
    }),
  );
}
