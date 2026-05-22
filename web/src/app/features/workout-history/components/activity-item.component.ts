import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Activity } from '@vitale/shared';
import { IconComponent } from '@core/services/icon.component';
import { metaForActivity } from '@core/models/activity-types';
import { filtersToQueryParams, type ActivityFilters } from '../data/activity-list';
import { fmtDate, fmtDuration, fmtKcal, fmtKm, fmtTime } from '../data/format';

@Component({
  selector: 'rt-activity-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './activity-item.component.html',
  styleUrl: './activity-item.component.scss',
})
export class ActivityItemComponent {
  readonly activity = input.required<Activity>();
  readonly mode = input.required<'list' | 'cards'>();
  readonly filters = input<ActivityFilters | undefined>();
  readonly sort = input<string | undefined>();
  readonly dir = input<string | undefined>();

  protected readonly meta = computed(() => metaForActivity(this.activity().activityId));
  protected readonly hasDistance = computed(() => (this.activity().distanceM ?? 0) > 0);
  /** Atividades com GPS (rota ou distância) exibem o tempo em movimento. */
  protected readonly isGps = computed(() => this.activity().hasRoute || (this.activity().distanceM ?? 0) > 0);
  /** Tempo do card: em movimento (GPS) ou duração total (demais). Cai para a duração em linhas antigas. */
  protected readonly timeS = computed(() => {
    const a = this.activity();
    return this.isGps() ? a.movingTimeS ?? a.durationS : a.durationS;
  });
  protected readonly navigationUrl = computed(() => {
    const baseUrl = ['/workout-history', this.meta().slug, this.activity().id];
    const params: Record<string, string> = this.filters() ? filtersToQueryParams(this.filters()!) : {};
    if (this.sort()) params['sort'] = this.sort()!;
    if (this.dir()) params['dir'] = this.dir()!;
    return { url: baseUrl, params };
  });

  protected readonly fmtDate = fmtDate;
  protected readonly fmtTime = fmtTime;
  protected readonly fmtKm = fmtKm;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtKcal = fmtKcal;
}
