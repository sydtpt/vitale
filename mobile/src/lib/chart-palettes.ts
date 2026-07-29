/**
 * Paletas de cor para os gráficos. Cada paleta remapeia as cores-base por tipo de
 * atividade (ACTIVITY_COLORS em workout-types) para um conjunto harmônico com a
 * paleta bege/creme do app. A cor segue a ENTIDADE (tipo de atividade), nunca o
 * ranking — a mesma atividade tem a mesma cor em qualquer período.
 *
 * O trio principal (laranja/verde/azul = Corrida/Yoga/Ciclismo) foi validado com o
 * script de dataviz sobre o fundo creme: banda de luminosidade, piso de chroma e
 * separação de visão normal (≥15). CVD na faixa de aviso (6–8) é aceitável porque o
 * gráfico traz legenda rotulada + tooltip como codificação secundária.
 */

// Cores-base atuais (workout-types ACTIVITY_COLORS) — chaves do remap.
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

export interface PaletteRoles {
  orange: string; blue: string; green: string; yellow: string;
  rose: string; brown: string; deep: string; ink: string;
}
export interface ChartPalette { id: string; name: string; hint: string; roles: PaletteRoles; }

export const CHART_PALETTES: ChartPalette[] = [
  {
    id: 'atual', name: 'Original', hint: 'A paleta original do app',
    roles: { orange: '#F25C2B', blue: '#6E8CC9', green: '#6FA86A', yellow: '#F5B946', rose: '#E26A8A', brown: '#B4825B', deep: '#D9491B', ink: '#1F1B16' },
  },
  {
    id: 'vivido', name: 'Vívido', hint: 'Cores limpas e vibrantes',
    roles: { orange: '#F35D2A', blue: '#2F7FD1', green: '#3EA05C', yellow: '#E0A22E', rose: '#E15C93', brown: '#A6714A', deep: '#D33E1C', ink: '#2A2620' },
  },
  {
    id: 'pordosol', name: 'Pôr do sol', hint: 'Tons quentes e ensolarados',
    roles: { orange: '#F0602E', blue: '#3E86C4', green: '#4E9E55', yellow: '#E7A93C', rose: '#E36C8C', brown: '#B07A4E', deep: '#D2461E', ink: '#2E2822' },
  },
  {
    id: 'bosque', name: 'Bosque', hint: 'Verdes e azuis equilibrados',
    roles: { orange: '#E2622F', blue: '#3C6FBF', green: '#3F9E63', yellow: '#DDA033', rose: '#CE6E86', brown: '#997A54', deep: '#C24A2C', ink: '#2B2A24' },
  },
  {
    id: 'coral', name: 'Coral & índigo', hint: 'Frio e elegante',
    roles: { orange: '#EF6B4A', blue: '#4258A8', green: '#3E9E6E', yellow: '#E2A64A', rose: '#E081A0', brown: '#A98663', deep: '#D9553A', ink: '#2A2A30' },
  },
  {
    id: 'ameixa', name: 'Ameixa', hint: 'Tons profundos, joia',
    roles: { orange: '#C9512A', blue: '#345E9E', green: '#2F8C57', yellow: '#C79433', rose: '#B25574', brown: '#8A5A3C', deep: '#A83E2A', ink: '#241F1B' },
  },
];

export const DEFAULT_CHART_PALETTE_ID = 'vivido';

// Índice cor-base → papel, para lookup O(1) no remap.
const ROLE_OF_BASE: Record<string, keyof PaletteRoles> = {
  [BASE.orange]: 'orange', [BASE.blue]: 'blue', [BASE.green]: 'green', [BASE.yellow]: 'yellow',
  [BASE.rose]: 'rose', [BASE.brown]: 'brown', [BASE.deep]: 'deep', [BASE.ink]: 'ink',
};

export function isChartPaletteId(id: string): boolean {
  return CHART_PALETTES.some((p) => p.id === id);
}

export function getChartPalette(id: string): ChartPalette {
  return CHART_PALETTES.find((p) => p.id === id) ?? CHART_PALETTES[0];
}

/** Converte uma cor-base (hex de ACTIVITY_COLORS) para a cor da paleta ativa.
 * Cores fora do mapa (ex.: default) passam sem alteração. */
export function remapChartColor(hex: string, paletteId: string): string {
  const role = ROLE_OF_BASE[hex];
  return role ? getChartPalette(paletteId).roles[role] : hex;
}

/** Amostra representativa para prévia (ordem: laranja, verde, azul, rosa, amarelo). */
export function paletteSwatch(p: ChartPalette): string[] {
  return [p.roles.orange, p.roles.green, p.roles.blue, p.roles.rose, p.roles.yellow];
}
