import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { IconComponent } from '@core/services/icon.component';
import { LiftsChartComponent } from '../../../features/semana/components/lifts-chart.component';
import { RunsChartComponent } from '../../../features/semana/components/runs-chart.component';
import { TREINOS_SEMANA, TODAY_IDX } from '@core/models/mock-data';

@Component({
  selector: 'rt-treinos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent, LiftsChartComponent, RunsChartComponent, IconComponent],
  templateUrl: './treinos-page.component.html',
  styleUrl: './treinos-page.component.scss',
})
export class TreinosPageComponent {
  protected readonly treinos = TREINOS_SEMANA;
  protected readonly today = TODAY_IDX;
}
