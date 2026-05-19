import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { HeatmapComponent } from '@shared/components/heatmap/heatmap.component';
import { BigStatComponent } from '../components/big-stat.component';
import { DayScoreCardComponent } from '../components/day-score-card.component';
import { LiftsChartComponent } from '../components/lifts-chart.component';
import { MacrosCardComponent } from '../components/macros-card.component';
import { SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent } from '../components/lists.component';
import { T } from '@rotina/shared';

@Component({
  selector: 'rt-semana-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent, PanelComponent, HeatmapComponent,
    BigStatComponent, DayScoreCardComponent, LiftsChartComponent, MacrosCardComponent,
    SpendByCategoryComponent, RecurringListComponent, CasaListComponent, MetasListComponent,
  ],
  templateUrl: './semana-page.component.html',
  styleUrl: './semana-page.component.scss',
})
export class SemanaPageComponent {
  protected readonly T = T;
}
