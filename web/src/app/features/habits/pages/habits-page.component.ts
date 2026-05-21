import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { HabitsStore } from '../data/habits.store';
import { HabitAnalyticsCardComponent } from '../components/habit-analytics-card.component';

@Component({
  selector: 'rt-habits-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, HabitAnalyticsCardComponent],
  templateUrl: './habits-page.component.html',
  styleUrl: './habits-page.component.scss',
})
export class HabitsPageComponent {
  protected readonly store = inject(HabitsStore);
  protected readonly count = computed(() => this.store.habits().length);

  constructor() {
    void this.store.load();
  }
}
