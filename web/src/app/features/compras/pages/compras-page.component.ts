import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { IconComponent } from '@core/services/icon.component';
import { RecurringListComponent } from '../../semana/components/lists.component';
import { HOJE } from '@core/models/mock-data';

@Component({
  selector: 'rt-compras-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent, IconComponent, RecurringListComponent],
  templateUrl: './compras-page.component.html',
  styleUrl: './compras-page.component.scss',
})
export class ComprasPageComponent {
  protected readonly compras = HOJE.compras;
}
