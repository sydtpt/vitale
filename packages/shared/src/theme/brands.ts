/**
 * Marcas — a **cor principal do cromo**: o botão “+”, os CTAs, o Salvar, os
 * toggles, o CheckButton, os estados ativos. Quarto eixo, independente dos
 * outros três.
 *
 * ## Por que não é a paleta
 *
 * Até aqui `primary` saía do papel `orange` da paleta ativa, e como todas as
 * seis mantêm o laranja quente na faixa do treino, **o cromo do app era laranja
 * em qualquer paleta**. Soltar essa amarra é o ponto deste arquivo.
 *
 * A separação também é semântica, e o código já concordava com ela antes de
 * existir: os 106 usos de `colors.primary` no mobile são todos cromo — nenhum
 * carrega sentido de “treino”, que vem de `moduleColors('treino')`. Escolher
 * marca azul deixa o “+” azul e o chip de Treino laranja, e isso é correto: um
 * é a voz do app, o outro é a identidade de um módulo.
 *
 * ## `onPrimary` não é enfeite
 *
 * Com a marca `tinta`, o preenchimento vira quase branco no modo escuro — e os
 * 95 `#fff` cravados pelo app viravam branco sobre branco. `onPrimary` é a cor
 * de conteúdo **sobre o preenchimento sólido** (o “+” dentro do FAB), calculada
 * para o piso de contraste. É o `onPrimary` da Material; o `primaryOn` dos
 * papéis é o equivalente ao `onPrimaryContainer` — um vai sobre a cor cheia, o
 * outro sobre o tint.
 */

export type BrandId = 'laranja' | 'tinta' | 'azul' | 'verde';

export interface Brand {
  id: BrandId;
  name: string;
  hint: string;
  /**
   * Cor base por esquema. `null` significa "a tinta do tema" — preto no claro,
   * branco no escuro, no tom de cada tema em vez de um preto absoluto: no Orbe
   * sai o preto quente, no Clean o neutro frio.
   */
  base: { light: string; dark: string } | null;
  /**
   * Variante de ênfase (pressionado, gradiente, destaque). `null` deriva da
   * base. Os valores do `laranja` são os históricos do app.
   */
  deep: { light: string; dark: string } | null;
  /**
   * Tint da marca. `null` deriva de `softOf(base)`.
   *
   * O `laranja` traz os valores à mão porque são os que já estão na tela de
   * quem usa o app: a derivação daria `#FFE1D8` no claro contra o `#FFE3D2`
   * histórico. É diferença de um passo, mas a promessa de não mexer no Orbe é
   * literal — e foi o teste de não-regressão que cobrou.
   */
  soft: { light: string; dark: string } | null;
  /**
   * Conteúdo sobre o preenchimento cheio. `null` escolhe automaticamente entre
   * branco e preto pelo maior contraste.
   *
   * O `laranja` declara branco à mão porque o automático escolheria preto (6,34
   * contra 3,31) — e branco sobre laranja é o que o app sempre teve. Os 3,31
   * passam com folga no piso de 3,0 de objeto gráfico, que é o que o “+” de
   * 28px é. O `verde`, ao contrário, fica no automático: fluorescente daquele
   * jeito ele rejeita branco (2,24) e pede preto (9,39).
   */
  on: { light: string; dark: string } | null;
  /**
   * Contorno em volta do preenchimento. `null` = sem contorno.
   *
   * Existe para o azul e o verde fluorescentes, onde a linha preta é o que dá
   * a eles o caráter de adesivo em vez de mancha de cor. **No escuro ela some**,
   * porque preto sobre quase-preto não tem contraste — é consequência aceita de
   * pedir “borda preta” e não “borda da tinta do tema”.
   */
  outline: { light: string; dark: string } | null;
}

export const BRANDS: readonly Brand[] = [
  {
    id: 'laranja',
    name: 'Laranja',
    hint: 'A cor original do Orbe',
    base: { light: '#F25C2B', dark: '#F25C2B' },
    deep: { light: '#D9491B', dark: '#FF6A3C' },
    soft: { light: '#FFE3D2', dark: '#3A241A' },
    on: { light: '#FFFFFF', dark: '#FFFFFF' },
    outline: null,
  },
  {
    id: 'tinta',
    name: 'Tinta',
    hint: 'Preto no claro, branco no escuro',
    base: null,
    deep: null,
    soft: null,
    on: null,
    outline: null,
  },
  {
    id: 'azul',
    name: 'Azul',
    hint: 'Elétrico, com contorno preto',
    base: { light: '#0A63FF', dark: '#0B7BFF' },
    deep: { light: '#0049CC', dark: '#3D95FF' },
    soft: null,
    on: { light: '#FFFFFF', dark: '#FFFFFF' },
    outline: { light: '#000000', dark: '#000000' },
  },
  {
    id: 'verde',
    name: 'Verde',
    hint: 'Fluorescente, com contorno preto',
    base: { light: '#00C853', dark: '#12D66B' },
    deep: { light: '#00A344', dark: '#3FE88A' },
    soft: null,
    // `null`: o automático já escolhe preto (9,39 contra 2,24 do branco).
    on: null,
    outline: { light: '#000000', dark: '#000000' },
  },
];

export const DEFAULT_BRAND_ID: BrandId = 'laranja';

const BY_ID = new Map<string, Brand>(BRANDS.map((b) => [b.id, b]));

export function isBrandId(id: string): id is BrandId {
  return BY_ID.has(id);
}

/** Resolve uma marca com fallback seguro. */
export function resolveBrand(id: string | null | undefined): Brand {
  return (id != null ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_BRAND_ID)!;
}
