import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ThemeService, type AppTheme } from '@core/theme/theme.service';
import {
  BRANDS,
  PALETTES,
  THEMES,
  resolveTokens,
  type BrandId,
  type ColorScheme,
  type PaletteId,
  type ThemeId,
} from '@vitale/shared';

/**
 * Aparência da web — os quatro eixos do sistema de temas.
 *
 * Era o seletor de "cores dos gráficos". Ele sumiu na unificação: a paleta do
 * app passou a valer também para as séries, e dois seletores produziam a
 * pergunta "por que a paleta que escolhi não mudou meu gráfico?".
 *
 * É também o único ponto em que a web **escreve** preferência. A convenção era
 * "quem edita é o mobile"; ela se abre aqui porque obrigar a pegar o celular
 * para escurecer o desktop é UX ruim.
 */
@Component({
  selector: 'rt-configuracoes-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent],
  templateUrl: './configuracoes-page.component.html',
  styleUrl: './configuracoes-page.component.scss',
})
export class ConfiguracoesPageComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly themes = THEMES;
  protected readonly palettes = PALETTES;
  protected readonly brands = BRANDS;

  protected readonly schemes: { id: AppTheme; label: string }[] = [
    { id: 'system', label: 'Sistema' },
    { id: 'light', label: 'Claro' },
    { id: 'dark', label: 'Escuro' },
  ];

  /** Papéis da prévia de paleta, na ordem em que aparecem na tela Semana. */
  protected readonly previewRoles = ['orange', 'yellow', 'blue', 'green', 'purple'] as const;

  /**
   * Resolve tokens de uma combinação hipotética — a prévia mostra o que aquele
   * cartão faria, não o que está ativo agora.
   */
  protected preview(themeId: ThemeId, paletteId?: PaletteId, brandId?: BrandId) {
    return resolveTokens(
      themeId,
      this.theme.scheme() as ColorScheme,
      paletteId ?? this.theme.paletteId(),
      brandId ?? this.theme.brandId(),
    );
  }

  protected roleAccent(paletteId: PaletteId, role: string): string {
    return this.preview(this.theme.themeId(), paletteId).roles[
      role as keyof ReturnType<typeof this.preview>['roles']
    ].accent;
  }

  protected setScheme(v: AppTheme): void {
    void this.theme.update({ theme: v });
  }
  protected setTheme(v: ThemeId): void {
    void this.theme.update({ themeId: v });
  }
  protected setPalette(v: PaletteId): void {
    void this.theme.update({ paletteId: v });
  }
  protected setBrand(v: BrandId): void {
    void this.theme.update({ brandId: v });
  }
}
