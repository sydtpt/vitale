/**
 * A janela em que se procura foto de uma atividade (ADR 0037).
 *
 * A folga é **assimétrica de propósito**, e foi escolhida pelo dono do app em
 * 06/09/2026: os dois lados têm causas diferentes. Antes da largada existe a
 * bicicleta encostada esperando o start; depois da chegada existe o café, já com
 * o relógio parado — e o café dura mais do que a espera. Daí 30 min antes e
 * 1 h depois.
 *
 * A janela é sempre mostrada ao usuário na folha de confirmação. Isso não é
 * enfeite: sem ela escrita, uma foto que entrou por causa da folga parece bug.
 */

/** Minutos de folga antes de `start_at`. */
export const PHOTO_WINDOW_BEFORE_MIN = 30;
/** Minutos de folga depois de `end_at`. */
export const PHOTO_WINDOW_AFTER_MIN = 60;

export interface PhotoWindowOptions {
  beforeMin?: number;
  afterMin?: number;
}

/** Janela de busca, em epoch ms — a forma que o `expo-media-library` consome. */
export interface PhotoWindow {
  fromMs: number;
  toMs: number;
}

/**
 * Janela de busca de mídia para uma atividade.
 *
 * Recebe epoch ms em vez do `Activity` inteiro para o módulo continuar sem
 * dependência de modelo — quem chama converte com `Date.parse`.
 *
 * Devolve `null` quando os instantes não formam um intervalo válido (NaN, ou
 * fim antes do início). Atividade sem `end_at` não tem janela: sem os dois
 * lados, "durante" não existe.
 */
export function photoWindow(
  startAtMs: number,
  endAtMs: number,
  opts: PhotoWindowOptions = {},
): PhotoWindow | null {
  if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs)) return null;
  if (endAtMs < startAtMs) return null;

  const before = opts.beforeMin ?? PHOTO_WINDOW_BEFORE_MIN;
  const after = opts.afterMin ?? PHOTO_WINDOW_AFTER_MIN;

  return {
    fromMs: startAtMs - before * 60_000,
    toMs: endAtMs + after * 60_000,
  };
}
