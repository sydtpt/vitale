import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PanelComponent } from '@shared/components/panel/panel.component';
import { CasaListComponent } from '../../semana/components/lists.component';

@Component({
  selector: 'rt-casa-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, PanelComponent, CasaListComponent],
  templateUrl: './casa-page.component.html',
  styleUrl: './casa-page.component.scss',
})
export class CasaPageComponent {}
