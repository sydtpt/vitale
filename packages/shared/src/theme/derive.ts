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
 * ## Os quatro tokens de cada papel
 *
 * | token | onde vive | garantia |
 * |---|---|---|
 * | `accent` | ponto, barra, traço sobre o fundo | ≥ 3,0 contra `surface` |
 * | `*Soft`  | preenchimento de chip/caixa | — é fundo, não precisa |
 * | `*On`    | ícone ou texto **dentro** do chip | ≥ 3,0 contra o `*Soft` |
 * | `*Text`  | texto **fora** do chip, direto na superfície | ≥ 4,5 contra `surface` |
 *
 * O terceiro existe por um defeito real encontrado no Orbe: o padrão do app é
 * ícone em `accent` sobre caixa em `tint`, e o par amarelo media **1,55** de
 * contraste — ícone `#F5B946` sobre `#FFEFC9` é quase invisível. E não tem
 * conserto pelo tint: `#F5B946` é claro demais para atingir 3,0 sobre qualquer
 * fundo claro. A saída é a mesma da Material ("on-container"): uma cor de
 * primeiro plano própria, escurecida só o quanto for preciso.
 *
 * **O quarto é o mesmo defeito na outra superfície**, e chegou tarde porque
 * ninguém tinha medido. `accent` promete 3,0 — o piso de *objeto gráfico* da
 * WCAG 1.4.11, correto para o ponto e para o traço que a linha acima descreve.
 * Texto quer 4,5 (1.4.3). Setenta e dois pontos dos dois apps pintavam texto com
 * `accent`, e 54% das combinações ficavam abaixo do piso: as estrelas de nota da
 * Cultura, em `yellow` sobre branco, mediam **1,76** — abaixo até do piso
 * gráfico. `*Text` é o `accent` empurrado até 4,5, e no escuro ele quase nunca
 * desloca, porque lá o acento já passa folgado.
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
  deltaE,
  hexToOklch,
  mix,
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
/** Piso de contraste para texto de corpo (WCAG 2.1, 1.4.3, nível AA). */
const TEXT_FLOOR = 4.5;

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

/**
 * Cor do papel quando ele é **texto direto na superfície** — link, rótulo de
 * botão de texto, número em destaque. Use este e não `accent`: aquele promete o
 * piso gráfico de 3,0, que é o do traço, não o da letra.
 */
export function textOf(accent: string, surface: string): string {
  return ensureContrast(accent, surface, TEXT_FLOOR);
}

/* ─────────────── Rampa ordinal, traço e lavagem ─────────────── */

/** Move a luminosidade e escala o chroma, mantendo o matiz. */
function step(hex: string, l: number, cScale = 1): string {
  const o = hexToOklch(hex);
  return oklchToHex({ l, c: o.c * cScale, h: o.h });
}

/** Piso da ponta clara de uma rampa ordinal (dataviz: ≥ 2,0 sobre a superfície). */
const RAMP_PALE_FLOOR = 2;
/** Separação mínima entre degraus vizinhos, em ΔE OKLab ×100 — abaixo disso é "parecido". */
const RAMP_STEP_DE = 10;
/** Contraste-alvo da lavagem: existe, mas não destaca. */
const WASH_CONTRAST = 1.6;

/** Três degraus de um papel, do mais claro ao mais escuro. */
export interface RoleRamp {
  /** Ponta clara — ≥ 2,0 sobre a superfície. Serve a um degrau ordinal, não a um traço sozinho. */
  pale: string;
  /** O meio — o traço gráfico do papel, salvo quando o piso obriga a rampa a subir no escuro. */
  mid: string;
  /** Degrau escuro — ≥ 3,0 sobre a superfície nos dois esquemas. */
  strong: string;
}

/**
 * Rampa ordinal de três degraus a partir do traço gráfico de um papel.
 *
 * Existe porque a tela de Sono desenhava os estágios com `soft` (o tint, 1,1–1,4
 * sobre a superfície) e `text` (que é o próprio `accent` sempre que ele passa em
 * 4,5 — ou seja, em todo o escuro). Eram tokens de UI fazendo o papel de degraus
 * de uma rampa que o tema não tinha; REM e Profundo saíam com o mesmo hex em 22
 * das 36 combinações. A rampa é derivada e medida, não autorada.
 *
 * "Mais fundo = mais escuro" vale nos dois esquemas. No escuro o piso empurra o
 * degrau escuro para **cima**; quando ele encosta no meio (paletas cujo acento já
 * raspa o piso — Terra, Joia, Acessível), a rampa inteira sobe e o meio deixa de
 * ser o traço exato, mas a ordem se mantém. `theme.test.ts` cobra os três pisos e
 * as duas separações nas 36 combinações.
 */
export function rampOf(graphic: string, surface: string, scheme: ColorScheme): RoleRamp {
  const dark = scheme === 'dark';
  const L = (h: string): number => hexToOklch(h).l;
  const aL = L(graphic);

  let pale = step(graphic, Math.min(dark ? 0.9 : 0.8, aL + (dark ? 0.13 : 0.15)), dark ? 0.7 : 0.75);
  pale = ensureContrast(pale, surface, RAMP_PALE_FLOOR);
  let mid = graphic;
  let strong = ensureContrast(step(graphic, aL - (dark ? 0.15 : 0.17), dark ? 1 : 1.05), surface, GRAPHIC_FLOOR);

  if (dark) {
    if (deltaE(strong, mid) < RAMP_STEP_DE) {
      const sl = L(strong);
      mid = step(graphic, sl + 0.13, 0.95);
      pale = step(graphic, sl + 0.26, 0.7);
    }
    // Papéis já muito claros no escuro (o amarelo, a L 0,83) não têm para onde
    // subir só em luminosidade; a ponta clara se afasta também perdendo chroma —
    // é o que "pálido" quer dizer.
    for (let i = 0; i < 12 && deltaE(pale, mid) < RAMP_STEP_DE; i += 1) {
      const o = hexToOklch(pale);
      pale = oklchToHex({ l: Math.min(0.97, o.l + 0.02), c: o.c * 0.85, h: o.h });
    }
  } else {
    for (let i = 0; i < 12 && deltaE(strong, mid) < RAMP_STEP_DE; i += 1) strong = step(strong, L(strong) - 0.02);
    for (let i = 0; i < 12 && deltaE(pale, mid) < RAMP_STEP_DE; i += 1) {
      const up = step(pale, L(pale) + 0.02);
      if (contrast(up, surface) < RAMP_PALE_FLOOR) break;
      pale = up;
    }
  }
  return { pale, mid, strong };
}

/**
 * Lavagem de um papel: o traço misturado na superfície até `WASH_CONTRAST`.
 * É um fundo de gráfico que existe — a janela na cama, a faixa p25–p75 — e
 * não o `soft`, que é tint de chip e mede 1,1–1,4 sobre a superfície.
 */
export function washOf(graphic: string, surface: string): string {
  let lo = 0;
  let hi = 1;
  let best = graphic;
  for (let i = 0; i < 24; i += 1) {
    const t = (lo + hi) / 2;
    const cand = mix(graphic, surface, t);
    if (contrast(cand, surface) >= WASH_CONTRAST) {
      best = cand;
      lo = t;
    } else {
      hi = t;
    }
  }
  return best;
}

/* ─────────────── Pinos históricos: orbe × orbe ─────────────── */

const PINNED_ACCENT: Record<ColorScheme, Partial<Record<RoleKey, string>>> = {
  light: {},
  dark: {
    green: '#7FB97A', rose: '#E87B98', blue: '#84A0DA', brown: '#C49A72',
    teal: '#5FB3A4', red: '#F07A7A', purple: '#A98BCB', deep: '#FF6A3C',
    // O `ink` faltava aqui, e no caminho histórico ninguém corrige o que não
    // está pinado: o acento caía no `#1F1B16` declarado e media **1,01** sobre
    // a superfície escura — invisível. Não era só gráfico: `MODULE_ROLE.financas`
    // aponta para este papel, então o módulo inteiro pintava quase-preto no
    // escuro. O valor é o grafite quente do tema, entre `ink4` e `ink3`, com
    // folga sobre o piso (3,52 na superfície, 3,83 no fundo) em vez de raspá-lo.
    ink: '#767065',
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

/** Tokens de um papel cromático. */
export interface RoleTokens {
  accent: string;
  soft: string;
  on: string;
  /** Texto do papel sobre a superfície do tema. Ver a tabela no topo. */
  text: string;
  /**
   * O papel como **traço de gráfico**: o acento empurrado até o piso de 3,0 sobre
   * a superfície, **sem pino histórico**. Difere do `accent` só onde o pino o
   * deixa abaixo do piso — o amarelo e o verde do Orbe claro (1,76 e 2,81), que
   * como traço sempre precisaram de contorno. Marca de dado lê este.
   */
  graphic: string;
  /** Fundo de gráfico que existe sem destacar (≈1,6 sobre a superfície). Ver `washOf`. */
  wash: string;
  /** Três degraus ordinais a partir do `graphic`. Ver `rampOf`. */
  ramp: RoleRamp;
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
  yellow: string; yellowSoft: string; yellowOn: string; yellowText: string;
  green: string; greenSoft: string; greenOn: string; greenText: string;
  rose: string; roseSoft: string; roseOn: string; roseText: string;
  blue: string; blueSoft: string; blueOn: string; blueText: string;
  casa: string; casaSoft: string; casaOn: string; casaText: string;
  teal: string; tealSoft: string; tealOn: string; tealText: string;
  red: string; redSoft: string; redOn: string; redText: string;
  purple: string; purpleSoft: string; purpleOn: string; purpleText: string;
  /** `inkOn` fecha o quarteto do papel `ink`, cujo tint é o `inkSoft` do tema. */
  inkOn: string;
  /**
   * Texto da marca sobre a superfície. Existe pela mesma razão que os `*Text`
   * dos papéis: `primary` é escolhido como cor de preenchimento e de cromo, e
   * oito das 24 combinações de tema × marca ficam abaixo de 4,5 como texto — a
   * marca `verde` no claro mede **2,09** sobre branco.
   */
  primaryText: string;
  /**
   * A marca como **traço sobre o fundo**, e não como preenchimento.
   *
   * O irmão do `primaryText` no outro piso: aquele cobra 4,5 porque é letra,
   * este cobra os 3,0 de objeto gráfico (WCAG 1.4.11). A distância entre os dois
   * não é acadêmica — é o que decide se o `laranja` continua sendo `#F25C2B`.
   * Ele mede 3,31 sobre a superfície: passa aqui intacto e reprovaria no
   * `primaryText`, que o escureceria. A promessa de não mexer no Orbe depende
   * deste piso ser o certo, não o mais alto.
   *
   * Existe porque o “+” da barra virou **vazado**: sem preenchimento, quem
   * separa o botão do fundo é o aro. Enquanto ele era tinta cheia esse papel era
   * do `primary` (e, no `verde` fluorescente, do contorno preto — ver
   * `primaryOutline`); num controle sem preenchimento nenhum dos dois serve.
   */
  primaryGraphic: string;
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
    const graphic = ensureContrast(accent, neutrals.surface, GRAPHIC_FLOOR);
    roles[role] = {
      accent,
      soft,
      on: onTintOf(accent, soft),
      text: textOf(accent, neutrals.surface),
      graphic,
      wash: washOf(graphic, neutrals.surface),
      ramp: rampOf(graphic, neutrals.surface, scheme),
    };
  }

  // A marca `tinta` não tem cor própria: usa a tinta do tema, que já é preta no
  // claro e clara no escuro — e no tom de cada tema, não num preto absoluto.
  const brandBase = brand.base ? brand.base[scheme] : neutrals.ink;
  const brandDeep = brand.deep
    ? brand.deep[scheme]
    : shiftLightness(brandBase, scheme === 'light' ? -0.07 : 0.07);
  const brandSoft = brand.soft ? brand.soft[scheme] : softOf(brandBase, scheme);
  /**
   * Contra qual neutro o piso gráfico é cobrado.
   *
   * O “+” vazado flutua sobre o `bg` da tela, atravessando o vidro da barra;
   * outros traços da marca caem sobre `surface`. Os dois neutros ficam perto —
   * creme contra branco no claro, dois quase-pretos no escuro — mas **qual dos
   * dois é o mais duro depende da marca**, não do esquema: contra um `bg` mais
   * escuro o `verde` fluorescente ganha contraste e a `tinta` do modo claro
   * perde. Cobrar contra um fixo deixaria um dos dois casos passar por fora,
   * então o piso é cobrado contra o pior dos dois.
   */
  const graphicAnchor =
    contrast(brandBase, neutrals.bg) < contrast(brandBase, neutrals.surface)
      ? neutrals.bg
      : neutrals.surface;

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
    yellow: roles.yellow.accent, yellowSoft: roles.yellow.soft, yellowOn: roles.yellow.on, yellowText: roles.yellow.text,
    green: roles.green.accent, greenSoft: roles.green.soft, greenOn: roles.green.on, greenText: roles.green.text,
    rose: roles.rose.accent, roseSoft: roles.rose.soft, roseOn: roles.rose.on, roseText: roles.rose.text,
    blue: roles.blue.accent, blueSoft: roles.blue.soft, blueOn: roles.blue.on, blueText: roles.blue.text,
    casa: roles.brown.accent, casaSoft: roles.brown.soft, casaOn: roles.brown.on, casaText: roles.brown.text,
    teal: roles.teal.accent, tealSoft: roles.teal.soft, tealOn: roles.teal.on, tealText: roles.teal.text,
    red: roles.red.accent, redSoft: roles.red.soft, redOn: roles.red.on, redText: roles.red.text,
    purple: roles.purple.accent, purpleSoft: roles.purple.soft, purpleOn: roles.purple.on, purpleText: roles.purple.text,
    inkOn: roles.ink.on,
    primaryText: textOf(brandBase, neutrals.surface),
    primaryGraphic: ensureContrast(brandBase, graphicAnchor, GRAPHIC_FLOOR),
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
 * O tema dá **preenchimento próprio** ao card, ou o card é só um contorno?
 *
 * `surface === bg` significa que o card é a mesma cor da página, e quem o
 * delimita é a linha — está na docstring do `clean` desde que ele existe:
 * *"o card não tem preenchimento próprio — é o mesmo branco (ou o mesmo preto)
 * do fundo, e o que o delimita é uma linha fina."*
 *
 * Existe como função, e não como campo no tema, para não haver duas fontes que
 * possam discordar: quem responde é o hex, não uma declaração paralela. E não é
 * o mesmo que `cardChrome`, que separa **sombra de linha** — o `cleanElev` não
 * tem sombra e ainda assim preenche, com um degrau de superfície.
 *
 * A resposta é a mesma nos dois esquemas de cada tema, e `highlight-roles.test.ts`
 * cobra isso: um componente que mudasse de casca com o esquema ganharia duas
 * gramáticas, que é justamente o que a ADR 0022 rejeitou.
 */
export function fillsCards(
  themeId: string | null | undefined,
  scheme: ColorScheme,
): boolean {
  const n = neutralsOf(resolveTheme(themeId), scheme);
  return n.surface !== n.bg;
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
