/**
 * Guarda do sistema de temas. Rodar com:
 *   cd packages/shared && npx tsx src/theme/theme.test.ts
 *
 * São 3 temas × 2 esquemas × 6 paletas = **36 combinações**, mais 24 do eixo
 * de marca (tema × esquema × marca), e o ponto deste
 * arquivo é que nenhuma delas depende de alguém ter olhado. O contraste é
 * medido, não conferido: paleta ou tema novo que reprove não entra no app.
 *
 * A primeira checagem é a mais importante de todas — ela trava os hex que o
 * Orbe sempre teve. Sem ela, qualquer ajuste na derivação mudaria calado o
 * visual de quem já usa o app.
 */
import assert from 'node:assert/strict';
import { contrast, cvdSeparation, deltaE } from './color';
import { PALETTES, MODULE_ROLE, resolvePalette, type PaletteId } from './palettes';
import { THEMES, type ColorScheme, type ThemeId } from './themes';
import { shadowVars } from './css-vars';
import { BRANDS } from './brands';
import { moduleOf, resolveTokens, wallpapersFor, MODULE_KEYS, type RoleKey } from './derive';
import { ACTIVITY_ROLE, ACTIVITY_TYPE_LABELS } from '../fitness/activity-types';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const SCHEMES: ColorScheme[] = ['light', 'dark'];
const THEME_IDS = THEMES.map((t) => t.id) as ThemeId[];
const PALETTE_IDS = PALETTES.map((p) => p.id) as PaletteId[];

/** As 24 combinações, materializadas uma vez. */
const COMBOS = THEME_IDS.flatMap((t) =>
  SCHEMES.flatMap((s) => PALETTE_IDS.map((p) => ({ t, s, p, tokens: resolveTokens(t, s, p) }))),
);

const label = (c: { t: string; s: string; p: string }): string => `${c.t}/${c.s}/${c.p}`;

/** Cor de base que um papel de parede sólido pinta. Espelha `wallpaperBg` do mobile. */
function wallpaperBaseFor(t: ThemeId, s: ColorScheme, w: 'flat' | 'pure'): string {
  const k = resolveTokens(t, s, 'orbe');
  return w === 'pure' ? k.bgPure : k.bg;
}

/* ─────────────── 1. Não-regressão do Orbe ─────────────── */

/**
 * Os valores que `mobile/src/theme/index.tsx` declarava à mão antes desta
 * mudança. Se esta lista e a derivação divergirem, o app de quem já usa muda de
 * cor — e é exatamente isso que a refatoração não pode fazer.
 */
const ORBE_LIGHT: Record<string, string> = {
  bg: '#FFF7EE', bg2: '#ECE3D2', bg4: '#E3D5BC', bgPure: '#FFFFFF',
  surface: '#FFFFFF', surfaceWarm: '#FFEFD9', surfaceMute: '#F6ECDC',
  ink: '#1F1B16', ink2: '#5C534A', ink3: '#9C928A', ink4: '#C6BCAE',
  line: '#EFE6D8', lineDeep: '#E3D7C2', lineWarm: '#F0C9A8', dot: '#E0D2BC',
  primary: '#F25C2B', primaryDeep: '#D9491B', primarySoft: '#FFE3D2',
  yellow: '#F5B946', yellowSoft: '#FFEFC9', green: '#6FA86A', greenSoft: '#E2EFD9',
  rose: '#E26A8A', roseSoft: '#FBE2E8', blue: '#6E8CC9', blueSoft: '#DDE4F2',
  casa: '#B4825B', casaSoft: '#F4E6D9', teal: '#4F9D90', tealSoft: '#DDEEEA',
  red: '#E05C5C', redSoft: '#FDDEDE', purple: '#8B6BB1', purpleSoft: '#EBE3F3',
  inkSoft: '#EAE3D6',
};

const ORBE_DARK: Record<string, string> = {
  bg: '#14110D', bg2: '#1C1812', bg4: '#2A231B', bgPure: '#000000',
  surface: '#1E1A15', surfaceWarm: '#262019', surfaceMute: '#241E18',
  ink: '#F6EFE6', ink2: '#BDB3A6', ink3: '#8A8074', ink4: '#5C554B',
  line: '#2E2820', lineDeep: '#3A3329', lineWarm: '#3A2C20', dot: '#2E2820',
  primary: '#F25C2B', primaryDeep: '#FF6A3C', primarySoft: '#3A241A',
  yellow: '#F5B946', yellowSoft: '#352B17', green: '#7FB97A', greenSoft: '#1E2A1B',
  rose: '#E87B98', roseSoft: '#34212A', blue: '#84A0DA', blueSoft: '#1E2840',
  casa: '#C49A72', casaSoft: '#2E2418', teal: '#5FB3A4', tealSoft: '#15302B',
  red: '#F07A7A', redSoft: '#3A1F22', purple: '#A98BCB', purpleSoft: '#241C30',
  inkSoft: '#2A241D',
};

check('o tema Orbe devolve exatamente os hex históricos (claro)', () => {
  const got = resolveTokens('orbe', 'light', 'orbe') as unknown as Record<string, string>;
  for (const [token, want] of Object.entries(ORBE_LIGHT)) {
    assert.equal(got[token], want, `orbe/light/${token}: ${got[token]} ≠ ${want} (histórico)`);
  }
});

check('o tema Orbe devolve exatamente os hex históricos (escuro)', () => {
  const got = resolveTokens('orbe', 'dark', 'orbe') as unknown as Record<string, string>;
  for (const [token, want] of Object.entries(ORBE_DARK)) {
    assert.equal(got[token], want, `orbe/dark/${token}: ${got[token]} ≠ ${want} (histórico)`);
  }
});

/* ─────────────── 2. Contraste nas 24 combinações ─────────────── */

check('texto passa no contraste em todas as combinações', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const k = c.tokens;
    // 4,5 = WCAG AA para texto normal; 3,0 = texto grande e objeto gráfico.
    if (contrast(k.ink, k.bg) < 4.5) bad.push(`${label(c)} ink/bg ${contrast(k.ink, k.bg).toFixed(2)}`);
    if (contrast(k.ink, k.surface) < 4.5) bad.push(`${label(c)} ink/surface ${contrast(k.ink, k.surface).toFixed(2)}`);
    if (contrast(k.ink2, k.surface) < 4.5) bad.push(`${label(c)} ink2/surface ${contrast(k.ink2, k.surface).toFixed(2)}`);
    if (contrast(k.ink3, k.surface) < 3) bad.push(`${label(c)} ink3/surface ${contrast(k.ink3, k.surface).toFixed(2)}`);
  }
  assert.deepEqual(bad, [], `contraste de texto insuficiente:\n    ${bad.join('\n    ')}`);
});

check('ícone dentro do chip passa em todas as combinações', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    for (const [role, r] of Object.entries(c.tokens.roles) as [RoleKey, { on: string; soft: string }][]) {
      const ratio = contrast(r.on, r.soft);
      if (ratio < 3) bad.push(`${label(c)} ${role} on/soft ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `primeiro plano ilegível sobre o tint — é o que o token \`*On\` existe para ` +
      `impedir:\n    ${bad.join('\n    ')}`,
  );
});

check('todo módulo tem ícone legível na sua caixa', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    for (const key of MODULE_KEYS) {
      const m = moduleOf(key, c.t, c.s, c.p);
      const ratio = contrast(m.onTint, m.tint);
      if (ratio < 3) bad.push(`${label(c)} ${key} ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(bad, [], `módulo com ícone ilegível:\n    ${bad.join('\n    ')}`);
});

/**
 * A hairline ou é claramente visível, ou é deliberadamente igual ao `surface`
 * (caso do `clean` escuro, onde a elevação já lê no OLED). O que não pode
 * existir é o meio do caminho — uma borda quase imperceptível parece defeito de
 * renderização, não decisão de design.
 */
check('hairline é visível ou francamente invisível, nunca no meio', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const ratio = contrast(c.tokens.hairline, c.tokens.surface);
    if (ratio > 1.001 && ratio < 1.05) bad.push(`${label(c)} ${ratio.toFixed(3)}`);
  }
  assert.deepEqual(bad, [], `hairline ambígua:\n    ${bad.join('\n    ')}`);
});

/**
 * Um card se distingue do fundo por elevação **ou** por contorno. Quando o tema
 * abre mão da elevação — `surface` igual ao `bg` —, a borda deixa de ser
 * acabamento e vira a única coisa que define o card; apagá-la ali faz o card
 * sumir. É a armadilha do Clean por contorno no escuro, onde a regra "no OLED a
 * elevação lê sozinha" seria aplicada por hábito e não sobraria elevação nenhuma.
 */
check('card sem elevação tem contorno visível', () => {
  const bad: string[] = [];
  for (const c of COMBOS) {
    const elev = contrast(c.tokens.surface, c.tokens.bg);
    if (elev >= 1.05) continue; // tem degrau; o contorno é opcional
    const borda = contrast(c.tokens.hairline, c.tokens.surface);
    if (borda < 1.15) {
      bad.push(`${label(c)} elevação ${elev.toFixed(3)} · contorno ${borda.toFixed(2)}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `card sem elevação E sem contorno — não existe na tela:\n    ${bad.join('\n    ')}`,
  );
});

/* ─────────────── 2b. A marca ─────────────── */

/**
 * A marca é ortogonal à paleta, então não precisa multiplicar as 36: o que muda
 * com ela são só os quatro tokens de `primary`, e o que importa é como eles se
 * comportam sobre cada tema e esquema.
 */
const BRAND_COMBOS = THEME_IDS.flatMap((t) =>
  SCHEMES.flatMap((s) =>
    BRANDS.map((b) => ({ t, s, b: b.id, tokens: resolveTokens(t, s, 'orbe', b.id) })),
  ),
);

const brandLabel = (c: { t: string; s: string; b: string }): string => `${c.t}/${c.s}/${c.b}`;

/**
 * O conteúdo sobre o preenchimento cheio — o “+” dentro do FAB, o texto do botão.
 * Este é o teste que impede o modo de falha que a marca `tinta` cria: no escuro
 * ela fica quase branca, e os 95 `#fff` cravados pelo app virariam branco sobre
 * branco.
 *
 * **Piso de 3,0, não 4,5.** A primeira versão usava 4,5 (texto normal) e com
 * isso forçava preto sobre o laranja, contra os 3,31 do branco — que é o que o
 * app sempre teve. O conteúdo aqui é um ícone de 28px: objeto gráfico, cujo
 * piso na WCAG 2.1 (1.4.11) é 3,0. O 4,5 era rigor no critério errado.
 */
check('conteúdo sobre a marca é legível em toda combinação', () => {
  const bad: string[] = [];
  for (const c of BRAND_COMBOS) {
    const ratio = contrast(c.tokens.onPrimary, c.tokens.primary);
    if (ratio < 3) bad.push(`${brandLabel(c)} onPrimary/primary ${ratio.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], `botão cheio ilegível:\n    ${bad.join('\n    ')}`);
});

/**
 * Contorno é decisão estética, mas se existir tem de ser visível — do contrário
 * é custo de render sem efeito. `transparent` (marca sem contorno) passa direto.
 */
check('contorno da marca, quando existe, se distingue do preenchimento', () => {
  const bad: string[] = [];
  for (const c of BRAND_COMBOS) {
    const o = c.tokens.primaryOutline;
    if (o === 'transparent') continue;
    const ratio = contrast(o, c.tokens.primary);
    if (ratio < 1.5) bad.push(`${brandLabel(c)} contorno/preenchimento ${ratio.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], `contorno invisível sobre a própria marca:\n    ${bad.join('\n    ')}`);
});

/**
 * O FAB é um objeto gráfico sobre o fundo da tela: piso de 3,0 (WCAG 1.4.11).
 *
 * **O contorno conta.** A WCAG admite que a separação venha de uma borda
 * adjacente, e não só do preenchimento — e é isso que salva o verde
 * fluorescente, que sozinho mede 2,24 sobre branco. A borda preta que parecia
 * escolha estética é o que torna aquele verde utilizável: sem ela, a primeira
 * versão reprovou aqui em quatro combinações.
 */
check('a marca se destaca do fundo em toda combinação', () => {
  const bad: string[] = [];
  for (const c of BRAND_COMBOS) {
    const preenchimento = contrast(c.tokens.primary, c.tokens.bg);
    const contorno =
      c.tokens.primaryOutline === 'transparent'
        ? 0
        : contrast(c.tokens.primaryOutline, c.tokens.bg);
    const separacao = Math.max(preenchimento, contorno);
    if (separacao < 3) {
      bad.push(
        `${brandLabel(c)} preenchimento ${preenchimento.toFixed(2)} · contorno ${contorno.toFixed(2)}`,
      );
    }
  }
  assert.deepEqual(
    bad,
    [],
    `marca some no fundo — nem o preenchimento nem o contorno a separam:\n    ${bad.join('\n    ')}`,
  );
});

check('conteúdo sobre o tint da marca é legível', () => {
  const bad: string[] = [];
  for (const c of BRAND_COMBOS) {
    const ratio = contrast(c.tokens.primaryOn, c.tokens.primarySoft);
    if (ratio < 3) bad.push(`${brandLabel(c)} primaryOn/primarySoft ${ratio.toFixed(2)}`);
  }
  assert.deepEqual(bad, [], `tint da marca ilegível:\n    ${bad.join('\n    ')}`);
});

/**
 * A marca é cromo; a paleta é identidade de módulo. Trocar uma não pode mexer na
 * outra — é o que separa "o + ficou azul" de "o Treino ficou azul".
 */
check('trocar de marca não mexe nas cores de módulo', () => {
  const base = resolveTokens('orbe', 'light', 'orbe', 'laranja');
  for (const b of BRANDS) {
    const outra = resolveTokens('orbe', 'light', 'orbe', b.id);
    for (const key of MODULE_KEYS) {
      assert.equal(
        moduleOf(key, 'orbe', 'light', 'orbe', 'habito').accent,
        base.roles[MODULE_ROLE[key]].accent,
        `módulo ${key} mudou com a marca ${b.id}`,
      );
      assert.equal(
        outra.roles[MODULE_ROLE[key]].accent,
        base.roles[MODULE_ROLE[key]].accent,
        `módulo ${key} mudou com a marca ${b.id}`,
      );
    }
  }
});

check('as marcas se distinguem entre si', () => {
  const bad: string[] = [];
  for (const s of SCHEMES) {
    for (let i = 0; i < BRANDS.length; i += 1) {
      for (let j = i + 1; j < BRANDS.length; j += 1) {
        const a = resolveTokens('orbe', s, 'orbe', BRANDS[i].id).primary;
        const b = resolveTokens('orbe', s, 'orbe', BRANDS[j].id).primary;
        const d = deltaE(a, b);
        if (d < 10) bad.push(`${s} ${BRANDS[i].id}×${BRANDS[j].id} ${d.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `marcas parecidas demais:\n    ${bad.join('\n    ')}`);
});

/* ─────────────── 3. Completude do modelo ─────────────── */

const ROLE_KEYS: RoleKey[] = [
  'orange', 'red', 'rose', 'purple', 'blue', 'teal', 'green', 'yellow', 'brown', 'deep', 'ink',
];

check('toda paleta declara todos os papéis, com hex válido', () => {
  const bad: string[] = [];
  for (const p of PALETTES) {
    for (const role of ROLE_KEYS) {
      const v = (p.roles as unknown as Record<string, string | undefined>)[role];
      if (!v || !/^#[0-9A-Fa-f]{6}$/.test(v)) bad.push(`${p.id}.${role} = ${v}`);
    }
  }
  assert.deepEqual(bad, [], `papel ausente ou inválido: ${bad.join(', ')}`);
});

check('todo módulo do app aponta para um papel existente', () => {
  const roles = new Set<string>(ROLE_KEYS);
  const bad = Object.entries(MODULE_ROLE)
    .filter(([, role]) => !roles.has(role))
    .map(([k, role]) => `${k}→${role}`);
  assert.deepEqual(bad, [], `módulo aponta para papel inexistente: ${bad.join(', ')}`);
});

check('ids antigos do seletor de gráficos ainda resolvem', () => {
  // Quem tinha 'vivido' ou 'artico' salvo não pode cair no padrão sem aviso.
  for (const legacy of ['vivido', 'artico']) {
    const p = resolvePalette(legacy);
    assert.ok(p, `id legado ${legacy} não resolveu`);
  }
  assert.equal(resolvePalette('inexistente').id, 'orbe', 'id desconhecido deve cair no Orbe');
  assert.equal(resolvePalette(null).id, 'orbe', 'ausência deve cair no Orbe');
});

check('todo tipo de treino conhecido tem papel cromático', () => {
  const roles = new Set<string>(ROLE_KEYS);
  const semPapel = Object.keys(ACTIVITY_TYPE_LABELS)
    .map(Number)
    .filter((id) => ACTIVITY_ROLE[id] === undefined)
    .map((id) => `${id} (${ACTIVITY_TYPE_LABELS[id]})`);
  assert.deepEqual(
    semPapel,
    [],
    `tipo de treino sem cor definida — cairia no cinza de "desconhecido": ${semPapel.join(', ')}`,
  );
  const invalido = Object.entries(ACTIVITY_ROLE)
    .filter(([, role]) => !roles.has(role))
    .map(([id, role]) => `${id}→${role}`);
  assert.deepEqual(invalido, [], `papel inexistente: ${invalido.join(', ')}`);
});

/**
 * Um seletor que oferece duas opções indistinguíveis lê como defeito, não como
 * escolha. Foi o que aconteceu com `flat` e `pure` no tema Clean: lá `bg` e
 * `bgPure` são o mesmo hex, e as duas pintavam a mesma tela — o usuário trocava
 * e nada mudava.
 */
check('nenhum tema oferece dois papéis de parede que pintam igual', () => {
  const bad: string[] = [];
  for (const t of THEME_IDS) {
    for (const s of SCHEMES) {
      const oferecidos = wallpapersFor(t, s);
      const porCor = new Map<string, string>();
      for (const w of oferecidos) {
        // Só os sólidos têm cor única comparável; os decorativos desenham por cima.
        if (w.id !== 'flat' && w.id !== 'pure') continue;
        const cor = wallpaperBaseFor(t, s, w.id);
        const igual = porCor.get(cor);
        if (igual) bad.push(`${t}/${s}: ${igual} e ${w.id} pintam ${cor}`);
        porCor.set(cor, w.id);
      }
    }
  }
  assert.deepEqual(bad, [], `opções indistinguíveis no seletor:\n    ${bad.join('\n    ')}`);
});

/**
 * Duas coisas, e a primeira versão desta checagem errou ao confundi-las.
 *
 * O que **não** é invariante: "sombra e contorno são excludentes". O Orbe tem os
 * dois — card com sombra e linha — e sempre teve; era preferência estética minha
 * disfarçada de regra, e o próprio Orbe a reprovou.
 *
 * O que É invariante:
 *
 * 1. Um tema `outline` não emite sombra. É o que faz o "remover as sombras e
 *    deixar 1px" valer nos dois apps a partir de uma declaração só.
 * 2. Todo tema separa o card do fundo por **alguma** coisa — sombra, contorno ou
 *    elevação. Nenhuma das três é um card que não existe na tela.
 */
check('o cromo de card é coerente com o que o tema declara', () => {
  const bad: string[] = [];
  for (const t of THEMES) {
    for (const s of SCHEMES) {
      const k = resolveTokens(t.id, s, 'orbe');
      const sombras = shadowVars(t.id, s);
      const semSombra = Object.values(sombras).every((v) => v === 'none');
      if ((t.cardChrome === 'outline') !== semSombra) {
        bad.push(`${t.id}/${s}: cardChrome=${t.cardChrome} mas sombra=${semSombra ? 'none' : 'ativa'}`);
      }
      const contorno = contrast(k.hairline, k.surface) >= 1.15;
      const elevacao = contrast(k.surface, k.bg) >= 1.05;
      if (semSombra && !contorno && !elevacao) {
        bad.push(`${t.id}/${s}: nem sombra, nem contorno, nem elevação — o card some`);
      }
    }
  }
  assert.deepEqual(bad, [], `cromo de card incoerente:\n    ${bad.join('\n    ')}`);
});

/* ─────────────── 4. Distinção ─────────────── */

/**
 * Catraca, não barreira: `bruma` é pastel por definição e seus módulos quentes
 * ficam naturalmente próximos. O piso trava o pior caso onde está hoje (3,6) —
 * uma paleta nova não pode ser mais confusa que a mais confusa de hoje.
 */
check('módulos se distinguem dentro de cada paleta', () => {
  const bad: string[] = [];
  for (const p of PALETTES) {
    const tokens = resolveTokens('orbe', 'light', p.id);
    for (let i = 0; i < MODULE_KEYS.length; i += 1) {
      for (let j = i + 1; j < MODULE_KEYS.length; j += 1) {
        const a = tokens.roles[MODULE_ROLE[MODULE_KEYS[i]]].accent;
        const b = tokens.roles[MODULE_ROLE[MODULE_KEYS[j]]].accent;
        const d = deltaE(a, b);
        if (d < 3.5) bad.push(`${p.id} ${MODULE_KEYS[i]}×${MODULE_KEYS[j]} ${d.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `módulos indistinguíveis:\n    ${bad.join('\n    ')}`);
});

check('as paletas se distinguem entre si', () => {
  const bad: string[] = [];
  for (let i = 0; i < PALETTES.length; i += 1) {
    for (let j = i + 1; j < PALETTES.length; j += 1) {
      const mean =
        MODULE_KEYS.reduce((sum, k) => {
          const role = MODULE_ROLE[k];
          return sum + deltaE(PALETTES[i].roles[role], PALETTES[j].roles[role]);
        }, 0) / MODULE_KEYS.length;
      if (mean < 5) bad.push(`${PALETTES[i].id}×${PALETTES[j].id} ${mean.toFixed(1)}`);
    }
  }
  assert.deepEqual(
    bad,
    [],
    `paletas parecidas demais — o usuário não veria diferença ao trocar:\n    ${bad.join('\n    ')}`,
  );
});

/* ─────────────── 5. Daltonismo ─────────────── */

/**
 * Só a `acessivel` promete isso, e é por isso que ela existe fora da contagem
 * das cinco de caráter: separação sob daltonismo custa faixas cromáticas, e uma
 * paleta que a respeite não pode também ser "a mais vibrante".
 */
check('a paleta Acessível separa de verdade sob daltonismo', () => {
  const p = PALETTES.find((x) => x.cvdSafe);
  assert.ok(p, 'nenhuma paleta declara cvdSafe');
  const bad: string[] = [];
  for (const kind of ['deuteranopia', 'protanopia'] as const) {
    for (let i = 0; i < MODULE_KEYS.length; i += 1) {
      for (let j = i + 1; j < MODULE_KEYS.length; j += 1) {
        const a = p.roles[MODULE_ROLE[MODULE_KEYS[i]]];
        const b = p.roles[MODULE_ROLE[MODULE_KEYS[j]]];
        const d = cvdSeparation(a, b, kind);
        if (d < 5) bad.push(`${kind} ${MODULE_KEYS[i]}×${MODULE_KEYS[j]} ${d.toFixed(1)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `Acessível falha o próprio propósito:\n    ${bad.join('\n    ')}`);
});

/* ─────────────── 6. Contrato de resolução ─────────────── */

check('resolver é determinístico e memoizado', () => {
  const a = resolveTokens('clean', 'dark', 'joia');
  const b = resolveTokens('clean', 'dark', 'joia');
  assert.equal(a, b, 'mesma entrada deveria devolver o mesmo objeto (cache)');
  assert.notEqual(
    resolveTokens('clean', 'dark', 'joia'),
    resolveTokens('clean', 'light', 'joia'),
    'esquemas diferentes não podem compartilhar objeto',
  );
});

check('entrada desconhecida cai no padrão sem lançar', () => {
  const t = resolveTokens('nao-existe', 'light', 'nao-existe');
  assert.equal(t.bg, ORBE_LIGHT.bg, 'deveria cair no tema Orbe claro');
});

console.log(
  `\n${passed} testes passaram · ${COMBOS.length} combinações de cor + ` +
    `${BRAND_COMBOS.length} de marca.`,
);
