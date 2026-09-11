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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import ts from 'typescript';
import { WALLPAPERS } from './constants/wallpaper';
import { APP_THEMES } from './models';
import { THEMES } from './theme/themes';
import { PALETTES } from './theme/palettes';
import { BRANDS } from './theme/brands';
import { cssVars } from './theme/css-vars';
import { sleepColorsOf, sleepCssVars } from './sleep/colors';
import { resolveTokens } from './theme/derive';
import { CONCLUSAO } from './ia/motor';
import { VOCABULARIO_PROIBIDO } from './ia/verificar';

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

// Comentário fora; código e LITERAL DE STRING dentro. Comentário citando o que
// a guarda procura não é uso — e uma barreira que tropeça no comentário que
// explica a própria regra é um convite a desligá-la. O primeiro autor a
// tropeçar foi o do `prompt.ts`, que dizia "nenhuma linha daqui conhece Google,
// Anthropic ou qualquer outro" — a frase que afirma a propriedade cobrada.
//
// Sai o bloco (inclusive o de documentação) e a linha inteira de `//`. O `//`
// no FIM de uma linha de código fica: sem saber onde começa um literal, cortar
// dali tiraria da guarda o resto de um `'https://…'`, e o literal é justamente
// o que ela tem de ver — nomear um fornecedor no texto do prompt vaza para o
// contexto do modelo.
//
// Morava duplicada em duas barreiras, cada uma tratando o `//` de um jeito;
// subiu para cá na 5.1, quando as guardas dos motores precisaram dela. Medido
// nesse dia: a barreira de variáveis CSS da web dá zero órfã com as duas versões.
function semComentario(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** Arquivo de teste, em qualquer das três convenções do repositório. */
function ehTeste(f: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(f) || /[\\/]__tests__[\\/]/.test(f);
}

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
  'gear.store.ts',
  'goals.store.ts',
  'habits.store.ts',
  'health.store.ts',
  'planned-workouts.store.ts',
  'registros.store.ts',
  'retro.store.ts',
  'sono.store.ts',
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
 * O mesmo motivo, generalizado: todo módulo do núcleo que alguma edge function
 * importa por caminho relativo (`packages/shared/src/….ts`) precisa continuar
 * sem imports. Hoje são `fitness/dedupe.ts`, `fitness/streams.ts`,
 * `cultura/tipos.ts` e `health/wellness.ts`; a lista sai do próprio código das
 * functions, então um módulo novo entra na guarda no dia em que for importado.
 */
check('BARREIRA — módulo do núcleo importado pelo Deno continua sem imports', () => {
  const fnFiles = walk(join(ROOT, 'supabase', 'functions'));
  const targets = new Set<string>();
  for (const f of fnFiles) {
    const src = readFileSync(f, 'utf8');
    // Aspas simples ou duplas, `import` ou `export … from`: a guarda não pode
    // depender do estilo de quem escreveu a function.
    for (const m of src.matchAll(/from\s*['"][^'"]*packages\/shared\/src\/([^'"]+\.ts)['"]/g)) {
      targets.add(m[1]);
    }
  }
  assert.ok(targets.size > 0, 'nenhuma edge function importa do núcleo — a guarda ficou sem alvo');
  const offenders: string[] = [];
  for (const rel of [...targets].sort()) {
    const abs = join(ROOT, 'packages', 'shared', 'src', rel);
    // Caminho que não existe é falha da guarda, não exceção dela: sem isto o
    // `readFileSync` estoura um ENOENT cru e a mensagem explicativa nunca sai.
    if (!existsSync(abs)) {
      offenders.push(`${rel} (não existe — a function importa um caminho morto)`);
      continue;
    }
    const src = readFileSync(abs, 'utf8');
    const imports = src.match(/^\s*import\s.+$/gm) ?? [];
    if (imports.length > 0) offenders.push(`${rel} (${imports.length})`);
  }
  assert.deepEqual(
    offenders,
    [],
    `módulo consumido pelo Deno ganhou import: ${offenders.join(', ')}. O Deno não resolve ` +
      `specifier sem extensão e o deploy da function quebra longe daqui.`,
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
 * BARREIRA — `AGG_VERSION` tem um dono só, e ele mora no núcleo.
 *
 * A constante tem dois consumidores em pontas opostas do app: o sync do mobile,
 * que a compara com o cursor para decidir o re-backfill, e o carimbo da edição
 * da Retrospectiva, que a grava na linha para que `precisaErrata` possa comparar
 * depois. Enquanto ela era `const` privada dentro do sync, o segundo consumidor
 * recebia `undefined` e gravava nulo — e nulo não é elegível a errata, então
 * **nenhuma** edição em produção era.
 *
 * Um segundo dono reabre exatamente esse buraco sem erro nenhum para acusar: os
 * dois números convivem, cada ponta lê o seu, e a divergência só aparece meses
 * depois numa errata que não veio. O tipo não alcança isto — só a barreira.
 *
 * Varre também `supabase/functions` e `scripts/`: a edge function é hospedeiro
 * como qualquer outro, e é pela mesma razão que a barreira irmã da cadeia de
 * provedores existe. `scripts/` entra hoje vazio de TypeScript de propósito — é
 * onde o backfill da Story 2.2 vai morar, e a garantia que `upsertEdicao`
 * promete a ele só vale se a barreira chegar lá antes dele.
 */
const DONO_AGG_VERSION = 'packages/shared/src/constants/agg-version.ts';

check('BARREIRA — AGG_VERSION tem um dono só no núcleo', () => {
  // O `\s+` é de propósito e não é frescura: escrito assim, o regex **não casa
  // com a própria linha que o declara** — no fonte deste arquivo há uma barra,
  // um `s` e um `+`, não um espaço —, então a barreira não se acusa e não
  // precisa de exceção para si mesma. O lookbehind evita casar um sufixo tipo
  // `HEALTH_AGG_VERSION`.
  const DECLARA = /(?<![\w.])const\s+AGG_VERSION\b/;

  // `walk` devolve lista vazia para diretório inexistente ou sem TypeScript (o
  // `readdirSync` está em try/catch), então `scripts/` pode entrar antes de ter
  // um único `.ts` — e é exatamente esse o ponto.
  const alvos = [
    ...walk(join(ROOT, 'packages', 'shared', 'src')),
    ...webFiles,
    ...mobileFiles,
    ...walk(join(ROOT, 'supabase', 'functions')),
    ...walk(join(ROOT, 'scripts')),
  ];

  // Não-vacuidade primeiro: sem isto a barreira passa em silêncio no dia em que
  // o alvo sumir, e "nenhum dono" engana mais do que dois.
  const abs = join(ROOT, DONO_AGG_VERSION);
  assert.ok(
    existsSync(abs) && DECLARA.test(readFileSync(abs, 'utf8')),
    `a barreira ficou sem alvo: ${DONO_AGG_VERSION} não declara mais AGG_VERSION. ` +
      `Se a constante mudou de arquivo, aponte DONO_AGG_VERSION para o caminho novo — ` +
      `apagar a checagem é o único desfecho errado, porque é ela que impede um segundo ` +
      `dono de nascer.`,
  );

  const donos = alvos
    .filter((f) => DECLARA.test(readFileSync(f, 'utf8')))
    .map((f) => f.replace(ROOT + '/', ''))
    .sort();
  assert.deepEqual(
    donos,
    [DONO_AGG_VERSION],
    `AGG_VERSION declarado em mais de um lugar: ${donos.join(', ')}. ` +
      `Importe do núcleo (\`@vitale/shared\` nos apps, caminho relativo dentro dele); ` +
      `duas declarações divergem calado e a errata deixa de disparar.`,
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
  const tokens = resolveTokens('orbe', 'light', 'orbe', 'laranja');
  // O `ThemeService` escreve as duas famílias: os tokens do tema e a gramática
  // de cor do sono (`--sleep-*`), que é derivada deles pela mesma função que o
  // mobile lê. As duas são "o sistema".
  const doTema = new Set([
    ...Object.keys(cssVars(tokens)),
    ...Object.keys(sleepCssVars(sleepColorsOf(tokens, 'orbe'))),
  ]);
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

  // Comentário citando uma variável não é uso (`semComentario`, no topo). Vale
  // para as duas formas: a versão que só limpava `//` reprovava um bloco `/** */`
  // que documentava justamente por que aquele `var()` não devia existir.
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
      `  Cor nova nasce em packages/shared/src/theme e chega sozinha pelo cssVars() — ` +
      `ou, se é de sono, por sleepCssVars().`,
  );
});

/**
 * ARAME — `onAccent` não chega à web, e isso é escolha, não esquecimento.
 *
 * Uma terceira natureza, ao lado da barreira e da catraca do topo: as duas
 * guardam o que deve valer para sempre; esta guarda uma **ausência deliberada
 * com validade conhecida**. A revista é mobile-first e web é não-objetivo
 * declarado da frente, então o token existe em `RoleTokens` e `ModuleTokens` e
 * **não** ganha alias plano nem variável CSS. Sem isto, a linha "web continua
 * fora" da matriz da story era a única coberta por inspeção — e inspeção não
 * roda no CI.
 *
 * A barreira logo acima olha na direção contrária, e por isso não substitui
 * esta: ela cobra que toda `var(--x)` **usada** em `web/src` esteja no conjunto
 * que o `cssVars()` produz. Nada nela impede o conjunto de **crescer**.
 *
 * Os dois caminhos por onde `onAccent` vazaria, ambos cobrados aqui:
 *
 * 1. O laço de papéis do `cssVars()` ganhar `--role-<papel>-on-accent`.
 * 2. Um alias plano (`yellowOnAccent`) entrar em `ResolvedTokens` — e este é o
 *    caminho traiçoeiro, porque o primeiro laço do `cssVars()` é **genérico**
 *    sobre as chaves de valor string: um alias plano vira variável CSS sozinho,
 *    sem ninguém escrever uma linha em `css-vars.ts`.
 *
 * **Quando a web entrar, apague este teste.** Não afrouxe o regex, não
 * acrescente exceção: a espinha diz que `onAccent` ganha exatamente essas duas
 * coisas quando web/PDF/e-mail existirem, e nesse dia apagar isto é o movimento
 * certo. Um arame que sobrevive ao próprio motivo vira superstição.
 */
check('ARAME — onAccent não vaza para a web (não-objetivo declarado da revista)', () => {
  const NA_WEB = /on-?accent/i;
  const vazou: string[] = [];

  for (const t of THEMES) {
    for (const s of ['light', 'dark'] as const) {
      for (const p of PALETTES) {
        const tokens = resolveTokens(t.id, s, p.id, 'laranja');

        // 1. Nenhuma variável CSS — nem `--role-x-on-accent`, nem a que um
        //    alias plano produziria (`--yellow-on-accent`).
        for (const nome of Object.keys(cssVars(tokens))) {
          if (NA_WEB.test(nome)) vazou.push(`${t.id}/${s}/${p.id} variável CSS ${nome}`);
        }

        // 2. Nenhum alias plano na raiz dos tokens — a família `yellowOn`,
        //    `greenOn`… existe para `on`, `soft` e `text`, e é justamente o
        //    molde que `onAccent` não segue.
        for (const [chave, valor] of Object.entries(tokens)) {
          if (typeof valor !== 'string') continue;
          if (NA_WEB.test(chave)) vazou.push(`${t.id}/${s}/${p.id} alias plano ${chave}`);
        }
      }
    }
  }

  assert.deepEqual(
    vazou,
    [],
    '`onAccent` chegou à web, que é não-objetivo declarado desta frente:\n    ' +
      vazou.join('\n    ') +
      '\n  Se isto NÃO é intencional: o token é lido por moduleOf() no mobile e ' +
      'não precisa de alias plano nem de var CSS — tire o que o acrescentou.\n' +
      '  Se você ESTÁ trazendo a revista para a web: então este teste cumpriu o ' +
      'prazo dele. Apague-o inteiro (não afrouxe o regex, não abra exceção) e ' +
      'deixe o alias e a variável nascerem — é exatamente o que a espinha prevê.',
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
    //
    // 196 → 200 com o cursor do scrub no HTML do mapa (Leaflet e MapLibre, dois
    // literais cada): núcleo escuro + anel branco. Cai na exceção declarada
    // acima — o marcador vive sobre os tiles, que não seguem o tema do app, e a
    // lista tem estilo claro *e* escuro. Um token viraria quase-branco no
    // esquema escuro e sumiria sobre o Positron; um fixo escuro sumiria sobre o
    // Dark Matter. O par núcleo+anel é legível nos dois, e é a mesma solução do
    // casing branco que já está sob a linha da rota.
    //
    // 200 → 201 com o ponto "eu" do mapa de raio da Presença (`map-html.ts`,
    // `window.setMe`): o miolo usa a cor de tema (`c.me`) e o anel é branco fixo.
    // Mesmo caso do cursor do scrub, pelo mesmo motivo — o marcador vive sobre os
    // tiles. Entrou em `1514bb3` sem que o teto subisse junto, e por isso a main
    // ficou vermelha; o literal é legítimo, faltou o registro.
    max: 201,
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
    //
    // 61 → 63 com o cursor do scrub no mapa (`activity-map.component.ts`), pela
    // mesma razão do bucket do mobile: marcador sobre tile, fora do tema, com
    // estilo de mapa claro e escuro na mesma lista.
    //
    // E 63 → 61 no mesmo arquivo, no mesmo dia: a rota lia `--primary` (eixo
    // marca) com fallback cravado, e o ponto de largada era um verde literal.
    // Os dois viraram papel — `treino`/`orange` e `green` — então a rota deixou
    // de ficar preta quando a marca é `tinta`, e o mapa passou a acompanhar a
    // paleta como o resto do app.
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
    // 29 → 28 quando a faixa "Visão detalhada" virou o chip Mapa no cabeçalho
    // da tela de um tipo: o rótulo em marca saiu junto, e quem sinaliza a saída
    // agora é o ícone, na cor do esporte.
    max: 28,
  },
  {
    label: 'web — color: var(--acento)',
    files: walkExt(join(ROOT, 'web', 'src'), /\.(scss|html|ts)$/),
    re: /(?<![-\w])color:\s*var\(--(primary|primary-deep|role-[a-z]+)\)/g,
    // 43 → 42 quando o destaque em `--primary-deep` do primeiro card de
    // estatística saiu: era a marca elegendo "movimento" entre as cinco
    // métricas, sem razão. Cada uma passou a ter o acento do seu papel.
    //
    // 42 → 39 nos três pontos que pintavam conteúdo **dentro** do preenchimento
    // da marca com `--primary`, quando o token para isso é `--primary-on`: o
    // toggle "nas estatísticas" do detalhe e as duas pílulas de atrasado da
    // Semana. Media 2,71 na marca padrão e 1,86 na verde — abaixo do piso de
    // 3,0, o ícone sumia dentro do próprio botão.
    max: 39,
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

/**
 * A costura de provedor de modelo (ADR 0040). O requisito do usuário é que "a
 * empresa e os modelos poderão ser alterados com o tempo" — e requisito só é
 * invariante quando alguém cobra.
 *
 * `ia/` monta o pacote de fatos e nada mais. No dia em que um `fetch`, um SDK
 * ou o nome de um fornecedor entrar aqui, trocar de provedor deixa de ser
 * escrever um arquivo novo e vira refatoração — que é exatamente o custo que a
 * ADR existe para não pagar.
 *
 * Os adaptadores vivem na edge function, não no núcleo; por isso a guarda é
 * barreira, não catraca: hoje está em zero e não há passivo a migrar.
 *
 * **O alvo sai do código, não de uma lista** (AD-10 (2), story 5.1). Eram dois
 * diretórios escritos à mão, `ia/` e `routes/` — invariante que vale só para
 * quem chegou primeiro não é invariante, é coincidência, e a Saúde do sono
 * (`sleep/`) seria o terceiro inquilino fora da lista. Agora é o fecho
 * transitivo, por import relativo, de todo arquivo do núcleo (fora de teste)
 * que importa `ia/motor`, mais `ia/` e `routes/`: um recurso novo entra na
 * guarda no dia em que falar com a porta. O fecho inclui o que eles importam —
 * um `fetch` dois arquivos abaixo é o mesmo `fetch`. Medido no planejamento:
 * 55 arquivos em 17 diretórios, zero ofensor com a lista ampliada; com os seis
 * módulos da porta que a 5.1 criou, 61 arquivos nos mesmos 17 (o teste loga);
 * 63 com a 5.2, que trouxe o descritor da retrospectiva e `format/numero.ts`.
 *
 * A lista de fornecedores ganhou os nomes do aparelho (Core AI e os pesos
 * abertos). `apple` fica de fora de propósito: é vocabulário de domínio no
 * sono ("Apple Watch"), e a guarda que proíbe o domínio de falar dele seria
 * desligada no primeiro dia.
 */
const SHARED_SRC = join(ROOT, 'packages', 'shared', 'src');
const IA_MOTOR = join(SHARED_SRC, 'ia', 'motor.ts');
/**
 * Os módulos da porta. Quem importa qualquer um deles fala com a porta — um
 * descritor tipado só por `Descritor` (de `ia/orquestrar`) não precisa importar
 * `ia/motor`, e ainda assim é inquilino.
 */
const MODULOS_DA_PORTA = new Set(
  ['fio', 'motor', 'orquestrar', 'nuvem', 'recursos'].map((m) => join(SHARED_SRC, 'ia', `${m}.ts`)),
);

/**
 * As importações de um arquivo: `import` (de valor ou de tipo), `export … from`
 * e `import()`. Comentário não conta. A cláusula não atravessa aspas nem `;`,
 * então um `import './x'` sem `from` não rouba o `from` da linha seguinte.
 */
function importacoes(src: string): { reexporta: boolean; spec: string }[] {
  const out: { reexporta: boolean; spec: string }[] = [];
  const re = /^[ \t]*(import|export)\b[^;'"]*?\bfrom\s*(['"])([^'"]+)\2|^[ \t]*import\s*(['"])([^'"]+)\4|\bimport\s*\(\s*(['"])([^'"]+)\6/gm;
  for (const m of semComentario(src).matchAll(re)) {
    out.push({ reexporta: m[1] === 'export', spec: m[3] ?? m[5] ?? m[7] });
  }
  return out;
}

/** O arquivo para onde um specifier relativo aponta, como o `tsc` o resolve. */
function resolverRelativo(de: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(de), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

check('BARREIRA — o núcleo que fala com modelo não conhece rede, SDK nem fornecedor', () => {
  const nucleo = walk(SHARED_SRC).filter((f) => !ehTeste(f));
  // "Quem importa" é quem usa a porta. Reexportar não é usar: sem esta
  // distinção o barril (`index.ts`, que reexporta tudo) entraria como semente,
  // e o fecho viraria o núcleo inteiro — `data/` e o SDK do banco inclusive.
  const importaAPorta = (f: string) =>
    importacoes(readFileSync(f, 'utf8')).some((i) => {
      if (i.reexporta) return false;
      const dep = resolverRelativo(f, i.spec);
      return dep !== null && MODULOS_DA_PORTA.has(dep);
    });
  const sementes = [
    ...['ia', 'routes'].flatMap((d) => walk(join(SHARED_SRC, d))).filter((f) => !ehTeste(f)),
    ...nucleo.filter(importaAPorta),
  ];
  const alvo = new Set<string>();
  const fila = [...sementes];
  while (fila.length > 0) {
    const f = fila.pop()!;
    if (alvo.has(f)) continue;
    alvo.add(f);
    for (const { spec } of importacoes(readFileSync(f, 'utf8'))) {
      const dep = resolverRelativo(f, spec);
      if (dep && !ehTeste(dep) && dep.startsWith(SHARED_SRC + '/')) fila.push(dep);
    }
  }
  // Não-vácua: se a porta sumir do alvo, a guarda passa em silêncio sobre nada.
  assert.ok(
    alvo.has(IA_MOTOR),
    'ia/motor.ts ficou fora do alvo — a guarda ficou vácua. Se a porta mudou de arquivo, aponte IA_MOTOR para ele.',
  );
  // Não-vácua também no mecanismo: o fecho tem de passar das sementes. Se o
  // resolvedor de import quebrar, o alvo volta em silêncio à lista de pastas que
  // esta guarda substituiu — e um `fetch` em `period/` passaria no CI.
  const semente = new Set(sementes);
  const soPorImport = [...alvo].filter((f) => !semente.has(f));
  assert.ok(
    soPorImport.length > 0,
    'o fecho não passou das sementes (ia/, routes/ e quem importa a porta) — o resolvedor de import ' +
      'quebrou, e a guarda voltou a ser a lista de pastas. Confira importacoes() e resolverRelativo().',
  );

  const FORNECEDORES =
    'google|gemini|anthropic|claude|openai|mistral|vertex|firebase|coreai|qwen|llama|mlx|gemma|foundationmodels|privatecloudcompute';
  const PROIBIDO = [
    { re: /\bfetch\s*\(/, o: 'fetch(' },
    { re: /\bXMLHttpRequest\b/, o: 'XMLHttpRequest' },
    { re: /\bWebSocket\b/, o: 'WebSocket' },
    { re: /from\s*['"](?!\.)/, o: "import de pacote externo (só relativo é permitido)" },
    { re: /^[ \t]*import\s*['"](?!\.)/m, o: 'import de efeito de pacote externo' },
    { re: /\bimport\s*\(\s*['"](?!\.)/, o: 'import() de pacote externo' },
    { re: /\brequire\s*\(/, o: 'require()' },
    {
      // Com número de versão colado (`qwen2`, `qwen3.5`, `gemini2`), mas sem
      // abrir o fim da palavra para sufixo de letra — `vertexes` é geometria.
      re: new RegExp(`\\b(?:${FORNECEDORES})(?:\\d[\\w.]*)?\\b`, 'i'),
      o: 'nome de fornecedor',
    },
    {
      // A grafia de prosa, que é a que vazaria no texto de um prompt.
      re: /\bcore\s+ai\b|\bfoundation\s+models\b|\bprivate\s+cloud\s+compute\b/i,
      o: 'nome de fornecedor (por extenso)',
    },
    {
      // Nome de classe de SDK: `OpenAIClient`, `GeminiModel`, `QwenTokenizer`.
      re: /\b(?:Google|Gemini|Anthropic|Claude|OpenAI|Mistral|Vertex|Firebase|CoreAI|Qwen|Llama|Gemma|FoundationModels)(?=[A-Z0-9])/,
      o: 'nome de fornecedor (em nome de classe)',
    },
    { re: /\bprocess\.env\b|\bDeno\.env\b/, o: 'leitura de ambiente' },
  ];

  const offenders: string[] = [];
  for (const f of [...alvo].sort()) {
    const src = semComentario(readFileSync(f, 'utf8'));
    for (const { re, o } of PROIBIDO) {
      if (re.test(src)) offenders.push(`${f.replace(SHARED_SRC + '/', '')}: ${o}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `o núcleo de IA sujou: ${offenders.join(', ')}. ` +
      `Pacote de fatos, descritor, orquestrador e porta são derivação pura — rede, chave e ` +
      `nome de fornecedor moram no adaptador da edge function (ADR 0040) ou na ponte do ` +
      `aparelho (ADR 0047). Trocar de provedor tem que continuar sendo escrever um arquivo novo.`,
  );
  console.log(`     · alvo: ${alvo.size} arquivos em ${new Set([...alvo].map((f) => dirname(f))).size} diretórios`);
});

/**
 * BARREIRA — o fio e o hash não importam nada (AD-14, story 5.1).
 *
 * `ia/fio.ts` é o contrato da `ia-narrar`, e a function vai lê-lo por caminho
 * relativo na 5.6 — quando a barreira do Deno, lá em cima, passa a achá-lo
 * sozinha. Até lá ninguém no Deno o importa, e aquela barreira não o vê: esta
 * cobre o intervalo, e fica depois dele, porque o fio é declarado sem imports
 * para sempre. `ia/sha256.ts` existe para o hash do pedido sair igual em todo
 * hospedeiro sem `node:crypto` (que a barreira do núcleo de IA recusa) — um
 * import ali seria a dependência que ele foi escrito para não ter.
 */
check('BARREIRA — ia/fio.ts e ia/sha256.ts não importam nada', () => {
  const IMPORTA = [
    { re: /^[ \t]*import\b/m, o: 'import' },
    { re: /^[ \t]*export\b[^;'"]*\bfrom\s*['"]/m, o: 'export … from' },
    { re: /\bimport\s*\(/, o: 'import()' },
    { re: /\brequire\s*\(/, o: 'require()' },
  ];
  const offenders: string[] = [];
  for (const rel of ['ia/fio.ts', 'ia/sha256.ts']) {
    const abs = join(SHARED_SRC, rel);
    if (!existsSync(abs)) {
      offenders.push(`${rel} (sumiu — a guarda ficou sem alvo)`);
      continue;
    }
    const src = semComentario(readFileSync(abs, 'utf8'));
    for (const { re, o } of IMPORTA) if (re.test(src)) offenders.push(`${rel}: ${o}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `módulo sem imports ganhou dependência: ${offenders.join(', ')}. O fio é lido pelo Deno por ` +
      `caminho relativo, e o Deno não resolve specifier sem extensão — o deploy da function quebra ` +
      `longe daqui. Se precisa do tipo, declare-o no próprio fio.`,
  );
});

/**
 * BARREIRA — `Motor` não se reexporta com outro nome (AD-1).
 *
 * A porta é uma só, e o nome dela também. Um `export { Motor as Narrador }` é a
 * segunda porta nascendo com cara de apelido: quem a importa não sabe que é a
 * mesma, e a próxima mudança da porta passa a ter dois lugares a conferir.
 * Reexportar com o MESMO nome é legítimo (é o mesmo símbolo — é o que
 * `routes/nomear.ts` faz com `ChamadorDeModelo` até a 5.7).
 */
check('BARREIRA — Motor não se reexporta com outro nome', () => {
  assert.ok(
    /^export type Motor\s*=/m.test(readFileSync(IA_MOTOR, 'utf8')),
    'ia/motor.ts não declara mais `export type Motor` — a guarda ficou sem alvo.',
  );
  const RENOMEIA = /\bexport\s+(?:type\s+)?\{[^}]*\bMotor\s+as\s+(?!Motor\b)[\w$]+/;
  // Apelido em dois passos: importa renomeado, e reexporta o nome novo depois.
  const IMPORTA_RENOMEADO = /\bimport\s+(?:type\s+)?\{[^}]*\b(?:type\s+)?Motor\s+as\s+(?!Motor\b)[\w$]+/;
  const APELIDA = /\b(?:export\s+)?(?:declare\s+)?type\s+[\w$]+\s*(?:<[^>]*>)?\s*=\s*Motor\s*(?=[;\n]|$|\/\/)/;
  const ESTENDE = /\bextends\s+Motor\b/;
  const alvos = [
    ...walk(SHARED_SRC), ...mobileFiles, ...webFiles,
    ...walk(join(ROOT, 'scripts')), ...walk(join(ROOT, 'supabase', 'functions')),
  ].filter((f) => f !== IA_MOTOR);
  const offenders = alvos
    .filter((f) => {
      const src = semComentario(readFileSync(f, 'utf8'));
      return RENOMEIA.test(src) || IMPORTA_RENOMEADO.test(src) || APELIDA.test(src) || ESTENDE.test(src);
    })
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(
    offenders,
    [],
    `Motor reexportado com outro nome: ${offenders.join(', ')}. Importe \`Motor\` de ia/motor ` +
      `(ou de @vitale/shared) com o nome dele — a porta é uma só (AD-1).`,
  );
});

/**
 * BARREIRA — a conclusão tem uma grafia, e o banco concorda com ela (AD-10 (6)).
 *
 * O `CHECK` de `edicoes_ia.motivo_de_parada` recusa qualquer grafia que não seja
 * a de `CONCLUSAO` (`ia/motor.ts`). Se os dois divergirem, a primeira edição boa
 * depois da mudança morre no banco como erro de constraint — o texto aprovado, a
 * conferência verde, e nada gravado. No molde de `ID_COLUMNS`: vale a última
 * migration que mexe no CHECK.
 *
 * Lê as formas que um humano escreve (`= '…'`, `in (…)`) e as que o Postgres e o
 * `supabase db diff` geram (`((motivo_de_parada = 'STOP'::text))`, `= any
 * (array[…])`). E **nunca compara contra uma definição velha**: migration que
 * mexe no CHECK — inclusive só derrubando a constraint — e que a guarda não sabe
 * ler faz a guarda falhar dizendo qual é, em vez de seguir verde com a de antes.
 * A 1.9 é a próxima migration desta tabela, e é ela que mais provavelmente
 * escreve o CHECK de outro jeito.
 */
check('BARREIRA — CONCLUSAO é o que o CHECK de edicoes_ia.motivo_de_parada aceita', () => {
  const dir = join(ROOT, 'supabase', 'migrations');
  // Cast fora (`'STOP'::text`, `(coluna)::character varying`): não muda o valor aceito.
  const semCast = (sql: string) => sql.replace(/::\s*[a-z_]+(?:\s+varying)?(?:\s*\[\])?/gi, '');
  const FORMAS = [
    /check\s*\(+\s*motivo_de_parada\s*\)*\s*=\s*'([^']*)'/gi,
    /check\s*\(+\s*motivo_de_parada\s*\)*\s*=\s*any\s*\(+\s*array\s*\[([^\]]*)\]/gi,
    /check\s*\(+\s*motivo_de_parada\s*\)*\s*in\s*\(([^)]*)\)/gi,
  ];
  /** Os valores aceitos pela última definição do CHECK no arquivo, ou `null` se não há uma legível. */
  const ler = (sql: string): string[] | null => {
    let melhor: { pos: number; aceitos: string[] } | null = null;
    for (const re of FORMAS) {
      for (const m of sql.matchAll(re)) {
        const aceitos = [...m[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
        const valores = aceitos.length > 0 ? aceitos : [m[1]];
        if (!melhor || m.index! > melhor.pos) melhor = { pos: m.index!, aceitos: valores };
      }
    }
    return melhor?.aceitos ?? null;
  };
  // "Mexe no CHECK": um `check` e a coluna no mesmo statement, ou o nome da
  // constraint. Sem `\b` antes do nome: o Postgres o prefixa com a tabela
  // (`edicoes_ia_motivo_de_parada_check`), e `_` conta como letra para a regex.
  const mexe = (sql: string) => /\bcheck\b[^;]*\bmotivo_de_parada\b|motivo_de_parada_check\b/i.test(sql);

  let vigente: { f: string; aceitos: string[] } | null = null;
  const ilegiveis: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    // Comentário de SQL fora, das duas formas: a migration original cita 'STOP' num `--`.
    const sql = semCast(readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ''));
    if (!mexe(sql)) continue;
    const aceitos = ler(sql);
    if (aceitos) vigente = { f, aceitos };
    else ilegiveis.push(f);
  }
  const depois = ilegiveis.filter((f) => !vigente || f > vigente.f);
  assert.deepEqual(
    depois,
    [],
    `migration que mexe no CHECK de edicoes_ia.motivo_de_parada e a guarda não sabe ler: ` +
      `${depois.join(', ')}. Ou ela derruba a constraint sem recriar, ou escreve o CHECK numa forma ` +
      `nova — ensine a forma a esta guarda. Ela não pode comparar contra a definição de antes.`,
  );
  assert.ok(vigente, 'nenhuma migration define o CHECK de motivo_de_parada — a guarda ficou sem alvo');
  assert.deepEqual(
    vigente.aceitos,
    [CONCLUSAO],
    `o CHECK de edicoes_ia.motivo_de_parada (${vigente.f}) aceita ${JSON.stringify(vigente.aceitos)}, ` +
      `e CONCLUSAO é ${JSON.stringify(CONCLUSAO)}. Atenção antes de "mudar os dois juntos": até a ` +
      `story 1.10, quem grava a edição ainda passa o motivo cru que a function repassa ` +
      `(mobile/src/lib/edicao-ia.ts), não CONCLUSAO — mudar a constante e o CHECK sem a 1.10 ` +
      `quebra a escrita em produção.`,
  );
});

/**
 * CATRACA — o literal `'STOP'` só na `CONCLUSAO` (AD-10 (6), AD-12).
 *
 * `'STOP'` é a grafia de conclusão de UM fornecedor. Fora do adaptador dele, o
 * núcleo compara com `CONCLUSAO`; quem compara com o literal prende o Orbe à
 * grafia de quem responde hoje, e o próximo motor — que conclui com outra
 * palavra — cai como "truncado" sem nada acusar. A borda traduz: conclusão vira
 * `Resposta`, o resto vira `Falha`, e nenhum consumidor compara motivo de parada.
 *
 * Contam arquivos, fora de teste; ficam de fora a definição da constante e o
 * adaptador do provedor (`_shared/ia/narrador.ts`), que é onde a espinha manda o
 * literal morar. Varre o núcleo, os dois apps, `scripts/` e as functions.
 *
 * Teto e histórico:
 *   2 (5.1) — `routes/nomear.ts` (morre na 5.7, quando o nome de rota passar
 *             pela porta) e `mobile/src/lib/edicao-ia.ts` (morre na 1.10, quando
 *             a impressão virar cliente do orquestrador). Vira barreira em zero.
 */
const DONO_CONCLUSAO = 'packages/shared/src/ia/motor.ts';
const ADAPTADOR_DO_PROVEDOR = 'supabase/functions/_shared/ia/narrador.ts';
const TETO_STOP = 2;

check(`CATRACA — o literal 'STOP' só na CONCLUSAO (teto ${TETO_STOP})`, () => {
  const DEFINE = /\bconst\s+CONCLUSAO\s*=\s*(['"`])STOP\1/;
  assert.ok(
    DEFINE.test(readFileSync(join(ROOT, DONO_CONCLUSAO), 'utf8')),
    `a catraca ficou sem dono: ${DONO_CONCLUSAO} não declara mais CONCLUSAO = 'STOP'.`,
  );
  const LITERAL = /(['"`])STOP\1/;
  const alvos = [
    ...walk(SHARED_SRC), ...mobileFiles, ...webFiles,
    ...walk(join(ROOT, 'supabase', 'functions')), ...walk(join(ROOT, 'scripts')),
  ].filter((f) => !ehTeste(f));
  const fora: string[] = [];
  for (const f of alvos) {
    const rel = f.replace(ROOT + '/', '');
    if (rel === ADAPTADOR_DO_PROVEDOR) continue;
    let src = semComentario(readFileSync(f, 'utf8'));
    if (rel === DONO_CONCLUSAO) src = src.replace(DEFINE, '');
    if (LITERAL.test(src)) fora.push(rel);
  }
  fora.sort();
  if (fora.length < TETO_STOP) {
    console.log(`     ↓ 'STOP' fora da CONCLUSAO caiu para ${fora.length} (teto ${TETO_STOP}) — baixe o teto`);
  }
  assert.ok(
    fora.length <= TETO_STOP,
    `'STOP' literal em ${fora.length} arquivos (teto ${TETO_STOP}): ${fora.join(', ')}.\n` +
      `  Compare com CONCLUSAO (ia/motor) — ou, melhor, não compare: quem traduz o motivo de ` +
      `parada é a borda, e a Resposta já chega concluída.`,
  );
});

/**
 * CATRACA — uma porta por hospedeiro (AD-10 (1), ADR 0047).
 *
 * O literal `'ia-narrar'` e o import da ponte `on-device-engine` só aparecem no
 * ponto de injeção declarado de cada hospedeiro: `mobile/src/lib/motores/`,
 * `web/src/app/core/motores/` e, em `scripts/`, um `motores.ts` por script. É o
 * que impede a terceira cópia do cliente da function — o app já tem duas, cada
 * uma lendo o erro do seu jeito, e nas duas o ramo que lia o corpo de erro era
 * código morto. Varre `mobile/src`, `web/src` e `scripts/`, fora de teste, e
 * conta arquivos.
 *
 * Teto e histórico:
 *   2 (5.1) — `mobile/src/lib/edicao-ia.ts` (a narração, sai na 1.10) e
 *             `mobile/src/services/route-name.ts` (o nome de rota, sai na 5.7).
 *             Vira barreira em zero, na F4.
 */
const PONTOS_DE_INJECAO = [
  /^mobile\/src\/lib\/motores\//,
  /^web\/src\/app\/core\/motores\//,
  /^scripts\/[^/]+\/motores\.ts$/,
];
const TETO_PORTA_POR_HOSPEDEIRO = 2;

check(`CATRACA — a ia-narrar e a ponte só no ponto de injeção de cada hospedeiro (teto ${TETO_PORTA_POR_HOSPEDEIRO})`, () => {
  assert.ok(mobileFiles.length > 0 && webFiles.length > 0, 'mobile/src ou web/src sumiu — a catraca ficou sem alvo');
  // O nome da function em qualquer lugar do código — não só o literal solto: uma
  // chamada por URL (`…/functions/v1/ia-narrar`) é o mesmo cliente, e é a forma
  // mais provável para um script com JWT de usuário.
  const CHAMA_A_FUNCTION = /\bia-narrar\b/;
  const IMPORTA_A_PONTE = new RegExp(
    [
      /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^[ \t]*import\s*)(['"`])[^'"`]*on-device-engine[^'"`]*\1/.source,
      // A ADR 0047 carrega a ponte pelo nome nativo — é o mesmo import, por outra porta.
      /\brequire(?:Optional)?NativeModule\s*(?:<[^>]*>)?\s*\(\s*['"`](?:OnDeviceEngine|on-device-engine)['"`]/.source,
      /\bNativeModules\s*\.\s*OnDeviceEngine\b/.source,
    ].join('|'),
    'm',
  );
  const alvos = [...mobileFiles, ...webFiles, ...walk(join(ROOT, 'scripts'))].filter((f) => !ehTeste(f));
  const fora: string[] = [];
  for (const f of alvos) {
    const rel = f.replace(ROOT + '/', '');
    if (PONTOS_DE_INJECAO.some((re) => re.test(rel))) continue;
    const src = semComentario(readFileSync(f, 'utf8'));
    const o = [
      CHAMA_A_FUNCTION.test(src) ? "'ia-narrar'" : null,
      IMPORTA_A_PONTE.test(src) ? 'on-device-engine' : null,
    ].filter((x): x is string => x !== null);
    if (o.length > 0) fora.push(`${rel} (${o.join(', ')})`);
  }
  fora.sort();
  if (fora.length < TETO_PORTA_POR_HOSPEDEIRO) {
    console.log(`     ↓ porta fora do ponto de injeção caiu para ${fora.length} (teto ${TETO_PORTA_POR_HOSPEDEIRO}) — baixe o teto`);
  }
  assert.ok(
    fora.length <= TETO_PORTA_POR_HOSPEDEIRO,
    `a function ou a ponte chamadas fora do ponto de injeção em ${fora.length} arquivos ` +
      `(teto ${TETO_PORTA_POR_HOSPEDEIRO}):\n    ${fora.join('\n    ')}\n` +
      `  Quem fala com motor pede um ao ponto de injeção do hospedeiro (mobile/src/lib/motores/) e ` +
      `passa pelo orquestrador — criarMotorDeNuvem(invocar) já sabe ler a function.`,
  );
});

/**
 * CATRACA — fora do núcleo, do núcleo de IA só a porta e os descritores (AD-10 (7), AD-2).
 *
 * Um hospedeiro que importa `montarPrompt` e `verificarTexto` está percorrendo
 * a sequência pedido → modelo → conferência por conta própria — exatamente a
 * segunda sequência que o orquestrador existe para não haver. Fora de
 * `packages/shared`, do núcleo de IA se importam a porta (`fio`, `motor`,
 * `orquestrar`, `nuvem`, `recursos`) e os descritores (nomes `descritor*`).
 *
 * Conta só import **de valor**: `import type` e `type X` ficam de fora, porque
 * tipo não sequencia nada — e contá-los faria a catraca nascer em 3 (o cartão e
 * a store da edição importam `Problema` e `EntradaPacote`) e não virar barreira
 * na 1.10. `routes/` fica fora até a 5.7: `nomeDaAtividade` e `nomeProprio` são
 * exibição, usados em seis telas. Varre `mobile/src` e `web/src`, fora de
 * teste; os nomes vêm do que as peças de `ia/` exportam, e conta arquivos.
 *
 * Teto e histórico:
 *   1 (5.1) — `mobile/src/lib/edicao-ia.ts`, a sequência da narração que a 1.10
 *             passa para o orquestrador. Vira barreira em zero, na 1.10.
 */
const PORTA_DE_IA = new Set(['fio', 'motor', 'orquestrar', 'nuvem', 'recursos']);
const TETO_PECAS_DE_IA = 1;

check(`CATRACA — fora do núcleo, do núcleo de IA só a porta e os descritores (teto ${TETO_PECAS_DE_IA})`, () => {
  const iaDir = join(SHARED_SRC, 'ia');
  const moduloDe = (f: string) => f.slice(iaDir.length + 1).replace(/\.tsx?$/, '');
  const pecas = walk(iaDir).filter((f) => !ehTeste(f) && !PORTA_DE_IA.has(moduloDe(f)));

  // Os nomes de VALOR que as peças exportam — pelo barril, é assim que os apps
  // os alcançam. Interface e `type` não entram: importá-los não sequencia nada.
  const nomes = new Set<string>();
  for (const f of pecas) {
    const src = semComentario(readFileSync(f, 'utf8'));
    const DECLARA =
      /^[ \t]*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?\s*|const\s+enum\s+|enum\s+|const\s+|let\s+|var\s+|(?:abstract\s+)?class\s+)([A-Za-z_$][\w$]*)/gm;
    for (const m of src.matchAll(DECLARA)) nomes.add(m[1]);
    for (const m of src.matchAll(/^[ \t]*export\s*\{([^}]*)\}/gm)) {
      for (const s of m[1].split(',').map((x) => x.trim())) {
        if (s && !/^type\s/.test(s)) nomes.add(s.split(/\s+as\s+/).pop()!.trim());
      }
    }
  }
  assert.ok(pecas.length > 0 && nomes.size > 0, 'as peças de ia/ não exportam valor nenhum — a catraca ficou sem alvo');

  const ehDescritor = (nome: string) => /^descritor/i.test(nome);
  const PECA_PROFUNDA = /(?:^|\/)(?:@vitale\/shared|packages\/shared)(?:\/src)?\/ia\/(.+?)(?:\.tsx?)?$/;
  const IMPORTACAO = /^[ \t]*(import|export)\s+(type\s+)?([^;'"]*?)\s*\bfrom\s*(['"])([^'"]+)\4/gm;
  const DINAMICA = /\b(?:import|require)\s*\(\s*(['"])([^'"]+)\1/g;

  /** Os nomes de valor de uma cláusula de import: sem `type X`, sem os descritores. */
  const deValor = (clausula: string): string[] => {
    const out: string[] = [];
    const chaves = /\{([^}]*)\}/.exec(clausula);
    if (chaves) {
      for (const s of chaves[1].split(',').map((x) => x.trim())) {
        if (s && !/^type\s/.test(s)) out.push(s.split(/\s+as\s+/)[0].trim());
      }
    }
    if (/\*/.test(clausula)) out.push('* (o módulo inteiro)');
    const padrao = clausula.replace(/\{[^}]*\}/, '').replace(/\*\s*as\s+[\w$]+/, '').replace(/,/g, ' ').trim();
    if (padrao) out.push(`${padrao} (default)`);
    return out.filter((n) => !ehDescritor(n));
  };

  const fora: string[] = [];
  for (const f of [...mobileFiles, ...webFiles].filter((x) => !ehTeste(x))) {
    const src = semComentario(readFileSync(f, 'utf8'));
    const achados = new Set<string>();
    for (const m of src.matchAll(IMPORTACAO)) {
      if (m[2]) continue;                                   // import type / export type
      const spec = m[5];
      const valor = deValor(m[3]);
      if (spec === '@vitale/shared') {
        // Pelo barril: só conta o que é peça de ia/. `* as X` do barril inteiro
        // alcança as peças todas — conta também.
        for (const n of valor) if (nomes.has(n) || n.startsWith('*')) achados.add(n);
        continue;
      }
      const peca = PECA_PROFUNDA.exec(spec);
      if (peca && !PORTA_DE_IA.has(peca[1])) for (const n of valor) achados.add(`${n} de ia/${peca[1]}`);
    }
    for (const m of src.matchAll(DINAMICA)) {
      const peca = PECA_PROFUNDA.exec(m[2]);
      if (peca && !PORTA_DE_IA.has(peca[1])) achados.add(`import() de ia/${peca[1]}`);
    }
    if (achados.size > 0) fora.push(`${f.replace(ROOT + '/', '')} (${[...achados].join(', ')})`);
  }
  fora.sort();
  if (fora.length < TETO_PECAS_DE_IA) {
    console.log(`     ↓ peças de IA fora do núcleo caíram para ${fora.length} (teto ${TETO_PECAS_DE_IA}) — baixe o teto`);
  }
  assert.ok(
    fora.length <= TETO_PECAS_DE_IA,
    `peça do núcleo de IA importada fora dele em ${fora.length} arquivos (teto ${TETO_PECAS_DE_IA}):\n    ` +
      `${fora.join('\n    ')}\n` +
      `  O hospedeiro chama o orquestrador (ler) com o descritor do recurso; montar o pedido, ` +
      `interpretar e conferir são do descritor, dentro do núcleo (AD-2).`,
  );
});

/**
 * BARREIRA — a lista de termos proibidos tem um dono: `ia/verificar.ts` (AD-6, story 5.2).
 *
 * `VOCABULARIO_PROIBIDO` é a lista, com subconjuntos nomeados; cada recurso os
 * **compõe**. Uma segunda lista é o que a AD-6 existe para impedir: duas
 * conferências com duas ideias do que é conselho, divergindo calado no dia em
 * que uma ganhar um termo e a outra não. Fora do dono (e de teste), nenhum
 * arquivo declara lista com um termo dela — comparado em minúsculas, sem acento e
 * sem espaço nas pontas.
 *
 * **Onde ela olha: o núcleo, `supabase/functions/` e `scripts/`** — os
 * hospedeiros que podem conferir prosa (a function, o backfill e a bancada).
 * `mobile/src` e `web/src` ficam fora de propósito: app não confere texto — quem
 * confere é o descritor, dentro do núcleo, e a guarda (7) cobra que os apps não
 * importem as peças (AD-2) —, e lá os termos de uma palavra são vocabulário de
 * domínio: `saldo` em Finanças, `meta` em Metas, `streak` em hábitos. Medido na
 * revisão da 5.2: zero ocorrência exata nos cinco lugares.
 *
 * **Lista é array literal ou alternância de regex.** O elemento vale
 * desembrulhado de `as`, `satisfies`, parênteses e type assertion (`['porque' as
 * const]`); a regex vale alternativa a alternativa, com `\s` lido como espaço e
 * sem `\b`, `(?:`, parênteses, `^` e `$` (`/\b(porque|devido\s+a)\b/`) — é a
 * outra forma natural de escrever uma conferência de termos.
 *
 * **Lista, não texto.** O `SISTEMA` de `ia/prompt.ts` escreve *"continue
 * assim", "tente dormir mais"* — aspas e vírgula, a cara de uma lista — dentro de
 * um template literal, e é prosa que o modelo lê, não conferência. Só quem sabe
 * onde um literal começa e termina separa as duas coisas, e por isso a barreira
 * lê a árvore do compilador em vez de uma regex: o `typescript` já é dependência
 * do núcleo, e roda offline.
 */
const DONO_DO_VOCABULARIO = join(SHARED_SRC, 'ia', 'verificar.ts');

/** A forma em que um termo é comparado: minúsculas, sem acento, espaço colapsado. */
function formaDoTermo(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** O elemento sem o que só o embrulha: `'x' as const`, `('x')`, `'x' satisfies T`, `<T>'x'`. */
function desembrulhar(no: ts.Expression): ts.Expression {
  let x = no;
  while (
    ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isParenthesizedExpression(x) || ts.isTypeAssertionExpression(x)
  ) {
    x = x.expression;
  }
  return x;
}

/**
 * As alternativas de um literal de regex, na forma em que um termo se compara.
 * Sai o que só delimita — `\b`, `(?:`, parênteses, `^`, `$` — e o resto se parte
 * em `|`. O `(?:` sai antes do parêntese solto, senão sobra o `?:`.
 */
function alternativasDaRegex(literal: string): string[] {
  const corpo = literal.slice(1, literal.lastIndexOf('/'));
  return corpo.replace(/\\s[+*?]?/g, ' ').replace(/\\b|\(\?:|[()^$]/g, '').split('|').map(formaDoTermo);
}

/** Os termos de `termos` que um fonte declara em lista: array literal ou alternância de regex. */
function termosEmLista(src: string, arquivo: string, termos: ReadonlySet<string>): string[] {
  const achados: string[] = [];
  const visitar = (no: ts.Node): void => {
    if (ts.isArrayLiteralExpression(no)) {
      for (const el of no.elements) {
        const x = desembrulhar(el);
        const literal = ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x);
        if (literal && termos.has(formaDoTermo(x.text))) achados.push(x.text);
      }
    }
    if (ts.isRegularExpressionLiteral(no)) {
      for (const alternativa of alternativasDaRegex(no.text)) {
        if (termos.has(alternativa)) achados.push(alternativa);
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(ts.createSourceFile(arquivo, src, ts.ScriptTarget.Latest, false));
  return achados;
}

check('BARREIRA — a lista de termos proibidos só em ia/verificar.ts', () => {
  const termos = new Set(Object.values(VOCABULARIO_PROIBIDO).flat().map(formaDoTermo));
  assert.ok(termos.size > 0, 'VOCABULARIO_PROIBIDO está vazio — a barreira ficou sem alvo');

  // Não-vácua no mecanismo: o detector acha, no dono, cada termo que ele declara.
  // Se a lista mudar de arquivo ou deixar de ser literal, isto quebra antes de a
  // barreira passar em silêncio sobre nada.
  assert.ok(existsSync(DONO_DO_VOCABULARIO), 'ia/verificar.ts sumiu — a barreira ficou sem alvo');
  const noDono = new Set(
    termosEmLista(readFileSync(DONO_DO_VOCABULARIO, 'utf8'), DONO_DO_VOCABULARIO, termos).map(formaDoTermo),
  );
  const naoAchados = [...termos].filter((t) => !noDono.has(t));
  assert.deepEqual(
    naoAchados,
    [],
    `o detector não acha em ia/verificar.ts os termos ${naoAchados.join(', ')} — ou a lista deixou de ` +
      `ser array literal ali, ou o detector quebrou. Se ela mudou de arquivo, aponte DONO_DO_VOCABULARIO para ele.`,
  );

  // A fronteira, provada dos dois lados: lista reprova, com qualquer caixa e
  // acento, embrulhada ou em regex; texto com aspas e vírgula — a forma do
  // `SISTEMA` — não conta, nem regex sem termo.
  const lista = (src: string) => termosEmLista(src, 'lista.ts', termos);
  assert.deepEqual(lista("export const DICAS = ['Continue assim', 42];"), ['Continue assim']);
  assert.deepEqual(lista('const X = new Set([`Parabens`]);'), ['Parabens']);
  assert.deepEqual(lista("const X = ['porque' as const];"), ['porque']);
  assert.deepEqual(lista("const X = [('devido a')];"), ['devido a']);
  assert.deepEqual(lista("const X = ['meta' satisfies string];"), ['meta']);
  assert.deepEqual(lista("const X = [<const>'saldo'];"), ['saldo']);
  assert.deepEqual(lista("const X = [(('graças a' as const))];"), ['graças a']);
  assert.deepEqual(lista('const R = /\\b(porque|devido a)\\b/i;'), ['porque', 'devido a']);
  assert.deepEqual(lista('const R = /^(?:por conta de|fez com que)$/;'), ['por conta de', 'fez com que']);
  assert.deepEqual(lista('const R = /devido\\s+a|fez\\scom\\s*que/;'), ['devido a', 'fez com que']);
  assert.deepEqual(lista('const R = /amostra|poucos dias|insuficiente/;'), []);
  assert.deepEqual(
    termosEmLista('const S = `Nada de\n"continue assim", "tente dormir mais", "parabéns pelo mês".`;', 'texto.ts', termos),
    [],
  );

  const alvos = [
    ...walk(SHARED_SRC),
    ...walk(join(ROOT, 'supabase', 'functions')),
    // `walk` devolve lista vazia se `scripts/` não existe ou não tem TypeScript.
    ...walk(join(ROOT, 'scripts')),
  ];
  const fora = alvos
    .filter((f) => !ehTeste(f) && f !== DONO_DO_VOCABULARIO)
    .flatMap((f) => {
      const achados = termosEmLista(readFileSync(f, 'utf8'), f, termos);
      return achados.length > 0 ? [`${f.replace(ROOT + '/', '')} (${achados.join(', ')})`] : [];
    });
  assert.deepEqual(
    fora,
    [],
    `lista de termo proibido fora do dono: ${fora.join('; ')}.\n` +
      `  Componha VOCABULARIO_PROIBIDO (ia/verificar.ts) pelo subconjunto — VOCABULARIO_PROIBIDO.conselho, ` +
      `não uma lista nova. Termo que falta entra lá, com a fonte ao lado (AD-6).\n` +
      `  Se o achado é identificador de domínio (uma chave, uma coluna) e não termo de conferência, ` +
      `traga o caso ao dono — não afrouxe a barreira.`,
  );
});

/**
 * AD-10: a coordenada da luz é constante do núcleo, nunca do aparelho.
 *
 * O script de backfill e o iPhone podem estar em fusos diferentes e têm que
 * produzir a MESMA edição — uma estação de luz que dependesse de quem apertou o
 * botão faria o mesmo período ter dois pacotes. `astro/timezone-coords.ts` já
 * oferece `deviceCoords()`, e usá-lo em `casa.ts` seria o caminho natural.
 *
 * Os testes de valor não bastam: um `COORDENADA_DA_LUZ = deviceCoords()` é
 * avaliado uma vez no import e passa num teste que só troca o fuso depois; e uma
 * leitura de ambiente fica invisível num processo de teste onde a variável não
 * está definida. A barreira de pureza do núcleo de IA varre `ia/` e `routes/`,
 * e a luz entra por `astro/` — por isso esta existe, e entra no mesmo commit da
 * regra que cobra.
 */
check('BARREIRA — a luz da revista não lê aparelho, fuso nem ambiente', () => {
  const arquivo = join(ROOT, 'packages', 'shared', 'src', 'astro', 'casa.ts');
  assert.ok(existsSync(arquivo), 'casa.ts sumiu — a guarda ficou sem alvo');
  const src = semComentario(readFileSync(arquivo, 'utf8'));
  const PROIBIDO = [
    { re: /from\s*['"][^'"]*timezone-coords['"]/, o: "import de 'timezone-coords'" },
    { re: /\b(deviceCoords|coordsForTimeZone|deviceTimeZone)\s*\(/, o: 'leitura do aparelho ou do fuso' },
    { re: /\bprocess\.env\b|\bDeno\.env\b/, o: 'leitura de ambiente' },
    { re: /\bIntl\.DateTimeFormat\b|\.getTimezoneOffset\s*\(/, o: 'leitura do fuso do processo' },
  ];
  const achados = PROIBIDO.filter(({ re }) => re.test(src)).map(({ o }) => o);
  assert.deepEqual(
    achados,
    [],
    `casa.ts lê ${achados.join(', ')}. A coordenada da luz é constante do núcleo (AD-10): `
      + 'dois hospedeiros em fusos diferentes têm que produzir a mesma edição.',
  );
});

console.log(`\n${passed} testes passaram.`);
