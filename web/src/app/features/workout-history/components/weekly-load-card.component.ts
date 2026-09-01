import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HR_ZONES } from '@vitale/shared';
import { ThemeService } from '@core/theme/theme.service';
import { ActivitiesStore } from '../data/activities.store';
import { buildWeeklyLoad } from '../data/weekly-load';
import { StackedBarChartComponent } from './stacked-bar-chart.component';

/** Quantas semanas a janela móvel exibe. */
const WEEKS = 8;

@Component({
  selector: 'rt-weekly-load-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StackedBarChartComponent],
  templateUrl: './weekly-load-card.component.html',
  styleUrl: './weekly-load-card.component.scss',
})
export class WeeklyLoadCardComponent {
  private readonly store = inject(ActivitiesStore);
  private readonly theme = inject(ThemeService);

  protected readonly load = computed(() => buildWeeklyLoad(this.store.activities(), WEEKS));

  /** true quando nenhuma semana da janela tem tempo em zona de FC. */
  protected readonly empty = computed(() => this.load().buckets.every((b) => b.total === 0));

  /**
   * Legenda das 5 zonas. Reativa e não estática: a cor sai do papel resolvido no
   * tema ativo, senão a legenda fica no Orbe claro enquanto as barras que ela
   * legenda seguem a paleta escolhida.
   */
  protected readonly zones = computed(() =>
    HR_ZONES.map((z) => ({ label: z.label, color: this.theme.tokens().roles[z.role].accent })),
  );

  protected readonly easyPct = computed(() => Math.round(this.load().polarization.easyPct));

  protected fmtDuration(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    if (h > 0) return min > 0 ? `${h}h ${min}m` : `${h}h`;
    return `${min}m`;
  }
}
