import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { ActivitiesStore } from '../data/activities.store';
import { OverviewCardComponent } from '../components/overview-card.component';
import { ActivityTypeCardComponent } from '../components/activity-type-card.component';

@Component({
  selector: 'rt-workout-history-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, OverviewCardComponent, ActivityTypeCardComponent],
  templateUrl: './workout-history-page.component.html',
  styleUrl: './workout-history-page.component.scss',
})
export class WorkoutHistoryPageComponent {
  protected readonly store = inject(ActivitiesStore);

  protected readonly total = computed(() => this.store.activities().length);

  constructor() {
    void this.store.load();
  }
}
