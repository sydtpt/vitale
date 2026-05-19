/**
 * Rotina — Design Tokens
 * Single source of truth for colors, spacing, typography across web & mobile.
 */

// ─── Surfaces ──────────────────────────────────────────
export const surfaces = {
  bg: '#FFF7EE',
  bgWeb: '#FAF3E6',
  surface: '#FFFFFF',
  surfaceWarm: '#FFEFD9',
  surfaceMute: '#F6ECDC',
} as const;

// ─── Ink (text) ────────────────────────────────────────
export const ink = {
  ink: '#1F1B16',
  ink2: '#5C534A',
  ink3: '#9C928A',
  ink4: '#C6BCAE',
} as const;

// ─── Lines ─────────────────────────────────────────────
export const lines = {
  line: '#EFE6D8',
  lineDeep: '#E3D7C2',
} as const;

// ─── Brand / Primary ──────────────────────────────────
export const brand = {
  primary: '#F25C2B',
  primaryDeep: '#D9491B',
  primarySoft: '#FFE3D2',
} as const;

// ─── Accent colors ────────────────────────────────────
export const accents = {
  yellow: '#F5B946',
  yellowSoft: '#FFEFC9',
  green: '#6FA86A',
  greenSoft: '#E2EFD9',
  rose: '#E26A8A',
  roseSoft: '#FBE2E8',
  blue: '#6E8CC9',
  blueSoft: '#DDE4F2',
  casa: '#B4825B',
} as const;

// ─── Flat export (backwards compatible) ───────────────
export const T = {
  ...surfaces,
  ...ink,
  ...lines,
  ...brand,
  ...accents,
} as const;

// ─── Module color map ─────────────────────────────────
export const MOD = {
  treino:   { tint: '#FFE3D2', accent: '#F25C2B' },
  food:     { tint: '#FFEFC9', accent: '#F5B946' },
  agua:     { tint: '#DDE4F2', accent: '#6E8CC9' },
  habito:   { tint: '#E2EFD9', accent: '#6FA86A' },
  casa:     { tint: '#F4E6D9', accent: '#B4825B' },
  compras:  { tint: '#FFE3D2', accent: '#E26A8A' },
  financas: { tint: '#EAE3D6', accent: '#1F1B16' },
} as const;

export type ModuleKey = keyof typeof MOD;

// ─── Spacing scale (4px base) ─────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
} as const;

// ─── Border radii ─────────────────────────────────────
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  pill: 999,
} as const;

// ─── Typography ───────────────────────────────────────
export const fonts = {
  sans: "'Geist', system-ui, sans-serif",
  mono: "'Geist Mono', monospace",
  serif: "'Instrument Serif', serif",
} as const;

export const fontSizes = {
  xs: 10,
  sm: 11.5,
  base: 13,
  md: 14,
  lg: 16,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
  '4xl': 44,
} as const;
