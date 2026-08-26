/**
 * Onde os dois eixos se encontram: tema (neutros) × paleta (cromático) × esquema
 * → o mapa de tokens que a UI consome.
 *
 * ## Por que derivar em vez de autorar
 *
 * São 2 temas × 2 esquemas × 6 paletas = **24 combinações**. Cada uma precisa de
 * ~50 tokens; autorar dá ~1.200 hex que ninguém revisa. Aqui cada paleta declara
 * **11 matizes** e o resto é calculado, com `theme.test.ts` medindo contraste em
 * todas as 24 em vez de confiar no olho de alguém.
 *
 * ## Os três tokens de cada papel
 *
 * | token | onde vive | garantia |
 * |---|---|---|
 * | `accent` | ponto, barra, traço sobre o fundo | ≥ 3,0 contra `surface` |
 * | `*Soft`  | preenchimento de chip/caixa | — é fundo, não precisa |
 * | `*On`    | ícone ou texto **dentro** do chip | ≥ 3,0 contra o `*Soft` |
 *
 * O terceiro existe por um defeito real encontrado no Orbe: o padrão do app é
 * ícone em `accent` sobre caixa em `tint`, e o par amarelo media **1,55** de
 * contraste — ícone `#F5B946` sobre `#FFEFC9` é quase invisível. E não tem
 * conserto pelo tint: `#F5B946` é claro demais para atingir 3,0 sobre qualquer
 * fundo claro. A saída é a mesma da Material ("on-container"): uma cor de
 * primeiro plano própria, escurecida só o quanto for preciso.
 *
 * ## Os pinos históricos
 *
 * `orbe` + `orbe` devolve **exatamente** os hex que o app sempre teve. Não é
 * desconfiança da derivação: é que esses valores já estão na tela de quem usa o
 * app, e um plano que promete "sem regressão" não pode mudar o visual de todo
 * mundo como efeito colateral de uma refatoração. As outras 23 combinações são
 * inteiramente calculadas.
 */

import {
  contrast,
  hexToOklch,
  oklchToHex,
  type Oklch,
} from './color';
import {
  neutralsOf,
  resolveTheme,
  type ColorScheme,
  type ThemeNeutrals,
} from './themes';
import { resolveBrand } from './brands';
import {
  isDecorativeWallpaper,
  WALLPAPERS,
  type Wallpaper,
} from '../constants/wallpaper';
import {
  MODULE_ROLE,
  resolvePalette,
  type AppPaletteRoles,
  type ModuleKey,
} from './palettes';

export type RoleKey = keyof AppPaletteRoles;

/** Piso de contraste para objeto gráfico não-textual (WCAG 2.1, 1.4.11). */
const GRAPHIC_FLOOR = 3;

/** Alvos de luminosidade do tint, calibrados sobre os pares do Orbe. */
const SOFT_L = { light: 0.932, dark: 0.275 } as const;
/** Fração do chroma do acento que sobrevive no tint, e o teto absoluto. */
const SOFT_C = { light: { k: 0.24, max: 0.06 }, dark: { k: 0.3, max: 0.05 } } as const;

/**
 * Empurra a luminosidade de `color` para longe de `against` até alcançar o piso
 * de contraste, mantendo matiz e chroma. Devolve a cor intacta quando já passa.
 */
function ensureContrast(color: string, against: string, floor: number): string {
  if (contrast(color, against) >= floor) return color;
  const base: Oklch = hexToOklch(color);
  // Escurece quando o fundo é claro; clareia quando é escuro.
  const goDarker = contrast('#FFFFFF', against) < contrast('#000000', against);
  const target = goDarker ? 0 : 1;
  let lo = 0;
  let hi = 1;
  let best = goDarker ? '#000000' : '#FFFFFF';
  // Busca o menor deslocamento que satisfaz o piso — mover só o necessário
  // preserva ao máximo a identidade do papel.
  for (let i = 0; i < 20; i += 1) {
    const t = (lo + hi) / 2;
    const candidate = oklchToHex({ ...base, l: base.l + (target - base.l) * t });
    if (contrast(candidate, against) >= floor) {
      best = candidate;
      hi = t;
    } else {
      lo = t;
    }
  }
  return best;
}

/** Move a luminosidade preservando matiz e chroma. Usado na variante de ênfase. */
function shiftLightness(hex: string, delta: number): string {
  const c = hexToOklch(hex);
  return oklchToHex({ ...c, l: Math.min(1, Math.max(0, c.l + delta)) });
}

/** Tint de um acento: mesmo matiz, chroma cortado, luminosidade no alvo do esquema. */
export function softOf(accent: string, scheme: ColorScheme): string {
  const { c, h } = hexToOklch(accent);
  const spec = SOFT_C[scheme];
  return oklchToHex({ l: SOFT_L[scheme], c: Math.min(c * spec.k, spec.max), h });
}

/** Cor de primeiro plano legível sobre `tint`, partindo do acento. */
export function onTintOf(accent: string, tint: string): string {
  return ensureContrast(accent, tint, GRAPHIC_FLOOR);
}

/* ─────────────── Pinos históricos: orbe × orbe ─────────────── */

const PINNED_ACCENT: Record<ColorScheme, Partial<Record<RoleKey, string>>> = {
  light: {},
  dark: {
    green: '#7FB97A', rose: '#E87B98', blue: '#84A0DA', brown: '#C49A72',
    teal: '#5FB3A4', red: '#F07A7A', purple: '#A98BCB', deep: '#FF6A3C',
  },
};

const PINNED_SOFT: Record<ColorScheme, Partial<Record<RoleKey, string>>> = {
  light: {
    orange: '#FFE3D2', yellow: '#FFEFC9', green: '#E2EFD9', rose: '#FBE2E8',
    blue: '#DDE4F2', brown: '#F4E6D9', teal: '#DDEEEA', red: '#FDDEDE', purple: '#EBE3F3',
  },
  dark: {
    orange: '#3A241A', yellow: '#352B17', green: '#1E2A1B', rose: '#34212A',
    blue: '#1E2840', brown: '#2E2418', teal: '#15302B', red: '#3A1F22', purple: '#241C30',
  },
};

/* ─────────────────────── Tokens resolvidos ─────────────────────── */

/** Trio de tokens de um papel cromático. */
export interface RoleTokens {
  accent: string;
  soft: string;
  on: string;
}

export interface ResolvedTokens extends ThemeNeutrals {
  /** Papel → trio de tokens. */
  roles: Record<RoleKey, RoleTokens>;

  /**
   * Cor de marca — o cromo do app (FAB, CTA, toggle, estado ativo). Vem do eixo
   * **marca**, não da paleta: o chip de Treino segue a paleta, o “+” segue isto.
   */
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  /** Conteúdo sobre o `primarySoft` (equivale ao `onPrimaryContainer`). */
  primaryOn: string;
  /**
   * Conteúdo sobre o `primary` **sólido** — o “+” dentro do FAB, o texto do
   * botão cheio. Existe porque a marca `tinta` fica quase branca no escuro, e um
   * `#fff` cravado viraria branco sobre branco.
   */
  onPrimary: string;
  /**
   * Contorno do preenchimento da marca. `'transparent'` quando a marca não tem —
   * assim o componente desenha a borda sempre, sem condicional.
   */
  primaryOutline: string;
  yellow: string; yellowSoft: string; yellowOn: string;
  green: string; greenSoft: string; greenOn: string;
  rose: string; roseSoft: string; roseOn: string;
  blue: string; blueSoft: string; blueOn: string;
  casa: string; casaSoft: string; casaOn: string;
  teal: string; tealSoft: string; tealOn: string;
  red: string; redSoft: string; redOn: string;
  purple: string; purpleSoft: string; purpleOn: string;
  /** `inkOn` fecha o trio do papel `ink`, cujo tint é o `inkSoft` do tema. */
  inkOn: string;
  /**
   * Cor da parte não iluminada da lua do cabeçalho — o **fundo do tema**, para
   * que ela dissolva na página em vez de virar uma mancha. É o `bg` e não o
   * próprio `bg` porque o token `bg` vira `'transparent'` sob papel de parede,
   * e uma sombra transparente apagaria a fase. Ver `astro/moon.ts`.
   */
  moonShade: string;
  /**
   * Cor do halo atrás da lua — a **tinta do tema**, e é a mesma regra que
   * produz coisas opostas nos dois esquemas: no claro a tinta é quase preta e o
   * halo vira uma sombra suave que dá chão ao disco; no escuro ela é quase
   * branca e o halo vira luar. Sai na temperatura do tema de graça — creme no
   * Orbe, neutra no Clean. A opacidade está em `MOON_GLOW_ALPHA`.
   */
  moonGlow: string;
}

const ROLE_KEYS: RoleKey[] = [
  'orange', 'red', 'rose', 'purple', 'blue', 'teal', 'green', 'yellow', 'brown', 'deep', 'ink',
];

const cache = new Map<string, ResolvedTokens>();

/**
 * Resolve o mapa completo de tokens. Memoizado: é chamado no caminho de render
 * dos dois apps, e são no máximo 24 resultados possíveis.
 */
export function resolveTokens(
  themeId: string | null | undefined,
  scheme: ColorScheme,
  paletteId: string | null | undefined,
  brandId?: string | null,
): ResolvedTokens {
  const theme = resolveTheme(themeId);
  const palette = resolvePalette(paletteId);
  const brand = resolveBrand(brandId);
  const key = `${theme.id}:${scheme}:${palette.id}:${brand.id}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const neutrals = neutralsOf(theme, scheme);
  const historical = theme.id === 'orbe' && palette.id === 'orbe';

  const roles = {} as Record<RoleKey, RoleTokens>;
  for (const role of ROLE_KEYS) {
    const declared = palette.roles[role];
    const accent = historical
      ? (PINNED_ACCENT[scheme][role] ?? declared)
      : ensureContrast(declared, neutrals.surface, GRAPHIC_FLOOR);
    // O tint do papel `ink` é o neutro do tema — ver a nota em `ThemeNeutrals`.
    const soft =
      role === 'ink'
        ? neutrals.inkSoft
        : historical
          ? (PINNED_SOFT[scheme][role] ?? softOf(accent, scheme))
          : softOf(accent, scheme);
    roles[role] = { accent, soft, on: onTintOf(accent, soft) };
  }

  // A marca `tinta` não tem cor própria: usa a tinta do tema, que já é preta no
  // claro e clara no escuro — e no tom de cada tema, não num preto absoluto.
  const brandBase = brand.base ? brand.base[scheme] : neutrals.ink;
  const brandDeep = brand.deep
    ? brand.deep[scheme]
    : shiftLightness(brandBase, scheme === 'light' ? -0.07 : 0.07);
  const brandSoft = brand.soft ? brand.soft[scheme] : softOf(brandBase, scheme);

  const tokens: ResolvedTokens = {
    ...neutrals,
    roles,
    primary: brandBase,
    primaryDeep: brandDeep,
    primarySoft: brandSoft,
    primaryOn: onTintOf(brandBase, brandSoft),
    // Contra o preenchimento cheio, não contra o tint — é o “+” dentro do FAB.
    // Quando a marca declara, a escolha do autor vence: o `laranja` quer branco,
    // que o automático rejeitaria por preferir o preto de contraste maior.
    onPrimary:
      brand.on?.[scheme] ??
      (contrast('#FFFFFF', brandBase) >= contrast('#000000', brandBase) ? '#FFFFFF' : '#000000'),
    primaryOutline: brand.outline?.[scheme] ?? 'transparent',
    yellow: roles.yellow.accent, yellowSoft: roles.yellow.soft, yellowOn: roles.yellow.on,
    green: roles.green.accent, greenSoft: roles.green.soft, greenOn: roles.green.on,
    rose: roles.rose.accent, roseSoft: roles.rose.soft, roseOn: roles.rose.on,
    blue: roles.blue.accent, blueSoft: roles.blue.soft, blueOn: roles.blue.on,
    casa: roles.brown.accent, casaSoft: roles.brown.soft, casaOn: roles.brown.on,
    teal: roles.teal.accent, tealSoft: roles.teal.soft, tealOn: roles.teal.on,
    red: roles.red.accent, redSoft: roles.red.soft, redOn: roles.red.on,
    purple: roles.purple.accent, purpleSoft: roles.purple.soft, purpleOn: roles.purple.on,
    inkOn: roles.ink.on,
    moonShade: neutrals.bg,
    moonGlow: neutrals.ink,
  };
  cache.set(key, tokens);
  return tokens;
}

/** Par tint/acento de um módulo, com o primeiro plano legível já resolvido. */
export interface ModuleTokens {
  tint: string;
  accent: string;
  /** Use este — e não `accent` — para ícone ou texto **dentro** do `tint`. */
  onTint: string;
}

export function moduleOf(
  key: string,
  themeId: string | null | undefined,
  scheme: ColorScheme,
  paletteId: string | null | undefined,
  /** Módulo usado quando `key` não é conhecido. Cada tela tem o seu natural. */
  fallback: ModuleKey = 'habito',
): ModuleTokens {
  const tokens = resolveTokens(themeId, scheme, paletteId);
  const map = MODULE_ROLE as Record<string, RoleKey>;
  const role = map[key] ?? map[fallback];
  const r = tokens.roles[role];
  return { tint: r.soft, accent: r.accent, onTint: r.on };
}

/**
 * Papéis de parede que fazem sentido oferecer num tema, no esquema dado.
 *
 * Duas exclusões, ambas por redundância — um seletor que oferece opções
 * indistinguíveis lê como defeito, não como escolha:
 *
 * 1. **Decorativos** somem nos temas que abrem mão deles (`clean`, `cleanElev`).
 * 2. **`pure` some quando o tema já tem fundo neutro puro.** No Clean, `bg` e
 *    `bgPure` são o mesmo hex — branco no claro, preto no escuro — e `flat` e
 *    `pure` pintavam exatamente a mesma tela. Só no Orbe, cujo fundo é creme, o
 *    `pure` tem o que dizer.
 */
export function wallpapersFor(
  themeId: string | null | undefined,
  scheme: ColorScheme,
): readonly { id: Wallpaper; label: string }[] {
  const theme = resolveTheme(themeId);
  const n = neutralsOf(theme, scheme);
  return WALLPAPERS.filter((w) => {
    if (w.id === 'pure') return n.bgPure !== n.bg;
    return theme.decorativeWallpapers || !isDecorativeWallpaper(w.id);
  });
}

/** Chaves de módulo conhecidas, na ordem em que aparecem no seletor. */
export const MODULE_KEYS = Object.keys(MODULE_ROLE) as ModuleKey[];
