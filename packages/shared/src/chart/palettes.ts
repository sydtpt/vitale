/**
 * Tradução de cor de série de gráfico para a paleta ativa.
 *
 * Este módulo já foi a casa de um sistema de paletas próprio, com seletor
 * separado em Ajustes. Desde a unificação, a paleta é uma só — a escolhida em
 * Aparência vale para o cromo do app **e** para as séries — e mora em
 * `theme/palettes.ts`. Dois seletores produziam a pergunta "por que a paleta que
 * escolhi não mudou meu gráfico?".
 *
 * O que sobrou aqui é a ponte: um gráfico declara a cor da série no vocabulário
 * do Orbe, e `remapChartColor` a traduz. Manter o Orbe como língua franca evitou
 * reescrever todos os pontos que declaram cor de série.
 *
 * A cor segue a ENTIDADE (tipo de atividade), nunca o ranking — a mesma
 * atividade tem a mesma cor em qualquer período. Isso não mudou.
 */

import { resolvePalette, type PaletteRoles } from '../theme/palettes';
import { resolveTokens } from '../theme/derive';
import type { ColorScheme } from '../theme/themes';

/**
 * Cores-base do tema Orbe, que são as chaves do remap. Cor fora deste mapa — a
 * linha de referência, o cinza do "sem dado" — passa intacta, e é assim que
 * `reference-lines.ts` mantém as suas fora da paleta de propósito.
 */
const BASE = {
  orange: '#F25C2B',
  blue: '#6E8CC9',
  green: '#6FA86A',
  yellow: '#F5B946',
  rose: '#E26A8A',
  brown: '#B4825B',
  deep: '#D9491B',
  ink: '#1F1B16',
} as const;

// Índice cor-base → papel, para lookup O(1) no remap.
const ROLE_OF_BASE: Record<string, keyof PaletteRoles> = {
  [BASE.orange]: 'orange', [BASE.blue]: 'blue', [BASE.green]: 'green', [BASE.yellow]: 'yellow',
  [BASE.rose]: 'rose', [BASE.brown]: 'brown', [BASE.deep]: 'deep', [BASE.ink]: 'ink',
};

/**
 * Traduz uma cor-base (hex no vocabulário do Orbe) para a paleta ativa.
 *
 * `theme` e `scheme` são opcionais e só importam quando o gráfico precisa da cor
 * já ajustada ao fundo em que vai desenhar — a mesma cor de série não serve para
 * creme claro e para preto. Sem eles, devolve o valor declarado da paleta.
 */
export function remapChartColor(
  hex: string,
  paletteId: string,
  theme?: string,
  scheme?: ColorScheme,
): string {
  const role = ROLE_OF_BASE[hex];
  if (!role) return hex;
  if (theme != null && scheme != null) {
    return resolveTokens(theme, scheme, paletteId).roles[role].accent;
  }
  return resolvePalette(paletteId).roles[role];
}
