import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { IconComponent } from '@core/services/icon.component';
import { ActivitiesStore } from '../data/activities.store';
import { OverviewCardComponent } from '../components/overview-card.component';
import { TipoCardComponent } from '../components/tipo-card.component';

@Component({
  selector: 'rt-historico-treinos-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, IconComponent, OverviewCardComponent, TipoCardComponent],
  templateUrl: './historico-treinos-page.component.html',
  styleUrl: './historico-treinos-page.component.scss',
})
export class HistoricoTreinosPageComponent {
  protected readonly store = inject(ActivitiesStore);

  protected readonly total = computed(() => this.store.activities().length);

  constructor() {
    void this.store.load();
  }
}
