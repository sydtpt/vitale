import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { HEATMAP, TODAY_IDX, WEEK } from '@core/models/mock-data';
import { T } from '@rotina/shared';

@Component({
  selector: 'rt-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './heatmap.component.html',
  styleUrl: './heatmap.component.scss',
})
export class HeatmapComponent {
  @Input() compact = false;
  protected readonly week = WEEK;
  protected readonly todayIdx = TODAY_IDX;
  protected readonly rows = Object.entries(HEATMAP);
  protected get gridCols() { return '100px repeat(7, 1fr)'; }

  cellColor(v: number): string {
    if (v === 0) return T.surfaceMute;
    const op = [0.25, 0.45, 0.7, 1][v - 1] || 1;
    return `color-mix(in srgb, ${T.primary} ${op * 100}%, ${T.surfaceMute})`;
  }
}
