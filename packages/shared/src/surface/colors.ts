/**
 * Piso das rotas — a rampa de cor (decisão da mesa, 05/09/2026).
 *
 * Piso é uma ESCADA, do liso ao áspero — ordinal, não categórico. Por isso não
 * ganha quatro cores novas nem papel cromático novo: é uma rampa de UM tom só,
 * derivada do acento do módulo em OKLab, e "não especificado" é neutro (não é
 * um degrau da escada — é a ausência dela). Zero hex autorado aqui: tudo sai de
 * `mix()` sobre tokens que já existem, então responde a paleta, tema e esquema.
 *
 * Os quatro degraus foram validados (validator do dataviz, modo ordinal) nos
 * dois esquemas: monotonia de luminância, gaps ≥ 0,06 e o degrau claro com
 * contraste ≥ 2:1 sobre a superfície.
 */
import { mix } from '../theme/color';

export interface SurfaceRamp {
  liso: string;
  blocos: string;
  cascalho: string;
  terra: string;
  desconhecido: string;
}

/**
 * @param accent  acento do papel do módulo (treino → orange)
 * @param surface superfície do card no esquema ativo
 * @param ink     tinta principal no esquema ativo
 * @param neutral cor neutra para o "não especificado" (ex.: `line`/`ink4`)
 */
export function surfaceRamp(
  scheme: 'light' | 'dark',
  accent: string,
  surface: string,
  ink: string,
  neutral: string,
): SurfaceRamp {
  if (scheme === 'dark') {
    // No escuro a escada sobe em direção à tinta clara: o liso é o mais claro.
    return {
      liso: mix(accent, ink, 0.5),
      blocos: mix(accent, ink, 0.25),
      cascalho: accent,
      terra: mix(accent, surface, 0.4),
      desconhecido: neutral,
    };
  }
  return {
    liso: mix(accent, surface, 0.3),
    blocos: accent,
    cascalho: mix(accent, ink, 0.3),
    terra: mix(accent, ink, 0.55),
    desconhecido: neutral,
  };
}
