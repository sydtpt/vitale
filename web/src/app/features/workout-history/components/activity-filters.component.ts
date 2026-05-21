import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EMPTY_FILTERS, type ActivityFilters, type RouteFilter } from '../data/activity-list';

@Component({
  selector: 'rt-activity-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './activity-filters.component.html',
  styleUrl: './activity-filters.component.scss',
})
export class ActivityFiltersComponent {
  readonly filters = input.required<ActivityFilters>();
  readonly sources = input.required<string[]>();
  readonly showDistance = input(true);
  readonly filtersChange = output<ActivityFilters>();

  protected readonly hasActive = computed(() => {
    const f = this.filters();
    return !!(f.from || f.to || f.minDistanceKm != null || f.maxDistanceKm != null ||
      f.minDurationMin != null || f.maxDurationMin != null || f.source || (f.hasRoute && f.hasRoute !== 'all'));
  });

  private patch(p: Partial<ActivityFilters>): void {
    this.filtersChange.emit({ ...this.filters(), ...p });
  }

  private num(e: Event): number | undefined {
    const n = (e.target as HTMLInputElement).valueAsNumber;
    return Number.isNaN(n) ? undefined : n;
  }

  protected onFrom(e: Event): void { this.patch({ from: (e.target as HTMLInputElement).value || undefined }); }
  protected onTo(e: Event): void { this.patch({ to: (e.target as HTMLInputElement).value || undefined }); }
  protected onMinDist(e: Event): void { this.patch({ minDistanceKm: this.num(e) }); }
  protected onMaxDist(e: Event): void { this.patch({ maxDistanceKm: this.num(e) }); }
  protected onMinDur(e: Event): void { this.patch({ minDurationMin: this.num(e) }); }
  protected onMaxDur(e: Event): void { this.patch({ maxDurationMin: this.num(e) }); }
  protected onSource(e: Event): void { this.patch({ source: (e.target as HTMLSelectElement).value || undefined }); }
  protected onRoute(e: Event): void { this.patch({ hasRoute: (e.target as HTMLSelectElement).value as RouteFilter }); }
  protected clear(): void { this.filtersChange.emit({ ...EMPTY_FILTERS }); }
}
