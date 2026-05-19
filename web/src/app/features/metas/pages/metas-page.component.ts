import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { MetasListComponent } from '../../semana/components/lists.component';

@Component({
  selector: 'rt-metas-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent, MetasListComponent],
  templateUrl: './metas-page.component.html',
  styleUrl: './metas-page.component.scss',
})
export class MetasPageComponent {}
