import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { T } from '@vitale/shared';
import { ChartPaletteService } from '@core/services/chart-palette.service';

@Component({
  selector: 'rt-macros-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './macros-card.component.html',
  styleUrl: './macros-card.component.scss',
})
export class MacrosCardComponent {
  private readonly palette = inject(ChartPaletteService);

  private readonly C = 2 * Math.PI * 46;
  protected readonly kcalDash = `${0.927 * this.C} ${this.C}`;
  /** Cor do anel de kcal, traduzida para a paleta ativa. */
  protected readonly kcalColor = computed(() => this.palette.remap(T.primary));

  protected readonly macros = computed(() => [
    { label: 'Proteína',    cur: 132, goal: 140, unit: 'g', color: this.palette.remap(T.primary) },
    { label: 'Carboidrato', cur: 196, goal: 240, unit: 'g', color: this.palette.remap(T.yellow) },
    { label: 'Gordura',     cur: 62,  goal: 75,  unit: 'g', color: this.palette.remap(T.green) },
  ]);

  protected readonly dailySeries = [
    { d: 'Seg', kcal: 2120 }, { d: 'Ter', kcal: 1960 },
    { d: 'Qua', kcal: 2240 }, { d: 'Qui*', kcal: 1540 },
  ];
}
