import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivitiesStore } from '@features/workout-history/data/activities.store';
import { buildWeeklyVolume, type VolumeMetric } from '@vitale/shared';

interface BarVM { week: string; value: number; x: number; y: number; w: number; h: number; cx: number; }
interface GridVM { v: number; y: number; }

/**
 * Gráfico de barras de volume semanal de uma atividade sincronizada.
 * Reutilizável: recebe o tipo (`activityId`), a métrica (`distance`→km /
 * `duration`→min), a unidade e a cor. Lê do `ActivitiesStore` e deriva tudo por
 * `computed()`. Substitui o antigo `RunsChartComponent` (mock).
 */
@Component({
  selector: 'rt-activity-volume-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="chart">
      @for (g of grid(); track g.v) {
        <g>
          <line [attr.x1]="padL" [attr.x2]="w - padR" [attr.y1]="g.y" [attr.y2]="g.y" stroke="#EFE6D8" stroke-dasharray="3 3"/>
          <text [attr.x]="padL - 6" [attr.y]="g.y + 3" text-anchor="end" font-size="10" font-family="Geist Mono, monospace" fill="#9C928A">{{ g.v }}{{ unit() }}</text>
        </g>
      }
      @for (b of bars(); track b.week) {
        <g>
          <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="6"
            [attr.fill]="color()" [attr.fill-opacity]="$index === bars().length - 1 ? 1 : 0.4"/>
          <text [attr.x]="b.cx" [attr.y]="h - 10" text-anchor="middle" font-size="10" fill="#9C928A">{{ b.week }}</text>
          @if (b.value > 0) {
            <text [attr.x]="b.cx" [attr.y]="b.y - 4" text-anchor="middle" font-size="10" font-family="Geist Mono, monospace" font-weight="600" fill="#1F1B16">{{ b.value }}</text>
          }
        </g>
      }
      @if (isEmpty()) {
        <text [attr.x]="w / 2" [attr.y]="h / 2" text-anchor="middle" font-size="12" fill="#9C928A">{{ emptyLabel() }}</text>
      }
    </svg>
  `,
  styles: [`.chart { width: 100%; height: 200px; }`],
})
export class ActivityVolumeChartComponent {
  private readonly activitiesStore = inject(ActivitiesStore);

  readonly activityId = input.required<number>();
  readonly metric = input.required<VolumeMetric>();
  readonly unit = input.required<string>();
  readonly color = input<string>('#F25C2B');
  readonly emptyLabel = input<string>('Sem dados sincronizados');

  protected readonly w = 360;
  protected readonly h = 200;
  protected readonly padL = 36;
  protected readonly padR = 12;
  protected readonly padT = 14;
  protected readonly padB = 26;

  constructor() {
    void this.activitiesStore.load();
  }

  private readonly weeks = computed(() =>
    buildWeeklyVolume(this.activitiesStore.activities(), this.activityId(), this.metric(), 6),
  );

  /** Escala do eixo Y: pelo menos 1 para não dividir por zero quando vazio. */
  private readonly max = computed(() => Math.max(1, ...this.weeks().map(r => r.value)));

  protected readonly isEmpty = computed(() => this.weeks().every(r => r.value === 0));

  protected readonly grid = computed<GridVM[]>(() => {
    const m = this.max();
    return [
      { v: 0, y: this.yFor(0, m) },
      { v: Math.round(m / 2), y: this.yFor(m / 2, m) },
      { v: Math.round(m), y: this.yFor(m, m) },
    ];
  });

  protected readonly bars = computed<BarVM[]>(() => {
    const weeks = this.weeks();
    const m = this.max();
    const bw = (this.w - this.padL - this.padR) / weeks.length;
    return weeks.map((r, i) => {
      const x = this.padL + i * bw + bw * 0.2;
      const width = bw * 0.6;
      const height = (r.value / m) * (this.h - this.padT - this.padB);
      const y = this.h - this.padB - height;
      return { week: r.label, value: r.value, x, y, w: width, h: height, cx: x + width / 2 };
    });
  });

  private yFor(v: number, max: number): number {
    return this.padT + (1 - v / max) * (this.h - this.padT - this.padB);
  }
}
