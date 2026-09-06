/**
 * Orbe — tema do React Native.
 *
 * A resolução de cor é pura e mora em `tokens.ts`; aqui fica só a ponte com o
 * React — o provider que lê as preferências do usuário e empurra os eixos
 * ativos, e o hook que reconstrói folhas de estilo quando eles mudam.
 *
 * Telas continuam importando tudo daqui (`import { colors, spacing } from
 * '../theme'`); a separação é interna.
 */
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  resolveBrand,
  resolvePalette,
  resolveTheme,
  resolveWallpaper,
  wallpapersFor,
  DEFAULT_BRAND_ID,
  DEFAULT_PALETTE_ID,
  DEFAULT_THEME_ID,
  type BrandId,
  type PaletteId,
  type ThemeId,
  type Wallpaper,
} from '@vitale/shared';
import { useSettingsStore } from '../store/settings.store';
import { useAuthStore } from '../store/auth.store';
import { colors, setActiveAxes, type ColorScheme, type ThemeColors } from './tokens';
import { useSolarScheme } from './useSolarScheme';

export { useSolarScheme } from './useSolarScheme';

export {
  colors,
  baseBg,
  wallpaperBg,
  MOD,
  moduleColors,
  roleColors,
  sleepColors,
  themeFillsCards,
  themed,
  themedCacheKey,
  spacing,
  radii,
  fonts,
  shadows,
  type ColorScheme,
  type ThemeColors,
} from './tokens';

/* ───────────────────────── Theme context ───────────────────────── */

interface ThemeValue {
  themeId: ThemeId;
  paletteId: PaletteId;
  brandId: BrandId;
  scheme: ColorScheme;
  glass: boolean;
  blurIntensity: number;
  wallpaper: Wallpaper;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue>({
  themeId: DEFAULT_THEME_ID,
  paletteId: DEFAULT_PALETTE_ID,
  brandId: DEFAULT_BRAND_ID,
  scheme: 'light',
  glass: false,
  blurIntensity: 50,
  wallpaper: 'flat',
  colors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const preferences = useSettingsStore((s) => s.preferences);
  const session = useAuthStore((s) => s.session);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    if (session && !preferences) loadSettings();
  }, [session, preferences]);

  const pref = preferences?.theme ?? 'system';

  // O hook precisa ser chamado sempre (regra dos hooks); `enabled` é que decide
  // se ele mantém timer. Devolve `null` num fuso sem coordenada — daí o `solar`
  // cai no esquema do sistema, que é a degradação certa e não uma escolha
  // arbitrária entre claro e escuro.
  const solar = useSolarScheme(pref === 'solar');
  const doSistema: ColorScheme = system === 'dark' ? 'dark' : 'light';
  const scheme: ColorScheme =
    pref === 'system' ? doSistema : pref === 'solar' ? (solar?.scheme ?? doSistema) : pref;
  const theme = resolveTheme(preferences?.themeId);
  const palette = resolvePalette(preferences?.paletteId);
  const brand = resolveBrand(preferences?.brandId);
  const glass = preferences?.glassEnabled ?? false;
  const blurIntensity = preferences?.blurIntensity ?? 50;

  // Mesma regra da tela de Aparência, de uma fonte só: o que o tema não oferece
  // cai em `flat`. Cobre o decorativo nos temas que abrem mão dele e o `pure`
  // onde ele pintaria igual ao `flat`. A escolha continua salva e volta ao
  // trocar de tema.
  const saved = resolveWallpaper(preferences?.wallpaper);
  const permitidos = wallpapersFor(theme.id, scheme);
  const wallpaper: Wallpaper = permitidos.some((w) => w.id === saved) ? saved : 'flat';

  // Atualiza antes de os filhos lerem `colors` neste mesmo render.
  setActiveAxes(theme.id, scheme, palette.id, brand.id, wallpaper !== 'flat');

  const value = useMemo<ThemeValue>(
    () => ({
      themeId: theme.id,
      paletteId: palette.id,
      brandId: brand.id,
      scheme,
      glass,
      blurIntensity,
      wallpaper,
      colors,
    }),
    [theme.id, palette.id, brand.id, scheme, glass, blurIntensity, wallpaper],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Constrói a folha de estilo e a reconstrói quando qualquer eixo muda.
 *
 * **Esquecer um eixo nesta lista é o bug mais caro do tema:** a tela não muda e
 * não há erro nenhum, porque o `useMemo` devolve a folha velha. Já aconteceu com
 * o esquema e com o wallpaper. Eixo novo entra aqui **e** em `themedCacheKey`;
 * `theme-cache.test.ts` cobra os dois.
 */
export function useThemedStyles<T>(factory: () => T): T {
  const { themeId, paletteId, brandId, scheme, glass, wallpaper } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, [themeId, paletteId, brandId, scheme, glass, wallpaper !== 'flat']);
}
