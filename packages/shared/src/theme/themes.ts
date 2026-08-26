/**
 * Temas — o sistema de **neutros**. Nada cromático mora aqui; cor de marca e de
 * módulo vêm da paleta (`palettes.ts`), e os dois eixos se combinam em
 * `derive.ts`.
 *
 * - `orbe`      — o creme quente original. Os valores são exatamente os que o app
 *                 sempre teve; mexer aqui muda o visual de quem já usa.
 * - `clean`     — branco/preto puro, card sem preenchimento e só contorno.
 * - `cleanElev` — os mesmos extremos, card como degrau de superfície.
 *
 * **A hairline do `clean` existe só no claro, e isso é deliberado.** Com o
 * brilho típico de uso, a diferença de luminância entre `#FFFFFF` e `#F7F7F8`
 * fica abaixo do limiar perceptual — sem contorno o claro parece lavado, não
 * limpo. No escuro é o inverso: no OLED a elevação lê sozinha e a borda suja.
 * Onde a hairline não deve aparecer ela é igual ao `surface`, então o
 * componente pode desenhar a borda sempre, sem condicional.
 */

export type ColorScheme = 'light' | 'dark';

/** Neutros de um tema num esquema. Só superfície, tinta e linha. */
export interface ThemeNeutrals {
  /** Fundo da tela. */
  bg: string;
  /**
   * Fundo da página na web — o chão atrás da casca do app, um passo abaixo do
   * `bg`. Existe porque a web sempre teve esse degrau a mais (`--bg-web`), que o
   * mobile não tem: lá o `bg` já é o chão.
   */
  bgWeb: string;
  /** Fundo um degrau acima — trilhos, áreas recuadas. */
  bg2: string;
  /** Fundo mais profundo — poços, campos desabilitados. */
  bg4: string;
  /** Neutro absoluto do esquema (branco/preto), usado pelo papel de parede `pure`. */
  bgPure: string;
  /** Superfície de card. */
  surface: string;
  /** Superfície com temperatura — destaques suaves. */
  surfaceWarm: string;
  /** Superfície abafada — chips inertes, placeholders de mídia. */
  surfaceMute: string;
  /** Contorno de card. Igual ao `surface` quando o tema decide não ter borda. */
  hairline: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  line: string;
  lineDeep: string;
  lineWarm: string;
  /** Grade pontilhada do fundo. */
  dot: string;
  /**
   * Tint neutro do papel `ink`. Fica no tema, e não derivado da paleta, porque
   * o `ink` é quase acromático: derivar dele produziria um cinza morto, e o que
   * a UI quer ali é a superfície abafada do próprio tema. Foi o único papel que
   * a calibração mostrou não seguir a regra dos demais (chroma 1,7× o do
   * acento, contra ~0,24× de todos os outros).
   */
  inkSoft: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  hint: string;
  light: ThemeNeutrals;
  dark: ThemeNeutrals;
  /**
   * `false` esconde os papéis de parede decorativos, deixando só os sólidos.
   * O `clean` desliga: fundo decorativo é o oposto de limpo.
   */
  decorativeWallpapers: boolean;
  /**
   * Como o card se separa do fundo.
   *
   * - `shadow`  — sombra projetada, o jeito do Orbe.
   * - `outline` — linha de 1px e nada mais; sombra some.
   *
   * São excludentes de propósito: sombra **e** borda juntas é o visual pesado
   * que o Clean existe para não ter. `theme.test.ts` cobra que só um dos dois
   * esteja em uso por tema.
   */
  cardChrome: 'shadow' | 'outline';
}

export type ThemeId = 'orbe' | 'clean' | 'cleanElev';

const orbe: Theme = {
  id: 'orbe',
  name: 'Orbe',
  hint: 'O creme quente original',
  decorativeWallpapers: true,
  cardChrome: 'shadow',
  light: {
    bg: '#FFF7EE',
    bgWeb: '#FAF3E6',
    bg2: '#ECE3D2',
    bg4: '#E3D5BC',
    bgPure: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceWarm: '#FFEFD9',
    surfaceMute: '#F6ECDC',
    // O Orbe sempre desenhou card com a `line`; manter preserva o visual atual.
    hairline: '#EFE6D8',
    ink: '#1F1B16',
    ink2: '#5C534A',
    ink3: '#9C928A',
    ink4: '#C6BCAE',
    line: '#EFE6D8',
    lineDeep: '#E3D7C2',
    lineWarm: '#F0C9A8',
    dot: '#E0D2BC',
    inkSoft: '#EAE3D6',
  },
  dark: {
    bg: '#14110D',
    bgWeb: '#0F0C09',
    bg2: '#1C1812',
    bg4: '#2A231B',
    bgPure: '#000000',
    surface: '#1E1A15',
    surfaceWarm: '#262019',
    surfaceMute: '#241E18',
    hairline: '#2E2820',
    ink: '#F6EFE6',
    ink2: '#BDB3A6',
    ink3: '#8A8074',
    ink4: '#5C554B',
    line: '#2E2820',
    lineDeep: '#3A3329',
    lineWarm: '#3A2C20',
    dot: '#2E2820',
    inkSoft: '#2A241D',
  },
};

/**
 * Clean por **contorno**: o card não tem preenchimento próprio — é o mesmo
 * branco (ou o mesmo preto) do fundo, e o que o delimita é uma linha fina.
 *
 * A consequência que não é óbvia: **sem elevação, a hairline tem de ser visível
 * nos dois esquemas.** A regra do `cleanElev` de apagar a borda no escuro vale
 * quando existe um degrau de superfície para ler no lugar dela; aqui não existe,
 * e apagá-la faria o card deixar de existir. `theme.test.ts` cobra isso.
 */
const clean: Theme = {
  id: 'clean',
  name: 'Clean',
  hint: 'Card sem preenchimento, só contorno',
  decorativeWallpapers: false,
  cardChrome: 'outline',
  light: {
    bg: '#FFFFFF',
    bgWeb: '#FAFAFB',
    bg2: '#F7F7F9',
    bg4: '#ECECEF',
    bgPure: '#FFFFFF',
    // Igual ao fundo: quem separa é a linha.
    surface: '#FFFFFF',
    surfaceWarm: '#FAFAFB',
    surfaceMute: '#F4F4F6',
    hairline: '#E1E1E6',
    ink: '#101012',
    ink2: '#55555C',
    ink3: '#7C7C85',
    ink4: '#B8B8C0',
    line: '#EAEAEC',
    lineDeep: '#DCDCE0',
    lineWarm: '#EAEAEC',
    dot: '#E4E4E7',
    inkSoft: '#F0F0F3',
  },
  dark: {
    bg: '#000000',
    bgWeb: '#000000',
    bg2: '#0E0E11',
    bg4: '#1C1C21',
    bgPure: '#000000',
    surface: '#000000',
    surfaceWarm: '#121216',
    surfaceMute: '#16161A',
    // Visível de propósito — ver a nota acima.
    hairline: '#31313A',
    ink: '#F5F5F7',
    ink2: '#A0A0A8',
    ink3: '#7C7C86',
    ink4: '#52525A',
    line: '#26262B',
    lineDeep: '#33333B',
    lineWarm: '#26262B',
    dot: '#26262B',
    inkSoft: '#1C1C21',
  },
};

/**
 * Clean por **elevação**: o card é um degrau de superfície acima do fundo, sem
 * borda no escuro.
 *
 * Nasceu como alternativa ao `clean` para uma escolha entre os dois, e os dois
 * ficaram — são propostas diferentes o bastante para conviverem. O contorno é
 * mais gráfico e mais leve; a elevação é mais próxima do que iOS e Android
 * fazem hoje, e sustenta melhor uma tela cheia de cards empilhados.
 */
const cleanElev: Theme = {
  id: 'cleanElev',
  name: 'Clean elevado',
  hint: 'Card como degrau de superfície',
  decorativeWallpapers: false,
  cardChrome: 'outline',
  light: {
    bg: '#FFFFFF',
    bgWeb: '#F7F7F8',
    bg2: '#F1F1F3',
    bg4: '#E4E4E7',
    bgPure: '#FFFFFF',
    surface: '#F7F7F8',
    surfaceWarm: '#FAFAFB',
    surfaceMute: '#F1F1F3',
    // Visível: no claro a elevação sozinha fica abaixo do limiar perceptual.
    hairline: '#E7E7EA',
    ink: '#101012',
    ink2: '#55555C',
    ink3: '#7C7C85',
    ink4: '#B8B8C0',
    line: '#EAEAEC',
    lineDeep: '#DCDCE0',
    lineWarm: '#EAEAEC',
    dot: '#E4E4E7',
    inkSoft: '#EFEFF1',
  },
  dark: {
    bg: '#000000',
    bgWeb: '#000000',
    bg2: '#16161A',
    bg4: '#2A2A30',
    bgPure: '#000000',
    // O degrau precisa ser real. A primeira versão usava `#0E0E10`, cerca de
    // METADE do que o iOS põe sobre preto (`#1C1C1E`, o mesmo do Apple Music) —
    // e como no escuro a hairline é invisível de propósito, o card ficava sem
    // definição nenhuma. "A elevação lê sozinha no OLED" só vale se a elevação
    // existir.
    surface: '#1A1A1D',
    surfaceWarm: '#1F1F23',
    surfaceMute: '#232327',
    // Igual ao `surface`: com o degrau certo, a borda sujaria.
    hairline: '#1A1A1D',
    ink: '#F5F5F7',
    ink2: '#A0A0A8',
    ink3: '#7C7C86',
    ink4: '#52525A',
    line: '#2A2A30',
    lineDeep: '#3A3A42',
    lineWarm: '#2A2A30',
    dot: '#2A2A30',
    inkSoft: '#26262B',
  },
};

export const THEMES: readonly Theme[] = [orbe, clean, cleanElev];

export const DEFAULT_THEME_ID: ThemeId = 'orbe';

const BY_ID = new Map<string, Theme>(THEMES.map((t) => [t.id, t]));

export function isThemeId(id: string): id is ThemeId {
  return BY_ID.has(id);
}

/** Resolve um tema com fallback seguro para valor ausente ou desconhecido. */
export function resolveTheme(id: string | null | undefined): Theme {
  return (id != null ? BY_ID.get(id) : undefined) ?? orbe;
}

/** Neutros do tema no esquema pedido. */
export function neutralsOf(theme: Theme, scheme: ColorScheme): ThemeNeutrals {
  return scheme === 'dark' ? theme.dark : theme.light;
}
