/**
 * Eixos ativos do tema e leitura de cor — **parte pura**, sem React e sem
 * Supabase.
 *
 * Separado do `index.tsx` de propósito: lá mora o `ThemeProvider`, que assina a
 * store de preferências e, por tabela, o cliente Supabase. Enquanto tudo estava
 * num arquivo só, testar a resolução de cor exigia um ambiente com credenciais —
 * o teste do cache de folhas quebrava com "supabaseUrl is required" antes de
 * chegar à primeira asserção. Cor não depende de sessão; agora o código reflete
 * isso.
 *
 * Nenhum valor nasce aqui. Tudo vem de `@vitale/shared`, resolvido a partir de
 * três eixos independentes: **tema** (neutros), **esquema** (claro/escuro) e
 * **paleta** (cromático).
 */
import type { ViewStyle } from 'react-native';
import {
  fillsCards,
  moduleOf,
  resolveTheme,
  resolveTokens,
  DEFAULT_BRAND_ID,
  DEFAULT_PALETTE_ID,
  DEFAULT_THEME_ID,
  type BrandId,
  type ModuleKey,
  type ModuleTokens,
  type PaletteId,
  type ResolvedTokens,
  type RoleKey,
  type RoleTokens,
  type ThemeId,
  type Wallpaper,
} from '@vitale/shared';

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = ResolvedTokens;

/**
 * Os três eixos + o wallpaper, mantidos em sincronia pelo `ThemeProvider`.
 * Módulo-nível de propósito: `StyleSheet.create` roda fora de componente, e uma
 * folha precisa ler a cor certa sem receber contexto por parâmetro.
 */
let activeTheme: ThemeId = DEFAULT_THEME_ID;
let activeScheme: ColorScheme = 'light';
let activePalette: PaletteId = DEFAULT_PALETTE_ID;
let activeBrand: BrandId = DEFAULT_BRAND_ID;

/**
 * Com um papel de parede (≠ `flat`) ativo, o fundo das telas (`bg`) fica
 * transparente para a camada desenhada na raiz aparecer atrás do conteúdo.
 */
let wallpaperActive = false;

/** Chamado pelo `ThemeProvider` a cada render, antes de os filhos lerem cor. */
export function setActiveAxes(
  theme: ThemeId,
  scheme: ColorScheme,
  palette: PaletteId,
  brand: BrandId,
  wallpaper: boolean,
): void {
  activeTheme = theme;
  activeScheme = scheme;
  activePalette = palette;
  activeBrand = brand;
  wallpaperActive = wallpaper;
}

const tokens = (): ResolvedTokens =>
  resolveTokens(activeTheme, activeScheme, activePalette, activeBrand);

/**
 * Paleta viva. Ler qualquer propriedade devolve o valor dos eixos ativos, então
 * o JSX (`colors.ink`) reflete a troca já no próximo render. Folhas de estilo
 * precisam ser reconstruídas via `useThemedStyles`/`themed`.
 */
export const colors: ThemeColors = new Proxy({} as ThemeColors, {
  get: (_t, prop: string) => {
    if (prop === 'bg' && wallpaperActive) return 'transparent';
    return (tokens() as unknown as Record<string, unknown>)[prop];
  },
  ownKeys: () => Reflect.ownKeys(tokens()),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/** Fundo base opaco do esquema (ignora o wallpaper). Útil p/ barra de status. */
export function baseBg(scheme: ColorScheme): string {
  return resolveTokens(activeTheme, scheme, activePalette, activeBrand).bg;
}

/**
 * Base opaca sob a qual o papel de parede é desenhado. Igual ao `baseBg`,
 * exceto no `pure`, que troca o fundo do tema pelo neutro absoluto. Quem pinta
 * a camada de fundo — a raiz e as prévias — usa esta, para a base e o desenho
 * nunca discordarem por um frame.
 */
export function wallpaperBg(scheme: ColorScheme, variant: Wallpaper): string {
  const t = resolveTokens(activeTheme, scheme, activePalette, activeBrand);
  return variant === 'pure' ? t.bgPure : t.bg;
}

/**
 * Cores de um módulo nos eixos ativos. Chame no render, dentro de um componente
 * que assine o tema (`useTheme`/`useThemedStyles`).
 *
 * Use `onTint` — e não `accent` — para ícone ou texto **dentro** do `tint`.
 * O padrão antigo era `accent` sobre `tint`, e produzia pares ruins: o amarelo
 * media 1,55 de contraste, praticamente invisível.
 */
export function moduleColors(key: string, fallback?: ModuleKey): ModuleTokens {
  return moduleOf(key, activeTheme, activeScheme, activePalette, fallback);
}

/**
 * Quarteto de um papel cromático nos eixos ativos. Irmão do `moduleColors`, para
 * quem tem um papel na mão em vez de um módulo — a tira de Recordes é o caso.
 */
export function roleColors(role: RoleKey): RoleTokens {
  return resolveTokens(activeTheme, activeScheme, activePalette, activeBrand).roles[role];
}

/**
 * O tema ativo preenche cards, ou os desenha só com contorno? Decide a casca do
 * cartão de recorde. Não use `colors.bg` para isto: ele devolve `'transparent'`
 * sob papel de parede, e a comparação daria falso no tema errado.
 */
export function themeFillsCards(): boolean {
  return fillsCards(activeTheme, activeScheme);
}

/**
 * Par tint/acento por módulo, **vivo**: cada leitura resolve nos eixos ativos.
 *
 * Substitui o `MOD` estático do núcleo, que era o recorte histórico (orbe,
 * claro) e por isso pintava chip claro sobre fundo escuro no modo escuro. Como
 * proxy, os pontos que leem `MOD.treino.tint` dentro do render passam a
 * responder a tema e paleta sem mudar uma linha.
 *
 * **Ler no escopo do módulo continua congelando** — o valor é capturado no
 * import. Quem precisa de uma lista de cores em nível de módulo tem de virar
 * função chamada no render; `architecture.test.ts` cobra o caso das folhas de
 * estilo.
 *
 * Não traz `onTint`: é a forma antiga, mantida por compatibilidade. Código novo
 * usa `moduleColors()`.
 */
export const MOD: Record<string, { tint: string; accent: string }> = new Proxy(
  {} as Record<string, { tint: string; accent: string }>,
  {
    get: (_t, key: string) => {
      const m = moduleColors(key);
      return { tint: m.tint, accent: m.accent };
    },
  },
);

/**
 * Chave de cache das folhas de módulo. Exportada para o teste conseguir provar
 * que ela distingue todas as combinações de eixos.
 *
 * **Esquecer um eixo aqui é o bug mais caro deste arquivo:** a tela não muda, e
 * não há erro nenhum — o cache devolve a folha velha. Já aconteceu duas vezes
 * neste app. Eixo novo entra aqui **e** nas dependências do `useThemedStyles`.
 */
export function themedCacheKey(): string {
  return `${activeTheme}:${activeScheme}:${activePalette}:${activeBrand}:${wallpaperActive ? 'wp' : 'flat'}`;
}

/**
 * Folha de estilo no escopo do módulo. Acessar uma chave devolve o valor
 * construído para os eixos ativos (com cache por combinação). Use em arquivos
 * com vários componentes que compartilham uma folha: basta o componente do topo
 * chamar `useTheme()` uma vez para a subárvore re-renderizar.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache = new Map<string, T>();
  return new Proxy({} as T, {
    get: (_t, prop: string | symbol) => {
      const key = themedCacheKey();
      let sheet = cache.get(key);
      if (!sheet) {
        sheet = factory();
        cache.set(key, sheet);
      }
      return (sheet as Record<string | symbol, unknown>)[prop];
    },
  });
}

/* ─────────────────── Escalas (não dependem de tema) ─────────────────── */

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

/**
 * Famílias de fonte, uma chave por peso.
 *
 * **Não combine com `fontWeight`.** O RN não resolve peso para famílias
 * carregadas via `expo-font`: cada peso é um arquivo registrado com nome
 * próprio (ver `_layout.tsx`), então o peso vem na escolha da chave. Um
 * `fontWeight` sobrando ou é ignorado, ou vira bold sintético no Android.
 *
 * Manrope no corpo (x-height alta sustenta os 10–13px do app), Geist Mono nos
 * números (tabular, alinha em coluna) e Instrument Serif nos títulos. A serifa
 * só existe em Regular — não há chave de peso para ela de propósito.
 */
export const fonts = {
  sans: 'Manrope-Regular',
  sansMedium: 'Manrope-Medium',
  sansSemiBold: 'Manrope-SemiBold',
  sansBold: 'Manrope-Bold',
  mono: 'GeistMono-Regular',
  monoSemiBold: 'GeistMono-SemiBold',
  monoBold: 'GeistMono-Bold',
  serif: 'InstrumentSerif-Regular',
} as const;

/**
 * Cromo de elevação, **sensível ao tema**.
 *
 * Não é constante porque o Orbe separa card do fundo com sombra e os temas
 * Clean separam com uma linha de 1px — e sombra somada a borda é justamente o
 * visual pesado que o Clean existe para não ter. Como os 82 pontos que desenham
 * card fazem `...shadows.card`, trocar aqui troca em todos sem tocar em nenhum.
 *
 * As chaves de sombra continuam presentes quando desligadas (`shadowOpacity: 0`,
 * `elevation: 0`): um spread que some com a chave deixaria o valor anterior de
 * pé em folhas que compõem estilos.
 */
export const shadows: {
  sm: ViewStyle;
  md: ViewStyle;
  card: ViewStyle;
} = new Proxy({} as { sm: ViewStyle; md: ViewStyle; card: ViewStyle }, {
  get: (_t, key: string) => {
    const t = tokens();
    const outline = resolveTheme(activeTheme).cardChrome === 'outline';
    if (outline) {
      const semSombra = { shadowOpacity: 0, shadowRadius: 0, elevation: 0 } as const;
      // `sm` e `md` são realces sutis, não card: no Clean apenas somem. Só o
      // `card` troca a sombra por contorno.
      if (key === 'card') {
        return { ...semSombra, borderWidth: 1, borderColor: t.hairline };
      }
      return semSombra;
    }
    return {
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
        // Mockup: 0 10px 24px -18px rgba(31,27,22,.4). RN não tem spread
        // negativo, então aproximamos a sombra contida reduzindo a opacidade.
        shadowColor: '#1F1B16',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 6,
      },
    }[key as 'sm' | 'md' | 'card'];
  },
});
