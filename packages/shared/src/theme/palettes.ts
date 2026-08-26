/**
 * Paletas — o sistema **cromático**. Nada de superfície mora aqui; neutro vem
 * do tema (`themes.ts`), e os dois eixos se combinam em `derive.ts`.
 *
 * Uma paleta é um mapa de **papéis**, não uma lista de cores. O papel é a
 * identidade estável — `orange` é sempre a faixa do treino, `blue` sempre a da
 * água — e é o que faz a troca de paleta mudar o clima do app sem apagar o que
 * o usuário já aprendeu a reconhecer.
 *
 * ## Como as cinco de caráter foram construídas
 *
 * Não à mão, cor por cor: as quatro derivadas partem do Orbe e se movem em
 * **chroma × luminosidade**, com o matiz quase parado (rotação ≤ 14°). Isso
 * garante a preservação de família por construção — laranja continua quente,
 * azul continua frio, verde continua vegetal — e ainda dá quatro caracteres
 * genuinamente distintos, um por quadrante:
 *
 * |            | chroma baixo | chroma alto |
 * |------------|--------------|-------------|
 * | mais claro | `bruma`      | `neon`      |
 * | mais escuro| `terra`      | `joia`      |
 *
 * **Uma paleta só-fria foi tentada e descartada.** Comprimir o círculo inteiro
 * na metade fria inverte as famílias — comida virava pêssego, água virava
 * oliva — e colava laranja/vermelho/rosa no mesmo teal (separação 2,7). Faixa
 * cromática e semântica não são independentes; quem escolher "preserva a
 * família" está escolhendo, junto, não ter paleta monocromática.
 *
 * ## A `acessivel` é de outra natureza
 *
 * As outras cinco otimizam estética; esta otimiza separação sob daltonismo, e
 * mede 8,0 de separação mínima sob deuteranopia contra 0,4–1,1 das demais.
 * Vem de Okabe–Ito, que tem **7 cromáticas + preto** para os 10 módulos do app.
 * Os dois papéis que sobram (`purple` e `red`) são variações de luminosidade de
 * um matiz já usado: daltonismo preserva luminância, então claro/escuro do mesmo
 * matiz continua separável — o que um matiz novo não garantiria.
 */

/**
 * Os oito papéis das séries de gráfico. Mantido como tipo próprio porque
 * `chart/palettes.ts` o expõe há tempo e a web o importa direto.
 */
export interface PaletteRoles {
  orange: string;
  blue: string;
  green: string;
  yellow: string;
  rose: string;
  brown: string;
  deep: string;
  ink: string;
}

/**
 * Papéis cromáticos do app. Os oito primeiros são os das séries de gráfico; os
 * três últimos existem porque o app tem 10 módulos e os gráficos, 8 séries.
 * Ver `MODULE_ROLE` abaixo para a ponte com os módulos.
 */
export interface AppPaletteRoles extends PaletteRoles {
  teal: string;
  purple: string;
  red: string;
}

export interface AppPalette {
  id: PaletteId;
  name: string;
  hint: string;
  roles: AppPaletteRoles;
  /**
   * `true` quando a paleta foi construída para separação sob daltonismo e é
   * testada contra esse piso. As estéticas não prometem isso.
   */
  cvdSafe: boolean;
}

export type PaletteId = 'orbe' | 'bruma' | 'terra' | 'neon' | 'joia' | 'acessivel';

/** Módulo do app → papel cromático. É aqui que "família semântica" vira código. */
export const MODULE_ROLE = {
  treino: 'orange',
  food: 'yellow',
  agua: 'blue',
  habito: 'green',
  casa: 'brown',
  compras: 'rose',
  financas: 'ink',
  tarefa: 'teal',
  cultura: 'purple',
  saude: 'red',
} as const satisfies Record<string, keyof AppPaletteRoles>;

export type ModuleKey = keyof typeof MODULE_ROLE;

export const PALETTES: readonly AppPalette[] = [
  {
    id: 'orbe',
    name: 'Orbe',
    hint: 'A original — quente e orgânica',
    cvdSafe: false,
    roles: {
      orange: '#F25C2B', red: '#E05C5C', rose: '#E26A8A', purple: '#8B6BB1',
      blue: '#6E8CC9', teal: '#4F9D90', green: '#6FA86A', yellow: '#F5B946',
      brown: '#B4825B', deep: '#D9491B', ink: '#1F1B16',
    },
  },
  {
    id: 'bruma',
    name: 'Bruma',
    hint: 'Pastéis lavados, de baixo contraste',
    cvdSafe: false,
    // O pastel do Bruma vive no tint, não em achatar o acento: a primeira
    // versão saiu com chroma 0,55 e tudo elevado por igual, e o teste acusou
    // treino×saúde a 3,0 e compras×saúde a 2,7 — sobre superfície branca o
    // `ensureContrast` empurrava todos ao mesmo piso e apagava a diferença de
    // luminosidade que restava. Chroma maior e luminosidade espalhada no trio
    // quente resolvem sem endurecer a paleta.
    roles: {
      orange: '#E5824D', red: '#C16754', rose: '#F4999F', purple: '#A080B0',
      blue: '#97A3D2', teal: '#74ABA8', green: '#8BBF98', yellow: '#EFD283',
      brown: '#BD9D7C', deep: '#C76937', ink: '#2A2A33',
    },
  },
  {
    id: 'terra',
    name: 'Terra',
    hint: 'Terrosos dessaturados — terracota, oliva e ocre',
    cvdSafe: false,
    roles: {
      orange: '#BC6056', red: '#AC5D67', rose: '#AF6A85', purple: '#6A618C',
      blue: '#5F7A9C', teal: '#5A8274', green: '#738B61', yellow: '#D3A56E',
      brown: '#93715F', deep: '#A54E47', ink: '#2E271F',
    },
  },
  {
    id: 'neon',
    name: 'Néon',
    hint: 'Saturação alta, quase fluorescente',
    cvdSafe: false,
    roles: {
      orange: '#FF8D3F', red: '#FF7D58', rose: '#FF8C8F', purple: '#C46FDC',
      blue: '#949EFF', teal: '#00C0C1', green: '#2FD284', yellow: '#FFE070',
      brown: '#DC9B3F', deep: '#F07300', ink: '#2B2140',
    },
  },
  {
    id: 'joia',
    name: 'Joia',
    hint: 'Escuras e encorpadas, tipo pedra preciosa',
    cvdSafe: false,
    roles: {
      orange: '#C52A00', red: '#BB1C39', rose: '#BC366A', purple: '#634392',
      blue: '#3E66A7', teal: '#0C7866', green: '#498135', yellow: '#CE8D00',
      brown: '#91582F', deep: '#A71E00', ink: '#221E28',
    },
  },
  {
    id: 'acessivel',
    name: 'Acessível',
    hint: 'Separação garantida para daltonismo (Okabe–Ito)',
    cvdSafe: true,
    roles: {
      orange: '#D55E00', red: '#863800', rose: '#CC79A7', purple: '#8B3E6B',
      blue: '#0072B2', teal: '#56B4E9', green: '#009E73', yellow: '#F0E442',
      brown: '#E69F00', deep: '#AD4B00', ink: '#2B2B2B',
    },
  },
];

export const DEFAULT_PALETTE_ID: PaletteId = 'orbe';

const BY_ID = new Map<string, AppPalette>(PALETTES.map((p) => [p.id, p]));

/**
 * Ids de paleta de gráfico que existiram antes da unificação, mapeados para a
 * paleta de app equivalente. `vivido` era o padrão dos gráficos e é
 * praticamente o Orbe; `artico` não sobreviveu (ver a nota sobre paleta fria)
 * e cai no Orbe também.
 */
const LEGACY_CHART_IDS: Record<string, PaletteId> = {
  vivido: 'orbe',
  artico: 'joia',
};

export function isPaletteId(id: string): id is PaletteId {
  return BY_ID.has(id);
}

/**
 * Resolve uma paleta com fallback seguro. Aceita os ids antigos do seletor de
 * gráficos para que quem já tinha uma preferência salva não caia no padrão.
 */
export function resolvePalette(id: string | null | undefined): AppPalette {
  if (id == null) return BY_ID.get(DEFAULT_PALETTE_ID)!;
  const direct = BY_ID.get(id);
  if (direct) return direct;
  const legacy = LEGACY_CHART_IDS[id];
  return BY_ID.get(legacy ?? DEFAULT_PALETTE_ID)!;
}
