import { Injectable, computed, inject } from '@angular/core';
import { remapChartColor } from '@vitale/shared';
import { ThemeService } from '@core/theme/theme.service';

/**
 * Cor das séries de gráfico, derivada da **paleta do app**.
 *
 * Antes era uma preferência à parte, guardada só no `localStorage` e com
 * seletor próprio em Ajustes — o que produzia a pergunta "por que a paleta que
 * escolhi não mudou meu gráfico?". Desde a unificação existe um eixo só, e este
 * serviço é a ponte: mantém a API `remap()` que os gráficos já usam, agora lendo
 * do tema.
 */
@Injectable({ providedIn: 'root' })
export class ChartPaletteService {
  private readonly theme = inject(ThemeService);

  readonly paletteId = computed(() => this.theme.paletteId());

  /**
   * Traduz uma cor-base (vocabulário do Orbe) para a paleta ativa, já ajustada
   * ao tema e ao esquema — uma série precisa se destacar do fundo em que
   * desenha, e o mesmo hex não serve para creme claro e preto.
   */
  remap(hex: string): string {
    return remapChartColor(hex, this.paletteId(), this.theme.themeId(), this.theme.scheme());
  }
}
