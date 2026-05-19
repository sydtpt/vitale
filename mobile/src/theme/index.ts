/**
 * Vitale — React Native Theme
 * Mirrors CSS variables from the Angular mockup for native usage.
 */

export const colors = {
  // Surfaces
  bg: '#FFF7EE',
  surface: '#FFFFFF',
  surfaceWarm: '#FFEFD9',
  surfaceMute: '#F6ECDC',

  // Ink (text)
  ink: '#1F1B16',
  ink2: '#5C534A',
  ink3: '#9C928A',
  ink4: '#C6BCAE',

  // Lines
  line: '#EFE6D8',
  lineDeep: '#E3D7C2',

  // Brand / Primary
  primary: '#F25C2B',
  primaryDeep: '#D9491B',
  primarySoft: '#FFE3D2',

  // Accents
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

export const MOD = {
  treino:   { tint: '#FFE3D2', accent: '#F25C2B' },
  food:     { tint: '#FFEFC9', accent: '#F5B946' },
  agua:     { tint: '#DDE4F2', accent: '#6E8CC9' },
  habito:   { tint: '#E2EFD9', accent: '#6FA86A' },
  casa:     { tint: '#F4E6D9', accent: '#B4825B' },
  compras:  { tint: '#FFE3D2', accent: '#E26A8A' },
  financas: { tint: '#EAE3D6', accent: '#1F1B16' },
} as const;

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

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  pill: 999,
} as const;

export const fonts = {
  sans: 'Geist',
  sansFallback: 'System',
  mono: 'GeistMono',
  serif: 'InstrumentSerif',
} as const;

export const shadows = {
  sm: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 0,
    elevation: 1,
  },
  md: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
} as const;
