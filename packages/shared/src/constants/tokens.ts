/**
 * Vitale — Design Tokens
 * Single source of truth for colors, spacing, typography across web & mobile.
 *
 * As cores aqui são o **recorte histórico** do sistema de temas: tema `orbe`,
 * esquema claro, paleta `orbe`. Quem precisa responder à escolha do usuário usa
 * `resolveTokens()`/`moduleOf()` de `theme/derive.ts`; estes exports continuam
 * porque muito código ainda lê um valor fixo, e mudá-los todos de uma vez seria
 * uma refatoração maior que a feature.
 */
import { moduleOf, MODULE_KEYS } from '../theme/derive';
import type { ModuleKey } from '../theme/palettes';

export type { ModuleKey };

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
/**
 * Par tint/acento por módulo, **derivado** de (tema `orbe`, esquema claro,
 * paleta `orbe`) — os mesmos valores que este objeto trazia escritos à mão,
 * agora com uma fonte só. Ver `theme/derive.ts`.
 *
 * A ADR 0017 dizia que `MOD` esgotava a paleta quente na nona cor porque cada
 * módulo novo exigia escolher um hex livre à mão. Com os papéis cromáticos isso
 * deixa de ser verdade da mesma forma: o limite agora é **quantas faixas o olho
 * separa**, e é medido por `theme.test.ts` em vez de julgado. A décima entrada
 * (`saude`) entra por aqui sem ADR nova; a partir da décima primeira, o teste
 * de separação é quem decide.
 *
 * **Uma correção vem junto:** `compras` trazia `tint: '#FFE3D2'` — o tint do
 * laranja — com acento rosa. Copiar-colar antigo. Derivado, o módulo rosa passa
 * a vestir o tint rosa (`#FBE2E8`).
 *
 * Prefira `moduleOf()` em código novo: ele responde à paleta e ao tema
 * escolhidos, e traz o `onTint` — a cor legível **dentro** do chip, que este
 * mapa não tem.
 */
export const MOD: Record<ModuleKey, { tint: string; accent: string }> = Object.fromEntries(
  MODULE_KEYS.map((k) => {
    const m = moduleOf(k, 'orbe', 'light', 'orbe');
    return [k, { tint: m.tint, accent: m.accent }];
  }),
) as Record<ModuleKey, { tint: string; accent: string }>;

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
/**
 * Pilhas de fonte no formato CSS — **web apenas**.
 *
 * O `fontFamily` do React Native não aceita pilha nem fallback: ele quer o nome
 * de uma família registrada, e o peso vem no nome (um arquivo por peso). Por
 * isso o mobile mantém a sua própria tabela em `mobile/src/theme/tokens.ts`, e
 * as duas precisam ser trocadas juntas.
 *
 * A web consome isto pelas variáveis `--font-*` de `web/src/styles.scss`.
 */
export const fonts = {
  sans: "'Manrope', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
  serif: "'Instrument Serif', Georgia, serif",
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
