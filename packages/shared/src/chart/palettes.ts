/**
 * Paletas de cor para os gráficos. Cada paleta remapeia as cores-base por tipo de
 * atividade (ACTIVITY_COLORS em workout-types) para um conjunto harmônico com a
 * paleta bege/creme do app. A cor segue a ENTIDADE (tipo de atividade), nunca o
 * ranking — a mesma atividade tem a mesma cor em qualquer período.
 *
 * Cada paleta tem um caráter próprio (quente, fria, terrosa, elétrica, escura,
 * daltônica) — não são variações da mesma ideia.
 *
 * O quinteto dominante (orange/green/blue/rose/yellow = Corrida/Yoga/Ciclismo/
 * Core/Caminhada) foi validado com o script de dataviz sobre o fundo creme
 * (#F6ECDC) e o escuro (#241E18), com todos os pares: banda de luminosidade,
 * piso de chroma e separação de visão normal (≥15). CVD na faixa de aviso (6–8) é
 * aceitável porque o gráfico traz legenda rotulada + tooltip como codificação
 * secundária. Os papéis brown/deep/ink são secundários (Funcional, HIIT,
 * Musculação) e ficam abaixo desse piso — como já acontecia na paleta original.
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
    id: 'vivido', name: 'Vívido', hint: 'Cores limpas e vibrantes',
    roles: { orange: '#F35D2A', blue: '#2F7FD1', green: '#3EA05C', yellow: '#E0A22E', rose: '#E15C93', brown: '#A6714A', deep: '#D33E1C', ink: '#2A2620' },
  },
  {
    id: 'artico', name: 'Ártico', hint: 'Só tons frios: teal, índigo e violeta',
    roles: { orange: '#009EAF', blue: '#3A63CD', green: '#6ACC8E', yellow: '#A568F9', rose: '#B4398B', brown: '#5E7E92', deep: '#00697F', ink: '#232833' },
  },
  {
    id: 'terra', name: 'Terra', hint: 'Terrosos suaves: terracota, oliva e ocre',
    roles: { orange: '#974522', blue: '#3674A5', green: '#78822B', yellow: '#CCA051', rose: '#CE677A', brown: '#6D6446', deep: '#6B2F14', ink: '#2E271F' },
  },
  {
    id: 'neon', name: 'Néon', hint: 'Alta saturação, quase fluorescente',
    roles: { orange: '#E23A81', blue: '#0094BC', green: '#3FB86A', yellow: '#E79D00', rose: '#822DDA', brown: '#FF6B2C', deep: '#B8005E', ink: '#2B2140' },
  },
  {
    id: 'joia', name: 'Joia', hint: 'Escuras e encorpadas, tipo pedra preciosa',
    roles: { orange: '#B8431A', blue: '#1B62A7', green: '#157F58', yellow: '#A68500', rose: '#854079', brown: '#7A5C36', deep: '#7E2A14', ink: '#221E28' },
  },
  {
    id: 'acessivel', name: 'Acessível', hint: 'Otimizada para daltonismo (Okabe–Ito)',
    roles: { orange: '#D55E00', blue: '#0072B2', green: '#009E73', yellow: '#E69F00', rose: '#CC79A7', brown: '#56B4E9', deep: '#8A4600', ink: '#2B2B2B' },
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
