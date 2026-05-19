import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { SpendByCategoryComponent } from '../../../features/semana/components/lists.component';
import { FINANCAS } from '@core/models/mock-data';

@Component({
  selector: 'rt-financas-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent, SpendByCategoryComponent],
  templateUrl: './financas-page.component.html',
  styleUrl: './financas-page.component.scss',
})
export class FinancasPageComponent {
  protected readonly recent = FINANCAS.recent;
  formatAmount(n: number) {
    return n < 0 ? `−R$ ${Math.abs(n).toFixed(2)}` : `R$ ${n.toFixed(2)}`;
  }
}
