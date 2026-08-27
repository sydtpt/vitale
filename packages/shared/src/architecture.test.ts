/**
 * Guarda das fronteiras da arquitetura (AD-7) — puro, sem framework. Rodar com:
 *   cd packages/shared && npx tsx src/architecture.test.ts
 *
 * Duas naturezas de checagem, de propósito:
 *
 * 1. **Barreira** — o que já está limpo e não pode sujar. Falha em qualquer
 *    violação nova.
 * 2. **Catraca** — o que ainda está sendo migrado. Falha quando o número CRESCE.
 *    Trava o passivo no lugar enquanto a CAP-6 anda, e vira barreira quando
 *    chegar a zero. Baixar o teto ao migrar é parte do trabalho.
 *
 * Catraca é honesta onde barreira seria mentira: declarar "nenhum .from() fora
 * do núcleo" hoje derrubaria o build em 132 lugares e o teste seria desligado
 * na primeira hora.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { WALLPAPERS } from './constants/wallpaper';
import { APP_THEMES } from './models';
import { THEMES } from './theme/themes';
import { PALETTES } from './theme/palettes';
import { BRANDS } from './theme/brands';
import { cssVars } from './theme/css-vars';
import { resolveTokens } from './theme/derive';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ok ${name}`);
}

const ROOT = join(import.meta.dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

const webFiles = walk(join(ROOT, 'web', 'src')).filter((f) => !f.endsWith('.spec.ts'));
const mobileFiles = walk(join(ROOT, 'mobile', 'src')).filter((f) => !/__tests__/.test(f));

/**
 * Stores duplicam por razão arquitetural legítima: a máquina de estado é
 * signals na web e Zustand no mobile (AD-12). Nome novo aqui é exceção, e
 * exceção some de vista — pense duas vezes antes de acrescentar.
 */
const STORE_ALLOWLIST = new Set([
  'activities.store.ts',
  'connections.store.ts',
  'cultura.store.ts',
  'daily-ratings.store.ts',
  'goals.store.ts',
  'habits.store.ts',
  'health.store.ts',
  'planned-workouts.store.ts',
  'registros.store.ts',
  'retro.store.ts',
  'todos.store.ts',
]);

/**
 * Diferido com razão escrita: `ActivityHighlight` carrega `value` e `caption`
 * já formatados, então cálculo e apresentação estão entrelaçados. Separar é o
 * que a AD-2 manda, mas é mudança de design com impacto na UI.
 */
const DEFERRED = new Set(['running-highlights.ts']);

check('BARREIRA — nenhum módulo com o mesmo nome nos dois apps', () => {
  const web = new Set(webFiles.map((f) => basename(f)));
  const dup = [...new Set(mobileFiles.map((f) => basename(f)))]
    .filter((b) => web.has(b))
    .filter((b) => !STORE_ALLOWLIST.has(b) && !DEFERRED.has(b));
  assert.deepEqual(
    dup,
    [],
    `duplicado(s) entre web/src e mobile/src: ${dup.join(', ')}. ` +
      `Se for lógica pura, sobe para @vitale/shared (AD-1). Se o arquivo mistura ` +
      `plataforma e lógica pura, parta-o antes (AD-2). Se os dois módulos não têm ` +
      `relação, o nome é que está errado — renomeie.`,
  );
});

/**
 * Foi CATRACA enquanto as 139 chamadas originais eram migradas: falhava só
 * quando o número crescia, e o teto descia a cada tabela. Chegou a zero e
 * virou barreira, como estava previsto desde que foi escrita.
 */
check('BARREIRA — nenhuma chamada .from() fora do núcleo', () => {
  const offenders = [...webFiles, ...mobileFiles]
    .map((f) => ({ f, n: (readFileSync(f, 'utf8').match(/\.from\('[a-z_]+'/g) ?? []).length }))
    .filter((x) => x.n > 0)
    .map((x) => `${x.f.replace(ROOT + '/', '')} (${x.n})`);
  assert.deepEqual(
    offenders,
    [],
    `acesso a tabela fora de packages/shared/src/data: ${offenders.join(', ')}. ` +
      `Query nova vai no módulo dono da tabela (AD-4); se a tabela ainda não tem módulo, crie um.`,
  );
});

check('BARREIRA — o núcleo não importa dos apps', () => {
  const offenders = walk(join(ROOT, 'packages', 'shared', 'src'))
    .filter((f) => /from '.*(web|mobile)\/src/.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(offenders, [], `núcleo importando de app: ${offenders.join(', ')}`);
});

check('BARREIRA — o núcleo não constrói SupabaseClient', () => {
  const offenders = walk(join(ROOT, 'packages', 'shared', 'src'))
    .filter((f) => /createClient\s*\(/.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(
    offenders,
    [],
    `núcleo construindo client: ${offenders.join(', ')}. O client vem por parâmetro (AD-4); ` +
      `quem o constrói é o app, porque o adaptador de storage difere.`,
  );
});

/**
 * `cultura/tipos.ts` é consumido pelo Deno das edge functions por caminho
 * relativo, e o Deno exige extensão explícita em todo specifier. Um import
 * sem `.ts` aqui não quebra `tsc` nem os apps — quebra só no deploy da função,
 * longe de onde a mudança foi feita.
 */
check('BARREIRA — cultura/tipos.ts continua auto-contido (consumido pelo Deno)', () => {
  const src = readFileSync(join(ROOT, 'packages', 'shared', 'src', 'cultura', 'tipos.ts'), 'utf8');
  const imports = src.match(/^\s*import\s.+$/gm) ?? [];
  assert.deepEqual(
    imports,
    [],
    `cultura/tipos.ts ganhou import: ${imports.join(' | ')}. A edge function cultura-search o ` +
      `importa direto, e o Deno não resolve specifier sem extensão. Mantenha o módulo sem imports ` +
      `(mesmo padrão de fitness/dedupe.ts) ou o deploy da função quebra.`,
  );
});

/**
 * A cadeia de provedores tem que ter fonte única entre cliente e servidor. Se
 * a edge function passar a decidir a ordem por conta própria, o fallback
 * diverge calado — e ninguém percebe até uma busca cair no provedor errado.
 */
check('BARREIRA — a edge function lê a cadeia de provedores do núcleo', () => {
  const fn = join(ROOT, 'supabase', 'functions', '_shared', 'providers', 'cultura.ts');
  const src = readFileSync(fn, 'utf8');
  assert.ok(
    /import\s*\{[^}]*cadeiaDeProvedores[^}]*\}\s*from\s*'[^']*packages\/shared\/src\/cultura\/tipos\.ts'/
      .test(src),
    `supabase/functions/_shared/providers/cultura.ts precisa importar cadeiaDeProvedores do ` +
      `núcleo. Redefinir a ordem lá faz cliente e servidor divergirem sem nada acusar.`,
  );
});

/**
 * Toda coluna de `user_preferences` que guarda um id do app precisa de um CHECK
 * que aceite exatamente os ids que o app grava. A tabela é escrita por inteiro
 * num upsert só, então **um id fora do CHECK derruba a linha toda** — theme,
 * glass, tudo — e o erro chega como um `console.warn` que ninguém vê em
 * produção. Foi assim que o papel de parede ficou meses sem salvar e levou o
 * modo escuro junto.
 */
const ID_COLUMNS: { coluna: string; ids: () => string[] }[] = [
  // `theme` é o ESQUEMA (claro/escuro/sistema/solar), não o tema — o nome ficou
  // de quando havia só este eixo. A regex abaixo distingue: `theme\s+in` não
  // casa com `theme_id in`.
  { coluna: 'theme', ids: () => [...APP_THEMES] },
  { coluna: 'wallpaper', ids: () => WALLPAPERS.map((w) => w.id) },
  { coluna: 'theme_id', ids: () => THEMES.map((t) => t.id) },
  { coluna: 'palette_id', ids: () => PALETTES.map((p) => p.id) },
  { coluna: 'brand_id', ids: () => BRANDS.map((b) => b.id) },
];

check('BARREIRA — os CHECKs de user_preferences cobrem todos os ids do app', () => {
  const dir = join(ROOT, 'supabase', 'migrations');
  const sqls = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ f, sql: readFileSync(join(dir, f), 'utf8') }));

  const problemas: string[] = [];
  for (const { coluna, ids } of ID_COLUMNS) {
    // Vale a ÚLTIMA migration que mexe na constraint — é ela que está valendo.
    const re = new RegExp(`check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`, 'i');
    const ultima = sqls.filter(({ sql }) => re.test(sql)).pop();
    if (!ultima) {
      problemas.push(`${coluna}: nenhuma migration define o CHECK`);
      continue;
    }
    const permitidos = new Set([...re.exec(ultima.sql)![1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
    const faltando = ids().filter((id) => !permitidos.has(id));
    if (faltando.length) {
      problemas.push(`${coluna}: o banco recusa ${faltando.join(', ')} (${ultima.f})`);
    }
  }
  assert.deepEqual(
    problemas,
    [],
    `id que o app grava e o banco recusa:\n    ${problemas.join('\n    ')}\n` +
      `  Escreva uma migration com \`drop constraint\` + \`add constraint\` — nunca \`add column ` +
      `if not exists\` com o check colado, que o Postgres pula inteiro quando a coluna já existe.`,
  );
});

/**
 * `colors` é um Proxy que resolve no momento da LEITURA. Um `StyleSheet.create`
 * no escopo do módulo lê no import, quando o esquema ativo ainda é o claro e o
 * `bg` ainda é opaco — a folha congela clara para sempre. Foram 14 blocos assim
 * (132 leituras), e o sintoma era duplo: a tela não escurecia e o papel de
 * parede não aparecia atrás dela.
 *
 * Folha nova mora dentro de `useThemedStyles(...)` ou embrulhada em `themed(...)`.
 */
check('BARREIRA — nenhum StyleSheet no escopo do módulo lê o tema', () => {
  const offenders: string[] = [];
  for (const f of mobileFiles) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^const (\w+) = StyleSheet\.create\(\{$/gm)) {
      const fim = src.indexOf('\n});', m.index);
      const corpo = src.slice(m.index, fim === -1 ? undefined : fim);
      // `MOD` e `moduleColors()` congelam igual: os três leem os eixos ativos
      // no momento da chamada, e no escopo do módulo isso é o import.
      // `surfaces`, `ink`, `brand`, `accents` e `T` são o recorte HISTÓRICO do
      // núcleo — creme do Orbe claro, congelado. Ler qualquer um deles numa
      // folha é o mesmo defeito de ler `colors` fora do render, e foi assim que
      // o splash ficou com fundo creme dentro do tema Clean.
      const n = (corpo.match(
        /\bcolors\.|\bMOD\.|\bmoduleColors\(|\b(?:surfaces|ink|brand|accents|lines)\.|\bT\./g,
      ) ?? []).length;
      if (n > 0) offenders.push(`${f.replace(ROOT + '/', '')}:${m[1]} (${n})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `folha de estilo congelada na paleta clara: ${offenders.join(', ')}. ` +
      `Embrulhe em themed(() => StyleSheet.create({...})) e assine o tema com useTheme() no ` +
      `componente, ou mova para useThemedStyles.`,
  );
});

/**
 * BARREIRA — nenhuma lista rolável do mobile mostra a barra de rolagem.
 *
 * O app é de captura rápida no telefone: a barra do sistema aparece por cima do
 * conteúdo enquanto o dedo desliza, some sozinha e não informa nada que o
 * próprio movimento já não diga. Eram 19 telas sem a prop contra ~40 com ela —
 * o padrão já existia, só não estava trancado, e a barra pipocava justo nas
 * telas mais usadas (Hoje, Semana, Mais).
 *
 * A prop é por eixo: rolagem horizontal esconde a horizontal, o resto esconde a
 * vertical. Trancar em `={false}` (e não só na presença do nome) evita que um
 * `showsVerticalScrollIndicator={debug}` passe batido.
 */
check('BARREIRA — nenhuma lista rolável do mobile mostra barra', () => {
  const ROLAVEL = /^(?:Animated\.)?(?:ScrollView|FlatList|SectionList|VirtualizedList)$/;

  // Os atributos vão até o `>` do NÍVEL ZERO de chaves: props carregam arrow
  // functions (`renderItem={({ item }) => <Card />}`) e objetos aninhados, e um
  // regex que parasse no primeiro `>` cortaria a tag no meio — lendo como
  // "sem a prop" justamente as telas que a têm no fim da lista.
  const tag = (src: string, i: number): { nome: string; attrs: string; fim: number } | null => {
    let j = i + 1;
    let nome = '';
    while (j < src.length && /[A-Za-z0-9_.$]/.test(src[j])) nome += src[j++];
    if (!ROLAVEL.test(nome)) return null;
    let chaves = 0;
    let aspas: string | null = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (aspas) {
        if (c === aspas && src[j - 1] !== '\\') aspas = null;
      } else if (c === '"' || c === "'" || c === '`') aspas = c;
      else if (c === '{') chaves++;
      else if (c === '}') chaves--;
      else if (c === '>' && chaves === 0) return { nome, attrs: src.slice(i, j + 1), fim: j };
    }
    return null;
  };

  const offenders: string[] = [];
  for (const f of mobileFiles) {
    const src = readFileSync(f, 'utf8');
    for (let i = 0; i < src.length; i++) {
      if (src[i] !== '<') continue;
      const t = tag(src, i);
      if (!t) continue;
      i = t.fim;
      const horizontal = /\bhorizontal\b(?!\s*=\s*\{false\})/.test(t.attrs);
      const prop = horizontal ? 'showsHorizontalScrollIndicator' : 'showsVerticalScrollIndicator';
      if (new RegExp(`${prop}=\\{false\\}`).test(t.attrs)) continue;
      const linha = src.slice(0, i).split('\n').length;
      offenders.push(`${f.replace(ROOT + '/', '')}:${linha} <${t.nome}> sem ${prop}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `lista rolável mostrando a barra:\n    ${offenders.join('\n    ')}\n` +
      `  Acrescente showsVerticalScrollIndicator={false} (ou a horizontal, se rolar de lado).`,
  );
});

/**
 * BARREIRA — toda `var(--x)` da web vem do sistema de temas ou de uma escala.
 *
 * A web pinta o `:root` em runtime a partir do `cssVars()`. Uma variável que o
 * SCSS usa e a derivação não produz é **órfã**: ela pega o valor do piso em
 * `styles.scss` e fica lá para sempre, imune a tema, esquema, paleta e marca —
 * um pedaço de tela que não escurece, sem erro nenhum para acusar.
 *
 * As escalas (espaço, raio, fonte, sombra) são exceção legítima: não dependem de
 * cor. A sombra entra pelo `shadowVars()`, que varia só por esquema.
 */
check('BARREIRA — nenhuma variável CSS da web fora do sistema de temas', () => {
  const doTema = new Set(Object.keys(cssVars(resolveTokens('orbe', 'light', 'orbe', 'laranja'))));
  const escalas = /^--(spacing|radii|font|shadow)-/;

  // Variável de escopo de componente é legítima: quem a define é o próprio
  // componente, por SCSS ou por `[style.--x]`, e o valor costuma vir do tema.
  const arquivos = walkExt(join(ROOT, 'web', 'src'), /\.(scss|html|ts)$/);
  const locais = new Set<string>();
  for (const f of arquivos) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/g)) locais.add(m[1]);
    for (const m of src.matchAll(/\[style\.(--[a-z0-9-]+)\]/g)) locais.add(m[1]);
  }

  // Comentário citando uma variável não é uso — e uma barreira que tropeça no
  // comentário que explica a própria correção seria um convite a desligá-la.
  // Vale para as duas formas: a versão que só limpava `//` reprovava um bloco
  // `/** */` que documentava justamente por que aquele `var()` não devia existir.
  const semComentario = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  const usadas = new Map<string, string[]>();
  for (const f of arquivos) {
    for (const m of semComentario(readFileSync(f, 'utf8')).matchAll(/var\((--[a-z0-9-]+)/g)) {
      const nome = m[1];
      if (doTema.has(nome) || escalas.test(nome) || locais.has(nome)) continue;
      const onde = usadas.get(nome) ?? [];
      onde.push(f.replace(ROOT + '/', ''));
      usadas.set(nome, onde);
    }
  }
  const orfas = [...usadas.entries()].map(([n, fs]) => `${n} (${fs.length}x, ex.: ${fs[0]})`);
  assert.deepEqual(
    orfas,
    [],
    `variável CSS que nenhum tema alcança:\n    ${orfas.join('\n    ')}\n` +
      `  Cor nova nasce em packages/shared/src/theme e chega sozinha pelo cssVars().`,
  );
});

/**
 * CATRACA — hex escrito à mão fora do sistema de temas.
 *
 * Uma cor literal não responde a tema nem a paleta: ela fica igual nas 24
 * combinações e é exatamente o que faz o modo escuro sair pela metade. Zerar
 * hoje é impossível — parte é legítima (SVG do cartão de compartilhamento, HTML
 * do mapa, overlays `rgba` sobre foto) e parte é passivo das fases 2 e 3.
 *
 * Então trava no lugar: falha quando **cresce**. Baixar o teto ao migrar cada
 * frente é parte do trabalho, no mesmo idioma da catraca de `.from()` que já
 * chegou a zero e virou barreira.
 */
// Inclui a forma de 3 dígitos: `#fff` é justamente a mais usada para conteúdo
// sobre fundo colorido, e era o que quebrava com a marca clara no escuro.
const HEX = /#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})\b/g;

function walkExt(dir: string, exts: RegExp, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walkExt(p, exts, out);
    else if (exts.test(e)) out.push(p);
  }
  return out;
}

const HEX_CEILING: {
  label: string;
  files: string[];
  max: number;
  ignorar?: (f: string, src: string) => string;
}[] = [
  {
    label: 'mobile/src (fora de theme/)',
    files: mobileFiles.filter((f) => !f.includes('/src/theme/')),
    // 197 → 196 quando o `WARM = '#FBF1E2'` do gráfico empilhado saiu: o degradê
    // da barra passou a clarear em direção à superfície do tema.
    max: 196,
  },
  {
    label: 'web SCSS',
    files: walkExt(join(ROOT, 'web', 'src'), /\.scss$/),
    // O `:root` de `styles.scss` é o piso declarado do sistema de temas — o que
    // a página mostra se o JS não rodar. É intencional e permanente, então não
    // conta como passivo; o resto do arquivo continua contando.
    ignorar: (f: string, src: string) =>
      f.endsWith('web/src/styles.scss') ? src.replace(/:root\s*\{[\s\S]*?\n\}/, '') : src,
    max: 117,
  },
  {
    label: 'web TS',
    files: webFiles,
    // 68 → 62 quando o gráfico de volume da página de Treinos parou de desenhar
    // grade, eixo e valor em hex do Orbe claro (o que quebrava o modo escuro);
    // 62 → 61 quando o `WARM` do gráfico empilhado virou a superfície do tema.
    max: 61,
  },
];

/**
 * CATRACA — acento usado como cor de **texto**.
 *
 * `accent` promete 3,0 contra a superfície: o piso de *objeto gráfico* da WCAG
 * 1.4.11, correto para o ponto, a barra e o traço que ele foi feito para pintar.
 * Texto quer 4,5 (1.4.3), e é aí que os dois se separam — 54% das combinações de
 * papel × tema × paleta × esquema ficam entre um piso e o outro. Medido no dia
 * em que a tira de Recordes foi migrada: as estrelas de nota da Cultura, em
 * `yellow` sobre branco, davam **1,76**, abaixo até do piso gráfico; a marca
 * `verde` no claro, **2,09**; a `laranja`, que é o padrão do app, **3,31**.
 *
 * O conserto por chamada é trocar `accent` por `*Text` (ou `primaryText`), que
 * é o mesmo acento empurrado até 4,5 — no escuro ele quase nunca desloca. Ver
 * `docs/decisions/0024-acento-nao-e-cor-de-texto.md`.
 *
 * É catraca e não barreira porque são 115 pontos: declarar barreira hoje
 * derrubaria o build em 115 lugares e o teste seria desligado na primeira hora,
 * exatamente como diz a nota no topo deste arquivo.
 *
 * **A contagem erra para mais, de propósito.** A regex não sabe distinguir um
 * rótulo de um ponto de gráfico, e alguns destes usos são legítimos. Migrar um
 * ponto é trocar o token **ou** confirmar por escrito que ali é gráfico e
 * excluí-lo — as duas saídas baixam o teto, e as duas exigem que alguém olhe.
 *
 * Uma classe inteira saiu por essa segunda porta: `color:` sem o lookbehind
 * casava também o **sufixo** de `border-color:`, `border-bottom-color:` e
 * companhia. Eram 42 dos 85 pontos da web — e borda é objeto gráfico, o piso de
 * 3,0 que o `accent` promete, não o de 4,5 da letra. O `(?<![-\w])` exige que
 * `color` comece a propriedade; o teto caiu de 84 para 43 no mesmo movimento.
 */
const TEXT_ACCENT: { label: string; files: string[]; re: RegExp; max: number }[] = [
  {
    label: 'mobile — color: colors.<acento>',
    files: mobileFiles,
    re: /color:\s*colors\.(primary|primaryDeep|yellow|green|rose|blue|casa|teal|red|purple)\b/g,
    max: 29,
  },
  {
    label: 'web — color: var(--acento)',
    files: walkExt(join(ROOT, 'web', 'src'), /\.(scss|html|ts)$/),
    re: /(?<![-\w])color:\s*var\(--(primary|primary-deep|role-[a-z]+)\)/g,
    max: 43,
  },
  {
    label: 'web — [style.color] com acento',
    files: walkExt(join(ROOT, 'web', 'src'), /\.(html|ts)$/),
    re: /\[style\.color\]="[^"]*(accent|primary)[^"]*"/g,
    max: 2,
  },
];

check('CATRACA — acento como cor de texto não cresce', () => {
  const over: string[] = [];
  for (const bucket of TEXT_ACCENT) {
    const n = bucket.files.reduce(
      (sum, f) => sum + (readFileSync(f, 'utf8').match(bucket.re) ?? []).length,
      0,
    );
    if (n > bucket.max) over.push(`${bucket.label}: ${n} > teto ${bucket.max}`);
    else if (n < bucket.max) {
      console.log(`     ↓ ${bucket.label} caiu para ${n} (teto ${bucket.max}) — baixe o teto`);
    }
  }
  assert.deepEqual(
    over,
    [],
    `acento novo como cor de texto: ${over.join(', ')}.\n` +
      `  \`accent\` garante 3,0 — o piso do traço, não o da letra. Para texto use ` +
      `\`roles[x].text\` / \`colors.<papel>Text\` / \`var(--role-x-text)\`, que garante 4,5.`,
  );
});

check('CATRACA — hex fora do sistema de temas não cresce', () => {
  const over: string[] = [];
  for (const bucket of HEX_CEILING) {
    const n = bucket.files.reduce((sum, f) => {
      const src = readFileSync(f, 'utf8');
      const alvo = bucket.ignorar ? bucket.ignorar(f, src) : src;
      return sum + (alvo.match(HEX) ?? []).length;
    }, 0);
    if (n > bucket.max) over.push(`${bucket.label}: ${n} > teto ${bucket.max}`);
    else if (n < bucket.max) {
      console.log(`     ↓ ${bucket.label} caiu para ${n} (teto ${bucket.max}) — baixe o teto`);
    }
  }
  assert.deepEqual(
    over,
    [],
    `hex literal novo fora do tema: ${over.join(', ')}. ` +
      `Cor nova entra como papel em theme/palettes.ts e sai por resolveTokens()/moduleOf(); ` +
      `literal só se for mesmo independente de tema (SVG exportado, overlay sobre foto).`,
  );
});

console.log(`\n${passed} testes passaram.`);
