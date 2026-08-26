/**
 * Paletas de gráfico — **camada de compatibilidade**.
 *
 * Este módulo já foi a casa das paletas. Desde a unificação, a paleta é uma só:
 * a escolhida em Aparência vale para o cromo do app **e** para as séries dos
 * gráficos, e mora em `theme/palettes.ts`. Um seletor separado só para gráfico
 * produzia a pergunta "por que a paleta que escolhi não mudou meu gráfico?".
 *
 * O que sobrou aqui é o vocabulário antigo, preservado para não obrigar os
 * consumidores a mudar de uma vez. Código novo deve usar `resolveTokens()` /
 * `moduleOf()` / `chartColor()`.
 *
 * A cor segue a ENTIDADE (tipo de atividade), nunca o ranking — a mesma
 * atividade tem a mesma cor em qualquer período. Isso não mudou.
 */

import {
  PALETTES,
  resolvePalette,
  type AppPalette,
  type PaletteRoles,
} from '../theme/palettes';
import { resolveTokens } from '../theme/derive';
import type { ColorScheme } from '../theme/themes';

export type { PaletteRoles };

/** Forma antiga de uma paleta. `AppPalette` a satisfaz estruturalmente. */
export interface ChartPalette {
  id: string;
  name: string;
  hint: string;
  roles: PaletteRoles;
}

/**
 * Cores-base do tema Orbe, que são as chaves do remap: um gráfico declara a cor
 * da série no vocabulário do Orbe e `remapChartColor` a traduz para a paleta
 * ativa. Manter o Orbe como língua franca evita ter de reescrever todos os
 * pontos que declaram cor de série.
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

/** @deprecated Use `PALETTES` de `theme/palettes.ts`. */
export const CHART_PALETTES: readonly AppPalette[] = PALETTES;

/** @deprecated Use `DEFAULT_PALETTE_ID`. */
export const DEFAULT_CHART_PALETTE_ID = 'orbe';

// Índice cor-base → papel, para lookup O(1) no remap.
const ROLE_OF_BASE: Record<string, keyof PaletteRoles> = {
  [BASE.orange]: 'orange', [BASE.blue]: 'blue', [BASE.green]: 'green', [BASE.yellow]: 'yellow',
  [BASE.rose]: 'rose', [BASE.brown]: 'brown', [BASE.deep]: 'deep', [BASE.ink]: 'ink',
};

/** @deprecated Use `isPaletteId`. Aceita os ids antigos por compatibilidade. */
export function isChartPaletteId(id: string): boolean {
  return resolvePalette(id).id === id || id in LEGACY;
}

const LEGACY: Record<string, true> = { vivido: true, artico: true };

/** @deprecated Use `resolvePalette`. */
export function getChartPalette(id: string): AppPalette {
  return resolvePalette(id);
}

/**
 * Traduz uma cor-base (hex no vocabulário do Orbe) para a paleta ativa. Cores
 * fora do mapa — a linha de referência, o cinza do "sem dado" — passam intactas.
 *
 * `theme` e `scheme` são opcionais e só importam quando o gráfico precisa da
 * cor já ajustada ao fundo em que vai desenhar; sem eles devolve o valor
 * declarado da paleta, que é o comportamento que este módulo sempre teve.
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

/** Amostra representativa para prévia (ordem: laranja, verde, azul, rosa, amarelo). */
export function paletteSwatch(p: ChartPalette): string[] {
  return [p.roles.orange, p.roles.green, p.roles.blue, p.roles.rose, p.roles.yellow];
}
