import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';

@Component({
  selector: 'rt-alimentacao-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent],
  templateUrl: './alimentacao-page.component.html',
  styleUrl: './alimentacao-page.component.scss',
})
export class AlimentacaoPageComponent {}
