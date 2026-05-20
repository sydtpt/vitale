import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@core/services/icon.component';
import { labelForSlug } from '@core/models/activity-types';
import { ActivitiesStore } from '../data/activities.store';
import {
  buildActivityList,
  EMPTY_FILTERS,
  type ActivityFilters,
  type SortDir,
  type SortKey,
} from '../data/activity-list';
import { fmtDuration, fmtKcal, fmtKm } from '../data/format';
import { ActivityFiltersComponent } from '../components/activity-filters.component';
import { ActivityItemComponent } from '../components/activity-item.component';

@Component({
  selector: 'rt-tipo-atividade-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, ActivityFiltersComponent, ActivityItemComponent],
  templateUrl: './tipo-atividade-page.component.html',
  styleUrl: './tipo-atividade-page.component.scss',
})
export class TipoAtividadePageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(ActivitiesStore);

  private readonly _slug = signal('');

  protected readonly filters = signal<ActivityFilters>({ ...EMPTY_FILTERS });
  protected readonly sort = signal<SortKey>('date');
  protected readonly dir = signal<SortDir>('desc');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly view = signal<'list' | 'cards'>('list');

  protected readonly label = computed(() => labelForSlug(this._slug()));
  protected readonly summary = computed(() =>
    this.store.typeSummaries().find((s) => s.slug === this._slug()),
  );
  protected readonly showDistance = computed(() => this.summary()?.hasDistance ?? true);

  protected readonly result = computed(() =>
    buildActivityList(this.store.activities(), this.label() ?? '', {
      filters: this.filters(),
      sort: this.sort(),
      dir: this.dir(),
      page: this.page(),
      pageSize: this.pageSize(),
    }),
  );

  protected readonly sortValue = computed(() => `${this.sort()}-${this.dir()}`);

  protected readonly fmtKm = fmtKm;
  protected readonly fmtDuration = fmtDuration;
  protected readonly fmtKcal = fmtKcal;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((pm) => {
      this._slug.set(pm.get('slug') ?? '');
      this.filters.set({ ...EMPTY_FILTERS });
      this.sort.set('date');
      this.dir.set('desc');
      this.page.set(1);
    });
    void this.store.load();
  }

  protected setFilters(f: ActivityFilters): void {
    this.filters.set(f);
    this.page.set(1);
  }

  protected onSort(e: Event): void {
    const [key, dir] = (e.target as HTMLSelectElement).value.split('-');
    this.sort.set(key as SortKey);
    this.dir.set(dir as SortDir);
    this.page.set(1);
  }
}
