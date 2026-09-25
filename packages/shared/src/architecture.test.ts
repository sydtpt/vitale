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
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { WALLPAPERS } from './constants/wallpaper';
import { APP_THEMES } from './models';
import { THEMES } from './theme/themes';
import { PALETTES } from './theme/palettes';
import { BRANDS } from './theme/brands';
import { cssVars } from './theme/css-vars';
import { sleepColorsOf, sleepCssVars } from './sleep/colors';
import { resolveTokens } from './theme/derive';
import { CLASSES_DE_FALHA } from './ia/fio';
import {
  CHAVE_DA_VERSAO,
  CHAVES_DA_FALHA,
  CHAVES_DA_COMPILACAO,
  CHAVES_DA_RESPOSTA,
  CHAVES_DO_DIAGNOSTICO,
  CHAVES_DO_PEDIDO,
  CHAVES_DOS_TOKENS,
  MODELO_SEM_VARIANTE,
  MOTIVOS_DO_APARELHO,
  lerDiagnosticoDoAparelho,
} from './ia/aparelho';
import { CONCLUSAO } from './ia/motor';
import { VOCABULARIO_PROIBIDO } from './ia/verificar';
import { CADERNO_IDS } from './period/cadernos';
import { CAPA_COLUMNS, MOTIVOS_DA_CAPA, NATUREZAS_DA_CAPA } from './data/edicoes-capa';
import { EDICAO_COLUMNS, TIPOS_COM_EDICAO } from './data/edicoes-ia';

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
 * O quarto hospedeiro (story 5.4 / 2.1): `scripts/`, onde vive a bancada dos
 * motores e, depois, o backfill da revista. `walk` devolve lista vazia se o
 * diretório não existe ou não tem TypeScript, e `ehTeste` (declaração de função,
 * içada) tira os testes — a mesma convenção das duas listas acima.
 *
 * Ele entra nas barreiras **no mesmo commit que o criou**: invariante que vale só
 * para quem chegou primeiro não é invariante.
 */
const scriptFiles = walk(join(ROOT, 'scripts')).filter((f) => !ehTeste(f));

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

/**
 * Arquivo de teste, em qualquer das três convenções do repositório — em
 * TypeScript ou JavaScript (`.js`, `.mjs`, `.cjs`, `.jsx`), porque a barreira da
 * chamada (story 1.8) varre os dois.
 */
function ehTeste(f: string): boolean {
  return /\.(test|spec)\.[mc]?[jt]sx?$/.test(f) || /[\\/]__tests__[\\/]/.test(f);
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
 *
 * **Varre `scripts/` desde a 5.4** (critério 2 da 2.1). O hospedeiro novo é o
 * lugar mais tentador para escrever query solta — ele não tem tela nem revisão de
 * UI, e um `.from('sleep_periods')` ali seria a segunda implementação da consulta
 * que `data/sleep.ts` já faz, sem a paginação que o teto de 1000 linhas do
 * PostgREST exige. Entrou no mesmo commit que criou o workspace.
 */
check('BARREIRA — nenhuma chamada .from() fora do núcleo', () => {
  // Sem alvo, a barreira passa verde sobre nada: se `scripts/` for renomeado, é aqui
  // que se descobre — e não num relatório escrito por uma query que ninguém viu.
  assert.ok(scriptFiles.length > 0, 'scripts/ sumiu ou ficou sem TypeScript — a barreira ficou sem alvo');
  const offenders = [...webFiles, ...mobileFiles, ...scriptFiles]
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
 * onde o backfill da Story 2.2 vai morar, e a garantia que a porta de gravação
 * (`portasDaEdicao`, em `data/edicoes-ia.ts`) promete a ele só vale se a barreira
 * chegar lá antes dele. Desde a 1.10 há uma segunda metade, mais abaixo: o
 * literal da coluna `agg_version_no_momento` não aparece em código fora de
 * `packages/shared/src/data/` — esta cobra o dono da constante, aquela, quem a
 * escreve na carga.
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

/** As migrations, em ordem de aplicação, sem comentário de SQL. */
function migrations(): { f: string; sql: string }[] {
  const dir = join(ROOT, 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({
      f,
      sql: readFileSync(join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, ' '),
    }));
}

/**
 * Os trechos de SQL que falam de UMA tabela: o corpo do `create table` dela e
 * cada `alter table` dela.
 *
 * **Existe porque ler por coluna sozinha lê a tabela errada.** Medido na rodada
 * 2: `check (tipo_periodo in (…))` aparece em `edicoes_ia` e em `edicoes_capa`, e
 * uma busca por coluna pegava a última ocorrência do arquivo mais recente — o
 * CHECK da capa — e deixava o da edição sem nada comparando com ele, na story
 * cujo assunto é a chave de `edicoes_ia`. Uma coluna homônima numa migration
 * futura sequestraria a comparação do mesmo jeito.
 *
 * O corpo do `create table` sai por contagem de parênteses, não por regex: um
 * `check (x in (…))` dentro dele tem parêntese aninhado.
 */
/**
 * O SQL **fora** de corpo de função (`$tag$ … $tag$`).
 *
 * Sem isto, um `alter table … ` escrito dentro de um `create function` — SQL que
 * só roda quando alguém chama a função, se é que roda — é lido como se fosse
 * DDL da migration. A `edicao_imprimir` da 1.9 já tem `set constraints` e três
 * comandos sobre `edicoes_ia` no corpo; basta alguém escrever um `alter` lá para
 * o leitor de migration passar a mentir. É o mesmo recorte que a varredura do
 * `supabase/ensaio/` faz, pelo mesmo motivo.
 */
function semCorposDeFuncao(sql: string): string {
  return sql.replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1?\$/g, ' ');
}

/**
 * Onde termina o parêntese aberto em `de`, **pulando literais**.
 *
 * Contar `(` e `)` cru trata um `default '(vazio)'` como estrutura. Não é
 * hipótese: o repositório tem `check (length(trim(legenda)) > 0)` e defaults de
 * texto na mesma tabela.
 */
function fechaParenteses(sql: string, de: number): number {
  let i = de;
  let nivel = 1;
  while (i < sql.length && nivel > 0) {
    const c = sql[i];
    if (c === "'") {
      i += 1;
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) {
        i += sql[i] === "'" ? 2 : 1;
      }
    } else if (c === '(') nivel += 1;
    else if (c === ')') nivel -= 1;
    i += 1;
  }
  return i;
}

function trechosDaTabela(sql: string, tabela: string): string[] {
  const out: string[] = [];
  const limpo = semCorposDeFuncao(sql);
  const criar = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${tabela}\\s*\\(`, 'gi');
  for (const m of limpo.matchAll(criar)) {
    out.push(limpo.slice(m.index!, fechaParenteses(limpo, m.index! + m[0].length)));
  }
  const alterar = new RegExp(
    `alter\\s+table\\s+(?:only\\s+)?(?:if\\s+exists\\s+)?(?:public\\.)?${tabela}\\b[^;]*;`, 'gi');
  for (const m of limpo.matchAll(alterar)) out.push(m[0]);
  const derrubar = new RegExp(
    `drop\\s+table\\s+(?:if\\s+exists\\s+)?(?:public\\.)?${tabela}\\b[^;]*;`, 'gi');
  for (const m of limpo.matchAll(derrubar)) out.push(m[0]);
  return out;
}

/**
 * Os valores que o CHECK **vigente** de `<tabela>.<coluna>` aceita, ou `null` se
 * nenhuma migration o define — ou se a última coisa que aconteceu com ele foi
 * ser **derrubado**.
 *
 * Duas formas são lidas, porque as duas são a mesma coisa para o Postgres e a
 * segunda é como ele a devolve normalizada num dump:
 *
 *     check (coluna in ('a', 'b'))
 *     check (coluna = any (array['a', 'b']))
 *
 * E o `drop constraint` conta: sem ele, esta função continuava citando a lista
 * velha — a barreira ficava verde afirmando uma garantia que o banco tinha
 * deixado de dar, que é a pior coisa que uma barreira pode fazer. Constraint sem
 * nome no `create table` recebe do Postgres `<tabela>_<coluna>_check`, e é por
 * esse nome que ela é derrubada.
 */
function idsAceitosPeloCheck(tabela: string, coluna: string): { f: string; ids: Set<string> } | null {
  const formas = [
    new RegExp(`check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`, 'i'),
    new RegExp(`check\\s*\\(\\s*${coluna}\\s*=\\s*any\\s*\\(\\s*array\\s*\\[([^\\]]*)\\]`, 'i'),
  ];
  // O nome com que a constraint foi declarada, se ela tiver um.
  const nomeDeclarado = new RegExp(
    `constraint\\s+([a-z_][a-z0-9_]*)\\s+check\\s*\\(\\s*${coluna}\\b`, 'i');
  let achado: { f: string; ids: Set<string>; nomes: string[] } | null = null;

  for (const { f, sql } of migrations()) {
    for (const trecho of trechosDaTabela(sql, tabela)) {
      if (/^\s*drop\s+table/i.test(trecho)) { achado = null; continue; }
      // Um `drop constraint` do nome que carrega este CHECK apaga o que se sabia.
      if (achado) {
        for (const m of trecho.matchAll(/drop\s+constraint\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
          if (achado.nomes.includes(m[1].toLowerCase())) { achado = null; break; }
        }
      }
      for (const re of formas) {
        const m = re.exec(trecho);
        if (!m) continue;
        const ids = new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
        const declarado = nomeDeclarado.exec(trecho)?.[1]?.toLowerCase();
        achado = {
          f,
          ids,
          // O implícito do Postgres e, se houver, o explícito da declaração.
          nomes: [`${tabela}_${coluna}_check`, ...(declarado ? [declarado] : [])],
        };
      }
    }
  }
  return achado ? { f: achado.f, ids: achado.ids } : null;
}

/**
 * As colunas que a tabela TEM no banco, segundo as migrations: as do `create
 * table`, mais `add column`, menos `drop column`, com `rename column` aplicado —
 * e zerada por `drop table`.
 *
 * O corpo do `create table` é partido por vírgula de primeiro nível, e entra o
 * que começa por identificador — cláusula de tabela (`primary key`, `constraint`,
 * `check`, `unique`, `foreign key`, `exclude`, `like`) fica de fora.
 *
 * **Limitações conhecidas, e declaradas de propósito.** Isto é um leitor léxico
 * de migration, não um Postgres: ele existe para pegar a divergência que nasce de
 * alguém editar um lado e esquecer o outro, e cada caso abaixo custaria mais do
 * que esse ganho:
 *
 * - **Identificador entre aspas duplas** (`"tipo de período"`) não é
 *   normalizado; as migrations deste repositório não usam nenhum.
 * - **`alter table … rename to`** (a tabela inteira mudando de nome) não é
 *   seguido: a leitura continuaria no nome velho e a barreira reprovaria por
 *   "nenhuma migration cria <tabela>", que é falha barulhenta, não silenciosa.
 * - **DDL dentro de `DO $$…$$` ou `execute format(...)`** é invisível: os corpos
 *   saem antes da análise, o que é a escolha certa para não ler comando de
 *   função como DDL, e o preço é não ver DDL dinâmico. O ensaio em
 *   `supabase/ensaio/` tem a mesma limitação, escrita no README dele.
 * - **`like` e herança** trazem colunas de outra tabela sem as nomear aqui.
 * - **Comentário de bloco aninhado** engana o `migrations()`, que os tira por
 *   regex não-gulosa.
 *
 * A rede de verdade contra tudo isso é o ensaio, que aplica a migration num
 * Postgres e compara o catálogo com produção.
 */
const CLAUSULA_DE_TABELA = new Set([
  'primary', 'constraint', 'check', 'unique', 'foreign', 'exclude', 'like',
]);

function colunasDaTabela(tabela: string): { f: string; colunas: Set<string> } | null {
  let nasceu: string | null = null;
  const colunas = new Set<string>();
  for (const { f, sql } of migrations()) {
    for (const trecho of trechosDaTabela(sql, tabela)) {
      if (/^\s*drop\s+table/i.test(trecho)) {
        // A tabela deixou de existir. O que vier depois recomeça do zero — e se
        // nada vier, a barreira reprova por não achar `create table`, que é a
        // resposta certa para uma leitura que pede colunas de tabela morta.
        nasceu = null;
        colunas.clear();
      } else if (/^\s*create\s+table/i.test(trecho)) {
        nasceu = f;
        colunas.clear();
        const corpo = trecho.slice(trecho.indexOf('(') + 1, trecho.lastIndexOf(')'));
        let nivel = 0;
        let atual = '';
        let emLiteral = false;
        const partes: string[] = [];
        for (let i = 0; i < corpo.length; i += 1) {
          const ch = corpo[i];
          // Literais não são estrutura: `default '(a,b)'` tem vírgula e parêntese.
          if (ch === "'") emLiteral = !emLiteral;
          if (!emLiteral) {
            if (ch === '(') nivel += 1;
            else if (ch === ')') nivel -= 1;
            if (ch === ',' && nivel === 0) { partes.push(atual); atual = ''; continue; }
          }
          atual += ch;
        }
        partes.push(atual);
        for (const p of partes) {
          const nome = p.trim().match(/^([a-z_][a-z0-9_]*)\b/i)?.[1];
          if (nome && !CLAUSULA_DE_TABELA.has(nome.toLowerCase())) colunas.add(nome.toLowerCase());
        }
      } else {
        for (const m of trecho.matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
          colunas.add(m[1].toLowerCase());
        }
        for (const m of trecho.matchAll(/\bdrop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
          colunas.delete(m[1].toLowerCase());
        }
        // `rename column a to b` — sem isto a lista fica com o nome velho, que é
        // pior que não saber: ela afirma uma coluna que o PostgREST recusa.
        for (const m of trecho.matchAll(
          /\brename\s+column\s+([a-z_][a-z0-9_]*)\s+to\s+([a-z_][a-z0-9_]*)/gi)) {
          colunas.delete(m[1].toLowerCase());
          colunas.add(m[2].toLowerCase());
        }
      }
    }
  }
  return nasceu ? { f: nasceu, colunas } : null;
}

check('BARREIRA — os CHECKs de user_preferences cobrem todos os ids do app', () => {
  const problemas: string[] = [];
  for (const { coluna, ids } of ID_COLUMNS) {
    const check = idsAceitosPeloCheck('user_preferences', coluna);
    if (!check) {
      problemas.push(`${coluna}: nenhuma migration define o CHECK`);
      continue;
    }
    const faltando = ids().filter((id) => !check.ids.has(id));
    if (faltando.length) {
      problemas.push(`${coluna}: o banco recusa ${faltando.join(', ')} (${check.f})`);
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
 * BARREIRA — os ids da edição são a MESMA lista dos dois lados (Story 1.9).
 *
 * `edicoes_ia.caderno` repete `CADERNO_IDS` e `edicoes_capa.natureza` repete
 * `NATUREZAS_DA_CAPA` — e, desde a Story 1.16, `edicoes_capa.motivo` repete
 * `MOTIVOS_DA_CAPA` —, e as migrations dizem em comentário que é "a mesma
 * lista, letra por letra". Comentário não é guarda: o id nasce minúsculo e sem
 * acento justamente para não precisar de tradução entre camadas, e o dia em que
 * precisar ninguém vai notar por leitura.
 *
 * **Igualdade exata, e não cobertura**, que é onde esta barreira difere da de
 * `user_preferences`. Lá o banco pode aceitar id legado que o app não escreve
 * mais; aqui os dois lados são o mesmo vocabulário fechado — um quinto caderno
 * só no SQL seria uma linha que o `CadernoId` não sabe ler, e uma natureza só no
 * TS seria uma capa que o banco recusa na hora de carimbar.
 */
const ID_COLUMNS_DA_EDICAO: {
  tabela: string; coluna: string; ids: () => readonly string[]; dono: string;
}[] = [
  { tabela: 'edicoes_ia', coluna: 'caderno', ids: () => CADERNO_IDS, dono: 'period/cadernos.ts (CADERNO_IDS)' },
  { tabela: 'edicoes_capa', coluna: 'natureza', ids: () => NATUREZAS_DA_CAPA, dono: 'data/edicoes-capa.ts (NATUREZAS_DA_CAPA)' },
  // O porquê da capa (Story 1.16), no mesmo molde da natureza. A coluna é nula de
  // propósito (o build anterior grava sem ela), mas a LISTA é fechada dos dois
  // lados: um motivo só no TS seria uma troca que o banco recusa na hora de
  // carimbar, e um só no SQL, uma ficha que o `toCapa` explode ao ler.
  { tabela: 'edicoes_capa', coluna: 'motivo', ids: () => MOTIVOS_DA_CAPA, dono: 'data/edicoes-capa.ts (MOTIVOS_DA_CAPA)' },
  // **Duas linhas, uma por tabela**, e não uma valendo pelas duas: as duas
  // declaram `tipo_periodo` e cada uma tem o próprio CHECK. Com uma linha só, a
  // busca pegava o CHECK da capa e deixava o da edição sem conferência — na
  // story cujo assunto é exatamente a chave de `edicoes_ia`.
  { tabela: 'edicoes_ia', coluna: 'tipo_periodo', ids: () => TIPOS_COM_EDICAO, dono: 'data/edicoes-ia.ts (TIPOS_COM_EDICAO)' },
  { tabela: 'edicoes_capa', coluna: 'tipo_periodo', ids: () => TIPOS_COM_EDICAO, dono: 'data/edicoes-ia.ts (TIPOS_COM_EDICAO)' },
];

check('BARREIRA — caderno, natureza, motivo da capa e tipo de período são a mesma lista no TS e no banco', () => {
  const problemas: string[] = [];
  for (const { tabela, coluna, ids, dono } of ID_COLUMNS_DA_EDICAO) {
    const noTs = [...ids()].sort();
    assert.ok(noTs.length > 0, `${dono} ficou vazio — a barreira perdeu o alvo do lado do TS.`);
    const check = idsAceitosPeloCheck(tabela, coluna);
    if (!check) {
      problemas.push(`${tabela}.${coluna}: nenhuma migration define o CHECK (o dono no TS é ${dono})`);
      continue;
    }
    const noBanco = [...check.ids].sort();
    if (noTs.join(',') !== noBanco.join(',')) {
      problemas.push(
        `${tabela}.${coluna} (${check.f}): o banco aceita [${noBanco.join(', ')}] e ${dono} declara `
        + `[${noTs.join(', ')}]`,
      );
    }
  }
  assert.deepEqual(
    problemas,
    [],
    `a lista divergiu entre o TS e o banco:\n    ${problemas.join('\n    ')}\n` +
      `  Os dois lados mudam na mesma entrega — e a do banco é migration com \`drop constraint\` + ` +
      `\`add constraint\`, nunca \`add column if not exists\` com o check colado.`,
  );
});

/**
 * BARREIRA — `TIPOS_COM_EDICAO` é `PeriodKind` menos `'all'` (Story 1.9).
 *
 * A lista existe para separar "período que ainda não foi escrito" de "período que
 * nunca terá edição". Se `PeriodKind` ganhar um valor novo — um `quarter`, um
 * `decade` — e ninguém tocar aqui, a tela passa a tratá-lo como **ausência
 * permanente**: a edição nunca aparece, e nada acusa. O contrário, um valor só
 * nesta lista, é a leitura procurando por um tipo que o CHECK recusa.
 *
 * `PeriodKind` é união de tipo e não existe em runtime, então a barreira lê a
 * declaração no fonte. `'all'` é a única exclusão, e é nomeada: período que nunca
 * fecha não tem edição, por definição.
 */
check("BARREIRA — TIPOS_COM_EDICAO é PeriodKind menos 'all'", () => {
  // Caminho literal, e não `SHARED_SRC`: os `check` rodam na ordem do arquivo, e
  // a constante é declarada bem depois daqui.
  const fonte = readFileSync(join(ROOT, 'packages', 'shared', 'src', 'period', 'bounds.ts'), 'utf8');
  const m = /export\s+type\s+PeriodKind\s*=\s*([^;]+);/.exec(semComentario(fonte));
  assert.ok(m, 'period/bounds.ts não declara mais `export type PeriodKind` — a barreira ficou sem alvo.');
  const daUniao = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(daUniao.length > 1, `PeriodKind foi lido como ${JSON.stringify(daUniao)} — a leitura da união falhou.`);
  assert.ok(daUniao.includes('all'), "PeriodKind deixou de ter 'all'; reveja a exclusão nomeada desta barreira.");
  assert.deepEqual(
    [...TIPOS_COM_EDICAO].sort(),
    daUniao.filter((k) => k !== 'all').sort(),
    `TIPOS_COM_EDICAO e PeriodKind divergiram. Tipo novo na união que não entrar na lista vira ` +
      `ausência permanente na tela — a edição dele nunca aparece, e nada acusa.`,
  );
});

/**
 * BARREIRA — o que a leitura PEDE existe no banco (Story 1.9, rodada 2).
 *
 * `EDICAO_COLUMNS` e `CAPA_COLUMNS` são as listas que vão ao PostgREST. O teste
 * de unidade as compara com `EdicaoRow`/`CapaRow` — mas a string e a interface
 * são **as duas escritas à mão, no mesmo vocabulário e no mesmo commit**: um
 * nome errado nos dois (que é o que o compilador obriga a fazer junto) passa
 * verde e devolve 400 em toda leitura de produção.
 *
 * Esta barreira fecha o triângulo comparando com o **banco** — as colunas que as
 * migrations criam, menos as que elas derrubam.
 *
 * **A invariante é dupla, e não igualdade com o banco.** Igualdade obrigaria a
 * pedir para sempre toda coluna que a tabela tiver, inclusive a que a tela
 * descarta, e quebraria no dia em que nascesse uma coluna de uso só do servidor
 * (um `processado_em`, um contador de custo) — a barreira mandaria pedi-la à toa.
 * O que de fato tem de valer são duas continências:
 *
 * - **pedidas ⊆ colunas do banco** — pedir o que não existe é 400 do PostgREST
 *   em toda leitura de produção;
 * - **pedidas ⊇ chaves da interface da linha** — a interface é o que o código
 *   lê; coluna nela que não foi pedida chega `undefined` na tela, calada.
 *
 * A segunda é o que amarra a string à interface do lado de fora do compilador: o
 * teste de unidade compara as duas entre si, e as duas são escritas à mão no
 * mesmo commit.
 */
/**
 * As chaves de uma `export interface` — **lidas do fonte**, porque interface de
 * TypeScript não existe em runtime.
 *
 * Podia ser uma lista à mão aqui; seria a terceira cópia do mesmo vocabulário, e
 * a barreira passaria a comparar duas coisas que a mesma pessoa escreveu na
 * mesma hora. O fonte é a única fonte que ninguém atualiza "para o teste passar".
 */
function chavesDaInterface(arquivoRel: string, nome: string): string[] {
  const src = semComentario(readFileSync(join(ROOT, arquivoRel), 'utf8'));
  const i = src.search(new RegExp(`export\\s+interface\\s+${nome}\\s*\\{`));
  assert.ok(i >= 0, `${arquivoRel} não declara mais \`export interface ${nome}\` — a barreira ficou sem alvo.`);
  const abre = src.indexOf('{', i);
  const corpo = src.slice(abre + 1, fechaChaves(src, abre + 1));
  return [...corpo.matchAll(/^\s*([a-z_][a-z0-9_]*)\s*\??\s*:/gim)].map((m) => m[1].toLowerCase());
}

function fechaChaves(src: string, de: number): number {
  let i = de;
  let nivel = 1;
  while (i < src.length && nivel > 0) {
    if (src[i] === '{') nivel += 1;
    else if (src[i] === '}') nivel -= 1;
    i += 1;
  }
  return i - 1;
}

const CHAVES_DE_EDICAO_ROW = chavesDaInterface('packages/shared/src/data/edicoes-ia.ts', 'EdicaoRow');
const CHAVES_DE_CAPA_ROW = chavesDaInterface('packages/shared/src/data/edicoes-capa.ts', 'CapaRow');

const COLUNAS_PEDIDAS: {
  tabela: string; colunas: string; daInterface: readonly string[]; dono: string;
}[] = [
  {
    tabela: 'edicoes_ia',
    colunas: EDICAO_COLUMNS,
    daInterface: CHAVES_DE_EDICAO_ROW,
    dono: 'data/edicoes-ia.ts (EDICAO_COLUMNS)',
  },
  {
    tabela: 'edicoes_capa',
    colunas: CAPA_COLUMNS,
    daInterface: CHAVES_DE_CAPA_ROW,
    dono: 'data/edicoes-capa.ts (CAPA_COLUMNS)',
  },
];

check('BARREIRA — as colunas pedidas existem no banco e cobrem a linha lida', () => {
  const problemas: string[] = [];
  for (const { tabela, colunas, daInterface, dono } of COLUNAS_PEDIDAS) {
    const pedidas = colunas.split(',').map((c) => c.trim().toLowerCase()).sort();
    assert.ok(pedidas.length > 0, `${dono} está vazio — a barreira perdeu o alvo.`);
    assert.ok(
      daInterface.length > 0,
      `a lista de chaves da linha de ${tabela} está vazia — a barreira passaria por vacuidade do lado do TS.`,
    );
    const noBanco = colunasDaTabela(tabela);
    assert.ok(noBanco, `nenhuma migration cria ${tabela} — a barreira ficou sem alvo.`);
    const doBanco = [...noBanco!.colunas].sort();
    assert.ok(
      doBanco.length > 0,
      `a leitura das colunas de ${tabela} (${noBanco!.f}) devolveu vazio — o parser de \`create table\` ` +
        `perdeu a forma do arquivo, e a barreira passaria por vacuidade.`,
    );
    const naoExistem = pedidas.filter((c) => !doBanco.includes(c));
    if (naoExistem.length) {
      problemas.push(`${dono} pede coluna que ${tabela} não tem: ${naoExistem.join(', ')} (400 no PostgREST)`);
    }
    const naoPedidas = [...daInterface].map((c) => c.toLowerCase()).filter((c) => !pedidas.includes(c));
    if (naoPedidas.length) {
      problemas.push(
        `${dono} não pede coluna que a interface da linha lê: ${naoPedidas.join(', ')} (chega undefined na tela)`,
      );
    }
    // Não é erro, mas é dívida: coluna do banco que ninguém lê. Fica como aviso
    // para não obrigar a pedir o que a tela descarta.
    const semLeitor = doBanco.filter((c) => !pedidas.includes(c));
    if (semLeitor.length) {
      // eslint-disable-next-line no-console
      console.log(`    (nota: ${tabela} tem coluna que ninguém lê: ${semLeitor.join(', ')})`);
    }
  }
  assert.deepEqual(
    problemas,
    [],
    `a lista de colunas divergiu do banco:\n    ${problemas.join('\n    ')}\n` +
      `  Coluna nova entra na migration, na interface da linha E na string de COLUMNS — as três, ou a ` +
      `leitura mente.`,
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
 * BARREIRA — o foco de acessibilidade do mobile vai por `sendAccessibilityEvent`.
 *
 * `AccessibilityInfo.sendAccessibilityEvent(nó, 'focus')` é **a** API para mover
 * o foco do leitor de tela, e ela recebe o **ref do host** — o mesmo objeto que
 * `ref={...}` numa `View` entrega. As duas alternativas que a internet ainda
 * ensina estão trancadas aqui em zero:
 *
 * - `setAccessibilityFocus(handle)` — depreciado na doc atual;
 * - `findNodeHandle(componente)` — a ponte para o handle numérico que a API nova
 *   não quer, e que na New Architecture é justamente o que se deixou para trás.
 *
 * Teto **zero, desde o primeiro uso**: a rolagem ancorada da revista (Story 1.14)
 * é o primeiro lugar do app a mover o foco, e no dia em que nasceu não havia
 * ocorrência nenhuma dos dois nomes. Barreira que nasce junto com a regra nunca
 * precisa de catraca — e esta é a única janela em que isso era de graça.
 *
 * **Comentário não é uso**: o hook explica por escrito por que não usa nenhum dos
 * dois, e é assim que a regra continua se explicando de dentro do código que ela
 * cobra. Mas aqui o comentário é apagado **sem perder linha** — o `semComentario`
 * do topo troca o bloco inteiro por um espaço, e a mensagem apontaria para um
 * número que no arquivo é outra coisa, mandando quem for conferir ao lugar errado.
 *
 * Varre `mobile/src` **inteiro**, testes incluídos (e não a `mobileFiles`, que os
 * tira): um teste que monte o foco pela porta velha ensina a porta velha.
 */
check('BARREIRA — foco de acessibilidade sem API depreciada nem handle numérico', () => {
  const PROIBIDAS = /\b(setAccessibilityFocus|findNodeHandle)\b/g;
  const semComentarioNaLinha = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
      .replace(/^[ \t]*\/\/.*$/gm, ' ');

  const offenders: string[] = [];
  for (const f of walk(join(ROOT, 'mobile', 'src'))) {
    const src = semComentarioNaLinha(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(PROIBIDAS)) {
      const linha = src.slice(0, m.index).split('\n').length;
      offenders.push(`${f.replace(ROOT + '/', '')}:${linha} ${m[1]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `foco de acessibilidade pela porta errada:\n    ${offenders.join('\n    ')}\n` +
      `  Use AccessibilityInfo.sendAccessibilityEvent(ref, 'focus') — o ref do host, ` +
      `não um handle. O hook useRolagemAncorada já faz isso.`,
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
    /**
     * `primaryOn` é a tinta sobre o **`primarySoft`** (o preenchimento pálido) —
     * sobre o `primary` sólido ele mede **1,00** na marca Tinta e 1,11 na
     * Laranja: texto preto em botão preto. O botão "Escrever a edição" da rota
     * da revista nasceu assim na 1.11 e só apareceu no iPhone do dono em 18/09,
     * porque a marca dele é a Tinta. Sobre o cheio o token é `onPrimary`, que o
     * resto do app já usa e que a marca pode declarar (o laranja quer branco).
     * Teto **zero**: não há uso legítimo hoje, e o dia em que houver pede um
     * fundo `primarySoft` na mesma folha.
     */
    label: 'mobile — color: colors.primaryOn (é tinta de primarySoft, não do sólido)',
    files: mobileFiles,
    re: /color:\s*colors\.primaryOn\b/g,
    max: 0,
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
 * 63 com a 5.2, que trouxe o descritor da retrospectiva e `format/numero.ts`;
 * 67 com a 5.3 — `ia/interpolar.ts`, e `sleep/leitura.ts` entrando como
 * semente (é o descritor da Saúde, tipado por `Descritor`), com `sleep/caso.ts`
 * e `sleep/ranges.ts` pelo fecho. É a Saúde do sono sendo achada sozinha.
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
 * BARREIRA — `supabase/functions/` só cita classe de falha do que importa de
 * `ia/fio.ts` (story 5.6).
 *
 * As sete {@link CLASSES_DE_FALHA} são vocabulário do núcleo, não da function.
 * Um arquivo que escreve `classe: 'indisponivel'` sem importar `ia/fio.ts` está
 * repetindo a mesma palavra por conta própria — e no dia em que o núcleo ganhar
 * uma oitava classe, ou renomear uma das sete, esse arquivo continuaria com a
 * grafia velha e ninguém acusaria. Importar amarra a grafia à mesma fonte que o
 * cliente (`ia/nuvem.ts`) já lê, e é o que a "guarda 3" do épico (AD-10) pedia —
 * ela nasce aqui, na primeira story em que `supabase/functions/` de fato fala
 * em classes, e não no marco do aparelho que ainda não existe.
 *
 * Pela AST, como `chamamMetodo` mais abaixo: só literal de string cujo texto é
 * **exatamente** uma das sete classes conta — comentário não conta, e uma
 * substring dentro de uma frase (ex.: um texto de UI que contenha a palavra
 * "guarda") também não, porque o nó tem de ser o literal inteiro.
 */
check('BARREIRA — supabase/functions/ só cita classe do que importa de ia/fio.ts', () => {
  const fnFiles = walk(join(ROOT, 'supabase', 'functions')).filter((f) => !ehTeste(f));
  assert.ok(fnFiles.length > 0, 'supabase/functions/ sumiu — a barreira ficou sem alvo');
  const IMPORTA_O_FIO = /from\s*['"][^'"]*ia\/fio(?:\.ts)?['"]/;
  const alvo = new Set<string>(CLASSES_DE_FALHA as readonly string[]);
  const offenders: string[] = [];
  for (const f of fnFiles) {
    const src = semComentario(readFileSync(f, 'utf8'));
    const achados = new Set<string>();
    const visitar = (no: ts.Node): void => {
      if (ts.isStringLiteralLike(no) && alvo.has(no.text)) achados.add(no.text);
      ts.forEachChild(no, visitar);
    };
    visitar(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, false));
    if (achados.size > 0 && !IMPORTA_O_FIO.test(src)) {
      offenders.push(`${f.replace(ROOT + '/', '')} (${[...achados].sort().join(', ')})`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `classe de falha citada sem importar ia/fio.ts: ${offenders.join(', ')}. ` +
      `Importe CLASSES_DE_FALHA/ClasseDeFalha/STATUS_POR_CLASSE de ia/fio.ts por caminho relativo ` +
      `(o Deno exige a extensão .ts), em vez de repetir a grafia das classes à mão.`,
  );
});

/**
 * As guardas da ponte do aparelho — (3), a metade Swift, e (4) — nascem com o
 * `Engine.swift` (AD-10, story 5.10).
 *
 * O Swift não importa `ia/fio.ts`: a ponte é outra língua, e o vocabulário das classes
 * chega lá como um `enum ClasseDeFalha: String` escrito à mão. Então quem amarra a
 * grafia é esta guarda — ela lê o enum no fonte e exige a **igualdade de conjunto** com
 * `CLASSES_DE_FALHA`, cada caso com o valor bruto explícito (o implícito seria o nome
 * Swift, `recusaDoModelo`, que não é a grafia do fio). E os imports do arquivo ficam na
 * lista permitida: nem `ExpoModulesCore` (a cola do Expo é outro arquivo), nem modelo de
 * servidor.
 *
 * O arquivo sumir **reprova**: uma guarda que passa quando o alvo não existe é a guarda
 * que ninguém percebe desligada.
 *
 * O Swift é lido por um varredor próprio, não por `semComentario`: o Swift aninha
 * comentário de bloco e tem string de várias linhas (`"""`), e um `import` citado dentro
 * de uma delas não é import.
 */
const ENGINE_SWIFT = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios', 'Engine.swift');
const MOTOR_COREAI_SWIFT = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios', 'MotorCoreAI.swift');

/**
 * O módulo que a casca vendorizada do Core AI expõe (story 5.8).
 *
 * **Um módulo, e não o pacote da Apple.** `scripts/coreai/OrbeCoreAI.swift` importa
 * `CoreAILanguageModels` com `internal import` e é compilado com library evolution: a
 * `.swiftinterface` que o pod consome não cita o pacote, e é por isso que a vendorização cabe
 * num `SWIFT_INCLUDE_PATHS` com um arquivo dentro. Se este nome aparecer em qualquer outro
 * fonte Swift do módulo, a ponte deixou de ser o único ponto do app que alcança o Core AI.
 */
const CASCA_DO_COREAI = 'OrbeCoreAI';
const PODSPEC_DA_PONTE = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios', 'OnDeviceEngine.podspec');

/**
 * Os módulos do pacote `apple/coreai-models` e do grafo dele que expõem tipo público — os que
 * alguém poderia querer importar direto, saltando a casca. A lista é do que o `CoreAILM`
 * arrasta; ela não precisa ser exaustiva para servir, porque o caminho natural é o primeiro.
 */
const MODULOS_DO_PACOTE_DA_APPLE: ReadonlySet<string> = new Set([
  'CoreAILanguageModels',
  'CoreAIShared',
  'CXGrammar',
  'XGrammar',
  'Tokenizers',
  'Hub',
  'Jinja',
  'HuggingFace',
  'Generation',
  'Models',
]);

/**
 * Os imports permitidos, **por arquivo** — a barreira (4), que a 5.8 fez crescer de propósito.
 *
 * Era um conjunto só, quando a ponte era um arquivo só. Virou um mapa porque os dois motores
 * do aparelho têm alcances diferentes, e misturá-los apagaria a diferença:
 *
 *  - `Engine.swift` continua em **dois** imports. Ele é o modelo do sistema, e é o arquivo
 *    que a CLI da bancada compila para medir no Mac (`scripts/bancada/aparelho/`): um import
 *    da casca vendorizada aqui quebraria a coluna do aparelho, que não tem `.a` nenhum.
 *  - `MotorCoreAI.swift` ganha **um terceiro**, {@link CASCA_DO_COREAI}, e só ele. O pacote
 *    `apple/coreai-models` nunca é importado direto: quem o alcança é a casca, fora do app.
 *
 * Em nenhum dos dois entra `ExpoModulesCore` (a cola do Expo é outro arquivo) nem modelo de
 * servidor — se ele voltar, é `nuvem:`, com regime e lista do servidor (AD-3, AD-9).
 */
const IMPORTS_PERMITIDOS_NA_PONTE: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [ENGINE_SWIFT, new Set(['Foundation', 'FoundationModels'])],
  [MOTOR_COREAI_SWIFT, new Set(['Foundation', 'FoundationModels', CASCA_DO_COREAI])],
]);

/**
 * O código Swift sem comentário e sem o miolo das strings de várias linhas. Comentário
 * de bloco aninha (um segundo abre-bloco dentro do primeiro pede dois fecha-blocos); a
 * string de uma linha fica inteira — é nela que mora o valor bruto do enum —, e o `//`
 * dentro dela não corta nada.
 */
function codigoSwift(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('//', i)) {
      const fim = src.indexOf('\n', i);
      i = fim < 0 ? src.length : fim;
      continue;
    }
    if (src.startsWith('/*', i)) {
      let profundidade = 0;
      do {
        if (src.startsWith('/*', i)) {
          profundidade += 1;
          i += 2;
        } else if (src.startsWith('*/', i)) {
          profundidade -= 1;
          i += 2;
        } else {
          i += 1;
        }
      } while (profundidade > 0 && i < src.length);
      out += ' ';
      continue;
    }
    if (src.startsWith('"""', i)) {
      const fim = src.indexOf('"""', i + 3);
      i = fim < 0 ? src.length : fim + 3;
      out += '""';
      continue;
    }
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

/** O trecho entre a chave que abre em `abre` e a que a fecha, sem o que está aninhado. */
function corpoRaso(codigo: string, abre: number): string | null {
  let profundidade = 0;
  let raso = '';
  for (let i = abre; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '"') {
      // A string de uma linha passa inteira — uma chave dentro dela não conta.
      let j = i + 1;
      while (j < codigo.length && codigo[j] !== '"' && codigo[j] !== '\n') j += codigo[j] === '\\' ? 2 : 1;
      if (profundidade === 1) raso += codigo.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === '{') {
      profundidade += 1;
      if (profundidade === 1) continue;
    } else if (c === '}') {
      profundidade -= 1;
      if (profundidade === 0) return raso;
    }
    if (profundidade === 1) raso += c;
  }
  return null;
}

/**
 * Os problemas do `enum ClasseDeFalha` de um fonte Swift, contra `CLASSES_DE_FALHA`.
 * Lista vazia: o enum existe uma vez, tem `String` como tipo bruto, todo caso tem valor
 * bruto explícito, e os valores são exatamente as sete classes.
 */
function problemasDoEnumDeClasses(src: string): string[] {
  const codigo = codigoSwift(src);
  const cabecalhos = [...codigo.matchAll(/\benum[ \t]+ClasseDeFalha\b([^{]*)\{/g)];
  if (cabecalhos.length === 0) return ['não declara `enum ClasseDeFalha`'];
  if (cabecalhos.length > 1) return [`declara \`enum ClasseDeFalha\` ${cabecalhos.length} vezes`];
  const [cabecalho] = cabecalhos;
  const heranca = cabecalho[1].trim();
  if (!/^:\s*String\b/.test(heranca)) return [`o enum não tem String como tipo bruto (${heranca || 'sem herança'})`];
  const corpo = corpoRaso(codigo, cabecalho.index! + cabecalho[0].length - 1);
  if (corpo === null) return ['o enum não fecha'];

  const problemas: string[] = [];
  const valores: string[] = [];
  for (const m of corpo.matchAll(/(?:^|[;\n])[ \t]*(?:@\w+[ \t]+)*(?:indirect[ \t]+)?case[ \t]+([^;\n]+)/g)) {
    for (const parte of m[1].split(',').map((x) => x.trim()).filter((x) => x !== '')) {
      const explicito = /^(`?[A-Za-z_][\w]*`?)\s*=\s*"((?:[^"\\]|\\.)*)"$/.exec(parte);
      if (!explicito) {
        problemas.push(`o caso \`${parte}\` não tem valor bruto explícito em string`);
        continue;
      }
      valores.push(explicito[2]);
    }
  }
  const repetidos = valores.filter((v, i) => valores.indexOf(v) !== i);
  if (repetidos.length > 0) problemas.push(`valor bruto repetido: ${[...new Set(repetidos)].join(', ')}`);
  const doFio = new Set<string>(CLASSES_DE_FALHA);
  const faltam = [...doFio].filter((c) => !valores.includes(c));
  const sobram = valores.filter((v) => !doFio.has(v));
  if (faltam.length > 0) problemas.push(`falta(m) no enum: ${faltam.join(', ')}`);
  if (sobram.length > 0) problemas.push(`o enum tem o que o fio não tem: ${[...new Set(sobram)].join(', ')}`);
  return problemas;
}

/**
 * Os módulos que um fonte Swift importa — o primeiro componente, com qualquer atributo
 * (`@preconcurrency`, `@_exported`, `@testable`), modificador de acesso (`public
 * import`) ou tipo (`import struct X.Y`) na frente, e também depois de `;`.
 */
function importsSwift(src: string): string[] {
  const codigo = codigoSwift(src);
  const re = new RegExp(
    '(?:^|;)[ \\t]*(?:(?:@\\w+(?:\\([^)]*\\))?|public|package|internal|fileprivate|private)[ \\t]+)*' +
      // O nome pode vir entre crases (`import \`Foo\``): é o mesmo módulo.
      'import[ \\t]+(?:(?:typealias|struct|class|enum|protocol|let|var|func)[ \\t]+)?`?([A-Za-z_]\\w*)`?',
    'gm',
  );
  return [...codigo.matchAll(re)].map((m) => m[1]);
}

/** Os imports fora da lista permitida para aquele arquivo. */
function importsProibidosNaPonte(
  src: string,
  permitidos: ReadonlySet<string> = IMPORTS_PERMITIDOS_NA_PONTE.get(ENGINE_SWIFT)!,
): string[] {
  return importsSwift(src).filter((m) => !permitidos.has(m));
}

/**
 * A prova de que os dois detectores veem — pelas mesmas funções que as guardas chamam,
 * sobre fontes de mentira: o enum inteiro passa; o que perde um valor, ganha um, repete
 * um, esquece o valor explícito ou só existe num comentário reprova; o import proibido
 * é achado com atributo, modificador e depois de `;`, e não é achado em comentário nem
 * em string de várias linhas.
 */
function provarOsDetectoresDaPonte(): void {
  const enumDe = (casos: string) => `import Foundation\n\nenum ClasseDeFalha: String, Encodable {\n${casos}\n}\n`;
  const SETE = [
    'case indisponivel = "indisponivel"',
    'case capacidade = "capacidade"',
    'case janela = "janela"',
    'case guarda = "guarda"',
    'case recusaDoModelo = "recusa-do-modelo"',
    'case saidaInvalida = "saida-invalida"',
    'case transitoria = "transitoria"',
  ];
  const bom = enumDe(SETE.map((c) => `  ${c}`).join('\n'));
  assert.deepEqual(problemasDoEnumDeClasses(bom), [], 'o detector do enum reprovou o enum certo');
  // Vários casos numa linha, com método aninhado que tem `case` próprio: continua certo.
  const numaLinha = enumDe(
    '  case indisponivel = "indisponivel", capacidade = "capacidade", janela = "janela"\n' +
      '  case guarda = "guarda"; case recusaDoModelo = "recusa-do-modelo"\n' +
      '  case saidaInvalida = "saida-invalida"\n  case transitoria = "transitoria"\n' +
      '  var recua: Bool { switch self { case .indisponivel, .capacidade: return true\n default: return false } }',
  );
  assert.deepEqual(problemasDoEnumDeClasses(numaLinha), [], 'o detector do enum reprovou casos numa linha');

  const reprova: readonly (readonly [string, string, RegExp])[] = [
    ['perde um valor', enumDe(SETE.slice(1).join('\n')), /falta\(m\) no enum: indisponivel/],
    ['ganha um valor', enumDe([...SETE, 'case outra = "outra"'].join('\n')), /o fio não tem: outra/],
    ['grafia errada', enumDe(SETE.map((c) => c.replace('"recusa-do-modelo"', '"recusaDoModelo"')).join('\n')), /falta/],
    ['sem valor explícito', enumDe([...SETE.slice(0, 6), 'case transitoria'].join('\n')), /não tem valor bruto explícito/],
    ['repete', enumDe([...SETE, 'case outraJanela = "janela"'].join('\n')), /repetido: janela/],
    ['sem String', bom.replace(': String, Encodable', ': Encodable'), /não tem String como tipo bruto/],
    ['só no comentário', `// enum ClasseDeFalha: String { case a = "a" }\n/* enum ClasseDeFalha: String {} */\n`, /não declara/],
    ['duas vezes', `${bom}\n${bom}`, /2 vezes/],
  ];
  for (const [nome, fonte, esperado] of reprova) {
    const achado = problemasDoEnumDeClasses(fonte);
    assert.ok(achado.some((p) => esperado.test(p)), `o detector do enum não viu "${nome}": ${JSON.stringify(achado)}`);
  }

  const importa: readonly (readonly [string, string, readonly string[]])[] = [
    ['os dois permitidos', 'import Foundation\nimport FoundationModels\n', []],
    ['a cola do Expo', 'import Foundation\nimport ExpoModulesCore\n', ['ExpoModulesCore']],
    ['com atributo', '@preconcurrency import Combine\n', ['Combine']],
    ['com acesso', 'public import UIKit\n', ['UIKit']],
    ['de um tipo', 'import struct Network.NWPath\n', ['Network']],
    ['depois de ;', 'import Foundation; import UIKit\n', ['UIKit']],
    ['entre crases', 'import `Foundation`\nimport `ExpoModulesCore`\n', ['ExpoModulesCore']],
    ['no comentário', '// import ExpoModulesCore\n/* import UIKit /* aninhado */ import Combine */\nimport Foundation\n', []],
    ['na string de várias linhas', 'let s = """\nimport ExpoModulesCore\n"""\nimport Foundation\n', []],
  ];
  for (const [nome, fonte, esperado] of importa) {
    assert.deepEqual(importsProibidosNaPonte(fonte), esperado, `o detector de import leu errado "${nome}"`);
  }
}

check('BARREIRA — Engine.swift declara as sete classes do fio, com valor bruto explícito (AD-10 (3))', () => {
  provarOsDetectoresDaPonte();
  assert.ok(
    existsSync(ENGINE_SWIFT),
    `${relativoARaiz(ENGINE_SWIFT)} sumiu — a guarda (3) ficou sem alvo. A ponte do aparelho é esse arquivo ` +
      '(AD-3); se ele mudou de lugar, aponte ENGINE_SWIFT para o novo.',
  );
  const problemas = problemasDoEnumDeClasses(readFileSync(ENGINE_SWIFT, 'utf8'));
  assert.deepEqual(
    problemas,
    [],
    `o enum ClasseDeFalha de ${relativoARaiz(ENGINE_SWIFT)} não é CLASSES_DE_FALHA: ${problemas.join('; ')}.\n` +
      '  A ponte e o núcleo têm de falar as mesmas sete classes, com a grafia do fio (ia/fio.ts): uma classe ' +
      'que o núcleo não conhece vira transitoria não mapeada, e uma que a ponte não tem nunca é dita.',
  );
});

check('BARREIRA — os dois motores do aparelho importam só o que a lista de cada um permite (AD-10 (4))', () => {
  for (const [arquivo, permitidos] of IMPORTS_PERMITIDOS_NA_PONTE) {
    assert.ok(existsSync(arquivo), `${relativoARaiz(arquivo)} sumiu — a guarda (4) ficou sem alvo.`);
    const src = readFileSync(arquivo, 'utf8');
    // Não-vácua: o detector acha os dois imports que todo motor tem de ter.
    const todos = importsSwift(src);
    assert.ok(
      todos.includes('Foundation') && todos.includes('FoundationModels'),
      `o detector não achou os imports de ${relativoARaiz(arquivo)} (${JSON.stringify(todos)}) — ou o arquivo ` +
        'deixou de importá-los, ou a leitura quebrou e a guarda passaria sobre nada.',
    );
    const proibidos = importsProibidosNaPonte(src, permitidos);
    assert.deepEqual(
      proibidos,
      [],
      `${relativoARaiz(arquivo)} importa ${proibidos.join(', ')}. Ele importa só ` +
        `${[...permitidos].join(', ')} (AD-3): a cola do Expo mora em outro arquivo, e modelo ` +
        'de servidor não entra pela porta do aparelho — se vier, é nuvem:, com regime e lista do servidor.',
    );
  }

  // O `Engine.swift` **não** alcança a casca vendorizada: é ele que a CLI da bancada compila
  // sozinho no Mac (`scripts/bancada/aparelho/`), onde não há `.a` nenhum. Um import dele ali
  // quebraria a coluna do aparelho, e o sintoma seria um `swiftc` vermelho no Mac do dono.
  assert.ok(
    !importsSwift(readFileSync(ENGINE_SWIFT, 'utf8')).includes(CASCA_DO_COREAI),
    `${relativoARaiz(ENGINE_SWIFT)} importa ${CASCA_DO_COREAI}. O modelo do sistema não depende da biblioteca ` +
      'vendorizada do Core AI — e a CLI da bancada compila este arquivo sem ela.',
  );
  // E a casca é alcançada por **um** arquivo do app: se dois a importassem, a ponte deixaria
  // de ser o único ponto que nomeia o Core AI (o que a 5.8 promete manter).
  const alcancam = walkExt(join(ROOT, 'mobile'), /\.swift$/).filter((f) =>
    importsSwift(readFileSync(f, 'utf8')).includes(CASCA_DO_COREAI),
  );
  assert.deepEqual(
    alcancam.map((f) => relativoARaiz(f)),
    [relativoARaiz(MOTOR_COREAI_SWIFT)],
    `${CASCA_DO_COREAI} é importado em ${alcancam.length} arquivos de mobile/. Tem de ser um: o motor de peso ` +
      'aberto. Com zero, a vendorização saiu do caminho e o motor nunca escreveria; com dois, o Core AI deixou de ' +
      'entrar por uma porta só.',
  );

  // **E os módulos do pacote da Apple não entram em `mobile/` de jeito nenhum.** Vigiar só o
  // nome da casca deixaria passar um `import CoreAILanguageModels` direto — que compilaria se
  // alguém acrescentasse os `.swiftmodule` do grafo ao `SWIFT_INCLUDE_PATHS`, e desfaria o
  // isolamento que a casca existe para dar. Quem alcança o pacote é `scripts/coreai/`, fora
  // do app.
  const doPacoteEmMobile = walkExt(join(ROOT, 'mobile'), /\.swift$/).flatMap((f) =>
    importsSwift(readFileSync(f, 'utf8'))
      .filter((m) => MODULOS_DO_PACOTE_DA_APPLE.has(m))
      .map((m) => `${relativoARaiz(f)}: ${m}`),
  );
  assert.deepEqual(
    doPacoteEmMobile,
    [],
    `mobile/ importa o pacote da Apple direto (${doPacoteEmMobile.join(', ')}). Ele é alcançado **fora do app**, ` +
      `por scripts/coreai/OrbeCoreAI.swift, e chega aqui como ${CASCA_DO_COREAI} — um módulo e uma interface. ` +
      'Importar o pacote direto traria os vinte e tantos .swiftmodule do grafo de volta para dentro do pod.',
  );
});

/**
 * BARREIRA — o alvo mínimo do iOS é um número só, em três lugares (story 5.8).
 *
 * `27.0` é escrito no config plugin (que o grava no projeto gerado e no
 * `Podfile.properties.json`), no `s.platforms` do podspec e no `ALVO` do `montar.sh` (que é o
 * alvo do `.a` e da `.swiftinterface`). Nenhum compilador vê os três.
 *
 * Divergir é calado e caro: um podspec em 26 com biblioteca em 27 dá "compiled for a newer
 * version" no meio de um build de vinte minutos; um plugin em 26 com podspec em 27 dá um app
 * que instala em aparelho onde o `CoreAI.framework` não existe. Num repositório que já tem
 * barreira para hash, vocabulário e lista de `.swift`, três números soltos são a próxima
 * divergência.
 */
const PLUGIN_DO_ALVO = join(ROOT, 'mobile', 'plugins', 'withAlvoMinimoIOS27.js');
const MONTAR_DO_COREAI = join(ROOT, 'scripts', 'coreai', 'montar.sh');

/** Os três números, cada um lido do seu arquivo. `null` onde a leitura falhou. */
function alvosMinimos(plugin: string, podspec: string, montar: string): Record<string, string | null> {
  return {
    'mobile/plugins/withAlvoMinimoIOS27.js': /\bconst[ \t]+ALVO\s*=\s*'([\d.]+)'/.exec(semComentario(plugin))?.[1] ?? null,
    'mobile/modules/on-device-engine/ios/OnDeviceEngine.podspec':
      /\bs\.platforms\s*=\s*\{\s*:ios\s*=>\s*'([\d.]+)'/.exec(podspec)?.[1] ?? null,
    'scripts/coreai/montar.sh': /^ALVO="([\d.]+)"/m.exec(montar)?.[1] ?? null,
  };
}

check('BARREIRA — o alvo mínimo do iOS é o mesmo no plugin, no podspec e no montar.sh (story 5.8)', () => {
  // Não-vácua: os três leitores acham o número num fonte de mentira.
  assert.deepEqual(
    alvosMinimos("const ALVO = '9.9';", "s.platforms = { :ios => '9.9' }", 'ALVO="9.9"\n'),
    {
      'mobile/plugins/withAlvoMinimoIOS27.js': '9.9',
      'mobile/modules/on-device-engine/ios/OnDeviceEngine.podspec': '9.9',
      'scripts/coreai/montar.sh': '9.9',
    },
    'os leitores do alvo mínimo não leem — a barreira passaria sobre nada',
  );
  assert.equal(alvosMinimos('', '', '')['scripts/coreai/montar.sh'], null);

  for (const f of [PLUGIN_DO_ALVO, PODSPEC_DA_PONTE, MONTAR_DO_COREAI]) {
    assert.ok(existsSync(f), `${relativoARaiz(f)} sumiu — a barreira do alvo mínimo ficou sem um dos três lados.`);
  }
  const lidos = alvosMinimos(
    readFileSync(PLUGIN_DO_ALVO, 'utf8'),
    readFileSync(PODSPEC_DA_PONTE, 'utf8'),
    readFileSync(MONTAR_DO_COREAI, 'utf8'),
  );
  const semLeitura = Object.entries(lidos).filter(([, v]) => v === null).map(([k]) => k);
  assert.deepEqual(semLeitura, [], `não li o alvo mínimo em ${semLeitura.join(', ')} — a barreira ficaria cega ali.`);
  const distintos = [...new Set(Object.values(lidos))];
  assert.equal(
    distintos.length,
    1,
    `o alvo mínimo do iOS diverge: ${JSON.stringify(lidos)}.\n` +
      '  O pacote apple/coreai-models exige 27.0 e não tem um único @available: o número tem de ser o mesmo nos ' +
      'três, ou a biblioteca vendorizada, o pod e o app discordam sobre em que sistema o app roda.',
  );
});

/**
 * BARREIRA — o contrato entre as duas línguas (story 5.10).
 *
 * A ponte escreve `RespostaDoFio`/`FalhaDoFio` em Swift e o núcleo as lê em TypeScript
 * (`ia/aparelho.ts`); o núcleo escreve o `Pedido` e a ponte o lê em `PedidoDoFio`. Nenhum
 * compilador vê os dois lados. Um campo renomeado de um lado só não quebra build nenhum:
 * a resposta chega sem o campo, e o núcleo a trata como fora do contrato — uma coluna
 * inteira de `transitoria` sem ninguém entender por quê.
 *
 * Então a guarda lê os campos armazenados (`let`/`var`, sem `static`) de cada struct no
 * `Engine.swift` e exige a **igualdade** com as listas que `ia/aparelho.ts` exporta — as
 * mesmas que `traduzirDoAparelho` usa para ler (o compilador não a deixa ler outra chave).
 * No pedido, as chaves do `Pedido` mais a versão do descritor; e a lista de chaves que a
 * ponte aceita (a `static let chaves`, que recusa a desconhecida) tem de ser a mesma.
 *
 * Desde a 5.9 o contrato cobre também o **diagnóstico** (`DiagnosticoDoFio` ↔
 * `CHAVES_DO_DIAGNOSTICO`): um campo renomeado ali faria o seletor dizer "o aparelho não
 * respondeu como esperado" num iPhone com o modelo de pé.
 */
function camposDaStruct(src: string, nome: string): string[] | null {
  const codigo = codigoSwift(src);
  const achados = [...codigo.matchAll(new RegExp(`\\bstruct[ \\t]+${nome}\\b[^{]*\\{`, 'g'))];
  if (achados.length !== 1) return null;
  const [m] = achados;
  const corpo = corpoRaso(codigo, m.index! + m[0].length - 1);
  if (corpo === null) return null;
  const CAMPO = /(?:^|[;\n])[ \t]*(?:@\w+(?:\([^)]*\))?[ \t]+)*(?:(?:public|package|internal|fileprivate|private)(?:\(set\))?[ \t]+)*(?:let|var)[ \t]+`?([A-Za-z_]\w*)`?/g;
  return [...corpo.matchAll(CAMPO)].map((x) => x[1]);
}

/** As strings do `static let chaves` de uma struct — a lista que a ponte aceita no JSON. */
function chavesAceitas(src: string, nome: string): string[] | null {
  const codigo = codigoSwift(src);
  const achados = [...codigo.matchAll(new RegExp(`\\bstruct[ \\t]+${nome}\\b[^{]*\\{`, 'g'))];
  if (achados.length !== 1) return null;
  const [m] = achados;
  const corpo = corpoRaso(codigo, m.index! + m[0].length - 1);
  const lista = corpo === null ? null : /\bstatic[ \t]+let[ \t]+chaves\b[^=]*=[ \t]*\[([^\]]*)\]/.exec(corpo);
  return lista ? [...lista[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]) : null;
}

/** Os problemas do contrato num fonte Swift, contra as listas do núcleo. */
function problemasDoContrato(src: string): string[] {
  const ordenado = (xs: readonly string[]) => [...xs].sort();
  const esperado: readonly (readonly [string, readonly string[]])[] = [
    ['RespostaDoFio', CHAVES_DA_RESPOSTA],
    ['FalhaDoFio', CHAVES_DA_FALHA],
    ['TokensDoFio', CHAVES_DOS_TOKENS],
    ['PedidoDoFio', [...CHAVES_DO_PEDIDO, CHAVE_DA_VERSAO]],
    ['DiagnosticoDoFio', CHAVES_DO_DIAGNOSTICO],
  ];
  const problemas: string[] = [];
  for (const [struct, chaves] of esperado) {
    const campos = camposDaStruct(src, struct);
    if (campos === null) {
      problemas.push(`não achei \`struct ${struct}\` (uma vez só)`);
      continue;
    }
    const faltam = chaves.filter((k) => !campos.includes(k));
    const sobram = campos.filter((c) => !chaves.includes(c));
    if (faltam.length > 0) problemas.push(`${struct} não tem ${faltam.join(', ')}`);
    if (sobram.length > 0) problemas.push(`${struct} tem ${sobram.join(', ')}, que o núcleo não lê`);
  }
  const aceitas = chavesAceitas(src, 'PedidoDoFio');
  const campos = camposDaStruct(src, 'PedidoDoFio');
  if (aceitas === null) problemas.push('PedidoDoFio não declara `static let chaves` — a chave desconhecida não seria recusada');
  else if (campos !== null && JSON.stringify(ordenado(aceitas)) !== JSON.stringify(ordenado(campos))) {
    problemas.push(`PedidoDoFio aceita ${JSON.stringify(ordenado(aceitas))} e declara ${JSON.stringify(ordenado(campos))}`);
  }
  return problemas;
}

function provarODetectorDoContrato(): void {
  const diagnostico =
    'struct DiagnosticoDoFio: Encodable {\n' +
    ['disponivel', 'motivo', 'variante', 'janela', 'plataforma', 'buildDoSistema'].map((k) => `  let ${k}: String?`).join('\n') +
    '\n}';
  const fonte = (resposta: string, pedidoCampos: string, aceitas: string) =>
    [
      'struct TokensDoFio: Encodable { let entrada: Int\n let saida: Int }',
      `struct RespostaDoFio: Encodable {\n${resposta}\n  static let exemplo = 1\n  var calculado: Int { 0 }\n}`,
      'struct FalhaDoFio: Encodable {\n  let classe: ClasseDeFalha\n  let detalhe: String?\n  let naoMapeado: Bool?\n}',
      `struct PedidoDoFio: Decodable {\n${pedidoCampos}\n  static let chaves: Set<String> = [${aceitas}]\n` +
        '  struct SaidaDoFio: Decodable { let tipo: String\n let esquema: Int? }\n' +
        '  init(from d: any Decoder) throws { let c = 1; self.sistema = "" }\n}',
      diagnostico,
    ].join('\n');
  const resposta = ['texto', 'provedor', 'modelo', 'plataforma', 'buildDoSistema', 'tokens'].map((k) => `  let ${k}: String`).join('\n');
  const pedido = ['sistema', 'usuario', 'amostragem', 'guardrails', 'saida', 'versaoDoDescritor'].map((k) => `  let ${k}: String`).join('\n');
  const aceitas = '"sistema", "usuario", "amostragem", "guardrails", "saida", "versaoDoDescritor"';
  // `var calculado { … }` conta como campo — e reprova, de propósito: a resposta não tem campo que o núcleo não lê.
  const semCalculado = (x: string) => x.replace('  var calculado: Int { 0 }\n', '');
  assert.deepEqual(problemasDoContrato(semCalculado(fonte(resposta, pedido, aceitas))), [], 'o detector do contrato reprovou o contrato certo');
  const casos: readonly (readonly [string, string, RegExp])[] = [
    ['campo a menos', semCalculado(fonte(resposta.replace('  let tokens: String', ''), pedido, aceitas)), /RespostaDoFio não tem tokens/],
    ['campo renomeado', semCalculado(fonte(resposta.replace('buildDoSistema', 'build'), pedido, aceitas)), /não tem buildDoSistema.*|tem build,/],
    ['campo a mais no pedido', semCalculado(fonte(resposta, `${pedido}\n  let temperatura: Double`, aceitas)), /PedidoDoFio tem temperatura/],
    ['aceitas divergentes', semCalculado(fonte(resposta, pedido, '"sistema", "usuario"')), /PedidoDoFio aceita/],
    ['struct sumida', semCalculado(fonte(resposta, pedido, aceitas)).replace('struct FalhaDoFio', 'struct OutraCoisa'), /não achei `struct FalhaDoFio`/],
    ['campo calculado a mais', fonte(resposta, pedido, aceitas), /RespostaDoFio tem calculado/],
    [
      'diagnóstico renomeado',
      semCalculado(fonte(resposta, pedido, aceitas)).replace('let variante:', 'let modelo:'),
      /DiagnosticoDoFio não tem variante/,
    ],
    [
      'diagnóstico sumido',
      semCalculado(fonte(resposta, pedido, aceitas)).replace('struct DiagnosticoDoFio', 'struct Outro'),
      /não achei `struct DiagnosticoDoFio`/,
    ],
  ];
  for (const [nome, src, esperado] of casos) {
    const achado = problemasDoContrato(src);
    assert.ok(achado.some((p) => esperado.test(p)), `o detector do contrato não viu "${nome}": ${JSON.stringify(achado)}`);
  }
}

check('BARREIRA — os campos do fio no Engine.swift são as chaves que o núcleo lê e escreve (story 5.10)', () => {
  provarODetectorDoContrato();
  assert.ok(existsSync(ENGINE_SWIFT), `${relativoARaiz(ENGINE_SWIFT)} sumiu — a guarda do contrato ficou sem alvo.`);
  const problemas = problemasDoContrato(readFileSync(ENGINE_SWIFT, 'utf8'));
  assert.deepEqual(
    problemas,
    [],
    `o contrato entre ${relativoARaiz(ENGINE_SWIFT)} e ia/aparelho.ts divergiu: ${problemas.join('; ')}.\n` +
      '  Renomear um campo de um lado só não quebra build nenhum — a resposta chega sem ele, e a coluna ' +
      'inteira do aparelho sai transitoria. Mude os dois lados juntos.',
  );
});

/**
 * BARREIRA — os campos da compilação no `MotorCoreAI.swift` são as chaves que o núcleo lê.
 *
 * O gêmeo da guarda acima, para a terceira porta do peso aberto: a `CompilacaoDoFio` ↔
 * `CHAVES_DA_COMPILACAO`. Ela mora no `MotorCoreAI.swift`, e não no `Engine.swift`, porque a
 * pergunta é do Core AI — o modelo do sistema não se compila, a Apple já o especializou.
 *
 * O sintoma de divergir é pior que o do diagnóstico, e é por isso que ela existe: `compilado`
 * é o campo que decide se a tela oferece **Compilar**. Renomeá-lo de um lado só faria o leitor
 * cair no ramo do `motivo`, não achar nenhum, e devolver `ilegivel` — a tela diria "não dá para
 * saber" para todo modelo, num aparelho que sabe perfeitamente.
 */
function problemasDaCompilacao(src: string): string[] {
  const campos = camposDaStruct(src, 'CompilacaoDoFio');
  if (campos === null) return ['não achei `struct CompilacaoDoFio` (uma vez só)'];
  const problemas: string[] = [];
  const faltam = (CHAVES_DA_COMPILACAO as readonly string[]).filter((k) => !campos.includes(k));
  const sobram = campos.filter((c) => !(CHAVES_DA_COMPILACAO as readonly string[]).includes(c));
  if (faltam.length > 0) problemas.push(`CompilacaoDoFio não tem ${faltam.join(', ')}`);
  if (sobram.length > 0) problemas.push(`CompilacaoDoFio tem ${sobram.join(', ')}, que o núcleo não lê`);
  return problemas;
}

check('BARREIRA — os campos da compilação no MotorCoreAI.swift são as chaves que o núcleo lê', () => {
  // Não-vácua: o detector vê o certo, o campo a menos e o campo a mais.
  const certa = `struct CompilacaoDoFio: Encodable {\n${CHAVES_DA_COMPILACAO.map((k) => `  let ${k}: String?`).join('\n')}\n}`;
  assert.deepEqual(problemasDaCompilacao(certa), [], 'o detector da compilação reprovou o contrato certo');
  assert.ok(problemasDaCompilacao(certa.replace('  let compilado: String?\n', '')).some((p) => /não tem compilado/.test(p)));
  assert.ok(problemasDaCompilacao(certa.replace('let motivo:', 'let porque:')).some((p) => /tem porque, que o núcleo não lê/.test(p)));
  assert.ok(problemasDaCompilacao('struct Outra {}').some((p) => /não achei `struct CompilacaoDoFio`/.test(p)));

  assert.ok(existsSync(MOTOR_COREAI_SWIFT), `${relativoARaiz(MOTOR_COREAI_SWIFT)} sumiu — a guarda da compilação ficou sem alvo.`);
  const problemas = problemasDaCompilacao(readFileSync(MOTOR_COREAI_SWIFT, 'utf8'));
  assert.deepEqual(
    problemas,
    [],
    `o contrato da compilação entre ${relativoARaiz(MOTOR_COREAI_SWIFT)} e ia/aparelho.ts divergiu: ${problemas.join('; ')}.\n` +
      '  `compilado` é o campo que decide se a tela oferece Compilar: renomeado de um lado só, a linha vira ilegível ' +
      'e todo modelo passa a dizer "não dá para saber". Mude os dois lados juntos.',
  );
});

/**
 * BARREIRA — o vocabulário do diagnóstico cruza as duas línguas amarrado (story 5.9).
 *
 * O contrato de campos (acima) não vê **valores**. Três deles cruzam de Swift para TS sem
 * compilador nenhum no meio, e cada divergência seria calada:
 *
 *  - os **motivos** que `motivoDoDiagnostico` e `motivoSistemaAntigo` devolvem têm de ser
 *    `MOTIVOS_DO_APARELHO` — um motivo novo de um lado só vira "motivo desconhecido" na tela
 *    (o mapa em palavras do catálogo é exaustivo sobre a lista do núcleo);
 *  - o `Engine.modelo` (o nome genérico, sem variante) tem de ser `MODELO_SEM_VARIANTE` — é o
 *    que a assinatura omite; divergindo, a tela mostraria "(system-language-model)";
 *  - a `diagnosticoDeReserva` (a linha do codificador que falhou) tem de ser **ilegível** para
 *    `lerDiagnosticoDoAparelho` — lida como indisponível com motivo, ela diria "motivo
 *    desconhecido" em vez de "o aparelho não respondeu como esperado".
 *
 * Lidos no fonte pelo mesmo varredor de Swift, no molde do enum das classes.
 */

/** O corpo inteiro entre a chave que abre em `abre` e a que a fecha — com o aninhado. */
function corpoInteiro(codigo: string, abre: number): string | null {
  let profundidade = 0;
  for (let i = abre; i < codigo.length; i += 1) {
    const c = codigo[i];
    if (c === '"') {
      let j = i + 1;
      while (j < codigo.length && codigo[j] !== '"' && codigo[j] !== '\n') j += codigo[j] === '\\' ? 2 : 1;
      i = j;
      continue;
    }
    if (c === '{') profundidade += 1;
    else if (c === '}') {
      profundidade -= 1;
      if (profundidade === 0) return codigo.slice(abre + 1, i);
    }
  }
  return null;
}

/** O literal de uma linha de um `static let NOME = "…"`, como está no fonte (escapado). */
function literalDeStaticLet(codigo: string, nome: string): string | null {
  const achados = [...codigo.matchAll(new RegExp(`\\bstatic[ \\t]+let[ \\t]+${nome}\\b[^=\\n]*=[ \\t]*"((?:[^"\\\\\\n]|\\\\.)*)"`, 'g'))];
  return achados.length === 1 ? achados[0][1] : null;
}

/** O valor de um literal Swift de uma linha sem interpolação — as escapas são as do JSON. */
function valorDoLiteralSwift(literal: string): string | null {
  try {
    return JSON.parse(`"${literal}"`) as string;
  } catch {
    return null;
  }
}

function problemasDoVocabulario(src: string): string[] {
  const codigo = codigoSwift(src);
  const problemas: string[] = [];

  const funcoes = [...codigo.matchAll(/\bfunc[ \t]+motivoDoDiagnostico\b[^{]*\{/g)];
  const antigo = literalDeStaticLet(codigo, 'motivoSistemaAntigo');
  if (funcoes.length !== 1) problemas.push(`declara \`func motivoDoDiagnostico\` ${funcoes.length} vezes`);
  if (antigo === null) problemas.push('não declara `static let motivoSistemaAntigo = "…"` (uma vez)');
  if (funcoes.length === 1) {
    const f = funcoes[0];
    const corpo = corpoInteiro(codigo, f.index! + f[0].length - 1);
    const retornos = corpo === null ? [] : [...corpo.matchAll(/\breturn[ \t]+"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
    if (retornos.length === 0) problemas.push('motivoDoDiagnostico não devolve literal nenhum — o detector ficou cego');
    const doSwift = [...retornos, ...(antigo !== null ? [antigo] : [])];
    const repetidos = doSwift.filter((v, i) => doSwift.indexOf(v) !== i);
    if (repetidos.length > 0) problemas.push(`motivo repetido no Swift: ${[...new Set(repetidos)].join(', ')}`);
    const doNucleo = new Set<string>(MOTIVOS_DO_APARELHO);
    const faltam = [...doNucleo].filter((m) => !doSwift.includes(m));
    const sobram = doSwift.filter((m) => !doNucleo.has(m));
    if (faltam.length > 0) problemas.push(`o Swift não devolve o motivo ${faltam.join(', ')}, que o núcleo lista`);
    if (sobram.length > 0) problemas.push(`o Swift devolve o motivo ${[...new Set(sobram)].join(', ')}, que o núcleo não lista`);
  }

  const modelo = literalDeStaticLet(codigo, 'modelo');
  if (modelo === null) problemas.push('não declara `static let modelo = "…"` (uma vez)');
  else if (valorDoLiteralSwift(modelo) !== MODELO_SEM_VARIANTE) {
    problemas.push(`Engine.modelo é "${modelo}", e MODELO_SEM_VARIANTE é "${MODELO_SEM_VARIANTE}"`);
  }

  const reserva = literalDeStaticLet(codigo, 'diagnosticoDeReserva');
  const linha = reserva === null ? null : valorDoLiteralSwift(reserva);
  if (linha === null) problemas.push('não declara `static let diagnosticoDeReserva = "…"` legível (uma vez)');
  else if (lerDiagnosticoDoAparelho(linha).estado !== 'ilegivel') {
    problemas.push(`a diagnosticoDeReserva (${linha}) não é ilegível para o núcleo — o app a mostraria como um motivo`);
  }
  return problemas;
}

function provarODetectorDoVocabulario(): void {
  const fonte = (retornos: readonly string[], extra = '') =>
    'enum Engine {\n  static let modelo = "system-language-model"\n  static let motivoSistemaAntigo = "sistemaAntigo"\n' +
    '  static let diagnosticoDeReserva = "{\\"erro\\":\\"x\\"}"\n' +
    `${extra}  static func motivoDoDiagnostico(_ m: R) -> String {\n    switch m {\n` +
    retornos.map((r, i) => `    case .c${i}: return "${r}"\n`).join('') +
    '    @unknown default: return nomeCru(m)\n    }\n  }\n}\n';
  const TRES = ['deviceNotEligible', 'appleIntelligenceNotEnabled', 'modelNotReady'];
  assert.deepEqual(problemasDoVocabulario(fonte(TRES)), [], 'o detector do vocabulário reprovou o vocabulário certo');
  const casos: readonly (readonly [string, string, RegExp])[] = [
    ['motivo a menos', fonte(TRES.slice(1)), /não devolve o motivo deviceNotEligible/],
    ['motivo a mais', fonte([...TRES, 'novoMotivo']), /devolve o motivo novoMotivo, que o núcleo não lista/],
    ['antigo renomeado', fonte(TRES).replace('"sistemaAntigo"', '"antigo"'), /não devolve o motivo sistemaAntigo/],
    ['modelo divergente', fonte(TRES).replace('"system-language-model"', '"sistema"'), /Engine\.modelo é "sistema"/],
    [
      'reserva legível como motivo',
      fonte(TRES).replace('"{\\"erro\\":\\"x\\"}"', '"{\\"disponivel\\":false,\\"motivo\\":\\"x\\"}"'),
      /não é ilegível/,
    ],
    ['só no comentário', `// static func motivoDoDiagnostico() { return "x" }\n`, /0 vezes/],
  ];
  for (const [nome, src, esperado] of casos) {
    const achado = problemasDoVocabulario(src);
    assert.ok(achado.some((p) => esperado.test(p)), `o detector do vocabulário não viu "${nome}": ${JSON.stringify(achado)}`);
  }
}

check('BARREIRA — os motivos, o modelo genérico e a linha de reserva do diagnóstico são os do núcleo (story 5.9)', () => {
  provarODetectorDoVocabulario();
  assert.ok(existsSync(ENGINE_SWIFT), `${relativoARaiz(ENGINE_SWIFT)} sumiu — a guarda do vocabulário ficou sem alvo.`);
  const problemas = problemasDoVocabulario(readFileSync(ENGINE_SWIFT, 'utf8'));
  assert.deepEqual(
    problemas,
    [],
    `o vocabulário do diagnóstico divergiu entre ${relativoARaiz(ENGINE_SWIFT)} e ia/aparelho.ts: ${problemas.join('; ')}.\n` +
      '  Os motivos, o nome genérico e a linha de reserva cruzam as duas línguas sem compilador: mude os dois lados juntos.',
  );
});

/**
 * BARREIRA — os motivos do peso aberto cruzam as duas línguas amarrados (story 5.8).
 *
 * O gêmeo da guarda acima, para o outro motor — e com uma diferença que é de propósito: **o
 * núcleo não participa**. Ele não sabe que peso aberto existe (a gramática
 * `aparelho:<provedor>/<pesos>` de `ia/fio.ts` já cabia sem mudança nenhuma), então o
 * vocabulário vai direto do `MotorCoreAI.swift` para o catálogo do app, que é quem o põe em
 * palavras na tela do dono.
 *
 * Sem esta guarda, um motivo novo no Swift — ou um renomeado — viraria "indisponível por um
 * motivo que esta versão não conhece" no seletor, calado: a mentira exata que o catálogo
 * existe para não contar.
 */
const CATALOGO_DO_APP = join(ROOT, 'mobile', 'src', 'lib', 'motores', 'catalogo.ts');
const MAPA_DOS_MOTIVOS_DO_COREAI = 'MOTIVO_DO_COREAI_EM_PALAVRAS';

/** Todo `static let motivo… = "…"` de um fonte Swift: nome do símbolo → literal. */
function motivosDeclarados(codigo: string): Map<string, string> {
  const achados = new Map<string, string>();
  for (const m of codigo.matchAll(/\bstatic[ \t]+let[ \t]+(motivo\w*)\b[^=\n]*=[ \t]*"((?:[^"\\\n]|\\.)*)"/g)) {
    achados.set(m[1], valorDoLiteralSwift(m[2]) ?? m[2]);
  }
  return achados;
}

/** Os símbolos que a função `motivos()` devolve — a lista que o app diz conhecer. */
function motivosDevolvidos(codigo: string): string[] | null {
  const cabecalho = [...codigo.matchAll(/\bstatic[ \t]+func[ \t]+motivos\s*\([^)]*\)[^{]*\{/g)];
  if (cabecalho.length !== 1) return null;
  const corpo = corpoInteiro(codigo, cabecalho[0].index! + cabecalho[0][0].length - 1);
  if (corpo === null) return null;
  const lista = /\[([^\]]*)\]/.exec(corpo);
  if (!lista) return null;
  return lista[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '');
}

/** As chaves de um `Record` literal exportado de um fonte TS. `null` se não achar o bloco. */
function chavesDoMapa(src: string, nome: string): string[] | null {
  const bloco = new RegExp(`\\bexport[ \\t]+const[ \\t]+${nome}\\b[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`).exec(semComentario(src));
  if (!bloco) return null;
  return [...bloco[1].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);
}

function problemasDosMotivosDoCoreAI(swift: string, catalogo: string): string[] {
  const problemas: string[] = [];
  const codigo = codigoSwift(swift);
  const declarados = motivosDeclarados(codigo);
  const devolvidos = motivosDevolvidos(codigo);
  if (declarados.size === 0) problemas.push('o Swift não declara nenhum `static let motivo… = "…"`');
  if (devolvidos === null) {
    problemas.push('não achei `static func motivos()` devolvendo uma lista (uma vez)');
  } else {
    // Um motivo declarado e não devolvido é um motivo que o app nunca vai reconhecer.
    const fora = [...declarados.keys()].filter((s) => !devolvidos.includes(s));
    const fantasma = devolvidos.filter((s) => !declarados.has(s));
    if (fora.length > 0) problemas.push(`declarado e não devolvido por motivos(): ${fora.join(', ')}`);
    if (fantasma.length > 0) problemas.push(`motivos() devolve o que não é um static let: ${fantasma.join(', ')}`);
  }
  const doSwift = [...declarados.values()];
  const repetidos = doSwift.filter((v, i) => doSwift.indexOf(v) !== i);
  if (repetidos.length > 0) problemas.push(`literal repetido no Swift: ${[...new Set(repetidos)].join(', ')}`);

  const doApp = chavesDoMapa(catalogo, MAPA_DOS_MOTIVOS_DO_COREAI);
  if (doApp === null) {
    problemas.push(`não achei \`export const ${MAPA_DOS_MOTIVOS_DO_COREAI} = { … };\` no catálogo do app`);
    return problemas;
  }
  const faltam = doSwift.filter((m) => !doApp.includes(m));
  const sobram = doApp.filter((m) => !doSwift.includes(m));
  if (faltam.length > 0) problemas.push(`o Swift diz o motivo ${faltam.join(', ')}, e o app não o põe em palavras`);
  if (sobram.length > 0) problemas.push(`o app põe em palavras ${sobram.join(', ')}, que o Swift nunca diz`);
  return problemas;
}

function provarODetectorDosMotivosDoCoreAI(): void {
  const swift = (extra = '', devolve = '[motivoSemBiblioteca, motivoSimulador]') =>
    'enum MotorCoreAI {\n  static let motivoSemBiblioteca = "semBiblioteca"\n' +
    `  static let motivoSimulador = "simulador"\n${extra}` +
    `  static func motivos() -> [String] {\n    ${devolve}\n  }\n}\n`;
  const app = (chaves: readonly string[]) =>
    `export const ${MAPA_DOS_MOTIVOS_DO_COREAI}: Readonly<Record<string, string>> = {\n` +
    chaves.map((k) => `  ${k}: 'x',`).join('\n') +
    '\n};\n';
  const BONS = ['semBiblioteca', 'simulador'];
  assert.deepEqual(problemasDosMotivosDoCoreAI(swift(), app(BONS)), [], 'o detector dos motivos reprovou o par certo');
  const casos: readonly (readonly [string, string[], RegExp])[] = [
    ['motivo só no Swift', problemasDosMotivosDoCoreAI(swift(), app(['semBiblioteca'])), /o Swift diz o motivo simulador/],
    ['motivo só no app', problemasDosMotivosDoCoreAI(swift(), app([...BONS, 'inventado'])), /o app põe em palavras inventado/],
    [
      'declarado e não devolvido',
      problemasDosMotivosDoCoreAI(swift('  static let motivoOrfao = "orfao"\n'), app([...BONS, 'orfao'])),
      /declarado e não devolvido/,
    ],
    ['motivos() sumiu', problemasDosMotivosDoCoreAI(swift().replace('func motivos', 'func outra'), app(BONS)), /não achei `static func motivos/],
    ['só no comentário', problemasDosMotivosDoCoreAI('// static let motivoX = "x"\n', app(BONS)), /não declara nenhum/],
    ['o mapa do app sumiu', problemasDosMotivosDoCoreAI(swift(), 'export const OUTRA = {};'), /não achei/],
    ['literal repetido', problemasDosMotivosDoCoreAI(swift().replace('"simulador"', '"semBiblioteca"'), app(BONS)), /literal repetido/],
  ];
  for (const [nome, achado, esperado] of casos) {
    assert.ok(achado.some((p) => esperado.test(p)), `o detector dos motivos não viu "${nome}": ${JSON.stringify(achado)}`);
  }
}

check('BARREIRA — os motivos do peso aberto são os que o app põe em palavras (story 5.8)', () => {
  provarODetectorDosMotivosDoCoreAI();
  assert.ok(existsSync(MOTOR_COREAI_SWIFT), `${relativoARaiz(MOTOR_COREAI_SWIFT)} sumiu — a guarda ficou sem alvo.`);
  assert.ok(existsSync(CATALOGO_DO_APP), `${relativoARaiz(CATALOGO_DO_APP)} sumiu — a guarda ficou sem o outro lado.`);
  const problemas = problemasDosMotivosDoCoreAI(
    readFileSync(MOTOR_COREAI_SWIFT, 'utf8'),
    readFileSync(CATALOGO_DO_APP, 'utf8'),
  );
  assert.deepEqual(
    problemas,
    [],
    `o vocabulário do peso aberto divergiu entre ${relativoARaiz(MOTOR_COREAI_SWIFT)} e ${relativoARaiz(CATALOGO_DO_APP)}: ` +
      `${problemas.join('; ')}.\n` +
      '  Eles cruzam as duas línguas sem compilador no meio: um motivo novo de um lado só vira "indisponível por um ' +
      'motivo que esta versão não conhece" no seletor, calado. Mude os dois lados juntos.',
  );
});

/**
 * BARREIRA — o módulo tem três `.swift`, e modelo de servidor em nenhum (story 5.9, AD-3, ADR 0047).
 *
 * O pod `OnDeviceEngine` tem **três** arquivos em `ios/`, numa lista fechada: o
 * `Engine.swift` (o modelo do sistema, que as guardas (3), (4), a do contrato e a do
 * vocabulário cobrem), o `MotorCoreAI.swift` (o peso aberto, que a 5.8 trouxe) e a cola
 * `OnDeviceEngineModule.swift`. Arquivo `.swift` novo reprova — é decisão de arquitetura, e
 * muda esta lista junto, com a razão.
 *
 * **A lista cresceu de dois para três em 21/09/2026, e a razão é esta:** o Core AI carrega
 * pesos de uma pasta e tem uma falha que o modelo do sistema não tem (a **carga**), com
 * classificação própria. Enfiá-la no `Engine.swift` misturaria os dois motores num arquivo
 * que a CLI da bancada compila sozinho no Mac — e a CLI passaria a exigir uma biblioteca
 * vendorizada que ela não tem. Separado, o `Engine` continua puro e a bancada continua
 * medindo; o `MotorCoreAI` compila nos dois modos (com e sem `ORBE_COREAI`), e é o modo
 * "sem" que torna a tabela dele testável no Mac.
 *
 * E `PrivateCloudComputeLanguageModel` não aparece em **lugar nenhum** do Swift do módulo
 * nem da bancada. Ele passou por aqui como experimento descartável (19/09/2026, emenda da ADR
 * 0047) e saiu no mesmo dia, com a causa provada no iPhone: sem o entitlement gerenciado
 * `com.apple.developer.private-cloud-compute`, o framework **derruba o processo**
 * (`Fatal error: Missing entitlement`) em vez de devolver erro — tocar o botão fechava o app,
 * e nada em Swift captura isso. Se um dia o PCC voltar, é `nuvem:` (AD-3, AD-9), nunca a ponte.
 */
const DIR_DA_PONTE = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios');
const COLA_SWIFT = join(DIR_DA_PONTE, 'OnDeviceEngineModule.swift');
const SWIFT_DO_MODULO = ['Engine.swift', 'MotorCoreAI.swift', 'OnDeviceEngineModule.swift'].map((f) =>
  relativoARaiz(join(DIR_DA_PONTE, f)),
);
const INJECAO_DA_PONTE = join(ROOT, 'mobile', 'src', 'lib', 'motores', 'index.ts');
const NOME_DA_PONTE = 'OnDeviceEngine';

/**
 * Os problemas do Swift: a lista fechada de arquivos do módulo (`doModulo`) e o modelo de
 * servidor em arquivo nenhum (`doModulo` e `outros`, o Swift da bancada).
 */
function problemasDoSwiftDoModulo(doModulo: ReadonlyMap<string, string>, outros: ReadonlyMap<string, string> = new Map()): string[] {
  const problemas: string[] = [];
  const presentes = [...doModulo.keys()].sort();
  const faltam = SWIFT_DO_MODULO.filter((f) => !doModulo.has(f));
  const sobram = presentes.filter((f) => !SWIFT_DO_MODULO.includes(f));
  if (faltam.length > 0) problemas.push(`faltam ${faltam.join(', ')}`);
  if (sobram.length > 0) problemas.push(`sobram ${sobram.join(', ')} — a lista de .swift do módulo é fechada`);
  for (const [f, src] of [...doModulo, ...outros]) {
    if (/\bPrivateCloudComputeLanguageModel\b/.test(codigoSwift(src))) {
      problemas.push(`${f} nomeia PrivateCloudComputeLanguageModel — modelo de servidor não entra na ponte`);
    }
  }
  return problemas;
}

function provarODetectorDoModulo(): void {
  const [engine, coreai, cola] = SWIFT_DO_MODULO;
  const modulo = (extra: Record<string, string> = {}) =>
    new Map<string, string>(
      Object.entries({
        [engine]: 'import Foundation\nenum Engine {}',
        [coreai]: 'import Foundation\nenum MotorCoreAI {}',
        [cola]: 'import ExpoModulesCore',
        ...extra,
      }),
    );
  assert.deepEqual(problemasDoSwiftDoModulo(modulo()), [], 'o detector do módulo reprovou o módulo certo');
  const casos: readonly (readonly [string, readonly string[], RegExp])[] = [
    ['arquivo novo', problemasDoSwiftDoModulo(modulo({ 'mobile/modules/on-device-engine/ios/ExperimentoDoPCC.swift': '' })), /sobram .*ExperimentoDoPCC\.swift/],
    ['arquivo a menos', problemasDoSwiftDoModulo(new Map([[engine, '']])), /faltam .*OnDeviceEngineModule\.swift/],
    ['o motor de peso aberto a menos', problemasDoSwiftDoModulo(new Map([[engine, ''], [cola, '']])), /faltam .*MotorCoreAI\.swift/],
    ['PCC no Engine', problemasDoSwiftDoModulo(modulo({ [engine]: 'let m = PrivateCloudComputeLanguageModel()' })), /Engine\.swift nomeia PrivateCloudComputeLanguageModel/],
    ['PCC na cola', problemasDoSwiftDoModulo(modulo({ [cola]: 'let m = PrivateCloudComputeLanguageModel()' })), /OnDeviceEngineModule\.swift nomeia/],
    [
      'PCC na bancada',
      problemasDoSwiftDoModulo(modulo(), new Map([['scripts/bancada/aparelho/testes.swift', 'let m = PrivateCloudComputeLanguageModel()']])),
      /testes\.swift nomeia/,
    ],
  ];
  for (const [nome, achado, esperado] of casos) {
    assert.ok(achado.some((p) => esperado.test(p)), `o detector do módulo não viu "${nome}": ${JSON.stringify(achado)}`);
  }
  // Comentário não conta.
  assert.deepEqual(problemasDoSwiftDoModulo(modulo({ [engine]: '// PrivateCloudComputeLanguageModel saiu em 19/09' })), [], 'o detector do módulo contou um comentário');
}

check('BARREIRA — o módulo da ponte tem três .swift, e PrivateCloudComputeLanguageModel em nenhum lugar (story 5.9, 5.8)', () => {
  provarODetectorDoModulo();
  const doModulo = new Map(walkExt(join(ROOT, 'mobile', 'modules'), /\.swift$/).map((f) => [relativoARaiz(f), readFileSync(f, 'utf8')] as const));
  const daBancada = new Map(walkExt(join(ROOT, 'scripts', 'bancada', 'aparelho'), /\.swift$/).map((f) => [relativoARaiz(f), readFileSync(f, 'utf8')] as const));
  assert.ok(doModulo.size > 0 && daBancada.size > 0, 'não achei o Swift do módulo ou da bancada — a barreira ficou sem alvo');
  const problemas = problemasDoSwiftDoModulo(doModulo, daBancada);
  assert.deepEqual(
    problemas,
    [],
    `o Swift da ponte saiu da lista: ${problemas.join('; ')}.\n` +
      '  O pod tem três arquivos — Engine, MotorCoreAI e cola —, e modelo de servidor não entra nele: sem o entitlement gerenciado, ' +
      'o PCC derruba o app no iPhone (19/09). Se ele voltar, é nuvem:, com regime e lista do servidor.',
  );
});

/**
 * BARREIRA — a cola do Expo só repassa, com os nomes que o app chama (story 5.9, AD-3, ADR 0047).
 *
 * **Uma cola que pensasse seria uma segunda tabela** — fora do teste e fora da CLI, que
 * compila só o `Engine.swift`: a bancada mediria uma coisa e o iPhone faria outra. Então ela é
 * lida aqui, pelo mesmo varredor de Swift, e reprova se tiver:
 *
 *  - import além de `ExpoModulesCore`;
 *  - outro `Name(…)` que não um só, `NOME_DA_PONTE` — o que o ponto de injeção carrega e a
 *    guarda (1) reconhece;
 *  - funções com nomes que não são **exatamente** os de `FUNCOES_DA_PONTE`
 *    (`mobile/src/lib/motores/index.ts`), ou peça do DSL além de `Name` e `AsyncFunction`;
 *  - `catch`, `try`, `do { }`: a ponte nunca lança, e quem converte exceção em falha é o núcleo;
 *  - decisão (`if`, `guard`, `switch`, laço, `??`, `&&`, `||`, ternário) — o `for:` de um
 *    rótulo de argumento não é laço;
 *  - literal de classe de falha — ou a palavra `classe` num literal;
 *  - string de várias linhas, onde tudo isso se esconderia.
 */

/** O conteúdo de cada string de uma linha num código Swift já sem comentário. */
function literaisSwift(codigo: string): string[] {
  return [...codigo.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]);
}

/**
 * Os **argumentos** de cada função da ponte, como o app os declara em `PARAMETROS_DA_PONTE`.
 * `null` se o bloco não for achado.
 */
function parametrosDoApp(src: string): Map<string, string[]> | null {
  const bloco = /\bexport[ \t]+const[ \t]+PARAMETROS_DA_PONTE\s*=\s*\{([\s\S]*?)\n\}\s*as const/.exec(semComentario(src));
  if (!bloco) return null;
  const mapa = new Map<string, string[]>();
  for (const m of bloco[1].matchAll(/^\s*(\w+)\s*:\s*\[([^\]]*)\]/gm)) {
    mapa.set(
      m[1],
      m[2]
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x !== '')
        .map((x) => /^'(\w+)'$/.exec(x)?.[1] ?? `?${x}`),
    );
  }
  return mapa;
}

/** Os nomes dos argumentos de cada `AsyncFunction` da cola, na ordem em que o Swift os declara. */
function parametrosDaCola(codigo: string): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const m of codigo.matchAll(/\bAsyncFunction\s*\(\s*"((?:[^"\\\n]|\\.)*)"\s*\)\s*\{\s*\(([^)]*)\)/g)) {
    mapa.set(
      m[1],
      m[2]
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x !== '')
        // `pesos: String` → `pesos`; um `_ pesos: String` leva o rótulo interno.
        .map((x) => /(?:^|\s)([A-Za-z_]\w*)\s*:/.exec(x)?.[1] ?? `?${x}`),
    );
  }
  return mapa;
}

/** Os nomes das funções da ponte como o app os chama: `FUNCOES_DA_PONTE`, lido do fonte. `null` se não achar. */
function funcoesDoApp(src: string): string[] | null {
  const lista = /\bexport[ \t]+const[ \t]+FUNCOES_DA_PONTE\s*=\s*\[([^\]]*)\]/.exec(semComentario(src));
  if (!lista) return null;
  return lista[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
    .map((x) => /^'(\w+)'$/.exec(x)?.[1] ?? `?${x}`);
}

function problemasDaCola(
  src: string,
  funcoesDoAppLidas: readonly string[],
  parametrosDoAppLidos: ReadonlyMap<string, readonly string[]>,
): string[] {
  const codigo = codigoSwift(src);
  const problemas: string[] = [];
  const imports = importsSwift(src);
  if (!imports.includes('ExpoModulesCore')) problemas.push('não importa ExpoModulesCore');
  const fora = imports.filter((m) => m !== 'ExpoModulesCore');
  if (fora.length > 0) problemas.push(`importa ${fora.join(', ')} — a cola importa só ExpoModulesCore`);

  const nomes = [...codigo.matchAll(/\bName\s*\(\s*"((?:[^"\\\n]|\\.)*)"\s*\)/g)].map((m) => m[1]);
  if (nomes.length !== 1 || nomes[0] !== NOME_DA_PONTE) {
    problemas.push(`declara Name ${JSON.stringify(nomes)} — tem de ser um só, "${NOME_DA_PONTE}"`);
  }

  const outrasPecas = [
    ...codigo.matchAll(/\b(Function|StaticFunction|StaticAsyncFunction|Property|Constant|Events|View|Prop|Class|OnCreate|OnDestroy|OnStartObserving|OnStopObserving)\s*\(/g),
  ].map((m) => m[1]);
  if (outrasPecas.length > 0) problemas.push(`declara ${[...new Set(outrasPecas)].join(', ')} — a cola só tem Name e AsyncFunction`);

  const daCola = [...codigo.matchAll(/\bAsyncFunction\s*\(\s*"((?:[^"\\\n]|\\.)*)"\s*\)/g)].map((m) => m[1]);
  const repetidas = daCola.filter((n, i) => daCola.indexOf(n) !== i);
  if (repetidas.length > 0) problemas.push(`declara a função ${[...new Set(repetidas)].join(', ')} mais de uma vez`);
  const faltam = funcoesDoAppLidas.filter((n) => !daCola.includes(n));
  const sobram = daCola.filter((n) => !funcoesDoAppLidas.includes(n));
  if (faltam.length > 0) problemas.push(`não declara ${faltam.join(', ')}, que o app chama (FUNCOES_DA_PONTE)`);
  if (sobram.length > 0) problemas.push(`declara ${[...new Set(sobram)].join(', ')}, que o app não chama (FUNCOES_DA_PONTE)`);

  // **Os argumentos, na ordem.** Comparar só os nomes das funções bastava enquanto todas
  // tinham zero ou um argumento. Com `responderComPesos(pesos, pedido)`, inverter os dois no
  // closure compila, passa por tudo, e no aparelho toda geração volta como `capacidade`.
  const daColaParams = parametrosDaCola(codigo);
  for (const nome of daCola) {
    const esperado = parametrosDoAppLidos.get(nome);
    const obtido = daColaParams.get(nome);
    if (esperado === undefined) continue; // já reportado como "que o app não chama"
    if (obtido === undefined) {
      problemas.push(`não consegui ler os argumentos de ${nome} — o detector ficaria cego nessa função`);
      continue;
    }
    if (JSON.stringify(obtido) !== JSON.stringify([...esperado])) {
      problemas.push(
        `${nome} recebe ${JSON.stringify(obtido)} e o app manda ${JSON.stringify([...esperado])} — ordem ou nome divergiram`,
      );
    }
  }
  const semParametro = daCola.filter((n) => funcoesDoAppLidas.includes(n) && !parametrosDoAppLidos.has(n));
  if (semParametro.length > 0) {
    problemas.push(`o app não declara os argumentos de ${semParametro.join(', ')} em PARAMETROS_DA_PONTE`);
  }

  if (/"""/.test(src.replace(/\/\/.*$/gm, ''))) problemas.push('tem string de várias linhas');
  const semTexto = codigo.replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  const PROIBIDO: readonly (readonly [RegExp, string])[] = [
    [/\bcatch\b/, 'catch'],
    [/\btry\b/, 'try'],
    [/\bdo\s*\{/, 'do { }'],
    // Seguido de `:` é rótulo de argumento (`f(for: x)`), não laço nem decisão.
    [/\b(?:if|guard|switch|while|for|repeat)\b(?!\s*:)/, 'decisão (if/guard/switch/laço)'],
    [/\?\?/, 'decisão (??)'],
    [/&&|\|\|/, 'decisão (&& / ||)'],
    // O ternário do Swift exige espaço dos dois lados do `?`; o `?` do opcional, não.
    [/\s\?\s/, 'decisão (ternário)'],
  ];
  for (const [re, o] of PROIBIDO) if (re.test(semTexto)) problemas.push(`tem ${o}`);

  const escapar = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const DE_CLASSE = new RegExp(`(?:^|[^\\w-])(?:classe|${CLASSES_DE_FALHA.map(escapar).join('|')})(?![\\w-])`);
  for (const literal of literaisSwift(codigo)) {
    if (DE_CLASSE.test(literal)) problemas.push(`tem literal de classe: "${literal}"`);
  }
  return problemas;
}

/**
 * A prova de que o detector da cola vê — pelas mesmas funções que a guarda chama, sobre
 * fontes de mentira: a cola que só repassa passa; cada pecado reprova com o seu nome, e o
 * que só aparece em comentário, ou o `for:` de rótulo, não conta.
 */
function provarODetectorDaCola(): void {
  const APP = ['responder', 'diagnostico', 'responderComPesos'];
  const PARAMS = new Map<string, readonly string[]>([
    ['responder', ['pedido']],
    ['diagnostico', []],
    ['responderComPesos', ['pesos', 'pedido']],
  ]);
  const cola = (corpo: string, cabeca = 'import ExpoModulesCore') =>
    `${cabeca}\n\n// catch, if, "transitoria" — só no comentário\npublic class M: Module {\n  public func definition() -> ModuleDefinition {\n` +
    `    Name("${NOME_DA_PONTE}")\n${corpo}\n  }\n}\n`;
  const repassa =
    '    AsyncFunction("responder") { (pedido: String) async -> String in\n      await Engine.responder(pedido)\n    }\n' +
    '    AsyncFunction("diagnostico") { () -> String in\n      Engine.diagnostico()\n    }\n' +
    '    AsyncFunction("responderComPesos") { (pesos: String, pedido: String) async -> String in\n' +
    '      await MotorCoreAI.responder(pesos: pesos, pedido: pedido)\n    }';
  const com = (trecho: string) => cola(`${repassa}\n${trecho}`);
  const funcaoCom = (corpo: string) => cola(repassa.replace('Engine.diagnostico()', corpo));
  assert.deepEqual(problemasDaCola(cola(repassa), APP, PARAMS), [], 'o detector da cola reprovou a cola que só repassa');
  // `for:` de rótulo e o `?` do opcional não são decisão.
  assert.deepEqual(problemasDaCola(funcaoCom('Engine.eco(for: x?.count)'), APP, PARAMS), [], 'o detector da cola viu decisão num rótulo `for:` ou num opcional');

  // **A inversão dos dois argumentos** — o caso que motivou a lista de parâmetros.
  const invertida = cola(repassa.replace('(pesos: String, pedido: String)', '(pedido: String, pesos: String)'));
  assert.ok(
    problemasDaCola(invertida, APP, PARAMS).some((p) => /responderComPesos recebe .*ordem ou nome divergiram/.test(p)),
    'o detector da cola não viu os argumentos invertidos',
  );
  const renomeada = cola(repassa.replace('(pesos: String, pedido: String)', '(nome: String, pedido: String)'));
  assert.ok(
    problemasDaCola(renomeada, APP, PARAMS).some((p) => /responderComPesos recebe/.test(p)),
    'o detector da cola não viu um argumento renomeado',
  );
  const aMenos = cola(repassa.replace('(pesos: String, pedido: String)', '(pesos: String)'));
  assert.ok(
    problemasDaCola(aMenos, APP, PARAMS).some((p) => /responderComPesos recebe/.test(p)),
    'o detector da cola não viu um argumento a menos',
  );
  assert.ok(
    problemasDaCola(cola(repassa), APP, new Map([...PARAMS].filter(([k]) => k !== 'responderComPesos'))).some((p) =>
      /não declara os argumentos de responderComPesos/.test(p),
    ),
    'o detector da cola não viu a função sem argumentos declarados no app',
  );
  assert.deepEqual(parametrosDoApp("export const PARAMETROS_DA_PONTE = {\n  a: ['x', 'y'],\n  b: [],\n} as const"), new Map([['a', ['x', 'y']], ['b', []]]));
  assert.equal(parametrosDoApp('export const OUTRA = {} as const'), null);
  const casos: readonly (readonly [string, string, RegExp])[] = [
    ['import a mais', cola(repassa, 'import ExpoModulesCore\nimport FoundationModels'), /importa FoundationModels/],
    ['sem ExpoModulesCore', cola(repassa, 'import Foundation'), /não importa ExpoModulesCore/],
    ['outro nome', cola(repassa).replace(`Name("${NOME_DA_PONTE}")`, 'Name("Ponte")'), /tem de ser um só/],
    ['dois nomes', com('    Name("Outra")'), /tem de ser um só/],
    ['função que o app não chama', com('    AsyncFunction("experimentoDoPCC") { () async -> String in\n      Engine.diagnostico()\n    }'), /declara experimentoDoPCC, que o app não chama/],
    ['função renomeada', cola(repassa.replace('"diagnostico"', '"diagnosticar"')), /não declara diagnostico/],
    ['função repetida', com('    AsyncFunction("responder") { (p: String) async -> String in\n      await Engine.responder(p)\n    }'), /mais de uma vez/],
    ['peça do DSL a mais', com('    Function("x") { () -> String in\n      Engine.diagnostico()\n    }'), /declara Function/],
    ['catch', funcaoCom('do { return try x() } catch { return "" }'), /tem catch/],
    ['if', funcaoCom('if a { return b }'), /decisão \(if/],
    ['switch', funcaoCom('switch a { default: return b }'), /decisão \(if/],
    ['for de laço', funcaoCom('for x in y { f(x) }'), /decisão \(if/],
    ['??', funcaoCom('a ?? b'), /decisão \(\?\?\)/],
    ['&&', funcaoCom('f(a && b)'), /decisão \(&& \/ \|\|\)/],
    ['||', funcaoCom('f(a || b)'), /decisão \(&& \/ \|\|\)/],
    ['ternário', funcaoCom('a ? b : c'), /ternário/],
    ['literal de classe', funcaoCom('"transitoria"'), /literal de classe/],
    ['classe hifenizada', funcaoCom('"recusa-do-modelo"'), /literal de classe/],
    ['linha de falha montada à mão', funcaoCom('"{\\"classe\\":\\"x\\"}"'), /literal de classe/],
    ['string de várias linhas', funcaoCom('"""\n      x\n      """'), /várias linhas/],
  ];
  for (const [nome, fonte, esperado] of casos) {
    const achado = problemasDaCola(fonte, APP, PARAMS);
    assert.ok(achado.some((p) => esperado.test(p)), `o detector da cola não viu "${nome}": ${JSON.stringify(achado)}`);
  }
}

check('BARREIRA — a cola do Expo só repassa, com os nomes que o app chama (story 5.9)', () => {
  provarODetectorDaCola();
  assert.ok(
    existsSync(COLA_SWIFT),
    `${relativoARaiz(COLA_SWIFT)} sumiu — a barreira da cola ficou sem alvo. Se a cola mudou de lugar, aponte COLA_SWIFT para ela.`,
  );
  assert.ok(existsSync(INJECAO_DA_PONTE), `${relativoARaiz(INJECAO_DA_PONTE)} sumiu — a barreira não acha os nomes que o app chama.`);
  const app = funcoesDoApp(readFileSync(INJECAO_DA_PONTE, 'utf8'));
  assert.ok(
    app !== null && app.length > 0 && app.every((f) => !f.startsWith('?')),
    `não li FUNCOES_DA_PONTE em ${relativoARaiz(INJECAO_DA_PONTE)} (${JSON.stringify(app)}) — ` +
      'a barreira compararia a cola com nada.',
  );
  const params = parametrosDoApp(readFileSync(INJECAO_DA_PONTE, 'utf8'));
  assert.ok(
    params !== null && params.size > 0 && [...params.values()].every((ps) => ps.every((x) => !x.startsWith('?'))),
    `não li PARAMETROS_DA_PONTE em ${relativoARaiz(INJECAO_DA_PONTE)} — a barreira compararia os argumentos com nada.`,
  );
  const problemas = problemasDaCola(readFileSync(COLA_SWIFT, 'utf8'), app!, params!);
  assert.deepEqual(
    problemas,
    [],
    `a cola ${relativoARaiz(COLA_SWIFT)} pensa ou diverge do app: ${problemas.join('; ')}.\n` +
      '  Ela só declara o nome e repassa ao Engine. A tradução, a tabela erro → classe e o diagnóstico moram no ' +
      'Engine.swift, que a bancada compila e testa; os nomes são os de FUNCOES_DA_PONTE.',
  );
});

/**
 * BARREIRA — o carregador da ponte (story 5.9).
 *
 * O ponto de injeção carrega a ponte por `requireOptionalNativeModule(NOME_DA_PONTE)` —
 * **uma chamada**, em `mobile/src/lib/motores/`, contada por chamada e não por arquivo. E
 * `requireNativeModule(NOME_DA_PONTE)` (ou `NativeModules.<nome>`) não aparece em lugar
 * nenhum de `mobile/src`, testes inclusive: ele **lança** num build sem o módulo (o jest, um
 * build antigo), onde o aparelho tem de ser só `indisponivel`.
 */
check('BARREIRA — a ponte é carregada uma vez, pelo carregador que não lança (story 5.9)', () => {
  const nome = NOME_DA_PONTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const OPCIONAL = new RegExp(`\\brequireOptionalNativeModule\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`]${nome}['"\`]`, 'g');
  const LANCA = new RegExp(
    `\\brequireNativeModule\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`]${nome}['"\`]|\\bNativeModules\\s*(?:\\.\\s*${nome}\\b|\\[\\s*['"\`]${nome}['"\`]\\s*\\])`,
    'g',
  );
  // Não-vácua: os dois detectores veem o que têm de ver, e não veem o comentário.
  assert.equal([...`const p = requireOptionalNativeModule<P>('${NOME_DA_PONTE}');`.matchAll(OPCIONAL)].length, 1);
  assert.equal([...`requireNativeModule('${NOME_DA_PONTE}'); NativeModules.${NOME_DA_PONTE}; NativeModules['${NOME_DA_PONTE}']`.matchAll(LANCA)].length, 3);
  assert.equal([...semComentario(`// requireNativeModule('${NOME_DA_PONTE}')\nconst x = 1;`).matchAll(LANCA)].length, 0);

  const todos = walk(join(ROOT, 'mobile', 'src'));
  assert.ok(todos.length > 0, 'mobile/src sumiu — a barreira do carregador ficou sem alvo');
  const carregam: string[] = [];
  const lancam: string[] = [];
  for (const f of todos) {
    const src = semComentario(readFileSync(f, 'utf8'));
    carregam.push(...[...src.matchAll(OPCIONAL)].map(() => relativoARaiz(f)));
    lancam.push(...[...src.matchAll(LANCA)].map(() => relativoARaiz(f)));
  }
  assert.deepEqual(
    carregam,
    ['mobile/src/lib/motores/index.ts'],
    `a ponte "${NOME_DA_PONTE}" é carregada por requireOptionalNativeModule em ${carregam.length} chamadas ` +
      `(${carregam.join(', ') || 'nenhuma'}) — tem de ser uma, no ponto de injeção. Com zero, o nome da cola e o do ` +
      'app divergiram e o aparelho ficaria "ausente" em todo build.',
  );
  assert.deepEqual(
    lancam,
    [],
    `o carregador que lança aparece em ${lancam.join(', ')}: sem o módulo (jest, build antigo) ele derruba o app ` +
      'onde o aparelho tem de ser só indisponível. Use requireOptionalNativeModule, no ponto de injeção.',
  );
});

/**
 * BARREIRA — nenhum JavaScript nem TypeScript em `mobile/modules/` (story 5.9).
 *
 * As guardas do app varrem `mobile/src`. Um `index.ts` dentro do módulo local seria uma porta
 * para a ponte fora da vista delas — o app importaria o módulo por ali e a catraca (1) não
 * saberia. O módulo local tem Swift, o `.podspec` e o `expo-module.config.json`; quem o carrega
 * é o ponto de injeção, `mobile/src/lib/motores/`.
 */
check('BARREIRA — mobile/modules/ não tem JavaScript nem TypeScript (story 5.9)', () => {
  const dir = join(ROOT, 'mobile', 'modules');
  assert.ok(existsSync(dir), 'mobile/modules/ sumiu — a barreira ficou sem alvo');
  // Não-vácua: o varredor acha o Swift que está lá.
  assert.ok(walkExt(dir, /\.swift$/).length > 0, 'o varredor não achou Swift em mobile/modules/ — a barreira passaria sobre nada');
  const js = walkExt(dir, /\.[mc]?[jt]sx?$/).map((f) => relativoARaiz(f));
  assert.deepEqual(
    js,
    [],
    `mobile/modules/ tem ${js.join(', ')}. O módulo local é Swift, podspec e config; o app o carrega por ` +
      'requireOptionalNativeModule em mobile/src/lib/motores/, onde as guardas veem.',
  );
});

/**
 * BARREIRA — mudar o código nativo sobe o `runtimeVersion` (story 5.9).
 *
 * Um `eas update` só entrega JS, e o entrega a todo aparelho do mesmo `runtimeVersion`. Se o
 * código de `mobile/modules/` muda sem o runtime mudar, um update feito com o JS novo chega a
 * binários com a ponte velha — e o JS chamaria uma função que a cola dele não tem. Nada disso
 * quebra build: é o iPhone do dono que descobre.
 *
 * Então `mobile/modules/runtime.json` guarda, por `runtimeVersion`, o sha256 dos fontes do
 * módulo (todo arquivo de `mobile/modules/`, fora ele mesmo, em ordem de caminho: caminho,
 * `\0`, conteúdo, `\0`). A barreira reprova se o hash de hoje não for o da última entrada, se a
 * última entrada não for o `runtimeVersion` do `app.base.json`, ou se o histórico repetir um
 * runtime ou um hash — é isso que obriga fonte nova a vir com runtime novo.
 */
const RUNTIME_JSON = join(ROOT, 'mobile', 'modules', 'runtime.json');
const APP_BASE_JSON = join(ROOT, 'mobile', 'app.base.json');

/**
 * Os **pesos** do Core AI (story 5.8) — fora da conta, e por uma razão de operação.
 *
 * São 243,7 MiB por conjunto, e o `main.mlirb` sozinho tem 240,3 MiB — acima do teto de 100 MB
 * por arquivo do GitHub. Eles não entram no
 * repositório (`.gitignore`), e nascem de `scripts/coreai/` na máquina do dono. Se contassem
 * no hash, a máquina que os tem e o CI que não os tem calculariam hashes diferentes, e a
 * barreira reprovaria em um dos dois **sempre** — uma guarda que reprova por ausência de dado
 * não guarda nada.
 *
 * **E eles não são o que esta barreira protege.** Ela existe para que um `eas update` só de
 * JS não chegue a um binário com a ponte velha, chamando função que a cola dele não tem. Peso
 * é dado, não interface: trocá-lo não muda uma assinatura de função nativa. O que muda o
 * `runtimeVersion` é o `.swift`, o `.podspec` e a biblioteca vendorizada — e esses continuam
 * dentro da conta.
 */
const PESOS_DO_COREAI_DIR = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios', 'pesos');

/**
 * A biblioteca vendorizada do Core AI — **dentro** da conta, e versionada (story 5.8).
 *
 * São duas saídas possíveis e uma decisão tomada. Deixá-la fora do hash, como os pesos,
 * poria o **maior artefato nativo do repositório** fora de toda guarda que existe aqui: 21,3 MiB
 * de código de terceiros que entram no binário e que ninguém compararia com nada. Então ela é
 * versionada (cabe folgado no teto de 100 MB por arquivo do GitHub, ao contrário dos pesos) e
 * conta no hash — trocar a revisão do pacote da Apple é mudança nativa, e mudança nativa sobe
 * o `runtimeVersion`.
 *
 * O preço é conhecido: um `montar.sh` que refaz o `.a` sem mudar fonte nenhum ainda pede
 * runtime novo. É um binário novo — está certo que peça.
 *
 * A checagem separada existe porque o sintoma, sem ela, é enganoso: num clone sem o `.a` o
 * hash simplesmente diverge, e a mensagem mandaria "suba o runtimeVersion" para quem não
 * mudou nada.
 */
const VENDOR_DO_COREAI = join(ROOT, 'mobile', 'modules', 'on-device-engine', 'ios', 'vendor', 'ios-arm64');
const ARQUIVOS_VENDORIZADOS = ['libOrbeCoreAI.a', 'OrbeCoreAI.swiftinterface'];

/** O sha256 dos fontes de um diretório, como a barreira do runtime o calcula. */
function hashDosFontes(dir: string, ignorar: readonly string[]): string {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    if (ignorar.includes(d)) return;
    for (const e of readdirSync(d)) {
      if (e.startsWith('.') || e === 'node_modules') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) andar(p);
      else if (!ignorar.includes(p)) arquivos.push(p);
    }
  };
  andar(dir);
  const h = createHash('sha256');
  for (const f of arquivos.map((x) => relative(dir, x).split(sep).join('/')).sort()) {
    h.update(f);
    h.update('\0');
    h.update(readFileSync(join(dir, f)));
    h.update('\0');
  }
  return h.digest('hex');
}

interface EntradaDoRuntime {
  readonly runtimeVersion: string;
  readonly fontes: string;
}

function problemasDoRuntime(historico: readonly EntradaDoRuntime[], runtimeDoApp: string, hashDeHoje: string): string[] {
  const problemas: string[] = [];
  if (historico.length === 0) return ['o histórico de runtime.json está vazio'];
  const runtimes = historico.map((e) => e.runtimeVersion);
  const hashes = historico.map((e) => e.fontes);
  const repetidos = (xs: readonly string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];
  if (repetidos(runtimes).length > 0) problemas.push(`o histórico repete o runtime ${repetidos(runtimes).join(', ')}`);
  if (repetidos(hashes).length > 0) problemas.push('o histórico repete um hash — fonte nova exige runtime novo');
  const ultima = historico[historico.length - 1];
  if (ultima.runtimeVersion !== runtimeDoApp) {
    problemas.push(`a última entrada é o runtime ${ultima.runtimeVersion}, e o app.base.json está em ${runtimeDoApp}`);
  }
  if (ultima.fontes !== hashDeHoje) {
    problemas.push(`os fontes de mobile/modules/ mudaram (hash de hoje ${hashDeHoje}) e o runtime ${ultima.runtimeVersion} não`);
  }
  return problemas;
}

check('BARREIRA — mudar mobile/modules/ exige subir o runtimeVersion junto (story 5.9)', () => {
  const A = { runtimeVersion: '1.0.6', fontes: 'aaa' };
  assert.deepEqual(problemasDoRuntime([A], '1.0.6', 'aaa'), [], 'o detector do runtime reprovou o estado certo');
  const provas: readonly (readonly [string, string[], RegExp])[] = [
    ['fonte mudou, runtime não', problemasDoRuntime([A], '1.0.6', 'bbb'), /mudaram .* e o runtime 1\.0\.6 não/],
    ['entrada nova com o mesmo runtime', problemasDoRuntime([A, { runtimeVersion: '1.0.6', fontes: 'bbb' }], '1.0.6', 'bbb'), /repete o runtime 1\.0\.6/],
    ['runtime novo sem o app subir', problemasDoRuntime([A, { runtimeVersion: '1.0.7', fontes: 'bbb' }], '1.0.6', 'bbb'), /o app\.base\.json está em 1\.0\.6/],
    ['app subiu sem entrada', problemasDoRuntime([A], '1.0.7', 'aaa'), /a última entrada é o runtime 1\.0\.6/],
    ['hash repetido', problemasDoRuntime([A, { runtimeVersion: '1.0.7', fontes: 'aaa' }], '1.0.7', 'aaa'), /repete um hash/],
  ];
  for (const [nome, achado, esperado] of provas) {
    assert.ok(achado.some((p) => esperado.test(p)), `o detector do runtime não viu "${nome}": ${JSON.stringify(achado)}`);
  }

  for (const f of ARQUIVOS_VENDORIZADOS) {
    const p = join(VENDOR_DO_COREAI, f);
    assert.ok(
      existsSync(p),
      `${relativoARaiz(p)} não está aqui, e ele é **versionado** (21,3 MiB, dentro do hash do runtime).\n` +
        '  Num clone que não o trouxe, o hash diverge e a mensagem abaixo culparia o runtimeVersion por engano.\n' +
        '  Recrie-o com `./scripts/coreai/montar.sh` — e confira que ele entrou no commit (os pesos, esses sim, ficam fora).',
    );
  }

  const hoje = hashDosFontes(join(ROOT, 'mobile', 'modules'), [RUNTIME_JSON, PESOS_DO_COREAI_DIR]);
  assert.ok(existsSync(RUNTIME_JSON), `${relativoARaiz(RUNTIME_JSON)} sumiu. Recrie-o com o runtime do app.base.json e o hash ${hoje}.`);
  const lido = JSON.parse(readFileSync(RUNTIME_JSON, 'utf8')) as { historico?: EntradaDoRuntime[] };
  const runtimeDoApp = (JSON.parse(readFileSync(APP_BASE_JSON, 'utf8')) as { expo: { runtimeVersion: string } }).expo.runtimeVersion;
  const problemas = problemasDoRuntime(lido.historico ?? [], runtimeDoApp, hoje);
  assert.deepEqual(
    problemas,
    [],
    `o runtime e os fontes nativos divergiram: ${problemas.join('; ')}.\n` +
      `  Mudou o código de mobile/modules/? Suba o runtimeVersion do mobile/app.base.json e acrescente ao fim do ` +
      `histórico de ${relativoARaiz(RUNTIME_JSON)} { "runtimeVersion": "<o novo>", "fontes": "${hoje}" }. ` +
      'Build próprio, e nenhum eas update com este código vai ao runtime anterior (mobile/AGENTS.md).',
  );
});

/**
 * BARREIRA — a sonda de fidelidade só em `scripts/` (AD-7, story 5.10).
 *
 * A sonda pede ao motor que **escolha** a dimensão — exatamente o que a AD-7 proíbe em
 * produto (o motor nunca decide). Ela é descritor, então a guarda (7) a deixa passar por
 * nome; esta fecha o que falta: `descritorDaSondaDaSaude` nunca aparece no código de
 * `mobile/src` nem de `web/src` — nem pelo nome, nem por import profundo de `sleep/sonda`.
 * É da bancada, que mede, e de mais ninguém.
 */
const NOME_DA_SONDA = 'descritorDaSondaDaSaude';
const CAMINHO_DA_SONDA = /(['"`])[^'"`]*\bsleep\/sonda(?:\.[mc]?[jt]sx?)?\1/;

function tocamASonda(arquivos: readonly string[], raiz: string = ROOT): string[] {
  const peloNome = new Set(citamNoCodigo(NOME_DA_SONDA, arquivos, raiz));
  for (const f of arquivos) {
    if (CAMINHO_DA_SONDA.test(semComentario(readFileSync(f, 'utf8')))) peloNome.add(relativoARaiz(f, raiz));
  }
  return [...peloNome].sort();
}

check('BARREIRA — a sonda de fidelidade só em scripts/, nunca nos apps (AD-7)', () => {
  const apps = [...mobileFiles, ...webFiles].filter((f) => !ehTeste(f));
  assert.ok(apps.length > 0, 'mobile/src ou web/src sumiu — a barreira da sonda ficou sem alvo');
  // Não-vácua: a bancada a usa — senão o nome mudou e esta guarda procura o que não existe.
  assert.ok(tocamASonda(scriptFiles).length > 0, `nenhum arquivo de scripts/ usa ${NOME_DA_SONDA} — o nome mudou?`);
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-sonda-'));
  try {
    const casos: readonly (readonly [string, string, boolean])[] = [
      ['pelo-barril.ts', `import { ${NOME_DA_SONDA} } from '@vitale/shared';\nexport const d = ${NOME_DA_SONDA};`, true],
      ['profundo.ts', "import { descritorDaSonda as d } from '@vitale/shared/src/sleep/sonda';\nexport { d };", true],
      ['dinamico.ts', "export const p = import('../../packages/shared/src/sleep/sonda.ts');", true],
      ['comentario.ts', `// ${NOME_DA_SONDA} só no comentário\nexport const x = 1;`, false],
      ['leitura.ts', "import { descritorDaSaudeDoSono } from '@vitale/shared';\nexport const d = descritorDaSaudeDoSono;", false],
    ];
    for (const [nome, fonte, deveAchar] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      assert.equal(tocamASonda([arquivo], dir).length > 0, deveAchar, `o detector da sonda leu errado ${nome}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const fora = tocamASonda(apps);
  assert.deepEqual(
    fora,
    [],
    `a sonda de fidelidade apareceu num app: ${fora.join(', ')}. Ela pede ao motor que escolha a ` +
      'dimensão — o que a AD-7 proíbe em produto. É ferramenta de medição da bancada (scripts/).',
  );
});

/**
 * BARREIRA — a régua da bancada, nos apps, só onde se mede (story 5.13).
 *
 * A amostra, a tradução da medição em linha e as medidas da ADR 0050 subiram para o
 * núcleo (`packages/shared/src/bancada/`) para o iPhone medir o modelo dele com a mesma
 * régua do Mac. Só que a amostra **carrega o caso de cada janela** — e a guarda (7) mantém
 * caso fora das telas de produto: um caso lido na tela poderia discordar da frase que o
 * orquestrador devolve. O módulo fica fora de `ia/` e de `sleep/` justamente para a (7) não
 * o barrar inteiro; esta o prende aos arquivos da medição — a tela de desenvolvimento, a
 * lib que faz o laço dela e o teste dessa lib. Na web, a nenhum.
 *
 * **O teste da lib entra na lista, e por isso os testes dos apps são varridos.** Deixá-los
 * de fora seria abrir a porta pelo lado mais fácil: um `__tests__` que importa a régua e
 * exporta o que quiser é um caminho até ela como outro qualquer.
 *
 * No molde da barreira da sonda, com uma diferença: o nome **só conta em import**. Os
 * nomes deste módulo são palavras comuns (`mediana`, `agregar`), e uma varredura por
 * palavra solta gritaria em toda tela que tem uma mediana própria. Conta o que entra pelo
 * barril (`import`/`export … from`, o `* as` inteiro, o `import()`/`require()` dele) e
 * qualquer caminho profundo até `bancada/` (inclusive `import x = require(…)`).
 *
 * Conta só **valor**, como a (7): `import type` é apagado na compilação e não lê caso
 * nenhum. Os nomes são LIDOS do módulo — declaração, `export { … }` e `export default` —,
 * não escritos aqui: um export novo nasce barrado.
 */
const DIR_DA_REGUA = join(SHARED_SRC, 'bancada');
const TELA_DA_BANCADA = 'mobile/src/app/configuracoes/motores/bancada.tsx';
/**
 * Quem, no app, pode medir: a tela, a lib do laço dela, o teste dessa lib e o retrato que a
 * corrida deixa em disco.
 *
 * O retrato (`arquivo-regras.ts`) entrou porque ele **chama as contas do núcleo em vez de
 * reescrevê-las**: o resumo de cada corrida, a linha de comparação e o aviso de amostras
 * divergentes saem de `bancada/corrida.ts`, para o arquivo e a tela dizerem o mesmo número
 * com a mesma grafia. Ele não lê caso — carrega a linha inteira, que já o tem, para dentro
 * de um JSON que fica no container do aparelho.
 */
const QUEM_MEDE_NO_APP: readonly string[] = [
  TELA_DA_BANCADA,
  'mobile/src/lib/motores/amostra.ts',
  'mobile/src/lib/motores/arquivo-regras.ts',
  'mobile/src/lib/__tests__/motores-amostra.test.ts',
];
const CAMINHO_DA_REGUA = /(?:^|\/)(?:@vitale\/shared|packages\/shared)(?:\/src)?\/bancada(?:\/|$)/;
/** O barril, pelo nome do pacote ou por caminho até `packages/shared/src/index`. */
const CAMINHO_DO_BARRIL = /^(?:@vitale\/shared|(?:\.\.?\/)+(?:packages\/shared\/src|shared\/src)\/index(?:\.[mc]?[jt]sx?)?)$/;

/**
 * Os nomes de valor que o módulo da régua exporta, lidos do fonte: a declaração
 * (`export const/function/class/enum`), a lista (`export { a, b as c }`) e o
 * `export default`. Sem a lista e o default, um export novo nasceria fora da barreira.
 */
function nomesDaRegua(): Set<string> {
  const DECLARA =
    /^[ \t]*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?\s*|const\s+enum\s+|enum\s+|const\s+|let\s+|var\s+|(?:abstract\s+)?class\s+)([A-Za-z_$][\w$]*)/gm;
  const nomes = new Set<string>();
  for (const f of walk(DIR_DA_REGUA).filter((x) => !ehTeste(x))) {
    const src = semComentario(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(DECLARA)) nomes.add(m[1]);
    // `export { a, b as c }` — com ou sem `from`; o nome que sai é o de depois do `as`.
    for (const m of src.matchAll(/^[ \t]*export\s*\{([^}]*)\}/gm)) {
      for (const bruto of m[1].split(',')) {
        const item = bruto.trim();
        if (!item || /^type\s/.test(item)) continue;
        nomes.add(item.split(/\s+as\s+/).pop()!.trim());
      }
    }
    if (/^[ \t]*export\s+default\b/m.test(src)) nomes.add('default');
  }
  return nomes;
}

/** Os arquivos que alcançam a régua por valor, com o que alcançam — pela AST. */
function usamARegua(arquivos: readonly string[], nomes: ReadonlySet<string>, raiz: string = ROOT): string[] {
  const out: string[] = [];
  for (const f of arquivos) {
    const src = readFileSync(f, 'utf8');
    const achados = new Set<string>();
    /** O que uma cláusula nomeada traz do barril, fora os `type X`. */
    const peloBarril = (elementos: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[]): void => {
      for (const e of elementos) {
        if (e.isTypeOnly) continue;
        const nome = (e.propertyName ?? e.name).text;
        if (nomes.has(nome)) achados.add(nome);
      }
    };
    /**
     * O barril carregado **inteiro** — `import * as n`, `import('…')`, `require('…')`,
     * `jest.requireActual('…')`. Não é ofensa por si: ninguém lê caso por carregar o
     * barril. Vira ofensa quando um nome da régua é lido dele, e é o que `lidosDoInteiro`
     * procura depois — senão a barreira acusaria todo teste que usa `localDateStr`.
     */
    let carregaOBarrilInteiro = false;
    /** Um caminho em literal de string: a régua direto, ou o barril inteiro. */
    const porCaminho = (spec: string, como: string): void => {
      if (CAMINHO_DA_REGUA.test(spec)) achados.add(`${como} de ${spec}`);
      else if (CAMINHO_DO_BARRIL.test(spec)) carregaOBarrilInteiro = true;
    };
    /** Um nome da régua lido de um barril carregado inteiro: `n.agregar`, `const { agregar } = n`. */
    const lidosDoInteiro = new Set<string>();
    const visitar = (no: ts.Node): void => {
      if (ts.isImportDeclaration(no) && ts.isStringLiteral(no.moduleSpecifier)) {
        const spec = no.moduleSpecifier.text;
        const clausula = no.importClause;
        const soTipo = clausula?.isTypeOnly === true;
        if (CAMINHO_DA_REGUA.test(spec)) {
          const nomeadas = clausula?.namedBindings && ts.isNamedImports(clausula.namedBindings) ? clausula.namedBindings.elements : [];
          const deValor = !soTipo && (!clausula || clausula.name !== undefined || nomeadas.length === 0 || nomeadas.some((e) => !e.isTypeOnly));
          if (deValor) achados.add(`import de ${spec}`);
        } else if (CAMINHO_DO_BARRIL.test(spec) && clausula && !soTipo) {
          const b = clausula.namedBindings;
          if (b && ts.isNamespaceImport(b)) carregaOBarrilInteiro = true;
          if (b && ts.isNamedImports(b)) peloBarril(b.elements);
        }
      }
      // `import x = require('…')`: nem import nem chamada — a AST o guarda à parte.
      if (ts.isImportEqualsDeclaration(no) && ts.isExternalModuleReference(no.moduleReference)) {
        const alvo = no.moduleReference.expression;
        if (ts.isStringLiteralLike(alvo)) porCaminho(alvo.text, 'import =');
      }
      if (ts.isExportDeclaration(no) && no.moduleSpecifier && ts.isStringLiteral(no.moduleSpecifier) && !no.isTypeOnly) {
        const spec = no.moduleSpecifier.text;
        const clausula = no.exportClause;
        if (CAMINHO_DA_REGUA.test(spec)) achados.add(`export de ${spec}`);
        else if (CAMINHO_DO_BARRIL.test(spec)) {
          // `export * from '@vitale/shared'` reexporta a régua inteira: é um caminho até
          // ela para quem importar este arquivo, e não há nome para conferir.
          if (!clausula || !ts.isNamedExports(clausula)) achados.add('export * do barril');
          else peloBarril(clausula.elements);
        }
      }
      if (ts.isCallExpression(no) && no.arguments.length > 0) {
        const alvo = no.arguments[0]!;
        // `import()`, `require()` e o `jest.requireActual()` dos testes.
        const chamado = ts.isPropertyAccessExpression(no.expression) ? no.expression.name.text : null;
        const ehCarga = no.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(no.expression) && /^require(Actual)?$/.test(no.expression.text))
          || (chamado !== null && /^require(Actual|Mock)?$/.test(chamado));
        // A carga dinâmica do BARRIL também conta: `(await import('@vitale/shared')).agregar`
        // alcança a régua inteira sem uma cláusula de import para a barreira ler.
        if (ehCarga && ts.isStringLiteralLike(alvo)) porCaminho(alvo.text, no.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import()' : 'require()');
      }
      // O nome lido de um objeto — `n.agregar` — e o desestruturado — `const { agregar } = n`.
      if (ts.isPropertyAccessExpression(no) && nomes.has(no.name.text)) lidosDoInteiro.add(`${no.name.text} (do barril inteiro)`);
      if (ts.isObjectBindingPattern(no)) {
        for (const e of no.elements) {
          const nome = e.propertyName ?? e.name;
          if ((ts.isIdentifier(nome) || ts.isStringLiteral(nome)) && nomes.has(nome.text)) {
            lidosDoInteiro.add(`${nome.text} (do barril inteiro)`);
          }
        }
      }
      ts.forEachChild(no, visitar);
    };
    visitar(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, false));
    // Carregar o barril inteiro só conta quando um nome da régua sai dele.
    if (carregaOBarrilInteiro) for (const n of lidosDoInteiro) achados.add(n);
    if (achados.size > 0) out.push(`${relativoARaiz(f, raiz)} (${[...achados].sort().join(', ')})`);
  }
  return out.sort();
}

check('BARREIRA — a régua da bancada (amostra, linha, medidas), nos apps, só onde se mede (story 5.13)', () => {
  const nomes = nomesDaRegua();
  // Não-vácua no alvo: os nomes que motivam a barreira saíram mesmo do módulo — inclusive
  // um que só existe por `export { … }`, que é o furo que a leitura fechou.
  for (const n of ['enumerarJanelas', 'amostraDaNuvem', 'linhaDaMedicao', 'medidasDoPortao', 'foraEmTexto']) {
    assert.ok(nomes.has(n), `packages/shared/src/bancada/ não exporta mais ${n} — a barreira da régua leu o módulo errado`);
  }

  // **Do núcleo de IA, a régua importa só TIPO.** É o que a mantém fora do fecho da guarda
  // (7) — e o que faz a tela de desenvolvimento poder importá-la. Um `import { … }` de
  // valor de `../ia/` aqui reabriria a discussão inteira, calado.
  const comValorDeIa: string[] = [];
  for (const f of walk(DIR_DA_REGUA).filter((x) => !ehTeste(x))) {
    for (const m of semComentario(readFileSync(f, 'utf8')).matchAll(/^[ \t]*import\s+(type\s+)?([^;'"]*?)\s*\bfrom\s*['"](\.\.\/ia\/[^'"]+)['"]/gm)) {
      if (m[1]) continue;                                     // `import type { … }`
      const valores = (/\{([^}]*)\}/.exec(m[2])?.[1] ?? '')
        .split(',').map((x) => x.trim()).filter((x) => x && !/^type\s/.test(x));
      const padrao = m[2].replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
      if (valores.length > 0 || padrao) comValorDeIa.push(`${relativoARaiz(f)} (${[...valores, padrao].filter(Boolean).join(', ')} de ${m[3]})`);
    }
  }
  assert.deepEqual(
    comValorDeIa,
    [],
    `a régua da bancada importou VALOR do núcleo de IA: ${comValorDeIa.join(', ')}. Ela lê tipo de lá e ` +
      'escreve o resto em casa (o `switch` exaustivo de `medidas.ts` é o molde) — é isso que a mantém ' +
      'fora do fecho da guarda (7) e importável pela tela que mede.',
  );

  // O caso-espelho: arquivos de verdade num diretório temporário, pelo mesmo detector.
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-regua-'));
  try {
    const casos: readonly (readonly [string, string, boolean])[] = [
      ['pelo-barril.ts', "import { enumerarJanelas, ler } from '@vitale/shared';\nexport const f = enumerarJanelas;", true],
      ['renomeado.ts', "import { medidasDoPortao as m } from '@vitale/shared';\nexport { m };", true],
      ['profundo.ts', "import { agregar } from '@vitale/shared/src/bancada/medidas';\nexport { agregar };", true],
      ['dinamico.ts', "export const p = import('../../packages/shared/src/bancada/linha.ts');", true],
      ['require.ts', "export const p = require('@vitale/shared/src/bancada/amostra');", true],
      // Os quatro furos que a revisão da 5.13 achou.
      ['barril-dinamico.ts', "export const p = import('@vitale/shared').then((n) => n.agregar);", true],
      ['barril-require.ts', "const n = require('@vitale/shared');\nexport const f = n.medidasDoPortao;", true],
      ['barril-desestrutura.ts', "const { agregar } = require('@vitale/shared');\nexport { agregar };", true],
      ['barril-requireactual.ts', "const real = jest.requireActual('@vitale/shared');\nexport const f = real.enumerarJanelas;", true],
      ['import-igual.ts', "import n = require('@vitale/shared/src/bancada/medidas');\nexport const f = n.agregar;", true],
      ['barril-relativo.ts', "const n = require('../../packages/shared/src/index');\nexport const f = n.mediana;", true],
      ['reexporta.ts', "export { mediana } from '@vitale/shared';", true],
      ['reexporta-tudo.ts', "export * from '@vitale/shared';", true],
      ['namespace.ts', "import * as nucleo from '@vitale/shared';\nexport const x = nucleo.foraEmTexto;", true],
      // O barril inteiro SEM tocar na régua: é o que todo teste que usa `localDateStr`
      // faz, e acusá-lo seria ensinar a desligar a barreira.
      ['namespace-sem-regua.ts', "import * as shared from '@vitale/shared';\nexport const hoje = shared.localDateStr();", false],
      ['requireactual-sem-regua.ts', "const real = jest.requireActual('@vitale/shared');\nexport const f = real.localDateStr;", false],
      ['tela.tsx', "import { amostraDaNuvem } from '@vitale/shared';\nexport const T = () => <View>{String(amostraDaNuvem)}</View>;", true],
      ['tipo.ts', "import type { LinhaDoRelatorio } from '@vitale/shared';\nimport { type MedidasDoPortao, ler } from '@vitale/shared';\nexport type X = [LinhaDoRelatorio, MedidasDoPortao, typeof ler];", false],
      ['comentario.ts', "// import { enumerarJanelas } from '@vitale/shared';\nexport const x = 1;", false],
      ['outro-modulo.ts', "import { mediana, agregar } from './estatistica';\nexport { mediana, agregar };", false],
      ['outro-dinamico.ts', "export const p = import('./estatistica');", false],
      ['porta.ts', "import { ler, entradaDaSaude, descritorDaSaudeDoSono } from '@vitale/shared';\nexport { ler, entradaDaSaude, descritorDaSaudeDoSono };", false],
    ];
    for (const [nome, fonte, deveAchar] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      assert.equal(usamARegua([arquivo], nomes, dir).length > 0, deveAchar, `o detector da régua leu errado ${nome}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // **Com os testes dos apps**: eles alcançam a régua como qualquer outro arquivo.
  const apps = [...walk(join(ROOT, 'mobile', 'src')), ...walk(join(ROOT, 'web', 'src'))].filter((f) => !f.endsWith('.spec.ts'));
  assert.ok(apps.length > mobileFiles.length, 'a varredura não pegou os testes dos apps — a barreira da régua ficou com furo');
  const usam = usamARegua(apps, nomes);
  // Não-vácua na liberação: cada arquivo liberado usa mesmo a régua — senão a lista libera
  // o que não precisa, e um deles mudou de lugar sem a barreira notar.
  for (const permitido of QUEM_MEDE_NO_APP) {
    assert.ok(
      usam.some((u) => u.startsWith(`${permitido} (`)),
      `${permitido} não usa a régua da bancada — ele mudou de lugar? Corrija QUEM_MEDE_NO_APP.`,
    );
  }
  const fora = usam.filter((u) => !QUEM_MEDE_NO_APP.some((p) => u.startsWith(`${p} (`)));
  assert.deepEqual(
    fora,
    [],
    `a régua da bancada apareceu fora da medição:\n    ${fora.join('\n    ')}\n` +
      '  A amostra carrega o caso de cada janela, e caso não entra em tela de produto (guarda (7)): a tela ' +
      'recebe do orquestrador a frase pronta. Quem mede é a bancada — no app, só ' +
      `${QUEM_MEDE_NO_APP.join(', ')}. Um tipo (\`import type\`) é livre.`,
  );
});

/**
 * BARREIRA — `Motor` não se reexporta com outro nome (AD-1).
 *
 * A porta é uma só, e o nome dela também. Um `export { Motor as Narrador }` é a
 * segunda porta nascendo com cara de apelido: quem a importa não sabe que é a
 * mesma, e a próxima mudança da porta passa a ter dois lugares a conferir.
 * Reexportar com o MESMO nome é legítimo — é o mesmo símbolo, e o `export *` do
 * barril não o vê duas vezes. Era o que `routes/nomear.ts` fazia com
 * `ChamadorDeModelo`; a 5.7 apagou a costura inteira, e não sobrou reexporte.
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
      `e CONCLUSAO é ${JSON.stringify(CONCLUSAO)}. Atenção antes de "mudar os dois juntos": quem grava ` +
      `a edição é a função edicao_imprimir, que recebe o motivo de parada pronto — e o CHECK é a ` +
      `última rede antes de um texto truncado virar edição.`,
  );
});

/**
 * BARREIRA — a tela não alcança o ranqueamento do miolo (Story 1.9, AD-4).
 *
 * A ordem dos cadernos **congela na impressão**, na coluna `posicao`. Quem a
 * calcula é `ordenarCadernos` (`ia/ranqueamento.ts`), e ela é função de
 * impressão, nunca de render: uma tela que a chamasse reordenaria agosto/2026
 * em silêncio no dia em que um peso da confiança mudasse — reescrita de período
 * fechado, que é exatamente o que a coluna existe para impedir.
 *
 * O `index.ts` já não a exporta, e `ranqueamento.test.ts` cobra essa ausência.
 * Não é o mesmo que o app não a alcançar: um import **profundo**
 * (`@vitale/shared/src/ia/ranqueamento`, ou o caminho relativo até
 * `packages/shared/src/ia/ranqueamento`) compila igual. Esta barreira fecha
 * isso, pelos dois lados:
 *
 * - o **caminho**, em qualquer literal de string — `import`, `import()`,
 *   `require`, com ou sem extensão;
 * - o **nome**, porque um reexport futuro pelo barril traria `ordenarCadernos`
 *   por uma porta que nenhuma regex de caminho vê.
 *
 * **E a lista de nomes é LIDA do módulo, não escrita aqui.** Uma lista à mão
 * fecha a porta dos nomes que existiam no dia em que ela foi escrita: um quinto
 * export nasceria alcançável com a barreira verde. Os nomes saem do próprio
 * fonte de `ia/ranqueamento.ts`, e a barreira exige achar alguns — se a leitura
 * falhar, ela reprova em vez de varrer o vazio.
 */
check('BARREIRA — nem mobile nem web alcançam ia/ranqueamento', () => {
  const alvos = [...mobileFiles, ...webFiles].filter((f) => !ehTeste(f));
  assert.ok(
    alvos.length > 0,
    'mobile/src ou web/src sumiu da varredura — a barreira do ranqueamento ficou sem alvo.',
  );
  // Qualquer specifier que termine em `ia/ranqueamento`, com ou sem extensão.
  const PELO_CAMINHO = /(['"`])[^'"`]*\bia\/ranqueamento(?:\.[jt]sx?)?\1/;

  // Tudo o que o módulo exporta — valor e tipo. `AMOSTRA_MINIMA` e `PESO_DA_BASE`
  // entram junto de propósito: são o ranqueamento vazando por constante, e uma
  // tela não tem o que fazer com eles.
  const fonteDoRanqueamento = semComentario(
    readFileSync(join(ROOT, 'packages', 'shared', 'src', 'ia', 'ranqueamento.ts'), 'utf8'),
  );
  const EXPORTA = new RegExp(
    '^[ \\t]*export\\s+(?:declare\\s+)?(?:async\\s+)?'
    + '(?:function\\*?\\s*|const\\s+enum\\s+|enum\\s+|const\\s+|let\\s+|var\\s+|'
    + '(?:abstract\\s+)?class\\s+|interface\\s+|type\\s+)([A-Za-z_$][\\w$]*)',
    'gm',
  );
  const nomesDoModulo = [...fonteDoRanqueamento.matchAll(EXPORTA)].map((m) => m[1]);
  assert.ok(
    nomesDoModulo.length >= 3,
    `a leitura dos exports de ia/ranqueamento.ts achou ${JSON.stringify(nomesDoModulo)} — poucos para ` +
      `ser verdade. A barreira estaria varrendo por um punhado de nomes, e o resto passaria por baixo.`,
  );
  assert.ok(
    nomesDoModulo.includes('ordenarCadernos'),
    'ia/ranqueamento.ts não exporta mais `ordenarCadernos` — a barreira ficou sem o nome que a motiva.',
  );
  // **O nome só conta em contexto de IMPORT**, e não solto no arquivo.
  //
  // A varredura por palavra solta tratava qualquer ocorrência como violação, e o
  // módulo exporta nomes que não são dele sozinho: `AMOSTRA_MINIMA` ou um
  // `ordenar` futuro viram alarme espalhado por telas que nunca ouviram falar do
  // ranqueamento — e barreira que grita sem motivo é barreira que se aprende a
  // silenciar. O que se quer pegar é o nome ENTRANDO no arquivo: pela lista de
  // um `import { … }`, por `require(…)` desestruturado, ou qualificado por um
  // namespace importado (`ranqueamento.ordenarCadernos`).
  const nomes = nomesDoModulo.join('|');
  const IMPORTADO = new RegExp(
    // import { ordenarCadernos, … } from '…'   /   const { ordenarCadernos } = require('…')
    `(?:import|require|from)[\\s\\S]{0,400}?\\{[^}]*\\b(?:${nomes})\\b[^}]*\\}`,
  );
  const QUALIFICADO = new RegExp(`\\b[A-Za-z_$][\\w$]*\\.(?:${nomes})\\b`);
  const offenders = alvos
    .filter((f) => {
      const src = semComentario(readFileSync(f, 'utf8'));
      return PELO_CAMINHO.test(src) || IMPORTADO.test(src) || QUALIFICADO.test(src);
    })
    .map((f) => f.replace(ROOT + '/', ''));
  assert.deepEqual(
    offenders,
    [],
    `a tela alcançou o ranqueamento do miolo: ${offenders.join(', ')}. A ordem dos cadernos vem ` +
      `da coluna \`posicao\`, gravada na impressão — a leitura nunca a recalcula. Quem precisa ` +
      `ordenar é a sequência da impressão, dentro do núcleo (Story 1.10).`,
  );
});

/**
 * BARREIRA — o literal `'STOP'` só na `CONCLUSAO` (AD-10 (6), AD-12).
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
 *   1 (1.9) — o celular parou de narrar antes da 1.10: a escrita saiu de
 *             `mobile/src/lib/edicao-ia.ts` junto com a migração, e o arquivo
 *             ficou só com a leitura. Sobra `routes/nomear.ts`.
 *   1 (1.10) — fica. A impressão voltou pelo orquestrador, e o motivo de parada
 *             gravado é `CONCLUSAO`, nomeada em `ia/imprimir.ts` — nenhum literal
 *             novo. Quem zera é a 5.7, com o nome de rota.
 *   0 (5.7) — **vira barreira.** O nome de rota passou pela porta: a sequência de
 *             `routes/nomear.ts` foi para o orquestrador, e o truncamento chega
 *             como `saida-invalida` da borda da nuvem — ninguém mais compara
 *             motivo de parada fora dela. Como a guarda nasce em zero, a
 *             não-vacuidade é provada por **caso-espelho**: arquivos de verdade
 *             num diretório temporário, pelo mesmo detector.
 */
const DONO_CONCLUSAO = 'packages/shared/src/ia/motor.ts';
const ADAPTADOR_DO_PROVEDOR = 'supabase/functions/_shared/ia/narrador.ts';
const DEFINE_CONCLUSAO = /\bconst\s+CONCLUSAO\s*=\s*(['"`])STOP\1/;

/**
 * Os arquivos cujo código cita `'STOP'` fora do dono e do adaptador.
 *
 * Extraída para que o caso-espelho passe pelo **mesmo** detector: um auto-teste
 * com o seu próprio casador passaria verde com o detector de verdade quebrado.
 */
function stopForaDaConclusao(arquivos: readonly string[], raiz: string = ROOT): string[] {
  const LITERAL = /(['"`])STOP\1/;
  const fora: string[] = [];
  for (const f of arquivos) {
    const rel = relativoARaiz(f, raiz);
    if (rel === ADAPTADOR_DO_PROVEDOR) continue;
    let src = semComentario(readFileSync(f, 'utf8'));
    if (rel === DONO_CONCLUSAO) src = src.replace(DEFINE_CONCLUSAO, '');
    if (LITERAL.test(src)) fora.push(rel);
  }
  return fora.sort();
}

check("BARREIRA — o literal 'STOP' só na CONCLUSAO", () => {
  assert.ok(
    DEFINE_CONCLUSAO.test(readFileSync(join(ROOT, DONO_CONCLUSAO), 'utf8')),
    `a barreira ficou sem dono: ${DONO_CONCLUSAO} não declara mais CONCLUSAO = 'STOP'.`,
  );

  // O caso-espelho: a guarda nasce em zero, então não há ofensor real que prove
  // que ela vê. Estes arquivos são de verdade, e passam pelo mesmo detector.
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-stop-'));
  try {
    const casos: readonly (readonly [string, string, boolean])[] = [
      ['compara.ts', "export const ok = (m: string) => m === 'STOP';", true],
      ['aspas-duplas.ts', 'export const ok = (m: string) => m !== "STOP";', true],
      ['template.ts', 'export const ok = (m: string) => m === `STOP`;', true],
      ['comentario.ts', "// o motivo de parada é 'STOP'\nexport const x = 1;", false],
      ['pela-constante.ts', "import { CONCLUSAO } from './motor';\nexport const ok = (m: string) => m === CONCLUSAO;", false],
      // A palavra dentro de outra string não é a grafia — `STOPWORDS` é outra coisa.
      ['outra-palavra.ts', "export const x = 'STOPWORDS';", false],
    ];
    for (const [nome, fonte, deveAchar] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      assert.equal(stopForaDaConclusao([arquivo], dir).length > 0, deveAchar, `o detector de 'STOP' leu errado ${nome}`);
    }
    // E o adaptador do provedor continua livre, pelo caminho dele.
    const doAdaptador = join(dir, ADAPTADOR_DO_PROVEDOR);
    mkdirSync(dirname(doAdaptador), { recursive: true });
    writeFileSync(doAdaptador, "export const ok = (m: string) => m === 'STOP';\n");
    assert.deepEqual(stopForaDaConclusao([doAdaptador], dir), [], 'o adaptador do provedor deixou de ser livre');

    // **A isenção do dono é cirúrgica**: ela apaga a declaração, e só ela. Um
    // segundo literal dentro de `ia/motor.ts` — a comparação que a barreira
    // existe para impedir, escrita no arquivo mais fácil de justificar — tem de
    // ser pego. Sem este caso, a isenção seria um passe livre para o dono.
    const doDono = join(dir, DONO_CONCLUSAO);
    mkdirSync(dirname(doDono), { recursive: true });
    writeFileSync(doDono, "export const CONCLUSAO = 'STOP';\n");
    assert.deepEqual(stopForaDaConclusao([doDono], dir), [], 'a declaração do dono deixou de ser isenta');
    writeFileSync(doDono, "export const CONCLUSAO = 'STOP';\nexport const ok = (m: string) => m === 'STOP';\n");
    assert.deepEqual(
      stopForaDaConclusao([doDono], dir),
      [DONO_CONCLUSAO],
      'um SEGUNDO literal no dono passou — a isenção virou passe livre',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const alvos = [
    ...walk(SHARED_SRC), ...mobileFiles, ...webFiles,
    ...walk(join(ROOT, 'supabase', 'functions')), ...walk(join(ROOT, 'scripts')),
  ].filter((f) => !ehTeste(f));
  assert.ok(alvos.length > 0, 'a varredura ficou sem alvo — a barreira passaria por vacuidade');
  const fora = stopForaDaConclusao(alvos);
  assert.deepEqual(
    fora,
    [],
    `'STOP' literal em ${fora.length} arquivos: ${fora.join(', ')}.\n` +
      `  Compare com CONCLUSAO (ia/motor) — ou, melhor, não compare: quem traduz o motivo de ` +
      `parada é a borda, e a Resposta já chega concluída.`,
  );
});

/**
 * BARREIRA — uma porta por hospedeiro (AD-10 (1), ADR 0047).
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
 *   1 (1.9) — a narração saiu do celular antes da 1.10, junto com a migração:
 *             `edicao-ia.ts` ficou só com a leitura. Sobra o nome de rota.
 *   1 (1.10) — fica. A impressão voltou ao celular pelo `motorPara` de
 *             `mobile/src/lib/motores/` — `edicao-ia.ts` não nomeia a function.
 *             Sobra `services/route-name.ts`, que sai na 5.7.
 *   1 (5.9)  — fica. A ponte passou a ser carregada — por
 *             `requireOptionalNativeModule('OnDeviceEngine')`, em
 *             `mobile/src/lib/motores/index.ts`, dentro do ponto de injeção. A
 *             barreira da cola, acima, confere que é esse o nome da cola; a do
 *             carregador, que é uma chamada só e que o que lança não aparece em
 *             `mobile/src`; a de `mobile/modules/`, que o módulo não tem TS por
 *             onde a ponte escaparia desta catraca.
 *   0 (5.7)  — **vira barreira.** `services/route-name.ts` deixou de nomear a
 *             function: ele pede o motor ao `motorPara` do ponto de injeção e
 *             passa pelo orquestrador. Nascendo em zero, a não-vacuidade é
 *             provada por **caso-espelho** — arquivos de verdade num diretório
 *             temporário, pelo mesmo detector, incluindo um dentro do ponto de
 *             injeção, que tem de continuar livre.
 */
const PONTOS_DE_INJECAO = [
  /^mobile\/src\/lib\/motores\//,
  /^web\/src\/app\/core\/motores\//,
  /^scripts\/[^/]+\/motores\.ts$/,
];

/**
 * Os arquivos que nomeiam a function ou carregam a ponte fora do ponto de
 * injeção do hospedeiro, com o que foi achado em cada um.
 *
 * Extraída para que o caso-espelho passe pelo **mesmo** detector: um auto-teste
 * com o seu próprio casador passaria verde com o detector de verdade quebrado.
 */
function portaForaDoPontoDeInjecao(arquivos: readonly string[], raiz: string = ROOT): string[] {
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
  const fora: string[] = [];
  for (const f of arquivos) {
    const rel = relativoARaiz(f, raiz);
    if (PONTOS_DE_INJECAO.some((re) => re.test(rel))) continue;
    const src = semComentario(readFileSync(f, 'utf8'));
    const o = [
      CHAMA_A_FUNCTION.test(src) ? "'ia-narrar'" : null,
      IMPORTA_A_PONTE.test(src) ? 'on-device-engine' : null,
    ].filter((x): x is string => x !== null);
    if (o.length > 0) fora.push(`${rel} (${o.join(', ')})`);
  }
  return fora.sort();
}

check('BARREIRA — a ia-narrar e a ponte só no ponto de injeção de cada hospedeiro', () => {
  assert.ok(mobileFiles.length > 0 && webFiles.length > 0, 'mobile/src ou web/src sumiu — a barreira ficou sem alvo');

  // O caso-espelho: a guarda nasce em zero, então nenhum arquivo do repositório
  // prova que ela vê. Estes são de verdade, e passam pelo mesmo detector.
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-porta-'));
  try {
    const casos: readonly (readonly [string, string, boolean])[] = [
      ['invoca.ts', "export const r = supabase.functions.invoke('ia-narrar', { body });", true],
      ['por-url.ts', "export const u = `${base}/functions/v1/ia-narrar`;", true],
      ['ponte-por-caminho.ts', "import { responder } from '../../modules/on-device-engine';\nexport { responder };", true],
      ['ponte-pelo-nome.ts', "export const p = requireOptionalNativeModule<X>('OnDeviceEngine');", true],
      ['ponte-nativemodules.ts', 'export const p = NativeModules.OnDeviceEngine;', true],
      ['comentario.ts', "// quem chama a ia-narrar é mobile/src/lib/motores/\nexport const x = 1;", false],
      ['pelo-ponto.ts', "import { motorPara } from '../lib/motores';\nexport const m = motorPara('nuvem:padrao');", false],
    ];
    for (const [nome, fonte, deveAchar] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      assert.equal(portaForaDoPontoDeInjecao([arquivo], dir).length > 0, deveAchar, `o detector da porta leu errado ${nome}`);
    }

    /*
     * **Os três pontos de injeção, um a um.** Provar só o do celular deixava os
     * outros dois sem rede: uma regex errada em `^web/src/app/core/motores/` ou
     * no frágil `^scripts/[^/]+/motores\.ts$` desligaria a barreira para aquele
     * hospedeiro sem ninguém ver — a lista continuaria vazia, e por vacuidade.
     *
     * O caso do `scripts/` vem em par: o caminho que a regex aceita (um nível de
     * pasta) e o que ela recusa (dois níveis), porque é aí que ela quebra.
     */
    const livres: readonly (readonly [string, boolean])[] = [
      ['mobile/src/lib/motores/index.ts', true],
      ['mobile/src/lib/motores/fundo/adaptador.ts', true],
      ['web/src/app/core/motores/nuvem.ts', true],
      ['scripts/bancada/motores.ts', true],
      // Fora do padrão: um nível a mais, ou outro nome de arquivo.
      ['scripts/bancada/ia/motores.ts', false],
      ['scripts/bancada/cliente.ts', false],
      ['web/src/app/core/ia/motores.ts', false],
    ];
    for (const [caminho, deveSerLivre] of livres) {
      const arquivo = join(dir, caminho);
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, "export const F = 'ia-narrar';\nexport const p = requireOptionalNativeModule('OnDeviceEngine');\n");
      assert.equal(
        portaForaDoPontoDeInjecao([arquivo], dir).length === 0,
        deveSerLivre,
        `${caminho} ${deveSerLivre ? 'deixou de ser' : 'virou'} ponto de injeção — confira PONTOS_DE_INJECAO`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const alvos = [...mobileFiles, ...webFiles, ...walk(join(ROOT, 'scripts'))].filter((f) => !ehTeste(f));
  const fora = portaForaDoPontoDeInjecao(alvos);
  assert.deepEqual(
    fora,
    [],
    `a function ou a ponte chamadas fora do ponto de injeção em ${fora.length} arquivos:\n    ${fora.join('\n    ')}\n` +
      `  Quem fala com motor pede um ao ponto de injeção do hospedeiro (mobile/src/lib/motores/) e ` +
      `passa pelo orquestrador — criarMotorDeNuvem(invocar) já sabe ler a function.`,
  );
});

/**
 * BARREIRA — fora do núcleo, do núcleo de IA só a porta e os descritores (AD-10 (7), AD-2).
 *
 * Um hospedeiro que importa `montarPrompt` e `verificarTexto` está percorrendo
 * a sequência pedido → modelo → conferência por conta própria — exatamente a
 * segunda sequência que o orquestrador existe para não haver. Fora de
 * `packages/shared`, do núcleo de IA se importam a porta (`fio`, `motor`,
 * `orquestrar`, `nuvem`, `recursos`, desde a 1.10 `imprimir`, a sequência da
 * impressão, e desde a 5.10 `aparelho`, o motor do aparelho) e os descritores (nomes
 * `descritor*`).
 *
 * Conta só import **de valor**: `import type` e `type X` ficam de fora, porque
 * tipo não sequencia nada — e contá-los faria a guarda nascer em 3 (o cartão e
 * a store da edição importam `Problema` e `EntradaPacote`) e não virar barreira
 * na 1.10. `routes/` fica fora até a 5.7: `nomeDaAtividade` e `nomeProprio` são
 * exibição, usados em seis telas. Varre `mobile/src` e `web/src`, fora de
 * teste; os nomes vêm do que as peças exportam, e conta arquivos.
 *
 * **As peças da Saúde do sono moram em `sleep/`** (story 5.3): `sleep/caso` e
 * `sleep/leitura` são o caso, o template e o pedido — um app que importasse
 * `casoDaSaude` ou `templateDaSaude` estaria escrevendo a leitura por conta
 * própria. Entram no conjunto, fora `entradaDaSaude` — a entrada pura que a tela
 * chama e passa ao `ler` (AD-11) — e os descritores. O import profundo conta com
 * ou sem extensão: `sleep/leitura.js` é o mesmo fonte que `sleep/leitura`.
 *
 * **As peças de `sleep/` são achadas, não listadas** (revisão 3): a semente é o
 * arquivo de `sleep/` que importa a porta de IA, e o fecho dela dentro de `sleep/`
 * entra junto, menos o que as telas já usavam (`SONO_DAS_TELAS`, conferido contra os
 * apps). Uma lista escrita à mão deixaria uma terceira peça nascer importável com o
 * teto ainda em 1.
 *
 * **Varre `scripts/` desde a 5.4**, com o teto no mesmo lugar: a bancada fala com
 * motor pelo `ler` do orquestrador, como qualquer hospedeiro, e não monta pedido
 * nem confere nada por conta própria.
 *
 * Teto e histórico:
 *   1 (5.1) — `mobile/src/lib/edicao-ia.ts`, a sequência da narração que a 1.10
 *             passa para o orquestrador. Vira barreira em zero, na 1.10.
 *   1 (5.3) — as peças de `sleep/` entram sem ofensor: nenhum app as importa.
 *   1 (5.4) — `scripts/` entra sem ofensor: a bancada só nomeia o caso (abaixo).
 *   1 (1.9) — o mesmo arquivo, por outra razão. A narração saiu dele; sobrou
 *             `periodoFechado`, que não sequencia nada — é o predicado que
 *             separa "não tem edição" de "não tem edição AINDA", e sem ele a
 *             tela anunciaria o mês em curso como não escrito. Registrado aqui
 *             porque a promessa "vira barreira em zero na 1.10" depende deste
 *             import sair, e ele não sai pela 1.10: quem quiser zerar move o
 *             predicado para fora de `ia/`.
 *   0 (1.10) — **vira barreira.** `periodoFechado` mudou para `period/fechado.ts`
 *             (sem reexporte por `ia/pacote`), e a impressão voltou ao celular
 *             pela porta: `imprimir` (`ia/imprimir.ts`) entrou em `PORTA_DE_IA`,
 *             porque é o cliente do orquestrador que o hospedeiro chama com as
 *             portas dele — não monta pedido nem confere nada, e o descritor é
 *             fixo nele. A sequência com descritor injetável (`imprimirCom`, em
 *             `ia/imprimir-sequencia.ts`) fica **fora** da porta e do barril: um
 *             app que a importasse por caminho profundo poderia passar um
 *             descritor com a conferência trocada, e é esta guarda que reprova. A barreira tem
 *             caso-espelho: fixtures num diretório temporário, pelo mesmo
 *             detector, provam que um `montarPacotes` importado num app reprova.
 *   0 (5.10) — `aparelho` (`ia/aparelho.ts`) entra em `PORTA_DE_IA`: é o motor do
 *             aparelho, no molde de `nuvem` — o hospedeiro injeta o transporte e
 *             recebe a porta. Não monta pedido nem confere nada. A sonda de fidelidade
 *             (`sleep/sonda.ts`) não pede lista nenhuma: é descritor, e todo nome com
 *             prefixo `descritor` já é livre.
 */
const PORTA_DE_IA = new Set(['fio', 'motor', 'orquestrar', 'nuvem', 'aparelho', 'recursos', 'imprimir']);
/** O que a tela chama das peças de `sleep/`: a entrada, não a leitura. */
const LIVRES_DE_SONO = new Set(['entradaDaSaude']);
/**
 * O que a **bancada** (`scripts/`) lê das peças, e os apps não.
 *
 * `casoDaSaude` é a coluna pela qual o relatório agrega ("reprovou 4 vezes em
 * `duas`") e o critério da amostra da nuvem ("duas janelas por caso × alcance").
 * Sem ele a bancada teria de classificar o caso por conta própria — que é
 * exatamente a segunda implementação que esta catraca existe para impedir — ou
 * entregar ao dono um relatório sem a coluna que ele precisa ler.
 *
 * **É a bancada que nomeia, não que decide:** ela não monta pedido, não interpreta
 * e não confere — quem faz isso é o descritor, pelo `ler`. E a liberação é só
 * daqui: nas telas `casoDaSaude` continua barrado, porque o orquestrador já lhes
 * devolve a frase pronta e um caso lido na tela poderia discordar dela.
 *
 * `exemploDaSaude` (story 5.11) é o exemplo de frase aprovada que o pedido traz, com
 * os marcadores. A bancada o lê para **contar** quantas aprovadas são o exemplo
 * copiado — a condição 3 da ADR 0050 só compara com o template, e um motor que
 * devolve o exemplo marcaria zero idênticas. Ela não o monta nem confere nada com
 * ele: é a mesma função que o pedido usa, e a conta é só leitura. Nas telas, barrado.
 *
 * `versoesDaRetrospectiva` (story 2.8) é a decodificação do par que `edicoes_ia`
 * grava. O `--massa --caderno` do script classifica o arquivo pelo `prompt_versao`
 * de cada caderno, e para isso precisa saber qual prompt uma impressão de **hoje**
 * carimbaria: ele o tira do descritor que já entrega à sequência
 * (`versoesDaRetrospectiva(descritorDaRetrospectiva.versao).prompt`), que é a mesma
 * função e a mesma conta que a sequência faz ao escrever a coluna. A alternativa
 * era importar `PROMPT_VERSAO` de `ia/prompt` — um segundo caminho até o mesmo
 * fato, que é exatamente o que esta catraca existe para impedir. Ela **lê uma
 * versão para decidir o que reimprimir**; não monta pedido, não interpreta e não
 * confere. Nas telas, barrado: a versão que um app mostra é a da linha gravada.
 */
const LIVRES_NA_BANCADA = new Set(['casoDaSaude', 'exemploDaSaude', 'versoesDaRetrospectiva']);
/**
 * O que `sleep/` empresta às telas desde antes da leitura, e por isso não é peça
 * dela: a contagem e os períodos do seletor. Cada um é conferido contra os apps —
 * se nenhuma tela o importa, ele é peça, e a lista mente.
 */
const SONO_DAS_TELAS = new Set(['score', 'ranges']);

/**
 * O caminho de um arquivo relativo à raiz, com `/` — ou o absoluto, quando ele
 * está fora dela (a autoprova num diretório temporário). `f.replace(ROOT + '/',
 * '')` erra quando o `TMPDIR` fica dentro do repositório; este não. `raiz` é a do
 * repositório, ou a de uma autoprova que monta a árvore dela.
 */
function relativoARaiz(f: string, raiz: string = ROOT): string {
  return f.startsWith(raiz + sep) ? relative(raiz, f).split(sep).join('/') : f;
}

check('BARREIRA — fora do núcleo, do núcleo de IA só a porta e os descritores', () => {
  const iaDir = join(SHARED_SRC, 'ia');
  const sonoDir = join(SHARED_SRC, 'sleep');
  const moduloDe = (dir: string) => (f: string) => f.slice(dir.length + 1).replace(/\.tsx?$/, '');
  const moduloDeIa = moduloDe(iaDir);
  const moduloDeSono = moduloDe(sonoDir);

  // As peças de `sleep/` são **achadas**, não listadas: a semente é o arquivo que
  // importa a porta de IA (é leitura de modelo), e o fecho dela dentro de `sleep/`
  // vem junto — menos o que as telas já usavam. Uma terceira peça nasce contada.
  const arquivosDeSono = walk(sonoDir).filter((f) => !ehTeste(f));
  const IMPORTA_SONO = /from\s*['"]\.\/([\w.-]+)['"]/g;
  const importaDeIa = (src: string) => /from\s*['"]\.\.\/ia\//.test(src);
  const fonteDe = new Map(arquivosDeSono.map((f) => [moduloDeSono(f), semComentario(readFileSync(f, 'utf8'))]));
  const pecasDeSono = new Set<string>();
  const porVer = [...fonteDe].filter(([, src]) => importaDeIa(src)).map(([m]) => m);
  while (porVer.length > 0) {
    const m = porVer.pop()!;
    if (pecasDeSono.has(m) || SONO_DAS_TELAS.has(m)) continue;
    pecasDeSono.add(m);
    for (const i of (fonteDe.get(m) ?? '').matchAll(IMPORTA_SONO)) {
      const vizinho = i[1].replace(/\.tsx?$/, '');
      if (fonteDe.has(vizinho)) porVer.push(vizinho);
    }
  }
  const pecas = [
    ...walk(iaDir).filter((f) => !ehTeste(f) && !PORTA_DE_IA.has(moduloDeIa(f))),
    ...[...pecasDeSono].map((m) => join(sonoDir, `${m}.ts`)),
  ];
  assert.ok(
    pecas.every((f) => existsSync(f)),
    `peça de sleep/ sumiu: ${pecas.filter((f) => !existsSync(f)).join(', ')} — a varredura achou módulo sem arquivo .ts.`,
  );
  /**
   * **A régua da bancada fica fora deste fecho** (story 5.13). Ela é importável pela tela
   * de desenvolvimento — quem a prende lá é a barreira da régua, logo acima —, e para isso
   * ela não pode ser peça: mora fora de `ia/` e de `sleep/`, e importa do núcleo de IA
   * **só tipo**. Um dia em que alguém a mudasse de lugar, ou lhe desse um import de valor
   * que a trouxesse para cá, a (7) a barraria inteira e a tela pararia de medir — com o
   * erro apontando para o lugar errado. Esta asserção é o aviso.
   */
  assert.ok(existsSync(DIR_DA_REGUA), 'packages/shared/src/bancada/ sumiu — a régua mudou de lugar?');
  const daRegua = pecas.filter((f) => f.startsWith(DIR_DA_REGUA + sep)).map((f) => relativoARaiz(f));
  assert.deepEqual(daRegua, [], 'um arquivo da régua da bancada entrou no fecho da guarda (7) — ver a nota acima.');
  // A lista do que "é das telas" não pode ser desculpa: algum nome de cada módulo
  // dela aparece mesmo num app.
  const fontesDosApps = [...mobileFiles, ...webFiles].filter((f) => !ehTeste(f)).map((f) => readFileSync(f, 'utf8'));
  const DECLARA_VALOR =
    /^[ \t]*export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?\s*|const\s+enum\s+|enum\s+|const\s+|let\s+|var\s+|(?:abstract\s+)?class\s+)([A-Za-z_$][\w$]*)/gm;
  for (const m of SONO_DAS_TELAS) {
    const nomes = [...(fonteDe.get(m) ?? '').matchAll(DECLARA_VALOR)].map((x) => x[1]);
    assert.ok(nomes.length > 0, `sleep/${m} não existe ou não exporta valor — SONO_DAS_TELAS aponta para o vazio.`);
    assert.ok(
      nomes.some((n) => fontesDosApps.some((src) => new RegExp(`\\b${n}\\b`).test(src))),
      `sleep/${m} está em SONO_DAS_TELAS e nenhuma tela usa nome nenhum dele — ou ele é peça, ou a lista mente.`,
    );
  }

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
  for (const livre of LIVRES_DE_SONO) nomes.delete(livre);
  // **Nenhum nome da régua da bancada pode ser peça** (story 5.13): se `medidasDoPortao`
  // ou `enumerarJanelas` fossem parar em `ia/` ou `sleep/`, esta guarda os barraria nos
  // apps — e a tela de desenvolvimento, que é quem mede, pararia de compilar com um erro
  // que aponta para o lugar errado. Quem prende a régua à medição é a barreira dela.
  const reguaVirouPeca = [...nomesDaRegua()].filter((n) => nomes.has(n)).sort();
  assert.deepEqual(
    reguaVirouPeca,
    [],
    `nome da régua da bancada virou peça do núcleo de IA: ${reguaVirouPeca.join(', ')}. A régua mora em ` +
      'packages/shared/src/bancada/, fora de ia/ e de sleep/, e importa de lá só TIPO.',
  );
  assert.ok(pecas.length > 0 && nomes.size > 0, 'as peças de ia/ não exportam valor nenhum — a catraca ficou sem alvo');
  // Não-vácua em sleep/: as peças da Saúde estão no conjunto, e a entrada não.
  assert.ok(
    nomes.has('casoDaSaude') && nomes.has('templateDaSaude'),
    'os nomes de sleep/caso e sleep/leitura não entraram no conjunto de peças — a catraca não vê a Saúde do sono',
  );
  // A liberação da bancada não pode ser desculpa guardada: cada nome dela é usado
  // mesmo em `scripts/`. Nome que ninguém usa sai da lista — senão ela vira porta
  // aberta para o próximo que passar por aqui. Sem guarda de `length`: o alvo já é
  // cobrado na barreira do `.from()`, e uma conferência que se pula a si mesma
  // quando o diretório muda de nome não é invariante.
  const fontesDaBancada = scriptFiles.map((f) => semComentario(readFileSync(f, 'utf8')));
  assert.ok(fontesDaBancada.length > 0, 'scripts/ sumiu — a liberação da bancada ficou sem alvo');
  for (const n of LIVRES_NA_BANCADA) {
    assert.ok(
      nomes.has(n),
      `LIVRES_NA_BANCADA libera ${n}, que não é peça — ou ele saiu de sleep/ e ia/, ou o nome está errado.`,
    );
    assert.ok(
      fontesDaBancada.some((src) => new RegExp(`\\b${n}\\b`).test(src)),
      `LIVRES_NA_BANCADA libera ${n} e nenhum arquivo de scripts/ o usa — tire-o da lista.`,
    );
  }

  const ehDescritor = (nome: string) => /^descritor/i.test(nome);
  // O import profundo, com ou sem extensão: `.ts`, `.tsx`, e as que o bundler
  // resolve para o mesmo fonte (`.js`, `.mjs`, `.cjs`, `.jsx`, `.mts`, `.cts`).
  const PECA_PROFUNDA = /(?:^|\/)(?:@vitale\/shared|packages\/shared)(?:\/src)?\/ia\/(.+?)(?:\.[mc]?[jt]sx?)?$/;
  const PECA_PROFUNDA_DE_SONO = /(?:^|\/)(?:@vitale\/shared|packages\/shared)(?:\/src)?\/sleep\/(.+?)(?:\.[mc]?[jt]sx?)?$/;
  /** A peça de `sleep/` que um specifier profundo alcança, ou null. */
  const pecaDeSono = (spec: string): string | null => {
    const m = PECA_PROFUNDA_DE_SONO.exec(spec);
    return m && pecasDeSono.has(m[1]) ? m[1] : null;
  };
  // Não-vácua nos casadores: a extensão não esconde a peça, e a porta segue livre.
  for (const ext of ['', '.ts', '.tsx', '.js', '.mjs', '.cjs']) {
    assert.equal(pecaDeSono(`@vitale/shared/src/sleep/leitura${ext}`), 'leitura', `sleep/leitura${ext}`);
    assert.equal(pecaDeSono(`../../packages/shared/src/sleep/caso${ext}`), 'caso', `sleep/caso${ext}`);
    assert.equal(PECA_PROFUNDA.exec(`@vitale/shared/src/ia/interpolar${ext}`)?.[1], 'interpolar', `ia/interpolar${ext}`);
  }
  assert.equal(pecaDeSono('@vitale/shared/src/sleep/ranges.js'), null, 'sleep/ranges não é peça');
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

  /** As peças de IA que um arquivo importa — vazio quando só alcança a porta, os descritores e o que é livre. */
  const pecasImportadas = (f: string, daBancada: boolean): string[] => {
    const src = semComentario(readFileSync(f, 'utf8'));
    const achados = new Set<string>();
    // A bancada nomeia o caso; as telas, não. Fora disso, as regras são as mesmas.
    const livre = (n: string): boolean => LIVRES_DE_SONO.has(n) || (daBancada && LIVRES_NA_BANCADA.has(n));
    for (const m of src.matchAll(IMPORTACAO)) {
      if (m[2]) continue;                                   // import type / export type
      const spec = m[5];
      const valor = deValor(m[3]);
      if (spec === '@vitale/shared') {
        // Pelo barril: só conta o que é peça de ia/. `* as X` do barril inteiro
        // alcança as peças todas — conta também.
        // O `&& !livre(n)` não afrouxa nada para web/mobile: os nomes de
        // `LIVRES_DE_SONO` já saíram de `nomes` acima, e `LIVRES_NA_BANCADA` só vale
        // para arquivo de `scripts/` (ver `livre`). Para um app, a condição é a mesma.
        for (const n of valor) if ((nomes.has(n) && !livre(n)) || n.startsWith('*')) achados.add(n);
        continue;
      }
      const peca = PECA_PROFUNDA.exec(spec);
      if (peca && !PORTA_DE_IA.has(peca[1])) for (const n of valor) achados.add(`${n} de ia/${peca[1]}`);
      const sono = pecaDeSono(spec);
      if (sono) for (const n of valor) if (!livre(n)) achados.add(`${n} de sleep/${sono}`);
    }
    for (const m of src.matchAll(DINAMICA)) {
      const peca = PECA_PROFUNDA.exec(m[2]);
      if (peca && !PORTA_DE_IA.has(peca[1])) achados.add(`import() de ia/${peca[1]}`);
      const sono = pecaDeSono(m[2]);
      if (sono) achados.add(`import() de sleep/${sono}`);
    }
    return [...achados];
  };

  /** Os arquivos, fora de teste, que importam peça — com o que importam. */
  const varrer = (arquivos: readonly string[], daBancada: ReadonlySet<string>): string[] =>
    arquivos
      .filter((f) => !ehTeste(f))
      .flatMap((f) => {
        const achados = pecasImportadas(f, daBancada.has(f));
        return achados.length > 0 ? [`${relativoARaiz(f)} (${achados.join(', ')})`] : [];
      })
      .sort();

  const exigirNenhuma = (fora: readonly string[]): void => {
    assert.deepEqual(
      fora,
      [],
      `peça do núcleo de IA importada fora dele em ${fora.length} arquivos:\n    ${fora.join('\n    ')}\n` +
        `  O hospedeiro chama o orquestrador (ler) — ou a sequência da impressão (imprimir) — com o descritor ` +
        `do recurso; montar o pedido, interpretar e conferir são do descritor, dentro do núcleo (AD-2).`,
    );
  };

  // Não-vácua nos nomes: a sequência da impressão é porta, a regra de edição saiu
  // de ia/, e as peças que a 1.10 tirou do app continuam no conjunto.
  assert.ok(nomes.has('montarPacotes') && nomes.has('verificarTexto'), 'as peças de ia/pacote e ia/verificar sumiram do conjunto');
  assert.ok(!nomes.has('imprimir'), '`imprimir` contou como peça — ia/imprimir tem de estar em PORTA_DE_IA');
  assert.ok(
    !nomes.has('criarMotorDoAparelho'),
    '`criarMotorDoAparelho` contou como peça — ia/aparelho tem de estar em PORTA_DE_IA, como ia/nuvem',
  );
  assert.ok(!nomes.has('periodoFechado'), '`periodoFechado` voltou para ia/ — ele mora em period/fechado.ts');
  assert.ok(
    nomes.has('imprimirCom'),
    '`imprimirCom` não contou como peça — ia/imprimir-sequencia não pode estar em PORTA_DE_IA: ela aceita descritor',
  );

  // O caso-espelho: arquivos de verdade num diretório temporário, pelo mesmo
  // `varrer` e pelo mesmo veredito que a barreira usa sobre o repositório.
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-pecas-'));
  try {
    const casos: readonly (readonly [string, string, boolean, readonly string[]])[] = [
      ['barril.ts', "import { montarPacotes, imprimir } from '@vitale/shared';", false, ['montarPacotes']],
      ['profundo.ts', "import { montarPrompt } from '@vitale/shared/src/ia/prompt';", false, ['montarPrompt de ia/prompt']],
      ['dinamico.ts', "export const p = import('../../packages/shared/src/ia/verificar.ts');", false, ['import() de ia/verificar']],
      ['namespace.ts', "import * as nucleo from '@vitale/shared';", false, ['* (o módulo inteiro)']],
      ['caso-na-tela.ts', "import { casoDaSaude } from '@vitale/shared';", false, ['casoDaSaude']],
      ['caso-na-bancada.ts', "import { casoDaSaude } from '@vitale/shared';", true, []],
      [
        'sequencia-profunda.ts',
        "import { imprimirCom } from '@vitale/shared/src/ia/imprimir-sequencia';",
        false,
        ['imprimirCom de ia/imprimir-sequencia'],
      ],
      [
        'porta.ts',
        "import { imprimir, ler, resolverCadeia, descritorDaRetrospectiva, entradaDaSaude, periodoFechado } from '@vitale/shared';\n"
          + "import { imprimir as i } from '@vitale/shared/src/ia/imprimir';",
        false,
        [],
      ],
      ['tipo.ts', "import type { PacoteDeFatos } from '@vitale/shared';\nimport { type Problema } from '@vitale/shared';", false, []],
      ['comentario.ts', "// import { montarPacotes } from '@vitale/shared';\nexport const x = 1;", false, []],
    ];
    const ofensores: string[] = [];
    for (const [nome, fonte, bancada, esperado] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      const achado = varrer([arquivo], new Set(bancada ? [arquivo] : []));
      assert.deepEqual(
        achado,
        esperado.length > 0 ? [`${relativoARaiz(arquivo)} (${esperado.join(', ')})`] : [],
        `a guarda (7) leu errado o caso-espelho ${nome}`,
      );
      if (esperado.length > 0) ofensores.push(arquivo);
    }
    // E o veredito reprova o que o detector achou — a barreira vê.
    assert.throws(() => exigirNenhuma(varrer(ofensores, new Set())), /peça do núcleo de IA importada fora dele/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  exigirNenhuma(varrer([...mobileFiles, ...webFiles, ...scriptFiles], new Set(scriptFiles)));
});

/**
 * CATRACA — a fórmula do período da Saúde do sono tem um dono: `entradaDaSaude` (AD-11, story 5.3).
 *
 * `entradaDaSaude` é a entrada pura que a tela e a bancada compartilham: a mesma
 * janela, as mesmas noites esperadas, o mesmo histórico. Enquanto uma tela monta
 * essa fórmula à mão — `rangeBounds` + `rangeNights` + `periodScore`, na ordem
 * certa, com o histórico cortado antes da janela —, ela **pode** divergir da
 * bancada sem ninguém ver: é a mesma contagem escrita duas vezes.
 *
 * E a divergência não era hipotética: a fórmula do período rodando no alcance
 * `ultima` contava **cinco** dimensões sobre uma noite só, e dispersão de um ponto
 * é sempre zero — a tela mostrava "horário ± 0 min" com os dois traços cheios. A
 * entrada usa `nightScore` nesse alcance, com quatro dimensões.
 *
 * Teto e histórico:
 *   2 (5.3) — as duas telas de `/sono/saude`, que nasceram antes da entrada.
 *   1 (5.5) — a tela do **mobile** passou a chamar `entradaDaSaude`. Sobra a da
 *             web, congelada nesta story; quem zera é quem trocá-la.
 */
const TETO_DA_FORMULA_DO_PERIODO = 1;

check(`CATRACA — a fórmula do período da Saúde só em entradaDaSaude (teto ${TETO_DA_FORMULA_DO_PERIODO})`, () => {
  const CHAMADAS = /\b(periodScore|rangeNights|rangeBounds)\s*\(/g;
  const fora: string[] = [];
  for (const f of [...mobileFiles, ...webFiles].filter((x) => !ehTeste(x))) {
    const chamadas = new Set([...semComentario(readFileSync(f, 'utf8')).matchAll(CHAMADAS)].map((m) => m[1]));
    if (chamadas.size > 0) fora.push(`${f.replace(ROOT + '/', '')} (${[...chamadas].sort().join(', ')})`);
  }
  fora.sort();
  // Não-vácua: o detector acha a fórmula onde ela está. Se ninguém mais a montar,
  // o teto desce — e quem o leva a zero é quem trocar a tela da web.
  assert.ok(fora.length > 0, 'ninguém fora do núcleo monta a fórmula do período — baixe o teto para zero');
  if (fora.length < TETO_DA_FORMULA_DO_PERIODO) {
    console.log(`     ↓ a fórmula do período fora do núcleo caiu para ${fora.length} (teto ${TETO_DA_FORMULA_DO_PERIODO}) — baixe o teto`);
  }
  assert.ok(
    fora.length <= TETO_DA_FORMULA_DO_PERIODO,
    `a fórmula do período montada fora do núcleo em ${fora.length} arquivos (teto ${TETO_DA_FORMULA_DO_PERIODO}):\n    ` +
      `${fora.join('\n    ')}\n` +
      `  Quem precisa da contagem de um período chama entradaDaSaude(noites, notas, { range, offset, hoje }) — ` +
      `uma fórmula só para a tela e para a bancada (AD-11).`,
  );
});

/**
 * A sequência do descritor, chamada por hospedeiro — o que as duas guardas abaixo
 * medem (AD-2, story 5.5).
 *
 * O descritor de um recurso declara seis funções puras, e **só o orquestrador as
 * percorre**: pedido → motor → interpretação → conferência → frase, com o piso
 * quando ninguém escreve. Um hospedeiro que chama qualquer uma delas está abrindo
 * a segunda sequência — e a segunda sequência não erra no dia em que é escrita,
 * erra seis meses depois, quando uma das duas ganha uma regra e a outra não.
 *
 * A guarda (7) acima já barra **importar** as peças do núcleo de IA. Esta é a
 * outra metade: o descritor é legitimamente importável (todo nome `descritor*` é
 * livre, porque é o primeiro argumento do `ler`), então o que sobra para trancar é
 * chamar os métodos dele.
 *
 * Duas guardas e não uma, porque o passivo é de um método só:
 *
 *  - **barreira (zero)** para as cinco que sequenciam — `interpretar`, `conferir`,
 *    `montarFrase`, `semModelo` e `pedidoCurto`. Nenhum hospedeiro as chama hoje, e
 *    nenhum pode passar a chamar: é aqui que a conferência e a frase moram.
 *  - **catraca (teto 1)** para `montarPedido`, que tem um ofensor herdado: a
 *    bancada (`scripts/bancada/medir.ts`) o chama para ter o **corpo** do pedido no
 *    relatório — o `sistema` e o `usuario` que o dono lê, e o hash da coluna do
 *    template, que o `Medicao` do modo `medicao` não devolve. Ele não sequencia
 *    nada: não interpreta, não confere e não escreve frase. Quem fizer o `Medicao`
 *    carregar o pedido do template baixa o teto a zero e esta guarda vira barreira.
 */
const METODOS_QUE_SEQUENCIAM = ['interpretar', 'conferir', 'montarFrase', 'semModelo', 'pedidoCurto'];

/**
 * O único ofensor herdado, **nomeado**. Afirmar só o teto deixaria a catraca verde
 * com a ofensa mudando de lugar: a bancada deixa de chamar, uma tela começa, e o
 * número continua 1. Quando o `Medicao` do template passar a carregar o pedido, esta
 * linha some e a guarda vira barreira.
 */
const OFENSOR_DO_MONTAR_PEDIDO = 'scripts/bancada/medir.ts (montarPedido)';

/**
 * Os hospedeiros: os dois apps, os scripts e **a edge function**, fora de teste.
 *
 * A function entra porque ela é hospedeiro — o mesmo arquivo já a varre em outras
 * guardas — e porque é onde a 5.6 vai morar: o dia em que ela aprender o fio é o dia
 * em que alguém pode ser tentado a conferir a resposta lá dentro.
 */
function hospedeiros(): string[] {
  return [...mobileFiles, ...webFiles, ...scriptFiles, ...walk(join(ROOT, 'supabase', 'functions'))].filter(
    (f) => !ehTeste(f),
  );
}

/**
 * Os arquivos que alcançam algum destes membros, com os nomes achados.
 *
 * **Pela AST, não por regex**, e é o que fecha as duas rotas de evasão que um
 * casador com ponto deixava passar: `d['montarFrase'](…)` (acesso por colchete) e
 * `const { conferir } = d` (desestruturação, que tira o método do objeto e o chama
 * depois sem ponto nenhum). De graça, a AST também ignora comentário — então o texto
 * que *explica* a regra não a viola, sem precisar de `semComentario`.
 *
 * Qualquer **leitura** do membro conta, não só a chamada: `const f = d.montarFrase`
 * seguido de `f(v, e)` é a mesma sequência com um passo a mais. `import { … }` não
 * conta, porque na AST ele não é desestruturação — e nenhum destes nomes é exportado
 * por módulo nenhum.
 */
function chamamMetodo(metodos: readonly string[], arquivos: readonly string[] = hospedeiros()): string[] {
  const alvo = new Set(metodos);
  const fora: string[] = [];
  for (const f of arquivos) {
    const src = readFileSync(f, 'utf8');
    // Pré-filtro textual: a maioria dos arquivos não cita nome nenhum, e parsear
    // todos custaria segundos por guarda.
    if (!metodos.some((m) => src.includes(m))) continue;

    const achados = new Set<string>();
    const visitar = (no: ts.Node): void => {
      if (ts.isPropertyAccessExpression(no) && alvo.has(no.name.text)) achados.add(no.name.text);
      if (ts.isElementAccessExpression(no)) {
        const arg = no.argumentExpression;
        if ((ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) && alvo.has(arg.text)) {
          achados.add(arg.text);
        }
      }
      if (ts.isObjectBindingPattern(no)) {
        for (const elemento of no.elements) {
          const nome = elemento.propertyName ?? elemento.name;
          if ((ts.isIdentifier(nome) || ts.isStringLiteral(nome)) && alvo.has(nome.text)) achados.add(nome.text);
          // `const { ['conferir']: c } = d` — a chave computada de literal é o mesmo membro.
          if (ts.isComputedPropertyName(nome)) {
            const chave = desembrulhar(nome.expression);
            if (ts.isStringLiteralLike(chave) && alvo.has(chave.text)) achados.add(chave.text);
          }
        }
      }
      ts.forEachChild(no, visitar);
    };
    visitar(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, false));
    if (achados.size > 0) fora.push(`${relativoARaiz(f)} (${[...achados].sort().join(', ')})`);
  }
  return fora.sort();
}

/**
 * A prova de que o detector vê — **pelo caminho real**, não por um casador irmão.
 *
 * Um auto-teste que compilasse o seu próprio `RegExp` passaria verde enquanto o
 * detector de verdade estivesse quebrado. Aqui o fixture vai para um arquivo de
 * verdade, fora do repositório, e passa pelo mesmo `chamamMetodo` que as duas guardas
 * chamam — inclusive pelas duas rotas de evasão e pelo comentário que não conta.
 */
function provarODetector(): void {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-descritor-'));
  try {
    const casos: readonly (readonly [string, string, readonly string[]])[] = [
      ['ponto.ts', 'const x = d.montarFrase(v, f);', ['montarFrase']],
      ['colchete.ts', "const x = d['montarFrase'](v, f);", ['montarFrase']],
      ['desestrutura.ts', 'const { conferir } = d; conferir(x, f);', ['conferir']],
      ['renomeia.ts', 'const { semModelo: piso } = d; piso(f);', ['semModelo']],
      ['chamada-guardada.ts', 'const f = d.pedidoCurto; if (f) f(fatos);', ['pedidoCurto']],
      ['computada.ts', "const { ['conferir']: c } = d; c(x, f);", ['conferir']],
      ['computada-template.ts', 'const { [`montarFrase`]: m } = d; m(v, f);', ['montarFrase']],
      ['comentario.ts', '// d.conferir(x) só no comentário\n/** e d.interpretar(r) também */\nexport const x = 1;', []],
      ['import.ts', "import { interpretar } from './nada';\nexport { interpretar };", []],
    ];
    for (const [nome, fonte, esperado] of casos) {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      const achado = chamamMetodo([...METODOS_QUE_SEQUENCIAM, 'montarPedido'], [arquivo]);
      if (esperado.length === 0) {
        assert.deepEqual(achado, [], `o detector acusou ${nome}, que não é ofensa`);
      } else {
        assert.deepEqual(achado, [`${relativoARaiz(arquivo)} (${[...esperado].sort().join(', ')})`], `o detector não viu ${nome}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

check('BARREIRA — interpretar, conferir, montarFrase, semModelo e pedidoCurto só no orquestrador', () => {
  assert.ok(hospedeiros().length > 0, 'os hospedeiros sumiram — a barreira ficou sem alvo');
  // Não-vácua no detector, não no passivo: esta guarda nasce em zero, então não há
  // ofensor para provar que ela vê.
  provarODetector();
  const fora = chamamMetodo(METODOS_QUE_SEQUENCIAM);
  assert.deepEqual(
    fora,
    [],
    `função do descritor alcançada fora do orquestrador em ${fora.length} arquivos:\n    ${fora.join('\n    ')}\n` +
      `  O hospedeiro chama ler(descritor, fatos, …) e desenha o resultado. Interpretar, conferir, ` +
      `escrever a frase e cair no piso são do descritor, percorridos só pelo orquestrador (AD-2).`,
  );
});

check('CATRACA — montarPedido fora do orquestrador (só a bancada)', () => {
  const fora = chamamMetodo(['montarPedido']);
  if (fora.length === 0) {
    console.log('     ↓ ninguém mais monta o pedido fora do orquestrador — apague OFENSOR_DO_MONTAR_PEDIDO');
  }
  assert.deepEqual(
    fora,
    [OFENSOR_DO_MONTAR_PEDIDO],
    `montarPedido alcançado fora do orquestrador por quem não é a bancada:\n    ${fora.join('\n    ')}\n` +
      `  O único ofensor permitido é ${OFENSOR_DO_MONTAR_PEDIDO}, que precisa do CORPO do pedido ` +
      `para o relatório do dono. Quem precisa só da identidade do pedido tem o hash no anel ` +
      `(EventoDoAnel.hash) e no Medicao. Montá-lo por conta própria é a segunda sequência que a AD-2 ` +
      `proíbe. Se a lista ficou vazia, a guarda virou barreira: apague a constante e o deepEqual.`,
  );
});

/**
 * BARREIRA — só a sequência grava a edição (Story 1.10, AD-4, AD-13).
 *
 * "Verifica antes de gravar" deixou de ser comentário quando a escrita virou
 * porta: a única linha que chega a `gravar` é a leitura de um motor aprovada pela
 * conferência, e quem monta essa carga é a sequência (`imprimirCom`, em
 * `ia/imprimir-sequencia.ts`, que `imprimir` chama com o descritor fixo). A
 * barreira tranca os três atalhos que contornariam isso:
 *
 *  1. **`edicao_imprimir` só em `data/edicoes-ia.ts`.** É a porta de gravação
 *     (`portasDaEdicao`), e mais ninguém nomeia a função — nem hospedeiro, nem
 *     outro módulo do núcleo.
 *  2. **Nenhuma escrita direta em `edicoes_ia`.** `.upsert`, `.insert`, `.update`
 *     ou `.delete` encadeados num `.from('edicoes_ia')`, em qualquer lugar. Era o
 *     `upsertEdicao` da 1.9: gravava um caderno por vez, contornando a função e a
 *     contiguidade das posições.
 *  3. **`.gravar` só é lido em `ia/imprimir-sequencia.ts`.** A AC do épico mandava restringir
 *     quem importa `upsertEdicao`; a sequência não pode importar `data/` (o fecho
 *     do núcleo de IA recusa o SDK), e a escrita virou porta devolvida por
 *     `portasDaEdicao`. Quem lê `.gravar` é quem grava — por AST, então colchete e
 *     desestruturação — inclusive com chave computada — não escapam (o mesmo
 *     `chamamMetodo` da AD-2).
 *
 * Varre o núcleo e os hospedeiros (`mobile/src`, `web/src`, `scripts/` e
 * `supabase/functions`), fora de teste. O código é lido pela árvore do
 * TypeScript: comentário que cita a função não conta.
 *
 * **O que ela não vê:** o nome montado em partes (`'edicao_' + 'imprimir'`, um
 * template com interpolação); a tabela guardada numa variável antes do `.from`
 * (`const t = 'edicoes_ia'; db.from(t).upsert()`), e a cadeia partida por uma
 * variável (`const q = db.from('edicoes_ia'); q.upsert()`); o SQL cru fora de
 * TypeScript. A rede contra os dois últimos é a outra barreira: fora do núcleo
 * não há `.from()` nenhum, e dentro dele a tabela tem um dono só.
 */
const DONO_DA_GRAVACAO = 'packages/shared/src/data/edicoes-ia.ts';
const DONO_DA_SEQUENCIA = 'packages/shared/src/ia/imprimir-sequencia.ts';
const DONO_DA_CAPA = 'packages/shared/src/data/edicoes-capa.ts';
const ESCRITAS_DIRETAS = new Set(['upsert', 'insert', 'update', 'delete']);

/** O núcleo e os hospedeiros, fora de teste. */
function nucleoEHospedeiros(): string[] {
  return [...walk(SHARED_SRC).filter((f) => !ehTeste(f)), ...hospedeiros()];
}

/**
 * Os arquivos cujo **código** cita `texto` — num identificador, numa string ou
 * num pedaço de template. Comentário não é código, e a árvore sintática já o
 * deixa de fora.
 */
function citamNoCodigo(texto: string, arquivos: readonly string[], raiz: string = ROOT): string[] {
  const fora: string[] = [];
  for (const f of arquivos) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes(texto)) continue;
    let achou = false;
    const visitar = (no: ts.Node): void => {
      if (achou) return;
      const temTexto = ts.isIdentifier(no) || ts.isPrivateIdentifier(no) || ts.isStringLiteralLike(no)
        || ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no);
      if (temTexto && no.text.includes(texto)) {
        achou = true;
        return;
      }
      ts.forEachChild(no, visitar);
    };
    visitar(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, false));
    if (achou) fora.push(relativoARaiz(f, raiz));
  }
  return fora.sort();
}

/** Os arquivos que encadeiam uma escrita direta num `.from('<tabela>')`, com os métodos achados. */
function escrevemNaTabela(tabela: string, arquivos: readonly string[]): string[] {
  const membro = (n: ts.Node): string | null => {
    if (ts.isPropertyAccessExpression(n)) return n.name.text;
    if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression)) return n.argumentExpression.text;
    return null;
  };
  // O que só embrulha a expressão sem sair da cadeia: `(x as T)`, `x!`, `x satisfies T`.
  const embrulho = (n: ts.Node): boolean =>
    ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)
    || ts.isSatisfiesExpression(n) || ts.isTypeAssertionExpression(n);
  const fora: string[] = [];
  for (const f of arquivos) {
    const src = readFileSync(f, 'utf8');
    if (!src.includes(tabela)) continue;
    const achados = new Set<string>();
    const visitar = (no: ts.Node): void => {
      if (ts.isCallExpression(no) && membro(no.expression) === 'from' && no.arguments.length > 0) {
        const arg = desembrulhar(no.arguments[0]);
        if (ts.isStringLiteralLike(arg) && arg.text === tabela) {
          let elo: ts.Node = no;
          while (elo.parent) {
            const pai: ts.Node = elo.parent;
            const noMembro = (ts.isPropertyAccessExpression(pai) || ts.isElementAccessExpression(pai)) && pai.expression === elo;
            const naChamada = ts.isCallExpression(pai) && pai.expression === elo;
            if (!noMembro && !naChamada && !embrulho(pai)) break;
            const nome = noMembro ? membro(pai) : null;
            if (nome !== null && ESCRITAS_DIRETAS.has(nome)) achados.add(nome);
            elo = pai;
          }
        }
      }
      ts.forEachChild(no, visitar);
    };
    visitar(ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true));
    if (achados.size > 0) fora.push(`${relativoARaiz(f)} (${[...achados].sort().join(', ')})`);
  }
  return fora.sort();
}

/**
 * O caso-espelho das três metades — arquivos de verdade num diretório
 * temporário, pelos mesmos detectores que a barreira chama sobre o repositório.
 */
function provarAGravacaoUnica(): void {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-gravacao-'));
  try {
    const escrever = (nome: string, fonte: string): string => {
      const arquivo = join(dir, nome);
      writeFileSync(arquivo, `${fonte}\n`);
      return arquivo;
    };
    const rel = (arquivo: string) => relativoARaiz(arquivo);

    // 1. a função nomeada
    const rpc = escrever('rpc.ts', "export const f = (db: any) => db.rpc('edicao_imprimir', {});");
    const template = escrever('template.ts', 'export const f = (db: any) => db.rpc(`edicao_imprimir`, {});');
    const nomeComentado = escrever('comentario.ts', "// db.rpc('edicao_imprimir')\n/** edicao_imprimir */\nexport const x = 1;");
    assert.deepEqual(citamNoCodigo('edicao_imprimir', [rpc, template, nomeComentado]), [rel(rpc), rel(template)].sort());

    // 2. a escrita direta
    const casos: readonly (readonly [string, string, readonly string[]])[] = [
      ['upsert.ts', "export const f = (db: any) => db.from('edicoes_ia').upsert({}).select();", ['upsert']],
      ['delete.ts', "export const f = async (db: any) => { await db.from(\"edicoes_ia\").delete().eq('a', 1); };", ['delete']],
      ['colchete.ts', "export const f = (db: any) => (db.from('edicoes_ia') as any)['insert']({});", ['insert']],
      ['opcional.ts', "export const f = (db: any) => db?.from('edicoes_ia')?.update({})!.eq('x', 1);", ['update']],
      ['leitura.ts', "export const f = (db: any) => db.from('edicoes_ia').select('*').eq('a', 1).order('posicao');", []],
      ['outra-tabela.ts', "export const f = (db: any) => db.from('edicoes_capa').upsert({});", []],
      ['so-comentario.ts', "// db.from('edicoes_ia').upsert({})\nexport const x = 1;", []],
    ];
    for (const [nome, fonte, esperado] of casos) {
      const arquivo = escrever(nome, fonte);
      assert.deepEqual(
        escrevemNaTabela('edicoes_ia', [arquivo]),
        esperado.length > 0 ? [`${rel(arquivo)} (${esperado.join(', ')})`] : [],
        `a barreira da escrita direta leu errado ${nome}`,
      );
    }

    // 3. `.gravar` lido
    const leituras: readonly (readonly [string, string, boolean])[] = [
      ['gravar-ponto.ts', 'export const f = (p: any, i: any) => p.gravar(i);', true],
      ['gravar-colchete.ts', "export const f = (p: any, i: any) => p['gravar'](i);", true],
      ['gravar-desestrutura.ts', 'export const f = (p: any, i: any) => { const { gravar } = p; return gravar(i); };', true],
      ['gravar-computada.ts', "export const f = (p: any, i: any) => { const { ['gravar']: g } = p; return g(i); };", true],
      ['gravar-define.ts', 'export const portas = { gravar: async () => 1 };\nexport const g = (x: any) => x.gravarPreferencia();', false],
    ];
    for (const [nome, fonte, ofende] of leituras) {
      const arquivo = escrever(nome, fonte);
      assert.deepEqual(chamamMetodo(['gravar'], [arquivo]), ofende ? [`${rel(arquivo)} (gravar)`] : [], nome);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

check('BARREIRA — só a sequência grava a edição: edicao_imprimir no dono, nenhuma escrita direta, .gravar só em ia/imprimir-sequencia', () => {
  provarAGravacaoUnica();
  const alvos = nucleoEHospedeiros();
  assert.ok(mobileFiles.length > 0 && scriptFiles.length > 0, 'os hospedeiros sumiram — a barreira ficou sem alvo');

  // 1. Não-vácua: o dono é achado nomeando a função.
  const nomeiam = citamNoCodigo('edicao_imprimir', alvos);
  assert.ok(
    nomeiam.includes(DONO_DA_GRAVACAO),
    `${DONO_DA_GRAVACAO} não nomeia mais edicao_imprimir — a barreira ficou sem o dono. Se a gravação mudou de ` +
      'arquivo, aponte DONO_DA_GRAVACAO para ele.',
  );
  const foraDoDono = nomeiam.filter((f) => f !== DONO_DA_GRAVACAO);
  assert.deepEqual(
    foraDoDono,
    [],
    `edicao_imprimir nomeada fora da porta de gravação: ${foraDoDono.join(', ')}. Quem grava a edição chama ` +
      'imprimir (@vitale/shared) com portasDaEdicao(db, uid) — a função do banco tem um chamador só.',
  );

  // 2. Nenhuma escrita direta.
  const diretas = escrevemNaTabela('edicoes_ia', alvos);
  assert.deepEqual(
    diretas,
    [],
    `escrita direta em edicoes_ia: ${diretas.join(', ')}. A edição se grava pela função edicao_imprimir, com o ` +
      'conjunto inteiro — caderno a caderno, a posição sai de um conjunto ainda em crescimento (AD-4).',
  );

  // 3. Não-vácua: a sequência é achada lendo `.gravar`.
  const leem = chamamMetodo(['gravar'], alvos);
  const daSequencia = `${DONO_DA_SEQUENCIA} (gravar)`;
  assert.ok(
    leem.includes(daSequencia),
    `${DONO_DA_SEQUENCIA} não lê mais .gravar — a barreira ficou sem o dono. Se a sequência mudou de arquivo, ` +
      'aponte DONO_DA_SEQUENCIA para ele.',
  );
  const foraDaSequencia = leem.filter((x) => x !== daSequencia);
  assert.deepEqual(
    foraDaSequencia,
    [],
    `.gravar lido fora da sequência da impressão: ${foraDaSequencia.join(', ')}. Só imprimir chama a porta de ` +
      'gravação, e no máximo uma vez: é ela que garante que só leitura de motor, conferida, vira linha.',
  );
});

/**
 * BARREIRA — só `gravarCapa` escreve a capa (Story 1.13, AD-3, AD-4).
 *
 * A irmã da barreira acima, para a outra tabela da edição, e pelo mesmo motivo: a
 * capa é o que **congela** o período — natureza, identidade e a legenda já
 * formatada —, e um segundo escritor é um segundo jeito de a edição que ele leu em
 * agosto ter outra cara em outubro.
 *
 * Aqui não há função de banco a proteger: `edicoes_capa` se grava por `upsert`
 * direto, e a barreira é sobre **onde** esse upsert pode existir. `gravarCapa` é o
 * que carrega a guarda de sessão (a conta não pode trocar no meio da impressão) e
 * o `carimbada_em` escrito à mão (o `default now()` não vale no caminho de
 * atualização). Um upsert escrito noutro arquivo perderia os dois, calado.
 *
 * Mesma leitura por AST de `escrevemNaTabela`: colchete, `as`, `!` e cadeia
 * partida por parênteses não escapam; comentário não conta. **O que ela não vê** é
 * o mesmo da barreira irmã, e a rede é a mesma: fora do núcleo não há `.from()`
 * nenhum, e dentro dele a tabela tem um dono só.
 */
check('BARREIRA — só gravarCapa escreve edicoes_capa', () => {
  const escrevem = escrevemNaTabela('edicoes_capa', nucleoEHospedeiros());
  const doDono = `${DONO_DA_CAPA} (upsert)`;
  // Não-vácua: o dono é achado escrevendo. Sem isto, apagar `gravarCapa` deixaria
  // a barreira verde por não haver ninguém a acusar.
  assert.ok(
    escrevem.includes(doDono),
    `${DONO_DA_CAPA} não escreve mais em edicoes_capa — a barreira ficou sem o dono. Se o carimbo mudou de `
      + 'arquivo, aponte DONO_DA_CAPA para ele.',
  );
  const fora = escrevem.filter((x) => x !== doDono);
  assert.deepEqual(
    fora,
    [],
    `escrita em edicoes_capa fora do carimbo: ${fora.join(', ')}. A capa se grava por gravarCapa (data/`
      + 'edicoes-capa.ts), que confere a sessão antes e carimba a hora à mão — um upsert escrito noutro lugar '
      + 'perde os dois e congela a capa errada no período fechado.',
  );
});

/**
 * BARREIRA — a coluna `agg_version_no_momento` só é nomeada, em código, na porta de gravação (Story 1.10, AD-16).
 *
 * A barreira do dono único de `AGG_VERSION`, lá em cima, olha quem **declara** a
 * constante e não olha chamador nenhum: um hospedeiro que montasse a carga do RPC
 * com `PACOTE_VERSAO` (mesmo tipo, mesmo barril) na coluna passava por ela intacto.
 * Esta fecha o outro lado — o nome da coluna só aparece em código de **um**
 * arquivo, `data/edicoes-ia.ts`, onde a porta de gravação a carimba da constante e
 * a linha lida a mapeia. A linha que a sequência entrega não tem o campo, então o
 * valor não tem por onde vir de fora. E a liberação é o arquivo, não a pasta: outro
 * módulo de `data/` que nomeasse a coluna poderia carimbar outro valor.
 *
 * Mede **menção**, não escrita: qualquer identificador, string ou pedaço de
 * template com o nome, fora de teste, no núcleo e nos hospedeiros, pela árvore
 * sintática (o comentário que explica a regra não conta). **Não vê** o nome
 * montado em partes.
 */
function foraDaPortaDeGravacao(citam: readonly string[]): string[] {
  return citam.filter((f) => f !== DONO_DA_GRAVACAO);
}

function provarACarimbagem(): void {
  const raiz = mkdtempSync(join(tmpdir(), 'orbe-guarda-agg-'));
  try {
    const escrever = (rel: string, fonte: string): string => {
      const arquivo = join(raiz, ...rel.split('/'));
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, `${fonte}\n`);
      return arquivo;
    };
    // As formas que o detector vê, e as que não são menção.
    const casos: readonly (readonly [string, string, boolean])[] = [
      ['mobile/src/carga.ts', 'export const carga = { agg_version_no_momento: 3 };', true],
      ['mobile/src/chave.ts', "export const k = 'agg_version_no_momento';", true],
      ['mobile/src/colchete.ts', "export const f = (l: any) => { l['agg_version_no_momento'] = 7; };", true],
      ['mobile/src/comentario.ts', '// agg_version_no_momento vem do núcleo\nexport const x = 1;', false],
      ['mobile/src/camelo.ts', 'export const x = { aggVersionNoMomento: 1 };', false],
    ];
    const arquivos: string[] = [];
    for (const [rel, fonte, ofende] of casos) {
      const arquivo = escrever(rel, fonte);
      arquivos.push(arquivo);
      assert.deepEqual(citamNoCodigo('agg_version_no_momento', [arquivo], raiz), ofende ? [rel] : [], rel);
    }
    // O dono passa; outro arquivo de `data/` reprova — a liberação é o arquivo, não a pasta.
    arquivos.push(escrever(DONO_DA_GRAVACAO, 'export const carga = { agg_version_no_momento: 9 };'));
    arquivos.push(escrever('packages/shared/src/data/outro.ts', 'export const carga = { agg_version_no_momento: 1 };'));
    assert.deepEqual(
      foraDaPortaDeGravacao(citamNoCodigo('agg_version_no_momento', arquivos, raiz)),
      ['mobile/src/carga.ts', 'mobile/src/chave.ts', 'mobile/src/colchete.ts', 'packages/shared/src/data/outro.ts'],
      'o caso-espelho da carimbagem leu errado o dono ou os ofensores',
    );
  } finally {
    rmSync(raiz, { recursive: true, force: true });
  }
}

check('BARREIRA — agg_version_no_momento só nomeada em código de data/edicoes-ia.ts', () => {
  provarACarimbagem();
  const citam = citamNoCodigo('agg_version_no_momento', nucleoEHospedeiros());
  assert.ok(
    citam.includes(DONO_DA_GRAVACAO),
    `${DONO_DA_GRAVACAO} não nomeia mais a coluna agg_version_no_momento — a barreira ficou sem alvo.`,
  );
  const fora = foraDaPortaDeGravacao(citam);
  assert.deepEqual(
    fora,
    [],
    `agg_version_no_momento nomeada em código fora de ${DONO_DA_GRAVACAO}: ${fora.join(', ')}. A versão da ` +
      'agregação é carimbada pela porta de gravação a partir de AGG_VERSION — quem imprime não a informa, a linha ' +
      'da impressão não tem o campo, e nenhum outro módulo, nem de data/, monta a carga.',
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

/**
 * BARREIRA — o postal da semana é **acromático** (story 3.1).
 *
 * A edição pinta a faixa de cada caderno no `accent` do módulo dele (story
 * 1.12), e a rota `/revista/[tipo]/[inicio]` faz isso no mesmo arquivo em que a
 * semana agora desenha o postal. O caminho natural de quem mexer nele é
 * aproveitar o `moduleColors` que já está importado ali — e o postal **não tem
 * cadernos**: pintar os três fatos de treino-laranja e sono-vermelho inventaria
 * uma seção que não existe, e daria cor a um cartão cuja tese é justamente não
 * ter nenhuma.
 *
 * O precedente escrito é o `SleepRatingCard`: *"nenhuma cor de sono, porque o
 * bloco é legenda, não gráfico"*. O postal é legenda de uma semana inteira.
 *
 * **Duas asserções, e as duas importam.** A primeira varre o componente — é onde
 * a cor entraria. A segunda prende a rota ao componente: sem ela, alguém
 * desenharia o postal inline no arquivo da rota, onde a varredura não alcança
 * (ali `moduleColors` é legítimo, para as faixas dos cadernos), e a barreira
 * continuaria verde apontando para um arquivo que ninguém usa.
 *
 * Só papéis de tinta passam: `surface`, `ink`, `ink2`, `ink3`, `line` e vizinhos
 * de `ThemeNeutrals`. A marca (`primary`) também fica fora — ela é o cromo do
 * ato pago, e o postal não tem ato nenhum: ele não grava.
 */
check('BARREIRA — o postal da semana é acromático: nenhuma cor de módulo, de papel nem de marca', () => {
  const componente = join(ROOT, 'mobile', 'src', 'components', 'revista', 'Postal.tsx');
  assert.ok(existsSync(componente), 'mobile/src/components/revista/Postal.tsx sumiu — a guarda ficou sem alvo.');
  const src = semComentario(readFileSync(componente, 'utf8'));
  /**
   * Os caminhos **alcançáveis** até cor, e só eles.
   *
   * A primeira versão desta lista gastava duas entradas com `colors.orange` e
   * `colors.brown`, que **não são chaves** de `ResolvedTokens` (os papéis
   * `orange` e `brown` chegam por `roles`, nunca planos) — e deixava passar
   * `colors.roles.orange.accent`, que é o idioma de todo dia neste repositório.
   * Proibir o impossível e liberar o corriqueiro é o pior dos dois mundos.
   */
  const PROIBIDO = [
    { re: /\bmoduleColors\s*\(/, o: 'moduleColors()' },
    { re: /\bmoduleOf\s*\(/, o: 'moduleOf()' },
    { re: /\broleColors\s*\(/, o: 'roleColors()' },
    { re: /\bsleepColors\s*\(/, o: 'sleepColors()' },
    { re: /\bMODULO_DO_CADERNO\b/, o: 'MODULO_DO_CADERNO' },
    // `MOD[...]` e `MOD.treino` — o recorte histórico, pelos dois acessos.
    { re: /\bMOD\s*[[.]/, o: 'o recorte MOD' },
    // O quarteto de um papel pela via plana: `colors.roles.orange.accent`.
    { re: /\.\s*roles\s*[[.]/, o: 'o mapa de papéis (roles)' },
    {
      re: /\bcolors\.(primary|primaryDeep|primarySoft|primaryOutline|primaryGraphic|onPrimary|primaryOn|primaryText)\b/,
      o: 'a cor da marca',
    },
    // As oito chaves planas que existem de verdade, com os sufixos `Soft`/`On`/`Text`.
    { re: /\bcolors\.(yellow|green|rose|blue|casa|teal|red|purple)(Soft|On|Text)?\b/, o: 'um acento de paleta' },
    { re: /\bcolors\.inkOn\b/, o: 'a tinta do papel ink (que é acento, não papel de tinta)' },
    { re: /#[0-9a-fA-F]{3,8}\b/, o: 'um hex escrito à mão' },
  ];
  const achados = PROIBIDO.filter(({ re }) => re.test(src)).map(({ o }) => o);
  assert.deepEqual(
    achados,
    [],
    `Postal.tsx usa ${achados.join(', ')}. O postal é acromático em papéis de tinta: `
      + 'ele não tem cadernos, e cor de módulo ali inventaria uma seção que não existe.',
  );

  /**
   * E a **forma dos ramos**, não a presença dos nomes.
   *
   * A primeira versão só conferia que `TIPO_DO_POSTAL` e `<Postal` apareciam no
   * arquivo: trocar os dois braços do ternário deixava tudo verde, com a semana
   * voltando a desenhar a edição e o mês virando postal. Por isso aqui se lê a
   * **árvore**.
   *
   * Desde a Story 3.2 a rota se parte em **três**, e o encadeamento é um ternário
   * dentro do braço falso do outro:
   *
   * ```
   * periodo.tipo === TIPO_DO_POSTAL   ? <TelaDoPostal>
   *   : periodo.tipo === TIPO_DO_ANUARIO ? <RevistaDoAno>
   *   : <Revista>
   * ```
   *
   * Os dois ternários são cobrados juntos, na ordem em que a varredura os
   * encontra (o de fora primeiro), e o braço falso do primeiro tem de ser
   * **exatamente** o segundo ternário — `'?:'`. Sem isso, pôr o ano de volta no
   * braço do mês deixaria o ano abrindo como um mês grande, calado.
   *
   * O tipo de cada componente é a outra metade, e essa é do compilador:
   * `Revista` recebe `TipoSemAnuario` e `RevistaDoAno` recebe o literal do ano —
   * invertidos os braços, ele reprova antes desta guarda.
   */
  const rota = join(ROOT, 'mobile', 'src', 'app', 'revista', '[tipo]', '[inicio].tsx');
  assert.ok(existsSync(rota), 'a rota da revista sumiu — a guarda ficou sem alvo.');
  const bruto = readFileSync(rota, 'utf8');
  assert.ok(
    /from\s*['"][^'"]*components\/revista\/Postal['"]/.test(semComentario(bruto)),
    'a rota não importa o componente Postal — desenhado inline, o postal sai de baixo da varredura acima.',
  );
  const arvore = ts.createSourceFile(rota, bruto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  /**
   * O nome da tag de um braço do ternário — `'?:'` quando o braço é **outro**
   * ternário (o encadeamento dos três tipos), e `null` quando não é nem um nem
   * outro.
   */
  const tagDe = (no: ts.Node): string | null => {
    const jsx = ts.isParenthesizedExpression(no) ? no.expression : no;
    if (ts.isConditionalExpression(jsx)) return '?:';
    if (ts.isJsxSelfClosingElement(jsx)) return jsx.tagName.getText();
    if (ts.isJsxElement(jsx)) return jsx.openingElement.tagName.getText();
    return null;
  };
  const ramos: { tipo: string; verdadeiro: string | null; falso: string | null }[] = [];
  const varrer = (no: ts.Node): void => {
    if (
      ts.isConditionalExpression(no)
      && ts.isBinaryExpression(no.condition)
      && no.condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
      && /\.tipo$/.test(no.condition.left.getText())
      && ['TIPO_DO_POSTAL', 'TIPO_DO_ANUARIO'].includes(no.condition.right.getText())
    ) {
      ramos.push({
        tipo: no.condition.right.getText(),
        verdadeiro: tagDe(no.whenTrue),
        falso: tagDe(no.whenFalse),
      });
    }
    ts.forEachChild(no, varrer);
  };
  varrer(arvore);
  assert.deepEqual(
    ramos,
    [
      { tipo: 'TIPO_DO_POSTAL', verdadeiro: 'TelaDoPostal', falso: '?:' },
      { tipo: 'TIPO_DO_ANUARIO', verdadeiro: 'RevistaDoAno', falso: 'Revista' },
    ],
    'a rota não ramifica `TIPO_DO_POSTAL ? <TelaDoPostal> : TIPO_DO_ANUARIO ? <RevistaDoAno> : <Revista>`. '
      + 'Trocar os braços faz a semana abrir a edição, o mês virar postal ou o ano voltar a abrir como um mês grande.',
  );

  /**
   * **E as tiras do ano entram como PRIMEIRO filho do rolável** (Story 3.2).
   *
   * O ternário acima prova que o ano tem ramo próprio; ele não prova que o ramo
   * desenha alguma coisa, nem **onde**. As duas guardas se completam, e esta
   * cobre o que a outra não vê:
   *
   * - *primeiro filho*, porque a story diz "antes de qualquer texto": posto
   *   depois da capa, o ano volta a abrir por uma manchete que ele não tem;
   * - *filho direto*, e não embrulhado, porque o `onLayout` dos `Caderno` entrega
   *   `layout.y` relativo ao pai imediato — uma `View` em volta do bloco e do
   *   resto faria todas as linhas do sumário rolarem para o mesmo lugar, calada
   *   (ver `useRolagemAncorada.ts`).
   *
   * O que a prop **contém** é a outra metade, e ela mora no celular
   * (`anuario-fiacao.test.ts`, `anuario-nao-e-tocavel.test.ts`): aqui se prende o
   * lugar; lá, o conteúdo e a ausência de toque.
   */
  /**
   * Os filhos que **desenham**: fora o espaço em branco e os comentários de JSX
   * (`{/* … *\/}`), que a árvore entrega como `JsxExpression` sem expressão — é
   * por eles que o primeiro filho de verdade costuma estar em segundo lugar.
   */
  const jsxFilhos = (no: ts.JsxElement): ts.JsxChild[] => no.children.filter(
    (c) => !(ts.isJsxText(c) && c.containsOnlyTriviaWhiteSpaces)
      && !(ts.isJsxExpression(c) && c.expression === undefined),
  );
  const roláveis: string[] = [];
  const varrerRolavel = (no: ts.Node): void => {
    if (ts.isJsxElement(no) && no.openingElement.tagName.getText() === 'ScrollView') {
      const primeiro = jsxFilhos(no)[0];
      roláveis.push(
        primeiro && ts.isJsxExpression(primeiro) ? (primeiro.expression?.getText() ?? '') : (primeiro?.getText() ?? ''),
      );
    }
    ts.forEachChild(no, varrerRolavel);
  };
  varrerRolavel(arvore);
  assert.deepEqual(
    roláveis,
    // O primeiro `ScrollView` da rota é o do postal (Story 3.1), cujo único filho
    // é o próprio postal; o segundo é o da edição, e é nele que as tiras entram.
    ['<Postal periodo={rotulo} fatos={dadosProntos ? postal.fatos : null} guardados={guardados} />', 'antesDaCapa'],
    'o primeiro filho do ScrollView da edição deixou de ser `{antesDaCapa}`. As tiras do ano entram ANTES de '
      + 'qualquer texto, e como irmão direto — embrulhá-las quebra as âncoras do sumário em silêncio.',
  );
});

/**
 * BARREIRA — nenhum arquivo, fora de teste, corta frase à mão (story 1.8).
 *
 * A capa, o sumário e a parede da revista mostram a **chamada** de cada caderno,
 * e ela tem um dono: `chamadaDoTexto` (`revista/chamada.ts`), sobre a regra de
 * fim de frase que ela divide com a conferência (`format/frase.ts`). Um corte
 * escrito à mão é a segunda chamada — e o corte óbvio, `indexOf('.')`, quebra na
 * primeira frase com milhar ("1.210 fotos" vira "1."), além de discordar da
 * conferência sobre onde a frase acaba. A 1.11, a 1.13 e a 1.14 são as telas que
 * vão querer a chamada; a próxima escrita à mão tem mais chance ainda de nascer
 * num view-model do núcleo.
 *
 * **Alvos.** `mobile/src`; `web/src`, com os templates `.html` **e** os
 * `template:` em linha dos `@Component` (o texto do literal passa pelo mesmo
 * leitor do `.html`); `scripts/`, que entra nas barreiras desde que nasceu; e
 * `packages/shared` inteiro, fora os dois donos. Fora de teste — `ehTeste`, em
 * TypeScript e JavaScript.
 *
 * **Formas.**
 * - `indexOf` com string de terminador (`'.'`, `'?'`, `'!'`, `'...'`, com ou sem
 *   espaço depois);
 * - `split` com essa string;
 * - `split`, `search`, `match`, `matchAll`, `replace` e `replaceAll` com regex
 *   que tenha **ponto em classe** de caracteres (`/[.]/`, `/[.!?]/`, em qualquer
 *   ordem) ou **ponto escapado** (`/\./`, `/\.\s/`, `/^(.+?)\.(?!\d)/`) — exceto o
 *   ponto escapado **entre padrões de dígito** (`\d\.\d`, `\d+\.\d+`,
 *   `[0-9]\.[0-9]`, `\d{1,3}(?:\.\d{3})`), que é número e não frase. A regex vale
 *   por literal, por `new RegExp('\u2026')` com literal, e — em `search`, `match` e
 *   `matchAll`, que a compilam — por string;
 * - `granularity: 'sentence'` num objeto literal — o `Intl.Segmenter` por frase;
 * - import profundo de `format/frase` **fora de `packages/shared`** (`import`,
 *   `export \u2026 from`, `import()`, `require`): a regra fica interna ao núcleo por
 *   barreira, não só pelo barril.
 *
 * O `.ts`/`.tsx`/`.js` é lido pela **árvore sintática** do TypeScript — que ignora
 * comentário e literal de texto sem precisar de `semComentario` (e sem herdar o
 * defeito dele com `//` dentro de string) —; o template, por regex, com o
 * comentário HTML tirado antes.
 *
 * **O que ela não vê**, nominalmente:
 * - o ponto por escape numérico (`/\x2E/`, `'\u002E'`);
 * - o método emprestado (`String.prototype.split.call(t, '.')`);
 * - o padrão guardado em variável (`const FIM = /[.!?]/; t.split(FIM)`) e o
 *   `new RegExp` de variável;
 * - a regex que corta só em `!` ou `?` (`/[!?]/`, `/\?/`), e o corte na quebra de
 *   linha (`split('\n')[0]`, `split(/\n/)`);
 * - o corte por lookaround sem ponto (`split(/(?<=[a-z])\s+(?=[A-Z])/)`);
 * - o `Intl['Segmenter']` — ou qualquer segmentador — com a granularidade que não
 *   chega como literal (`{ granularity: g }`);
 * - o laço com `slice`/`charAt` procurando o ponto; `lastIndexOf`, `exec` e `test`;
 *   o nome do método montado (`t[\`spl${'it'}\`]`);
 * - o `template:` de um `@Component` guardado numa constante, e, em qualquer
 *   template, a chamada que o leitor por regex não reconhece como tal;
 * - quem importa `format/frase` **dentro** do núcleo, fora os donos — um terceiro
 *   módulo de `packages/shared` pode escrever um corte sobre a regra;
 * - os alvos que ela não varre: `supabase/functions`, `mobile/plugins`, os `.js`
 *   da raiz de `mobile/`, e o arquivo emitido em `dist/`, que ela não distingue de
 *   fonte se ele estiver dentro de um alvo.
 *
 * **O que ela acusa a mais**, e vai para a lista de exceção: a classe negada
 * (`[^\d.]` guarda o ponto, não corta nele) e a classe de escape de metacaractere
 * de regex (`[.*+?^${}()|[\]\\]`).
 *
 * **Exceção é por ocorrência** — arquivo, forma e trecho —, nasce com as
 * legítimas de hoje, cada uma com o motivo, e **absorve uma ocorrência só**. A
 * entrada que para de casar falha: exceção guardada para código que já saiu é
 * porta aberta para o próximo que passar por aqui. Não estreite a barreira para
 * não pegar uma legítima; ponha-a aqui.
 */
const DONOS_DA_FRASE = new Set(['packages/shared/src/revista/chamada.ts', 'packages/shared/src/format/frase.ts']);

interface CorteAMao {
  /** Relativo à raiz varrida, com `/`. */
  arquivo: string;
  forma: string;
  /** O texto da chamada, com o espaço colapsado. */
  trecho: string;
}

interface ExcecaoDeCorte extends CorteAMao {
  motivo: string;
}

const EXCECOES_DE_CORTE: readonly ExcecaoDeCorte[] = [
  {
    arquivo: 'mobile/src/app/(tabs)/index.tsx',
    forma: 'split com regex de ponto',
    trecho: 'String(raw).trim().split(/[\\s.]+/)',
    motivo: 'tira o primeiro nome de um nome de exibição ("ana.souza" vira "ana") — corta nome, não frase',
  },
  {
    arquivo: 'packages/shared/src/format/numero.ts',
    forma: 'split com string de terminador',
    trecho: "fixo.split('.')",
    motivo: 'separa a parte inteira da decimal na saída de toFixed — o ponto é o decimal do JavaScript',
  },
  {
    arquivo: 'packages/shared/src/ia/verificar.ts',
    forma: 'replace com ponto em classe',
    trecho: "s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')",
    motivo: 'escapar(): escapa os metacaracteres de regex de um termo — o ponto está na classe como caractere a escapar',
  },
  {
    arquivo: 'packages/shared/src/ia/verificar.ts',
    forma: 'replace com ponto em classe',
    trecho: "termo.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')",
    motivo: 'ocorrencias(): o mesmo escape de metacaracteres, para achar um termo como palavra',
  },
  {
    arquivo: 'mobile/src/components/sheets/QuickAddSheet.tsx',
    forma: 'replace com ponto em classe',
    trecho: "raw.replace(',', '.').replace(/[^\\d.]/g, '')",
    motivo: 'limpa o valor digitado deixando só dígitos e o ponto decimal — classe negada, o ponto é o que fica',
  },
  {
    arquivo: 'scripts/bancada/bancada.ts',
    forma: 'replace com ponto em classe',
    trecho: "geradoEm.replace(/[:.]/g, '-')",
    motivo: 'troca os dois-pontos e o ponto do carimbo ISO por hífen, no nome do arquivo do relatório',
  },
  {
    arquivo: 'packages/shared/src/bancada/medidas.ts',
    forma: 'replace com ponto em classe',
    trecho: "s.replace(/[.,;:—–]/gu, ' ')",
    motivo:
      'palavrasDaCopia() (story 5.11, na régua da bancada desde a 5.13): tira a pontuação para comparar a resposta ' +
      'com o exemplo do pedido palavra por palavra — não corta frase nenhuma, e a pontuação é justamente o que a ' +
      'regra da cópia manda ignorar',
  },
  {
    arquivo: "mobile/src/app/(tabs)/index.tsx",
    forma: "replace com ponto escapado",
    trecho: "d .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }) .replace(/\\./g, '')",
    motivo: "tira os pontos de abreviação que o toLocaleDateString põe no dia da semana (\"seg.\") — rótulo de data, não frase",
  },
  {
    arquivo: "mobile/src/app/habitos/detalhe.tsx",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "mobile/src/app/habitos/index.tsx",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "mobile/src/components/cards/HabitStepper.tsx",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "web/src/app/features/habits/components/habit-analytics-card.component.ts",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "web/src/app/features/habits/components/habit-list.component.ts",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "web/src/app/features/habits/components/habit-stepper.component.ts",
    forma: "replace com ponto escapado",
    trecho: "r.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "web/src/app/features/semana/components/habits-week-card.component.ts",
    forma: "replace com ponto escapado",
    trecho: "value.toFixed(2).replace(/\\.?0+$/, '')",
    motivo: "apara os zeros finais de um toFixed(2) (\"1.50\" vira \"1.5\", \"2.00\" vira \"2\") — o ponto é o decimal do JavaScript, não fim de frase",
  },
  {
    arquivo: "packages/shared/src/chart/axis.ts",
    forma: "replace com ponto escapado",
    trecho: "(value / scale).toFixed(digits).replace(/\\.0$/, '')",
    motivo: "tira o \".0\" de um toFixed no rótulo do eixo (\"3.0k\" vira \"3k\") — o ponto é o decimal",
  },
  {
    arquivo: "packages/shared/src/ia/verificar.ts",
    forma: "replace com ponto escapado",
    trecho: "bruto.replace(/\\./g, '')",
    motivo: "paraNumero(): tira o ponto de milhar de um número citado (\"12.345\" vira \"12345\") antes de convertê-lo — o ponto é milhar",
  },
];

const METODOS_DE_CORTE = new Set(['indexOf', 'split', 'search', 'match', 'matchAll', 'replace', 'replaceAll']);
/** Pré-filtro textual: arquivo sem nenhuma destas palavras não tem como ofender, e não é parseado. */
const PODE_CORTAR = /\b(?:indexOf|split|search|match|matchAll|replace|replaceAll|granularity|template)\b|format\/frase/;
/** String que é só terminador: `'.'`, `'?'`, `'!'`, `'...'`, `'. '`. */
const STRING_DE_TERMINADOR = /^(?:[.!?]+|\u2026)\s*$/;
/** Specifier que alcança a regra de fim de frase, com ou sem extensão. */
const FRASE_PROFUNDA = /(?:^|\/)format\/frase(?:\.[mc]?[jt]sx?)?$/;

type ArgumentoDeCorte = { tipo: 'regex'; corpo: string } | { tipo: 'string'; texto: string };

/** Um padrão de dígito logo antes do ponto escapado — `\d`, `[0-9]`, com quantificador, fechando ou abrindo grupo. */
const DIGITO_ANTES_DO_PONTO = /(?:\\d|\[0-9\]|\[\\d\])(?:[*+?]|\{\d*,?\d*\})?\??\)*(?:\((?:\?:)?)*$/;
/** Um padrão de dígito logo depois do ponto escapado — com o quantificador do próprio ponto (`\.?`) antes. */
const DIGITO_DEPOIS_DO_PONTO = /^(?:[*+?]|\{\d*,?\d*\})?\??\)*(?:\((?:\?:)?)*(?:\\d|\[0-9\]|\[\\d\])/;

/**
 * O que um padrão de regex (o corpo, sem as barras) faz com o ponto literal: se
 * ele está numa classe, e se aparece **escapado fora dela sem ser entre dígitos**.
 *
 * Todo ponto escapado é corte — `/\./`, o gêmeo de `indexOf('.')`, e
 * `/^(.+?)\.(?!\d)/`, a "primeira frase que respeita milhar" — exceto quando os
 * dois lados são padrão de dígito (`\d\.\d`, `\d+\.\d+`, `[0-9]\.[0-9]`,
 * `\d{1,3}(?:\.\d{3})`, `\d+\.?\d*`): aí é número.
 */
function pontoNoPadrao(corpo: string): { emClasse: boolean; escapado: boolean } {
  let emClasse = false;
  let escapado = false;
  let dentro = false;
  for (let i = 0; i < corpo.length; i += 1) {
    const c = corpo[i];
    if (c === '\\') {
      if (corpo[i + 1] === '.') {
        if (dentro) emClasse = true;
        else if (!(DIGITO_ANTES_DO_PONTO.test(corpo.slice(0, i)) && DIGITO_DEPOIS_DO_PONTO.test(corpo.slice(i + 2)))) {
          escapado = true;
        }
      }
      i += 1;
      continue;
    }
    if (dentro) {
      if (c === ']') dentro = false;
      else if (c === '.') emClasse = true;
    } else if (c === '[') {
      dentro = true;
    }
  }
  return { emClasse, escapado };
}

/** A forma de corte que `metodo(arg)` é, ou `null`. Um classificador só, para o código e para o template. */
function formaDoCorte(metodo: string, arg: ArgumentoDeCorte): string | null {
  if (metodo === 'indexOf') {
    return arg.tipo === 'string' && STRING_DE_TERMINADOR.test(arg.texto) ? 'indexOf com terminador' : null;
  }
  if (metodo === 'split') {
    if (arg.tipo === 'string') return STRING_DE_TERMINADOR.test(arg.texto) ? 'split com string de terminador' : null;
    const p = pontoNoPadrao(arg.corpo);
    return p.emClasse || p.escapado ? 'split com regex de ponto' : null;
  }
  if (!METODOS_DE_CORTE.has(metodo)) return null;
  // `search`, `match` e `matchAll` transformam a string em regex; `replace` a lê
  // literal, mas a string com cara de padrão é a mesma intenção.
  const p = pontoNoPadrao(arg.tipo === 'regex' ? arg.corpo : arg.texto);
  if (p.emClasse) return `${metodo} com ponto em classe`;
  if (p.escapado) return `${metodo} com ponto escapado`;
  return null;
}

const corpoDaRegex = (literal: string) => literal.slice(1, literal.lastIndexOf('/'));
const colapsar = (s: string) => s.replace(/\s+/g, ' ').trim();

/** O argumento literal de uma chamada de corte — regex, string ou `new RegExp('…')` —, ou `null`. */
function argumentoDeCorte(no: ts.Expression): ArgumentoDeCorte | null {
  const x = desembrulhar(no);
  if (ts.isRegularExpressionLiteral(x)) return { tipo: 'regex', corpo: corpoDaRegex(x.text) };
  if (ts.isStringLiteralLike(x)) return { tipo: 'string', texto: x.text };
  if ((ts.isNewExpression(x) || ts.isCallExpression(x)) && ts.isIdentifier(x.expression) && x.expression.text === 'RegExp') {
    const a = x.arguments?.[0] && desembrulhar(x.arguments[0]);
    if (a && ts.isStringLiteralLike(a)) return { tipo: 'regex', corpo: a.text };
    if (a && ts.isRegularExpressionLiteral(a)) return { tipo: 'regex', corpo: corpoDaRegex(a.text) };
  }
  return null;
}

const CHAMADA_NO_TEMPLATE =
  /\.\s*(indexOf|split|search|matchAll|match|replaceAll|replace)\s*\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[a-z]*)/g;
const SEGMENTADOR_NO_TEMPLATE = /\bgranularity\s*:\s*(['"])sentence\1/g;

/** Os cortes num template Angular — de um `.html` ou do texto de um `template:` em linha. */
function cortesNoTemplate(template: string): Omit<CorteAMao, 'arquivo'>[] {
  const out: Omit<CorteAMao, 'arquivo'>[] = [];
  const semComentarioHtml = template.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const m of semComentarioHtml.matchAll(CHAMADA_NO_TEMPLATE)) {
    const bruto = m[2];
    const arg: ArgumentoDeCorte = bruto.startsWith('/')
      ? { tipo: 'regex', corpo: corpoDaRegex(bruto) }
      : { tipo: 'string', texto: bruto.slice(1, -1).replace(/\\(.)/g, '$1') };
    const forma = formaDoCorte(m[1], arg);
    if (forma) out.push({ forma, trecho: colapsar(`${m[0]})`) });
  }
  for (const m of semComentarioHtml.matchAll(SEGMENTADOR_NO_TEMPLATE)) {
    out.push({ forma: 'Intl.Segmenter por frase', trecho: colapsar(m[0]) });
  }
  return out;
}

/** O texto de um `template:` em linha; a interpolação vira espaço. */
function textoDoTemplate(no: ts.Expression): string | null {
  const x = desembrulhar(no);
  if (ts.isStringLiteralLike(x)) return x.text;
  if (ts.isTemplateExpression(x)) return [x.head.text, ...x.templateSpans.map((s) => s.literal.text)].join(' ');
  return null;
}

/** Os cortes de um fonte TypeScript ou JavaScript, e os `template:` em linha dos `@Component` dele. */
function cortesNoCodigo(arquivo: string, src: string, foraDoNucleo: boolean): {
  cortes: Omit<CorteAMao, 'arquivo'>[];
  templates: string[];
} {
  const sf = ts.createSourceFile(arquivo, src, ts.ScriptTarget.Latest, false);
  const cortes: Omit<CorteAMao, 'arquivo'>[] = [];
  const templates: string[] = [];
  const nomeDe = (n: ts.PropertyName) => (ts.isIdentifier(n) || ts.isStringLiteralLike(n) ? n.text : null);
  const importaAFrase = (spec: ts.Expression | undefined, no: ts.Node) => {
    if (foraDoNucleo && spec && ts.isStringLiteralLike(spec) && FRASE_PROFUNDA.test(spec.text)) {
      cortes.push({ forma: 'import profundo de format/frase', trecho: colapsar(no.getText(sf)) });
    }
  };
  const visitar = (no: ts.Node): void => {
    if (ts.isCallExpression(no)) {
      const callee = no.expression;
      const metodo = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isElementAccessExpression(callee) && ts.isStringLiteralLike(callee.argumentExpression)
          ? callee.argumentExpression.text
          : null;
      if (metodo && METODOS_DE_CORTE.has(metodo) && no.arguments.length > 0) {
        const arg = argumentoDeCorte(no.arguments[0]);
        const forma = arg && formaDoCorte(metodo, arg);
        if (forma) cortes.push({ forma, trecho: colapsar(no.getText(sf)) });
      }
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === 'require')) {
        importaAFrase(no.arguments[0], no);
      }
    }
    if (ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) importaAFrase(no.moduleSpecifier, no);
    if (ts.isImportEqualsDeclaration(no) && ts.isExternalModuleReference(no.moduleReference)) {
      importaAFrase(no.moduleReference.expression, no);
    }
    if (ts.isPropertyAssignment(no) && nomeDe(no.name) === 'granularity') {
      const v = desembrulhar(no.initializer);
      if (ts.isStringLiteralLike(v) && v.text === 'sentence') {
        cortes.push({ forma: 'Intl.Segmenter por frase', trecho: colapsar(no.getText(sf)) });
      }
    }
    if (
      ts.isDecorator(no) && ts.isCallExpression(no.expression) && ts.isIdentifier(no.expression.expression)
      && no.expression.expression.text === 'Component'
    ) {
      const opcoes = no.expression.arguments[0];
      if (opcoes && ts.isObjectLiteralExpression(opcoes)) {
        for (const p of opcoes.properties) {
          if (!ts.isPropertyAssignment(p) || nomeDe(p.name) !== 'template') continue;
          const t = textoDoTemplate(p.initializer);
          if (t !== null) templates.push(t);
        }
      }
    }
    ts.forEachChild(no, visitar);
  };
  visitar(sf);
  return { cortes, templates };
}

/**
 * A barreira inteira sobre uma lista de arquivos: acha os cortes, desconta as
 * exceções — uma ocorrência por entrada — e devolve o que sobrou dos dois lados.
 * `raiz` é de onde o caminho relativo é medido, e por isso a autoprova passa por
 * aqui com um diretório temporário, esteja ele onde estiver.
 */
function varrerCortesDeFrase(
  arquivos: readonly string[],
  raiz: string,
  excecoes: readonly ExcecaoDeCorte[],
): { ofensas: CorteAMao[]; sobrando: ExcecaoDeCorte[]; html: number; emLinha: number } {
  const achados: CorteAMao[] = [];
  let html = 0;
  let emLinha = 0;
  for (const f of arquivos) {
    const arquivo = relative(raiz, f).split(sep).join('/');
    if (DONOS_DA_FRASE.has(arquivo) || ehTeste(f)) continue;
    const src = readFileSync(f, 'utf8');
    if (f.endsWith('.html')) {
      html += 1;
      for (const c of cortesNoTemplate(src)) achados.push({ arquivo, ...c });
      continue;
    }
    if (!PODE_CORTAR.test(src)) continue;
    const { cortes, templates } = cortesNoCodigo(f, src, !arquivo.startsWith('packages/shared/'));
    for (const c of cortes) achados.push({ arquivo, ...c });
    emLinha += templates.length;
    for (const t of templates) {
      for (const c of cortesNoTemplate(t)) achados.push({ arquivo, forma: `${c.forma} (template em linha)`, trecho: c.trecho });
    }
  }
  const sobrando = [...excecoes];
  const ofensas: CorteAMao[] = [];
  for (const a of achados) {
    const i = sobrando.findIndex((e) => e.arquivo === a.arquivo && e.forma === a.forma && e.trecho === a.trecho);
    if (i >= 0) sobrando.splice(i, 1);
    else ofensas.push(a);
  }
  return { ofensas, sobrando, html, emLinha };
}

const EXTENSOES_DE_CODIGO = /\.[mc]?[jt]sx?$/;
const descreverCorte = (c: CorteAMao) => `${c.arquivo} — ${c.forma}: ${c.trecho}`;

/** Os alvos da barreira sob uma raiz: a do repositório, ou a da autoprova. */
function arquivosDaChamada(raiz: string): Record<'mobile' | 'web' | 'scripts' | 'nucleo', string[]> {
  return {
    mobile: walkExt(join(raiz, 'mobile', 'src'), EXTENSOES_DE_CODIGO),
    web: walkExt(join(raiz, 'web', 'src'), /\.(?:[mc]?[jt]sx?|html)$/),
    scripts: walkExt(join(raiz, 'scripts'), EXTENSOES_DE_CODIGO),
    nucleo: walkExt(join(raiz, 'packages', 'shared'), EXTENSOES_DE_CODIGO),
  };
}

/** O veredito sobre uma varredura: nenhuma exceção sobrando, nenhuma ofensa. */
function exigirSemCorteAMao({ ofensas, sobrando }: { ofensas: readonly CorteAMao[]; sobrando: readonly ExcecaoDeCorte[] }): void {
  assert.deepEqual(
    sobrando.map(descreverCorte),
    [],
    'exceção da barreira da chamada que não casa mais com nada — apague a entrada (o código saiu, ou mudou de forma):\n    ' +
      sobrando.map(descreverCorte).join('\n    '),
  );
  assert.deepEqual(
    ofensas.map(descreverCorte),
    [],
    `frase cortada à mão em ${ofensas.length} lugar(es):\n    ${ofensas.map(descreverCorte).join('\n    ')}\n` +
      '  A primeira frase de um texto é chamadaDoTexto (@vitale/shared) — ela corta onde a conferência corta, ' +
      'pula abreviação e milhar, e devolve null quando não há caderno. Se o corte não é de frase (um número, um ' +
      'nome de arquivo), ponha-o em EXCECOES_DE_CORTE com o motivo — não estreite a barreira.',
  );
}

/**
 * A prova de que a barreira vê — **pelo mesmo caminho**: os arquivos de verdade
 * num diretório temporário são achados por `arquivosDaChamada`, lidos por
 * `varrerCortesDeFrase` contra uma lista de exceção dela, e julgados por
 * `exigirSemCorteAMao`.
 */
function provarABarreiraDaChamada(): void {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-chamada-'));
  try {
    const escrever = (rel: string, fonte: string) => {
      const abs = join(dir, ...rel.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, `${fonte}\n`);
    };
    /** Arquivo → as formas que a barreira tem de achar nele, em ordem. */
    const esperado = new Map<string, string[]>();
    const caso = (rel: string, fonte: string, formas: string[]) => {
      escrever(rel, fonte);
      esperado.set(rel, formas);
    };

    caso('mobile/src/indice.ts', "export const a = (t: string) => t.slice(0, t.indexOf('.'));", ['indexOf com terminador']);
    caso(
      'mobile/src/string.tsx',
      "export const b = (t: string) => [t.split('.'), t.split('?'), t.split('!'), t.split('...'), t.split('. ')];",
      Array(5).fill('split com string de terminador'),
    );
    caso(
      'scripts/regex.mjs',
      "export const c = (t) => [t.split(/\\./), t.split(/[.]/), t.split(/[!?.]/), t.split(new RegExp('[.!?]'))];",
      Array(4).fill('split com regex de ponto'),
    );
    caso(
      'web/src/classe.ts',
      "export const d = (t: string) => [t.search(/[.!?]/), t.match(/[?.]/g), t.matchAll(/[.]/g), t.replace(/[.!?]\\s*/g, ''), t.replaceAll(/[.]/g, ''), t.search(/[\\.!?]/)];",
      ['search com ponto em classe', 'match com ponto em classe', 'matchAll com ponto em classe', 'replace com ponto em classe', 'replaceAll com ponto em classe', 'search com ponto em classe'],
    );
    caso(
      'packages/shared/src/revista/vitrine.ts',
      [
        'export const e = (t: string) => [',
        '  t.match(/\\.\\s/), t.replace(/\\.$/, \'\'), t.search(/\\.+\\s+[A-Z]/), t.match(/\\.(?=\\s)/),',
        "  t.match(/\\.[\"')]*\\s/), t.search('[.!?]'), t.match('\\\\.\\\\s'),",
        '];',
      ].join('\n'),
      [
        'match com ponto escapado', 'replace com ponto escapado', 'search com ponto escapado', 'match com ponto escapado',
        'match com ponto escapado', 'search com ponto em classe', 'match com ponto escapado',
      ],
    );
    // As duas mais naturais: o gêmeo de indexOf('.') e a "primeira frase que respeita milhar".
    caso(
      'mobile/src/natural.ts',
      [
        'export const p = (t: string) => t.slice(0, t.search(/\\./) + 1);',
        'export const q = (t: string) => t.match(/^(.+?)\\.(?!\\d)/)?.[1];',
        "export const r = (t: string) => [t.replace(/\\./g, ''), t.split(/\\d\\./), t.matchAll(new RegExp('x\\\\.'))];",
      ].join('\n'),
      ['search com ponto escapado', 'match com ponto escapado', 'replace com ponto escapado', 'split com regex de ponto', 'matchAll com ponto escapado'],
    );
    caso(
      'mobile/src/embrulho.ts',
      "export const f = (t: string) => [t['split']('.'), t?.split('.'), (t as string).indexOf(('.' as const))];",
      ['split com string de terminador', 'split com string de terminador', 'indexOf com terminador'],
    );
    caso('scripts/segmentador.cjs', "module.exports = new Intl.Segmenter('pt', { granularity: 'sentence' });", ['Intl.Segmenter por frase']);
    caso(
      'web/src/profundo.ts',
      [
        "import { terminaFrase } from '@vitale/shared/src/format/frase';",
        "export { terminaFrase as t } from '../../packages/shared/src/format/frase.ts';",
        "export const g = () => import('../format/frase');",
        "export const h = require('packages/shared/src/format/frase.js');",
      ].join('\n'),
      Array(4).fill('import profundo de format/frase'),
    );
    caso(
      'web/src/app/pagina.component.html',
      "<p>{{ texto.split('.')[0] }}</p>\n<p [title]=\"t?.indexOf('.')\"></p>\n<!-- {{ texto.split('!') }} -->",
      ['split com string de terminador', 'indexOf com terminador'],
    );
    caso(
      'web/src/app/cartao.component.ts',
      "@Component({ selector: 'x-cartao', template: `<p>{{ t.split('?')[0] }}</p><!-- {{ t.indexOf('.') }} -->` })\nexport class Cartao {}",
      ['split com string de terminador (template em linha)'],
    );
    // O template sem palavra de corte nenhuma também é contado: a contagem é de template, não de suspeito.
    caso('web/src/app/vazio.component.ts', "@Component({ selector: 'x-vazio', template: '<p>{{ t }}</p>' })\nexport class Vazio {}", []);
    // A exceção absorve a ocorrência dela — e uma só: a segunda, idêntica, ofende.
    caso(
      'mobile/src/app/nome.tsx',
      'export const n = (raw: string) => String(raw).trim().split(/[\\s.]+/);\nexport const m = (raw: string) => String(raw).trim().split(/[\\s.]+/);',
      ['split com regex de ponto'],
    );

    // O que não é ofensa.
    caso(
      'mobile/src/legitimo.ts',
      [
        '// t.indexOf(\'.\') e t.split(\'.\') só no comentário',
        '/* t.match(/[.!?]/) */',
        "const doc = \"t.split('.')\";",
        "import { formatarNumero } from '../format/numero';",
        "export const k = (x: string) => [x.replace('.', ','), x.split(','), x.match(/\\d+\\.\\d+/),",
        "  x.indexOf(','), x.indexOf('.5'), x.split(/\\\\./), new Intl.Segmenter('pt', { granularity: 'word' }), doc, formatarNumero,",
        // O ponto escapado entre padrões de dígito é número, não frase.
        "  x.replace(/\\d\\.\\d/, ''), x.match(/[0-9]\\.[0-9]/), x.search(/\\d{1,3}(?:\\.\\d{3})+/), x.split(/(\\d+)\\.?\\d*/)];",
      ].join('\n'),
      [],
    );
    caso('packages/shared/src/revista/chamada.ts', "export const dono = (t: string) => t.indexOf('.');", []);
    caso('packages/shared/src/format/frase.ts', "export const dono = (t: string) => t.split('.');", []);
    caso('packages/shared/src/revista/vizinho.ts', "import { terminaFrase } from '../format/frase';\nexport { terminaFrase };", []);
    caso('mobile/src/corte.test.ts', "export const t = (x: string) => x.indexOf('.');", []);
    caso('scripts/corte.test.mjs', "export const t = (x) => x.split('.');", []);
    caso('web/src/corte.spec.js', "export const t = (x) => x.split('.');", []);
    caso('mobile/src/__tests__/corte.jsx', "export const t = (x) => x.split('.');", []);
    caso('web/src/app/comentario.component.html', "<!-- {{ t.split('.') }} -->\n<p>{{ t.replace('.', ',') }}</p>", []);

    const excecoes: ExcecaoDeCorte[] = [
      {
        arquivo: 'mobile/src/app/nome.tsx',
        forma: 'split com regex de ponto',
        trecho: 'String(raw).trim().split(/[\\s.]+/)',
        motivo: 'autoprova',
      },
      { arquivo: 'mobile/src/sumiu.ts', forma: 'indexOf com terminador', trecho: "t.indexOf('.')", motivo: 'autoprova' },
      // Arquivo e forma certos, trecho errado: não absorve a ofensa de indice.ts.
      { arquivo: 'mobile/src/indice.ts', forma: 'indexOf com terminador', trecho: "t.indexOf('?')", motivo: 'autoprova' },
      // Arquivo e trecho certos, forma errada: também não absorve.
      { arquivo: 'mobile/src/indice.ts', forma: 'split com string de terminador', trecho: "t.indexOf('.')", motivo: 'autoprova' },
    ];

    const resultado = varrerCortesDeFrase(Object.values(arquivosDaChamada(dir)).flat(), dir, excecoes);
    const { ofensas, sobrando, html, emLinha } = resultado;
    const achado = new Map<string, string[]>();
    for (const o of ofensas) achado.set(o.arquivo, [...(achado.get(o.arquivo) ?? []), o.forma]);
    for (const [rel, formas] of esperado) {
      assert.deepEqual(achado.get(rel) ?? [], formas, `a barreira da chamada leu errado ${rel}`);
    }
    assert.deepEqual([...achado.keys()].filter((k) => !esperado.has(k)), [], 'a barreira acusou arquivo fora da autoprova');
    assert.deepEqual(sobrando.map(descreverCorte), [
      "mobile/src/sumiu.ts — indexOf com terminador: t.indexOf('.')",
      "mobile/src/indice.ts — indexOf com terminador: t.indexOf('?')",
      "mobile/src/indice.ts — split com string de terminador: t.indexOf('.')",
    ]);
    assert.equal(html, 2, 'os .html da autoprova não entraram');
    assert.equal(emLinha, 2, 'os template: em linha da autoprova não entraram');
    // O veredito reprova cada metade sozinha, e aprova o vazio.
    assert.throws(() => exigirSemCorteAMao({ ofensas: [], sobrando }), /não casa mais com nada/);
    assert.throws(() => exigirSemCorteAMao({ ofensas, sobrando: [] }), /frase cortada à mão/);
    exigirSemCorteAMao({ ofensas: [], sobrando: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

check('BARREIRA — nenhum arquivo, fora de teste, corta frase à mão (a chamada tem dono)', () => {
  provarABarreiraDaChamada();

  const raizes = arquivosDaChamada(ROOT);
  for (const [nome, arquivos] of Object.entries(raizes)) {
    assert.ok(arquivos.length > 0, `${nome} sumiu da varredura — a barreira da chamada ficou sem alvo`);
  }
  for (const dono of DONOS_DA_FRASE) {
    assert.ok(existsSync(join(ROOT, dono)), `${dono} sumiu — a barreira isenta um dono que não existe`);
  }

  const resultado = varrerCortesDeFrase(Object.values(raizes).flat(), ROOT, EXCECOES_DE_CORTE);
  const { html, emLinha } = resultado;
  assert.ok(html > 0, 'nenhum template .html entrou na varredura');
  assert.ok(emLinha > 0, 'nenhum template: em linha entrou na varredura');
  exigirSemCorteAMao(resultado);
  console.log(`     · ${Object.values(raizes).flat().length} arquivos, ${html} .html, ${emLinha} template: em linha`);
});

/**
 * BARREIRA — nenhum arquivo de `ia/` reexporta a chamada ou a regra de fim de frase (story 1.8).
 *
 * A chamada mora **fora** de `ia/` por causa da guarda (7): toda peça de `ia/`
 * fora da porta conta no teto, e as três telas que vão importar a chamada (1.11,
 * 1.13, 1.14) levariam o teto junto. Um reexporte por `ia/` a traria de volta
 * para dentro pela porta dos fundos; um reexporte de `terminaFrase` a poria no
 * barril, onde ela não deve estar.
 *
 * Varre `ia/` **recursivamente** e acusa o reexporte por caminho relativo
 * (`export { chamadaDoTexto } from '../revista/chamada'`), por `@vitale/shared`,
 * por `export *` (do módulo da chamada, da regra ou do barril inteiro), e em dois
 * passos — importado e depois exportado, com outro nome, embrulhado em `as` ou
 * parênteses (`desembrulhar`, o mesmo da barreira do vocabulário), ou pelo
 * namespace (`chamada.chamadaDoTexto`).
 *
 * **O que não vê:** o export dentro de objeto literal (`export const x = {
 * chamadaDoTexto }`); o apelido local exportado depois (`const t = terminaFrase;
 * export { t }`); a função que só a embrulha (`(t) => chamadaDoTexto(t)`); e o
 * reexporte por um terceiro módulo fora de `ia/`. O teste de barril de
 * `revista/chamada.test.ts` compara por identidade, e pega o apelido que chegar ao
 * barril por qualquer um desses caminhos.
 */
const NOMES_DA_CHAMADA = new Set(['chamadaDoTexto', 'terminaFrase']);
const MODULOS_DA_CHAMADA = new Set(['revista/chamada', 'format/frase']);

/** O módulo do núcleo que um specifier alcança, relativo a `src/` e sem extensão — `''` é o barril. */
function moduloDoNucleo(arquivo: string, spec: string, src: string): string | null {
  let alvo: string;
  if (spec.startsWith('.')) {
    alvo = relative(src, resolve(dirname(arquivo), spec)).split(sep).join('/');
  } else {
    const m = /^@vitale\/shared(?:\/src)?(?:\/(.*))?$/.exec(spec);
    if (!m) return null;
    alvo = m[1] ?? '';
  }
  return alvo.replace(/\.[mc]?[jt]sx?$/, '').replace(/(?:^|\/)index$/, '');
}

/** Os arquivos de `ia/` sob um `src/` — o do núcleo, ou o da autoprova —, varridos recursivamente. */
function reexportamAChamada(src: string): string[] {
  const arquivos = walk(join(src, 'ia'));
  assert.ok(arquivos.length > 0, `${join(src, 'ia')} sumiu ou está vazio — a barreira do reexporte ficou sem alvo`);
  const fora: string[] = [];
  for (const f of arquivos) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, false);
    const traz = (spec: ts.Expression | undefined): boolean => {
      if (!spec || !ts.isStringLiteralLike(spec)) return false;
      const m = moduloDoNucleo(f, spec.text, src);
      return m !== null && (m === '' || MODULOS_DA_CHAMADA.has(m));
    };
    const locais = new Set<string>();
    const espacos = new Set<string>();
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) && traz(st.moduleSpecifier) && st.importClause?.namedBindings) {
        const nb = st.importClause.namedBindings;
        if (ts.isNamespaceImport(nb)) espacos.add(nb.name.text);
        else for (const el of nb.elements) if (NOMES_DA_CHAMADA.has((el.propertyName ?? el.name).text)) locais.add(el.name.text);
      }
      if (ts.isImportEqualsDeclaration(st) && ts.isExternalModuleReference(st.moduleReference) && traz(st.moduleReference.expression)) {
        espacos.add(st.name.text);
      }
    }
    const reexporta = (e: ts.Expression): boolean => {
      const x = desembrulhar(e);
      if (ts.isIdentifier(x)) return locais.has(x.text) || espacos.has(x.text);
      if (ts.isPropertyAccessExpression(x) && ts.isIdentifier(x.expression)) {
        return espacos.has(x.expression.text) && NOMES_DA_CHAMADA.has(x.name.text);
      }
      if (ts.isElementAccessExpression(x) && ts.isIdentifier(x.expression) && ts.isStringLiteralLike(x.argumentExpression)) {
        return espacos.has(x.expression.text) && NOMES_DA_CHAMADA.has(x.argumentExpression.text);
      }
      return false;
    };
    const achados: string[] = [];
    for (const st of sf.statements) {
      if (ts.isExportDeclaration(st)) {
        const clausula = st.exportClause;
        if (st.moduleSpecifier) {
          if (!traz(st.moduleSpecifier)) continue;
          if (!clausula || ts.isNamespaceExport(clausula)) achados.push(colapsar(st.getText(sf)));
          else if (clausula.elements.some((el) => NOMES_DA_CHAMADA.has((el.propertyName ?? el.name).text))) {
            achados.push(colapsar(st.getText(sf)));
          }
        } else if (clausula && ts.isNamedExports(clausula)) {
          if (clausula.elements.some((el) => reexporta(el.propertyName ?? el.name as ts.Identifier))) {
            achados.push(colapsar(st.getText(sf)));
          }
        }
      }
      if (ts.isVariableStatement(st) && st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const d of st.declarationList.declarations) {
          if (d.initializer && reexporta(d.initializer)) achados.push(colapsar(st.getText(sf)));
        }
      }
      if (ts.isExportAssignment(st) && reexporta(st.expression)) achados.push(colapsar(st.getText(sf)));
    }
    if (achados.length > 0) fora.push(`${relative(src, f).split(sep).join('/')} (${achados.join(' | ')})`);
  }
  return fora.sort();
}

function provarOReexporteDaChamada(): void {
  const dir = mkdtempSync(join(tmpdir(), 'orbe-guarda-reexporte-'));
  try {
    const src = join(dir, 'packages', 'shared', 'src');
    const escrever = (rel: string, fonte: string) => {
      const abs = join(src, ...rel.split('/'));
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, `${fonte}\n`);
    };
    const ofensas: readonly (readonly [string, string])[] = [
      ['ia/r01.ts', "export { chamadaDoTexto } from '../revista/chamada';"],
      ['ia/r02.ts', "export { chamadaDoTexto as manchete } from '../revista/chamada.ts';"],
      ['ia/r03.ts', "export * from '../revista/chamada';"],
      ['ia/r04.ts', "export * from '../format/frase';"],
      ['ia/r05.ts', "export { terminaFrase } from '../format/frase.js';"],
      ['ia/r06.ts', "export { chamadaDoTexto } from '@vitale/shared';"],
      ['ia/r07.ts', "export * from '@vitale/shared';"],
      ['ia/r08.ts', "export * as nucleo from '..';"],
      ['ia/r09.ts', "export * from '../index';"],
      ['ia/r10.ts', "import { chamadaDoTexto as c } from '../revista/chamada';\nexport { c };"],
      ['ia/r11.ts', "import { chamadaDoTexto } from '@vitale/shared';\nexport const manchete = (chamadaDoTexto as typeof chamadaDoTexto);"],
      ['ia/r12.ts', "import * as chamada from '../revista/chamada';\nexport const manchete = chamada.chamadaDoTexto;"],
      ['ia/r13.ts', "import { terminaFrase } from '../format/frase';\nexport default terminaFrase;"],
      ['ia/r14.ts', "import * as regra from '@vitale/shared/src/format/frase';\nexport { regra };"],
      ['ia/sub/r15.ts', "export { chamadaDoTexto } from '../../revista/chamada';"],
    ];
    const limpos: readonly (readonly [string, string])[] = [
      ['ia/n01.ts', "import { chamadaDoTexto } from '../revista/chamada';\nexport const usa = chamadaDoTexto('Foi.');"],
      ['ia/n02.ts', "// export * from '../revista/chamada'\nexport { formatarNumero } from '../format/numero';"],
      ['ia/n03.ts', "export { verificarTexto } from '@vitale/shared';"],
      ['ia/n04.ts', "import { terminaFrase } from '../format/frase';\nconst t = terminaFrase;\nexport const u = typeof t;"],
      ['ia/n05.ts', "export * from './pacote';"],
    ];
    for (const [rel, fonte] of [...ofensas, ...limpos]) escrever(rel, fonte);
    // Fora de ia/: não é alvo, mesmo reexportando.
    escrever('revista/fora.ts', "export * from './chamada';");
    const achados = reexportamAChamada(src).map((x) => x.split(' (')[0]);
    assert.deepEqual(achados, ofensas.map(([rel]) => rel).sort(), 'a barreira do reexporte leu errado a autoprova');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

check('BARREIRA — nenhum arquivo de ia/ reexporta a chamada ou a regra de fim de frase', () => {
  provarOReexporteDaChamada();
  const fora = reexportamAChamada(SHARED_SRC);
  assert.deepEqual(
    fora,
    [],
    `ia/ reexporta a chamada ou a regra: ${fora.join(', ')}. A chamada mora fora de ia/ para não contar como ` +
      'peça de IA na guarda (7), e a regra de fim de frase é interna ao núcleo. Quem precisa da chamada importa ' +
      'de @vitale/shared (ou de ../revista/chamada, dentro do núcleo).',
  );
});

console.log(`\n${passed} testes passaram.`);
