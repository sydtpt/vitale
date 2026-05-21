import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface HeatCell {
  date: string;
  color: string;
  title: string;
}

/**
 * Heatmap estilo GitHub: blocos de 7 dias como colunas. Componente burro —
 * recebe células já coloridas (a semântica por direção vive no card).
 */
@Component({
  selector: 'rt-habit-heatmap',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="width()" [attr.height]="height" role="img">
      @for (c of cells(); track c.date; let i = $index) {
        <rect
          [attr.x]="col(i) * step"
          [attr.y]="row(i) * step"
          [attr.width]="cell"
          [attr.height]="cell"
          rx="2.5"
          [attr.fill]="c.color"
        >
          <title>{{ c.title }}</title>
        </rect>
      }
    </svg>
  `,
  styles: [`:host { display: block; } svg { display: block; }`],
})
export class HabitHeatmapComponent {
  readonly cells = input.required<HeatCell[]>();

  protected readonly cell = 12;
  protected readonly gap = 3;
  protected readonly rows = 7;
  protected get step(): number {
    return this.cell + this.gap;
  }
  protected readonly height = this.rows * (this.cell + this.gap) - this.gap;

  protected readonly width = computed(() =>
    Math.max(1, Math.ceil(this.cells().length / this.rows)) * this.step - this.gap,
  );

  protected col(i: number): number {
    return Math.floor(i / this.rows);
  }
  protected row(i: number): number {
    return i % this.rows;
  }
}
