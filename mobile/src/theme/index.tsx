/**
 * Vitale — React Native Theme
 * Light/dark palettes + runtime theme provider.
 *
 * Screens consume colors through the live `colors` proxy (always reflects the
 * active scheme) and wrap their StyleSheet in `useThemedStyles` so styles are
 * rebuilt when the scheme or glass setting changes.
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { resolveWallpaper, type Wallpaper } from '@vitale/shared';
import { useSettingsStore } from '../store/settings.store';
import { useAuthStore } from '../store/auth.store';

export type ColorScheme = 'light' | 'dark';

export const lightColors = {
  // Surfaces
  bg: '#FFF7EE',
  bg2: '#ECE3D2',
  bg4: '#E3D5BC',
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
  lineWarm: '#F0C9A8',

  // Papel de parede (grade pontilhada)
  dot: '#E0D2BC',

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
  casaSoft: '#F4E6D9',
  teal: '#4F9D90',
  tealSoft: '#DDEEEA',
  red: '#E05C5C',
  redSoft: '#FDDEDE',
  inkSoft: '#EAE3D6',
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  // Surfaces — warm near-black to keep the brand's warmth
  bg: '#14110D',
  bg2: '#1C1812',
  bg4: '#2A231B',
  surface: '#1E1A15',
  surfaceWarm: '#262019',
  surfaceMute: '#241E18',

  // Ink (text)
  ink: '#F6EFE6',
  ink2: '#BDB3A6',
  ink3: '#8A8074',
  ink4: '#5C554B',

  // Lines
  line: '#2E2820',
  lineDeep: '#3A3329',
  lineWarm: '#3A2C20',

  // Papel de parede (grade pontilhada)
  dot: '#2E2820',

  // Brand / Primary
  primary: '#F25C2B',
  primaryDeep: '#FF6A3C',
  primarySoft: '#3A241A',

  // Accents
  yellow: '#F5B946',
  yellowSoft: '#352B17',
  green: '#7FB97A',
  greenSoft: '#1E2A1B',
  rose: '#E87B98',
  roseSoft: '#34212A',
  blue: '#84A0DA',
  blueSoft: '#1E2840',
  casa: '#C49A72',
  // Tints escuros de baixa saturação (combinam com o fundo near-black) +
  // acentos mais brilhantes para legibilidade no dark.
  casaSoft: '#2E2418',
  teal: '#5FB3A4',
  tealSoft: '#15302B',
  red: '#F07A7A',
  redSoft: '#3A1F22',
  inkSoft: '#2A241D',
};

const palettes: Record<ColorScheme, ThemeColors> = { light: lightColors, dark: darkColors };

/** Active scheme, kept in sync by `ThemeProvider`; backs the `colors` proxy. */
let activeScheme: ColorScheme = 'light';

/**
 * Quando um papel de parede (≠ flat) está ativo, o fundo das telas (`bg`) fica
 * transparente para a camada de wallpaper desenhada na raiz aparecer atrás de
 * todo o conteúdo. Mantido em sincronia pelo `ThemeProvider`.
 */
let wallpaperActive = false;

/**
 * Live palette. Reading any property returns the value for the active scheme,
 * so JSX (`colors.ink`) reflects theme changes on the next render. Styles must
 * be rebuilt via `useThemedStyles` for changes to take effect.
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get: (_t, prop: string) => {
    if (prop === 'bg' && wallpaperActive) return 'transparent';
    return (palettes[activeScheme] as Record<string, string>)[prop];
  },
  ownKeys: () => Reflect.ownKeys(palettes[activeScheme]),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/** Cor de fundo base opaca do esquema ativo (ignora o wallpaper). Útil p/ status bar. */
export function baseBg(scheme: ColorScheme): string {
  return palettes[scheme].bg;
}

export const MOD = {
  treino:   { tint: '#FFE3D2', accent: '#F25C2B' },
  food:     { tint: '#FFEFC9', accent: '#F5B946' },
  agua:     { tint: '#DDE4F2', accent: '#6E8CC9' },
  habito:   { tint: '#E2EFD9', accent: '#6FA86A' },
  casa:     { tint: '#F4E6D9', accent: '#B4825B' },
  compras:  { tint: '#FFE3D2', accent: '#E26A8A' },
  financas: { tint: '#EAE3D6', accent: '#1F1B16' },
  tarefa:   { tint: '#DDEEEA', accent: '#4F9D90' },
} as const;

/**
 * Cor de um módulo resolvida a partir do tema vivo (`colors`), portanto adapta
 * ao esquema claro/escuro. Diferente do `MOD` (tints claros fixos), as chaves
 * apontam para tokens `*Soft`/acento da paleta, que no dark viram tints escuros
 * de baixa saturação com acentos brilhantes. Chame no render (dentro de um
 * componente que assina o tema via `useTheme`/`useThemedStyles`).
 */
export function moduleColors(key: string): { tint: string; accent: string } {
  switch (key) {
    case 'treino':   return { tint: colors.primarySoft, accent: colors.primary };
    case 'food':     return { tint: colors.yellowSoft,  accent: colors.yellow };
    case 'agua':     return { tint: colors.blueSoft,    accent: colors.blue };
    case 'habito':   return { tint: colors.greenSoft,   accent: colors.green };
    case 'casa':     return { tint: colors.casaSoft,    accent: colors.casa };
    case 'compras':  return { tint: colors.roseSoft,    accent: colors.rose };
    case 'financas': return { tint: colors.inkSoft,     accent: colors.ink };
    case 'saude':    return { tint: colors.redSoft,     accent: colors.red };
    case 'tarefa':   return { tint: colors.tealSoft,    accent: colors.teal };
    default:         return { tint: colors.blueSoft,    accent: colors.blue };
  }
}

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
    // Mockup: 0 10px 24px -18px rgba(31,27,22,.4). RN não tem spread negativo,
    // então aproximamos a sombra contida reduzindo a opacidade.
    shadowColor: '#1F1B16',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
} as const;

/* ───────────────────────── Theme context ───────────────────────── */

interface ThemeValue {
  scheme: ColorScheme;
  glass: boolean;
  blurIntensity: number;
  wallpaper: Wallpaper;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'light', glass: false, blurIntensity: 50, wallpaper: 'flat', colors });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const preferences = useSettingsStore((s) => s.preferences);
  const session = useAuthStore((s) => s.session);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    if (session && !preferences) loadSettings();
  }, [session, preferences]);

  const pref = preferences?.theme ?? 'system';
  const scheme: ColorScheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  const glass = preferences?.glassEnabled ?? false;
  const blurIntensity = preferences?.blurIntensity ?? 50;
  const wallpaper = resolveWallpaper(preferences?.wallpaper);

  // Keep the proxy current before children read `colors` this render pass.
  activeScheme = scheme;
  wallpaperActive = wallpaper !== 'flat';

  const value = useMemo<ThemeValue>(
    () => ({ scheme, glass, blurIntensity, wallpaper, colors }),
    [scheme, glass, blurIntensity, wallpaper],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Builds themed styles and rebuilds them when the scheme or glass setting
 * changes. The factory reads the live `colors` proxy.
 */
export function useThemedStyles<T>(factory: () => T): T {
  const { scheme, glass, wallpaper } = useTheme();
  // wallpaper afeta `colors.bg` (transparente quando ≠ flat) → rebuild necessário.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [scheme, glass, wallpaper !== 'flat']);
}

/**
 * Module-level themed stylesheet. Accessing a key returns the value built for
 * the active scheme (cached per scheme). Use in files with several components
 * that share one stylesheet: the top component just needs to call `useTheme()`
 * once so the subtree re-renders when the scheme changes.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache = new Map<string, T>();
  return new Proxy({} as T, {
    get: (_t, prop: string | symbol) => {
      // Inclui o estado do wallpaper na chave: ele altera `colors.bg`.
      const key = `${activeScheme}:${wallpaperActive ? 'wp' : 'flat'}`;
      let sheet = cache.get(key);
      if (!sheet) {
        sheet = factory();
        cache.set(key, sheet);
      }
      return (sheet as Record<string | symbol, unknown>)[prop];
    },
  });
}
