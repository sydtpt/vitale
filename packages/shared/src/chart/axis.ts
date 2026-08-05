/**
 * Escala e rótulos do eixo Y (web + mobile).
 *
 * O topo do eixo era o próprio valor máximo: a barra mais alta encostava na borda
 * do plot e os rótulos caíam em frações do máximo (`17.426 / 4` = "4.357"). Aqui o
 * topo sobe até um múltiplo redondo do passo, o que dá folga acima da maior barra e
 * rende rótulos legíveis (0 · 5k · 10k · 15k · 20k).
 */

/** Passos "redondos" aceitos, por década. */
const STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Folga mínima acima da maior barra — sem ela a barra encosta no topo do plot. */
const HEADROOM = 1.05;

/** Menor passo redondo >= x. */
function niceStep(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const mag = 10 ** Math.floor(Math.log10(x));
  const n = x / mag;
  return (STEPS.find((c) => n <= c + 1e-9) ?? 10) * mag;
}

export interface NiceAxisOptions {
  /**
   * Unidade de exibição em unidades-base: o passo é escolhido no que o usuário lê.
   * Duração vive em segundos mas é lida em horas (3600), distância em metros lida
   * em km (1000) — arredondar em segundos daria "8,33h" no rótulo.
   */
  unit?: number;
  /** Divisões do eixo (nº de linhas de grade menos a do zero). */
  ticks?: number;
  /** Métricas inteiras (contagem, kcal) não podem ter passo fracionário. */
  integer?: boolean;
}

/**
 * Topo do eixo: sempre `ticks` passos redondos e estritamente acima de `rawMax`,
 * então cada linha de grade cai num valor redondo e a maior barra nunca encosta.
 */
export function niceAxisMax(rawMax: number, options: NiceAxisOptions = {}): number {
  const { unit = 1, ticks = 4, integer = false } = options;
  const value = Math.max(0, rawMax) / unit;
  let step = niceStep((value * HEADROOM) / ticks);
  if (integer) step = Math.max(1, Math.ceil(step));
  return step * ticks * unit;
}

/**
 * Número curto para eixo e rótulo de barra: `17426` vira "17k", `2500` vira "2,5k".
 * Uma casa decimal só até 10× a escala — acima disso ela não informa nada e só
 * rouba largura do eixo.
 */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  const [scale, suffix] = abs >= 1e6 ? [1e6, 'M'] : [1000, 'k'];
  const digits = abs >= scale * 10 ? 0 : 1;
  return `${(value / scale).toFixed(digits).replace(/\.0$/, '').replace('.', ',')}${suffix}`;
}
