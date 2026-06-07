import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProfileService } from '@core/auth/profile.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HeatmapComponent } from '@shared/components/heatmap/heatmap.component';
import { BigStatComponent } from '../components/big-stat.component';
import { DayScoreCardComponent } from '../components/day-score-card.component';
import { WeeklyRecapCardComponent } from '../components/weekly-recap-card.component';
import { LiftsChartComponent } from '../components/lifts-chart.component';
import { MacrosCardComponent } from '../components/macros-card.component';
import { SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent } from '../components/lists.component';
import { T } from '@vitale/shared';

@Component({
  selector: 'rt-semana-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent, PanelComponent, HeatmapComponent,
    BigStatComponent, DayScoreCardComponent, WeeklyRecapCardComponent, LiftsChartComponent, MacrosCardComponent,
    SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent,
  ],
  templateUrl: './semana-page.component.html',
  styleUrl: './semana-page.component.scss',
})
export class SemanaPageComponent {
  protected readonly T = T;

  private readonly profile = inject(ProfileService);

  protected readonly greeting = computed(() => {
    const h = new Date().getHours();
    const period = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = this.profile.displayName().split(' ')[0];
    return `${period}, ${firstName}.`;
  });
}
