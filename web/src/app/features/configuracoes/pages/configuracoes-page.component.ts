import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CHART_PALETTES, type PaletteRoles } from '@core/models/chart-palettes';
import { ChartPaletteService } from '@core/services/chart-palette.service';

type Role = keyof PaletteRoles;

@Component({
  selector: 'rt-configuracoes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  templateUrl: './configuracoes-page.component.html',
  styleUrl: './configuracoes-page.component.scss',
})
export class ConfiguracoesPageComponent {
  protected readonly palette = inject(ChartPaletteService);
  protected readonly palettes = CHART_PALETTES;

  // Barras de exemplo (topo → base) para a prévia.
  protected readonly previewBars: { role: Role; h: number }[][] = [
    [{ role: 'green', h: 15 }, { role: 'orange', h: 24 }],
    [{ role: 'orange', h: 10 }, { role: 'blue', h: 31 }],
    [{ role: 'rose', h: 8 }, { role: 'blue', h: 12 }, { role: 'green', h: 20 }],
    [{ role: 'orange', h: 30 }],
    [{ role: 'yellow', h: 8 }, { role: 'green', h: 18 }, { role: 'blue', h: 17 }],
  ];

  protected color(roles: PaletteRoles, role: Role): string {
    return roles[role];
  }
}
