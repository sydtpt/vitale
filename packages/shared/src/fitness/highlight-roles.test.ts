/**
 * O portão da tira de Recordes.
 *
 * A 0022 fechou a decisão com uma invariante que era verdadeira e não era
 * verificada: **papéis distintos dentro da mesma tela**. Um décimo segundo
 * destaque a quebraria em silêncio — sem contraste reprovado, porque cada cor
 * isolada continua passando, e sem hex novo, porque não há hex nenhum para a
 * catraca pegar. Duas cores iguais lado a lado não disparam nada. Só um teste
 * como este.
 */

import assert from 'node:assert/strict';
import { HIGHLIGHT_ROLE, HIGHLIGHT_ROWS, highlightRole } from './highlight-roles';
import { resolveTokens } from '../theme/derive';
import { contrast, deltaE } from '../theme/color';
import { THEMES } from '../theme/themes';
import { PALETTES } from '../theme/palettes';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

check('nenhuma fileira repete papel entre seus cartões', () => {
  const bad: string[] = [];
  for (const [tela, rows] of Object.entries(HIGHLIGHT_ROWS)) {
    rows.forEach((keys, i) => {
      const vistos = new Map<string, string>();
      for (const k of keys) {
        const role = highlightRole(k);
        const antes = vistos.get(role);
        if (antes) bad.push(`${tela} fileira ${i + 1}: '${k}' e '${antes}' dividem '${role}'`);
        else vistos.set(role, k);
      }
    });
  }
  assert.deepEqual(
    bad,
    [],
    `dois cartões da mesma fileira pintam igual — e é dentro da fileira que eles ` +
      `ficam lado a lado:\n    ${bad.join('\n    ')}\n` +
      `  Repetir papel entre fileiras é permitido e já acontece (\`orange\` serve ` +
      `\`longest\` e \`10000\`). Repetir dentro da fileira, não.`,
  );
});

check('todo destaque do mapa aparece em alguma fileira, e vice-versa', () => {
  const noMapa = new Set(Object.keys(HIGHLIGHT_ROLE));
  const nasTelas = new Set(Object.values(HIGHLIGHT_ROWS).flat().flat());
  const orfaos = [...noMapa].filter((k) => !nasTelas.has(k));
  const semPapel = [...nasTelas].filter((k) => !noMapa.has(k));
  assert.deepEqual(
    { orfaos, semPapel },
    { orfaos: [], semPapel: [] },
    `mapa e telas divergiram — um destaque sem papel cai no fallback 'ink' e ` +
      `colide calado com o 1 km.`,
  );
});

/**
 * O teste acima garante papéis *diferentes*; este garante que diferentes sejam
 * *distinguíveis*. Não é a mesma pergunta: dois papéis podem ser nomes distintos
 * e ainda assim colar no olho depois que a paleta os redistribui — foi como a
 * `bruma` reprovou na primeira tentativa, com treino×saúde a 3,0 de separação.
 *
 * **O piso é 3,5, o mesmo de `módulos se distinguem dentro de cada paleta`**, e
 * pela mesma razão: é catraca, não aspiração. Adotar um piso próprio e mais alto
 * aqui reprovaria de saída, e a reprovação seria informativa uma vez e ruído
 * para sempre.
 *
 * Foi este teste que rejeitou `10000 → deep`, e vale registrar o número porque
 * ele não era discutível: `orange×deep` mede **1,0** nas paletas `neon` e
 * `joia` — não "parecidos", a mesma cor. `red×deep` mede 2,7 na `acessivel`.
 * São os dois únicos pares reprovados entre os 55 possíveis, e ambos fecham o
 * cerco em volta do `deep`, que por isso não entra na tira.
 */
check('os cartões de uma fileira se distinguem em toda paleta', () => {
  const PISO = 3.5;
  const bad: string[] = [];
  for (const theme of THEMES) {
    for (const palette of PALETTES) {
      for (const scheme of ['light', 'dark'] as const) {
        const t = resolveTokens(theme.id, scheme, palette.id);
        for (const [tela, rows] of Object.entries(HIGHLIGHT_ROWS)) {
          rows.forEach((keys, row) => {
            for (let i = 0; i < keys.length; i += 1) {
              for (let j = i + 1; j < keys.length; j += 1) {
                const a = t.roles[highlightRole(keys[i] as string)].accent;
                const b = t.roles[highlightRole(keys[j] as string)].accent;
                const d = deltaE(a, b);
                if (d < PISO) {
                  bad.push(
                    `${theme.id}/${scheme}/${palette.id} ${tela} fileira ${row + 1}: ` +
                      `${keys[i]}×${keys[j]} ΔE ${d.toFixed(1)}`,
                  );
                }
              }
            }
          });
        }
      }
    }
  }
  assert.deepEqual(
    bad.slice(0, 8),
    [],
    `dois cartões da mesma fileira ficam parecidos demais:\n    ${bad.slice(0, 8).join('\n    ')}` +
      (bad.length > 8 ? `\n    …e mais ${bad.length - 8}` : ''),
  );
});

/**
 * A casca do cartão não é escolha por tema: é consequência de o tema dar, ou
 * não, um degrau de superfície ao card. `surface === bg` significa "aqui o card
 * não tem preenchimento próprio" — está na docstring do `clean` desde que ele
 * existe, e o cartão de recorde preenchido a contrariava.
 */
check('o predicado da casca separa os temas como eles se declaram', () => {
  const esperado: Record<string, 'preenchido' | 'contorno'> = {
    orbe: 'preenchido',
    clean: 'contorno',
    cleanElev: 'preenchido',
  };
  const bad: string[] = [];
  for (const theme of THEMES) {
    for (const scheme of ['light', 'dark'] as const) {
      const t = resolveTokens(theme.id, scheme, 'orbe');
      const casca = t.surface === t.bg ? 'contorno' : 'preenchido';
      if (casca !== esperado[theme.id]) {
        bad.push(`${theme.id}/${scheme} virou '${casca}', esperado '${esperado[theme.id]}'`);
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `a casca mudou de forma — e ela precisa ser a mesma nos dois esquemas do ` +
      `tema, senão o componente ganha duas gramáticas:\n    ${bad.join('\n    ')}`,
  );
});

check('a casca de contorno é legível: linha em 3,0 e número em 4,5', () => {
  const bad: string[] = [];
  for (const theme of THEMES) {
    for (const palette of PALETTES) {
      for (const scheme of ['light', 'dark'] as const) {
        const t = resolveTokens(theme.id, scheme, palette.id);
        if (t.surface !== t.bg) continue; // só as cascas de contorno
        for (const key of Object.keys(HIGHLIGHT_ROLE)) {
          const r = t.roles[highlightRole(key)];
          const linha = contrast(r.accent, t.bg);
          const numero = contrast(r.text, t.bg);
          const onde = `${theme.id}/${scheme}/${palette.id} ${key}`;
          if (linha < 3) bad.push(`${onde} linha ${linha.toFixed(2)}`);
          if (numero < 4.5) bad.push(`${onde} número ${numero.toFixed(2)}`);
        }
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    `contorno ilegível. A linha usa \`accent\` (piso gráfico 3,0) e o número usa ` +
      `\`text\` (piso de letra 4,5) — são pisos diferentes de propósito:\n    ${bad.join('\n    ')}`,
  );
});

console.log(`\n${passed} testes passaram.`);
