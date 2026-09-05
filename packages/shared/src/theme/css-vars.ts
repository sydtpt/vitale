/**
 * Ponte entre os tokens resolvidos e as variáveis CSS da web.
 *
 * ## Por que em runtime, e não CSS estático
 *
 * São 3 temas × 2 esquemas × 6 paletas × 4 marcas = **144 combinações** de ~60
 * tokens. Emitir isso como CSS daria dezenas de milhares de declarações para o
 * navegador baixar e casar, das quais uma única combinação é usada. Escrever as
 * variáveis no `:root` em runtime custa uma passada de `setProperty` e mantém
 * uma fonte só — a mesma função que o mobile usa.
 *
 * O ganho colateral é que os **811 usos de `var(--…)`** que a web já tinha
 * continuam valendo sem tocar em um componente sequer: só muda de onde os
 * valores vêm.
 *
 * ## A convenção de nome
 *
 * `camelCase` → `--kebab-case`, com o dígito separado: `surfaceWarm` vira
 * `--surface-warm`, `ink2` vira `--ink-2`. Não é escolha nova — é o que
 * `web/src/styles.scss` já usava, e mudar obrigaria a reescrever os 811 usos.
 */

import type { ResolvedTokens } from './derive';
import { resolveTheme } from './themes';

/** `surfaceWarm` → `surface-warm`; `ink2` → `ink-2`. */
export function cssVarName(token: string): string {
  return `--${token.replace(/([A-Z])/g, '-$1').replace(/(\d)/g, '-$1').toLowerCase()}`;
}

/**
 * Tokens achatados em pares `--nome: valor`, prontos para `setProperty`.
 *
 * O mapa `roles` fica de fora dos aliases planos e entra com prefixo próprio
 * (`--role-orange-accent`), para quem precisa de um papel que não tem alias.
 */
export function cssVars(tokens: ResolvedTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (key === 'roles') continue;
    if (typeof value === 'string') out[cssVarName(key)] = value;
  }
  for (const [role, r] of Object.entries(tokens.roles)) {
    out[`--role-${role}`] = r.accent;
    out[`--role-${role}-soft`] = r.soft;
    out[`--role-${role}-on`] = r.on;
    out[`--role-${role}-text`] = r.text;
    out[`--role-${role}-graphic`] = r.graphic;
    out[`--role-${role}-wash`] = r.wash;
    out[`--role-${role}-pale`] = r.ramp.pale;
    out[`--role-${role}-mid`] = r.ramp.mid;
    out[`--role-${role}-strong`] = r.ramp.strong;
  }
  return out;
}

/**
 * Sombras, por tema e por esquema.
 *
 * Duas razões para não serem constantes. A do esquema: a sombra do claro — tinta
 * escura com pouca opacidade — desaparece sobre preto, onde a separação precisa
 * de opacidade maior. A do tema: os Clean separam card com uma linha de 1px e
 * **nenhuma** sombra, então lá as três viram `none` e o contorno assume.
 */
export function shadowVars(
  themeId: string | null | undefined,
  scheme: 'light' | 'dark',
): Record<string, string> {
  if (resolveTheme(themeId).cardChrome === 'outline') {
    return { '--shadow-sm': 'none', '--shadow-md': 'none', '--shadow-card': 'none' };
  }
  return scheme === 'dark'
    ? {
        '--shadow-sm': '0 1px 0 rgba(0, 0, 0, 0.5)',
        '--shadow-md': '0 6px 16px rgba(0, 0, 0, 0.45)',
        '--shadow-card': '0 12px 30px -18px rgba(0, 0, 0, 0.8)',
      }
    : {
        '--shadow-sm': '0 1px 0 rgba(31, 27, 22, 0.04)',
        '--shadow-md': '0 6px 16px rgba(31, 27, 22, 0.03)',
        '--shadow-card': '0 12px 30px -18px rgba(31, 27, 22, 0.35)',
      };
}
