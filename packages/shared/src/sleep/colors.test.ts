/**
 * A gramática de cor do sono, medida nas 36 combinações de tema.
 *
 * O que estes testes protegem: que REM, Leve e Profundo nunca voltem a ser
 * "o mesmo hex" (era assim em 22 de 36 combinações), que o Leve nunca volte a
 * ser o tint (1,1–1,4 sobre a superfície), e que a vigília — amarelo — e o REM —
 * rosa — separem do sono em visão normal e, na paleta que promete daltonismo,
 * também sob deuteranopia e protanopia.
 */
import assert from 'node:assert/strict';
import { contrast, cvdSeparation, deltaE } from '../theme/color';
import { PALETTES } from '../theme/palettes';
import { THEMES, type ColorScheme } from '../theme/themes';
import { resolveTokens } from '../theme/derive';
import { awakeDensityOpacity, sleepColorsOf, sleepCssVars } from './colors';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const SCHEMES: ColorScheme[] = ['light', 'dark'];
const COMBOS = THEMES.flatMap((t) =>
  SCHEMES.flatMap((s) =>
    PALETTES.map((p) => ({
      label: `${t.id}/${s}/${p.id}`,
      cvdSafe: p.cvdSafe,
      tokens: resolveTokens(t.id, s, p.id),
      colors: sleepColorsOf(resolveTokens(t.id, s, p.id), p.id),
    })),
  ),
);

check('sono, leve, profundo, REM e vigília passam o piso gráfico sobre a superfície', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const S = c.tokens.surface;
    for (const k of ['sleep', 'light', 'deep', 'rem', 'awake'] as const) {
      const r = contrast(c.colors[k], S);
      if (r < 3) bad.push(`${c.label} ${k} ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, [], `cor de sono abaixo do piso:\n    ${bad.join('\n    ')}`);
});

check('o Leve nunca é o tint, e a cama existe sem destacar', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const S = c.tokens.surface;
    if (c.colors.light === c.tokens.roles.blue.soft) bad.push(`${c.label} light = soft`);
    const b = contrast(c.colors.bed, S);
    if (b < 1.4 || b > 2.2) bad.push(`${c.label} bed ${b.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], bad.join('\n    '));
});

check('REM, Leve e Profundo se distinguem entre si e da vigília (ΔE ≥ 10)', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const { rem, light, deep, awake } = c.colors;
    const pairs: [string, number][] = [
      ['rem×light', deltaE(rem, light)],
      ['light×deep', deltaE(light, deep)],
      ['rem×deep', deltaE(rem, deep)],
      ['awake×light', deltaE(awake, light)],
      ['awake×rem', deltaE(awake, rem)],
    ];
    for (const [name, d] of pairs) if (d < 10) bad.push(`${c.label} ${name} ΔE ${d.toFixed(1)}`);
  }
  assert.deepEqual(bad, [], `estágios que se confundem — era o defeito de 22/36:\n    ${bad.join('\n    ')}`);
});

/**
 * O piso é 5, o mesmo que `theme.test.ts` cobra entre módulos na paleta que
 * declara `cvdSafe` — não os 8 da skill de dataviz. O rosa do REM mede 5,3
 * contra o azul sob protanopia na Acessível; o usuário, que usa essa paleta,
 * escolheu o rosa mesmo assim (05/09/2026), e este teste trava que ele não
 * caia abaixo do piso da própria paleta.
 */
check('na paleta que promete daltonismo, as cores do sono separam sob deuteranopia e protanopia', () => {
  const bad: string[] = [];
  for (const c of COMBOS.filter((x) => x.cvdSafe)) {
    const { rem, light, deep, awake } = c.colors;
    for (const kind of ['deuteranopia', 'protanopia'] as const) {
      for (const [name, a, b] of [['rem×light', rem, light], ['rem×deep', rem, deep], ['light×deep', light, deep], ['awake×light', awake, light], ['awake×rem', awake, rem]] as const) {
        const d = cvdSeparation(a, b, kind);
        if (d < 5) bad.push(`${c.label} ${kind} ${name} ${d.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(bad, [], bad.join('\n    '));
});

check('a rampa ordena: Leve mais claro que Profundo nos dois esquemas', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const S = c.tokens.surface;
    // Superfície escura: o branco contrasta mais que o preto contra ela.
    const dark = contrast('#FFFFFF', S) > contrast('#000000', S);
    // No claro "mais escuro" = mais contraste contra a superfície; no escuro, o inverso.
    const [l, d] = [contrast(c.colors.light, S), contrast(c.colors.deep, S)];
    const ok = dark ? l > d : l < d;
    if (!ok) bad.push(`${c.label} leve ${l.toFixed(2)} · profundo ${d.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], bad.join('\n    '));
});

check('as variáveis CSS e a opacidade de densidade têm a forma esperada', () => {
  const v = sleepCssVars(COMBOS[0].colors);
  assert.deepEqual(Object.keys(v).sort(), ['--sleep-awake', '--sleep-bed', '--sleep-deep', '--sleep-light', '--sleep-rem', '--sleep-sleep', '--sleep-unknown']);
  assert.equal(awakeDensityOpacity(0), 0.2);
  assert.equal(awakeDensityOpacity(1), 1);
  assert.equal(awakeDensityOpacity(2), 1);
});

console.log(`\n${passed} checks · gramática de cor do sono`);
