/**
 * A gramática de cor do sono — **uma cor, um significado**, nos dois apps.
 *
 * Antes disto cada tela decidia: o azul dizia "dormindo" na visão geral,
 * "despertar" no relógio de vigília e "fim de semana" na subview; o Leve era o
 * tint (1,1–1,4 sobre a superfície) e REM e Profundo saíam com o mesmo hex em
 * 22 das 36 combinações de tema. Review de 05/09/2026, com medição e mockups:
 * `claude.ai/code/artifact/b6db5657-2531-42c2-a91d-7c532ab10601`.
 *
 * | cor        | diz                                   | de onde vem                        |
 * |------------|---------------------------------------|------------------------------------|
 * | `sleep`    | sono — barra, mediana, série de horas | `blue.ramp.mid`                    |
 * | `light`    | sono leve (N1–N2)                     | `blue.ramp.mid` — a mesma barra    |
 * | `deep`     | sono profundo (N3)                    | `blue.ramp.strong`                 |
 * | `rem`      | REM — outro estado, não um degrau     | `rose.graphic` (Garmin faz igual)  |
 * | `awake`    | vigília — sempre, em toda tela        | `yellow.graphic`                   |
 * | `bed`      | janela na cama, faixa p25–p75         | `blue.wash`                        |
 * | `unknown`  | sono sem hipnograma — **hachura**     | `blue.ramp.mid`, em traço          |
 *
 * REM não é profundidade (sono paradoxal: cérebro ativo, corpo parado), por isso
 * tem matiz próprio. O rosa é o único papel que separa do azul **e** do amarelo
 * em visão normal nas seis paletas (ΔE ≥ 12). Sob daltonismo ele separa do azul
 * com folga em deuteranopia (≥ 11) e raspa em protanopia na Terra, na Joia e na
 * Acessível (5,3 na Acessível) — acima do piso de 5 que a própria paleta cobra
 * entre módulos, abaixo dos 8 da skill de dataviz. A primeira versão fazia o REM
 * voltar à rampa azul na Acessível; o usuário, que usa essa paleta, escolheu o
 * rosa em todas (05/09/2026). `colors.test.ts` cobra o piso 5 nas duas
 * simulações.
 *
 * Sono continua emprestando o papel da água (ADR 0031). O empréstimo do rosa tem
 * o mesmo guarda-corpo: enquanto REM e Compras não coocorrerem num gráfico, não
 * custa nada; no dia em que coocorrerem, a decisão reabre.
 */

import type { ResolvedTokens } from '../theme/derive';

export interface SleepColors {
  sleep: string;
  rem: string;
  light: string;
  deep: string;
  awake: string;
  bed: string;
  /** Cor do traço da hachura de "sem estágio". */
  unknown: string;
}

/**
 * `paletteId` fica na assinatura de propósito: a regra já dependeu da paleta e
 * pode voltar a depender (é o guarda-corpo do daltonismo); quem chama não
 * precisa mudar quando isso acontecer.
 */
export function sleepColorsOf(tokens: ResolvedTokens, _paletteId: string | null | undefined): SleepColors {
  const blue = tokens.roles.blue;
  return {
    sleep: blue.ramp.mid,
    light: blue.ramp.mid,
    deep: blue.ramp.strong,
    rem: tokens.roles.rose.graphic,
    awake: tokens.roles.yellow.graphic,
    bed: blue.wash,
    unknown: blue.ramp.mid,
  };
}

/** As mesmas cores como variáveis CSS, para a web ler `var(--sleep-rem)` etc. */
export function sleepCssVars(c: SleepColors): Record<string, string> {
  return {
    '--sleep-sleep': c.sleep,
    '--sleep-rem': c.rem,
    '--sleep-light': c.light,
    '--sleep-deep': c.deep,
    '--sleep-awake': c.awake,
    '--sleep-bed': c.bed,
    '--sleep-unknown': c.unknown,
  };
}

/** Opacidade de uma faixa do relógio de vigília: densidade 0 → 0,2, densidade 1 → 1. */
export function awakeDensityOpacity(density: number): number {
  const d = Math.min(1, Math.max(0, density));
  return 0.2 + 0.8 * d;
}
